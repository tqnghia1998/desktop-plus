const process = {
  browser: true,
  env: { NODE_ENV: 'production', TEST_ENV: 'true', DESKTOP_PLUS_WEB: '1' },
  nextTick(callback, ...args) {
    queueMicrotask(() => callback(...args))
  },
  platform: 'darwin',
  versions: {},
}

module.exports = process
