const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const MinimizerPlugin = require('minimizer-webpack-plugin');

module.exports = {
  mode: 'development',
  optimization: {
    minimizer: [
      new MinimizerPlugin({
        minimizerOptions: {
          keep_fnames: true,
        },
      }),
    ],
  },
  entry: {
    splash: './src/components/Home.tsx',
    config: './src/components/config/Config.tsx',
    hier: './src/components/extension/HierarchyNavigator.tsx'
  },
  devtool: 'eval-source-map',
  output: {
    path: path.join(__dirname, '/docs'),
    filename: '[name].js'
  },
  devServer: {
    static: {
      directory: path.join(__dirname, 'docs'),
      // Webpack already watches source files; generated assets do not need a
      // second filesystem watcher.
      watch: false,
    },
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
      {
        test: /\.css$/,
        use: ["style-loader", "css-loader"],
      },
      // For webpack v5
      {
        test: /\.(png|jpe?g|gif|svg|eot|ttf|woff|woff2)$/i,
        // More information here https://webpack.js.org/guides/asset-modules/
        type: "asset",
      },
      {
        test: /\.html$/i,
        loader: "html-loader",
        options: {
          sources: false,
        },
      },

    ]
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js'],
  },
  plugins: [
    new HtmlWebpackPlugin({
      title: "Splash Page",
      template: './src/index.html',
      hash: true,
      chunks: ['splash']
    }),
    new HtmlWebpackPlugin({
      title: "Hierarchy Navigator",
      template: './src/hierarchynavigator.html',
      filename: 'hierarchynavigator.html',
      hash: true,
      chunks: ['hier']
    }),
    new HtmlWebpackPlugin({
      title: "Config Page",
      template: './src/config.html',
      filename: 'config.html',
      hash: true,
      chunks: ['config']
    })
  ],
  stats: {
    children: true,
  },
}
