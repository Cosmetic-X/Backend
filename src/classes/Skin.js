/*
 * Copyright (c) Jan Sohn / xxAROX
 * All rights reserved.
 * I don't want anyone to use my source code without permission.
 */

/**
 * Class Skin
 * @package
 * @author Jan Sohn / xxAROX
 * @date 03. August, 2022 - 06:53
 * @ide PhpStorm
 * @project Backend
 */
class Skin {
	constructor(timestamp, skinId, skinData, capeData, geometryData, geometryName) {
		this.timestamp = timestamp;
		this.skinId = skinId;
		this.skinData = skinData;
		this.capeData = capeData;
		this.geometryData = geometryData;
		this.geometryName = geometryName;
	}
}
module.exports = Skin;