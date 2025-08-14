const path = require('path');
const MiniCssExtractPlugin = require("mini-css-extract-plugin");

module.exports = {
    entry: {
        index: './client/widgets/app/app.js',
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
    plugins: [
        {
            apply: (compiler) => {
                compiler.hooks.compile.tap("generate_dependencies", () => {
                    require("./tools/generate_dependencies");
                });
            },
        },
    ],
    watchOptions: {
        ignored: ['**/mime_icon_list.js', 'tools'],
    },
    module: {
        rules: [
            {
                test: /\.(hbs)$/,
                include: path.resolve(__dirname, 'client'),
                use: path.resolve('tools/handlebars_custom_loader.js')
            },
            {
                test: /\.(scss)$/,
                include: path.resolve(__dirname, 'client'),
                use: [
                    MiniCssExtractPlugin.loader,
                    "css-loader",
                    {
                        loader: "sass-loader",
                        options: {
                            implementation: require("sass"),
                            sassOptions: {
                                silenceDeprecations: ['mixed-decls', 'color-functions', 'global-builtin', 'import', 'legacy-js-api'],
                            }
                        },
                    },
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
                            ['@babel/preset-env', { targets: "defaults" }],
                        ]
                    }
                }
            }
        ],
    },
};