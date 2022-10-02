/*
 * Copyright (c) Jan Sohn / xxAROX
 * All rights reserved.
 * I don't want anyone to use my source code without permission.
 */

/*
console.log("DOMContentLoaded -> ad_blocker: ", ad_blocker);
ad_blocker = false;
let e = document.createElement("div");
e.id = "zPsRbVdgSXOD";
e.style.display = 'none';
document.body.appendChild(e);

window.onload = () => {
	console.log("window.onload -> ad_blocker: ", ad_blocker);
	if (!document.getElementById('zPsRbVdgSXOD')) ad_blocker = true;
	if (ad_blocker) {
		let element = document.getElementById("ads-blocked");
		element.classList.remove("hidden");
		if (!location.href.includes("/dashboard/ad_blocker_detected")) location.href = "/dashboard/ad_blocker_detected";
	} else {
		let element = document.getElementById("ads-blocked");
		element.classList.add("hidden");
		if (location.href.includes("/dashboard/ad_blocker_detected")) location.href = '/';
	}
};
*/