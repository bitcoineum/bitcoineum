var webpack = require('webpack');
var path = require('path');
const CopyWebpackPlugin = require('copy-webpack-plugin');

module.exports = {
    entry: "./app/javascripts/app.js",
  output: {
    path: path.resolve(__dirname, 'build'),
    filename: 'app.js'
  },
    module: {
        loaders: [
            { test: /\.css$/,
              use: [ 'style-loader', 'css-loader' ]},
			{ test: /\.json%/, use: 'json-loader' },
            {
               test: /\.js$/,
               exclude: /(node_modules|bower_components)/,
               loader: 'babel-loader',
               	query: {
               		presets: ['babel-preset-latest'],
					comments: false
				},
			}
        ]
    },
	node: {
		console: true,
		fs: 'empty'
	},
  plugins: [
    new CopyWebpackPlugin([
      { from: './app/index.html', to: "index.html" },
      { from: './app/stylesheets/simple-console.css', to: "stylesheets/simple-console.css" },

    ])
  ],

};
