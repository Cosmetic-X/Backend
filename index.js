/*
 * Copyright (c) Jan Sohn / xxAROX
 * All rights reserved.
 * I don't want anyone to use my source code without permission.
 */

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
	require("./src/index.js");
} catch (e) {
	console.error(e);
}
