/*
 * Copyright (c) Jan Sohn / xxAROX
 * All rights reserved.
 * I don't want anyone to use my source code without permission.
 */
const dgram = require("dgram");
const Discord = require("discord.js");
const Serializer = require("rpc-protocol/src/Serializer.js");
const PacketPool = require("rpc-protocol/src/PacketPool.js");
const UnknownPacket = require("rpc-protocol/src/packets/UnknownPacket.js");
const ConnectPacket = require("rpc-protocol/src/packets/ConnectPacket.js");
const HeartbeatPacket = require("rpc-protocol/src/packets/HeartbeatPacket.js");
const UpdateNetworkPacket = require("rpc-protocol/src/packets/UpdateNetworkPacket.js");
const UpdateServerPacket = require("rpc-protocol/src/packets/UpdateServerPacket.js");


class WebSocketServer {
	constructor(bind_port) {
		this._connected_clients = new Discord.Collection();
		this._heartbeats = new Discord.Collection();
		this.server = dgram.createSocket("udp4");
		this.server.on("message", (buffer, remoteInfo) => {
			this.#onMessage(buffer, remoteInfo);
		});
		this.server.on("listening", () => {
			let address = this.server.address();
			let port = this.server.address().port;
			let family = this.server.address().family;
			let ipaddr = this.server.address().address;
			console.log("RPC-Socket is listening on port " + ipaddr + ":" + port);
		});
		this.server.on("error", (err) => console.error(err));
		this.server.on("close", () => console.log("Socket closed"));
		this.server.bind(bind_port);
	}

	sendPacket(packet, gamertag) {
		if (!this._connected_clients[gamertag]) {
			return;
		}
		let serializer = Serializer.getSerializer();
		packet.encode(serializer);
		let buffer = serializer.getBuffer();
		try {
			this.server.send(buffer, 0, buffer.length, this._connected_clients[gamertag].split(":")[1], this._connected_clients[gamertag].split(":")[0]);
		} catch (e) {
			console.error("Couldn't send packet " + packet.getPacketId());
			console.error(e);
		}
	}

	#onMessage(buffer, remoteInfo) {
		let packet = PacketPool.getInstance().getPacket(buffer);
		if (packet instanceof ConnectPacket) {
			this._connected_clients.set(packet.gamertag, remoteInfo.address + ":" + remoteInfo.port);
			console.log("Client connected: " + packet.gamertag);
		} else if (packet instanceof HeartbeatPacket) {
			this._heartbeats.set(packet.gamertag, time());
		} else if (
			packet instanceof UpdateNetworkPacket
			|| packet instanceof UpdateServerPacket
		) {
		} else if (packet instanceof UnknownPacket) {
			console.log("Received unknown packet from " + remoteInfo.address + ":" + remoteInfo.port);
		}
	}

}
module.exports = WebSocketServer;
