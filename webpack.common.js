const path = require('path');
const MiniCssExtractPlugin = require("mini-css-extract-plugin");

module.exports = {
    entry: './public/scripts/index.js',
    output: {
        filename: 'main.js',
        path: path.resolve(__dirname, 'public/dist'),
    },
    plugins: [new MiniCssExtractPlugin()],
    module: {
        rules: [
            {
                test: /\.hbs$/,
                use: path.resolve('bin/handlebars_custom_loader.js')
            },
            {
                test: /\.(scss)$/,
                use: [
                    MiniCssExtractPlugin.loader,
                    "css-loader",
                    "sass-loader"
                ],
            },
        ],
    },
};