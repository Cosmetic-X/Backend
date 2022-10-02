/*
 * Copyright (c) Jan Sohn / xxAROX
 * All rights reserved.
 * I don't want anyone to use my source code without permission.
 */

module.exports = {
	name: 'reload',
	description: 'Reload database.',
	aliases: ['rl'],
	execute: function (args) {
		console.log("Reloading database..".blue);
		db.load();
		console.log("Database reloaded!".green);
	}
}
