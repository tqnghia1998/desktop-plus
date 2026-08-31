const childProcess = require('child_process')
const fs = require('fs')
const os = require('os')
const path = require('path')

const run = (command, args, execute = childProcess.execFile) =>
  new Promise((resolve, reject) => {
    execute(command, args, error => (error ? reject(error) : resolve()))
  })

const editorCandidates = {
  darwin: [
    ['Visual Studio Code', '/Applications/Visual Studio Code.app'],
    [
      'Visual Studio Code (Insiders)',
      '/Applications/Visual Studio Code - Insiders.app',
    ],
    ['Cursor', '/Applications/Cursor.app'],
    ['Windsurf', '/Applications/Windsurf.app'],
    ['Zed', '/Applications/Zed.app'],
    ['Sublime Text', '/Applications/Sublime Text.app'],
    ['IntelliJ IDEA', '/Applications/IntelliJ IDEA.app'],
    ['WebStorm', '/Applications/WebStorm.app'],
    ['PyCharm', '/Applications/PyCharm.app'],
    ['Xcode', '/Applications/Xcode.app'],
  ],
  win32: [
    [
      'Visual Studio Code',
      path.join(
        process.env.LOCALAPPDATA || '',
        'Programs',
        'Microsoft VS Code',
        'Code.exe'
      ),
    ],
    [
      'Visual Studio Code',
      path.join(
        process.env.ProgramFiles || '',
        'Microsoft VS Code',
        'Code.exe'
      ),
    ],
    [
      'Cursor',
      path.join(
        process.env.LOCALAPPDATA || '',
        'Programs',
        'cursor',
        'Cursor.exe'
      ),
    ],
    [
      'Sublime Text',
      path.join(
        process.env.ProgramFiles || '',
        'Sublime Text',
        'sublime_text.exe'
      ),
    ],
    ['Notepad', path.join(process.env.WINDIR || 'C:\\Windows', 'notepad.exe')],
  ],
  linux: [
    ['Visual Studio Code', '/usr/bin/code'],
    ['Visual Studio Code', '/snap/bin/code'],
    ['Visual Studio Code (Insiders)', '/usr/bin/code-insiders'],
    ['VSCodium', '/usr/bin/codium'],
    ['Cursor', '/usr/bin/cursor'],
    ['Zed', '/usr/bin/zed-editor'],
    ['Sublime Text', '/usr/bin/subl'],
    ['Kate', '/usr/bin/kate'],
    ['GNOME Text Editor', '/usr/bin/gnome-text-editor'],
    ['GEdit', '/usr/bin/gedit'],
    ['Neovim', '/usr/bin/nvim'],
  ],
}

const shellCandidates = {
  darwin: [
    ['Terminal', '/System/Applications/Utilities/Terminal.app'],
    ['iTerm2', '/Applications/iTerm.app'],
    ['Warp', '/Applications/Warp.app'],
    ['Ghostty', '/Applications/Ghostty.app'],
    ['Alacritty', '/Applications/Alacritty.app'],
  ],
  win32: [
    [
      'Command Prompt',
      path.join(process.env.WINDIR || 'C:\\Windows', 'System32', 'cmd.exe'),
    ],
    [
      'Windows PowerShell',
      path.join(
        process.env.WINDIR || 'C:\\Windows',
        'System32',
        'WindowsPowerShell',
        'v1.0',
        'powershell.exe'
      ),
    ],
    [
      'Windows Terminal',
      path.join(
        process.env.LOCALAPPDATA || '',
        'Microsoft',
        'WindowsApps',
        'wt.exe'
      ),
    ],
  ],
  linux: [
    ['GNOME Terminal', '/usr/bin/gnome-terminal'],
    ['GNOME Console', '/usr/bin/kgx'],
    ['Ptyxis', '/usr/bin/ptyxis'],
    ['Konsole', '/usr/bin/konsole'],
    ['XFCE Terminal', '/usr/bin/xfce4-terminal'],
    ['Tilix', '/usr/bin/tilix'],
    ['Alacritty', '/usr/bin/alacritty'],
    ['Kitty', '/usr/bin/kitty'],
    ['Ghostty', '/usr/bin/ghostty'],
    ['XTerm', '/usr/bin/xterm'],
  ],
}

async function exists(target) {
  if (!target) return false
  try {
    await fs.promises.access(target, fs.constants.F_OK)
    return true
  } catch {
    return false
  }
}

async function isExecutable(target) {
  if (!(await exists(target))) return false
  if (process.platform === 'darwin' && target.endsWith('.app')) return true
  try {
    const stat = await fs.promises.stat(target)
    if (!stat.isFile()) return false
    if (process.platform === 'win32') return /\.(?:exe|com)$/i.test(target)
    await fs.promises.access(target, fs.constants.X_OK)
    return true
  } catch {
    return false
  }
}

