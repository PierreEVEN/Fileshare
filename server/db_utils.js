const assert = require("assert");

function as_hash_key(source) {
    const data = source.toString();
    assert(/^[A-Za-z0-9$./_-]*$/.test(source))
    return data;
}
function as_id(source) {
    if (!source)
        return null;
    assert(!isNaN(source));
    return Number(source);
}

function as_number(source) {
    assert(!isNaN(source));
    return Number(source);
}

function as_data_string(source) {
    if (!source)
        return '';
    const data = encodeURIComponent(source.toString());
    assert(/^[A-Za-z0-9-_.!~*'()%]*$/.test(data))
    return data;
}

function as_data_path(source) {
    if (!source)
        return '';
    const split_path = source.split('/')
    for (let i in split_path) {
        split_path[i] = encodeURIComponent(split_path[i].toString())
        assert(/^[A-Za-z0-9-_.!~*'()%]*$/.test(split_path[i]))
    }
    return split_path.join('/');
}

function as_boolean(source) {
    return !!source;
}


function as_enum(source) {
    const data = source.toLowerCase().trim();
    assert(/^[A-Za-z0-9-_]*$/.test(source))
    return data;
}

module.exports = {as_hash_key, as_id, as_data_string, as_boolean, as_enum, as_number, as_data_path}