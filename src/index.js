
/*
 * Copyright (c) 2021-2022. Jan Sohn.
 * All rights reserved.
 * I don't want anyone to use my source code without permission.
 */

global.config = require("../resources/config.json");
global.pkg = require("../package.json");
global.bot = new (require("discord.js")).Client({intents:["GUILDS","GUILD_MEMBERS", "GUILD_PRESENCES", "GUILD_MEMBERS", "DIRECT_MESSAGES"]});

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
db.checkTables();

/**
 * Module dependencies.
 */
const app = require('../src/app.js');
const http = require('http');
const fs = require("fs");

/**
 * Get port from environment and store in Express.
 */
const port = normalizePort(config.port || "3000");
app.set('port', port);
/**
 * Create HTTP server.
 */
const server = http.createServer(app);
server.listen(port, "localhost");
server.on('error', onError);
server.on('listening', onListening);

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