async function findCommand(command, runtime = {}) {
  const platformName = runtime.platform || process.platform
  const environment = runtime.environment || process.env
  const executableExists = runtime.isExecutable || isExecutable
  const pathEntries = String(environment.PATH || '')
    .split(platformName === 'win32' ? ';' : path.delimiter)
    .filter(Boolean)
  const extensions =
    platformName === 'win32'
      ? String(environment.PATHEXT || '.EXE;.COM')
          .split(';')
          .filter(Boolean)
      : ['']
  for (const directory of pathEntries) {
    for (const extension of extensions) {
      const candidate = path.join(directory, command + extension.toLowerCase())
      if (await executableExists(candidate)) return candidate
    }
  }
  return null
}

async function discoverCandidates(candidates, runtime = {}) {
  const platformName = runtime.platform || process.platform
  const executableExists = runtime.isExecutable || isExecutable
  const found = []
  const names = new Set()
  for (const [name, target] of candidates[platformName] || []) {
    if (names.has(name) || !(await executableExists(target))) continue
    names.add(name)
    found.push({ name, path: target })
  }
  return found
}

async function discoverDarwinApplications(runtime = {}) {
  const readDirectory = runtime.readdir || fs.promises.readdir
  const homeDirectory = runtime.homeDirectory || os.homedir()
  const directories = [
    '/Applications',
    '/System/Applications',
    path.join(homeDirectory, 'Applications'),
  ]
  const applications = []
  const names = new Set()

  for (const directory of directories) {
    let entries
    try {
      entries = await readDirectory(directory)
    } catch {
      continue
    }

    for (const entry of entries) {
      const name = typeof entry === 'string' ? entry : entry.name
      if (!name || !name.endsWith('.app')) continue
      const applicationName = name.slice(0, -4)
      if (names.has(applicationName)) continue
      names.add(applicationName)
      applications.push({
        name: applicationName,
        path: path.join(directory, name),
      })
    }
  }

  return applications.sort((left, right) => left.name.localeCompare(right.name))
}

async function discoverIntegrations(runtime = {}) {
  const platformName = runtime.platform || process.platform
  const [knownEditors, shells, discoveredApplications] = await Promise.all([
    discoverCandidates(editorCandidates, runtime),
    discoverCandidates(shellCandidates, runtime),
    platformName === 'darwin'
      ? discoverDarwinApplications(runtime)
      : Promise.resolve([]),
  ])
  const knownEditorNames = new Set(knownEditors.map(editor => editor.name))
  const editors = [
    ...knownEditors,
    ...discoveredApplications.filter(
      application => !knownEditorNames.has(application.name)
    ),
  ]
  const dependencies =
    platformName === 'linux'
      ? Object.fromEntries(
          await Promise.all(
            ['zenity', 'xdg-open', 'gio'].map(async command => [
              command,
              (await findCommand(command, runtime)) !== null,
            ])
          )
        )
      : {}
  const missingDependencies = Object.entries(dependencies)
    .filter(([, available]) => !available)
    .map(([name]) => name)
  return {
    platform: platformName,
    editors,
    shells,
    dependencies,
    guidance:
      missingDependencies.length > 0
        ? `Install ${missingDependencies.join(
            ', '
          )} with your Linux distribution package manager, then restart the companion.`
        : null,
  }
}

function parseIntegrationArguments(value) {
  if (Array.isArray(value))
    return value.map(item => {
      if (typeof item !== 'string')
        throw new Error('Integration arguments must be strings')
      return item
    })
  const input = String(value || '')
  const args = []
  let current = ''
  let quote = null
  let escaped = false
  for (const character of input) {
    if (escaped) {
      current += character
      escaped = false
    } else if (character === '\\' && quote !== "'") {
      escaped = true
    } else if (quote !== null) {
      if (character === quote) quote = null
      else current += character
    } else if (character === '"' || character === "'") {
      quote = character
    } else if (/\s/.test(character)) {
      if (current) {
        args.push(current)
        current = ''
      }
    } else {
      current += character
    }
  }
  if (escaped || quote !== null)
    throw new Error(
      'Integration arguments contain an unfinished escape or quote'
    )
  if (current) args.push(current)
  return args
}

function expandTargetArguments(args, target) {
  if (!args.some(argument => argument.includes('%TARGET_PATH%')))
    throw new Error('Integration arguments must contain %TARGET_PATH%')
  return args.map(argument => argument.replaceAll('%TARGET_PATH%', target))
}

