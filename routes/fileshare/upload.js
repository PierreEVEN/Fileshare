let express = require('express');
let router = express.Router();

router.get('/', function (req, res, next) {
    res.render('fileshare/upload', {
        title: 'Envoyer un fichier',
        user: req.session.user
    });
});


module.exports = router;