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
	constructor(team, user_id, permission, timestamp) {
		this.team = team;
		this.permission = permission;
		this.user_id = user_id;
		this.timestamp = (!timestamp ? time() : timestamp);
		this.accepted = false;
		this.denied = false;
	}

	isExpired() {
		return time() - (60 * 60 * 24 * 7) >= this.timestamp;
	}


	toObject() {
		return {
			team: this.team,
			permission: this.permission,
			timestamp: this.timestamp,
		};
	}
}
module.exports = Invite;