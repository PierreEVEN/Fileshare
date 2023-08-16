let express = require('express');
let router = express.Router();

router.get('/', function (req, res, next) {

    if (!req.session.user) {
        // render the error page
        res.status(403);
        res.render('error', {message: "Erreur : Seul un utilisateur connecté peut créer un dépot", title: "403 - Forbidden", error: req.app.get('env')})
        return;
    }


    res.render('fileshare/create-repos', {
        title: 'Nouveau dépot',
        user: req.session.user
    });
});


module.exports = router;