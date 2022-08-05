/*
 * Copyright (c) Jan Sohn / xxAROX
 * All rights reserved.
 * I don't want anyone to use my source code without permission.
 */
const net = require("net");
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

		let server = this;
		this._server = net.createServer(function (socket) {
			let interval = setInterval(() => {
				server.sendPacket(new HeartbeatPacket(), socket);
			}, 1000 * 10);
			socket.on("data", (data) => {
				server.#onMessage(data.toString(), socket);
			});
			socket.on("error", (e) => {
				console.error(e);
			});
			socket.on("close", () => {
				clearInterval(interval);
				server._connected_clients.delete(socket.remoteAddress + ":" + socket.remotePort);
				server._heartbeats.delete(socket.remoteAddress + ":" + socket.remotePort);
			});
		});
		//this._server.on("data", (buffer, remoteInfo) => this.#onMessage(buffer, remoteInfo));
		this._server.on("listening", () => console.log("[RPC] " + "RPC-Socket is listening on port " + bind_port + "."));
		this._server.on("error", (err) => console.error(err));
		this._server.on("close", () => console.log("[RPC] " + "Socket closed"));
		this._server.listen(bind_port);

		setInterval(() => {
			this._heartbeats.forEach((last_heartbeat, ipport) => {
				if (last_heartbeat +5 < time()) {
					let rpc_user = this._connected_clients.get(ipport);
					this._heartbeats.delete(ipport);
					this._connected_clients.delete(ipport);
					console.log("[RPC] " + rpc_user.gamertag + " has disconnected due to timeout");
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

	sendPacket(packet, user_or_socket) {
		let serializer = Serializer.getSerializer();
		packet.encode(serializer);
		let buffer = serializer.getBuffer();
		try {
			(user_or_socket instanceof RPCUser ? user_or_socket.getSocket() : user_or_socket).write(buffer);
		} catch (e) {
			console.error("Couldn't send packet " + packet.getPacketId());
			console.error(e);
		}
	}

	#onMessage(buffer, socket) {
		try {
			let serializer = Serializer.getSerializer(buffer.toString());
			let packet = PacketPool.getInstance().getPacket(serializer.getBuffer());
			packet.decode(serializer);

			if (packet instanceof ConnectPacket) {
				let user = new RPCUser(packet.gamertag, socket.remoteAddress, socket.remotePort);
				this._connected_clients.set(socket.remoteAddress + ":" + socket.remotePort, user);
				user.setSocket(socket);
				console.log(user.gamertag + "[" + socket.remoteAddress + ":" + socket.remotePort + "] connected");

				user.setServer("Local Server Network", "PocketMine-MP Server");// DEBUG: for tests
			} else {
				let rpc_user = this._connected_clients.get(socket.remoteAddress + ":" + socket.remotePort);
				if (rpc_user) {
					if (packet instanceof UnknownPacket) {
					} else if (packet instanceof HeartbeatPacket) {
						this._heartbeats.set(socket.remoteAddress + ":" + socket.remotePort, time());
					} else if (packet instanceof UpdateServerPacket) {
						//NOTE: ignore
					} else {
						console.log("Received unhandled packet(" + packet.getPacketId() + ") from " + rpc_user.gamertag);
					}
				}
			}
		} catch (e) {
			console.error("Error while parsing packet from " + socket.remoteAddress + ":" + socket.remotePort);
			console.error(e);
		}
	}

}
module.exports = WebSocketServer;
