/*
 * Copyright (c) 2021-2022. Jan Sohn.
 * All rights reserved.
 * I don't want anyone to use my source code without permission.
 */

const {decodeSkinData, encodeSkinData} = require("../bin/imagetools");
const {Image} = require("image-js");
const db = require("../bin/db");

module.exports.drawActiveCosmeticsOnSkin = async function (request, response) {
	let skin = await decodeSkinData(request.body["skinData"]);
	let newImage = new Image({height:128,width:128});
	for (let x = 0; x < newImage.width; x++) {
		for (let y = 0; y < newImage.height; y++) {
			if (x < 64 && y < 64) {
				newImage.setPixelXY(x, y, skin.getPixelXY(x, y));
			} else {
				newImage.setPixelXY(x, y, [0,0,0,0]);
			}
		}
	}
	let CosmeticObj = await db.user.getActiveCosmetics(request.body["xuid"]);
	let bones = [];

	for (let i = 0; i < CosmeticObj.length; i++) {
		if (CosmeticObj[i]["geometryData"] && CosmeticObj[i]["geometryName"]) {
			bones[CosmeticObj[i]["id"]] = JSON.parse(CosmeticObj[i]["geometryData"])[CosmeticObj[i]["geometryName"]]["bones"];
		}
		if (CosmeticObj[i]["skinData"]) {
			let image = await decodeSkinData(CosmeticObj[i]["skinData"]);
			for (let x = 0; x < newImage.width; x++) {
				for (let y = 0; y < newImage.height; y++) {
					newImage.setPixelXY(x, y, skin.getPixelXY(x, y));
					if (image.getPixelXY(x, y)[3] !== 0) {
						newImage.setPixelXY(x, y, image.getPixelXY(x, y));
					}
				}
			}
		}
	}
	let geometryData = null;
	if (request.body["geometry_name"] && request.body["geometry_data"]) {
		geometryData = JSON.parse(request.body["geometry_data"]);
		console.log(geometryData);
		//geometryData[request.body["geometry_name"]]["textureheight"] = newImage.height;
		//geometryData[request.body["geometry_name"]]["texturewidth"] = newImage.width;
		for (let key of bones) {
			let obj = bones.indexOf(key);
			for (let k of geometryData[request.body["geometry_name"]]["bones"]) {
				let v = geometryData[request.body["geometry_name"]]["bones"].indexOf(k);
				if (v.description.identifier === request.body["geometry_name"]) {
					if (v.name === obj.name) {
						bones.indexOf(key)["name"] = obj.name + "-" + generateId(8);
						/*let pivot = geometryData[request.body["geometry_name"]]["bones"][k]["pivot"];
						 geometryData[request.body["geometry_name"]]["bones"][k]["pivot"] = [(pivot[0] ?? 0) -(obj.pivot[0] ?? 0), (pivot[1] ?? 0) -(obj.pivot[1] ?? 0), (pivot[2] ?? 0) -(obj.pivot[2] ?? 0)];
						 geometryData[request.body["geometry_name"]]["bones"][k]["cubes"] = {...geometryData[request.body["geometry_name"]]["bones"][k]["cubes"], ...obj.cubes};
						 delete geometryData[request.body["geometry_name"]]["bones"][k];*/
					}
				}
			}
			geometryData = {...geometryData[request.body["geometry_name"]]["bones"], ...obj};
		}
		console.log(request.body["geometry_name"]);
	}
	response.status(200).json({
		active: CosmeticObj,
		buffer: await encodeSkinData(newImage),
		legacySkinData: await encodeSkinData(await decodeSkinData(request.body["skinData"])),
		bones: (bones.length === 0 ? null : bones),
		geometry_name: request.body["geometry_name"] ?? null,
		geometry_data: JSON.stringify(geometryData),
	});
}