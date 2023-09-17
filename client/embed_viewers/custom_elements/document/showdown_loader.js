const showdown = require("showdown");

function convert_text(text) {
    const converter = new showdown.Converter();
    return converter.makeHtml(text);
}

export {convert_text}