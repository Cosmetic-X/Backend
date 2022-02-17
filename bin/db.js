/*
 * Copyright (c) 2021-2022. Jan Sohn.
 * All rights reserved.
 * I don't want anyone to use my source code without permission.
 */
const Database = require('better-sqlite3');
const db = new Database('./database.db');
const jwt = require("jsonwebtoken");
const { SnowflakeGenerator } = require('snowflake-generator');
const {in_array} = require("./utils");

let auto_updater = {}, admin = {}, api = {}, user = {}, player = {};


api.getPublicCosmetics = function () {
	let statement = db.prepare("SELECT * FROM public_cosmetics;");
	return statement.all();
}
api.addPublicCosmetic = function (name, display_name, geometryData, skinData) {
	let id = SnowflakeGenerator.generate();
	let statement = db.prepare("INSERT INTO public_cosmetics (id, name, display_name, geometryData, geometryName, skinData) VALUES (?, ?, ?, ?, ?, ?);");
	statement.run(id, name, display_name, geometryData, skinData);
}
api.editPublicCosmetic = function (id, name, geometryData, geometryName, skinData) {
	let statement = db.prepare("UPDATE public_cosmetics SET name=?, geometryData=?, geometryName=?, skinData=? WHERE id=?;");
	statement.run(name, geometryData, geometryName, skinData, id);
}
api.deletePublicCosmetic = function (id) {
	let statement = db.prepare("DELETE FROM public_cosmetics WHERE id=?;");
	statement.run(id);
}
api.getCosmetic = function (id) {
	let statement = db.prepare("SELECT * FROM public_cosmetics WHERE id=?;");
	return statement.all(id);
}
api.getSlotCosmetics = function (username) {
	let statement = db.prepare("SELECT * FROM slot_cosmetics WHERE owner=?");
	return statement.all(username.toLowerCase());
}
api.addSlotCosmetic = function (username, name, display_name, geometryData, geometryName, skinData, image) {
	let statement = db.prepare("INSERT INTO slot_cosmetics (owner, id, name, display_name, geometryData, geometryName, skinData, image) VALUES (?, ?, ?, ?, ?, ?, ?, ?);");
	statement.run(username.toLowerCase(), SnowflakeGenerator.generate(), name, display_name, geometryData, geometryName, skinData, image ?? null);
}
api.editSlotCosmetic = function (id, name, geometryData, geometryName, skinData) {
	let statement = db.prepare("UPDATE slot_cosmetics SET name=?, geometryData=?, geometryName=?, skinData=? WHERE id=?;");
	statement.run(name, geometryData, geometryName, skinData, id);
}
api.deleteSlotCosmetic = function (id) {
	let statement = db.prepare("DELETE FROM slot_cosmetics WHERE id=?;");
	statement.run(id);
}

player.setActiveCosmetics = function (cosmetics, xuid) {
	let statement = db.prepare("REPLACE INTO  stored_cosmetics (active,xuid) VALUES (?, ?);");
	statement.run(JSON.stringify(cosmetics), xuid);
};
player.getActiveCosmetics = function (xuid) {
	let statement = db.prepare("SELECT active FROM stored_cosmetics WHERE xuid=?;");
	let result = statement.get(xuid);
	if (!result || !result.active) {
		return [];
	} else {
		statement = db.prepare("SELECT * FROM public_cosmetics WHERE id=" + JSON.parse(result.active).join(" AND id="));
		return statement.get();
	}
};

user.checkToken = function (token) {
	let statement = db.prepare("SELECT discord_id FROM users WHERE token=?");
	let data = statement.get(token);
	if (data === undefined) {
		return false;
	}
	let member = bot.guilds.cache.first().members.cache.get(data.discord_id);
	if (!member) {
		member = bot.guilds.cache.first().members.fetch(data.discord_id);
		if (!member) {
			return false;
		}
	}
	return member.roles.cache.hasAny(...config.discord.client_roles);
};
user.getByToken = function (token) {
	let statement = db.prepare("SELECT discord_id,username,discriminator,email FROM users WHERE token=?");
	let data = statement.get(token);
	if (data === undefined) {
		return undefined;
	}
	return {username: data.username, display_name:data.username + "#" + data.discriminator, email: data.email};
}
user.getSlotCount = function (discord_id) {
	return db.prepare("SELECT slot_count FROM users WHERE discord_id=?").get(discord_id)["slot_count"] || 0;
}
user.setSlotCount = function (discord_id, amount) {
	db.prepare("UPDATE users SET slot_count=? WHERE discord_id=?").run(amount, discord_id);
}
user.setPremium = async function (discord_id, role_id, value){
	let member = bot.guilds.cache.first().members.cache.get(discord_id);
	if (member && in_array(role_id, config.discord.premium_roles)) {
		if (value) {
			await member.roles.add(role_id);
		} else {
			await member.roles.remove(role_id).catch(console.error);
		}
	}
};
user.getAll = async function () {
	let data = db.prepare("SELECT discord_id,username,discriminator,email,slot_count,token,timestamp FROM users;").all();
	console.log("HURENSOHn");
	let obj = {};

	for (let k in data) {
		let key = (k +1);
		obj[key] = {
			discord_id: data[k].discord_id,
			username: data[k].username,
			discriminator: data[k].discriminator,
			tag: data[k].username + "#" + data[k].discriminator,
			email: data[k].email,
			slot_count: data[k].slot_count,
			creationTime: data[k].timestamp,
			roles: []
		};
		let member = bot.guilds.cache.first().members.cache.get(data[k].discord_id);
		if (!member) {
			member = await bot.guilds.cache.first().members.fetch(data[k].discord_id);
		}
		member.roles.cache.forEach((role) => {
			obj[key].roles[role.id] = {
				name: role.name,
				color: role.color
			}
		});
		obj[key].isAdmin = member.roles.cache.hasAny(...config.discord.admin_roles);
		obj[key].isClient = member.roles.cache.hasAny(...config.discord.client_roles);
		obj[key].isPremium = member.roles.cache.hasAny(...config.discord.premium_roles);
	}
	return obj;
};
user.getData = function (discord_id){
	return db.prepare("SELECT discord_id,username,discriminator,email,slot_count,token,timestamp FROM users WHERE discord_id=?;").get(discord_id);
}
user.resetToken = function (discord_id, expireTimeInSeconds){
	let statement = db.prepare("UPDATE users SET token=? WHERE discord_id=?;");
	statement.run(jwt.sign({discord_id: discord_id}, config.jwt_secret, {expiresIn: (expireTimeInSeconds || 60 * 60 * 24) * 1000}), discord_id);
};
user.register = async function (discord_id, username, discriminator, email) {
	db.prepare('INSERT OR IGNORE INTO users (discord_id, username, discriminator, email, token, timestamp) VALUES (?, ?, ?, ?, ?, ?);')
	.run(discord_id, username, discriminator, email, jwt.sign({discord_id: discord_id}, config.jwt_secret, {expiresIn: 1000 * 60 * 60 * 24}), (new Date().getTime() / 1000));
};
user.delete = function (discord_id) {
	let statement = db.prepare("DELETE FROM users WHERE discord_id=?");
	statement.run(discord_id);
};

