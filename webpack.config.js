const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const path = require('path');

module.exports = (env, argv) => {
  const isProduction = argv.mode === 'production';

  return {
    mode: isProduction ? 'production' : 'development',
    devtool: isProduction ? 'source-map' : 'eval-source-map',
    entry: './src/App.ts',
    output: {
      filename: 'bundle.js',
      path: path.resolve(__dirname, 'dist'),
    },
    devServer: {
      static: {
        directory: path.join(__dirname, 'dist'),
      },
    }, 
    module: {
      rules: [
        {
          test: /\.scss$/,
        use: [
          MiniCssExtractPlugin.loader,
          'css-loader',
          'sass-loader'
        ],
        },
        {
          test: /\.ts$/,
          use: {
            loader: 'ts-loader',
            options: {
              onlyCompileBundledFiles: true,
            },
          },
          exclude: /node_modules/,
        },
        {
          test: /\.(png|jpe?g|gif|svg)$/i,
          type: 'asset/resource',
        },
        
      ],
    },
    plugins: [
      new MiniCssExtractPlugin({
        filename: 'style.css',
      }),
      new HtmlWebpackPlugin({
        template: './src/index.html'
      })
    ],
    resolve: {
      extensions: ['.ts', '.js'],
    },
  };
};
