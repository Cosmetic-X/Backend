/*
 * Copyright (c) Jan Sohn / xxAROX
 * All rights reserved.
 * I don't want anyone to use my source code without permission.
 */
const Discord = require("discord.js");
const Database = require("better-sqlite3");
const Team = require("../classes/Team.js");
const User = require("../classes/User.js");
const db = new Database("resources/database.db");
global.db_cache = {
	users: {},
	tokens: undefined,
	teams: undefined,
	public_cosmetics: {},
	cosmetics: {},
}
const jwt = require("jsonwebtoken");
const { SnowflakeGenerator } = require('snowflake-generator');
const {in_array, sendEmail} = require("./utils");
const {encodeSkinData} = require("./imagetools");

let auto_updater = {}, teams = {}, admin = {}, api = {}, user = {team:{}}, player = {};

user.isPremium = async (user_id) => {
	let member = bot.guilds.cache.first().members.cache.get(user_id);
	if (!member) {
		member = bot.guilds.cache.first().members.fetch(user_id);
		if (!member) {
			return false;
		}
	}
	return member.roles.cache.hasAny(...config.discord.admin_roles) || member.roles.cache.hasAny(...config.discord.premium_roles);
};
user.isClient = async (user_id) => {
	let member = bot.guilds.cache.first().members.cache.get(user_id);
	if (!member) {
		member = bot.guilds.cache.first().members.fetch(user_id);
		if (!member) {
			return false;
		}
	}
	return member.roles.cache.hasAny(...config.discord.client_roles);
};
user.isAdmin = async (user_id) => {
	let member = bot.guilds.cache.first().members.cache.get(user_id);
	if (!member) {
		member = bot.guilds.cache.first().members.fetch(user_id);
		if (!member) {
			return false;
		}
	}
	return member.roles.cache.hasAny(...config.discord.admin_roles);
};

const load = async function () {
	checkTables();
	db_cache.users = new Discord.Collection()
	db_cache.tokens = new Discord.Collection()
	db_cache.teams = new Discord.Collection();
	let _statement;

	//###############
	//#             Teams             #
	//###############
	_statement = db.prepare("SELECT owner_id,name,token,admins,manage_drafts,slot_count,drafts_count,manage_submissions,contributors,timestamp FROM teams;").all();
	for (let k in _statement) {
		db_cache.tokens.set(_statement[ k ].token, _statement[ k ].name);
		let team = new Team(
			_statement[k].name,
			_statement[k].owner_id,
			_statement[k].token,
			_statement[k].slot_count,
			_statement[k].drafts_count,
			JSON.parse((!_statement[k].admins ? "{}" : _statement[k].admins)),
			JSON.parse((!_statement[k].manage_drafts ? "{}" : _statement[k].manage_drafts)),
			JSON.parse((!_statement[k].manage_submissions ? "{}" : _statement[k].manage_submissions)),
			JSON.parse((!_statement[k].contributors ? "{}" : _statement[k].contributors)),
			_statement[k].timestamp
		);
		await team.reloadCosmetics();
		db_cache.teams.set(team.name.toLowerCase(), team);
	}
	_statement = undefined;

	//###############
	//#             Users              #
	//###############
	_statement = db.prepare("SELECT discord_id,username,discriminator,email,invites,timestamp FROM users;").all();
	for (let k in _statement) {
		let user = new User(_statement[k].discord_id, _statement[k].username, _statement[k].discriminator, _statement[k].email, _statement[k].timestamp, JSON.parse(_statement[k].invites));
		await user.updateInvites();
		await user.fetchMember();
		db_cache.users.set(user.discord_id, user);
	}
	_statement = undefined;
}

