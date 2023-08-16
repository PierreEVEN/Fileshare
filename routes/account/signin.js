let express = require('express');
let router = express.Router();

/* GET users listing. */
router.get('/', function(req, res, next) {
    // Render login template
    res.render('account/signin', {title: "Connexion"});
});

module.exports = router;