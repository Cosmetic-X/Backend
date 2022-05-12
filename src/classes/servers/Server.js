/*
 * Copyright (c) Jan Sohn / xxAROX
 * All rights reserved.
 * I don't want anyone to use my source code without permission.
 */

const fse = require("fs-extra");
const events = require("events");

/**
 * Class Server
 * @author Jan Sohn / xxAROX
 * @date 07.05.2022 - 15:35
 * @project Backend
 */
class Server {
	static QUERY_TIMEOUT = 5 * 1000;
	static EVENTS = "creating_files" | "created_files" | "boot" |  "started" | "stopping" | "stopped" | "deleting" | "deleted" | "killing" | "killed";

	query_running = false;
	timed_out = false;
	public_visibility = ServerVisibility.private;
	online_state = ServerState.offline;
	backend_properties = {
		AuthToken: serverManager.AuthToken,
		backend_address: "127.0.0.1",
		backend_port: serverManager.server?.bind_port,
	};

	player_count = 0;
	running = false;
	killed = false;

	/**
	 * @param {Template} template
	 * @param {Team} team
	 * @param {string} identifier
	 * @param {number} port
	 */
	constructor(template, team, identifier, port) {
		this.events = new (require("events").EventEmitter)();
		this.template = template;
		this.team = team;
		this.identifier = identifier;
		this.port = port;
		this.folder = (...file_or_dirs) => serverManager.running_folder(identifier, ...file_or_dirs);
		this.backend_properties.identifier = identifier;
		this.backend_properties.template = template.name;
		this.backend_properties.display_name = template.display_name;
		this.backend_properties.image = template.image;
		this.backend_properties.team = team.name;
	}

	async isTmuxSession() {
		// noinspection JSCheckFunctionSignatures
		let {strout, strerr} = await LIB.promisify(require("child_process").exec)(`tmux has-session -t ${this.identifier}`).toString();
		let a =  strout.stdout.startsWith("can't find session") || strout.stdout.includes("no server running on ");
		console.log(a);
		return !a;
	}

	async query() {
		if (!this.running) return;
		if (this.killed) return;
		if (this.timed_out) return;
		if (this.query_running) return;

		if (!(await (async function (server) {
			try {
				let data = await LIB.libquery.query("0.0.0.0", server.port, Server.QUERY_TIMEOUT);
				server.player_count = data.online;
				return true;
			} catch (err) {
				return false;
			} finally {
				server.query_running = false;
			}
		})(this))) {
			this.timed_out = true;
			this.timeout();
		} else {
			this.online_state = ServerState.online;
		}
	}

	timeout() {
		this.online_state = ServerState.offline;
		this.timed_out = true;
		this.query_running = false;
		this.player_count = 404;
		this.stop("Server timed out");
	}

	async createFiles() {
		this.events.emit("creating_files", this);
		this.online_state = ServerState.starting;
		if (!LIB.fs.existsSync(this.folder())) LIB.fs.mkdirSync(this.folder(), {recursive: true});
		if (!LIB.fs.existsSync(serverManager.Software)) throw new Error("[Server] ".green + ("[" + this.identifier + "]").cyan + "".cyan + " Could not find the software in '" + serverManager.Software + "'!");

		// NOTE: backend.json
		(() => {
			LIB.fs.writeFileSync(this.folder("backend.json"), JSON.stringify(this.backend_properties, null, 4));
		})();

		// NOTE: start_script
		(() => {
			let start_script = undefined;
			if (LIB.os.platform() === "win32") {
				let id = generateId(8);
				LIB.fs.writeFileSync(start_script = this.folder("start.bat"), "" +
					"@echo off\n" +
					"title " + id + "\n" +
					"IF EXIST cmd_pid.txt DEL /F cmd_pid.txt\n" +
					"tasklist /FI \"ImageName eq cmd.exe\" /FI \"Status eq Running\" /FI \"WindowTitle eq " + id + "\" /FO csv > cmd_pid.txt\n" +
					"php " + serverManager.Software + (TEST_MODE ? " --test" : "") + " --no-wizard" + (DEBUG_MODE ? " --debug" : "") + "\n" +
					"exit"
				);
			}
			else if (LIB.os.platform() === "darwin") throw new Error("[Server] ".green + ("[" + this.identifier + "]").cyan + " MacOS is not supported yet!");
			else if (LIB.os.platform() === "linux") {
				let php = serverManager.servers_folder("bin", "php7", "bin", "php");
				if (!LIB.fs.existsSync(php)) {
					throw new Error("Could not find the php binary in '" + php + "'!");
				}
				LIB.fs.writeFileSync(start_script = this.folder("start.sh"), php + " " + serverManager.Software + (TEST_MODE ? " --test" : "") + " --no-wizard" + (DEBUG_MODE ? " --debug" : ""));
			}
			else throw new Error("Your operating system is not supported!");

			if (start_script) LIB.fs.chmodSync(start_script, 0o777);
			else throw new Error("Could not create start.bat or start.sh!");

			this.start_script = start_script;
		})();

		// NOTE: server.properties
		(() => {
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
		})();

		// NOTE: [pocketmine.yml, ops.txt, plugins, plugin_data, worlds] folders
		(() => {
			let files = [ "pocketmine.yml", "ops.txt" ];
			let directories = [ "plugins", "plugin_data", "worlds" ];

			for (let file of files) if (LIB.fs.existsSync(serverManager.servers_folder(file))) LIB.fs.copyFileSync(serverManager.servers_folder(file), this.folder(file));
			for (let directory of directories) if (LIB.fs.existsSync(serverManager.servers_folder(directory))) LIB.fse.copySync(serverManager.servers_folder(directory), this.folder(directory));
		})();

		this.events.emit("created_files", this);
		console.log("[Server] ".green + ("[" + this.identifier + "]").cyan + " Created files");
	}

