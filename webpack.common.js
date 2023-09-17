const path = require('path');
const MiniCssExtractPlugin = require("mini-css-extract-plugin");

module.exports = {
    entry: {
        index: './client/layout/index.js',
        viewers: {
            import: './client/embed_viewers/index.js',
            dependOn: 'index',
        },
        pdf_worker: "pdfjs-dist/build/pdf.worker.entry",
    },
    output: {
        filename: '[name].js',
        path: path.resolve(__dirname, 'public/dist'),
    },
    module: {
        rules: [
            {
                test: /\.(hbs)$/,
                include: path.resolve(__dirname, 'client'),
                use: path.resolve('server/handlebars_custom_loader.js')
            },
            {
                test: /\.(scss)$/,
                include: path.resolve(__dirname, 'client'),
                use: [
                    MiniCssExtractPlugin.loader,
                    "css-loader",
                    "sass-loader"
                ],
            },
            {
                test: /\.(css)$/,
                include: path.resolve(__dirname, 'node_modules', 'prismjs'),
                use: [
                    MiniCssExtractPlugin.loader,
                    "css-loader"
                ],
            },
            {
                test: /\.(?:js|mjs|cjs)$/,
                exclude: /node_modules/,
                use: {
                    loader: 'babel-loader',
                    options: {
                        presets: [
                            ['@babel/preset-env', { targets: "defaults" }]
                        ]
                    }
                }
            }
        ],
    },
};