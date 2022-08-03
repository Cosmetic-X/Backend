/*
 * Copyright (c) Jan Sohn / xxAROX
 * All rights reserved.
 * I don't want anyone to use my source code without permission.
 */

/*
 * Class registerSlashCommands
 * @package
 * @author Jan Sohn / xxAROX
 * @date 02. August, 2022 - 16:44
 * @ide PhpStorm
 * @project Backend
 */
const {SlashCommand} = require("../classes/SlashCommand");
const {GuildMember} = require("discord.js");
let commandArray = [];

commandArray.push(new SlashCommand(
	"verify",
	(builder) => {
		builder.setDescription("Verifies your discord-account with XBOX.");
		builder.addStringOption((option) => {
			option.setName("gamertag");
			option.setDescription("The gamertag of your XBOX account.");
			option.setRequired(true);
			return option;
		});
		builder.addStringOption((option) => {
			option.setName("code");
			option.setDescription("The code you got from joining cosmetic-x.de");
			option.setRequired(true);
			return option;
		});
	},
	async (interaction) => {
		let gamertag = interaction.options.getString("gamertag");
		let code = interaction.options.getString("code");
		let user = db_cache.users.get(interaction.member.user.id);
		if (user) {
			await user.fetchMember();
			if (!db_cache.users.filter(user => user.gamertag?.toLowerCase() === gamertag.toLowerCase()).first()) {
					let result = await db.verify.checkCode(gamertag, code);
					if (result instanceof Error)
						await interaction.reply({ content:result.message, ephemeral:true });
					else {
						if (interaction.member.guild.ownerId !== interaction.member.id && interaction.member.roles.highest.position < COSMETICX_BOT_MEMBER.roles.highest.position) {
							interaction.member.setNickname(gamertag, "Verified as " + gamertag);
							interaction.member.roles.add(COSMETICX_BOT_MEMBER.roles.get(config.discord.roles.Verified)).catch(() => {});
						}
						await interaction.reply({ content:"You have successfully verified as **" + result + "**!", ephemeral:true });
					}
				}
			else await interaction.reply({ content:gamertag + " is already verified.", ephemeral:true });
		} else {
			await interaction.reply({ content:"You are not registered. [Register here](" + COSMETICX_LINK + "/login)", ephemeral:true });
		}
	}
));


module.exports = commandArray;