	boot() {
		this.events.emit("boot", this);
		if (LIB.os.platform() === "win32") {
			console.log("[Server] ".green + ("[" + this.identifier + "]").cyan + " Windows is not supported yet!".red);
			return;
		}
		console.log("[Server] ".green + ("[" + this.identifier + "]").cyan + " Starting...");
		if (!this.start_script) throw new Error("[Server] ".green + ("[" + this.identifier + "]").cyan + " Could not start the server, because the start script is not defined!");
		if (LIB.os.platform() === "darwin") throw new Error("[Server] ".green + ("[" + this.identifier + "]").cyan + " MacOS is not supported!");
		else if (LIB.os.platform() === "win32") LIB.child_process.exec("cd " + this.folder() + " && start start.bat && exit") && errorMessage("Console must be closed manually!".bold.underline.italic);
		else if (LIB.os.platform() === "linux") LIB.child_process.exec("cd " + this.folder() + " && tmux new-session -d -s " + this.identifier + " ./start.sh");

		this.interval = setInterval(() => {
			if (LIB.fs.existsSync(this.folder("server.lock"))) {
				this.running = true;
				this.pid = Number.parseInt(LIB.fs.readFileSync(this.folder("server.lock")).toString().trim());

				if (LIB.os.platform() === "win32" && LIB.fs.existsSync(this.folder("cmd_pid.txt"))) {
					this.start_script_pid = LIB.fs.readFileSync(this.folder("cmd_pid.txt")).toString().split("\n")[1].replaceAll("\"", "").split(",")[1];
					LIB.fs.rmSync(this.folder("cmd_pid.txt"));
				}
				clearInterval(this.interval);
				this.afterStart();
			}
		}, 100);
	}

	afterStart() {
		this.events.emit("started", this);
		console.log("[Server] ".green + ("[" + this.identifier + "]").cyan + " PID: " + this.pid + " | Started on port " + this.port.toString().bgYellow.black);
	}

	async executeCommand(command) {
		if (!this.start_script) return console.error("[Important]".bold.red + "[Server] ".green + ("[" + this.identifier + "]").cyan + " Could not execute the command, because the start script is not defined!");
		if (!this.running) return;

		if (LIB.os.platform() === "win32") {
			LIB.child_process.exec('Get-CimInstance Win32_Process -Filter "name = \'cmd.exe\'" | ForEach-Object {\n' +
				'  if ((Get-Process -Id $_.ProcessId).MainWindowTitle -eq \'TEST\') {\n' +
				'    (Invoke-CimMethod -InputObject $_ -MethodName GetOwner).User -eq \'SYSTEM\'\n' +
				'  }\n' +
				'}', {
				shell: "powershell.exe"
			});
			//console.error("[Important] ".bold.red + "[Server] ".green + ("[" + this.identifier + "]").cyan + " Executing commands is not supported on windows!".red);
		}
		else if (LIB.os.platform() === "darwin") console.error("[Important] ".bold.red + "[Server] ".green + ("[" + this.identifier + "]").cyan + " Executing commands is not supported on macos!".red);
		else if (LIB.os.platform() === "linux") {
			let {strout, strerr} = LIB.child_process.exec("" + this.start_script + " " + command);
			return {strout, strerr};
		}
		else console.error("[Error]".bold.red + "[Server] ".green + ("[" + this.identifier + "]").cyan + " Your operating system is not supported!".red);
	}

	stop(reason) {
		this.events.emit("stopping", this);
		let timeout = setTimeout(() => this.kill() && this.deleteFiles(), 1000 * 7);
		let done = this.executeCommand(reason ? "stop " + reason : "stop").then(() => clearTimeout(timeout) && this.deleteFiles());
		this.running = false;
		serverManager.servers.delete(this.identifier);
		console.log("[Server] ".green + ("[" + this.identifier + "]").cyan + " Server stopped with reason: " + reason);
		this.events.emit("stopped", this);
	}

	kill() {
		this.events.emit("killing", this);
		if (!this.start_script) throw new Error("[Server] ".green + ("[" + this.identifier + "]").cyan + " Could not kill the server, because the start script is not defined!");
		if (this.killed) throw new Error("[Server] ".green + ("[" + this.identifier + "]").cyan + " Could not kill the server, because it is already killed!");
		console.log("[Server] ".green + ("[" + this.identifier + "]").cyan + " Killing server...");

		if (LIB.os.platform() === "win32") LIB.child_process.exec("taskkill /F /PID " + this.pid) && LIB.child_process.exec("taskkill /F /PID " + this.start_script_pid);
		else if (LIB.os.platform() === "linux") {
			LIB.child_process.exec("kill -9 " + this.pid);
			if (this.isTmuxSession()) LIB.child_process.exec("tmux kill-session -t " + this.identifier);
		}
		else throw new Error("Your operating system is not supported!");
		this.running = false;
		this.killed = true;
		console.log("[Server] ".green + ("[" + this.identifier + "]").cyan + " Server killed!");
		this.events.emit("killed", this);
	}

	deleteFiles() {
		this.events.emit("deleting", this);
		console.log("[Server] ".green + ("[" + this.identifier + "]").cyan + " Deleting files...");
		LIB.fs.unlinkSync(this.folder());
		console.log("[Server] ".green + ("[" + this.identifier + "]").cyan + " Deleted files!");
		this.events.emit("deleted", this);
		this.events.removeAllListeners();
	}
}
module.exports.Server = Server;
