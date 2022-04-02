/*
 * Copyright (c) Jan Sohn / xxAROX
 * All rights reserved.
 * I don't want anyone to use my source code without permission.
 */
const dgram = require("dgram");
const Discord = require("discord.js");
const RPCUser = require("../classes/RPCUser.js");
const Serializer = require("rpc-protocol/src/Serializer.js");
const PacketPool = require("rpc-protocol/src/PacketPool.js");
const UnknownPacket = require("rpc-protocol/src/packets/UnknownPacket.js");
const ConnectPacket = require("rpc-protocol/src/packets/ConnectPacket.js");
const DisconnectPacket = require("rpc-protocol/src/packets/DisconnectPacket.js");
const HeartbeatPacket = require("rpc-protocol/src/packets/HeartbeatPacket.js");
const UpdateServerPacket = require("rpc-protocol/src/packets/UpdateServerPacket.js");

class WebSocketServer {
	constructor(bind_port) {
		// Collection<ip:port, RPCUser>
		this._connected_clients = new Discord.Collection();
		// Collection<ip:port, float>
		this._heartbeats = new Discord.Collection();

		this.server = dgram.createSocket("udp4");
		this.server.on("message", (buffer, remoteInfo) => this.#onMessage(buffer, remoteInfo));
		this.server.on("listening", () => console.log("RPC-Socket is listening on " + this.server.address().family + " " + this.server.address().address + ":" + this.server.address().port));
		this.server.on("error", (err) => console.error(err));
		this.server.on("close", () => console.log("Socket closed"));
		this.server.bind(bind_port);

		setInterval(() => {
			this._heartbeats.forEach((last_heartbeat, ipport) => {
				if (last_heartbeat +5 < time()) {
					let rpc_user = this._connected_clients.get(ipport);
					this._heartbeats.delete(ipport);
					this._connected_clients.delete(ipport);
					console.log(rpc_user.gamertag + " has disconnected due to timeout");
				}
			});
		}, 500);
	}

	/**
	 * @param {string} gamertag
	 * @return {null|RPCUser}
	 */
	getRPCUser(gamertag) {
		return this._connected_clients.find(rpc_user => rpc_user.gamertag === gamertag);
	}

	disconnect(rpc_user, reason) {
		rpc_user.sendPacket(new DisconnectPacket(reason));
		let ipport = rpc_user.ip + ":" + rpc_user.port;
		let gamertag = this._connected_clients.get(ipport);
		this._heartbeats.delete(ipport);
		this._connected_clients.delete(ipport);
		console.log(gamertag + " has disconnected. Reason: " + reason);
	}

	sendPacket(packet, ip, port) {
		if (!this._connected_clients[ ip + ":" + port ]) {
			return;
		}
		let serializer = Serializer.getSerializer();
		packet.encode(serializer);
		let buffer = serializer.getBuffer();
		try {
			console.log("Sent packet to " + ip + ":" + port);
			this.server.send(buffer, 0, buffer.length, port, ip, (err) => {
				if (err) {
					console.error(err);
				}
			});
		} catch (e) {
			console.error("Couldn't send packet " + packet.getPacketId());
			console.error(e);
		}
	}

	#onMessage(buffer, remoteInfo) {
		try {
			let serializer = Serializer.getSerializer(buffer.toString());
			let packet = PacketPool.getInstance().getPacket(serializer.getBuffer());
			packet.decode(serializer);

			if (packet instanceof ConnectPacket) {
				let user = new RPCUser(packet.gamertag, remoteInfo.address, remoteInfo.port);
				this._connected_clients.set(remoteInfo.address + ":" + remoteInfo.port, user);
				console.log(user.gamertag + "[" + remoteInfo.address + ":" + remoteInfo.port + "] connected");
				user.setServer("domain.tld", "Test Network", "PocketMine-MP Server");// DEBUG: for tests
			} else {
				let rpc_user = this._connected_clients.get(remoteInfo.address + ":" + remoteInfo.port);
				if (rpc_user) {
					if (packet instanceof UnknownPacket) {
						console.log("Received unknown packet(" + packet.getPacketId() + ") from " + rpc_user.gamertag);
					} else if (packet instanceof HeartbeatPacket) {
						this._heartbeats.set(remoteInfo.address + ":" + remoteInfo.port, time());
					} else if (packet instanceof UpdateServerPacket) {
					} else {
						console.log("Received unhandled packet(" + packet.getPacketId() + ") from " + rpc_user.gamertag);
					}
				}
			}
		} catch (e) {
			console.error("Error while parsing packet from " + remoteInfo.address + ":" + remoteInfo.port);
			console.error(e);
		}
	}

}
module.exports = WebSocketServer;
