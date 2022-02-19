/*
 * Copyright (c) 2021-2022. Jan Sohn.
 * All rights reserved.
 * I don't want anyone to use my source code without permission.
 */
const DiscordOauth2 = require("discord-oauth2");
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const session = require('express-session');
const express = require('express');
const router = express.Router();
const db = require("../utils/db.js");
const fs = require("fs");
const {in_array} = require("../utils/utils.js");

router.use(cookieParser());
router.use(session({
	key: "session_id",
	secret: config.jwt_secret,
	resave: false,
	saveUninitialized: false,
	cookie: {
		expires: 1000 * 60 * 60, //1 day
	},
}));
router.use((request, response, next) => {
	// noinspection JSUnresolvedVariable
	if (request.cookies[ "session_id" ] && !request.session.discord) {
		response.clearCookie("session_id");
	}
	next();
});

global.oauth = new DiscordOauth2({
	version: "v9",
	clientId: config.discord.client_id,
	clientSecret: config.discord.client_secret,
	credentials: Buffer.from(`${config.discord.client_id}:${config.discord.client_secret}`).toString("base64"),
	scope: "identify email connections guilds.join",
	redirectUri: "https://cosmetic-x.de/login/callback",
});

const loginLimiter = rateLimit({
	windowMs: 1000 * 60 * 5,
	max: 10,
	handler: function (req, res) {
		res.status(200).json({
			error: "You have been rate limited",
		});
	},
});
const resetTokenLimiter = rateLimit({
	windowMs: 1000 * 60,
	max: 5,
	handler: function (req, res) {
		res.status(202);
	},
});

global.redirectDashboardIfLoggedIn = (request, response, next) => {
	if (request.session.discord && request.cookies[ "session_id" ]) {
		response.redirect("/dashboard");
	} else {
		next();
	}
};
global.checkForSession = (request, response, next) => {
	if (request.session.discord === undefined) {
		response.redirect("/login");
	} else {
		next();
	}
};
global.checkPermissions = async (request, response, next) => {
	let member = bot.guilds.cache.first().members.cache.get(request.session.discord.user.id);

	if (!member) {
		member = await bot.guilds.cache.first().members.fetch(request.session.discord.user.id);
	}
	if (member) {
		request.session.isAdmin = member.roles.cache.hasAny(...config.discord.admin_roles);
		request.session.isClient = member.roles.cache.hasAny(...config.discord.client_roles);
		request.session.isPremium = member.roles.cache.hasAny(...config.discord.premium_roles) || member.roles.cache.hasAny(...config.discord.admin_roles);
	} else {
		request.session.isAdmin = request.session.isClient = request.session.isPremium = false;

	}
	if (request.session.isClient) {
		request.session.maxTeamsReached = (request.session.isAdmin ? false : (db.teams.getOwnTeams(request.session.discord.user.id).length >= (request.session.isPremium ? config.features.premium.max_teams : config.features.default.max_teams)));
	}
	next();
};
global.checkForAdmin = (request, response, next) => {
	if (request.session.isAdmin) {
		next();
	} else {
		response.redirect("/dashboard");
	}
};
global.checkForTeam = async (request, response, next) => {
	if (!request.params.team) {
		response.redirect("/dashboard/teams");
	} else {
		let team = await db.teams.getTeam(request.params.team);
		if (!team) {
			response.redirect("/dashboard/teams?error=Team not exists.");
		} else {
			if (
				request.session.isAdmin
				|| team.owner_id === request.session.discord.user.id
				|| in_array(request.session.discord.user.id, team.manage_drafts)
				|| in_array(request.session.discord.user.id, team.manage_submissions)
				|| in_array(request.session.discord.user.id, team.contributors)
			) {
				request.team = team;
				next();
			} else {
				response.redirect("/dashboard?error=Missing permission.");
			}
		}
	}
};


// ################################
// #                              Router section                              #
// ################################
router.get("/", checkForSession, redirectDashboardIfLoggedIn, function (request, response, next) {
	response.status(200).send("No general dashboard content ideas");
});
router.get("/ping", function (request, response, next) {
	response.status(200).send("PONG!");
});

