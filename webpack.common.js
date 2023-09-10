const path = require('path');
const MiniCssExtractPlugin = require("mini-css-extract-plugin");

module.exports = {
    entry: {
        main: './public/scripts/index.js',
        "pdf.worker": "pdfjs-dist/build/pdf.worker.entry",
    },
    output: {
        filename: '[name].js',
        path: path.resolve(__dirname, 'public/dist'),
    },
    plugins: [new MiniCssExtractPlugin()],
    module: {
        rules: [
            {
                test: /\.(hbs|handlebars)$/,
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