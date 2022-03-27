/*
 * Copyright (c) Jan Sohn / xxAROX
 * All rights reserved.
 * I don't want anyone to use my source code without permission.
 */
const UpdateNetworkPacket = require("rpc-protocol/src/packets/UpdateNetworkPacket.js");
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
		WebSocketServer.sendPacket(packet, this.socket_ip, this.socket_port);
	}

	getNetwork() {
		return this._network || undefined;
	}

	setNetwork(network = undefined) {
		this._network = network;
		this.sendPacket(new UpdateNetworkPacket(network));
	}

	getServer() {
		return this._server || undefined;
	}

	setServer(server = undefined, ends_at = undefined) {
		this._server = server;
		this.sendPacket(new UpdateServerPacket(server, ends_at));
	}
}
module.exports = RPCUser;