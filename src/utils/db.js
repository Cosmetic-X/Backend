/*
 * Copyright (c) Jan Sohn / xxAROX
 * All rights reserved.
 * I don't want anyone to use my source code without permission.
 */
const Discord = require("discord.js");
const Database = require("better-sqlite3");
const Team = require("../classes/Team.js");
const User = require("../classes/User.js");
const Release = require("../classes/Release.js");
const db = new Database("resources/database.db");
global.db_cache = {
	skins: new Discord.Collection(),
	users: new Discord.Collection(),
	tokens: new Discord.Collection(),
	teams: new Discord.Collection(),
	releases: new Discord.Collection(),
	stored_cosmetics: new Discord.Collection(),
};
const jwt = require("jsonwebtoken");
const {SnowflakeGenerator} = require('snowflake-generator');
const {in_array, sendEmail} = require("./utils");
const {encodeSkinData} = require("./imagetools");
const {MessageReaction} = require("discord.js");
const Skin = require("../classes/Skin");

let skins = {}, verify = {}, auto_updater = {}, teams = {}, admin = {}, api = {}, user = {team: {}}, player = {};

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
		member = await bot.guilds.cache.first().members.fetch(user_id);
		if (!member) {
			return false;
		}
	}
	return member.roles.cache.hasAny(...config.discord.admin_roles);
};

const load = async function () {
	checkTables();
	db_cache.users = new Discord.Collection();
	db_cache.tokens = new Discord.Collection();
	db_cache.teams = new Discord.Collection();
	db_cache.releases = new Discord.Collection();
	db_cache.skins = new Discord.Collection();
	db_cache.stored_cosmetics = new Discord.Collection();
	let _statement;

	//###############
	//#             Teams             #
	//###############
	_statement = db.prepare("SELECT owner_id,name,token,admins,manage_drafts,slot_count,drafts_count,manage_submissions,contributors,timestamp FROM teams;").all();
	for (let k in _statement) {
		db_cache.tokens.set(_statement[ k ].token, _statement[ k ].name);
		let team = new Team(
			_statement[ k ].name,
			_statement[ k ].owner_id,
			_statement[ k ].token,
			_statement[ k ].slot_count,
			_statement[ k ].drafts_count,
			JSON.parse((!_statement[ k ].admins ? "{}" : _statement[ k ].admins)),
			JSON.parse((!_statement[ k ].manage_drafts ? "{}" : _statement[ k ].manage_drafts)),
			JSON.parse((!_statement[ k ].manage_submissions ? "{}" : _statement[ k ].manage_submissions)),
			JSON.parse((!_statement[ k ].contributors ? "{}" : _statement[ k ].contributors)),
			_statement[ k ].timestamp,
		);
		await team.reloadCosmetics();
		db_cache.teams.set(team.name.toLowerCase(), team);
	}

	//###############
	//#             Users              #
	//###############
	_statement = db.prepare("SELECT discord_id,username,discriminator,email,invites,timestamp,gamertag FROM users;").all();
	for (let k in _statement) {
		let user = new User(_statement[ k ].discord_id, _statement[ k ].username, _statement[ k ].discriminator, _statement[ k ].email, _statement[ k ].timestamp, _statement[ k ].gamertag, JSON.parse(_statement[ k ].invites));
		await user.updateInvites();
		await user.fetchMember();
		db_cache.users.set(user.discord_id, user);
	}

	//###############
	//#           Releases           #
	//###############
	_statement = db.prepare("SELECT id,name,tag,stream,timestamp FROM releases;").all();
	for (let k in _statement) {
		let release = new Release(_statement[ k ].id, _statement[ k ].name, _statement[ k ].file_name, _statement[ k ].tag, _statement[ k ].stream, _statement[ k ].timestamp, COSMETICX_LINK + "/api/download/" + _statement[ k ].name + "/" + _statement[ k ].tag);
		db_cache.releases.set(release.id, release);
	}

	//###############
	//#           skins           #
	//###############
	_statement = db.prepare("SELECT timestamp,skinId,skinData,capeData,geometryData,geometryName FROM skins;").all();
	for (let k in _statement) {
		let skin = new Skin(
			_statement[ k ].timestamp,
			Buffer.from(_statement[ k ].skinData, "base64"),
			Buffer.from(_statement[ k ].capeData, "base64"),
			_statement[ k ].geometryData,
			_statement[ k ].geometryName,
		);
		db_cache.skins.set(_statement[ k ]['xuid'], skin);
	}

	//###############
	//#           stored_cosmetics           #
	//###############
	_statement = db.prepare("SELECT xuid,active FROM stored_cosmetics;").all();
	for (let k in _statement) {
		if (!_statement.active) continue;
		let id_array = Array.from(JSON.parse(_statement[ k ].active));
		let collection = new Discord.Collection();
		let cosmetics = new Discord.Collection();
		db_cache.teams.forEach(team => {
			team.public_cosmetics.forEach(cosmetic => {
				if (id_array.indexOf(cosmetic.id) > -1) {
					cosmetics.set(cosmetic.id, cosmetic);
				}
			});
		});
		collection.set(_statement[ k ]['xuid'], cosmetics);

	}
};

