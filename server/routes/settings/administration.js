/***********************************************************************************************/
/*                                      ADMIN PANNEL                                           */
/***********************************************************************************************/


const {HttpResponse} = require("../utils/errors");
const {get_common_data} = require("../../session_utils");
const fs = require("node:fs");
const router = require("express").Router();

router.use("/", async (req, res, next) => {
    if (!req.connected_user || !req.connected_user.is_admin()) {
        console.warn("!!! An unauthenticated user tried to access administration panel !!! : user = ", req.connected_user)
        return new HttpResponse(HttpResponse.NOT_FOUND, "Unknown page").redirect_error(req, res);
    }
    next();
})

router.get("/", async (req, res) => {
    res.render('administration', {
        title: 'Administration',
        common: await get_common_data(req)
    });
})

router.get("/stats", async (req, res) => {

    const items = await db.single().fetch_objects(Item, 'SELECT * FROM fileshare.items item LEFT JOIN fileshare.file_data file ON item.id = file.id', []);
    let file_count = 0;
    let dir_count = 0;
    let total_size = 0;

    for (const item of items) {
        if (item.is_regular_file) {
            file_count++;
            total_size += item.size;
        } else
            dir_count++;
    }

    let effective_file_count = 0;
    let effective_total_size = 0;
    let thumbnail_count = 0;

    if (fs.existsSync('data_storage')) {
        const file_list = fs.readdirSync('data_storage');
        for (const name of file_list) {
            const file_stats = fs.statSync(`data_storage/${name}`);
            if (file_stats.isFile) {
                effective_file_count++;
                effective_total_size += file_stats.size;
            }
        }
        if (fs.existsSync('data_storage/thumbnails/')) {
            thumbnail_count = fs.readdirSync('data_storage/thumbnails/').length;
        }
    }

    return res.send({files: file_count, dirs: dir_count, size: total_size, effective_files: effective_file_count, effective_size:effective_total_size, thumbnails: thumbnail_count});
})

router.get("/userlist", async (req, res) => {
    const user_list = await db.single().fetch_objects(User, 'SELECT * FROM fileshare.users', []);
    for (let user of user_list)
        delete user.password;
    return res.send(user_list);
})

router.get("/reposlist", async (req, res) => {
    const repos_list = await db.single().fetch_objects(Repos, 'SELECT * FROM fileshare.repos', []);
    return res.send(repos_list);
})

router.post("/setrole", async (req, res) => {
    await db.single().query('UPDATE fileshare.users SET role = $1 WHERE id=$2', [as_enum(req.body.role), as_id(req.body.target)]);
    return res.sendStatus(HttpResponse.OK);
})

module.exports = router;