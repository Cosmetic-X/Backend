/*
 * Copyright (c) Jan Sohn / xxAROX
 * All rights reserved.
 * I don't want anyone to use my source code without permission.
 */

class RPCUser {
	gamertag = null;
	socket_ip = null;
	socket_port = null;
	
	constructor(gamertag, socket_ip, socket_port) {
		this.gamertag = gamertag;
		this.socket_ip = socket_ip;
		this.socket_port = socket_port;
	}

	sendPacket(packet) {
		WebSocketServer.sendPacket(packet, this.socket_ip, this.socket_port);
	}
}
module.exports = RPCUser;