function checkTables() {
	db.exec("" +
		"CREATE TABLE IF NOT EXISTS releases (" +
		"`id` AUTO INCREMENT PRIMARY KEY UNIQUE," +
		"`name` VARCHAR(255) NOT NULL," +
		"`file_name` VARCHAR(1024) NOT NULL," +
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
	db.exec("" +
		"CREATE TABLE IF NOT EXISTS verify (" +
		"`gamertag` VARCHAR(32) NOT NULL PRIMARY KEY UNIQUE," +
		"`expires_at` INTEGER NOT NULL," +
		"`code` VARCHAR(7) NOT NULL" +
		");");
	db.exec("" +
		"CREATE TABLE IF NOT EXISTS skins (" +
		"`xuid` VARCHAR(64) NOT NULL," +
		"`skinId` VARCHAR(512) NOT NULL," +
		"`skinData` TEXT," +
		"`capeData` TEXT," +
		"`geometryData` LONGTEXT," +
		"`geometryName` VARCHAR(512)," +
		"`timestamp` INTEGER NOT NULL" +
		");");
}


player.storeSkin = function (request, response) {
	if (!request.params[ "xuid" ]) {
		response.status(400).json({error: "xuid is not provided"});
		return;
	}
	let xuid = request.params[ "xuid" ];

	if (!request.body[ "skin_id" ]) {
		response.status(400).json({error: "skin_id is not provided"});
		return;
	}
	let skinId = request.body[ "skin_id" ];

	if (!request.body[ "skin_data" ]) {
		response.status(400).json({error: "skin_data is not provided"});
		return;
	}
	let skinData = request.body[ "skin_data" ];

	if (!request.body[ "cape_data" ]) {
		response.status(400).json({error: "cape_data is not provided"});
		return;
	}
	let capeData = request.body[ "cape_data" ];

	if (!request.body[ "geometry_data" ]) {
		response.status(400).json({error: "geometry_data is not provided"});
		return;
	}
	let geometryData = request.body[ "geometry_data" ];

	if (!request.body[ "geometry_name" ]) {
		response.status(400).json({error: "geometry_name is not provided"});
		return;
	}
	let geometryName = request.body[ "geometry_name" ];
	let date = Date.now();
	db.prepare("REPLACE INTO skins (xuid, skinData, capeData, geometryData, geometryName, timestamp) VALUES (?,?,?,?,?,?)")
	.run(xuid, Buffer.from(skinData).toString("base64"), Buffer.from(capeData).toString("base64"), geometryData, geometryName, date);
	db_cache.skins.set(xuid, new Skin(date, skinId, skinData, capeData, geometryData, geometryName));
};
player.getSkin = function (xuid) {
	return db_cache.skins.get(xuid);
};

player.deactivateCosmetic = function (xuid, cosmetic_id) {
	let active = player.getActiveCosmetics(xuid);
	if (active.get(cosmetic_id)) return;
	let id_array = Array.from(active.keys());
	id_array.splice(id_array.indexOf(cosmetic_id), 1);
	player.setActiveCosmetics(xuid, id_array);
};
player.deactivateAllCosmetics = function (xuid) {
	player.setActiveCosmetics(xuid, []);
};
player.activateCosmetic = function (xuid, cosmetic_id) {
	let active = player.getActiveCosmetics(xuid);
	if (active.get(cosmetic_id)) return;
	let id_array = Array.from(active.keys());
	id_array.push(cosmetic_id);
	player.setActiveCosmetics(xuid, id_array);
};
player.setActiveCosmetics = function (xuid, id_array) {
	let statement = db.prepare("REPLACE INTO  stored_cosmetics (active,xuid) VALUES (?, ?);");
	statement.run(JSON.stringify(id_array), xuid);
	let cosmetics = new Discord.Collection();
	db_cache.teams.forEach(team => {
		team.public_cosmetics.forEach(cosmetic => {
			if (id_array.indexOf(cosmetic.id) > -1) {
				cosmetics.set(cosmetic.id, cosmetic);
			}
		});
	});
	db_cache.stored_cosmetics.set(xuid, cosmetics);
};
/**
 * @param {string} xuid
 * @return {Discord.Collection<string, Cosmetic>}
 */
player.getActiveCosmetics = function (xuid) {
	return db_cache.stored_cosmetics.get(xuid);
};

user.getUser = async function (discord_id) {
	let user = db_cache.users.get(discord_id);
	await user.updateInvites();
	await user.fetchMember();
	return user;
};
user.setPremium = async function (discord_id, role_id, value) {
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
		let key = (k + 1);
		obj[ key ] = {
			discord_id: data[ k ].discord_id,
			username: data[ k ].username,
			discriminator: data[ k ].discriminator,
			tag: data[ k ].username + "#" + data[ k ].discriminator,
			email: data[ k ].email,
			creationTime: data[ k ].timestamp,
			roles: [],
		};
		let member = bot.guilds.cache.first().members.cache.get(data[ k ].discord_id);
		if (!member) {
			member = await bot.guilds.cache.first().members.fetch(data[ k ].discord_id);
		}
		member.roles.cache.forEach((role) => {
			obj[ key ].roles[ role.id ] = {
				name: role.name,
				color: role.color,
			};
		});
		obj[ key ].isAdmin = member.roles.cache.hasAny(...config.discord.admin_roles);
		obj[ key ].isClient = member.roles.cache.hasAny(...config.discord.client_roles);
		obj[ key ].isPremium = member.roles.cache.hasAny(...config.discord.premium_roles);
	}
	return obj;
};
user.register = async function (discord_id, username, discriminator, email) {
	if (!db_cache.users.get(discord_id)) {
		sendEmail(email, "no-reply", "Welcome to Cosmetic-X", "You have been successfully registered.").catch(console.error);
		let user = new User(discord_id, username, discriminator, email, time(), null, []);
		db.prepare('INSERT OR IGNORE INTO users (discord_id, username, discriminator, email, invites, timestamp) VALUES (?, ?, ?, ?, ?, ?);')
		.run(discord_id, username, discriminator, email, JSON.stringify([]), time());
		db_cache.users.set(user.discord_id, user);
	} else {
		db.prepare("UPDATE users SET username=?, discriminator=?, email=? WHERE discord_id=?;")
		.run(username, discriminator, email, discord_id);
	}
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
	let statement = db.prepare("INSERT OR REPLACE INTO releases (name, tag, stream, timestamp, file_name) VALUES (?, ?, ?, ?, ?);");
	statement.run(name, tag, stream, time(), file_name);
};
auto_updater.getVersions = function (name, tag) {
	console.log(db_cache.releases);
	return db_cache.releases.filter(release => release.name === name && release.tag === tag);
	if (!name) {
		return db.prepare("SELECT name,tag,timestamp,stream,file_name FROM releases;").all();
	} else {
		if (!tag) {
			return db.prepare("SELECT name,tag,timestamp,stream,file_name FROM releases WHERE (name=?);").all(name);
		} else {
			return db.prepare("SELECT name,tag,timestamp,stream,file_name FROM releases WHERE (name=? AND tag=?);").all(name, tag);
		}
	}
};

