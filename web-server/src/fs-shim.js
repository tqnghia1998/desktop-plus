const __fs_promises = {
  readFile: async (p, opts) => {
    const enc = typeof opts === 'string' ? opts : opts?.encoding
    const res = await fetch('/api/fs/read-file', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: p, encoding: enc || 'utf8' }),
    })
    if (!res.ok) throw new Error('Failed to read file: ' + p)
    const data = await res.json()
    return data.content
  },
  readdir: async p => {
    const res = await fetch('/api/fs/read-dir', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: p }),
    })
    if (!res.ok) throw new Error('Failed to read dir: ' + p)
    const data = await res.json()
    return data.entries
  },
  stat: async p => {
    const res = await fetch('/api/fs/stat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: p }),
    })
    if (!res.ok) throw new Error('Failed to stat: ' + p)
    const data = await res.json()
    return {
      isFile: () => data.isFile,
      isDirectory: () => data.isDirectory,
      size: data.size,
      mtimeMs: data.mtimeMs,
      birthtimeMs: data.birthtimeMs,
    }
  },
  access: async p => __fs_promises.stat(p).then(() => true),
  writeFile: async (p, content, opts) => {
    const encoding = typeof opts === 'string' ? opts : opts?.encoding || 'utf8'
    const res = await fetch('/api/fs/write-file', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        path: p,
        content: typeof content === 'string' ? content : Array.from(content),
        encoding,
      }),
    })
    if (!res.ok) throw new Error('Failed to write file: ' + p)
  },
  unlink: async p => {
    const res = await fetch('/api/fs/unlink', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: p }),
    })
    if (!res.ok) throw new Error('Failed to unlink: ' + p)
  },
  mkdir: async (p, opts = {}) => {
    const res = await fetch('/api/fs/mkdir', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: p, recursive: opts.recursive === true }),
    })
    if (!res.ok) throw new Error('Failed to create directory: ' + p)
  },
}

const __fs_shim = {
  promises: __fs_promises,
  constants: { F_OK: 0, R_OK: 4, W_OK: 2, X_OK: 1 },
  existsSync: () => false,
  readFileSync: () => '',
  readFile: (p, opts, cb) => {
    if (typeof opts === 'function') {
      cb = opts
      opts = 'utf8'
    }
    __fs_promises
      .readFile(p, opts)
      .then(data => cb && cb(null, data))
      .catch(err => cb && cb(err))
  },
  readdir: (p, opts, cb) => {
    if (typeof opts === 'function') {
      cb = opts
    }
    __fs_promises
      .readdir(p)
      .then(data => cb && cb(null, data))
      .catch(err => cb && cb(err))
  },
  stat: (p, cb) => {
    __fs_promises
      .stat(p)
      .then(data => cb && cb(null, data))
      .catch(err => cb && cb(err))
  },
  statSync: () => ({ isFile: () => false, isDirectory: () => false, size: 0 }),
  createReadStream: (p, options = {}) => {
    const handlers = {}
    const stream = {
      on(event, handler) {
        handlers[event] = handler
        return stream
      },
      pipe(dest) {
        return dest
      },
    }
    queueMicrotask(async () => {
      try {
        const data = Buffer.from(await __fs_promises.readFile(p))
        const chunk = data.subarray(
          options.start || 0,
          options.end === undefined ? data.length : options.end + 1
        )
        handlers.data?.(chunk)
        handlers.end?.()
      } catch (error) {
        handlers.error?.(error)
      }
    })
    return stream
  },
}
const i6 = __fs_shim
const Nce = __fs_shim.createReadStream
