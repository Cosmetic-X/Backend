/*
 * Copyright (c) Jan Sohn / xxAROX
 * All rights reserved.
 * I don't want anyone to use my source code without permission.
 */

const {SlashCommandBuilder,CommandInteraction} = require("discord.js");
/**
 * Class SlashCommand
 * @author Jan Sohn / xxAROX
 * @date 01.08.2022 - 20:29
 * @project Backend
 */
class SlashCommand {
	/**
	 * @type {string}
	 * @readonly
	 */
	name;
	/**
	 * @type {SlashCommandBuilder}
	 * @readonly
	 */
	builder;
	/**
	 * @type {(CommandInteraction) => any}
	 * @readonly
	 */
	runFunction;

	/**
	 * @param {string} name
	 * @param {(SlashCommandBuilder) => any} buildFunction
	 * @param {(CommandInteraction) => any} runFunction
	 */
	constructor(name, buildFunction = (builder) => builder, runFunction = (interaction) => interaction.reply({ephemeral:true,content:"runFunction is not implemented yet."})) {
		this.name = name.toLowerCase();
		this.builder = new SlashCommandBuilder();
		this.builder.setName(this.name).setDescription("This command is not implemented yet!");
		try {
			buildFunction(this.builder);
		} catch (e) {
			console.error(e);
		}
		this.runFunction = runFunction;
	}

	run(interaction) {(this.runFunction)(interaction);}
}
module.exports.SlashCommand = SlashCommand;
