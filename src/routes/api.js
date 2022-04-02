/*
 * Copyright (c) Jan Sohn / xxAROX
 * All rights reserved.
 * I don't want anyone to use my source code without permission.
 */

const express = require("express");
const {Octokit} = require("@octokit/core");
const octokit = new Octokit({auth: config.github.access_token});
const db = require("../utils/db.js");
const RPCUser = require("../classes/RPCUser.js");
const {encodeSkinData, decodeSkinData} = require("../utils/imagetools.js");
const {Image} = require("image-js");
const {drawActiveCosmeticsOnSkin} = require("../utils/utils.js");
const Discord = require("discord.js");
const rateLimit = require("express-rate-limit");
const {Cosmetic} = require("../classes/Cosmetic");
const Invite = require("../classes/Invite");
const {SnowflakeUtil} = require("discord.js");
const router = express.Router();

const checkForTokenHeader = async (request, response, next) => {
	if (request.header("Token") === undefined) {
		response.status(400).json({error: "No token provided"});
	} else {
		let team = await db.teams.getByToken(request.header("Token"));
		if (!team) {
			response.status(401).json({error: "No valid token provided"});
		} else {
			await team.reloadCosmetics();
			request.team = team;
			next();
		}
	}
};
const basicRateLimit = rateLimit({
	windowMs: 1000,
	max: 100,
	handler: function (req, res) {
		res.status(200).json({
			error: "You have been rate limited",
		});
	},
});

// ################################
// #                       Client-Requests section                       #
// ################################
router.get("/", checkForTokenHeader, function (request, response, next) {
	let team = db.teams.getByToken(request.header("Token"));
	response.status(200).json({
		"team": team.name ?? null,
		"holder": db_cache.users.get(team.owner_id).tag ?? null,
		"backend-version": pkg.version,
		"lastest-client-version": config.client_version,
	});
});
router.post("/cosmetics", checkForTokenHeader, async function (request, response) {
	response.status(200).json({...await db_cache.teams.get("cosmetic-x").getPublicCosmeticsForClient(), ...(request.team.name === "Cosmetic-X" ? [] : (await request.team.getPublicCosmeticsForClient()))});
});

// ################################
// #                               Users section                               #
// ################################
router.post("/users/rpc", checkForTokenHeader, async function (request, response) {
	if (!request.body.gamertag) {
		response.status(400).json({error: "No gamertag provided"});
	} else if (!request.body.network) {
		response.status(400).json({error: "No network provided"});
	} else if (!request.body.server) {
		response.status(400).json({error: "No server provided"});
	} else {
		if (!request.body.ends_at || isNaN(request.body.ends_at)) {
			request.body.ends_at = null;
		}
		/** @type {RPCUser} */
		let rpc_user = await WebSocketServer.getRPCUser(request.body.gamertag);
		if (rpc_user) {
			rpc_user.setServer(request.body.network, request.body.server, request.body.ends_at);
			response.status(200).json({success: true});
		} else {
			response.status(400).json({error: "User is not connected to our RPC-Client"});
		}
	}
});
router.post("/users/verify", checkForTokenHeader, async function (request, response) {
	let gamertag = request.body.gamertag;
	if (!gamertag) {
		response.status(400).json({error: "No gamertag provided"});
		return;
	}
	let discord_tag_or_id = request.body["discord_tag_or_id"];
	if (!discord_tag_or_id) {
		response.status(400).json({error: "No discord_tag_or_id provided"});
		return;
	}
	let success = true;

	db.verify.verify(discord_tag_or_id, gamertag);

	let body = {
		"success": false,
		"error": "Soon",
		"user": null,
	};
	response.status(200).json(body);
});
router.post("/users/cosmetics/:xuid", checkForTokenHeader, async function (request, response, next) {
	if (!request.params[ "xuid" ]) {
		response.status(400).json({error: "xuid is not provided"});
		return;
	}
	if (!request.body[ "active" ]) {
		if (!request.body[ "skinData" ]) {
			response.status(400).json({error: "'skinData' or 'active' is not provided"});
		} else {
			await drawActiveCosmeticsOnSkin(request, response);
		}
	} else {
		db.player.setActiveCosmetics(request.body.active, request.params[ "xuid" ]);
		response.status(200).json({success: true});
	}
});
router.post("/users/cosmetics/activate", checkForTokenHeader, async function (request, response) {
	if (!request.body[ "id" ]) {
		response.status(400).json({error: "id is not provided"});
		return;
	}
	if (!request.body[ "skinData" ]) {
		response.status(400).json({error: "skinData is not provided"});
		return;
	}
	let id = request.body[ "id" ];
	let baseImage = await decodeSkinData(request.body[ "skinData" ]);
	let image = request.team.getCosmetic(id);

	if (!image[ 0 ]) {
		response.status(400).json({error: "Cosmetic not found"});
		return;
	}
	image = await decodeSkinData(image[ 0 ][ "skinData" ]);
	let newImage = new Image(image.width, image.height);

	for (let x = 0; x < newImage.width; x++) {
		for (let y = 0; y < newImage.height; y++) {
			newImage.setPixelXY(x, y, baseImage.getPixelXY(x, y));
			if (image.getPixelXY(x, y)[ 3 ] !== 0) {
				newImage.setPixelXY(x, y, image.getPixelXY(x, y));
			}
		}
	}
	response.status(200).json({
		buffer: await encodeSkinData(newImage),
		geometry_data: null,
	});
});
router.post("/users/cosmetics/deactivate", checkForTokenHeader, async function (request, response) {
	if (!request.body[ "id" ]) {
		response.status(400).json({error: "id is not provided"});
		return;
	}
	if (!request.body[ "active" ]) {
		response.status(400).json({error: "active is not provided"});
		return;
	}
	if (!request.body[ "skinData" ]) {
		response.status(400).json({error: "skinData is not provided"});
		return;
	}
	//TODO: https://github.com/Cosmetic-X/Backend/issues/4
	response.status(200).json({
		buffer: null,
		geometry_name: null,
		geometry_data: null,
	});
});


