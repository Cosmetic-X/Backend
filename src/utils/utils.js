/*
 * Copyright (c) Jan Sohn / xxAROX
 * All rights reserved.
 * I don't want anyone to use my source code without permission.
 */

const {decodeSkinData, encodeSkinData} = require("./imagetools.js");
const {Image} = require("image-js");
const fs = require("fs");
const FACTOR = 128;
const sgMail = require("@sendgrid/mail");
sgMail.setApiKey(fs.readFileSync("./src/SENDGRID_TOKEN.txt").toString());
const db = require("../utils/db.js");

module.exports.applyActiveCosmeticsOnSkin = async function (request, response) {
	if (!request.body["xuid"]) {
		response.status(400).send("No xuid provided.");
		return;
	}
	let xuid = request.body["xuid"];

	if (!request.body['skin_data']) {
		response.status(400).send("No skin data provided.");
		return;
	}
	let skinData = request.body['skin_data'];

	if (!request.body["geometry_name"]) {
		response.status(400).send("No geometry_name provided.");
		return;
	}
	let geometryName = request.body["geometry_name"];

	if (!request.body["geometry_data"]) {
		response.status(400).send("No geometry_data provided.");
		return;
	}
	let geometryData = JSON.parse(request.body["geometry_data"]);
	if (!geometryData["minecraft:geometry"]) {
		response.status(400).send("Wrong geometry data provided, see documentation here " + COSMETICX_LINK + "/dashboard/teams/getting-started/geometry.shape");
		return;
	}

	let rbg_filter = !request.body["rbg_filter"] ? undefined : request.body["rbg_filter"];

	let skin = await decodeSkinData(skinData);
	if (skin.height !== 128 || skin.width !== 128) {
		response.status(400).send("Skin is not 128x128.");
		return;
	}
	let cosmetics = await db.player.getActiveCosmetics(request.body["xuid"]);
	let playerGeometry = undefined;
	for (const playerGeometryName in geometryData["minecraft:geometry"]) {
		let data = geometryData["minecraft:geometry"][playerGeometryName];
		if (data['description']['identifier'] === geometryName) {
			playerGeometry = data;
		}
	}
	if (!playerGeometry) {
		response.status(400).send("No geometry found with name " + request.body["geometry_name"]);
		return;
	}
	playerGeometry["description"]["texture_height"] = playerGeometry["description"]["texture_width"] = FACTOR;
	let cosmeticsGeometryData = {format_version: "1.12.0","minecraft:geometry": [{...playerGeometry}]};

	cosmetics.forEach(async (cosmetic) => {
		if (cosmetic.geometry_data) {
			let parsedCosmeticGeoData = JSON.parse(cosmetic.geometry_data);
			if (!parsedCosmeticGeoData["minecraft:geometry"][0]) return; // NOTE: if no geometryData found with name 'selectedCosmeticGeometryName' then ignore this cosmetic.
			cosmeticsGeometryData["minecraft:geometry"][0]['bones'].push(parsedCosmeticGeoData["minecraft:geometry"][0]['bones']);
		}
		geometryData["minecraft:geometry"][geometryName]["bones"].push(playerGeometry); // NOTE: unless (i think) the geometryData is not used, this is not needed.

		if (cosmetic.skin_data) {
			let cosmetic_image = await decodeSkinData(cosmetic.skin_data);
			for (let x = 0; x < skin.width; x++) {
				for (let y = 0; y < skin.height; y++) {
					if (cosmetic_image.getPixelXY(x, y)[3] !== 0) {
						skin.setPixelXY(x, y, cosmetic_image.getPixelXY(x, y));
					}
				}
			}
		}
	});


	response.status(200).json({
		active: Array.from(cosmetics.keys()),
		buffer: await encodeSkinData(skin),
		legacySkinData: encodeSkinData(decodeSkinData(skin)),
		geometryData: JSON.stringify(cosmeticsGeometryData),
		geometryName: geometryName,
	});
}
module.exports.in_array = function (needle, haystack) {
	let length = haystack.length;
	for(let i = 0; i < length; i++) {
		if (haystack[i] === needle) {
			return true;
		}
	}
	return false;
}
module.exports.sendEmail = function (to, provider, subject, text, htmlText) {
	return sgMail.send({
		to: to,
		from: provider + "@cosmetic-x.de",
		subject: subject,
		text: text,
		html: (!htmlText ? text : htmlText),
	});
}
