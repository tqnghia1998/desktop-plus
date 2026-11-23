const path = require('path')
const webpack = require('webpack')

const root = path.resolve(__dirname, '..')

module.exports = {
  mode: 'production',
  target: 'webworker',
  devtool: false,
  entry: {
    highlighter: path.join(root, 'app', 'src', 'highlighter', 'index.ts'),
  },
  output: {
    path: path.join(__dirname, 'public'),
    filename: 'highlighter.js',
    chunkFilename: 'highlighter/[name].js',
    library: {
      name: 'highlighter',
      type: 'var',
    },
    publicPath: '/',
    clean: false,
  },
  resolve: {
    extensions: ['.ts', '.js'],
    alias: {
      codemirror$: 'codemirror/addon/runmode/runmode.node.js',
      '../lib/codemirror$': '../addon/runmode/runmode.node.js',
      '../../lib/codemirror$': '../../addon/runmode/runmode.node.js',
      '../../addon/runmode/runmode$': '../../addon/runmode/runmode.node.js',
    },
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        include: path.join(root, 'app', 'src', 'highlighter'),
        use: {
          loader: 'ts-loader',
          options: {
            configFile: path.join(
              root,
              'app',
              'src',
              'highlighter',
              'tsconfig.json'
            ),
          },
        },
        exclude: /node_modules/,
      },
    ],
  },
  plugins: [
    new webpack.DefinePlugin({
      __DARWIN__: JSON.stringify(true),
      __LINUX__: JSON.stringify(false),
      __WIN32__: JSON.stringify(false),
      __PROCESS_KIND__: JSON.stringify('highlighter'),
    }),
  ],
  optimization: {
    minimize: true,
    splitChunks: {
      cacheGroups: {
        modes: {
          enforce: true,
          name: module => {
            const builtInMode =
              /node_modules[\\/]+codemirror[\\/]+mode[\\/]+(\w+)[\\/]/i.exec(
                module.resource || ''
              )
            if (builtInMode) return `mode/${builtInMode[1]}`
            const external =
              /node_modules[\\/]+codemirror-mode-(\w+)[\\/]/i.exec(
                module.resource || ''
              )
            if (external) return `ext/${external[1]}`
            return 'common'
          },
        },
      },
    },
  },
}