auto_updater.updateVersion = function (name, tag, file_name, stream) {
	let statement = db.prepare("INSERT OR REPLACE INTO auto_updater (name, tag, stream, timestamp, file_name) VALUES (?, ?, ?, ?, ?);");
	statement.run(name, tag, stream, (new Date().getTime() / 1000), file_name);
};
auto_updater.getVersions = function (name, tag) {
	if (!name) {
		return db.prepare("SELECT name,tag,timestamp,stream,file_name FROM auto_updater;").all();
	}
	if (!tag) {
		return db.prepare("SELECT name,tag,timestamp,stream,file_name FROM auto_updater WHERE (name=? AND tag=?);").get(name, tag);
	} else {
		return db.prepare("SELECT name,tag,timestamp,stream,file_name FROM auto_updater WHERE (name=?);").get(name);
	}
};


module.exports.auto_updater = auto_updater;
module.exports.admin = admin;
module.exports.api = api;
module.exports.user = user;
module.exports.player = player;

module.exports.checkTables = function (){
	db.exec("" +
		"CREATE TABLE IF NOT EXISTS auto_updater (" +
		"`id` AUTO INCREMENT NOT NULL PRIMARY KEY UNIQUE," +
		"`name` VARCHAR(255) NOT NULL," +
		"`file_name` VARCHAR(255) NOT NULL," +
		"`tag` VARCHAR(255) NOT NULL," +
		"`stream`TEXT," +
		"`timestamp` INTEGER NOT NULL" +
	");");
	db.exec("" +
		"CREATE TABLE IF NOT EXISTS users (" +
		"`discord_id` VARCHAR(32) PRIMARY KEY," +
		"`username` VARCHAR(64) NOT NULL," +
		"`discriminator` VARCHAR(4) NOT NULL," +
		"`email` VARCHAR(255) NOT NULL," +
		"`slot_count` INTEGER NOT NULL DEFAULT '0'," +
		"`token` TEXT," +
		"`timestamp` INTERGER NOT NULL" +
	");");
	db.exec("" +
		"CREATE TABLE IF NOT EXISTS stored_cosmetics (" +
		"`active` TEXT," +
		"`xuid` VARCHAR(32) PRIMARY KEY" +
	");");
	db.exec("" +
		"CREATE TABLE IF NOT EXISTS slot_cosmetics (" +
		"`id` VARCHAR(32) NOT NULL PRIMARY KEY UNIQUE," +
		"`name` VARCHAR(32) NOT NULL," +
		"`display_name` VARCHAR(64) NOT NULL," +
		"`owner` VARCHAR(32) NOT NULL," +
		"`image` TEXT," +
		"`geometryName` TEXT," +
		"`geometryData` TEXT," +
		"`skinData` TEXT" +
	");");
	db.exec("" +
		"CREATE TABLE IF NOT EXISTS public_cosmetics (" +
		"`id` VARCHAR(32) NOT NULL PRIMARY KEY UNIQUE," +
		"`name` VARCHAR(32) NOT NULL," +
		"`display_name` VARCHAR(64) NOT NULL," +
		"`image` TEXT," +
		"`geometryName` TEXT," +
		"`geometryData` TEXT," +
		"`skinData` TEXT" +
	");");
}


process.on("exit", () => db.close());
process.on('SIGHUP', () => process.exit(128 + 1));
process.on('SIGINT', () => process.exit(128 + 2));
process.on('SIGTERM', () => process.exit(128 + 15));