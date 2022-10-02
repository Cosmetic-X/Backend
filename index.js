/*
 * Copyright (c) Jan Sohn / xxAROX
 * All rights reserved.
 * I don't want anyone to use my source code without permission.
 */
console.log("[INFO] Loading..");
const LanguageManager = require("./src/classes/language/LanguageManager");
global.config = require("./resources/config.json");
global.pkg = require("./package.json");
global.TEST_MODE = process.env.USERNAME === "kfeig";
global.DEBUG_MODE = false;
global.COSMETICX_LINK = TEST_MODE ? "http://localhost:" + config.express_server.port : "https://cosmetic-x.de";

global.LIB = {
	fs: require("node:fs"),
	fse: require("fs-extra"),
	path: require("path"),
	os: require("node:os"),
	child_process: require("child_process"),
	crypto: require("node:crypto"),
	express: require("express"),
	jwt: require("jsonwebtoken"),
	libquery: () => new Error("libquery is deprecated and will be removed in the future."),
	net: require("node:net"),
	properties_reader: require("properties-reader"),
	promisify: require("util").promisify,
	discord: require("discord.js"),
	bedrockProtocol: require("bedrock-protocol"),
};
global.languageManager = LanguageManager;
LanguageManager.getInstance();

global.time = function () {
	return (new Date().getTime() / 1000);
};
global.BaseEmbed = () => new LIB.discord.EmbedBuilder().setFooter({text:COSMETICX_GUILD.name, icon_url:COSMETICX_ICON_URL}).setTimestamp(Date.now());
String.prototype.shuffle = function () {
	let a = this.split("");
	let n = a.length;
	for (let i = n - 1; i > 0; i--) {
		let j = Math.floor(Math.random() * (i + 1));
		let tmp = a[ i ];
		a[ i ] = a[ j ];
		a[ j ] = tmp;
	}
	return a.join("");
};

try {
	console.log("[INFO] Starting up..");
	require("./src/index.js");
} catch (e) {
	console.error(e);
}
