const fs = require('fs');

let is_in_file_insert = false;

const directories = {}

let dir_id = 0;

function read_line(line) {
    if (line.includes(`INSERT INTO fileshare.Files VALUES`)) {
        is_in_file_insert = true;
        return line;
    }

    if (!line.startsWith(`('`)) {
        is_in_file_insert = false;
    }

    if (is_in_file_insert) {
        const fields = line.split(',');

        const repos = fields[1].replaceAll("'", '');
        const owner = fields[2].replaceAll("'", '');
        const path = fields[8].replaceAll("'", '');

        const insert_dir = (from, remaining_path) => {
            if (remaining_path.length === 0)
                return;

            const dir_name = remaining_path.shift();

            if (!from.dirs[dir_name])
                from.dirs[dir_name] = {dirs: {}, name: dir_name, id: dir_id++, owner: owner};

            insert_dir(from.dirs[dir_name], remaining_path);
        }

        if (!directories[repos])
            directories[repos] = {dirs: {}, name: 'root'};

        insert_dir(directories[repos], path.split('/').filter(Boolean));
    }


    return line;
}

function dir_id_from_path(path, repos) {
    const ps = path.replaceAll("'", '').split('/').filter(Boolean);

    if (ps.length === 0) {
        return 'null';
    }

    const internal = (dirs) => {
        const dirname = ps.shift();
        if (ps.length === 0) {
            return dirs[dirname].id;
        } else {
            return internal(dirs[dirname].dirs);
        }
    }
    return internal(directories[repos].dirs)
}

function init_insertion() {
    let str = `INSERT INTO fileshare.directories VALUES\n`;

    const insert_dir = (repos, dir, parent) => {
        str += `(${dir.id}, ${repos}, ${dir.owner}, '${dir.name}', '', false, ${parent ? parent.id : 'null'}, false),\n`

        for (const subdir of Object.values(dir.dirs))
            insert_dir(repos, subdir, dir);
    }

    for (const [repos, dirs] of Object.entries(directories))
        for (const dir of Object.values(dirs.dirs))
            insert_dir(repos, dir, null);

    return str.substring(0, str.length - 2) + ';\n';
}

function write_line(line) {
    line = line.replaceAll('`', '\'');
    line = line.replaceAll('Files', 'files');
    line = line.replaceAll('Repos', 'repos');
    line = line.replaceAll('UserRepos', 'userrepos');
    line = line.replaceAll('Userrepos', 'userrepos');
    line = line.replaceAll('Users', 'users');
    line = line.replaceAll('Fileshare', 'fileshare');
    if (line.includes(`INSERT INTO fileshare.files VALUES`)) {
        is_in_file_insert = true;
        return init_insertion() + '\n' + line;
    }

    if (!line.startsWith(`('`)) {
        is_in_file_insert = false;
    }

    if (is_in_file_insert) {
        const fields = line
            .replaceAll('(', '')
            .replaceAll(')', '')
            .split(',')
            .filter(Boolean);

        const id = fields[0];
        const repos = fields[1];
        const owner = fields[2];
        const name = fields[3];
        const description = fields[4];
        const storage_path = fields[5];
        const size = fields[6];
        const mimetype = fields[7];
        const virtual_folder = fields[8];
        const hash = fields[9];

        const new_fields = [
            id, repos, owner, dir_id_from_path(virtual_folder, repos), name, description, size, mimetype, hash.replace(';', '')
        ]

        return `(${new_fields.join(',')})${hash.includes(';') ? ';' : ','}`;
    }

    return line;
}

try {
    const data = fs.readFileSync('./exporteddb.sql', 'utf8');
    const lines = data.split('\n');

    let res = '';
    is_in_file_insert = false;
    for (const line of lines)
        read_line(line)

    is_in_file_insert = false;
    for (const line of lines)
        res += write_line(line) + '\n';

    fs.writeFileSync('./fixeddb.sql', res, {encoding: 'utf8', flag: 'w'});
} catch (err) {
    console.error(err);
}