// ################################
// #                           Dashboard section                           #
// ################################
router.get("/dashboard", checkForSession, checkPermissions, function (request, response, next) {
	//TODO: maybe add more
	console.log("Redirect to /dashboard/teams");
	response.redirect("/dashboard/teams");
});
router.get("/dashboard/teams", checkForSession, checkPermissions, async function (request, response, next) {
	let own_teams = await db.teams.getOwnTeams(request.session.discord.user.id);
	let draft_teams = await db.user.team.getDraftTeams(request.session.discord.user.id);
	let submission_teams = await db.user.team.getSubmissionsTeams(request.session.discord.user.id);
	let contributing_teams = await db.user.team.getContributingTeams(request.session.discord.user.id);
	let granted_teams = {...draft_teams, ...submission_teams, ...contributing_teams};


	for (let k in own_teams) {
		own_teams[ k ].locked = (k+1) >= (request.session.isPremium ? config.features.premium.max_teams : config.features.default.max_teams);
		own_teams[ k ].creator = bot.guilds.cache.first().members.cache.get(own_teams[ k ].owner_id).user.tag;
	}
	for (let k in granted_teams) {
		granted_teams[ k ].locked = !await db.user.isPremium(draft_teams[ k ].owner_id);
		granted_teams[ k ].creator = bot.guilds.cache.first().members.cache.get(draft_teams[ k ].owner_id).user.tag;
	}
	response.render("dashboard/teams", {
		showNavBar: true,
		title: "Teams",
		name: request.session.discord.user.username + "#" + request.session.discord.user.discriminator,
		own_teams: own_teams,
		granted_teams: granted_teams,
		isAdmin: request.session.isAdmin,
		isClient: request.session.isClient,
		isPremium: request.session.isPremium,
		maxTeamsReached: (request.session.isAdmin ? false : (own_teams.length >= (request.session.isPremium ? config.features.premium.max_teams : config.features.default.max_teams)))
	});
});
router.get("/dashboard/teams/@/:team", checkForSession, checkPermissions, checkForTeam, async function (request, response, next) {
	if (request.team && !request.team.token) {
		await db.teams.resetToken(request.team.name);
	}
	let variables = {
		showNavBar: true,
		title: request.team.name + " - Dashboard",
		name: request.session.discord.user.username + "#" + request.session.discord.user.discriminator,
		permissions: {
			owner: request.team.owner_id === request.session.discord.user.id,
			drafts: request.team.owner_id === request.session.discord.user.id || in_array(request.session.discord.user.id, request.team.manage_drafts),
			submissions: request.team.owner_id === request.session.discord.user.id || in_array(request.session.discord.user.id, request.team.manage_submissions),
			contribute: request.team.owner_id === request.session.discord.user.id || in_array(request.session.discord.user.id, request.team.contributors),
		},
		isAdmin: request.session.isAdmin,
		isClient: request.session.isClient,
		isPremium: request.session.isPremium,
		maxSlotsReached: false,
		team: request.team,
		team_draft_cosmetics: [],
		team_submitted_cosmetics: [],
		cosmetics: request.team.cosmetics,
	};
	console.log(variables);
	response.render("dashboard/teams/dashboard", variables);
});
router.get("/dashboard/teams/new", checkForSession, checkPermissions, function (request, response, next) {
	response.render("dashboard/teams/new", {
		showNavBar: true,
		title: "New Team",
		name: request.session.discord.user.username + "#" + request.session.discord.user.discriminator,
		user_id: request.session.discord.user.id,
		isAdmin: request.session.isAdmin,
		isClient: request.session.isClient,
		isPremium: request.session.isPremium,
	});
});
router.get("/teams/@/:team/cosmetics/delete/:cosmetic", checkForSession, checkPermissions, checkForTeam, function (request, response, next) {
	if (!request.query.id) {
		response.redirect("/teams");
	} else {
		let team = db.teams.getTeam(request.query.name)
		response.render("dashboard/teams/delete", {
			showNavBar: true,
			title: "New Team",
			name: request.session.discord.user.username + "#" + request.session.discord.user.discriminator,
			isAdmin: request.session.isAdmin,
			isClient: request.session.isClient,
			isPremium: request.session.isPremium,
		});
	}
});

