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
	locked = false;

	constructor(id, name, display_name, owner, image, geometry_name, geometry_data, skin_data, creator, creation_date, is_draft, is_submitted, is_denied) {
		this.id =id;
		this.name =name;
		this.display_name = display_name;
		this.owner = (!owner ? "Cosmetic-X" : owner);
		this.image = image;
		this.geometry_name = geometry_name;
		this.geometry_data = geometry_data ;
		this.skin_data = skin_data ;
		this.creator = creator;
		this.creation_date = creation_date;
		this.is_draft = (typeof is_draft === "boolean" ? is_draft : (is_draft === 0));
		this.is_submitted =(typeof is_submitted === "boolean" ? is_submitted : (is_submitted === 0));
		this.is_denied = (typeof is_denied === "boolean" ? is_denied : (is_denied === 1));
	}

	toObject() {
		return {
			id: this.id,
			name: this.name,
			display_name: this.display_name,
			owner: this.owner,
			image: this.image,
			hasImage: !this.image,
			geometry_name: this.geometry_name,
			geometry_data: this.geometry_data,
			skin_data: this.skin_data,
			creator: this.creator,
			creation_date: this.creation_date,
			is_draft: this.is_draft,
			is_submitted: this.is_submitted,
			is_denied: this.is_denied,
			locked: this.locked,
		};
	}
}
module.exports.Cosmetic = Cosmetic;
