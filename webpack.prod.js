const {merge} = require('webpack-merge');
const MiniCssExtractPlugin = require("mini-css-extract-plugin");

module.exports = merge(require('./webpack.common.js'), {
    mode: 'production',
    plugins: [new MiniCssExtractPlugin({
        filename: "[name]-[contenthash].css",
        chunkFilename: "[name]-[contenthash].css"
    })],
});