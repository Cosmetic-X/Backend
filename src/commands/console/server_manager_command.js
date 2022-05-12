/*
 * Copyright (c) Jan Sohn / xxAROX
 * All rights reserved.
 * I don't want anyone to use my source code without permission.
 */

module.exports = {
	name: 'servermanager',
	description: 'Server Manager',
	aliases: ['sm'],
	execute: function (args) {
		if (!args[0]) {
			//TODO: help
			return;
		}
		switch (args[0]) {
			case 'server':
				if (!args[1]) {
					console.log('Usage: '.red + 'servermanager server help');
				} else {
					switch (args[1]) {
						case 'help':
						case '?':
							console.log('Usage: '.red + 'servermanager server help');
							console.log('Usage: '.red + 'servermanager server list [template]');
							console.log('Usage: '.red + 'servermanager server start <template> [team]');
							console.log('Usage: '.red + 'servermanager server stop <id|template>');
							console.log('Usage: '.red + 'servermanager server restart <id>');
							break;
						case 'list':
						case 'ls':
							let servers;
							if (!args[2]) {
								servers = serverManager.servers;
							} else {
								servers = serverManager.servers.filter((server) => server.template.name.toLowerCase() === args[2].toLowerCase());
							}
							term.table([
								['ID', 'Template', 'Team', 'Status', 'Online players', 'Port'],
								...servers.map((server) => {
									return [
										server.identifier,
										server.template.name,
										server.team.name,
										server.online_state,
										server.player_count,
										server.port,
									];
								})
							]);
							break;
					}
				}
				break;
			case 'template':
				if (!args[1]) {
					console.log('Usage: '.red + 'servermanager template help');
				} else {
				}
				break;
		}
	}
}
