/*
 * Copyright (c) Jan Sohn / xxAROX
 * All rights reserved.
 * I don't want anyone to use my source code without permission.
 */

/**
 * Class Language
 * @author Jan Sohn / xxAROX
 * @date 04.08.2022 - 19:34
 * @project Backend
 */
class Language {
	constructor(args) {
		this.name = args.name;
		this.globalName = args.globalName;
		this.langCode = args.langCode;
		this.emoji = args.emoji;
		this.values = new LIB.discord.Collection();
		for (let key in args.values) this.values.set(key, args.values[key]);
	}
	getName() {
		return this.name;
	}
	getGlobalName() {
		return this.globalName;
	}
	getLangCode() {
		return this.langCode;
	}
	getEmoji() {
		return this.emoji;
	}
	getValue(key, ...params) {
		let translated = this.values.get(key) || key;
		if (params.length === 0)
			return translated;
		for (let i = 0; i < params.length; i++)
			translated = translated.replace(`{${i}}`, params[i]);
		return translated;
	}
	getValues() {
		return this.values;
	}
}
module.exports = Language;
