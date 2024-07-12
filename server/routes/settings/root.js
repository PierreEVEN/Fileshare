/***********************************************************************************************/
/*                                        SETTINGS                                             */
/***********************************************************************************************/


const {HttpResponse} = require("../utils/errors");
const router = require("express").Router();

router.get("/", (req, res) => {
    return new HttpResponse(HttpResponse.NOT_IMPLEMENTED).redirect_error(req, res);
})

module.exports = router;