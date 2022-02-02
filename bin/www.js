
/*
 * Copyright (c) 2021-2022. Jan Sohn.
 * All rights reserved.
 * I don't want anyone to use my source code without permission.
 */

require('dotenv').config();

const imagetools = require("./imagetools");

const db = require("./db");
db.checkTables();

/**
 * Module dependencies.
 */
const app = require('../app');
const debug = require("debug")("backend:server");
const http = require('http');

/**
 * Get port from environment and store in Express.
 */
const port = normalizePort(process.env.PORT || "3000");
app.set('port', port);
/**
 * Create HTTP server.
 */
const server = http.createServer(app);
server.listen(port);
server.on('error', onError);
server.on('listening', onListening);
global.BASE_URL = "http://" + (server.address()["address"].replace("::", "localhost")) + ":" + port;

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
	const bind = typeof addr === 'string' ? 'pipe ' + addr : 'port ' + addr.port;
	debug('Listening on ' + bind);
}
