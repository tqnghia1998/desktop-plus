const assert = require('assert/strict')
const { EventEmitter } = require('events')
const platform = require('./platform')

function createRuntime(platformName, integrations, selectedPath) {
  const commands = []
  const spawned = []
  const runtime = {
    platform: platformName,
    homeDirectory: '/home/desktop plus',
    execFile: (command, args, callback) => {
      commands.push({ command, args })
      callback(null, selectedPath || '')
    },
    exists: async () => true,
    isExecutable: async () => true,
    discoverIntegrations: async () => integrations,
    spawn: (command, args, options) => {
      commands.push({ command, args, options })
      const child = new EventEmitter()
      child.unref = () => {
        child.unrefCalled = true
      }
      spawned.push(child)
      queueMicrotask(() => child.emit('spawn'))
      return child
    },
  }
  return {
    commands,
    spawned,
    services: platform.createPlatformServices(runtime),
  }
}

async function main() {
  const integrations = await platform.discoverIntegrations()
  assert.equal(integrations.platform, process.platform)
  assert.ok(Array.isArray(integrations.editors))
  assert.ok(Array.isArray(integrations.shells))
  assert.equal(typeof integrations.dependencies, 'object')
  if (process.platform === 'linux') {
    for (const command of ['zenity', 'xdg-open', 'gio'])
      assert.equal(typeof integrations.dependencies[command], 'boolean')
  } else {
    assert.deepEqual(integrations.dependencies, {})
  }
  const discoveredDarwinIntegrations = await platform
    .createPlatformServices({
      platform: 'darwin',
      homeDirectory: '/Users/desktop-plus',
      isExecutable: async target =>
        target === '/Applications/Visual Studio Code.app',
      readdir: async directory => {
        if (directory === '/Applications')
          return ['Obsidian.app', 'Visual Studio Code.app', 'README.txt']
        if (directory === '/System/Applications') return ['TextEdit.app']
        if (directory === '/Users/desktop-plus/Applications')
          return ['Zettlr.app', 'Obsidian.app']
        return []
      },
    })
    .discoverIntegrations()
  assert.deepEqual(discoveredDarwinIntegrations.editors, [
    {
      name: 'Visual Studio Code',
      path: '/Applications/Visual Studio Code.app',
    },
    { name: 'Obsidian', path: '/Applications/Obsidian.app' },
    { name: 'TextEdit', path: '/System/Applications/TextEdit.app' },
    { name: 'Zettlr', path: '/Users/desktop-plus/Applications/Zettlr.app' },
  ])
  const linux = createRuntime(
    'linux',
    {
      editors: [],
      shells: [{ name: 'Test shell', path: '/usr/bin/test-shell' }],
    },
    '/tmp/selected folder/\n'
  )
  const { commands, spawned, services } = linux
  assert.equal(
    await services.selectDirectory({ title: 'Open worktree' }),
    '/tmp/selected folder'
  )
  await services.openPath('/tmp/selected folder', true)
  await services.moveToTrash('/tmp/selected folder')
  await services.launchIntegration({
    kind: 'shell',
    target: '/tmp/selected folder',
    name: 'Test shell',
  })
  const outputRuntime = {
    platform: 'linux',
    exists: async () => true,
    isExecutable: async () => true,
    spawn: (command, args, options) => {
      commands.push({ command, args, options })
      const child = new EventEmitter()
      child.kill = () => {}
      queueMicrotask(() => {
        child.emit('spawn')
        child.stdout.emit('data', Buffer.from('feature Feature branch\n'))
        child.emit('close', 0)
      })
      child.stdout = new EventEmitter()
      child.stderr = new EventEmitter()
      return child
    },
  }
  const output = await platform
    .createPlatformServices(outputRuntime)
    .runIntegrationForOutput({
      target: '/tmp/selected folder',
      custom: {
        path: '/usr/local/bin/branch-presets',
        arguments: '--repo %TARGET_PATH%',
      },
    })
  assert.equal(output, 'feature Feature branch\n')
  const difficultPath = `/tmp/caf\u00e9 $branch ${'x'.repeat(220)}`
  await services.openPath(difficultPath)
  await services.moveToTrash(difficultPath)
  const cancelledDialog = platform.createPlatformServices({
    platform: 'linux',
    execFile: (command, args, callback) => callback(new Error('cancelled'), ''),
  })
  assert.equal(await cancelledDialog.selectDirectory({}), null)
  assert.deepEqual(commands.slice(0, 3), [
    {
      command: 'zenity',
      args: [
        '--file-selection',
        '--directory',
        '--title=Open worktree',
        '--filename=/home/desktop plus/',
      ],
    },
    { command: 'xdg-open', args: ['/tmp'] },
    { command: 'gio', args: ['trash', '/tmp/selected folder'] },
  ])
  assert.deepEqual(commands[3], {
    command: '/usr/bin/test-shell',
    args: ['--working-directory=/tmp/selected folder'],
    options: { detached: true, stdio: 'ignore', cwd: '/tmp/selected folder' },
  })
  assert.equal(spawned[0].unrefCalled, true)
  assert.deepEqual(commands.slice(5, 7), [
    { command: 'xdg-open', args: [difficultPath] },
    { command: 'gio', args: ['trash', difficultPath] },
  ])

  const mac = createRuntime(
    'darwin',
    {
      editors: [{ name: 'Test Editor', path: '/Applications/Test Editor.app' }],
      shells: [{ name: 'Test Shell', path: '/Applications/Test Shell.app' }],
    },
    '/tmp/mac folder/\n'
  )
  assert.equal(
    await mac.services.selectDirectory({ title: 'Open macOS worktree' }),
    '/tmp/mac folder'
  )
  assert.equal(
    await mac.services.selectSavePath({ title: 'Save macOS file' }),
    '/tmp/mac folder'
  )
  await mac.services.openPath('/tmp/mac folder', true)
  await mac.services.moveToTrash('/tmp/mac folder')
  await mac.services.launchIntegration({
    kind: 'editor',
    target: '/tmp/mac folder',
    name: 'Test Editor',
  })
  await mac.services.launchIntegration({
    kind: 'shell',
    target: '/tmp/mac folder',
    name: 'Test Shell',
  })
  assert.equal(mac.commands[0].command, 'osascript')
  assert.match(mac.commands[0].args.join('\n'), /choose folder/)
  assert.equal(mac.commands[1].command, 'osascript')
  assert.match(mac.commands[1].args.join('\n'), /choose file name/)
  assert.deepEqual(mac.commands.slice(2), [
    { command: 'open', args: ['-R', '/tmp/mac folder'] },
    {
      command: 'osascript',
      args: [
        '-e',
        'on run argv',
        '-e',
        'tell application "Finder" to delete POSIX file (item 1 of argv)',
        '-e',
        'end run',
        '/tmp/mac folder',
      ],
    },
    {
      command: 'open',
      args: ['-a', '/Applications/Test Editor.app', '/tmp/mac folder'],
      options: { detached: true, stdio: 'ignore' },
    },
    {
      command: 'open',
      args: ['-a', '/Applications/Test Shell.app', '/tmp/mac folder'],
      options: { detached: true, stdio: 'ignore' },
    },
  ])
  assert.ok(mac.spawned.every(child => child.unrefCalled))

  const windowsPath = "C:\\Users\\Desktop Plus\\café 'quoted' $branch"
  const windows = createRuntime(
    'win32',
    {
      editors: [{ name: 'Test Editor', path: 'C:\\Tools\\Editor.exe' }],
      shells: [
        {
          name: 'Command Prompt',
          path: 'C:\\Windows\\System32\\cmd.exe',
        },
      ],
    },
    'C:\\Users\\Desktop Plus\\selected\\\n'
  )
  assert.equal(
    await windows.services.selectDirectory({ title: "Open O'Brien worktree" }),
    'C:\\Users\\Desktop Plus\\selected'
  )
  assert.equal(
    await windows.services.selectSavePath({ title: 'Save Windows file' }),
    'C:\\Users\\Desktop Plus\\selected'
  )
  await windows.services.openPath(windowsPath, true)
  await windows.services.moveToTrash(windowsPath)
  await windows.services.launchIntegration({
    kind: 'editor',
    target: windowsPath,
    name: 'Test Editor',
  })
  await windows.services.launchIntegration({
    kind: 'shell',
    target: windowsPath,
    name: 'Command Prompt',
  })
  assert.deepEqual(
    windows.commands.slice(0, 2).map(command => command.command),
    ['powershell.exe', 'powershell.exe']
  )
  assert.match(windows.commands[0].args[2], /FolderBrowserDialog/)
  assert.match(windows.commands[0].args[2], /Open O''Brien worktree/)
  assert.match(windows.commands[1].args[2], /SaveFileDialog/)
  assert.deepEqual(windows.commands.slice(2), [
    { command: 'explorer.exe', args: ['/select,', windowsPath] },
    {
      command: 'powershell.exe',
      args: [
        '-NoProfile',
        '-Command',
        `Add-Type -AssemblyName Microsoft.VisualBasic; [Microsoft.VisualBasic.FileIO.FileSystem]::DeleteFile('C:\\Users\\Desktop Plus\\café ''quoted'' $branch', 'OnlyErrorDialogs', 'SendToRecycleBin')`,
      ],
    },
    {
      command: 'C:\\Tools\\Editor.exe',
      args: [windowsPath],
      options: { detached: true, stdio: 'ignore' },
    },
    {
      command: 'C:\\Windows\\System32\\cmd.exe',
      args: ['/K', 'cd', '/d', windowsPath],
      options: { detached: true, stdio: 'ignore' },
    },
  ])
  assert.ok(windows.spawned.every(child => child.unrefCalled))
  console.log(
    `Web platform smoke passed: ${process.platform}, ${integrations.editors.length} editors, ${integrations.shells.length} shells, injected macOS, Windows, and Linux process services`
  )
}

main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
