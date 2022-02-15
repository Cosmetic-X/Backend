/*
 * Copyright (c) 2021-2022. Jan Sohn.
 * All rights reserved.
 * I don't want anyone to use my source code without permission.
 */
const DiscordOauth2 = require("discord-oauth2");
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const session = require('express-session');
const {in_array} = require("../bin/utils");
const express = require('express');
const router = express.Router();
const db = require("../bin/db");
const fs = require("fs");

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

const redirectDashboardIfLoggedIn = (request, response, next) => {
	if (request.session.discord && request.cookies[ "session_id" ]) {
		response.redirect("/dashboard");
	} else {
		next();
	}
};
const checkForSession = (request, response, next) => {
	console.log(request.session.discord === undefined ? "Session not found" : "Session found its " + request.session.discord.user.username + "#" + request.session.discord.user.discriminator);
	if (request.session.discord === undefined) {
		response.redirect("/login");
	} else {
		next();
	}
};
const checkForApprove = async (request, response, next) => {
	bot.guilds.cache.first().members.fetch(request.session.discord.user.id)
	.then(member => {
		if (!member) {
			response.status(500).render("/issues/discord-issue", {title: "Cosmetic-X", description: "Error with your session, please re-login."});
		} else {
			if (in_array(config.discord.approved_role, member.roles) || request.session.isAdmin) {
				console.log("DOING NEXT");
				next();
			} else {
				response.status(401).render("/issues/wait-for-approve", {title: "Cosmetic-X"});
			}
		}
	});
};

router.get("/", checkForSession, checkForApprove, redirectDashboardIfLoggedIn, function (request, response, next) {
	response.status(200).send("Something went wrong");
});

router.get("/ping", function (request, response, next) {
	response.status(200).send("PONG!");
});

router.get("/dashboard", checkForSession, checkForApprove, function (request, response, next) {
	let data = db.user.getData(request.session.discord.user.id);
	if (!data.token) {
		db.user.resetToken(request.session.user);
	}
	response.render("dashboard", {
		showNavBar: true,
		title: "Dashboard",
		name: request.session.discord.user.username + "#" + request.session.discord.user.discriminator,
		token: data.token || "n/a",
		isAdmin: request.session.isAdmin,
	});
});
router.get("/clients", function (request, response, next) {
	response.render("clients", {
		showNavBar: true,
		title: "Clients",
		clients: config.clients,
	});
});

router.get("/login", loginLimiter, function (request, response, next) {
	response.render("authenticate-to-discord", {url: "https://discord.com/api/oauth2/authorize?client_id=" + config.discord.client_id + "&redirect_uri=" + config.discord.redirect_uri + "&response_type=code&scope=guilds.members.read%20email%20identify%20connections%20guilds%20guilds.join"});
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
				member: await oauth.getGuildMember(data.access_token, config.discord.guild_id),
				connections: await oauth.getUserConnections(data.access_token),
				access_token: data.access_token,
				token_expires_in: data.expires_in,
				refresh_token: data.refresh_token,
				token_type: data.token_type,
			};
		} catch (e) {
			response.status(500).render("issues/discord-issue", {description: e.message});
			return;
		}
		let isAdmin = false;
		config.discord["admin-roles"].forEach(role_id => {
			if (!isAdmin) {
				isAdmin = in_array(role_id, request.session.discord.member.roles);
			}
		});
		request.session.isAdmin = isAdmin;

		let isClient = false;
		config.discord["client-roles"].forEach(role_id => {
			if (!isClient) {
				isClient = in_array(role_id, request.session.discord.member.roles);
			}
		});
		request.session.isClient = isClient || isAdmin;
		request.session.isPremium = /*isClient ||*/ isAdmin || in_array(config.discord.premium_role, request.session.discord.member.roles);

		await oauth.addMember({
			accessToken: data.access_token,
			botToken: fs.readFileSync("./TOKEN.txt").toString(),
			guildId: config.discord.guild_id,
			userId: request.session.discord.user.id,
		});
		if (!request.session.discord.user.verified) {
			response.status(401).render("/issues/discord-issue", {title: "Cosmetic-X", description: "Your Discord-Account is not verified, please verify your Email first."});
			return;
		}
		await db.user.register(request.session.discord.user.id, request.session.discord.user.username, request.session.discord.user.discriminator, request.session.discord.user.email);
		response.status(200).redirect("/dashboard");
	}
});

router.get("/logout", async function (request, response, next) {
	if (request.session.user && request.cookies[ "session_id" ]) {
		request.session.destroy();
		response.clearCookie("session_id");
		await oauth.revokeToken(request.session.discord.access_token);
		response.redirect("/");
	} else {
		response.redirect("/login");
	}
});

router.post("/resetToken", resetTokenLimiter, checkForSession, function (request, response, next) {
	if (request.session.isClient) {
		db.user.resetToken(request.session.user);
		response.status(202);
	} else {
		response.status(401);
	}
});

module.exports = router;
