/*
 * Copyright (c) 2021-2022. Jan Sohn.
 * All rights reserved.
 * I don't want anyone to use my source code without permission.
 */

const express = require('express');
const { Octokit } = require("@octokit/core");
const octokit = new Octokit({auth: config.github.access_token});
const db = require("../bin/db");
const {encodeSkinData, decodeSkinData} = require("../bin/imagetools");
const {Image} = require("image-js");
const {drawActiveCosmeticsOnSkin} = require("../bin/utils");
const Discord = require("discord.js");
const router = express.Router();

const checkForTokenHeader = async (request, response, next) => {
	if (request.header("Token") === undefined) {
		response.status(400).json({error:"No token provided"});
		return;
	}
	if (!await db.user.checkToken(request.header("Token"), response)) {
		response.status(401).json({error:"No valid token provided"});
		return;
	}
	next();
};

router.get("/", checkForTokenHeader, function(request, response, next) {
	response.status(200).json({
		"holder": db.user.getByToken(request.header("Token"), response).display_name ?? null,
		"backend-version": config.version,
		"lastest-client-version": config.client_version,
	});
});

router.post("/users/cosmetics/:xuid", checkForTokenHeader, async function (request, response, next) {
	if (!request.params["xuid"]) {
		response.status(400).json({error:"xuid is not provided"});
		return;
	}
	if (!request.body["active"]) {
		if (!request.body["skinData"]) {
			response.status(400).json({error:"'skinData' or 'active' is not provided"});
		} else {
			await drawActiveCosmeticsOnSkin(request, response);
		}
	} else {
		db.player.setActiveCosmetics(request.body.active ,request.params["xuid"]);
		response.status(200).json({success:true});
	}
});

router.post("/available-cosmetics", checkForTokenHeader, async function (request, response) {
	response.status(200).json({
		public: db.api.getPublicCosmetics(),
		slot: db.api.getSlotCosmetics(db.user.getByToken(request.header("Token"), response).username),
	})
});

router.post("/cosmetic/activate", checkForTokenHeader, async function (request, response) {
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
			if (image.getPixelXY(x, y)[3] !== 0) {
				newImage.setPixelXY(x, y, image.getPixelXY(x, y));
			}
		}
	}
	response.status(200).json({
		buffer: await encodeSkinData(newImage),
		geometry_name: null,
		geometry_data: null,
	});
});

router.post("/cosmetic/deactivate", checkForTokenHeader, async function (request, response) {
	if (!request.body["id"]) {
		response.status(400).json({error:"id is not provided"});
		return;
	}
	if (!request.body["active"]) {
		response.status(400).json({error:"active is not provided"});
		return;
	}
	if (!request.body["skinData"]) {
		response.status(400).json({error:"skinData is not provided"});
		return;
	}
	//TODO: https://github.com/Cosmetic-X/Backend/issues/4
	response.status(200).json({
		buffer: null,
		geometry_name: null,
		geometry_data: null,
	});
});

router.post("/github", async function (request, response) {
	if (request.body.action === "published" && request.body.repository.name.endsWith("-Client")) {
		let github_response = await octokit.request("GET /repos/{owner}/{repo}/releases", {
			owner: request.body.organization.login,
			repo: request.body.repository.name
		});
		let release_id = request.body.release.id;
		if (github_response.data) {
			for (let key in github_response.data) {
				if (github_response.data[key].name === request.body.release.name) {
					release_id = github_response.data[key].id;
				}
			}
		}
		let error = undefined;
		github_response = await octokit.request("GET /repos/{owner}/{repo}/releases/{release_id}/assets", {
			owner: request.body.organization.login,
			repo: request.body.repository.name,
			release_id: release_id
		}).catch((e) => {
			error = e;
			console.error(e);
		});

		if (!error && github_response.status === 200 && github_response.data.length !== 0) {
			let channel = bot.guilds.cache.first().channels.cache.get(config.discord.releases_channel);
			if (!channel) {
				channel = bot.guilds.cache.first().channels.fetch(config.discord.releases_channel);
			}
			let embed = new Discord.MessageEmbed();
			let content;
			let files = [];

			embed.setTitle(channel.guild.name);
			embed.setURL("https://github.com/Cosmetic-X/" + request.body.repository.name);
			embed.setTimestamp(new Date());
			embed.setAuthor({name: "Download " + request.body.repository.name, url: "https://cosmetic-x.de/api/download/" + request.body.repository.name + "/" + request.body.release.tag_name, iconURL: channel.guild.iconURL({size:512})});

			for (let key in github_response.data) {
				let asset = github_response.data[key];
				github_response = await octokit.request("GET /repos/{owner}/{repo}/releases/assets/{asset_id}", {
					headers: {
						Accept: "application/octet-stream"
					},
					owner: request.body.organization.login,
					repo: request.body.repository.name,
					asset_id: asset.id
				}).catch((e) => {
					error = e;
					console.error(e);
				});

				if (!error && github_response.status === 200) {
					files[files.length] = {
						attachment: Buffer.from(github_response.data),
						name: asset.name,
						description: request.body.repository.name + " " + request.body.release.tag_name
					};
					db.auto_updater.updateVersion(request.body.repository.name, request.body.release.tag_name, asset.name, Buffer.from(github_response.data).toString());
				} else {
					error = true;
				}
			}
			if (error) {
				embed.setTitle(error.name);
				embed.setColor("RED");
				embed.setDescription(error.message);
				channel.send({content: "<@&" + config.discord.admin_roles[0] + ">", embeds: [embed]});
			} else {
				if (request.body.release.tag_name.startsWith("v")) {
					content = "<@&" + config.discord.release_ping_role + ">";
					embed.setDescription(request.body.release.tag_name + " have been released.");
					embed.setColor("FUCHSIA");
				} else {
					content = "<@&" + config.discord.development_release_ping_role + ">";
					embed.setDescription("New development version have been released.");
					embed.setColor(channel.guild.roles.cache.get("938563896640417883").color);
				}
				embed.setFooter({text:"Released"});
			}
			channel.send({content: content, embeds: [embed], files: files}).catch(console.error).then(async (message) => {if (message.channel.type === "news") {await message.crosspost();}});
		} else {
			if (error) {
				let channel = bot.guilds.cache.first().channels.cache.get(config.discord.releases_channel);
				if (!channel) {
					channel = bot.guilds.cache.first().channels.fetch(config.discord.releases_channel);
				}
				let embed = new Discord.MessageEmbed();
				embed.setTitle(error.name);
				embed.setColor("RED");
				embed.setDescription(error.message);
				channel.send({content: "<@&" + config.discord.admin_roles[0] + ">", embeds: [embed]});
			}
		}
		response.status(200).send("OK!");
	} else {
		response.status(404).send("Not found!");
	}
});

router.get("/download/:client/:tag", async function (request, response) {
	if (!request.params.client) {
		response.status(400).json({error: "Client is not provided"});
		return;
	}
	let version = await db.auto_updater.getVersions(request.params.client, request.params.tag);
	if (!version) {
		response.status(404).json({error: "Client has no published versions yet."});
		return;
	}
	response.header("Content-Type", "php/phar").header("Content-Disposition", "attachment; filename=\"" + version.file_name + "\"").status(200).send(Buffer.from(version.stream));
});

router.post("/kofi/payment/complete", async function (request, response) {
	console.log(request.headers);
	console.log(request.body);
	console.log(request.query);
	response.status(200);
});

module.exports = router;
