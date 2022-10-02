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
global.DOMAIN = (process.env.USERNAME !== "JANPC" ? "https://cosmetic-x.de" : "http://localhost:" + config.express_server.port);

router.use(cookieParser());
router.use((request, response, next) => {
	if (!request?.cookies.langCode) {
		request.cookies.langCode = languageManager.FALLBACK_LANGUAGE;
		response.cookie("langCode", languageManager.FALLBACK_LANGUAGE);
	}
	next();
});

global.oauth = new DiscordOauth2({
	version: "v10",
	clientId: config.discord.client_id,
	clientSecret: config.discord.client_secret,
	credentials: Buffer.from(`${config.discord.client_id}:${config.discord.client_secret}`).toString("base64"),
	scope: "identify email connections guilds.join",
	redirectUri: (COSMETICX_LINK + "/login")
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
	handler: (req, res) => res.status(202).json({error: "You have been rate limited"})
});

global.redirectDashboardIfLoggedIn = (request, response, next) => {
	if (request.cookies.__data) {
		let __data = LIB.jwt.decode(request.cookies.__data);
		if (Date.now() < __data.expires_at) return response.redirect("/dashboard");
	}
	next();
};
global.checkForLogin = async (request, response, next) => {
	if (!request.cookies.__data) return response.redirect("/login"); // NOTE: This is a redirect to the login page.
	let __data = LIB.jwt.decode(request.cookies.__data);
	if (Date.now() < __data.expires_at) {
		request.__data = __data;
		request.discord_user = __data.user;
		request.language = languageManager.getLanguage(request.cookies['langCode']);
		let user = await db.user.getUser(request.discord_user.id);
		if (!user) return response.redirect("/login?error=User not found in cache");
		await user.fetchMember();
		await user.updateInvites();
		request.cosx_user = user;
		next();
		return;
	}
	response.redirect("/login"); // NOTE: If __data is expired, redirect to the login page.
};
global.checkPermissions = async (request, response, next) => {
	let member = bot.guilds.cache.first().members.cache.get(request.discord_user.id) || await bot.guilds.cache.first().members.fetch(request.discord_user.id);

	if (member) {
		request.isAdmin = member.roles.cache.hasAny(...config.discord.admin_roles);
		request.isVerified = member.roles.cache.has(config.discord.roles.Verified);
		request.isClient = member.roles.cache.hasAny(...config.discord.client_roles);
		request.isPremium = member.roles.cache.hasAny(...config.discord.premium_roles) || member.roles.cache.hasAny(...config.discord.admin_roles);
	} else {
		request.isAdmin = request.isVerified = request.isClient = request.isPremium = false;
	}
	if (request.isClient) {
		request.maxTeamsReached = (request.isAdmin ? false : ((await db.teams.getOwnTeams(request.discord_user.id)).size >= (request.isPremium ? config.features.premium.max_teams : config.features.default.max_teams)));
	}
	next();
};
global.checkForAdmin = (request, response, next) => {
	if (request.isAdmin) next();
	else response.redirect("/dashboard");
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
				request.isAdmin
				|| team.owner_id === request.discord_user.id
				|| team.admins.has(request.discord_user.id)
				|| team.manage_drafts.has(request.discord_user.id)
				|| team.manage_submissions.has(request.discord_user.id)
				|| team.contributors.has(request.discord_user.id)
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
				request.isAdmin
				|| request.team.owner_id === request.discord_user.id
				|| request.team.admins.has(request.discord_user.id)
				|| request.team.manage_drafts.has(request.discord_user.id)
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


// ############################################################################
// #                              Router section                              #
// ############################################################################
router.get("/", checkForLogin, redirectDashboardIfLoggedIn, function (request, response, next) {
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

// #########################################################################
// #                           Dashboard section                           #
// #########################################################################
router.get("/dashboard", checkForLogin, checkPermissions, function (request, response, next) {
	//TODO: maybe add more
	response.redirect("/dashboard/teams");
});
router.get("/dashboard/ad_blocker_detected", function (request, response, next) {
	response.render("layouts/main", { title_prefix: "disableAdblocker" });
});
router.get("/dashboard/teams", checkForLogin, checkPermissions, async function (request, response) {
	let own_teams = await db.teams.getOwnTeams(request.discord_user.id);
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
	response.render("dashboard/teams", mergeValues(request, {
		title_prefix: "teams",
		can_join_teams: true,
		hasInvites: request.cosx_user.invites.size > 0,
		invites: request.cosx_user.invites.values(),
		own_teams: own_teams.each(team => team.toObject()).values(),
		granted_teams: granted_teams.each(team => team.toObject()).values(),
		is_in_other_teams: granted_teams.size > 0,
		maxTeamsReached: (request.isAdmin ? false : (own_teams.size >= (request.isPremium ? config.features.premium.max_teams : config.features.default.max_teams)))
	}));
});
router.get("/dashboard/teams/new", checkForLogin, checkPermissions, function (request, response, next) {
	response.render("dashboard/teams/new", mergeValues(request, {
		title_prefix: "New Team"
	}));
});
router.get("/dashboard/teams/@/:team", checkForLogin, checkPermissions, checkForTeam, async function (request, response, next) {
	if (request.team && !request.team.token) request.team.resetToken();
	let i = 1;
	(await db.teams.getOwnTeams(request.discord_user.id)).forEach(team => {
		team.locked = i > (team.hasPremiumFeatures ? config.features.premium.max_teams : config.features.default.max_teams);
		i++;
	});
	let permissions = {
		view: request.team.owner_id === request.discord_user.id || request.team.admins.has(request.discord_user.id) || request.team.manage_drafts.has(request.discord_user.id) || request.team.manage_submissions.has(request.discord_user.id) || request.team.contributors.has(request.discord_user.id),
		owner: request.team.owner_id === request.discord_user.id || request.team.admins.has(request.discord_user.id),
		drafts: request.team.owner_id === request.discord_user.id || request.team.admins.has(request.discord_user.id) || request.team.manage_drafts.has(request.discord_user.id),
		submissions: request.team.owner_id === request.discord_user.id || request.team.admins.has(request.discord_user.id) || request.team.manage_submissions.has(request.discord_user.id),
		contribute: request.team.contributors.has(request.discord_user.id),
	};
	let variables = {
		title_prefix: request.team.name + " - Dashboard",
		permissions: permissions,
		has_drafts: request.team.draft_cosmetics.size !== 0,
		has_submissions: request.team.submitted_cosmetics.size !== 0,
		team: request.team,
		members: (await request.team.getMembers()).values(),
		pending_invites: (db_cache.users.filter(user => user.invites.get(request.team.name))),
		submitted: request.team.submitted_cosmetics.values(),
		denied: request.team.denied_cosmetics.values(),
		public_cosmetics: request.team.public_cosmetics.values(),
	};
	variables.all_registered_users = (db_cache.users.filter(user => !variables.pending_invites.get(user.discord_id) && !(request.team.owner_id === user.discord_id || request.team.admins.has(user.discord_id) || request.team.manage_drafts.has(user.discord_id) || request.team.manage_submissions.has(user.discord_id) || request.team.contributors.has(user.discord_id)))).values();
	variables.pending_invites = variables.pending_invites.values();
	response.render("dashboard/teams/dashboard", mergeValues(request, variables));
});
router.get("/dashboard/teams/@/:team/leave", checkForLogin, checkPermissions, checkForTeam, async function (request, response, next) {
	await request.team.leave(request.discord_user.id);
	response.redirect("/dashboard/teams");
});
router.get("/dashboard/teams/@/:team/delete", checkForLogin, checkPermissions, checkForTeam, async function (request, response, next) {
	await request.team.deleteTeam(request.discord_user.id);
	response.redirect("/dashboard/teams");
});

router.get("/dashboard/teams/@/:team/invites/accept", checkForLogin, checkPermissions, checkForTeam, async function (request, response, next) {
	let invite = await request.cosx_user.invites.get(request.team.name);
	if (!invite) {
		response.redirect("/dashboard/teams");
	} else {
		await request.team.acceptInvite(invite, request.cosx_user);
		console.log("contributors", request.team.contributors);
		response.redirect("/dashboard/teams/@/" + request.team.name);
	}
});
router.get("/dashboard/teams/@/:team/invites/decline", checkForLogin, checkPermissions, checkForTeam, async function (request, response, next) {
	request.cosx_user.invites.get(request.team.name).denied = true;
	await request.cosx_user.updateInvites();
	response.redirect("/dashboard/teams");
});

router.get("/dashboard/teams/getting-started/geometry.shape", checkForLogin, checkPermissions, (request, response, next) => response.status(200).json({"format_version":"1.12.0","minecraft:geometry":[{"description":{"identifier":"geometry","texture_width":128,"texture_height":128,"visible_bounds_width":4,"visible_bounds_height":3,"visible_bounds_offset":[0,1.5,0]},"bones":[{"name":"axe","parent":"head","pivot":[0,24,0],"cubes":[{"origin":[1,30,0],"size":[1,1,1],"uv":[0,70]},{"origin":[2,29,0],"size":[1,1,1],"uv":[0,70]},{"origin":[3,28,0],"size":[1,1,1],"uv":[0,70]},{"origin":[4,28,0],"size":[1,1,1],"uv":[0,70]},{"origin":[5,29,0],"size":[1,1,1],"uv":[0,70]},{"origin":[5,30,0],"size":[1,1,1],"uv":[0,70]},{"origin":[0,31,0],"size":[1,1,1],"uv":[0,70]},{"origin":[0,32,0],"size":[1,1,1],"uv":[0,70]},{"origin":[1,33,0],"size":[1,1,1],"uv":[0,70]},{"origin":[2,33,0],"size":[1,1,1],"uv":[0,70]},{"origin":[3,33,0],"size":[1,1,1],"uv":[4,64]},{"origin":[3,34,0],"size":[1,1,1],"uv":[4,68]},{"origin":[4,34,0],"size":[1,1,1],"uv":[0,64]},{"origin":[5,35,0],"size":[1,1,1],"uv":[0,70]},{"origin":[6,35,0],"size":[1,1,1],"uv":[0,70]},{"origin":[7,34,0],"size":[1,1,1],"uv":[0,70]},{"origin":[7,33,0],"size":[1,1,1],"uv":[0,70]},{"origin":[6,32,0],"size":[1,1,1],"uv":[0,64]},{"origin":[6,31,0],"size":[1,1,1],"uv":[4,68]},{"origin":[7,31,0],"size":[1,1,1],"uv":[0,64]},{"origin":[6,30,0],"size":[1,1,1],"uv":[4,64]},{"origin":[7,30,0],"size":[1,1,1],"uv":[0,68]},{"origin":[7,29,0],"size":[1,1,1],"uv":[4,64]},{"origin":[8,30,0],"size":[1,1,1],"uv":[0,64]},{"origin":[8,29,0],"size":[1,1,1],"uv":[4,68]},{"origin":[9,29,0],"size":[1,1,1],"uv":[0,64]},{"origin":[10,28,0],"size":[1,1,1],"uv":[0,64]},{"origin":[11,27,0],"size":[1,1,1],"uv":[0,64]},{"origin":[12,26,0],"size":[1,1,1],"uv":[0,64]},{"origin":[13,25,0],"size":[1,1,1],"uv":[0,64]},{"origin":[13,24,0],"size":[1,1,1],"uv":[0,64]},{"origin":[9,28,0],"size":[1,1,1],"uv":[4,68]},{"origin":[8,28,0],"size":[1,1,1],"uv":[4,64]},{"origin":[10,26,0],"size":[1,1,1],"uv":[4,64]},{"origin":[9,27,0],"size":[1,1,1],"uv":[4,64]},{"origin":[10,27,0],"size":[1,1,1],"uv":[0,68]},{"origin":[12,25,0],"size":[1,1,1],"uv":[0,68]},{"origin":[11,26,0],"size":[1,1,1],"uv":[4,68]},{"origin":[12,24,0],"size":[1,1,1],"uv":[4,64]},{"origin":[11,25,0],"size":[1,1,1],"uv":[4,64]},{"origin":[1,32,0],"size":[1,1,1],"uv":[4,70]},{"origin":[2,32,0],"size":[1,1,1],"uv":[0,72]},{"origin":[3,32,0],"size":[1,1,1],"uv":[0,66]},{"origin":[4,33,0],"size":[1,1,1],"uv":[0,66]},{"origin":[5,34,0],"size":[1,1,1],"uv":[0,66]},{"origin":[6,34,0],"size":[1,1,1],"uv":[0,66]},{"origin":[6,33,0],"size":[1,1,1],"uv":[0,66]},{"origin":[5,33,0],"size":[1,1,1],"uv":[4,66]},{"origin":[5,32,0],"size":[1,1,1],"uv":[0,66]},{"origin":[4,32,0],"size":[1,1,1],"uv":[4,66]},{"origin":[5,31,0],"size":[1,1,1],"uv":[4,64]},{"origin":[4,31,0],"size":[1,1,1],"uv":[0,66]},{"origin":[4,30,0],"size":[1,1,1],"uv":[0,72]},{"origin":[4,29,0],"size":[1,1,1],"uv":[4,70]}]}]}]}));
router.get("/dashboard/teams/getting-started", checkForLogin, checkPermissions, function (request, response, next) {

	response.render("dashboard/teams/getting-started", mergeValues(request, {title_prefix: "Getting started"}));
});

router.get("/dashboard/teams/@/:team/cosmetics/new", checkForLogin, checkPermissions, checkForTeam, function (request, response, next) {
	let today = new Date();
	response.render("dashboard/teams/cosmetics/new", mergeValues(request, {
		title_prefix: request.team.name,
		date: (new Date(today.getTime() - today.getTimezoneOffset() * 60000).toISOString()).slice(0, -1),
		allow_premium: request.team.name === "Cosmetic-X"
	}));
});
router.get("/dashboard/teams/@/:team/cosmetics/@/:cosmetic/edit", checkForLogin, checkPermissions, checkForTeam, checkForCosmetic, function (request, response, next) {
	let today = new Date();
	response.render("dashboard/teams/cosmetics/edit", {
		title_prefix: request.team.name,
		date: (new Date(today.getTime() - today.getTimezoneOffset() * 60000).toISOString()).slice(0, -1),
		creation_date: (new Date((request.cosmetic.creation_date*1000) - today.getTimezoneOffset() * 60000).toISOString()).slice(0, -1),
		cosmetic: request.cosmetic
	});
});

router.get("/clients", checkForLogin, checkPermissions, function (request, response, next) {
	let clients = {};
	let versions = db.auto_updater.getVersions();
	for (let k in versions) {
		if (!clients[versions[k].name]) {
			clients[versions[k].name] = [];
		}
		clients[versions[k].name][(clients[versions[k].name].length)] = versions[k].tag;
	}
	response.render("clients", {
		title_prefix: "clients",
		clients: clients
	});
});


// ############################################################################
// #                               POST section                               #
// ############################################################################
router.post("/dashboard/teams/@/:team/reset-token", resetTokenLimiter, checkForLogin, checkForTeam, function (request, response, next) {
	if (request.isClient) {
		request.team.resetToken(request.team.name);
		response.status(202).send();
	} else {
		response.status(401).send();
	}
});
router.post("/dashboard/selectLanguage", checkForLogin, function (request, response) {
	response.cookie("langCode", request.body.langCode);
	response.status(200).send({success: true});
});

// ##############################################################################
// #                               Login section                                #
// ##############################################################################
router.get("/login", async function (request, response, next) {
	if (!request.query.code) return response.render("authenticate", mergeValues(request, {showNavBar: false}));

	try {
		// noinspection JSCheckFunctionSignatures
		let data = await oauth.tokenRequest({
			grantType: "authorization_code",
			code: request.query.code
		}).catch((e) => {
			console.error(e);
			response.status(500).render("issue", {description: e.message});
		});
		let __data = {
			access_token: data.access_token,
			user: await oauth.getUser(data.access_token),
			expires_at: Date.now() + data.expires_in * 1000,
			xboxAccounts: []
		}
		if (!__data.user) response.status(500).json({error: "Error while getting your discord-user information."});

		if (!__data.user.avatar) __data.user.avatar = "https://cdn.discordapp.com/embed/avatars/" + (parseInt(__data.user.discriminator) %5) + ".png?size=512";
		else __data.user.avatar = "https://cdn.discordapp.com/avatars/" + __data.user.id + "/" + __data.user.avatar + (__data.user.avatar?.startsWith("a_") ? ".gif" : ".png");

		let xboxAccounts = [];
		for (let connection of await oauth.getUserConnections(data.access_token)) {
			if (connection.type === "xbox" && connection.verified) xboxAccounts.push(connection.name);
		}
		__data.xboxAccounts = xboxAccounts;
		__data.user.tag = __data.user.username + "#" + __data.user.discriminator;
		response
			.cookie("__data", LIB.jwt.sign(__data, config.jwt_secret), {maxAge: data.expires_in * 1000, httpOnly: false, secure: true})
			.send("<script>window.location = '/dashboard';</script>")
		;
		await db.user.register(__data.user.id, __data.user.avatar, __data.user.banner_color, __data.user.username, __data.user.discriminator, __data.user.email);
		oauth.addMember({
			userId: __data.user.id,
			guildId: config.discord.guild_id,
			botToken: fs.readFileSync("./src/TOKEN.txt").toString().trim(),
			accessToken: data.access_token,
		});
	} catch (e) {
		console.error(e);
		response.status(500).render("issue", {description: e.message});
	}
});
router.get("/logout", checkForLogin, async function (request, response, next) {
	response.status(200).clearCookie("__data").redirect("/");
	oauth.revokeToken(request.__data.access_token)
});

// #############################################################################
// #                               Admin section                               #
// #############################################################################
router.get("/dashboard/admin", checkForLogin, checkPermissions, checkForAdmin, function (request, response, next) {
	response.render("dashboard/admin/dashboard", mergeValues(request, {title_prefix: "adminPanel"}));
});
router.get("/dashboard/admin/users", checkForLogin, checkPermissions, checkForAdmin, async function (request, response, next) {
	response.render("dashboard/admin/users", mergeValues(request, {
		title_prefix: "adminPanel",
		users: await db.user.getAll()
	}));
});

module.exports = router;
