/*
 * Copyright (c) Jan Sohn / xxAROX
 * All rights reserved.
 * I don't want anyone to use my source code without permission.
 */

const wait = (delay = 0) => new Promise(resolve => setTimeout(resolve, delay));
const setVisible = (selector, visible) => $(selector).css("display", visible ? "block" : "none");
console.log("Loading...");
setVisible(".page", false);
setVisible("#loading", true);

document.addEventListener("DOMContentLoaded", () =>
	wait(1000).then(() => {
		setVisible(".page", true);
		setVisible("#loading", false);
	}));