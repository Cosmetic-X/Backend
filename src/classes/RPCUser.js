/*
 * Copyright (c) Jan Sohn / xxAROX
 * All rights reserved.
 * I don't want anyone to use my source code without permission.
 */
const UpdateServerPacket = require("rpc-protocol/src/packets/UpdateServerPacket.js");

class RPCUser {
	gamertag = null;
	socket = null;

	constructor(gamertag, socket) {
		this.gamertag = gamertag;
		this.socket = socket;
	}

	disconnect(reason) {
		WebSocketServer.disconnect(this, reason);
	}

	sendPacket(packet) {
		console.log("[RPC] " + "[RPCUser:" + this.gamertag + "] Sending packet(ID: " + packet.getPacketId() + ") to " + this.socket.remoteAddress + ":" + this.socket.remotePort);
		WebSocketServer.sendPacket(packet, this);
	}

	getSocket() {
		return this.socket;
	}

	setSocket(socket) {
		this.socket = socket;
	}

	getNetwork() {
		return this._network || undefined;
	}

	getServer() {
		return this._server || undefined;
	}

	setServer(network = undefined, server = undefined, ends_at = undefined) {
		this._network = network;
		this._server = server;
		this.sendPacket(new UpdateServerPacket(network, server, ends_at));
	}
}
module.exports = RPCUser;