teams.createTeam = async function (name, owner_id) {
	if (!db_cache.teams.get(name.toLowerCase())) {
		let timestamp = time();
		let token = jwt.sign({
			owner_id: owner_id,
			name: name,
			timestamp: timestamp,
		}, config.jwt_secret, {expiresIn: 1000 * 60 * 60 * 24});
		db_cache.tokens[ token ] = name;
		let team = new Team(name, owner_id, token, 3, 2, [], [], [], [], timestamp);
		await team.reloadCosmetics();
		db_cache.teams.set(name.toLowerCase(), team);
		await db.prepare('INSERT OR IGNORE INTO teams (owner_id, name, token, slot_count, drafts_count, admins, manage_drafts, manage_submissions, contributors, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);')
		.run(owner_id, name, token, config.features.default.slot_count, config.features.default.drafts_count, JSON.stringify([]), JSON.stringify([]), JSON.stringify([]), JSON.stringify([]), timestamp);
		return team;
	}
	return undefined;
};
teams.exists = async function (name) {
	return db_cache.teams.get(name.toLowerCase()) === undefined;
};
teams.getTeam = async function (team) {
	team = db_cache.teams.get(team.toLowerCase());
	if (team) {
		await team.reloadCosmetics();
	}
	return team;
};
/**
 * @return {Team}
 */