function checkTables(){
	db.exec("" +
		"CREATE TABLE IF NOT EXISTS auto_updater (" +
		"`id` AUTO INCREMENT NOT NULL PRIMARY KEY UNIQUE," +
		"`name` VARCHAR(255) NOT NULL UNIQUE," +
		"`file_name` VARCHAR(255) NOT NULL," +
		"`tag` VARCHAR(255) NOT NULL," +
		"`stream`TEXT," +
		"`timestamp` INTEGER NOT NULL" +
		");");
	db.exec("" +
		"CREATE TABLE IF NOT EXISTS teams (" +
		"`name` VARCHAR(255) NOT NULL PRIMARY KEY UNIQUE," +
		"`owner_id` NOT NULL," +
		"`token` TEXT," +
		"`manage_drafts` TEXT," +
		"`manage_submissions` TEXT," +
		"`contributors` TEXT," +
		"`slot_count` INTEGER NOT NULL DEFAULT '4'," +
		"`drafts_count` INTEGER NOT NULL DEFAULT '1'," +
		"`timestamp` INTEGER NOT NULL" +
		");");
	db.exec("" +
		"CREATE TABLE IF NOT EXISTS users (" +
		"`discord_id` VARCHAR(32) PRIMARY KEY," +
		"`username` VARCHAR(64) NOT NULL," +
		"`discriminator` VARCHAR(4) NOT NULL," +
		"`email` VARCHAR(255) NOT NULL," +
		"`teams` TEXT," +
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
		"`creator` VARCHAR(64) NOT NULL," +
		"`image` TEXT," +
		"`geometryName` TEXT," +
		"`geometryData` TEXT," +
		"`skinData` TEXT," +
		"`creation_date` INTEGER NOT NULL DEFAULT '0'," +
		"`is_draft` BOOLEAN NOT NULL DEFAULT true," +
		"`is_submitted` BOOLEAN NOT NULL DEFAULT true," +
		"`is_denied` BOOLEAN NOT NULL DEFAULT false" +
		");");
	db.exec("" +
		"CREATE TABLE IF NOT EXISTS public_cosmetics (" +
		"`id` VARCHAR(32) NOT NULL PRIMARY KEY UNIQUE," +
		"`name` VARCHAR(32) NOT NULL," +
		"`display_name` VARCHAR(64)," +
		"`creator` VARCHAR(64) NOT NULL," +
		"`image` TEXT," +
		"`geometryName` TEXT," +
		"`geometryData` TEXT," +
		"`skinData` TEXT," +
		"`creation_date` INTEGER NOT NULL DEFAULT '0'," +
		"`is_draft` BOOLEAN NOT NULL DEFAULT true," +
		"`is_submitted` BOOLEAN NOT NULL DEFAULT true," +
		"`is_denied` BOOLEAN NOT NULL DEFAULT false" +
		");");
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

user.getUser = async function (discord_id) {
	let user = db_cache.users.get(discord_id);
	await user.updateInvites();
	await user.fetchMember();
	return user;
};
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
	let data = db.prepare("SELECT discord_id,username,discriminator,email,timestamp FROM users;").all();
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
user.register = async function (discord_id, username, discriminator, email) {
	if (!db_cache.users.get(discord_id)) {
		sendEmail(email, "no-reply", "Welcome to Cosmetic-X", "You have been successfully registered.").catch(console.error);
	}
	let user = new User(discord_id, username, discriminator, email, []);
	db.prepare('INSERT OR IGNORE INTO users (discord_id, username, discriminator, email, invites, timestamp) VALUES (?, ?, ?, ?, ?, ?);')
	.run(discord_id, username, discriminator, email, JSON.stringify([]), time());
};

user.team.getDraftTeams = async (user_id) => {
	return db_cache.teams.filter(team => team.isDraftManager(user_id));
};
user.team.getSubmissionsTeams = async (user_id) => {
	return db_cache.teams.filter(team => team.isSubmissionManager(user_id));
};
user.team.getContributingTeams = async (user_id) => {
	return db_cache.teams.filter(team => team.isContributor(user_id));
};

auto_updater.updateVersion = function (name, tag, file_name, stream) {
	let statement = db.prepare("INSERT OR REPLACE INTO auto_updater (name, tag, stream, timestamp, file_name) VALUES (?, ?, ?, ?, ?);");
	statement.run(name, tag, stream, time(), file_name);
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

teams.createTeam = async function (name, owner_id) {
	if (!db_cache.teams.get(name.toLowerCase())) {
		let timestamp = time();
		let token = jwt.sign({owner_id:owner_id,name:name,timestamp:timestamp}, config.jwt_secret, {expiresIn: 1000 * 60 * 60 * 24});
		db_cache.tokens[token] = name;
		let team = new Team(name, owner_id, token, 3, 2, [], [], [], [], timestamp);
		await team.reloadCosmetics();
		db_cache.teams[name.toLowerCase()] = team;
		await db.prepare('INSERT OR IGNORE INTO teams (owner_id, name, token, slot_count, drafts_count, admins, manage_drafts, manage_submissions, contributors, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);')
		.run(owner_id, name, token, config.features.default.slot_count, config.features.default.drafts_count, JSON.stringify([]), JSON.stringify([]), JSON.stringify([]), JSON.stringify([]), timestamp);
		console.log(db_cache.teams[name.toLowerCase()]);
		return team;
	}
	return undefined;
};
teams.exists = async function (name) {
	return db_cache.teams.get(name.toLowerCase()) === undefined;
};
teams.getTeam = async function (team) {
	team = db_cache.teams.get(team.toLowerCase());
	await team.reloadCosmetics();
	return team;
};
/**
 * @return {Promise<Team>}
 */
teams.getCosmeticXTeam = async function () {
	let team = db_cache.teams.get("cosmetic-x");
	await team.reloadCosmetics();
	return team;
};
teams.getTeams = async function () {
	return db_cache.teams;
};
/**
 * @param {string} owner_id
 * @return {Promise<Discord.Collection>}
 */
teams.getOwnTeams = async function (owner_id) {
	return db_cache.teams.filter(team => team.owner_id === owner_id);
};
teams.checkToken = function (token) {
	let team = db_cache.teams.filter(team => team.token === token);
	if (!team || !team.first()) {
		return false;
	}
	return user.isClient(team.first().owner_id)/* || user.isAdmin(data.owner_id)*/;
};
/**
 * @param {string} token
 * @return {Team|undefined}
 */
teams.getByToken = function (token) {
	let team = db_cache.teams.filter((lower_name, team) => team.token === token).first();
	if (!team || !user.isClient(team.first().owner_id)) {
		return undefined;
	}
	return team;
}
global.db = {
	db: db,
	checkTables: checkTables,
	load: load,
	auto_updater: auto_updater,
	teams: teams,
	admin: admin,
	api: api,
	user: user,
	player: player,
}

bot.on("guildMemberUpdate", async (oldMember, newMember) => {
	if (oldMember.roles.cache.size > newMember.roles.cache.size) {
		oldMember.roles.cache.forEach(role => {
			if (!newMember.roles.cache.has(role.id) && in_array(role.id, [...config.discord.client_roles, ...config.discord.premium_roles, ...config.discord.admin_roles])) {
				teams.getOwnTeams(newMember.id).then(teams => teams.forEach(async team => team.reloadCosmetics()))
				//Removed {role}
			}
		});
	} else if (oldMember.roles.cache.size < newMember.roles.cache.size) {
		newMember.roles.cache.forEach(role => {
			if (!oldMember.roles.cache.has(role.id) && in_array(role.id, [...config.discord.client_roles, ...config.discord.premium_roles, ...config.discord.admin_roles])) {
				teams.getOwnTeams(newMember.id).then(teams => teams.forEach(async team => team.reloadCosmetics()))
				//Added {role}
			}
		});
	}
});

module.exports.checkTables = checkTables;
module.exports.load = load;

module.exports.auto_updater = auto_updater;
module.exports.teams = teams;
module.exports.admin = admin;
module.exports.api = api;
module.exports.user = user;
module.exports.player = player;


process.on("exit", () => db.close());
process.on('SIGHUP', () => process.exit(128 + 1));
process.on('SIGINT', () => process.exit(128 + 2));
process.on('SIGTERM', () => process.exit(128 + 15));