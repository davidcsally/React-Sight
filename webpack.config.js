/* eslint no-unused-vars: 0 */
const path = require('path');
const webpack = require('webpack');
// const HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = {
  entry: {
    bundle: './chrome-ext/frontend/devtools.js',
    installHook: './chrome-ext/backend/installHook.js',
    style: './chrome-ext/css/style.css',
  },
  output: {
    filename: '[name].js',
    path: `${__dirname}/chrome-ext/build/`,
  },
  // devServer: {
  //   contentBase: `${__dirname}/chrome-ext/build`,
  // },
  // use a load for .js and ES6
  module: {
    loaders: [
      {
        test: /\.js?$/,
        loader: 'babel-loader',
        exclude: /node_modules/,
        query: {
          presets: ['es2015', 'stage-2'],
        },
      },
      {
        test: /\.sass$|\.scss$|\.css$/,
        loaders: ['style-loader', 'css-loader', 'sass-loader'],
      },
    ],
  },
  // plugins: [
  // TODO - prod and test env vars
  // new webpack.DefinePlugin({
  //   'process.env.NODE_ENV': JSON.stringify('test'),
  // }),
  // TODO - generate HTML during build
  //   new HtmlWebpackPlugin({
  //     template: `${__dirname}/chrome-ext/devtools.html`,
  //   }),
  // ],
};
