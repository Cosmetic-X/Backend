/*
 * Copyright (c) 2021-2022. Jan Sohn.
 * All rights reserved.
 * I don't want anyone to use my source code without permission.
 */
const Database = require('better-sqlite3');
const db = new Database('./database.db');
let db_cache = {
	users: {},
	tokens: {},
	teams: {},
	public_cosmetics: {},
	cosmetics: {},
}
const jwt = require("jsonwebtoken");
const { SnowflakeGenerator } = require('snowflake-generator');
const {in_array} = require("./utils");

let auto_updater = {}, teams = {}, admin = {}, api = {}, user = {team:{}}, player = {};
const checkTables = function (){
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
		"`skinData` TEXT" +
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
		"`skinData` TEXT" +
		");");
};
const load = function () {
	db_cache.users = {}
	db_cache.tokens = {}
	db_cache.teams = {};
	db_cache.public_cosmetics = {}
	db_cache.cosmetics = {}
	let _statement;

	//###############
	//#     Public Cosmetics     #
	//###############
	_statement = db.prepare("SELECT * FROM public_cosmetics;").all();
	if (!_statement) {
		_statement = [];
	} else if (!Array.isArray(_statement)) {
		_statement = [_statement];
	}
	for (let k in _statement) {
		db_cache.public_cosmetics[_statement[k].id] = {
			name: _statement[k].name,
			display_name: _statement[k].display_name,
			image: _statement[k].image,
			geometry_name: _statement[k]["geometryName"],
			geometry_data: _statement[k]["geometryData"],
			skin_data: _statement[k]["skinData"],
			creator: _statement[k]["creator"],
		}
	}

	//###############
	//#             Teams             #
	//###############
	let _teams = db.prepare("SELECT owner_id,name,token,manage_drafts,slot_count,manage_submissions,contributors,timestamp FROM teams;").all();

	for (let k in _teams) {
		if (!db_cache.cosmetics[_teams[k].name.toLowerCase()]) {
			db_cache.cosmetics[_teams[k].name.toLowerCase()] = {};
		}
		let _cosmetics = db.prepare("SELECT * FROM slot_cosmetics WHERE owner=?").all(_teams[k].name);
		if (!_cosmetics) {
			_cosmetics = [];
		} else if (!Array.isArray(_cosmetics)) {
			_cosmetics = [_cosmetics];
		}
		for (let k2 in _cosmetics) {
			db_cache.cosmetics[_teams[k].name.toLowerCase() ][_cosmetics[k2].id] = {
				id: _cosmetics[k2].id,
				name: _cosmetics[k2].name,
				display_name: _cosmetics[k2].display_name,
				owner: _cosmetics[k2].owner,
				image: _cosmetics[k2].image,
				geometry_name: _cosmetics[k2]["geometryName"],
				geometry_data: _cosmetics[k2]["geometryData"],
				skin_data: _cosmetics[k2]["skinData"],
				creator: _cosmetics[k2].creator,
				locked: ((k2 +1) >= _teams[k].slot_count)
			};
		}
		db_cache.tokens[_teams[k].token] = _teams[k].name;
		db_cache.teams[_teams[k].name.toLowerCase()] = {
			name: _teams[k].name,
			owner_id: _teams[k].owner_id,
			token: _teams[k].token,
			slot_count: _teams[k].slot_count,
			maxCosmeticSlotsReached: ((db_cache.cosmetics[_teams[k].name.toLowerCase() ].length +1) >= _teams[k].slot_count),
			manage_drafts: JSON.parse(_teams[k].manage_drafts),
			manage_submissions: JSON.parse(_teams[k].manage_submissions),
			contributors: JSON.parse(_teams[k].contributors),
			timestamp: _teams[k].timestamp,
			cosmetics: db_cache.cosmetics[_teams[k].name.toLowerCase() ]
		};
	}
	console.log("teams", db_cache.teams, "teams");
}
checkTables();
load();


api.getPublicCosmetics = function () {
	return db_cache.public_cosmetics;
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
	let data = db.prepare("SELECT owner_id FROM teams WHERE token=?").get(token);
	if (data === undefined) {
		return false;
	}
	return user.isClient(data.owner_id);
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
	db.prepare('INSERT OR IGNORE INTO users (discord_id, username, discriminator, email, token, timestamp) VALUES (?, ?, ?, ?, ?, ?);')
	.run(discord_id, username, discriminator, email, jwt.sign({discord_id: discord_id}, config.jwt_secret, {expiresIn: 1000 * 60 * 60 * 24}), (new Date().getTime() / 1000));
};
user.delete = function (discord_id) {
	let statement = db.prepare("DELETE FROM users WHERE discord_id=?");
	statement.run(discord_id);
};

