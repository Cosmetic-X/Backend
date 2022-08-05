/*
 * Copyright (c) Jan Sohn / xxAROX
 * All rights reserved.
 * I don't want anyone to use my source code without permission.
 */
const {Collection, Client} = require("discord.js"); //NOTE: only for testing
client = new Client; //NOTE: only for testing
client.servers = new Collection();

client.on('ready', () => {
	client.guilds.cache.map(async guild => {
		const findGuild = await guildDB.findOne({guildId: guild.id});
		if (!findGuild) {
			await guildDB.create({guildId: guild.id});
			client.servers.set(guild.id, {
				channels: [],
				category: '',
				create: '',
			});
		} else {
			client.servers.set(guild.id, {
				channels: [],
				category: findGuild.categoryId,
				create: findGuild.createId,
			});
		}
	});
});


const savedGuild = client.servers.get(newStatus.channel.guild.id);
if (!savedGuild) {
	return;
} // Not found
if (savedGuild.create === "") {
	return;
} // No create channel given
if (newStatus.channel.id !== savedGuild.create) { // user joins not in the 'create channel' channel
	const pvChannel = savedGuild.channels[ newStatus.member.id ]; // falls es so abgespeichet wird
} else {
	// Create new private channel for the user in category with SnowflakeID 'savedGuild.create'
}