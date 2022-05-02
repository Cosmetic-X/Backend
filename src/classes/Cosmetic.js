/*
 * Copyright (c) Jan Sohn / xxAROX
 * All rights reserved.
 * I don't want anyone to use my source code without permission.
 */

/**
 * Class Cosmetic
 * @author Jan Sohn / xxAROX
 * @date 20.02.2022 - 16:18
 * @ide PhpStorm
 * @project Backend
 */
class Cosmetic {
	/**
	 * @param {string} id
	 * @param {string} name
	 * @param {string} display_name
	 * @param {string} owner
	 * @param {string|null} image
	 * @param {string} geometry_data
	 * @param {string} skin_data
	 * @param {string} creator
	 * @param {number} creation_date
	 * @param {boolean|number} is_draft
	 * @param {boolean|number} is_submitted
	 * @param {boolean|number} is_denied
	 * @param {boolean} premium
	 */
	constructor(id, name, display_name, owner, image, geometry_data, skin_data, creator, creation_date, is_draft, is_submitted, is_denied, premium) {
		this.id = id;
		this.name = name;
		this.display_name = display_name;
		this.owner = owner;
		this.image = image;
		this.geometry_data = geometry_data ;
		this.skin_data = skin_data ;
		this.creator = creator;
		this.creation_date = creation_date;
		this.is_draft = (typeof is_draft === "boolean" ? is_draft : (is_draft === 0));
		this.is_submitted =(typeof is_submitted === "boolean" ? is_submitted : (is_submitted === 0));
		this.is_denied = (typeof is_denied === "boolean" ? is_denied : (is_denied === 1));
		this.locked = false;
		this.premium = premium;
	}

	toObject() {
		return {
			id: this.id,
			name: this.name,
			display_name: this.display_name,
			owner: this.owner,
			image: this.image,
			hasImage: this.image != null,
			geometry_data: this.geometry_data,
			skin_data: this.skin_data,
			creator: this.creator,
			creation_date: this.creation_date,
			is_draft: this.is_draft,
			is_submitted: this.is_submitted,
			is_denied: this.is_denied,
			locked: this.locked,
			premium: this.premium,
		};
	}
}
module.exports.Cosmetic = Cosmetic;
