/*
 * Copyright (c) Jan Sohn / xxAROX
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
const fs = require("fs");
const app = express();

const ROBOTS = fs.readFileSync("./public/robots.txt").toString();
const SECURITY = fs.readFileSync("./public/security.txt").toString();

// view engine setup
app.set("views", path.join(__dirname, "../views"));
app.set("view engine", "hbs");
app.engine("hbs", handlebars.engine({
	layoutsDir: path.join(__dirname, "../views/layouts"),
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
app.use(cookieParser(LIB.crypto.randomBytes(16).toString("hex")));
app.use(express.urlencoded({extended: false}));
app.use(require("express-fileupload")({
	//useTempFiles : true,
	//tempFileDir : path.join(process.cwd(), "tmp"),
	//limits: { fileSize: 512 * 512 * 4 },
	//createParentPath: true,
	uriDecodeFileNames: true,
	//abortOnLimit: true,
	//debug: true,
}));
app.use("/public", express.static("./public"));

app.use("/api/", rateLimit({
	windowMs: 1000,
	max: 20,
	handler: function (req, res) {
		res.status(429).render("error");
	},
}));
app.disable("x-powered-by");


app.get("/robots.txt", function (request, response) {
	response.send(ROBOTS);
});
app.get("/security.txt", function (request, response) {
	response.send(SECURITY);
});

app.use("/", (require("./routes/index.js")));
app.use("/api", (require("./routes/api.js")));
app.use("/users", (require("./routes/users.js")));

app.use((request, response, next) => response.header("cache-control", "no-cache, private"));

// catch 404 and forward to error handler
app.use(function (request, response, next) {
	try {
		next();
	} catch (e) {
		console.error(e);
	}
});
global.mergeValues = function (request, object = {}) {
	const lang = languageManager.getLanguage(request.cookies?.langCode || "en_US");
	if (object.title_prefix) object.title_prefix = lang.getValue(object.title_prefix);
	delete object.title_prefix;
	return {
		showNavBar: true,
		...object,
		user: request.cosx_user ?? undefined,
		discord_user: request.discord_user ?? undefined,
		isAdmin: request.isAdmin ?? false,
		isClient: request.isClient ?? false,
		isPremium: request.isPremium ?? false,
		isVerified: request.isVerified ?? false,
		team: request.team ?? undefined,
		name: (!request.__data ? "undefined" : request.__data.user.username + "#" + request.__data.user.discriminator),
		language: {
			name: lang.getName(),
			globalName: lang.getGlobalName(),
			emoji: lang.getEmoji(),
		},
		lang: Object.fromEntries(lang.getValues()),
		discord_authenticate_url: oauth.generateAuthUrl({scope: ["identify", "email", "guilds.join", "connections"],redirectUri:COSMETICX_LINK+"/login"}),
		url: COSMETICX_LINK,
		system: {
			admin_roles: config.discord.admin_roles,
			client_roles: config.discord.client_roles,
			premium_roles: config.discord.premium_roles,
			roles: config.discord.roles,
		},
	};
}

// error handler
app.use(function (err, req, res, next) {
	// set locals, only providing error in development
	res.locals.message = err.message;
	res.locals.error = req.app.get('env') === 'development' ? err : {};



	if (res.headersSent === false) {
		if (req.header("Cosmetic-X") === "by xxAROX") {
			res.json({error:err.status + ": " + err.message});
		} else {
			res.render("issue", {title: "Error", description: err.message});
		}
	}
	console.error(err);
});


module.exports = app;
