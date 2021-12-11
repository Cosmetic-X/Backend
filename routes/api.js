/*
 * Copyright (c) 2021-2021. Jan Sohn.
 * All rights reserved.
 * I don't want anyone to use my source code without permission.
 */

const express = require('express');
const db = require("../db");
const router = express.Router();

/* GET home page. */
router.get('/', function(req, res, next) {
	res.json({
		version: "1.0"
	});
});
router.get("/login", function (request, response, next) {
	console.log(request);
})
router.post("/test", async function (request, response) {
	await db.checkToken(request.header("Token"), response);
	response.json({
		body: request.body,
		params: request.params,
		query: request.query,
	})
})

module.exports = router;
