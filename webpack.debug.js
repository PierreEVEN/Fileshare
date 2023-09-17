const { merge } = require('webpack-merge');

const BundleAnalyzerPlugin = require('webpack-bundle-analyzer');

module.exports = merge(require('./webpack.dev.js'), {
    plugins: [new BundleAnalyzerPlugin.BundleAnalyzerPlugin()],
});