function spawnDetached(
  command,
  args,
  options = {},
  spawn = childProcess.spawn
) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      detached: true,
      stdio: 'ignore',
      ...options,
    })
    child.once('error', reject)
    child.once('spawn', () => {
      child.unref()
      resolve()
    })
  })
}

function knownShellLaunch(integration, target, runtime = {}) {
  const platformName = runtime.platform || process.platform
  const spawn = runtime.spawn || childProcess.spawn
  if (platformName === 'darwin')
    return spawnDetached('open', ['-a', integration.path, target], {}, spawn)
  if (platformName === 'win32') {
    const base = path.win32.basename(integration.path).toLowerCase()
    if (base === 'cmd.exe')
      return spawnDetached(
        integration.path,
        ['/K', 'cd', '/d', target],
        {},
        spawn
      )
    if (base === 'powershell.exe')
      return spawnDetached(
        integration.path,
        ['-NoExit', '-Command', 'Set-Location', '-LiteralPath', target],
        {},
        spawn
      )
    if (base === 'wt.exe')
      return spawnDetached(integration.path, ['-d', target], {}, spawn)
    return spawnDetached(integration.path, [], { cwd: target }, spawn)
  }
  const base = path.basename(integration.path)
  const args =
    base === 'ptyxis'
      ? ['--new-window', '--working-directory', target]
      : base === 'konsole'
      ? ['--workdir', target]
      : base === 'kitty'
      ? ['--single-instance', '--directory', target]
      : base === 'xterm'
      ? []
      : [`--working-directory=${target}`]
  return spawnDetached(integration.path, args, { cwd: target }, spawn)
}

async function launchIntegration(body, runtime = {}) {
  const platformName = runtime.platform || process.platform
  const paths = platformName === 'win32' ? path.win32 : path
  const spawn = runtime.spawn || childProcess.spawn
  const pathExists = runtime.exists || exists
  const executableExists = runtime.isExecutable || isExecutable
  const integrationsForHost =
    runtime.discoverIntegrations || (() => discoverIntegrations(runtime))
  const kind = body.kind === 'shell' ? 'shell' : 'editor'
  const target = paths.resolve(String(body.target || ''))
  if (!(await pathExists(target)))
    throw new Error(`Target does not exist: ${target}`)

  if (body.custom) {
    const executable = paths.resolve(String(body.custom.path || ''))
    if (!(await executableExists(executable)))
      throw new Error(`Integration executable is unavailable: ${executable}`)
    const args = expandTargetArguments(
      parseIntegrationArguments(body.custom.arguments),
      target
    )
    if (platformName === 'darwin' && executable.toLowerCase().endsWith('.app'))
      return spawnDetached('open', ['-a', executable, ...args], {}, spawn)
    return spawnDetached(
      executable,
      args,
      kind === 'shell' ? { cwd: target } : {},
      spawn
    )
  }

  const integrations = await integrationsForHost()
  const available =
    kind === 'shell' ? integrations.shells : integrations.editors
  const selected =
    available.find(integration => integration.name === body.name) ||
    available[0]
  if (!selected) throw new Error(`No ${kind} integration is available`)
  if (kind === 'shell') return knownShellLaunch(selected, target, runtime)
  if (platformName === 'darwin')
    return spawnDetached('open', ['-a', selected.path, target], {}, spawn)
  return spawnDetached(selected.path, [target], {}, spawn)
}

