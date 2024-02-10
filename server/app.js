const express = require('express');
const session = require('express-session');
const {error_404} = require("./session_utils");
require('./logger');
const fs = require("fs");
const {join} = require("path");
const {logger} = require("./logger");

function setup_app() {

    if (!process.env.FILE_STORAGE_PATH)
        process.env.FILE_STORAGE_PATH = 'data_storage'

    // Remove old temp data
    const tmp_dir = join(process.env.FILE_STORAGE_PATH, "tmp");
    if (fs.existsSync(tmp_dir)) {
        fs.rmSync(tmp_dir, {recursive: true, force: true});
    }

    let app = express();

// view engine setup
    app.set('views', './views');
    app.set('view engine', 'pug');

    app.use(express.json());
    BigInt.prototype["toJSON"] = function () {
        return this.toString();
    };

    app.use(express.urlencoded({extended: false}));
    app.use(session({
        secret: process.env.SESSION_SECRET,
        resave: true,
        saveUninitialized: true
    }));

    app.use(express.static('./public'));
    return app;
}

function set_routes(app, server) {
    app.use('/', require('./routes/fileshare'));
    // catch 404
    app.use(async (req, res) => {
        return error_404(req, res);
    });
}

module.exports = {setup_app, set_routes};
