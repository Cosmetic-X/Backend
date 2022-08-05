
/*
 * Copyright (c) Jan Sohn / xxAROX
 * All rights reserved.
 * I don't want anyone to use my source code without permission.
 */
const Discord = require("discord.js");
global.bot = new Discord.Client({
	intents:[
		Discord.GatewayIntentBits.Guilds,
		Discord.GatewayIntentBits.GuildMembers,
		Discord.GatewayIntentBits.GuildMessages,
		//Discord.GatewayIntentBits.GuildBans,
		//Discord.GatewayIntentBits.GuildInvites,
		//Discord.GatewayIntentBits.GuildIntegrations,
		//Discord.GatewayIntentBits.GuildMessageReactions,
		//Discord.GatewayIntentBits.GuildScheduledEvents,
		Discord.GatewayIntentBits.MessageContent
	]
});

global.term = require("terminal-kit").terminal;
global.generateId = function (length) {
	let result           = '';
	let characters       = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
	let charactersLength = characters.length;
	for (let i = 0; i < length; i++) {
		result += characters.charAt(Math.floor(Math.random() * charactersLength));
	}
	return result;
}
global.eachOS = (win32, linux, darwin) => {
	if (process.platform === "win32" && typeof win32 === "function") return win32();
	else if (process.platform === "linux" && typeof linux === "function") return linux();
	else if (process.platform === "darwin" && typeof darwin === "function") return darwin();
	return undefined;
};
const db = require("./utils/db.js");

console.commands = new (require("discord.js")).Collection();
console.command_aliases = new (require("discord.js")).Collection();

console.log("Loading console commands..");
const files = LIB.fs.readdirSync(LIB.path.join(__dirname, "commands/console"));

for (const file of files) {
	if (file.endsWith(".js")) {
		const command = require(LIB.path.join(__dirname, "commands/console", file));
		console.commands.set(command.name.toLowerCase(), command);
		if (command.aliases && command.aliases.length > 0) {
			for (const alias of command.aliases) {
				console.command_aliases.set(alias.toLowerCase(), command.name.toLowerCase());
			}
		}
	}
}
console.log("Loaded " + console.commands.size + " console command" + (console.commands.size === 1 ? "" : "s") + ".");

global.readline = require('readline').createInterface({input:process.stdin,output:process.stdout});
readline.on("line", (input) => {
	let args = input.split(" ");
	let input_command = args.shift();
	let command = console.commands.get(input_command.toLowerCase());
	if (!command) command = console.commands.get(console.command_aliases.get(input_command.toLowerCase()));

	if (command) {
		try {
			if (command && command.execute) {
				command.execute(args);
			}
		} catch (e) {
			throw new Error("Command failed: " + e);
		}
	} else {
		console.error("Command '".red + input_command + "' not found!".red);
	}
});



/**
 * Module dependencies.
 */
global.WebSocketServer = new (require("./utils/WebSocketServer.js"))(config.rpc_socket_server.port, config.rpc_socket_server.ip);

const app = require('../src/app.js');
const http = require('http');
const fs = require("fs");
require('colors');

const { Routes } = require('discord-api-types/v10');
const { REST } = require("@discordjs/rest");
const {SlashCommand} = require("./classes/SlashCommand");
const {GatewayIntentBits} = require("discord-api-types/v10");
const {VerifyServer} = require("./classes/VerifyServer");
const path = require("path");


/**
 * Get port from environment and store in Express.
 */
const port = normalizePort(config.express_server.port || "3000");
app.set('port', port);
/**
 * Create HTTP server.
 */
const server = http.createServer(app);
server.on('error', onError);
server.on('listening', onListening);
global.verificationServer = new VerifyServer(config.verification_server.port, config.verification_server.ip);
verificationServer.start();

bot.commands = new LIB.discord.Collection();

bot.on("ready", async () => {
	let database_start = new Date().getTime();
	console.log("Loading database..");
	await db.load();
	console.log("[SUCCESS] " + "Database loaded in " + (new Date().getTime() -database_start) + "ms");
	global.COSMETICX_GUILD = bot.guilds.cache.get(config.discord.guild_id);
	global.COSMETICX_BOT_MEMBER = COSMETICX_GUILD.members.cache.get(bot.user.id) || await COSMETICX_GUILD.members.fetch(bot.user.id);
	global.COSMETICX_ICON_URL = COSMETICX_GUILD.iconURL({extension: "png", size: 1024});
	global.COSMETICX_CHANNELS = {
		role_log: COSMETICX_GUILD.channels.cache.get(config.discord.role_log_channel),
		releases: COSMETICX_GUILD.channels.cache.get(config.discord.releases_channel),
	};


	try {
		console.log("Loading guild slash-commands..");
		//noinspection JSCheckFunctionSignatures
		const rest = new REST({version: "10"}).setToken(fs.readFileSync("./src/TOKEN.txt").toString());
		let commands = [];
		for (const command of require("./commands/registerSlashCommands.js")) {
			if (!command instanceof SlashCommand) continue;
			bot.commands.set(command.name.toLowerCase(), command);
			commands.push(command.builder.toJSON());
		}
		rest.put(Routes.applicationGuildCommands(bot.user.id, config.discord.guild_id), {body: commands}).catch(console.error);
		console.log("[SUCCESS] " + "Refreshed guild slash-commands.");
	} catch (e) {
		console.error(e);
	}
	console.log("Logged in as " + bot.user.tag + ".");

	server.listen(port, "localhost");

});
bot.on("interactionCreate", /** @param {Discord.CommandInteraction} interaction */ async (interaction) => {
	if (interaction.isCommand()) return bot.commands.get(interaction.commandName.toLowerCase()).run(interaction);
});
bot.on("guildMemberUpdate", (oldMember, newMember) => {
	if (oldMember.user.bot) return;
	if (oldMember.roles.cache.size === newMember.roles.cache.size) return;
	let role = newMember.roles.cache.size > oldMember.roles.cache.size
		? newMember.roles.cache.find(r => !oldMember.roles.cache.has(r.id))
		: oldMember.roles.cache.find(r => !newMember.roles.cache.has(r.id))
	;
	let isASpecialRole = false;
	for (let key in config.discord.roles) {
		if (config.discord.roles[key] === role.id) {
			isASpecialRole = true;
			break;
		}
	}
	if (!isASpecialRole) return;
	let embed = BaseEmbed();
	if (newMember.roles.cache.size > oldMember.roles.cache.size) embed.setColor("#1e8e1c").setDescription("<@"+newMember.user.id+"> has been given the role **"+role.name+"**.");
	else embed.setColor("#8e231c").setDescription("<@"+newMember.user.id+"> has been removed the role **"+role.name+"**.");
	COSMETICX_CHANNELS.role_log.send({embeds:[embed]});
});

function normalizePort(val) {
	const port = parseInt(val, 10);
	if (isNaN(port)) return val;
	if (port >= 0 && port <= 65535) return port;
	else return false;
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
	console.log("[SUCCESS] " + "Listening on " + (typeof addr === "string" ? "pipe " + addr : "port " + addr.port));
}

bot.login(fs.readFileSync("./src/TOKEN.txt").toString());