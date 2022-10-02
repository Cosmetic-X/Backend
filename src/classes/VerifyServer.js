/*
 * Copyright (c) Jan Sohn / xxAROX
 * All rights reserved.
 * I don't want anyone to use my source code without permission.
 */

/**
 * Class VerifyServer
 * @author Jan Sohn / xxAROX
 * @date 02.08.2022 - 18:08
 * @project Backend
 */
process.env.DEBUG = 'minecraft-protocol';
class VerifyServer {
	constructor(bind_port = 19132, bind_ip = "0.0.0.0", motd = "§eVerification Server§r") {
		this.bind_ip = bind_ip;
		this.bind_port = bind_port;
		this.server = LIB.bedrockProtocol.createServer({
			host: this.bind_ip,
			port: this.bind_port,
			maxPlayers: 1,
			motd: "§dCosmetic-X§r",
			levelName: motd,
			offline: false,
			version: "1.19.30"
		});
		process.on("exit", function () {this.stop();}.bind(this));
		this.server.on('connect', (player) => {
			player.on('login', () => {
				const minutes = 10;
				const code = db.verify.activate(player.username, minutes);
				if (code instanceof Error) {
					player.disconnect(code.message);
				} else {
					player.disconnect(
						"§aPlease execute §9'§e/verify "+player.username+" "+code+"§9'§a on our discord.§r\n" +
						"§a§o§nThis code is valid for "+minutes+" minutes.§r"
					);
				}
			})
		})
	}

	start() {
		/*try {
			this.server.listen();
		} catch (e) {
			console.error(e);
		}*/
	}

	stop() {
		this.server.close("Backend shutdown.");
	}
}
module.exports.VerifyServer = VerifyServer;
