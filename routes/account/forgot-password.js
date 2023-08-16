let express = require('express');
let router = express.Router();

/* GET users listing. */
router.get('/', function(req, res, next) {
    // Render login template
    res.render('account/forgot-password', {title: "Mot de passe oublié"});
});

module.exports = router;