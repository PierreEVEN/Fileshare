const assert = require("assert");

function as_hash_key(source) {
    const data = source.toString();
    assert(/^[A-Za-z0-9$./_-]*$/.test(source))
    return data;
}

/**
 * @param source {number}
 * @return {number|null}
 */
function as_id(source) {
    if (!source)
        return null;
    assert(!isNaN(source));
    return Number(source);
}

/**
 * @param source {number}
 * @return {number}
 */
function as_number(source) {
    if (isNaN(Number(source)))
        console.trace();
    assert(!isNaN(Number(source)), "Data is not a number : " + source);
    return Number(source);
}

/**
 * @param source {string}
 * @return {string}
 */
function as_token(source) {
    if (!source)
        return '';

    const data = source.toString();
    if (!/^[A-Za-z0-9-_.!~*'()%]*$/.test(data)) {
        console.error("invalid token field : " + data)
        assert(/^[A-Za-z0-9-_.!~*'()%]*$/.test(data), data)
    }
    return data;
}

/**
 * @param source {string}
 * @return {string}
 */
function as_data_path(source) {
    if (!source)
        return '';
    const split_path = source.split('/')
    for (let i in split_path) {
        split_path[i] = encodeURIComponent(split_path[i].toString())
        assert(/^[A-Za-z0-9-_.!~*'()%]*$/.test(split_path[i]))
    }
    const generated_path = split_path.filter(Boolean);
    if (generated_path.length === 0)
        return '';
    return '/' + generated_path.join('/');
}

/**
 * @param source {boolean}
 * @return {boolean}
 */
function as_boolean(source) {
    return !!source;
}

/**
 * @param source
 * @return {string}
 */
function as_enum(source) {
    const data = source.toLowerCase().trim();
    assert(/^[A-Za-z0-9-_]*$/.test(source))
    return data;
}

/**
 * Convert a string to a url-compatible string
 * @param display_name {string}
 * @return {string|null}
 */
function display_name_to_url(display_name) {
    display_name = display_name.replaceAll(' ', '-');
    display_name = display_name.replaceAll('.', '_');
    display_name = display_name.replaceAll(',', '_');
    display_name = display_name.replaceAll(';', '_');
    display_name = display_name.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    if (display_name.match("^[a-zA-Z0-9\-_]+$"))
        return display_name;
    return null;
}

module.exports = {as_hash_key, as_id, as_token, as_boolean, as_enum, as_number, as_data_path, display_name_to_url}