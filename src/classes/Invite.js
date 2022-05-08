/*
 * Copyright (c) Jan Sohn / xxAROX
 * All rights reserved.
 * I don't want anyone to use my source code without permission.
 */

/**
 * Class Invite
 * @author Jan Sohn / xxAROX
 * @date 21. Februar, 2022 - 13:48
 * @ide PhpStorm
 * @project Backend
 */
class Invite {
	/**
	 * @param {Team} team
	 * @param {string} user_id
	 * @param {string} permission
	 * @param {null|number} timestamp
	 */
	constructor(team, user_id, permission, timestamp) {
		this.team = team;
		this.permission = permission;
		this.timestamp = timestamp;

		switch (permission.toLowerCase()) {
			case 'admin':
				this.display_permission = 'Admin';
				break;
			case 'manage_drafts':
				this.display_permission = 'Manage drafts';
				break;
			case 'manage_submissions':
				this.display_permission = 'Manage submissions';
				break;
			case 'contributor':
				this.display_permission = 'Submit cosmetics';
				break;
			default:
				this.display_permission = 'n/a';
				break;
		}

		switch (permission.toLowerCase()) {
			case 'admin':
				this.invite_display_permission = 'Admin';
				break;
			case 'manage_drafts':
				this.invite_display_permission = 'Draft manager';
				break;
			case 'manage_submissions':
				this.invite_display_permission = 'Submissions manager';
				break;
			case 'contributor':
				this.invite_display_permission = 'Contributor';
				break;
			default:
				this.invite_display_permission = 'n/a';
				break;
		}

		this.user_id = user_id;
		this.timestamp = (!timestamp ? time() : timestamp);
		this.accepted = false;
		this.denied = false;
	}

	isExpired() {
		return time() - (60 * 60 * 24 * 7) >= this.timestamp;
	}


	toObject() {
		if (!this.team || !this.team.name) {
			throw new Error("Team is not set");
		}
		return {
			team: this.team.name,
			permission: this.permission,
			timestamp: this.timestamp,
		};
	}
}
module.exports = Invite;