/*
 * Copyright (c) Jan Sohn / xxAROX
 * All rights reserved.
 * I don't want anyone to use my source code without permission.
 */
const DiscordOauth2 = require("discord-oauth2");
const {Octokit} = require("@octokit/core");
const octokit = new Octokit({auth: config.github.access_token});
const Discord = require("discord.js");
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const session = require('express-session');
const express = require('express');
const router = express.Router();
const db = require("../utils/db.js");
const fs = require("fs");
const {in_array} = require("../utils/utils.js");
const {teams} = require("../utils/db");
global.DOMAIN = (!process.env.USERNAME ? "https://cosmetic-x.de" : "http://localhost:" + config.port);

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
	redirectUri: (COSMETICX_LINK + "/login/callback")
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
global.checkForSession = async (request, response, next) => {
	response.header("cache-control", "no-cache, private");
	if (request.session.discord === undefined) {
		response.redirect("/login");
	} else {
		let user = await db.user.getUser(request.session.discord.user.id);
		if (user) {
			await user.fetchMember();
			await user.updateInvites();
			request.cosx_user = user;
			next();
		} else {
			response.redirect("/login?error=User not found in cache");
		}
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
		request.session.maxTeamsReached = (request.session.isAdmin ? false : (db.teams.getOwnTeams(request.session.discord.user.id).size >= (request.session.isPremium ? config.features.premium.max_teams : config.features.default.max_teams)));
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
				|| team.admins.has(request.session.discord.user.id)
				|| team.manage_drafts.has(request.session.discord.user.id)
				|| team.manage_submissions.has(request.session.discord.user.id)
				|| team.contributors.has(request.session.discord.user.id)
			) {
				await team.reloadCosmetics();
				await team.reloadPermissions();
				request.team = team;
				next();
			} else {
				response.redirect("/dashboard?error=Missing permission.");
			}
		}
	}
};
global.checkForCosmetic = async (request, response, next) => {
	if (!request.params.cosmetic) {
		response.redirect("/dashboard/teams/@/" + request.team.name);
	} else {
		let cosmetic = request.team.getCosmetic(request.params.cosmetic);
		if (!cosmetic) {
			response.redirect("/dashboard/teams/@/" + request.team.name + "?error=Cosmetic not found.");
		} else {
			if (
				request.session.isAdmin
				|| request.team.owner_id === request.session.discord.user.id
				|| request.team.admins.has(request.session.discord.user.id)
				|| request.team.manage_drafts.has(request.session.discord.user.id)
			) {
				if (cosmetic.locked) {
					response.redirect("/dashboard/teams/@/" + request.team.name + "?error=Cosmetic is locked.");
				} else {
					request.cosmetic = cosmetic;
					next();
				}
			} else {
				response.redirect("/dashboard/teams/@/" + request.team.name + "?error=Missing permission.");
			}
		}
	}
};
global.checkForMember = async (request, response, next) => {
	if (!request.params.member) {
		response.redirect("/dashboard/teams/@/" + request.team.name);
	} else {
		let member = (await request.team.getMembers()).filter(member => member.discord_id === request.params.member).first();
		if (!member) {
			response.redirect("/dashboard/teams/@/" + request.team.name + "?error=Member not in Team.");
		} else {
			request.member = member;
			next();
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
router.get("/downloads", function (request, response, next) {
	response.status(200).json({
		"downloads": {
			"Rich-Presence-Client": {
				"win32": COSMETICX_LINK + "/downloads/rpc/client.exe",
				"darwin": COSMETICX_LINK + "/downloads/rpc/client.app",
			},
			"Upgrader": {
				"win32": COSMETICX_LINK + "/downloads/rpc/upgrader.exe",
				"darwin": COSMETICX_LINK + "/downloads/rpc/upgrader.app",
			},
			"PocketMine-Client": COSMETICX_LINK + "/downloads/client/PocketMine-Client.phar",
			"Nukkit-Client": COSMETICX_LINK + "/downloads/client/Nukkit-Client.phar",
		}
	}); // TODO: create download page
});
router.get("/downloads/rpc/upgrader/:file_extension", function (request, response, next) {
	let extension = request.params["file_extension"];
	if (!extension) {
		response.status(400).send("Missing extension");
		return;
	}
	if (!extension.startsWith(".")) {
		extension = "." + extension;
	}
	switch (extension.toLowerCase()) {
		case ".exe":      response.download("https://github.com/Cosmetic-X/rpc-upgrader/releases/download/latest/upgrader.exe");        break;
		case ".app":       response.download("https://github.com/Cosmetic-X/rpc-upgrader/releases/download/latest/upgrader.app");        break;
		default:             response.status(404).send("Extension not supported, supported [exe, app]");  break;
	}
	response.status(200).send("No general downloads content ideas"); // TODO: create download page
});
router.get("/downloads/client/:client_name", function (request, response, next) {
	let client_name = request.params["client_name"];
	if (!client_name) {
		response.status(400).send("Missing client_name parameter");
	} else{
		response.status(200).send("No general downloads content ideas"); // TODO: create download page
	}
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
	//let own_teams = request.cosx_user.getOwnTeams();
	let own_teams = await db.teams.getOwnTeams(request.session.discord.user.id);
	let granted_teams = await request.cosx_user.getGrantedTeams();

	let i = 1;
	own_teams.forEach(team => {
		team.locked = i > (team.hasPremiumFeatures ? config.features.premium.max_teams : config.features.default.max_teams);
		i++;
	});
	i = 1;
	granted_teams.forEach(team => {
		team.locked = !team.hasPremiumFeatures;
		i++;
	});
	response.render("dashboard/teams", {
		showNavBar: true,
		title: "Teams",
		user: request.cosx_user,
		can_join_teams: true,
		hasInvites: request.cosx_user.invites.size > 0,
		invites: request.cosx_user.invites.values(),
		name: request.session.discord.user.username + "#" + request.session.discord.user.discriminator,
		own_teams: own_teams.each(team => team.toObject()).values(),
		granted_teams: granted_teams.each(team => team.toObject()).values(),
		isAdmin: request.session.isAdmin,
		isClient: request.session.isClient,
		is_in_other_teams: granted_teams.size > 0,
		isPremium: request.session.isPremium,
		maxTeamsReached: (request.session.isAdmin ? false : (own_teams.size >= (request.session.isPremium ? config.features.premium.max_teams : config.features.default.max_teams)))
	});
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
router.get("/dashboard/teams/@/:team", checkForSession, checkPermissions, checkForTeam, async function (request, response, next) {
	if (request.team && !request.team.token) {
		request.team.resetToken();
	}
	let i = 1;
	(await db.teams.getOwnTeams(request.session.discord.user.id)).forEach(team => {
		team.locked = i > (team.hasPremiumFeatures ? config.features.premium.max_teams : config.features.default.max_teams);
		i++;
	});
	let permissions = {
		view: request.team.owner_id === request.session.discord.user.id || request.team.admins.has(request.session.discord.user.id) || request.team.manage_drafts.has(request.session.discord.user.id) || request.team.manage_submissions.has(request.session.discord.user.id) || request.team.contributors.has(request.session.discord.user.id),
		owner: request.team.owner_id === request.session.discord.user.id || request.team.admins.has(request.session.discord.user.id),
		drafts: request.team.owner_id === request.session.discord.user.id || request.team.admins.has(request.session.discord.user.id) || request.team.manage_drafts.has(request.session.discord.user.id),
		submissions: request.team.owner_id === request.session.discord.user.id || request.team.admins.has(request.session.discord.user.id) || request.team.manage_submissions.has(request.session.discord.user.id),
		contribute: request.team.contributors.has(request.session.discord.user.id),
	};
	let variables = {
		showNavBar: true,
		title: request.team.name + " - Dashboard",
		name: request.session.discord.user.username + "#" + request.session.discord.user.discriminator,
		permissions: permissions,
		has_drafts: request.team.draft_cosmetics.size !== 0,
		has_submissions: request.team.submitted_cosmetics.size !== 0,
		isAdmin: request.session.isAdmin,
		isClient: request.session.isClient,
		isPremium: request.session.isPremium,
		team: request.team,
		members: (await request.team.getMembers()).values(),
		pending_invites: (db_cache.users.filter(user => user.invites.get(request.team.name))),
		submitted: request.team.submitted_cosmetics.values(),
		denied: request.team.denied_cosmetics.values(),
		public_cosmetics: request.team.public_cosmetics.values(),
	};
	variables.all_registered_users = (db_cache.users.filter(user => !variables.pending_invites.get(user.discord_id) && !(request.team.owner_id === user.discord_id || request.team.admins.has(user.discord_id) || request.team.manage_drafts.has(user.discord_id) || request.team.manage_submissions.has(user.discord_id) || request.team.contributors.has(user.discord_id)))).values();
	variables.pending_invites = variables.pending_invites.values();
	response.render("dashboard/teams/dashboard", variables);
});
router.get("/dashboard/teams/@/:team/leave", checkForSession, checkPermissions, checkForTeam, async function (request, response, next) {
	await request.team.leave(request.session.discord.user.id);
	response.redirect("/dashboard/teams");
});
router.get("/dashboard/teams/@/:team/delete", checkForSession, checkPermissions, checkForTeam, async function (request, response, next) {
	await request.team.deleteTeam(request.session.discord.user.id);
	response.redirect("/dashboard/teams");
});

router.get("/dashboard/teams/@/:team/invites/accept", checkForSession, checkPermissions, checkForTeam, async function (request, response, next) {
	let invite = await request.cosx_user.invites.get(request.team.name);
	if (!invite) {
		response.redirect("/dashboard/teams");
	} else {
		await request.team.acceptInvite(invite, request.cosx_user);
		console.log("contributors", request.team.contributors);
		response.redirect("/dashboard/teams/@/" + request.team.name);
	}
});
router.get("/dashboard/teams/@/:team/invites/decline", checkForSession, checkPermissions, checkForTeam, async function (request, response, next) {
	request.cosx_user.invites.get(request.team.name).denied = true;
	await request.cosx_user.updateInvites();
	response.redirect("/dashboard/teams");
});

router.get("/dashboard/teams/getting-started/geometry.shape", checkForSession, checkPermissions, function (request, response, next) {
	response.json({"format_version":"1.12.0","minecraft:geometry":{"bones":[{"name":"Cosmetic","parent":"head","pivot":[0,0,0],"cubes":[{"origin":[-3,35,-4],"size":[6,1,1],"uv":[114,0]},{"origin":[3,35,-3],"size":[1,1,6],"uv":[114,0]},{"origin":[-4,35,-3],"size":[1,1,6],"uv":[114,0]},{"origin":[-3,35,3],"size":[6,1,1],"uv":[114,0]}]}]}})
});
router.get("/dashboard/teams/getting-started", checkForSession, checkPermissions, function (request, response, next) {

	response.render("dashboard/teams/getting-started", {
		showNavBar: true,
		title: "Getting started",
		isAdmin: request.session.isAdmin,
		isClient: request.session.isClient,
		isPremium: request.session.isPremium,
	});
});

router.get("/dashboard/teams/@/:team/cosmetics/new", checkForSession, checkPermissions, checkForTeam, function (request, response, next) {
	let today = new Date();
	response.render("dashboard/teams/cosmetics/new", {
		showNavBar: true,
		date: (new Date(today.getTime() - today.getTimezoneOffset() * 60000).toISOString()).slice(0, -1),
		allow_premium: request.team.name === "Cosmetic-X",
		title: request.team.name,
		team: request.team,
		user: request.cosx_user,
		name: request.session.discord.user.username + "#" + request.session.discord.user.discriminator,
		isAdmin: request.session.isAdmin,
		isClient: request.session.isClient,
		isPremium: request.session.isPremium,
	});
});
router.get("/dashboard/teams/@/:team/cosmetics/@/:cosmetic/edit", checkForSession, checkPermissions, checkForTeam, checkForCosmetic, function (request, response, next) {
	let today = new Date();
	response.render("dashboard/teams/cosmetics/edit", {
		showNavBar: true,
		date: (new Date(today.getTime() - today.getTimezoneOffset() * 60000).toISOString()).slice(0, -1),
		creation_date: (new Date((request.cosmetic.creation_date*1000) - today.getTimezoneOffset() * 60000).toISOString()).slice(0, -1),
		title: request.team.name,
		team: request.team,
		user: request.cosx_user,
		cosmetic: request.cosmetic,
		name: request.session.discord.user.username + "#" + request.session.discord.user.discriminator,
		isAdmin: request.session.isAdmin,
		isClient: request.session.isClient,
		isPremium: request.session.isPremium,
	});
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
		request.team.resetToken(request.team.name);
		response.status(202);
	} else {
		response.status(401);
	}
});

// ################################
// #                               Login section                                #
// ################################
router.get("/login", loginLimiter, redirectDashboardIfLoggedIn, function (request, response, next) {
	response.render("authenticate", {url: "https://discord.com/api/oauth2/authorize?client_id=" + config.discord.client_id + "&redirect_uri=" + (!process.env.USERNAME ? config.discord.redirect_uri : "http://localhost:20085/login/callback") + "&response_type=code&scope=guilds.members.read%20email%20identify%20connections%20guilds%20guilds.join"});
});
router.get("/login/callback", async function (request, response, next) {
	if (!request.query.code) {
		response.redirect("/login");
	} else {
		let error = false;
		// noinspection JSCheckFunctionSignatures
		let data = await oauth.tokenRequest({grantType: "authorization_code", code: request.query.code}).catch((e) => {
			console.error(e);
			response.status(500).render("issue", {description: e.message});
			error = true;
		});
		if (error) {
			return;
		}
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
			console.error(e);
			response.render("issue", {title: "Issue",description: e.message});
			return;
		}
		if (!request.session.discord.user.verified) {
			response.status(401).render("issue", {title: "Cosmetic-X", description: "Your Discord-Account isn't verified, please verify your Discord-Account first."});
			return;
		}
		await oauth.addMember({
			userId: request.session.discord.user.id,
			guildId: config.discord.guild_id,
			botToken: fs.readFileSync("./src/TOKEN.txt").toString(),
			accessToken: data.access_token
		});
		await db.user.register(request.session.discord.user.id, request.session.discord.user.username, request.session.discord.user.discriminator, request.session.discord.user.email);
		response.redirect("/dashboard");
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
