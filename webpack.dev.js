const {merge} = require('webpack-merge');
const MiniCssExtractPlugin = require("mini-css-extract-plugin");

module.exports = merge(require('./webpack.common.js'), {
    mode: 'development',
    devtool: 'inline-source-map',
    plugins: [new MiniCssExtractPlugin({
        filename: "[name].css",
        chunkFilename: "[name].css",
    })],
});