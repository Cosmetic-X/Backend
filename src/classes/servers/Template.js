/*
 * Copyright (c) Jan Sohn / xxAROX
 * All rights reserved.
 * I don't want anyone to use my source code without permission.
 */

const {Server} = require("./Server");
const {SnowflakeUtil} = require("discord.js");
/**
 * Class Template
 * @author Jan Sohn / xxAROX
 * @date 07.05.2022 - 16:04
 * @project Backend
 */
class Template {
	enabled;
	name;
	display_name;
	type;
	maintained;
	image;

	folder;

	/**
	 * @param {Team} team
	 * @param {boolean} enabled
	 * @param {string} name
	 * @param {string} display_name
	 * @param {string} type
	 * @param {string} id_format
	 * @param {boolean} maintained
	 * @param {null|string} image
	 */
	constructor({ team, enabled, name, display_name, type, id_format, maintained, image }) {
		this.enabled = enabled;
		this.name = name;
		if (!LIB.fs.existsSync(serverManager.templates_folder(name.toLowerCase()))) {
			if (LIB.fs.existsSync(serverManager.templates_folder(name))) {
				LIB.fs.renameSync(serverManager.templates_folder(name), serverManager.templates_folder(name.toLowerCase()));
			} else {
				LIB.fs.mkdirSync(serverManager.templates_folder(name.toLowerCase()), { recursive: true });
				console.log(`Created template folder for ${name}`);
			}
		}
		this.folder = (...file_or_dirs) => serverManager.templates_folder(name.toLowerCase(), ...file_or_dirs);
		this.id_format = (id) => id_format.replace("%ID%", id);
		this.display_name = display_name;
		this.type = type;
		this.maintained = maintained;
		this.image = image;
	}

	#bootServer() {
		if (!LIB.fs.existsSync(serverManager.Software)) {
			throw new Error(`Software folder not found at ${serverManager.Software}`);
		}
		let server = new Server(this, this.id_format(SnowflakeUtil.generate(Date.now())), serverManager.randomPort());
		server.createFiles();
		server.start();
		return server;
	}

	startServer() {
		let server = this.#bootServer();
	}
}
module.exports.Template = Template;
