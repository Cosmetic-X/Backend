/*
 * Copyright (c) Jan Sohn / xxAROX
 * All rights reserved.
 * I don't want anyone to use my source code without permission.
 */

const {getTempFilename} = require("express-fileupload/lib/utilities");
/**
 * Class Server
 * @author Jan Sohn / xxAROX
 * @date 07.05.2022 - 15:35
 * @project Backend
 */
class Server {
	public_visibility = ServerVisibility.private;
	online_state = ServerState.offline;
	backend_properties = {
		AuthToken: serverManager.AuthToken,
		backend_address: "127.0.0.1",
		backend_port: serverManager.server?.bind_port,
	};

	running = false;
	killed = false;

	/**
	 * @param {Template}Template
	 * @param {string} identifier
	 * @param {number} port
	 */
	constructor(Template, identifier, port) {
		this.template = Template;
		this.identifier = identifier;
		this.port = port;
		this.folder = (...file_or_dirs) => serverManager.running_folder(identifier, ...file_or_dirs);
	}

	isTmuxSession() {
		let result = LIB.child_process.execSync(`tmux has-session -t ${this.identifier}`).toString();
		return result.startsWith("can't find session") || result.includes("no server running on ");
	}

	getId() {
		return this.identifier;
	}

	async query() {
		try {
			let data = await LIB.mcpedb("0.0.0.0", this.port);
			console.log(typeof data === "object");
			data = await LIB.mcpedb("ryzer.xxx", 19132);
			console.log(data, typeof data === "object");
		} catch(err) {
			console.log("An error occurred!\n " + err.message);
		}
	}

	async createFiles() {
		this.online_state = ServerState.starting;
		if (!LIB.fs.existsSync(this.folder())) LIB.fs.mkdirSync(this.folder(), {recursive: true});
		if (!LIB.fs.existsSync(serverManager.Software)) throw new Error("[Server] ".green + "[" + this.identifier + "] Could not find the software in '" + serverManager.Software + "'!");

		// NOTE: pocketmine.yml BEGINS HERE
		let pocketmine_yml = LIB.path.join(serverManager.servers_folder(), "pocketmine.yml");
		if (!LIB.fs.existsSync(pocketmine_yml)) console.error("[Server] ".green + "[" + this.identifier + "] Could not find pocketmine.yml");
		else LIB.fs.copyFileSync(this.folder("pocketmine.yml"), pocketmine_yml);
		// NOTE: pocketmine.yml ENDS HERE

		// NOTE: backend.json BEGINS HERE
		LIB.fs.writeFileSync(this.folder("backend.json"), JSON.stringify(this.backend_properties, null, 4));
		// NOTE: backend.json ENDS HERE

		// NOTE: start_script BEGINS HERE
		let start_script = undefined;
		if (LIB.os.platform() === "win32") {
			LIB.fs.writeFileSync(start_script = this.folder("start.bat"), "php " + serverManager.Software + (TEST_MODE ? " --test" : "") + " --no-wizard" + (DEBUG_MODE ? " --debug" : ""));
		}
		if (LIB.os.platform() === "darwin") throw new Error("[Server] ".green + "[" + this.identifier + "] MacOS is not supported yet!");
		else if (LIB.os.platform() === "linux") {
			let php = serverManager.servers_folder("bin", "php7", "bin", "php");
			if (!LIB.fs.existsSync(php)) {
				throw new Error("Could not find the php binary in '" + php + "'!");
			}
			LIB.fs.writeFileSync(start_script = this.folder("start.sh"), php + " " + serverManager.Software + (TEST_MODE ? " --test" : "") + " --no-wizard" + (DEBUG_MODE ? " --debug" : ""));
		} else {
			throw new Error("Your operating system is not supported!");
		}
		if (start_script) {
			LIB.fs.chmodSync(start_script, 0o777);
		} else {
			throw new Error("Could not create start.bat or start.sh!");
		}
		this.start_script = start_script;
		// NOTE: start_script ENDS HERE

		// NOTE: server.properties BEGINS HERE
		LIB.fs.writeFileSync(this.folder("server.properties"), "#Properties Config file\n" +
			"language=eng\n" +
			"motd=" + this.template.display_name  +"\n" +
			"server-id=" + this.identifier + "\n" +
			"server-port=" + this.port  +"\n" +
			"server-portv6=" + this.port  +"\n" +
			"enable-ipv6=off\n" +
			"white-list=off\n" +
			"max-players=100\n" +
			"gamemode=adventure\n" +
			"force-gamemode=on\n" +
			"hardcore=off\n" +
			"pvp=on\n" +
			"difficulty=0\n" +
			"generator-settings=\n" +
			"level-name=world\n" +
			"level-seed=\n" +
			"level-type=DEFAULT\n" +
			"enable-query=on\n" +
			"auto-save=on\n" +
			"view-distance=16\n" +
			"xbox-auth=off\n"
		);
		// NOTE: server.properties ENDS HERE
		console.log("[Server] ".green + "[" + this.identifier + "] Created files");
	}

