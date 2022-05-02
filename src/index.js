
/*
 * Copyright (c) Jan Sohn / xxAROX
 * All rights reserved.
 * I don't want anyone to use my source code without permission.
 */

global.config = require("../resources/config.json");
global.pkg = require("../package.json");
global.bot = new (require("discord.js")).Client({intents:["GUILDS","GUILD_MEMBERS", "DIRECT_MESSAGE_REACTIONS", "GUILD_PRESENCES", "GUILD_MEMBERS", "DIRECT_MESSAGES"]});
global.TEST_MODE = process.env.USERNAME !== undefined;
global.DEBUG_MODE = false;
global.COSMETICX_LINK = TEST_MODE ? "http://localhost:" + config["port"] : "https://cosmetic-x.de";

global.generateId = function (length) {
	let result           = '';
	let characters       = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
	let charactersLength = characters.length;
	for (let i = 0; i < length; i++) {
		result += characters.charAt(Math.floor(Math.random() * charactersLength));
	}
	return result;
}
const db = require("./utils/db.js");

global.LIB = {
	fs: require("fs"),
	path: require("path"),
	os: require("os"),
	child_process: require("child_process"),
	crypto: require("crypto"),
}


/**
 * Module dependencies.
 */
global.WebSocketServer = new (require("./utils/WebSocketServer.js"))(config.rpc_socket_port);
const app = require('../src/app.js');
const http = require('http');
const fs = require("fs");
const Discord = require("discord.js");

const { SlashCommandBuilder,SlashCommandStringOption } = require("@discordjs/builders");
const { Routes } = require('discord-api-types/v9');
const { REST } = require("@discordjs/rest");

/**
 * Get port from environment and store in Express.
 */
const port = normalizePort(config.port || "3000");
app.set('port', port);
/**
 * Create HTTP server.
 */
const server = http.createServer(app);
server.on('error', onError);
server.on('listening', onListening);

bot.on("ready", async () => {
	await db.load();
	console.log("Loaded cache");

	// noinspection JSCheckFunctionSignatures
	const restClient = new REST({version: "9"}).setToken(fs.readFileSync("./src/TOKEN.txt").toString());

	let gamertag = new SlashCommandBuilder()
	.setName("gamertag")
	.setDescription("Set your xbox gamertag used for Premium cosmetics.")
	.addStringOption(option =>
		option.setName("gamertag")
		.setDescription("Your XBOX Gamertag")
		.setRequired(true)
	);
	let commands = [
		gamertag.toJSON(),
	];
	restClient.put(Routes.applicationGuildCommands(bot.user.id, config.discord.guild_id), {body: commands}).catch(console.error);

	server.listen(port, "localhost");
});
bot.on("interactionCreate", /** @param {Discord.CommandInteraction} interaction */ async (interaction) => {
	if (!interaction.isCommand()) {
		return;
	}
	if (interaction.commandName === "gamertag") {
		let gamertag = interaction.options.getString("gamertag");
		let user = db_cache.users.get(interaction.member.user.id);
		if (user) {
			await user.fetchMember();
			if (!user.isPremium) {
				await interaction.reply({ content:"This command is for linking you in-game account for exclusive **Premium-Cosmetics**.", ephemeral:true });
			} else {
				let already_user = db_cache.users.filter(user => user.gamertag && user.gamertag.toLowerCase() === gamertag.toLowerCase()).first();
				if (!already_user) {
					await user.updateGamertag(gamertag);
					await interaction.reply({ content:"Updated gamertag to **" + gamertag + "**", ephemeral:true });
				} else {
					await interaction.reply({ content:gamertag + " is already linked.", ephemeral:true });
				}
			}
		} else {
			await interaction.reply({ content:"You are not registered. [Register](https://cosmetic-x.de/login)", ephemeral:true });
		}
	}
});

function normalizePort(val) {
	const port = parseInt(val, 10);
	if (isNaN(port)) {
		return val;
	}
	if (port >= 0) {
		return port;
	}
	return false;
}

function onError(error) {
	if (error.syscall !== 'listen') {
		throw error;
	}
	const bind = typeof port === 'string' ? 'Pipe ' + port : 'Port ' + port;
	switch (error.code) {
		case 'EACCES':
			console.error(bind + ' requires elevated privileges');
			process.exit(1);
			break;
		case 'EADDRINUSE':
			console.error(bind + ' is already in use');
			process.exit(1);
			break;
		default:
			throw error;
	}
}

function onListening() {
	const addr = server.address();
	console.log("Listening on " + (typeof addr === "string" ? "pipe " + addr : "port " + addr.port));
}

bot.login(fs.readFileSync("./src/TOKEN.txt").toString());