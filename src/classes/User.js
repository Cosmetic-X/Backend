/*
 * Copyright (c) Jan Sohn / xxAROX
 * All rights reserved.
 * I don't want anyone to use my source code without permission.
 */
const Discord = require("discord.js");
const Invite = require("./Invite.js");

/**
 * Class User
 * @author Jan Sohn / xxAROX
 * @date 21.02.2022 - 13:31
 * @ide PhpStorm
 * @project Backend
 */
class User {
	constructor(discord_id, username, discriminator, email, timestamp, gamertag, invites) {
		this.discord_id = discord_id;
		this.username = username;
		this.discriminator = discriminator;
		this.tag = username + "#" + discriminator;
		this.email = email;
		this.timestamp = timestamp;
		this.gamertag = gamertag;
		this.invites = new Discord.Collection();
		for (let k in invites) {
			this.invites.set(invites[k].team, new Invite(invites[k].team, discord_id, invites[k].permission, invites[k].timestamp));
		}
		this.member = undefined;
		this.isAdmin = this.isClient = this.isPremium = false;
	}

	async updateGamertag(gamertag) {
		this.gamertag = gamertag;
		db.db.prepare("UPDATE users SET gamertag=? WHERE discord_id=?").run(this.gamertag, this.discord_id);
	}

	async fetchMember() {
		try {
			this.member = await bot.guilds.cache.first().members.fetch(this.discord_id);
			this.isAdmin = this.member.roles.cache.hasAny(...config.discord.admin_roles);
			this.isClient = this.member.roles.cache.hasAny(...config.discord.client_roles);
			this.isPremium = this.isAdmin || this.member.roles.cache.hasAny(...config.discord.premium_roles);
		} catch (e) {
			if (e.message !== "Unknown Member") {
				console.error(e);
			}
		}
		let granted_teams = (await this.getDraftTeams().size + await this.getSubmissionsTeams().size + await this.getContributingTeams());
		this.can_join_teams = this.isAdmin || !(granted_teams >= (this.isPremium ? config.features.premium.max_joinable_teams : config.features.default.max_joinable_teams));
	}

	async updateInvites(updateInvites) {
		this.invites.forEach(invite => {
			if (invite.accepted || invite.denied || invite.isExpired()) {
				updateInvites = true;
				console.log(invite.team);
				this.invites.delete(invite.team.name);
			}
		});
		if (updateInvites) {
			let invites = [];
			this.invites.forEach(invite => {
				invites.push(invite.toObject());
			});
			db.db.prepare("UPDATE users SET invites=? WHERE discord_id=?")
			.run(JSON.stringify(invites), this.discord_id);
		}
	}

	async getOwnTeams() {
		return db_cache.teams.forEach(team => team.owner_id === this.discord_id);
	}

	async getGrantedTeams() {
		return (new Discord.Collection()).concat(
			await this.getAdminTeams(),
			await this.getDraftTeams(),
			await this.getSubmissionsTeams(),
			await this.getContributingTeams(),
		);
	}

	async getAdminTeams() {
		return db_cache.teams.filter(team => (team.isAdmin(this.discord_id)))
	}

	async getDraftTeams() {
		return db_cache.teams.filter(team => team.isDraftManager(this.discord_id));
	}

	async getSubmissionsTeams() {
		return db_cache.teams.filter(team => team.isSubmissionManager(this.discord_id));
	}

	async getContributingTeams() {
		return db_cache.teams.filter(team => team.isContributor(this.discord_id));
	}

	/**
	 * @param {Invite} invite
	 */
	async sendInvite(invite) {
		if (this.invites.get(invite.team.name) && this.invites.get(invite.team.name).permission !== invite.permission) {
			this.invites.get(invite.team.name).permission = invite.permission;
			invite.timestamp = this.invites.get(invite.team.name).timestamp;
		}
		this.invites.set(invite.team.name, invite);
		await this.updateInvites(true);
	}

	/**
	 * @param {Team} team
	 */
	denyInvite(team) {
		if (this.invites.get(team.name)) {
			this.invites.get(team.name).denied = true;
		}
	}

	deleteUser() {
		db.prepare("DELETE FROM users WHERE discord_id=?").run(this.discord_id);
		db_cache.teams.forEach(async (k, team) => team.deleteTeam());
		db.prepare("DELETE FROM teams WHERE discord_id=?").run(this.discord_id);
	}

}
module.exports = User;