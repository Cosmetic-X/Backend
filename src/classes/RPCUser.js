/*
 * Copyright (c) Jan Sohn / xxAROX
 * All rights reserved.
 * I don't want anyone to use my source code without permission.
 */
const UpdateServerPacket = require("rpc-protocol/src/packets/UpdateServerPacket.js");

class RPCUser {
	gamertag = null;
	socket_ip = null;
	socket_port = null;
	
	constructor(gamertag, socket_ip, socket_port) {
		this.gamertag = gamertag;
		this.socket_ip = socket_ip;
		this.socket_port = socket_port;
	}

	disconnect(reason) {
		WebSocketServer.disconnect(this, reason);
	}

	sendPacket(packet) {
		console.log("[RPCUser:" + this.gamertag + "] Sending packet to " + this.socket_ip + ":" + this.socket_port);
		WebSocketServer.sendPacket(packet, this.socket_ip, this.socket_port);
	}

	getNetwork() {
		return this._network || undefined;
	}

	getServer() {
		return this._server || undefined;
	}

	getDomain() {
		return this._domain || undefined;
	}

	setServer(domain = undefined, network = undefined, server = undefined, ends_at = undefined) {
		this._network = network;
		this._server = server;
		this._domain = domain;
		this.sendPacket(new UpdateServerPacket(network, server, ends_at));
	}
}
module.exports = RPCUser;