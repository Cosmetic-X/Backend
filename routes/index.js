/*
 * Copyright (c) 2021-2022. Jan Sohn.
 * All rights reserved.
 * I don't want anyone to use my source code without permission.
 */

'use strict';

/*
 * Copyright (c) 2021-2021. Jan Sohn.
 * All rights reserved.
 * I don't want anyone to use my source code without permission.
 */
const express = require('express');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const router = express.Router();
const db = require("../bin/db");
const rateLimit = require('express-rate-limit');

const loginLimiter = rateLimit({
	windowMs: 1000 * 60 * 5,
	max: 10,
	handler: function (req, res) {
		res.status(200).json({
			error: "You have been rate limited"
		});
	}
});
const registerLimiter = rateLimit({
	windowMs: 1000 * 60 * 60,
	max: 10,
	handler: function (req, res) {
		res.status(200).json({
			error: "You have been rate limited"
		});
	}
});
const resetTokenLimiter = rateLimit({
	windowMs: 1000 * 60,
	max: 5,
	handler: function (req, res) {
		res.status(202);
	}
});
const redirectDashboardLoggedIn = (request, response, next) => {
	if (request.session.user && request.cookies["session_id"]) {
		response.redirect('/dashboard');
	} else {
		next();
	}
};

router.use(cookieParser());
router.use(session({
	key: "session_id",
	secret: config.jwt_secret,
	resave: false,
	saveUninitialized: false,
	cookie: {
		expires: 1000 * 60 * 60 * 7 //7 days
	}
}));

router.use((request, response, next) => {
	if (request.cookies["session_id"] && !request.session.user) {
		response.clearCookie("session_id");
	}
	next();
});

router.get("/", redirectDashboardLoggedIn, function(request, response, next) {
  response.redirect("login");
});
/*
router.get("/discord", function (request, response, next) {
	response.redirect("https://discord.com/api/oauth2/authorize?client_id=" + config.client_id + "&redirect_uri=" + BASE_URL + "/auth" + "&response_type=code&scope=identify%20email%20guilds.join%20connections")
});
router.get("/auth", async function (request, response, next) {
	//TODO
	request.session.token = {}["access_token"] || "null";
});*/

router.get("/dashboard", function(request, response, next) {
	if (request.session.user === undefined) {
		response.redirect("/login");
		return;
	}
	if (!db.user.isApproved(request.session.user)) {
		response.status(401).render("wait-for-approve");
		return;
	}
	let data = db.user.getData(request.session.user);
	if (data.token === "" || data.token === undefined) {
		db.user.resetToken(request.session.user);
	}
    response.render("dashboard", {
	    username: request.session.user,
	    displayname: data.displayname,
	    token: data.token || "n/a",
	    isAdmin: data.admin,
	    isApproved: data.approved,
	    created: data.timestamp,
    });
});

router.get("/login", function(request, response, next) {
	response.render("login", {action: "login", method: "Login",otherMethod: {file:"register", text:"Register"}});
});
router.post("/login", loginLimiter, function(request, response, next) {
	let username = request.body.username;
	let password = request.body.password;

	if (!db.user.exists(username) || !db.user.checkPassword(username, password)) {
		response.status(401).json({status:401,error: 'User / Password doesn\'t match'});
	} else {
		request.session.user = username.toLowerCase();
		response.status(202).redirect("/dashboard");
	}
});

router.get("/register", function (request, response, next) {
	response.render("login", {action: "register", method: "Register",otherMethod: {file:"login", text:"Login"}});
});
router.post("/register", registerLimiter,  async function (request, response, next) {
	let body = request.body;
	if (!body.username || !body.password) {
		response.status(400).json({status:400, error: 'Bad request body'});
	} else if (db.user.exists(body.username)) {
		response.status(400).json({status:400, error: 'Already taken'});
	} else {
		request.session.user = body.username.toLowerCase();
		await db.user.register(body.username, body.password);
		response.status(202).redirect("/dashboard");
	}
});

router.get("/logout", function (request, response, next) {
	if (request.session.user && request.cookies["session_id"]) {
		response.clearCookie("session_id");
		response.redirect("/");
	} else {
		response.redirect("/login");
	}
});

router.post("/resetToken", resetTokenLimiter, function (request, response, next) {
	if (request.session.user && request.cookies["session_id"] && db.user.isApproved(request.session.user)) {
		db.user.resetToken(request.session.user);
		response.status(202);
	} else {
		response.status(401).json({status:401,error: 'No valid session.'});
	}
})

module.exports = router;
