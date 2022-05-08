/*
 * Copyright (c) Jan Sohn / xxAROX
 * All rights reserved.
 * I don't want anyone to use my source code without permission.
 */
const Discord = require("discord.js");
const {SSocket} = require("./SSocket");
const {Server} = require("./Server");
const {Template} = require("./Template");

/**
 * Class ServerManager
 * @author Jan Sohn / xxAROX
 * @date 07.05.2022 - 15:11
 * @project Backend
 */
class ServerManager {
	/** @type {SSocket} */
	server;
	/** @type {Discord.Collection<string, Server>} */
	servers = new Discord.Collection();
	/** @type {Discord.Collection<string, Template>} */
	templates = new Discord.Collection();
	/** @type {string} */
	Software = this.servers_folder("PocketMine-MP.phar");
	/** @type {string} */
	AuthToken = LIB.jwt.sign({auth: "X_X_A_R_O_X",random: generateId(16)}, "secret", {expiresIn: -1});
	/** @type {string} */
	address;

	templates_folder(...files_or_dirs) {
		return this.servers_folder("templates", ...files_or_dirs);
	}

	running_folder(...files_or_dirs) {
		return this.servers_folder(".running", ...files_or_dirs);
	}

	servers_folder(...files_or_dirs) {
		return LIB.path.join(__dirname + "/../../../resources/servers/", ...files_or_dirs);
	}

	randomPort() {
		let ports = [];
		for (let server of this.servers.values()) {
			ports.push(server.port);
		}
		let port = Math.floor(Math.random() * (65535 - 1024)) + 1024;
		while (ports.includes(port)) {
			port = Math.floor(Math.random() * (65535 - 1024)) + 1024;
		}
		return port;
	}

	constructor(bind_port) {
		this.bind_port = bind_port;

		this.address = undefined;
		for (let dev in LIB.os.networkInterfaces()) {
			let  _interface = LIB.os.networkInterfaces()[dev].filter((details) => details.family === 'IPv4' && details.internal === false);
			if (_interface.length > 0) this.address = _interface[0].address;
		}

		console.log("[ServerManager] ".blue + "Starting...");
		this.server = new SSocket(this.bind_port);
		this.server.start();
		console.log("[ServerManager] ".blue + " Started!");
		process.on("exit", () => {
			this.servers.forEach((server) => {
				server.stop();
			});
		});
		this.clearRunningFolder();
		this.loadTemplates();
	}

	clearRunningFolder() {
		console.log("[ServerManager] ".blue + "Clearing running folder...");
		for (let file of LIB.fs.readdirSync(this.running_folder())) {
			LIB.fs.rmSync(this.running_folder(file), {recursive: true});
			console.log("[ServerManager] ".blue + "Deleted " + file);
		}
		console.log("[ServerManager] ".blue + "Cleared running folder!");
	}

	async loadTemplates() {
		console.log("[ServerManager] ".blue + "Loading templates...");
		this.templates.clear();
		let templates = JSON.parse(LIB.fs.readFileSync(this.servers_folder("templates.json")).toString());
		for (let template of templates) {
			template.team = await db.teams.getCosmeticXTeam();
			this.templates.set(template.name, template = new Template(template));
			if (template.type !== ServerType.game) {
				template.startServer();
			}
		}
		console.log("[ServerManager] ".blue + "Loaded " + this.templates.size + " template" + (this.templates.size === 1 ? "" : "s") + "!");
	}
}
class ServerType {
	static lobby = "Lobby";
	static game = "Game";
	static builder = "Builder";
	static developer = "Developer";
}
class GameState {
	static lobby = "Lobby";
	static starting = "Starting";
	static running = "Running";
	static ending = "Ending";
}
class ServerState {
	static offline = "Offline";
	static starting = "Starting";
	static online = "Online";
}
class ServerVisibility {
	static public = "Public";
	static private = "Private";
}
module.exports.ServerManager = ServerManager;
module.exports.ServerType = ServerType;
module.exports.GameState = GameState;
module.exports.ServerState = ServerState;
module.exports.ServerVisibility = ServerVisibility;
