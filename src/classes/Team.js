/*
 * Copyright (c) Jan Sohn / xxAROX
 * All rights reserved.
 * I don't want anyone to use my source code without permission.
 */

const Discord = require("discord.js");
const {Cosmetic} = require("./Cosmetic");
const {SnowflakeGenerator} = require("snowflake-generator");
const {SnowflakeUtil} = require("discord.js");
const {in_array} = require("../utils/utils");
const jwt = require("jsonwebtoken");

/**
 * Class Team
 * @author Jan Sohn / xxAROX
 * @date 20.02.2022 - 18:45
 * @ide PhpStorm
 * @project Backend
 */
class Team {
	constructor(name, owner_id, token, slot_count, drafts_count, admins, manage_drafts, manage_submissions, contributors, timestamp) {
		this.name = name;
		this.owner_id = owner_id;
		this.token = token;
		this.slot_count = slot_count;
		this.drafts_count = drafts_count;
		this.admins = admins.length > 0 ? new Set([ ...admins ]) : new Set();
		this.manage_drafts = manage_drafts.length > 0 ? new Set([ ...manage_drafts ]) : new Set();
		this.manage_submissions = manage_submissions.length > 0 ? new Set([ ...manage_submissions ]) : new Set();
		this.contributors = contributors.length > 0 ? new Set([ ...contributors ]) : new Set();
		this.timestamp = timestamp;
		let member = bot.guilds.cache.first().members.cache.get(owner_id);
		if (!member) {
			bot.guilds.cache.first().members.fetch(owner_id).then(member => this.creator = member.user.tag).catch(e => this.creator = "Unknown");
		} else {
			this.creator = member.user.tag;
		}
		this.hasPremiumFeatures = false;
		this.isTeamFromAnAdmin = false;
		this.locked = true;
		this.max_cosmetic_slots_reached = true;
		this.max_drafts_count_reached = true;
	}

	async reloadCosmetics() {
		this.isTeamFromAnAdmin = await db.user.isAdmin(this.owner_id);
		this.hasPremiumFeatures = this.isTeamFromAnAdmin || await db.user.isPremium(this.owner_id);
		this.slot_count = this.slot_count + (this.hasPremiumFeatures ? config.features.premium.slot_count : 0);
		this.drafts_count = this.drafts_count +(this.hasPremiumFeatures ? config.features.premium.drafts_count : 0)

		let cosmetics = await db.db.prepare("SELECT * FROM slot_cosmetics WHERE owner=?").all(this.name);
		if (!cosmetics) {
			cosmetics = [];
		}
		if (!Array.isArray(cosmetics)) {
			cosmetics = [ cosmetics ];
		}
		this.cosmetics = new Discord.Collection();
		this.draft_cosmetics = new Discord.Collection();
		this.submitted_cosmetics = new Discord.Collection();
		this.denied_cosmetics = new Discord.Collection();
		this.public_cosmetics = new Discord.Collection();

		for (let k in cosmetics) {
			let cosmetic = new Cosmetic(
				cosmetics[ k ].id,
				cosmetics[ k ].name,
				cosmetics[ k ].display_name,
				(cosmetics[ k ].owner || "Cosmetic-X"),
				cosmetics[ k ].image,
				cosmetics[ k ]["geometryName"],
				cosmetics[ k ]["geometryData"],
				cosmetics[ k ]["skinData"],
				cosmetics[ k ].creator,
				cosmetics[ k ].creation_date,
				cosmetics[ k ].is_draft,
				cosmetics[ k ].is_submitted,
				cosmetics[ k ].is_denied
			);
			if (cosmetic.is_denied) {
				if (time() - (60 * 60 * 24 * 7) >= cosmetic.creation_date) {
					await this.deleteCosmetic(cosmetic.id);
					continue;
				} else {
					this.denied_cosmetics.set(cosmetic.id, cosmetic);
				}
			} else if (cosmetic.is_draft) {
				if ((k > this.drafts_count)) {
					cosmetic.locked = true;
				}
				this.draft_cosmetics.set(cosmetic.id, cosmetic);
			} else if (cosmetic.is_submitted) {
				this.submitted_cosmetics.set(cosmetic.id, cosmetic);
			} else {
				if ((k > this.slot_count)) {
					cosmetic.locked = true;
				}
				this.public_cosmetics.set(cosmetic.id, cosmetic);
			}
			this.cosmetics.set(cosmetic.id, cosmetic);
		}
		this.hasPremiumFeatures = await db.user.isPremium(this.owner_id);
		this.max_cosmetic_slots_reached = (this.public_cosmetics.size >= this.slot_count);
		if (this.max_cosmetic_slots_reached && this.isTeamFromAnAdmin) {
			this.max_cosmetic_slots_reached = false;
		}
		this.max_drafts_count_reached = (this.draft_cosmetics.size >= this.drafts_count);
		if (this.max_drafts_count_reached && this.isTeamFromAnAdmin) {
			this.max_drafts_count_reached = false;
		}
	}

