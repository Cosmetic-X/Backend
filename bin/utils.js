/*
 * Copyright (c) 2021-2022. Jan Sohn.
 * All rights reserved.
 * I don't want anyone to use my source code without permission.
 */


module.exports.asyncToSync = function (obj){
	let sync = true;
	let data = null;
	query(params, function(result){
		data = result;
		sync = false;
	});
	while(sync) {
		require('deasync').sleep(100);
	}
	return data;
}