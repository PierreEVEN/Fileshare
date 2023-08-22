let express = require('express');
const {session_data, public_data} = require("../src/session_utils");
let router = express.Router();

/* GET home page. */
router.get('/', async function(req, res, next) {
  res.render('index', {
    title: 'Bienvenue',
    session_data: await session_data(req).client_data(),
    public_data: await public_data().get(),
  });
});

module.exports = router;