	deleteTeam() {
		delete db_cache[this.name.toLowerCase()];
		db.db.prepare("DELETE FROM slot_cosmetics WHERE owner=?;").run(this.name);
		db.db.prepare("DELETE FROM teams WHERE name=?;").run(this.name);
	}

	async resetToken() {
		this.token = jwt.sign({owner_id:this.owner_id,name:name,timestamp:time()}, config.jwt_secret, {expiresIn: 1000 * 60 * 60 * 24});
		db.db.prepare("UPDATE teams SET token=? WHERE name=?;").run(this.token, this.name);
		return this.token;
	}

	async increaseSlotCount(amount) {
		this.slot_count += amount;
		await this.reloadCosmetics();
	}

	async decreaseSlotCount(amount) {
		if (this.slot_count > (this.hasPremiumFeatures ? config.features.premium.slot_count : config.features.default.slot_count)) {
			this.slot_count = (this.hasPremiumFeatures ? config.features.premium.slot_count : config.features.default.slot_count)
		} else {
			this.slot_count -= amount;
		}
		await this.reloadCosmetics();
	}

	async increaseDraftsCount(amount) {
		this.slot_count += amount;
		await this.reloadCosmetics();
	}

	async decreaseDraftsCount(amount) {
		if (this.drafts_count > (this.hasPremiumFeatures ? config.features.premium.drafts_count : config.features.default.drafts_count)) {
			this.drafts_count = (this.hasPremiumFeatures ? config.features.premium.drafts_count : config.features.default.drafts_count);
		} else {
			this.drafts_count -= amount;
		}
		await this.reloadCosmetics();
	}

	getCosmetic(id) {
		return this.cosmetics.get(id);
	}

	async addCosmetic(creator, name, display_name, geometryData, geometryName, skinData, image, creation_date, to_drafts, is_submission) {
		if (creation_date < time() -(60*60 * 24 * 3)) {
			creation_date = time() -(60*60 * 24 * 3);
		}
		await db.db.prepare("INSERT INTO slot_cosmetics (owner, creator, id, name, display_name, geometryData, geometryName, skinData, image, creation_date, is_denied, is_draft, is_submitted) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);")
		.run(this.name, creator, Discord.SnowflakeUtil.generate(new Date()).toString(), name, display_name, geometryData, geometryName, skinData, image || null, creation_date || time(), false, to_drafts || false, is_submission || false);
		await this.reloadCosmetics();
	}

	async editCosmetic(id, name, geometryData, geometryName, skinData, image, creation_date, is_denied, is_draft, is_submitted) {
		if (is_denied) {
			is_draft = false;
		}
		if (creation_date < time() -(60*60 * 24 * 3)) {
			creation_date = time() -(60*60 * 24 * 3);
		}
		db.db.prepare("UPDATE slot_cosmetics SET name=?, geometryData=?, geometryName=?, skinData=?, image=?, creation_date=?, is_denied=?, is_draft=?, is_submitted=? WHERE id=?;")
		.run(name, geometryData, geometryName, skinData, image || null, creation_date || time(), is_denied ? 0 : 1, is_draft ? 0 : 1, is_submitted ? 0 : 1, id);
		await this.reloadCosmetics();
	}

	async deleteCosmetic(id) {
		await db.db.prepare("DELETE FROM slot_cosmetics WHERE id=? AND owner=?;").run(id, this.name);
		await this.reloadCosmetics();
	}