// ################################
// #                               POST section                               #
// ################################
router.post("/github", async function (request, response) {
	if (request.body.action === "published" && request.body.repository.name.endsWith("-Client")) {
		let github_response = await octokit.request("GET /repos/{owner}/{repo}/releases", {
			owner: request.body.organization.login,
			repo: request.body.repository.name,
		});
		let release_id = request.body.release.id;
		if (github_response.data) {
			for (let key in github_response.data) {
				if (github_response.data[ key ].name === request.body.release.name) {
					release_id = github_response.data[ key ].id;
				}
			}
		}
		let error = undefined;
		github_response = await octokit.request("GET /repos/{owner}/{repo}/releases/{release_id}/assets", {
			owner: request.body.organization.login,
			repo: request.body.repository.name,
			release_id: release_id,
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
			embed.setAuthor({
				name: "Download " + request.body.repository.name,
				url: "https://cosmetic-x.de/api/download/" + request.body.repository.name + "/" + request.body.release.tag_name,
				iconURL: channel.guild.iconURL({size: 512}),
			});

			for (let key in github_response.data) {
				let asset = github_response.data[ key ];
				github_response = await octokit.request("GET /repos/{owner}/{repo}/releases/assets/{asset_id}", {
					headers: {
						Accept: "application/octet-stream",
					},
					owner: request.body.organization.login,
					repo: request.body.repository.name,
					asset_id: asset.id,
				}).catch((e) => {
					error = e;
					console.error(e);
				});

				if (!error && github_response.status === 200) {
					files[ files.length ] = {
						attachment: Buffer.from(github_response.data),
						name: asset.name,
						description: request.body.repository.name + " " + request.body.release.tag_name,
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
				channel.send({content: "<@&" + config.discord.admin_roles[ 0 ] + ">", embeds: [ embed ]});
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
				embed.setFooter({text: "Released"});
			}
			channel.send({
				content: content,
				embeds: [ embed ],
				files: files,
			}).catch(console.error).then(async (message) => {
				if (message.channel.type === "news") {
					await message.crosspost();
				}
			});
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
				channel.send({content: "<@&" + config.discord.admin_roles[ 0 ] + ">", embeds: [ embed ]});
			}
		}
		response.status(200).send("OK!");
	} else {
		response.status(404).send("Not found!");
	}
});
router.post("/kofi/payment/complete", async function (request, response) {
	if (!request.body.data) {
		response.status(404).send("404: Not found.");
	} else {
		let body = JSON.parse(request.body.data);
		if (body[ "verification_token" ] === config.kofi.token) {
			await sendKofiTransactionEmbed(body);

			if ((body.type === "Donation" || body.type === "Subscription") && body[ "is_public" ]) { // Single Donation
				await sendKofiEmbed(body);
			} else if (body.type === "Shop Order" && body[ "is_public" ]) {
				let items = [];
				for (let k in body[ "shop_items" ]) {
						items[items.length] = body["shop_items"][k]["direct_link_code"]
				}
				for (let item of items) {
					if (item === "63127362ba") {

					}
				}
				await sendKofiEmbed(body);
			}
			response.status(200);
		} else {
			response.status(404).send("404: Not found.");
		}
	}
});

// ################################
// #                               Team section                               #
// ################################
router.post("/teams/new", checkForSession, checkPermissions, async (request, response, next) => {
	if (!request.body.name) {
		response.status(400).json({error:"'name' is not provided."})
	} else {
		if (await db.teams.exists(request.body.name)) {
			await db.teams.createTeam(request.body.name, request.session.discord.user.id);
			response.redirect("/dashboard/teams/@/" + request.body.name);
		} else {
			response.redirect("/dashboard/teams/new?error=Team already exists.");
		}
	}
});
router.post("/teams/@/:team/cosmetics/new", checkForSession, checkPermissions, checkForTeam, async (request, response, next) => {
	if (!request.files.image) {
		response.status(400).json({error:"Image parameter is not provided."});
		return;
	} else {
		if (request.files.image.mimetype !== "image/png") {
			response.status(400).json({error:"Wrong image format, it should be '.png'."});
			return;
		}
		if (request.files.image.size > 128 * 128 * 4) {
			response.status(400).json({error:"Image is too big it should be 128x128."});
			return;
		}
	}
	if (!request.files.geometry) {
		response.status(400).json({error:"Geometry parameter is not provided."});
		return;
	} else {
		if (request.files.geometry.mimetype !== "application/json") {
			response.status(400).json({error:"Wrong geometry format, it should be '.json'."});
			return;
		}
		if (request.files.geometry.size > 512 * 512 * 4) {
			response.status(400).json({error:"Geometry is too big it should be max " + 512 * 512 * 4 + " bytes."});
			return;
		}
	}
	if (!request.body.display_name) {
		response.status(400).json({error:"Display-Name parameter is not provided."});
		return;
	}
	if (!request.body.creation_date) {
		response.status(400).json({error:"Creation-Date parameter is not provided."});
		return;
	}
	request.body.name = request.body.display_name.replace(/\u00A7[0-9A-GK-OR]/ig, "");

	let geometry = undefined;
	try {
		geometry = JSON.parse(request.files.geometry.data.toString());
		for (let k in geometry) {
			geometry = geometry[k];
			break;
		}
		if (!Array.isArray(geometry)) {
			response.status(400).json({
				error: "Geometry file format is wrong.", example: {
					geometry: [
						{
							name: "bone1",
							pivot: [ 0, 0, 0 ],
							rotation: [ 0, 0, 0 ],
							cubes: [
								{"origin": [ 0, 0, 0 ], "size": [ 0, 0, 0 ], "uv": [ 0, 0 ], "inflate": 0},
							],
						},
						{
							name: "bone2",
							pivot: [ 0, 0, 0 ],
							rotation: [ 0, 0, 0 ],
							cubes: [
								{"origin": [ 0, 0, 0 ], "size": [ 0, 0, 0 ], "uv": [ 0, 0 ], "inflate": 0},
							],
						},
					],
				},
			});
			return;
		}
	} catch (e) {
		response.status(400).json({error:"JSON issue in your geometry file."});
		return;
	}
	if (request.body.image_url === "") {
		request.body.image_url = null;
	}
	if (geometry) {
		await request.team.addCosmetic(
			request.cosx_user.tag,
			request.body.name,
			request.body.display_name,
			JSON.stringify(geometry),
			request.files.image.data.toString("base64"),
			request.body.image_url,
			(new Date(request.body.creation_date).getTime() / 1000),
			(new Date(request.body.creation_date).getTime() / 1000) > time(),
			request.team.isContributor(request.cosx_user.id)
		);
	}
	response.redirect("/dashboard/teams/@/" + request.team.name);
});
router.post("/teams/@/:team/invite/@/:user_id/:permission", checkForSession, checkPermissions, checkForTeam, async (request, response, next) => {
	if (!request.params.user_id || !request.params.permission) {
		response.redirect("/dashboard/teams/@/" + request.team.name);
	} else {
		let user = await db_cache.users.get(request.params.user_id);
		let permission = request.params.permission;
		if (!user) {
			response.redirect("/dashboard/teams/@/" + request.team.name + "?error=User not found.");
		} else {
			if (!["admin", "manage_drafts", "manage_submissions", "contribute"].includes(permission)) {
				response.redirect("/dashboard/teams/@/" + request.team.name + "?error=Permission not found.");
			} else {
				user.sendInvite(new Invite(request.team, user.discord_id, permission));
				response.redirect("/dashboard/teams/@/" + request.team.name);
			}
		}
	}
});
router.post("/teams/@/:team/invite/@/:user_id/revoke", checkForSession, checkForTeam, async (request, response, next) => {
	console.log("HRUENSOhn");
	if (!request.params.user_id) {
		response.redirect("/dashboard/teams/@/" + request.team.name);
	} else {
		let user = await db_cache.users.get(request.params.user_id);
		if (!user) {
			response.redirect("/dashboard/teams/@/" + request.team.name + "?error=User not found.");
		} else {
			user.denyInvite(request.team);
			user.updateInvites();
			response.redirect("/dashboard/teams/@/" + request.team.name);
		}
	}
});
router.post("/teams/@/:team/cosmetics/@/:cosmetic/edit", checkForSession, checkPermissions, checkForTeam, checkForCosmetic, async (request, response, next) => {
	if (!request.body.display_name) {
		response.status(400).json({error:"Display-Name parameter is not provided."});
		return;
	}
	if (!request.body.creation_date) {
		response.status(400).json({error:"Creation-Date parameter is not provided."});
		return;
	}
	request.body.name = request.body.display_name.replace(/\u00A7[0-9A-GK-OR]/ig, "");

	let image = undefined;
	if (request.files && request.files.image) {
		if (request.files.image.mimetype !== "image/png") {
			response.status(400).json({error:"Wrong image format, it should be '.png'."});
			return;
		}
		if (request.files.image.size > 128 * 128 * 4) {
			response.status(400).json({error:"Image is too big it should be 128x128."});
			return;
		}
		image = request.files.image.data.toString("base64");
	} else {
		image = request.cosmetic.skin_data;
	}
	let geometry = undefined;
	if (request.files && request.files.geometry) {
		if (request.files.geometry.mimetype !== "application/json") {
			response.status(400).json({error:"Wrong geometry format, it should be '.json'."});
			return;
		}
		if (request.files.geometry.size > 512 * 512 * 4) {
			response.status(400).json({error:"Geometry is too big it should be max " + 512 * 512 * 4 + " bytes."});
			return;
		}
		try {
			geometry = JSON.parse(request.files.geometry.data.toString());
			for (let k in geometry) {
				geometry = geometry[k];
				break;
			}
			if (!Array.isArray(geometry)) {
				response.status(400).json({
					error: "Geometry file format is wrong.", example: {
						geometry: [
							{
								name: "bone1",
								pivot: [ 0, 0, 0 ],
								rotation: [ 0, 0, 0 ],
								cubes: [
									{"origin": [ 0, 0, 0 ], "size": [ 0, 0, 0 ], "uv": [ 0, 0 ], "inflate": 0},
								],
							},
							{
								name: "bone2",
								pivot: [ 0, 0, 0 ],
								rotation: [ 0, 0, 0 ],
								cubes: [
									{"origin": [ 0, 0, 0 ], "size": [ 0, 0, 0 ], "uv": [ 0, 0 ], "inflate": 0},
								],
							},
						],
					},
				});
				return;
			}
		} catch (e) {
			response.status(400).json({error:"JSON issue in your geometry file."});
			return;
		}
	} else {
		geometry = request.cosmetic.geometry_data;
	}

	if (request.body.image_url === "") {
		request.body.image_url = null;
	}
	await request.team.editCosmetic(
		request.cosmetic.id,
		request.body.name,
		request.body.display_name,
		geometry ? JSON.stringify(geometry) : null,
		image,
		request.body.image_url,
		(new Date(request.body.creation_date).getTime() / 1000),
		request.cosmetic.is_denied,
		request.cosmetic.is_draft,
		request.cosmetic.is_submitted
	);
	console.log(request.team.cosmetics);
	response.redirect("/dashboard/teams/@/" + request.team.name);
});
router.post("/teams/@/:team/members/@/:member/kick", checkForSession, checkPermissions, checkForTeam, checkForMember, async (request, response, next) => {
	if (!request.member) {
		response.status(400).json({error:"Member is not in team."});
		return;
	}
	request.team.kickMember(request.member);

	let image = undefined;
	if (request.files && request.files.image) {
		if (request.files.image.mimetype !== "image/png") {
			response.status(400).json({error:"Wrong image format, it should be '.png'."});
			return;
		}
		if (request.files.image.size > 128 * 128 * 4) {
			response.status(400).json({error:"Image is too big it should be 128x128."});
			return;
		}
		image = request.files.image.data.toString("base64");
	} else {
		image = request.cosmetic.skin_data;
	}
	let geometry = undefined;
	if (request.files && request.files.geometry) {
		if (request.files.geometry.mimetype !== "application/json") {
			response.status(400).json({error:"Wrong geometry format, it should be '.json'."});
			return;
		}
		if (request.files.geometry.size > 512 * 512 * 4) {
			response.status(400).json({error:"Geometry is too big it should be max " + 512 * 512 * 4 + " bytes."});
			return;
		}
		try {
			geometry = JSON.parse(request.files.geometry.data.toString());
			for (let k in geometry) {
				geometry = geometry[k];
				break;
			}
			if (!Array.isArray(geometry)) {
				response.status(400).json({
					error: "Geometry file format is wrong.", example: {
						geometry: [
							{
								name: "bone1",
								pivot: [ 0, 0, 0 ],
								rotation: [ 0, 0, 0 ],
								cubes: [
									{"origin": [ 0, 0, 0 ], "size": [ 0, 0, 0 ], "uv": [ 0, 0 ], "inflate": 0},
								],
							},
							{
								name: "bone2",
								pivot: [ 0, 0, 0 ],
								rotation: [ 0, 0, 0 ],
								cubes: [
									{"origin": [ 0, 0, 0 ], "size": [ 0, 0, 0 ], "uv": [ 0, 0 ], "inflate": 0},
								],
							},
						],
					},
				});
				return;
			}
		} catch (e) {
			response.status(400).json({error:"JSON issue in your geometry file."});
			return;
		}
	} else {
		geometry = request.cosmetic.geometry_data;
	}

	if (request.body.image_url === "") {
		request.body.image_url = null;
	}
	await request.team.editCosmetic(
		request.cosmetic.id,
		request.body.name,
		request.body.display_name,
		geometry ? JSON.stringify(geometry) : null,
		image,
		request.body.image_url,
		(new Date(request.body.creation_date).getTime() / 1000),
		request.cosmetic.is_denied,
		request.cosmetic.is_draft,
		request.cosmetic.is_submitted
	);
	console.log(request.team.cosmetics);
	response.redirect("/dashboard/teams/@/" + request.team.name);
});


// ################################
// #                            Releases section                             #
// ################################
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

// ################################
// #                                   Functions                                  #
// ################################
async function sendKofiTransactionEmbed(data, force) {
	if (force || data[ "from_name" ] !== "Ko-fi Team") {
		let embed = new Discord.MessageEmbed();
		embed.setColor("#13C3FF");
		embed.addField(data[ "from_name" ], "```json" +  JSON.stringify({amount: data["amount"] + " " + data["currency"], email: data["email"], message_id:data["message_id"], kofi_transaction_id: data[ "kofi_transaction_id" ]} + "\n```"));
		embed.setTimestamp(new Date());
		embed.setTitle("Got new transaction");

		await bot.guilds.cache.first().channels.cache.filter(channel => channel.name === "ko-fi-transactions").first().send({embeds: [ embed ]});
	}
}
async function sendKofiEmbed(data, force) {
	let message = undefined;
	if (data[ "is_subscription_payment" ]) {
		message = (!data[ "is_first_subscription_payment" ] ? "Re-" : "") + "Subscribed to " + data[ "tier_name" ];
	}
	message += "!";
	if (force || data[ "from_name" ] === "Ko-fi Team") {
		let embed = new Discord.MessageEmbed();
		embed.setTitle(data.amount + data.currency + " from " + data[ "from_name" ]);
		embed.setColor("#13C3FF");
		embed.setFooter({text: data[ "from_name" ]});
		embed.setTimestamp(new Date());
		embed.setDescription("*" + message + "*\n\n" + data.message);

		await bot.guilds.cache.first().channels.fetch(config.discord.kofi_channel).send({embeds: [ embed ]});
	}
}
async function sendKofiShopEmbed(data, force) {
	let message = undefined;
	if (data[ "is_subscription_payment" ]) {
		message = (!data[ "is_first_subscription_payment" ] ? "Re-" : "") + "Subscribed to " + data[ "tier_name" ];
	}
	message += "!";
	if (force || data[ "from_name" ] === "Ko-fi Team") {
		let embed = new Discord.MessageEmbed();
		embed.setTitle(data.amount + data.currency + " from " + data[ "from_name" ]);
		embed.setColor("#13C3FF");
		embed.setFooter({text: data[ "from_name" ]});
		embed.setTimestamp(new Date());
		embed.setDescription("*" + message + "*\n\n" + data.message);

		await bot.guilds.cache.first().channels.fetch(config.discord.kofi_channel).send({embeds: [ embed ]});
	}
}

module.exports = router;
module.exports.checkForTokenHeader = checkForTokenHeader;
