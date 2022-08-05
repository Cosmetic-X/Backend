/*
 * Copyright (c) Jan Sohn / xxAROX
 * All rights reserved.
 * I don't want anyone to use my source code without permission.
 */

module.exports = {
	name: 'language',
	description: 'Language command.',
	aliases: ['lang'],
	execute: function (args) {
		if (args.length === 1 && args[0].toLowerCase() === "reload") {
			languageManager.getInstance().reloadLanguages();
		}
	}
}
