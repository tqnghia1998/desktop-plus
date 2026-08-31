const process = {
  browser: true,
  env: { NODE_ENV: 'production', TEST_ENV: 'true' },
  nextTick(callback, ...args) {
    queueMicrotask(() => callback(...args))
  },
  platform: 'darwin',
  versions: {},
}

module.exports = process
