const MiniCssExtractPlugin = require('mini-css-extract-plugin')
const path = require('path')
const TerserPlugin = require('terser-webpack-plugin')
const webpack = require('webpack')

const root = path.resolve(__dirname, '..')

module.exports = {
  mode: 'production',
  target: 'web',
  devtool: false,
  entry: {
    app: [
      path.join(root, 'app/src/ui/web-index.tsx'),
      path.join(root, 'app/styles/web-desktop.scss'),
      path.join(__dirname, 'src/browser-renderer.css'),
    ],
  },
  output: {
    path: path.join(__dirname, 'public', 'assets'),
    filename: '[name]-[contenthash:12].js',
    chunkFilename: '[name]-[contenthash:12].js',
    clean: false,
  },
  resolve: {
    extensions: ['.ts', '.tsx', '.js'],
    alias: {
      react: path.join(root, 'app', 'node_modules', 'react'),
      'react-dom': path.join(root, 'app', 'node_modules', 'react-dom'),
      [path.join(root, 'app', 'src', 'lib', 'path.ts')]: path.join(
        __dirname,
        'src',
        'desktop-path-stub.js'
      ),
      [path.join(root, 'app', 'src', 'lib', 'app-shell.ts')]: path.join(
        __dirname,
        'src',
        'desktop-app-shell-stub.js'
      ),
      [path.join(root, 'app', 'src', 'lib', 'get-os.ts')]: path.join(
        __dirname,
        'src',
        'desktop-get-os-stub.js'
      ),
      [path.join(root, 'app', 'src', 'lib', 'ipc-renderer.ts')]: path.join(
        __dirname,
        'src',
        'desktop-ipc-renderer-stub.js'
      ),
      [path.join(root, 'app', 'src', 'models', 'account.ts')]: path.join(
        __dirname,
        'src',
        'desktop-account-stub.js'
      ),
      [path.join(root, 'app', 'src', 'models', 'repository.ts')]: path.join(
        __dirname,
        'src',
        'desktop-repository-model-stub.js'
      ),
      [path.join(root, 'app', 'src', 'lib', 'git', 'worktree.ts')]: path.join(
        __dirname,
        'src',
        'desktop-worktree-stub.js'
      ),
      [path.join(root, 'app', 'src', 'lib', 'git', 'index.ts')]: path.join(
        __dirname,
        'src',
        'desktop-preferences-git-stub.js'
      ),
      [path.join(root, 'app', 'src', 'lib', 'git', 'index')]: path.join(
        __dirname,
        'src',
        'desktop-preferences-git-stub.js'
      ),
      [path.join(root, 'app', 'src', 'lib', 'git', 'config.ts')]: path.join(
        __dirname,
        'src',
        'desktop-preferences-git-config-stub.js'
      ),
      [path.join(root, 'app', 'src', 'lib', 'git', 'config')]: path.join(
        __dirname,
        'src',
        'desktop-preferences-git-config-stub.js'
      ),
      [path.join(root, 'app', 'src', 'lib', 'git', 'gitignore.ts')]: path.join(
        __dirname,
        'src',
        'desktop-gitignore-stub.js'
      ),
      [path.join(root, 'app', 'src', 'lib', 'git', 'gitignore')]: path.join(
        __dirname,
        'src',
        'desktop-gitignore-stub.js'
      ),
      [path.join(root, 'app', 'src', 'lib', 'shells', 'index.ts')]: path.join(
        __dirname,
        'src',
        'desktop-preferences-shells-stub.js'
      ),
      [path.join(root, 'app', 'src', 'lib', 'shells')]: path.join(
        __dirname,
        'src',
        'desktop-preferences-shells-stub.js'
      ),
      [path.join(root, 'app', 'src', 'lib', 'editors', 'lookup.ts')]: path.join(
        __dirname,
        'src',
        'desktop-preferences-editors-stub.js'
      ),
      [path.join(root, 'app', 'src', 'lib', 'editors', 'lookup')]: path.join(
        __dirname,
        'src',
        'desktop-preferences-editors-stub.js'
      ),
      [path.join(root, 'app', 'src', 'lib', 'custom-integration.ts')]:
        path.join(
          __dirname,
          'src',
          'desktop-preferences-custom-integration-stub.js'
        ),
      [path.join(root, 'app', 'src', 'lib', 'custom-integration')]: path.join(
        __dirname,
        'src',
        'desktop-preferences-custom-integration-stub.js'
      ),
      [path.join(root, 'app', 'src', 'lib', 'ssh', 'ssh.ts')]: path.join(
        __dirname,
        'src',
        'desktop-preferences-ssh-stub.js'
      ),
      [path.join(root, 'app', 'src', 'lib', 'ssh', 'ssh')]: path.join(
        __dirname,
        'src',
        'desktop-preferences-ssh-stub.js'
      ),
      [path.join(root, 'app', 'src', 'lib', 'stores', 'app-store.ts')]:
        path.join(__dirname, 'src', 'desktop-preferences-app-store-stub.js'),
      [path.join(root, 'app', 'src', 'lib', 'stores', 'app-store')]: path.join(
        __dirname,
        'src',
        'desktop-preferences-app-store-stub.js'
      ),
      [`${path.join(root, 'app', 'src', 'lib', 'stores')}$`]: path.join(
        __dirname,
        'src',
        'desktop-changes-stores-stub.js'
      ),
      [`${path.join(root, 'app', 'src', 'lib', 'stores', 'index.ts')}$`]:
        path.join(__dirname, 'src', 'desktop-changes-stores-stub.js'),
      [path.join(root, 'app', 'src', 'lib', 'stores', 'ahead-behind-store.ts')]:
        path.join(__dirname, 'src', 'desktop-ahead-behind-store-stub.js'),
      [path.join(root, 'app', 'src', 'lib', 'git', 'lfs.ts')]: path.join(
        __dirname,
        'src',
        'desktop-shared-stubs.js'
      ),
      [path.join(root, 'app', 'src', 'lib', 'git', 'lfs')]: path.join(
        __dirname,
        'src',
        'desktop-shared-stubs.js'
      ),
      [path.join(root, 'app', 'src', 'lib', 'large-files.ts')]: path.join(
        __dirname,
        'src',
        'desktop-shared-stubs.js'
      ),
      [path.join(root, 'app', 'src', 'lib', 'large-files')]: path.join(
        __dirname,
        'src',
        'desktop-shared-stubs.js'
      ),
      [path.join(root, 'app', 'src', 'lib', 'stats')]: path.join(
        __dirname,
        'src',
        'desktop-shared-stubs.js'
      ),
      [path.join(root, 'app', 'src', 'lib', 'stats', 'index.ts')]: path.join(
        __dirname,
        'src',
        'desktop-shared-stubs.js'
      ),
      [path.join(root, 'app', 'src', 'lib', 'stores', 'copilot-store')]:
        path.join(
          __dirname,
          'src',
          'desktop-preferences-copilot-store-stub.js'
        ),
      [path.join(root, 'app', 'src', 'lib', 'stores', 'copilot-store.ts')]:
        path.join(
          __dirname,
          'src',
          'desktop-preferences-copilot-store-stub.js'
        ),
      [path.join(root, 'app', 'src', 'lib', 'copilot', 'byok')]: path.join(
        __dirname,
        'src',
        'desktop-preferences-byok-stub.js'
      ),
      [path.join(root, 'app', 'src', 'lib', 'copilot', 'byok.ts')]: path.join(
        __dirname,
        'src',
        'desktop-preferences-byok-stub.js'
      ),
      [path.join(root, 'app', 'src', 'lib', 'git', 'worktree-include.ts')]:
        path.join(__dirname, 'src', 'desktop-worktree-include-stub.js'),
      [path.join(root, 'app', 'src', 'ui', 'main-process-proxy.ts')]: path.join(
        __dirname,
        'src',
        'desktop-main-process-proxy-stub.js'
      ),
      [path.join(root, 'app', 'src', 'ui', 'main-process-proxy')]: path.join(
        __dirname,
        'src',
        'desktop-main-process-proxy-stub.js'
      ),
      [path.join(root, 'app', 'src', 'ui', 'app.tsx')]: path.join(
        __dirname,
        'src',
        'desktop-app-error-app-stub.js'
      ),
      [path.join(root, 'app', 'src', 'lib', 'git', 'core.ts')]: path.join(
        __dirname,
        'src',
        'desktop-git-core-stub.js'
      ),
      [path.join(root, 'app', 'src', 'lib', 'git', 'core')]: path.join(
        __dirname,
        'src',
        'desktop-git-core-stub.js'
      ),
      [path.join(root, 'app', 'src', 'ui', 'dispatcher', 'index.ts')]:
        path.join(__dirname, 'src', 'desktop-commit-graph-dispatcher-stub.js'),
      [path.join(root, 'app', 'src', 'ui', 'account-picker.tsx')]: path.join(
        __dirname,
        'src',
        'desktop-account-picker-stub.js'
      ),
      [path.join(
        root,
        'app',
        'src',
        'ui',
        'lib',
        'branch-name-rule-validation.tsx'
      )]: path.join(
        __dirname,
        'src',
        'desktop-branch-name-rule-validation-stub.js'
      ),
      [path.join(
        root,
        'app',
        'src',
        'ui',
        'clone-repository',
        'cloneable-repository-filter-list.tsx'
      )]: path.join(
        __dirname,
        'src',
        'desktop-cloneable-repository-filter-list-stub.js'
      ),
      [path.join(root, 'app', 'src', 'ui', 'preferences', 'notifications.tsx')]:
        path.join(
          __dirname,
          'src',
          'desktop-preferences-notifications-stub.js'
        ),
      [path.join(root, 'app', 'src', 'ui', 'preferences', 'copilot.tsx')]:
        path.join(__dirname, 'src', 'desktop-preferences-copilot-stub.js'),
      electron: path.join(__dirname, 'src', 'desktop-electron-stub.js'),
      [path.join(
        root,
        'app',
        'src',
        'lib',
        'helpers',
        'non-fatal-exception.ts'
      )]: path.join(__dirname, 'src', 'desktop-non-fatal-exception-stub.js'),
      [path.join(root, 'app', 'src', 'lib', 'git', 'interpret-trailers.ts')]:
        path.join(__dirname, 'src', 'desktop-interpret-trailers-stub.js'),
      [path.join(root, 'app', 'src', 'lib', 'text-token-parser.ts')]: path.join(
        __dirname,
        'src',
        'desktop-text-token-parser-stub.js'
      ),
      [path.join(
        root,
        'app',
        'src',
        'ui',
        'diff',
        'syntax-highlighting',
        'index.ts'
      )]: path.join(__dirname, 'src', 'web-diff-syntax-highlighting.js'),
      [path.join(root, 'app', 'src', 'lib', 'directory-exists.ts')]: path.join(
        __dirname,
        'src',
        'desktop-directory-stub.js'
      ),
      [path.join(root, 'app', 'src', 'lib', 'path-exists.ts')]: path.join(
        __dirname,
        'src',
        'desktop-directory-stub.js'
      ),
      [path.join(
        root,
        'app',
        'src',
        'ui',
        'add-repository',
        'write-default-readme.ts'
      )]: path.join(
        __dirname,
        'src',
        'desktop-create-repository-files-stub.js'
      ),
      [path.join(
        root,
        'app',
        'src',
        'ui',
        'add-repository',
        'git-attributes.ts'
      )]: path.join(
        __dirname,
        'src',
        'desktop-create-repository-files-stub.js'
      ),
      [path.join(root, 'app', 'src', 'ui', 'add-repository', 'gitignores.ts')]:
        path.join(__dirname, 'src', 'desktop-create-repository-files-stub.js'),
      [path.join(root, 'app', 'src', 'ui', 'add-repository', 'licenses.ts')]:
        path.join(__dirname, 'src', 'desktop-create-repository-files-stub.js'),
      [path.join(root, 'app', 'src', 'lib', 'git', 'description.ts')]:
        path.join(__dirname, 'src', 'desktop-create-repository-files-stub.js'),
      'fs/promises': path.join(__dirname, 'src', 'desktop-fs-promises-stub.js'),
      os: path.join(__dirname, 'src', 'desktop-node-os-stub.js'),
      path: path.join(__dirname, 'src', 'desktop-node-path-stub.js'),
    },
    fallback: {
      assert: false,
      buffer: false,
      child_process: false,
      crypto: false,
      fs: false,
      http: false,
      https: false,
      os: false,
      path: false,
      process: false,
      stream: false,
      url: false,
    },
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        include: path.join(root, 'app/src'),
        use: {
          loader: 'ts-loader',
          options: {
            configFile: path.join(__dirname, 'webpack.tsconfig.json'),
          },
        },
        exclude: /node_modules/,
      },
      {
        test: /\.(scss|css)$/,
        use: [MiniCssExtractPlugin.loader, 'css-loader', 'sass-loader'],
      },
    ],
  },
  plugins: [
    new webpack.DefinePlugin({
      __DARWIN__: JSON.stringify(true),
      __LINUX__: JSON.stringify(false),
      __WIN32__: JSON.stringify(false),
    }),
    new webpack.ProvidePlugin({
      clearImmediate: [
        path.join(__dirname, 'src', 'desktop-immediate-stub.js'),
        'clearImmediate',
      ],
      log: path.join(__dirname, 'src', 'desktop-log-stub.js'),
      process: path.join(__dirname, 'src', 'desktop-process-stub.js'),
      setImmediate: [
        path.join(__dirname, 'src', 'desktop-immediate-stub.js'),
        'setImmediate',
      ],
    }),
    new MiniCssExtractPlugin({
      filename: '[name]-[contenthash:12].css',
    }),
  ],
  optimization: {
    minimize: true,
    minimizer: [
      new TerserPlugin({
        extractComments: false,
      }),
    ],
    splitChunks: false,
    runtimeChunk: false,
  },
  performance: {
    hints: 'error',
    maxEntrypointSize: 4600 * 1024,
    maxAssetSize: 4300 * 1024,
  },
}