teams.getCosmeticXTeam = async function () {
	let team = await db_cache.teams.get("cosmetic-x");
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
	let team = db_cache.teams.filter(team => team.token === token).first();
	if (!team || !db_cache.users.get(team.owner_id) || !db_cache.users.get(team.owner_id).isClient) {
		return undefined;
	}
	return team;
};
global.db = {
	db: db,
	checkTables: checkTables,
	load: load,
	verify: verify,
	auto_updater: auto_updater,
	teams: teams,
	admin: admin,
	api: api,
	user: user,
	player: player,
};

verify.generateCode = function (gamertag = "", length = 7) {
	let hash = crypto.createHash("sha1")
		.update(gamertag.shuffle())
		.digest('hex')
		.shuffle()
	;
	return hash.substring(0, length).toLowerCase();
};
verify.activate = async function (gamertag, minutes = 5) {
	if (!isNaN(minutes)) {
		minutes = 5;
	}
	let code = verify.generateCode(gamertag, 7);
	let statement = db.prepare("SELECT gamertag,discord_id FROM users WHERE gamertag=?;");
	let result = statement.get(gamertag);
	if (!result.gamertag) {
		return new Error("§cYou are not registered, please register here first: §n§9" + COSMETICX_LINK + "/login");
	}
	let member = bot.guilds.get(config.guild_id).members.cache.get(result.discord_id);
	if (!member) {
		member = await bot.guilds.get(config.guild_id).members.fetch(result.discord_id);
	}
	if (member.guild.ownerId !== member.id && member.roles.highest.position < COSMETICX_BOT_MEMBER.roles.highest.position) {
		member.setNickname(null, "Unverified");
		member.roles.remove(COSMETICX_BOT_MEMBER.roles.get(config.discord.roles.Verified)).catch(() => {
		});
	}
	db.prepare("UPDATE users SET gamertag=NULL WHERE gamertag=?;").run(gamertag);
	db.prepare("REPLACE INTO verify (gamertag, code, expires_at) VALUES (?, ?, ?);").run(gamertag, code, Date.now() + (1000 * 60 * minutes));
	return code;
};
verify.checkCode = function (gamertag, code) {
	let statement = db.prepare("SELECT gamertag,code,expires_at FROM verify WHERE gamertag=? AND code=?;");
	let result = statement.get(gamertag, code);
	if (!result.gamertag) {
		return new Error("Code expired or invalid");
	}
	if (result.expires_at < Date.now()) {
		return new Error("Code expired or invalid");
	}
	return result.gamertag;
};

bot.on("guildMemberUpdate", async (oldMember, newMember) => {
	if (oldMember.roles.cache.size > newMember.roles.cache.size) {
		oldMember.roles.cache.forEach(role => {
			if (!newMember.roles.cache.has(role.id) && in_array(role.id, [
				...config.discord.client_roles, ...config.discord.premium_roles, ...config.discord.admin_roles,
			])) {
				teams.getOwnTeams(newMember.id).then(teams => teams.forEach(async team => team.reloadCosmetics()));
				//Removed {role}
			}
		});
	} else if (oldMember.roles.cache.size < newMember.roles.cache.size) {
		newMember.roles.cache.forEach(role => {
			if (!oldMember.roles.cache.has(role.id) && in_array(role.id, [
				...config.discord.client_roles, ...config.discord.premium_roles, ...config.discord.admin_roles,
			])) {
				teams.getOwnTeams(newMember.id).then(teams => teams.forEach(async team => team.reloadCosmetics()));
				//Added {role}
			}
		});
	}
});

module.exports.checkTables = checkTables;
module.exports.load = load;

module.exports.skins = skins;
module.exports.verify = verify;
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