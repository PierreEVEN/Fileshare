let express = require('express');
let router = express.Router();

/* GET users listing. */
router.get('/', function(req, res, next) {
    req.session.user = null;
    res.redirect("/fileshare")
});

module.exports = router;