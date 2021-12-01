/*
 * Copyright (c) 2021. Jan Sohn / xxAROX.
 * All rights reserved.
 * I don't want anyone to use my source code without permission.
 */

var express = require('express');
var router = express.Router();

/* GET home page. */
router.get('/', function(req, res, next) {
  res.render('index', { title: 'Express' });
});

module.exports = router;
