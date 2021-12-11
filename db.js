/*
 * Copyright (c) 2021-2021. Jan Sohn.
 * All rights reserved.
 * I don't want anyone to use my source code without permission.
 */
const Database = require('better-sqlite3');
const db = new Database('./database.db');
const jwt = require("jsonwebtoken");
const {integer} = require("sharp/lib/is");
const bcrypt = require("bcrypt");

let admin = {}, api = {}, user = {};


api.checkToken = function (token) {
	let statement = db.prepare("SELECT approved FROM users WHERE token=?");
	return (statement.get(token).approved === 1) && jwt.verify(token, process.env.SECRET);
};

user.hasAdminStatus = function (username) {
	let statement = db.prepare("SELECT admin FROM users WHERE username=?");
	return statement.all(username.toLowerCase())[0]["admin"] || false;
};

user.toggleAdminStatus = function (username) {
	let statement = db.prepare("UPDATE users SET admin=? WHERE username=?");
	statement.run(username.toLowerCase(), !user.hasAdminStatus(username));
};

user.checkPassword = async function (username, passwordToCheck) {
	let statement = db.prepare("SELECT `password` FROM users WHERE username=?;");
	let password = statement.get(username.toLowerCase());
	if (password === undefined) {
		return false;
	}
	return await bcrypt.compare(passwordToCheck.toString(), password.toString());
};

user.exists = function (username) {
	let statement0 = db.prepare("SELECT 0 FROM users WHERE username=?");
	return (statement0.all(username.toLowerCase())[0] !== undefined);
};

user.isApproved = function (username) {
	let statement = db.prepare("SELECT approved FROM users WHERE username=?");
	if (statement.all(username)[0] === undefined) {
		return false;
	}
	return (statement.all(username)[0]["approved"] || false);
};

user.approve = function (username, expireTimeInSeconds){
	let statement = db.prepare("UPDATE users SET approved=true,token=?,admin=? WHERE username=?;");
	statement.run(jwt.sign({username: username}, process.env.SECRET, {expiresIn: (expireTimeInSeconds || 60 * 60 * 24) * 1000}), integer(process.env.IS_DEVELOPMENT), username.toLowerCase());
};

user.getData = function (username){
	let data = db.prepare("SELECT token,displayname,admin,approved,timestamp FROM users WHERE username=?;").get(username);
	if (data === undefined) {
		return null;
	}
	data.admin = (data.admin || 0 === 1);
	data.approved = (data.approved || 0 === 1);
	return data;
}

user.resetToken = function (username, expireTimeInSeconds){
	let statement = db.prepare("UPDATE users SET token=? WHERE username=?;");
	statement.run(jwt.sign({username: username}, process.env.SECRET, {expiresIn: (expireTimeInSeconds || 60 * 60 * 24) * 1000}), username.toLowerCase());
};

user.register = async function (username, password) {
	let hashedPassword = await bcrypt.hash(password, 12);
	let stmt = db.prepare('INSERT INTO users (displayname, username, admin, password, token, approved, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?);');
	stmt.run(username, username.toLowerCase(), 0, hashedPassword, "", 0, (new Date().getTime() / 1000));
};

user.delete = function (username) {
	let statement = db.prepare('DELETE FROM users WHERE username=?');
	statement.run(username.toLowerCase());
};


module.exports.admin = admin;
module.exports.user = user;
module.exports.checkTables = function (){
	db.exec("" +
		"CREATE TABLE IF NOT EXISTS users (" +
		"`displayname` VARCHAR(32)," +
		"`username` VARCHAR(32) PRIMARY KEY," +
		"`admin` BOOLEAN NOT NULL DEFAULT 'false'," +
		"`password` TEXT NOT NULL," +
		"`token` TEXT," +
		"`approved` BOOLEAN NOT NULL DEFAULT 'false'," +
		"`timestamp` INTERGER NOT NULL" +
		");");
}


process.on("exit", () => db.close());
process.on('SIGHUP', () => process.exit(128 + 1));
process.on('SIGINT', () => process.exit(128 + 2));
process.on('SIGTERM', () => process.exit(128 + 15));