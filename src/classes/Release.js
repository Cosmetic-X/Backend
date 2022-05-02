/*
 * Copyright (c) Jan Sohn / xxAROX
 * All rights reserved.
 * I don't want anyone to use my source code without permission.
 */
class Release {
	id;
	name;
	file_name;
	tag;
	stream;
	creation_date;
	download_uri;

	constructor(id, name, file_name, tag, stream, creation_date, download_uri) {
		this.id = id;
		this.name = name;
		this.file_name = file_name;
		this.tag = tag;
		this.stream = stream;
		this.creation_date = creation_date;
		this.download_uri = download_uri;
	}
}
module.exports = Release;