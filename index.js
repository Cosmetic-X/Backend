/*
 * Copyright (c) Jan Sohn / xxAROX
 * All rights reserved.
 * I don't want anyone to use my source code without permission.
 */

global.time = function () {
	return (new Date().getTime() / 1000);
}

require("./src/index.js");
