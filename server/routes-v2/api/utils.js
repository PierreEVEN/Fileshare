/***********************************************************************************************/
/*                                         UTILS                                               */
/***********************************************************************************************/

const router = require("express").Router();

router.get('/server-time/', (req, res) => {
    res.send({"server-time": new Date().getTime()})
});

module.exports = router;