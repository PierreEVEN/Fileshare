const path = require('path');
const webpack = require("webpack");

module.exports = {
    entry: './public/scripts/index.js',
    output: {
        filename: 'main.js',
        path: path.resolve(__dirname, 'public/dist'),
    },
    module: {
        rules: [
            {
                test: /\.(scss|css)$/,
                use: ['style-loader', 'css-loader', 'sass-loader'],
            },
        ],
    },
    mode: 'development',
};