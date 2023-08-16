let express = require('express');
let router = express.Router();

/* GET users listing. */
router.get('/', function(req, res, next) {

    req.session.user = null;

    // Render login template
    res.redirect("/fileshare")
});

module.exports = router;