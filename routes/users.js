/*
 * Copyright (c) 2021. Jan Sohn / xxAROX.
 * All rights reserved.
 * I don't want anyone to use my source code without permission.
 */

var express = require('express');
var router = express.Router();

/* GET users listing. */
router.get('/', function(req, res, next) {
  res.send('respond with a resource');
});

module.exports = router;
