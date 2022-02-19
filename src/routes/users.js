/*
 * Copyright (c) 2021-2022. Jan Sohn.
 * All rights reserved.
 * I don't want anyone to use my source code without permission.
 */

const express = require('express');
const router = express.Router();

/* GET users listing. */
router.get("/", function(req, res, next) {
  res.send('respond with a resource');
});

module.exports = router;
