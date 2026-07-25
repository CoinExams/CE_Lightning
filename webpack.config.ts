import * as path from 'path';
import * as webpack from 'webpack';
import TerserPlugin from 'terser-webpack-plugin';

const
    /** Common configuration */
    commonConfig: webpack.Configuration = {
        entry: `./src/index.ts`, // Entry point for your library
        resolve: {
            extensions: [`.ts`, `.js`], // Resolve .ts and .js files
        },
        module: {
            rules: [
                {
                    test: /\.ts$/,         // Match .ts files
                    use: `ts-loader`,      // Use ts-loader for TypeScript
                    exclude: /node_modules/,
                },
            ],
        },
        plugins: [
            new webpack.BannerPlugin({
                banner: `/*! MIT License. CoinExams Lightning Payment SDK used in accordance with terms https://coinexams.com/terms */`,
                raw: true, // Ensures the comment appears as-is without being wrapped
            }),
        ],
        optimization: {
            minimize: true,           // Minify the output
            minimizer: [new TerserPlugin()],
            usedExports: true,        // Enable tree-shaking
            sideEffects: false,       // Mark the project as free of side effects
        },
        mode: `production`,          // Ensure output is optimised
    },
    /** Node.js configuration */
    nodeConfig: webpack.Configuration = {
        ...commonConfig,
        target: `node`,
        resolve: {
            ...commonConfig.resolve,
            mainFields: [`module`, `main`],
            conditionNames: [`import`, `default`],
            aliasFields: [],
            preferRelative: true,
        },
        output: {
            path: path.resolve(__dirname, `dist/node`), // Separate output directory
            filename: `lightning.node.min.js`,
            libraryTarget: `commonjs`, // CommonJS for Node.js
            globalObject: `typeof globalThis !== 'undefined' ? globalThis : (typeof self !== 'undefined' ? self : this)`,
        },
        node: {
            __dirname: false, // Prevent Webpack from mocking __dirname
            __filename: false, // Prevent Webpack from mocking __filename
        },
    };

module.exports = [nodeConfig];