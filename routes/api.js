/*
 * Copyright (c) 2021-2022. Jan Sohn.
 * All rights reserved.
 * I don't want anyone to use my source code without permission.
 */

const express = require('express');
const db = require("../bin/db");
const {encodeSkinData, decodeSkinData} = require("../bin/imagetools");
const {Image} = require("image-js");
const router = express.Router();

router.use(async (request, response, next) => {
	if (request.header("Token") === undefined) {
		response.status(400).json({error:"No token provided"});
		return;
	}
	if (!await db.user.checkToken(request.header("Token"), response)) {
		response.status(401).json({error:"No valid token provided"});
		return;
	}
	next();
})

router.get('/', function(request, response, next) {
	response.status(200).json({
		"holder": db.user.getByToken(request.header("Token"), response).display_name ?? null,
		"backend-version": process.env.VERSION,
		"lastest-client-version": process.env.CLIENT_VERSION,
	});
});

router.post("/available-cosmetics", async function (request, response) {
	response.status(200).json({
		public: db.api.getPublicCosmetics(),
		slot: db.api.getSlotCosmetics(db.user.getByToken(request.header("Token"), response).username),
	})
});

router.post("/merge-skin-with-cosmetic", async function (request, response) {
	if (!request.body["id"]) {
		response.status(400).json({error:"id is not provided"});
		return;
	}
	if (!request.body["skinData"]) {
		response.status(400).json({error:"skinData is not provided"});
		return;
	}
	let id = request.body["id"];
	let baseImage = await decodeSkinData(request.body["skinData"]);
	let image = db.api.getCosmetic(id);
	if (!image[0]) {
		response.status(400).json({error:"Cosmetic not found"});
		return;
	}
	image = await decodeSkinData(image[0]["skinData"]);
	let newImage = new Image(image.width, image.height);

	for (let x = 0; x < newImage.width; x++) {
		for (let y = 0; y < newImage.height; y++) {
			newImage.setPixelXY(x, y, baseImage.getPixelXY(x, y));
			newImage.setPixelXY(x, y, image.getPixelXY(x, y));
		}
	}
	response.status(200).json({
		buffer: await encodeSkinData(newImage),
		geometry_name: null,
		geometry_data: null,
	})
});

module.exports = router;
