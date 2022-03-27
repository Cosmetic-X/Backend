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
const UpdateNetworkPacket = require("rpc-protocol/src/packets/UpdateNetworkPacket.js");
const UpdateServerPacket = require("rpc-protocol/src/packets/UpdateServerPacket.js");

class WebSocketServer {
	constructor(bind_port) {
		// Collection<ip:port, GAMERTAG>
		this._connected_clients = new Discord.Collection();
		// Collection<GAMERTAG, RPCUser>
		this._connected_gamertags = new Discord.Collection();
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
					let gamertag = this._connected_clients.get(ipport);
					this._heartbeats.delete(ipport);
					this._connected_gamertags.delete(gamertag);
					this._connected_clients.delete(ipport);
					console.log(gamertag + " has disconnected due to timeout");
				}
			});
		}, 500);
	}

	/**
	 * @param {string} gamertag
	 * @return {null|RPCUser}
	 */
	getRPCUser(gamertag) {
		return this._connected_gamertags.get(gamertag);
	}

	disconnect(rpc_user, reason) {
		rpc_user.sendPacket(new DisconnectPacket(reason));
		let ipport = rpc_user.ip + ":" + rpc_user.port;
		let gamertag = this._connected_clients.get(ipport);
		this._heartbeats.delete(ipport);
		this._connected_gamertags.delete(gamertag);
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
			this.server.send(buffer, 0, buffer.length, port, ip);
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

			if (packet instanceof UnknownPacket) {
				console.log("Received unknown packet from " + remoteInfo.address + ":" + remoteInfo.port);
			} else if (packet instanceof ConnectPacket) {
				this._connected_clients.set(remoteInfo.address + ":" + remoteInfo.port, packet.gamertag);
				this._connected_gamertags.set(packet.gamertag, new RPCUser(packet.gamertag, remoteInfo.address, remoteInfo.port));
				console.log(packet.gamertag + " connected");
			} else {
				if (this._connected_clients.get(remoteInfo.address + ":" + remoteInfo.port)) {
					if (packet instanceof HeartbeatPacket) {
						if (this._connected_clients.get(remoteInfo.address + ":" + remoteInfo.port)) {
							this._heartbeats.set(this._connected_clients.get(remoteInfo.address + ":" + remoteInfo.port), time());
						}
					} else if (
						packet instanceof UpdateNetworkPacket
						|| packet instanceof UpdateServerPacket
					) {
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
