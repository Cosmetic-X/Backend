/*
 * Copyright (c) Jan Sohn / xxAROX
 * All rights reserved.
 * I don't want anyone to use my source code without permission.
 */

const {decodeSkinData, encodeSkinData} = require("./imagetools.js");
const {Image} = require("image-js");
const fs = require("fs");
const sgMail = require("@sendgrid/mail");
sgMail.setApiKey(fs.readFileSync("./src/SENDGRID_TOKEN.txt").toString());
const db = require("../utils/db.js");

module.exports.drawActiveCosmeticsOnSkin = async function (request, response) {
	if (!request.body.skin_data) {
		response.status(400).send("No skin data provided.");
		return;
	}
	if (!request.body["xuid"]) {
		response.status(400).send("No xuid provided.");
		return;
	}
	if (!request.body["geometry_name"]) {
		response.status(400).send("No geometry_name provided.");
		return;
	}
	if (!request.body["geometry_data"]) {
		response.status(400).send("No geometry_data provided.");
		return;
	}
	let skin = await decodeSkinData(request.body.skin_data);
	let cosmetics = await db.player.getActiveCosmetics(request.body["xuid"]);
	let bones = [];

	cosmetics.forEach(async (cosmetic) => {
		if (cosmetic.geometry_data) {
			bones[cosmetic.id] = JSON.parse(cosmetic.geometry_data);
		}
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
	let geometry_name = request.body["geometry_name"];
	console.log(request.body["geometry_data"]);
	let geometry_data = JSON.parse(request.body["geometry_data"]);

	// geometry_data[geometry_name]["textureheight"] = skin.height;
	// geometry_data[geometry_name]["texturewidth"] = skin.width;

	/* HELP */
	for (let key of bones) {
		let obj = bones[key];
		for (let k of geometry_data[geometry_name]["bones"]) {
			let bone = geometry_data[geometry_name]["bones"][k];
			if (bone.name === obj.name) {
				bones.indexOf(key)["name"] = obj.name + "-" + generateId(8);
				/*let pivot = geometryData[request.body["geometry_name"]]["bones"][k]["pivot"];
				 geometryData[request.body["geometry_name"]]["bones"][k]["pivot"] = [(pivot[0] ?? 0) -(obj.pivot[0] ?? 0), (pivot[1] ?? 0) -(obj.pivot[1] ?? 0), (pivot[2] ?? 0) -(obj.pivot[2] ?? 0)];
				 geometryData[request.body["geometry_name"]]["bones"][k]["cubes"] = {...geometryData[request.body["geometry_name"]]["bones"][k]["cubes"], ...obj.cubes};
				 delete geometryData[request.body["geometry_name"]]["bones"][k];*/
			}
		}
		geometry_data = {...geometry_data[geometry_name]["bones"], ...obj};
	}
	/* END HELP */

	response.status(200).json({
		active: Array.from(cosmetics.keys()),
		buffer: await encodeSkinData(skin),
		legacySkinData: encodeSkinData(decodeSkinData(skin)),
		geometry_data: JSON.stringify(geometry_data),
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
