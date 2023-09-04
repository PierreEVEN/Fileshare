const express = require('express');
const session = require('express-session');
const {error_404} = require("./src/session_utils");
require('dotenv').config();

let app = express();

// view engine setup
app.set('views', './views');
app.set('view engine', 'pug');

app.use(require('morgan')('dev', {
    skip: function (req, res) { return res.statusCode < 400 }
}));
app.use(express.json());
BigInt.prototype.toJSON = () => this.toString()
app.use(express.urlencoded({extended: false}));
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: true,
    saveUninitialized: true
}));

app.use(express.static('./public'));
app.use('/', require('./routes/fileshare'));

// catch 404
app.use(async (req, res) => {
    return error_404(req, res, req.app.get('env') === 'development' ? require('http-errors')(404) : {});
});

module.exports = app;