async function runIntegrationForOutput(body, runtime = {}) {
  const platformName = runtime.platform || process.platform
  const paths = platformName === 'win32' ? path.win32 : path
  const spawn = runtime.spawn || childProcess.spawn
  const pathExists = runtime.exists || exists
  const executableExists = runtime.isExecutable || isExecutable
  const target = paths.resolve(String(body.target || ''))
  if (!(await pathExists(target)))
    throw new Error(`Target does not exist: ${target}`)
  if (!body.custom)
    throw new Error('A custom integration is required to return command output')

  const executable = paths.resolve(String(body.custom.path || ''))
  if (!(await executableExists(executable)))
    throw new Error(`Integration executable is unavailable: ${executable}`)
  if (platformName === 'darwin' && executable.toLowerCase().endsWith('.app'))
    throw new Error(
      'A macOS application bundle cannot be used as a preset script'
    )

  const args = expandTargetArguments(
    parseIntegrationArguments(body.custom.arguments),
    target
  )
  const maxOutputBytes = 1024 * 1024
  return new Promise((resolve, reject) => {
    const child = spawn(executable, args, {
      cwd: target,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    let output = ''
    let settled = false
    const fail = error => {
      if (settled) return
      settled = true
      reject(error)
    }
    child.once('error', fail)
    child.stdout?.on('data', data => {
      if (settled) return
      output += data.toString()
      if (Buffer.byteLength(output) > maxOutputBytes) {
        child.kill()
        fail(new Error('Integration output is too large'))
      }
    })
    child.once('close', () => {
      if (settled) return
      settled = true
      resolve(output)
    })
  })
}

function selectPath(body, save = false, runtime = {}) {
  const platformName = runtime.platform || process.platform
  const execute = runtime.execFile || childProcess.execFile
  const title = String(
    body.title ||
      (save ? 'Choose where to save' : 'Select a Git repository folder:')
  )
  const defaultPath = String(
    body.defaultPath || runtime.homeDirectory || os.homedir()
  )
  let command
  let args
  if (platformName === 'darwin') {
    command = 'osascript'
    const chooser = save
      ? 'set selectedFolder to choose file name with prompt (item 1 of argv) default location POSIX file (item 2 of argv)'
      : 'set selectedFolder to choose folder with prompt (item 1 of argv) default location POSIX file (item 2 of argv)'
    args = [
      '-e',
      'on run argv',
      '-e',
      'try',
      '-e',
      chooser,
      '-e',
      'return POSIX path of selectedFolder',
      '-e',
      'on error',
      '-e',
      'return ""',
      '-e',
      'end try',
      '-e',
      'end run',
      title,
      defaultPath,
    ]
  } else if (platformName === 'win32') {
    command = 'powershell.exe'
    const escapedTitle = title.replace(/'/g, "''")
    const dialog = save
      ? `$d=New-Object System.Windows.Forms.SaveFileDialog; $d.Title='${escapedTitle}'`
      : `$d=New-Object System.Windows.Forms.FolderBrowserDialog; $d.Description='${escapedTitle}'`
    args = [
      '-NoProfile',
      '-Command',
      `Add-Type -AssemblyName System.Windows.Forms; ${dialog}; if($d.ShowDialog() -eq 'OK'){${
        save ? '$d.FileName' : '$d.SelectedPath'
      }}`,
    ]
  } else {
    command = 'zenity'
    args = [
      '--file-selection',
      ...(save ? ['--save', '--confirm-overwrite'] : ['--directory']),
      `--title=${title}`,
      `--filename=${defaultPath}${save ? '' : path.sep}`,
    ]
  }
  return new Promise(resolve => {
    execute(command, args, (error, stdout) =>
      resolve(error ? null : stdout.trim().replace(/[\\/]$/, '') || null)
    )
  })
}

async function openPath(target, reveal = false, runtime = {}) {
  const platformName = runtime.platform || process.platform
  const execute = runtime.execFile || childProcess.execFile
  if (platformName === 'darwin')
    return run('open', reveal ? ['-R', target] : [target], execute)
  if (platformName === 'win32')
    return run(
      'explorer.exe',
      reveal ? ['/select,', target] : [target],
      execute
    )
  return run('xdg-open', [reveal ? path.dirname(target) : target], execute)
}

async function moveToTrash(target, runtime = {}) {
  const platformName = runtime.platform || process.platform
  const execute = runtime.execFile || childProcess.execFile
  if (platformName === 'darwin') {
    return run(
      'osascript',
      [
        '-e',
        'on run argv',
        '-e',
        'tell application "Finder" to delete POSIX file (item 1 of argv)',
        '-e',
        'end run',
        target,
      ],
      execute
    )
  }
  if (platformName === 'win32') {
    const escaped = target.replace(/'/g, "''")
    return run(
      'powershell.exe',
      [
        '-NoProfile',
        '-Command',
        `Add-Type -AssemblyName Microsoft.VisualBasic; [Microsoft.VisualBasic.FileIO.FileSystem]::DeleteFile('${escaped}', 'OnlyErrorDialogs', 'SendToRecycleBin')`,
      ],
      execute
    )
  }
  return run('gio', ['trash', target], execute)
}

function createPlatformServices(runtime = {}) {
  return {
    selectDirectory: body => selectPath(body, false, runtime),
    selectSavePath: body => selectPath(body, true, runtime),
    openPath: (target, reveal) => openPath(target, reveal, runtime),
    moveToTrash: target => moveToTrash(target, runtime),
    discoverIntegrations: () => discoverIntegrations(runtime),
    launchIntegration: body => launchIntegration(body, runtime),
    runIntegrationForOutput: body => runIntegrationForOutput(body, runtime),
  }
}

module.exports = {
  ...createPlatformServices(),
  createPlatformServices,
  spawnDetached,
  runIntegrationForOutput,
}
