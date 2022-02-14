/*
 * Copyright (c) 2021-2022. Jan Sohn.
 * All rights reserved.
 * I don't want anyone to use my source code without permission.
 */

const createError = require('http-errors');
const express = require('express');
const rateLimit = require("express-rate-limit");
const handlebars = require('express-handlebars');
const path = require('path');
const cookieParser = require('cookie-parser');

const indexRouter = require('./routes/index');
const usersRouter = require('./routes/users');

const app = express();

// view engine setup
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "hbs");
app.engine("hbs", handlebars.engine({
	layoutsDir: path.join(__dirname, "/views/layouts"),
	extname: "hbs",
	defaultLayout: "main"
}));

app.use(express.json());
app.use(express.urlencoded({extended: false}));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use(require('express-metatag')('og')(
	[{
		title: "Cosmetic-X",
		url: "https://cosmetic-x.de/",
		description: "Another cosmetic provider for Minecraft: Bedrock Edition",
		color: "#0000ff",
		//image: "", // TODO:
		type: "website"
	}]
));

app.use("/api/", rateLimit({
	windowMs: 1000,
	max: 20,
	handler: function (req, res) {
		res.status(429).render("error");
	},
}));

app.use(function (request, response, next) {
	next();
	if (request.url !== "/ping") {
		console.log(response.statusCode + "  " + request.method + ": " + request.url);
	}
});

app.use('/', indexRouter);
app.use('/users', usersRouter);
app.use('/api', (require('./routes/api')));

// catch 404 and forward to error handler
app.use(function (req, res, next) {
	try {
		next(createError(404));
	} catch (e) {
	}
});

// error handler
app.use(function (err, req, res, next) {
	// set locals, only providing error in development
	res.locals.message = err.message;
	res.locals.error = req.app.get('env') === 'development' ? err : {};

	// render the error page
	res.status(err.status || 500);
	res.json({error:err.status + ": " + err.message});
	console.error(err);
});

module.exports = app;
