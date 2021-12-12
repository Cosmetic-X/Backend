/*
 * Copyright (c) 2021-2021. Jan Sohn.
 * All rights reserved.
 * I don't want anyone to use my source code without permission.
 */

const express = require('express');
const db = require("../db");
const router = express.Router();

router.use(async (request, response, next) => {
	if (request.method === "POST") {
		if (!request.is("application/json")) {
			response.status(400).json({status:400,error:"Content-Type must be 'application/json'"});
			return;
		}
		let token = request.header("Token");
		if (token === undefined) {
			response.status(400).json({status:400,error:"No token provided"});
			return;
		}
		if (!await db.api.checkToken(request.header("Token"), response)) {
			response.status(401).json({status:401,error:"No valid token provided"});
			return;
		}
	}
	if (request.method === "POST") {
		console.log("GOT POST REQUEST");
	}
	next();
})

/* GET home page. */
router.get('/', function(req, res, next) {
	res.status(200).json({
		"backend-version": process.env.VERSION,
		"min-client-version": "0.1"
	});
});

router.post("/available-cosmetics", async function (request, response) {
	let username = db.api.getUserByToken(request.header("Token"), response);
	response.json({
		public: db.api.getPublicCosmetics(),
		slot: db.api.getSlotCosmetics(username),
	})
});

module.exports = router;
