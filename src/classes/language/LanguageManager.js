/*
 * Copyright (c) Jan Sohn / xxAROX
 * All rights reserved.
 * I don't want anyone to use my source code without permission.
 */

const fs = require("fs");
const Language = require("./Language");
/**
 * Class LanguageManager
 * @author Jan Sohn / xxAROX
 * @date 04.08.2022 - 19:34
 * @project Backend
 */
class LanguageManager {
	static FALLBACK_LANGUAGE = "en_US";
	languages = new LIB.discord.Collection();
	constructor() {
		if (LanguageManager.instance) throw new Error("LanguageManager is a singleton class");
		LanguageManager.instance = this;
		this.reloadLanguages();
	}
	/**
	 * @return {LanguageManager}
	 */
	static getInstance() {
		if (!LanguageManager.instance) LanguageManager.instance = new LanguageManager();
		return LanguageManager.instance;
	}
	reloadLanguages() {
		console.log("Loading languages..");
		this.languages.clear();
		this.registerLanguage(LanguageManager.FALLBACK_LANGUAGE + ".json");
		for (let filename of fs.readdirSync("./resources/language/")) {
			if (filename.startsWith(LanguageManager.FALLBACK_LANGUAGE + ".json")) continue;
			if (filename.endsWith(".json")) this.registerLanguage(filename);
		}
		console.log("Loaded " + this.languages.size + " languages.");
	}
	registerLanguage(filename) {
		if (!LIB.fs.existsSync("./resources/language/" + filename)) return;
		let data = JSON.parse(LIB.fs.readFileSync("./resources/language/" + filename).toString());
		this.languages.set(data.langCode.toLowerCase(), new Language(data));
	}
	static getLanguage(langCode = LanguageManager.FALLBACK_LANGUAGE) {
		return LanguageManager.getInstance().languages.get((langCode || LanguageManager.FALLBACK_LANGUAGE).toLowerCase()) || LanguageManager.getInstance().languages.first();
	}
	static getLanguageFromRequest(request) {
		return LanguageManager.getInstance().languages.get((request.cookies['langCode'] || LanguageManager.getLanguage().getLangCode()).toLowerCase());
	}
	static getLanguages() {
		return LanguageManager.getInstance().languages;
	}
}
module.exports = LanguageManager;