user.isPremium = async (user_id) => {
	let member = bot.guilds.cache.first().members.cache.get(user_id);
	if (!member) {
		member = bot.guilds.cache.first().members.fetch(user_id);
		if (!member) {
			return false;
		}
	}
	console.log(member.user.tag, "returned", member.roles.cache.hasAny(...config.discord.admin_roles) || member.roles.cache.hasAny(...config.discord.premium_roles));
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

user.team.getDraftTeams = async (user_id) => {
	let draft_teams = {};
	for (let k in db_cache.teams) {
		if (in_array(user_id, db_cache.teams[k].manage_drafts)) {
			draft_teams[db_cache.teams[k].name.toLowerCase()] = db_cache.teams[k];
		}
	}
	return draft_teams;
};
user.team.getSubmissionsTeams = async (user_id) => {
	let submissions_teams = {};
	for (let k in db_cache.teams) {
		if (in_array(user_id, db_cache.teams[k].manage_submissions)) {
			submissions_teams[db_cache.teams[k].name.toLowerCase()] = db_cache.teams[k];
		}
	}
	return submissions_teams;
};
user.team.getContributingTeams = async (user_id) => {
	let contributing_teams = {};
	for (let k in db_cache.teams) {
		if (in_array(user_id, db_cache.teams[k].contributors)) {
			contributing_teams[db_cache.teams[k].name.toLowerCase()] = db_cache.teams[k];
		}
	}
	return contributing_teams;
};

user.team.getAllTeamsFrom = async (user_id) => {
	console.log("Discord id:", user_id);
	let select = "owner_id,name,token,timestamp";

	let manage_drafts = db.prepare("" +
		"SELECT " + select + " FROM teams WHERE " +
		"manage_drafts LIKE '%" + user_id + "%'" +
		";"
	).get();
	if (!Array.isArray(manage_drafts)) {
		manage_drafts = [manage_drafts];
	}
	if (manage_drafts) {console.log("manage_drafts:", manage_drafts);}

	let manage_submissions = db.prepare("" +
		"SELECT " + select + " FROM teams WHERE " +
		"manage_submissions LIKE '%" + user_id + "%'" +
		";"
	).get();
	if (!Array.isArray(manage_submissions)) {
		manage_submissions = [manage_submissions];
	}
	if (manage_submissions) {console.log("manage_submissions:", manage_submissions);}

	let contributors = db.prepare("" +
		"SELECT " + select + " FROM teams WHERE " +
		"contributors LIKE '%" + user_id + "%'" +
		";"
	).get();
	if (!Array.isArray(contributors)) {
		contributors = [contributors];
	}
	if (contributors) {console.log("contributors:", contributors);}


	console.log(db.prepare("SELECT owner_id,name FROM teams;").get());
	let teams = [];
	let own = db.prepare("SELECT " + select + " FROM teams WHERE owner_id='" + user_id + "';").get();
	console.log(user_id, "SELECT " + select + " FROM teams WHERE owner_id='" + user_id + "';");
	if (own) {console.log("own:", own);}
	console.log("own", own);
	let teamarr = [ ...(!own ? [] : own), ...(!manage_drafts ? [] : manage_drafts), ...(!manage_submissions ? [] : manage_submissions), ...(!contributors ? [] : contributors) ];
	console.log("array", teamarr);
	for (let k in teamarr) {
		console.log(teamarr[k]);
		//
	}
};
user.team.isDraftManager = async (user_id, team) => {
	return db.prepare("SELECT owner_id, name, token, manage_drafts, manage_submissions, contributors, timestamp FROM teams WHERE manage_drafts LIKE '%?%';").all(user_id, team);
};
user.team.isContributor = async (user_id, team) => {
	return db.prepare("SELECT owner_id, name, token, manage_drafts, manage_submissions, contributors, timestamp FROM teams WHERE contributors LIKE '%?%' AND name=?;").all(user_id, team);
};
user.team.isSubmissionManager = async (user_id, team) => {
	return db.prepare("SELECT owner_id, name, token, manage_drafts, manage_submissions, contributors, timestamp FROM teams WHERE contributors LIKE '%?%';").all(user_id, team);
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

teams.createTeam = async function (name, owner_id) {
	if (!db_cache.teams[name.toLowerCase()]) {
		let timestamp = (new Date().getTime() / 1000);
		let token = jwt.sign({owner_id:owner_id,name:name,timestamp:timestamp}, config.jwt_secret, {expiresIn: 1000 * 60 * 60 * 24});
		db_cache.tokens[token] = name;
		db_cache.cosmetics[name.toLowerCase()] = {};
		db_cache.teams[name.toLowerCase()] = {
			name: name,
			owner_id: owner_id,
			token: token,
			slot_count: await user.isPremium(owner_id) ? config.features.premium.slot_count : config.features.default.slot_count,
			maxCosmeticSlotsReached: false,
			manage_drafts: [],
			manage_submissions: [],
			contributors: [],
			timestamp: timestamp,
			cosmetics: db_cache.cosmetics[name.toLowerCase()]
		};
		// noinspection SqlInsertValues
		await db.prepare('INSERT OR IGNORE INTO teams (owner_id, name, token, slot_count, manage_drafts, manage_submissions, contributors, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?, ?);')
		.run(owner_id, name, token, db_cache.teams[name.toLowerCase()].slot_count, JSON.stringify([]), JSON.stringify([]), JSON.stringify([]), timestamp);
	}
};
teams.exists = async function (name) {
	return db_cache.teams[name.toLowerCase()] === undefined;
};
teams.getTeam = async function (name) {
	return db_cache.teams[name.toLowerCase()];
};
teams.getTeams = async function () {
	return db_cache.teams;
};
teams.getOwnTeams = async function (owner_id) {
	let own_teams = {};
	for (let k in db_cache.teams) {
		if (db_cache.teams[k].owner_id === owner_id) {
			db_cache.teams[k].isOwner = db_cache.teams[k].isDraftManager = db_cache.teams[k].isSubmissionManager = db_cache.teams[k].isContributor = true;
			own_teams[db_cache.teams[k].name.toLowerCase()] = db_cache.teams[k];
		}
	}
	return own_teams;
};
teams.getOwnTeamsArray = async function (owner_id) {
	let arr = [];
	let data = db.prepare("SELECT owner_id FROM teams WHERE owner_id=?;").all(owner_id);

	for (let k in data) {
		arr[k] = data[k]["owner_id"];
	}
	return arr
};
teams.getMemberTeams = async function (discord_id) {
	return db.prepare("SELECT owner_id, name, token, manage_drafts, manage_submissions, contributors, timestamp FROM teams WHERE manage_drafts LIKE '%" + discord_id + "%' OR manage_submissions LIKE '%" + discord_id + "%' OR contributors LIKE '%" + discord_id + "%';").all();
};
teams.getMemberTeamsArray = async function (discord_id) {
	let arr = [];
	let data = db.prepare("SELECT owner_id FROM teams WHERE manage_drafts LIKE '%" + discord_id + "%' OR manage_submissions LIKE '%" + discord_id + "%' OR contributors LIKE '%" + discord_id + "%';").all();

	for (let k in data) {
		arr[k] = data[k]["owner_id"];
	}
	return arr
};
teams.deleteTeam = async function (name) {
	if (db_cache.teams[name]) {
		db.prepare("DELETE FROM teams WHERE name=?;").run(name);
	}
};
teams.getSlotCosmetics = function (team) {
	let statement = db.prepare("SELECT * FROM slot_cosmetics WHERE owner=?");
	return statement.all(team);
};
teams.addSlotCosmetic = function (team, creator, name, display_name, geometryData, geometryName, skinData, image) {
	let statement = db.prepare("INSERT INTO slot_cosmetics (owner, creator, id, name, display_name, geometryData, geometryName, skinData, image) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);");
	statement.run(team, creator, SnowflakeGenerator.generate(), name, display_name, geometryData, geometryName, skinData, image ?? null);
};
teams.editSlotCosmetic = function (id, name, geometryData, geometryName, skinData) {
	let statement = db.prepare("UPDATE slot_cosmetics SET name=?, geometryData=?, geometryName=?, skinData=? WHERE id=?;");
	statement.run(name, geometryData, geometryName, skinData, id);
};
teams.deleteSlotCosmetic = function (id, team) {
	db.prepare("DELETE FROM slot_cosmetics WHERE id=? AND owner=?;").run(id, team);
};
teams.getSlotCount = function (name) {
	return db.prepare("SELECT slot_count FROM teams WHERE name=?").get(name)["slot_count"] || config.features.default.slot_count;
}
teams.setSlotCount = function (name, amount) {
	db.prepare("UPDATE teams SET slot_count=? WHERE name=?").run(amount, name);
}
teams.resetToken = function (team){
	let token;
	if (db_cache.teams[team.toLowerCase()]) {
		token = db_cache.teams[team.toLowerCase()].token = jwt.sign({owner_id:db_cache.teams[team.toLowerCase()].owner_id,name:name,timestamp:new Date().getTime() /1000}, config.jwt_secret, {expiresIn: 1000 * 60 * 60 * 24});
	} else {
		token = jwt.sign({name:name,timestamp:new Date().getTime() /1000}, config.jwt_secret, {expiresIn: 1000 * 60 * 60 * 24});
	}
	db.prepare("UPDATE teams SET token=? WHERE name=?;").run(token, team);
};
teams.getByToken = function (token) {
	db_cache.teams.forEach((lower_name, obj) => {

	});
	let ret = {
		owner: db_cache.users[owner_data.discord_id]
	};
	let statement = db.prepare("SELECT name,owner_id FROM teams WHERE token=?");
	let owner_statement = db.prepare("SELECT email,username,discriminator FROM users WHERE discord_id=?");
	let data = statement.get(token);
	if (data === undefined) {
		return undefined;
	}
	let owner_data = owner_statement.get(data.owner_id);
	if (owner_data === undefined) {
		return undefined;
	}
	owner_data.id = owner_data.discord_id;
	owner_data.display_name = owner_data.username + "#" + owner_data.discriminator;
	return {owner: owner_data, ...db_cache.teams[data.name.toLowerCase()]};
}


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