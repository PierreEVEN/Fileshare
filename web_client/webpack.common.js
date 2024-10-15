const path = require('path');
const MiniCssExtractPlugin = require("mini-css-extract-plugin");

module.exports = {
    entry: {
        index: './client/app.js',
        viewers: {
            import: './client/modules/embed_viewers/index.js',
            dependOn: ['index'],
        },
        pdf_worker: "pdfjs-dist/build/pdf.worker.mjs",
    },
    output: {
        filename: '[name].js',
        path: path.resolve(__dirname, 'public/dist'),
    },
    performance: {
        maxEntrypointSize: 4194304,
        maxAssetSize: 4194304
    },
    module: {
        rules: [
            {
                test: /\.(hbs)$/,
                include: path.resolve(__dirname, 'client'),
                use: path.resolve('handlebars_custom_loader.js')
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