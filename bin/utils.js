/*
 * Copyright (c) 2021-2022. Jan Sohn.
 * All rights reserved.
 * I don't want anyone to use my source code without permission.
 */

module.exports.asyncToSync = function (obj) {
	let sync = true;
	let data = null;
	query(params, function (result) {
		data = result;
		sync = false;
	});
	while (sync) {
		require('deasync').sleep(100);
	}
	return data;
};
global.extend = function (target) {
	for (let i = 1; i < arguments.length; ++i) {
		let from = arguments[ i ];
		if (typeof from !== 'object') {
			continue;
		}
		for (let j in from) {
			if (from.hasOwnProperty(j)) {
				target[ j ] = typeof from[ j ] === 'object'
					? extend({}, target[ j ], from[ j ])
					: from[ j ];
			}
		}
	}
	return target;
}