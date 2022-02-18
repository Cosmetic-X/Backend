/*
 * Copyright (c) 2021-2022. Jan Sohn.
 * All rights reserved.
 * I don't want anyone to use my source code without permission.
 */

const createError = require("http-errors");
const morgan = require("morgan");
const express = require("express");
const rateLimit = require("express-rate-limit");
const handlebars = require("express-handlebars");
const path = require("path");
const cookieParser = require("cookie-parser");

const app = express();

// view engine setup
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "hbs");
app.engine("hbs", handlebars.engine({
	layoutsDir: path.join(__dirname, "/views/layouts"),
	extname: "hbs",
	defaultLayout: "main",
	helpers: {
		clearNavBar: () => {
			return '<script>document.onload(() => {document.getElementById("nav-bar-elements").innerHTML = "";});</script>';
		},
		addNavBarElement: (name, url) => {
			return '' +
				'<script>' +
					'document.onload(function () {' +
						'let nav_elements = document.getElementById("nav-bar-elements");' +
						'nav_elements.innerHTML += \'<li class="nav-item text-light bg-dark"><a class="nav-link text-light bg-dark" href="' + url + '">' + name + '</a></li>\';' +
					'});' +
				'</script>'
			;
		}
	}
}));

app.use(morgan("dev"));
app.use(express.json());
app.use(require("express-fileupload")({
	useTempFiles : true,
	tempFileDir : path.join(process.cwd(), "tmp"),
	limits: { fileSize: 512 * 512 * 4 },
	createParentPath: true,
	uriDecodeFileNames: true,
	abortOnLimit: true,
	debug: true,
}));
app.use(express.urlencoded({extended: false}));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "public")));

app.use("/api/", rateLimit({
	windowMs: 1000,
	max: 20,
	handler: function (req, res) {
		res.status(429).render("error");
	},
}));


app.use("/", (require("./routes/index.js")));
app.use("/users", (require("./routes/users.js")));
app.use("/api", (require("./routes/api.js")));

// catch 404 and forward to error handler
app.use(function (req, res, next) {
	try {
		next();
	} catch (e) {
		console.error(e);
	}
});

// error handler
app.use(function (err, req, res, next) {
	// set locals, only providing error in development
	res.locals.message = err.message;
	res.locals.error = req.app.get('env') === 'development' ? err : {};

	// render the error page
	res.status(err.status || 500).json({error:err.status + ": " + err.message});
	console.error(err);
});


module.exports = app;