	/**
	 * @param {Invite} invite
	 * @param {User} user
	 */
	async acceptInvite(invite, user) {
		invite.accepted = true;
		console.log(invite);

		if (invite.permission === "Admin") {
			this.admins.add(user.discord_id);
		} else if (invite.permission === "Manage submissions") {
			this.manage_submissions.add(user.discord_id);
		} else if (invite.permission === "Manage drafts") {
			this.manage_drafts.add(user.discord_id);
		} else if (invite.permission === "Contribute") {
			this.contributors.add(user.discord_id);
		}
		await user.updateInvites();
		await user.fetchMember();
		db.db.prepare("UPDATE teams SET admins=?,manage_submissions=?,manage_drafts=?,contributors=? WHERE name=?;")
		.run(JSON.stringify(Array.from(this.admins)), JSON.stringify(Array.from(this.manage_submissions)), JSON.stringify(Array.from(this.manage_drafts)), JSON.stringify(Array.from(this.contributors)), this.name);
		await this.reloadPermissions();
	}

	async reloadPermissions() {
		let data = await db.db.prepare("SELECT admins,manage_submissions,manage_drafts,contributors FROM teams WHERE name=?;").get(this.name);
		data = {
			admins: JSON.parse(data.admins),
			manage_drafts: JSON.parse(data.manage_drafts),
			manage_submissions: JSON.parse(data.manage_submissions),
			contributors: JSON.parse(data.contributors)
		};
		this.admins = data.admins.length > 0 ? new Set([ ...data.admins ]) : new Set();
		this.manage_drafts = data.manage_drafts.length > 0 ? new Set([ ...data.manage_drafts ]) : new Set();
		this.manage_submissions = data.manage_submissions.length > 0 ? new Set([ ...data.manage_submissions ]) : new Set();
		this.contributors = data.contributors.length > 0 ? new Set([ ...data.contributors ]) : new Set();
	}

	isAdmin(user_id) {
		return this.admins.has(user_id);
	}

	isDraftManager(user_id) {
		return this.manage_drafts.has(user_id);
	}

	isSubmissionManager(user_id) {
		return this.manage_submissions.has(user_id);
	}

	isContributor(user_id) {
		return this.contributors.has(user_id);
	}

	async leave(user_id) {
		if (this.admins.has(user_id)) {
			this.admins.delete(user_id);
		}
		if (this.manage_drafts.has(user_id)) {
			this.manage_drafts.delete(user_id);
		}
		if (this.manage_submissions.has(user_id)) {
			this.manage_submissions.delete(user_id);
		}
		if (this.contributors.has(user_id)) {
			this.contributors.delete(user_id);
		}
		db.db.prepare("UPDATE teams SET admins=?,manage_drafts=?,manage_submissions=?,contributors=? WHERE name=?;")
		.run(JSON.stringify(this.admins), JSON.stringify(this.manage_drafts), JSON.stringify(this.manage_submissions), JSON.stringify(this.contributors), this.name);
		let user = db_cache.users.get(user_id);
		if (user) {
			await user.fetchMember();
		}
	}

	toObject() {
		return {
			name: this.name,
			owner_id: this.owner_id,
			token: this.token,
			slot_count: this.slot_count,
			drafts_count: this.drafts_count,
			admins: this.admins,
			manage_drafts: this.manage_drafts,
			manage_submissions: this.manage_submissions,
			contributors: this.contributors,
			timestamp: this.timestamp,
			creator: this.creator,
			cosmetics: this.cosmetics.clone().each(cosmetic => cosmetic.toObject()),
			public_cosmetics: this.public_cosmetics.clone().each(cosmetic => cosmetic.toObject()),
			draft_cosmetics: this.draft_cosmetics.clone().each(cosmetic => cosmetic.toObject()),
			submitted_cosmetics: this.submitted_cosmetics.clone().each(cosmetic => cosmetic.toObject()),
			denied_cosmetics: this.denied_cosmetics.clone().each(cosmetic => cosmetic.toObject()),
			max_cosmetic_slots_reached: this.max_cosmetic_slots_reached,
			max_drafts_count_reached: this.max_drafts_count_reached,
			locked: this.locked,
			hasPremiumFeatures: this.hasPremiumFeatures,
			isTeamFromAnAdmin: this.isTeamFromAnAdmin,
		};
	}
}
module.exports = Team;