	start() {
		console.log("[Server] ".green + "[" + this.identifier + "] Starting...");
		if (!this.start_script) throw new Error("[Server] ".green + "[" + this.identifier + "] Could not start the server, because the start script is not defined!");
		let e;
		if (LIB.os.platform() === "darwin") throw new Error("[Server] ".green + "[" + this.identifier + "] MacOS is not supported!");
		if (LIB.os.platform() === "win32") LIB.child_process.exec("cd " + this.folder() + " && start start.bat");
		else if (LIB.os.platform() === "linux") LIB.child_process.exec("cd " + this.folder() + " && ./start.sh");
		this.running = true;
		console.log("[Server] ".green + "[" + this.identifier + "] Started");
	}

	kill() {
		if (this.killed) throw new Error("[Server] ".green + "[" + this.identifier + "] Could not kill the server, because it is already killed!");
		if (!this.running) throw new Error("[Server] ".green + "[" + this.identifier + "] Could not kill the server, because it is not running!");

		console.log("[Server] ".green + "[" + this.identifier + "] Killing server...");
		if (!this.start_script) throw new Error("[Server] ".green + "[" + this.identifier + "] Could not kill the server, because the start script is not defined!");
		if (LIB.os.platform() === "win32") LIB.child_process.exec("taskkill /F /IM " + LIB.fs.readFileSync(this.folder("server.lock")).toString().trim());
		else if (LIB.os.platform() === "linux") {
			LIB.child_process.exec("killall -9 " + LIB.fs.readFileSync(this.folder("server.lock")).toString().trim());
			if (this.isTmuxSession()) LIB.child_process.exec("tmux kill-session -t " + this.identifier);
		}
		else throw new Error("Your operating system is not supported!");
		this.running = false;
		this.killed = true;
	}

	deleteFiles() {
		console.log("[Server] ".green + "[" + this.identifier + "] Deleting files...");
		LIB.fs.unlinkSync(this.folder());
		console.log("[Server] ".green + "[" + this.identifier + "] Deleted files!");
	}

	async executeCommand(command) {
		if (!this.start_script) throw new Error("[Server] ".green + "[" + this.identifier + "] Could not execute the command, because the start script is not defined!");
		if (!this.running) throw new Error("[Server] ".green + "[" + this.identifier + "] Could not execute the command, because the server is not running!");

		if (LIB.os.platform() === "win32") throw new Error("[Server] ".green + "[" + this.identifier + "] Executing commands is not supported on windows!");
		else if (LIB.os.platform() === "darwin") throw new Error("[Server] ".green + "[" + this.identifier + "] Executing commands is not supported on macos!");
		else if (LIB.os.platform() === "linux") return LIB.child_process.exec("" + this.start_script + " " + command);
		else throw new Error("Your operating system is not supported!");
	}

	stop(reason) {
		let timeout = setTimeout(() => this.kill(), 1000 * 7);
		let done = this.executeCommand(reason ? "stop " + reason : "stop").then(() => clearTimeout(timeout));
	}
}
module.exports.Server = Server;
