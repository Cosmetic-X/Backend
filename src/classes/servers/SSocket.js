/*
 * Copyright (c) Jan Sohn / xxAROX
 * All rights reserved.
 * I don't want anyone to use my source code without permission.
 */
const net = require("net");

/**
 * Class SSocket
 * @author Jan Sohn / xxAROX
 * @date 07.05.2022 - 15:36
 * @project Backend
 */
class SSocket {
	/** @private */
	_server = null;
	running = false;
	bind_port = null;

	constructor(bind_port) {
		process.on("exit", () => this.close());
		this.bind_port = bind_port;

		this._server = net.createServer(socket => {
			socket.on("data", data => {
				this.onMessage(data.toString());
			});
			socket.on("connect", (socket) => {
				console.log(socket);
				console.log("[SSocket] ".yellow + "Client connected");
			});
			socket.on("end", () => {
				console.log("[SSocket] ".yellow + "Client disconnected");
			});
			socket.on("error", err => {
				console.log("[SSocket] ".yellow + "Error: " + err);
			});
			socket.on("close", () => {
				console.log("[SSocket] ".yellow + "Connection closed");
			});
			socket.write("Hello World");
			socket.end();
		});
		this._server.on("error", err => {
			console.error(err);
		});
		this._server.on("listening", () => {
			this.running = true;
			console.log("[SSocket] ".yellow + "Socket listening on port " + this.bind_port);
		});
		this._server.on("close", () => {
			this.running = false;
			console.log("[SSocket] ".yellow + "Socket closed");
		});
	}

	/**
	 * @param {string} data
	 * @returns {Object}
	 */
	encodeData(data) {
		let json = null
		try {
			json = JSON.parse(data).catch(() => null);
		} catch (e) {
		}
		let packet = {};
		return json ? packet : null;
	}

	start() {
		this._server.listen(this.bind_port, "127.0.0.1");
	}

	/**
	 * @private
	 * @param {string} message
	 */
	onMessage(message) {
		let data = this.encodeData(message);
	}

	close() {
		console.log("[SSocket] ".yellow + "Closing socket...");
		this._server.close();
		console.log("[SSocket] ".yellow + "Socket closed.");
	}
}
module.exports.SSocket = SSocket;