router.get("/clients", checkForSession, checkPermissions, function (request, response, next) {
	let clients = {};
	let versions = db.auto_updater.getVersions();
	for (let k in versions) {
		if (!clients[versions[k].name]) {
			clients[versions[k].name] = [];
		}
		clients[versions[k].name][(clients[versions[k].name].length)] = versions[k].tag;
	}
	response.render("clients", {
		showNavBar: true,
		title: "Clients",
		isAdmin: request.session.isAdmin,
		isClient: request.session.isClient,
		isPremium: request.session.isPremium,
		clients: clients,
	});
});


// ################################
// #                               POST section                               #
// ################################
router.post("/dashboard/teams/@/:team/reset-token", resetTokenLimiter, checkForSession, checkForTeam, function (request, response, next) {
	if (request.session.isClient) {
		db.teams.resetToken(request.team.name);
		response.status(202);
	} else {
		response.status(401);
	}
});

// ################################
// #                               Login section                                #
// ################################
router.get("/login", loginLimiter, redirectDashboardIfLoggedIn, function (request, response, next) {
	response.render("authenticate", {url: "https://discord.com/api/oauth2/authorize?client_id=" + config.discord.client_id + "&redirect_uri=" + config.discord.redirect_uri + "&response_type=code&scope=guilds.members.read%20email%20identify%20connections%20guilds%20guilds.join"});
});
router.get("/login/callback", async function (request, response, next) {
	if (!request.query.code) {
		response.redirect("/login");
	} else {
		// noinspection JSCheckFunctionSignatures
		let data = await oauth.tokenRequest({grantType: "authorization_code", code: request.query.code}).catch((e) => response.status(500).render("issues/discord-issue", {description: e.message}));
		try {
			request.session.discord = {
				user: await oauth.getUser(data.access_token),
				connections: await oauth.getUserConnections(data.access_token),
				access_token: data.access_token,
				token_expires_in: data.expires_in,
				refresh_token: data.refresh_token,
				token_type: data.token_type,
			};
			request.session.discord.user.tag = request.session.discord.user.username + "#" + request.session.discord.user.discriminator;
		} catch (e) {
			response.status(500).render("issues/discord-issue", {description: e.message});
			return;
		}
		if (!request.session.discord.user.verified) {
			response.status(401).render("issues/discord-issue", {title: "Cosmetic-X", description: "Your Discord-Account isn't verified, please verify your Discord-Account first."});
			return;
		}
		await oauth.addMember({
			userId: request.session.discord.user.id,
			guildId: config.discord.guild_id,
			botToken: fs.readFileSync("./TOKEN.txt").toString(),
			accessToken: data.access_token
		});
		await db.user.register(request.session.discord.user.id, request.session.discord.user.username, request.session.discord.user.discriminator, request.session.discord.user.email);
		response.status(200).redirect("/dashboard");
	}
});
router.get("/logout", async function (request, response, next) {
	if (request.session.discord && request.cookies[ "session_id" ]) {
		await oauth.revokeToken(request.session.discord.access_token);
		request.session.destroy();
		response.clearCookie("session_id");
		response.redirect("/login");
	} else {
		response.redirect("/login");
	}
});

// ################################
// #                               Admin section                               #
// ################################
router.get("/admin", checkForSession, checkPermissions, checkForAdmin, function (request, response, next) {
	response.render("dashboard/admin/dashboard", {
		showNavBar: true,
		title: "Admin Panel",
		isAdmin: request.session.isAdmin,
		isClient: request.session.isClient,
		isPremium: request.session.isPremium,
		cosmetics: db.api.getPublicCosmetics(),
	});
});
router.get("/admin/users", checkForSession, checkPermissions, checkForAdmin, async function (request, response, next) {
	response.render("dashboard/admin/users", {
		showNavBar: true,
		title: "Admin Panel",
		isAdmin: request.session.isAdmin,
		isClient: request.session.isClient,
		isPremium: request.session.isPremium,
		users: await db.user.getAll(),
		system: {
			admin_roles: config.discord.admin_roles,
			client_roles: config.discord.client_roles,
			premium_roles: config.discord.premium_roles
		}
	});
});

module.exports = router;
