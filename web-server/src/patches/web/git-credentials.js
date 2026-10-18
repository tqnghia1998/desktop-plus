const { execFileSync } = require('child_process')
const fs = require('fs')
const path = require('path')

let macOSCredentialHelperExecPath
let resolvedMacOSCredentialHelperExecPath = false

function credentialLookupEnvironment() {
  return {
    ...process.env,
    // Drop transient config inherited from an editor, while retaining helpers
    // configured in the user's Git config (such as osxkeychain or GCM).
    GIT_CONFIG_PARAMETERS: '',
    GIT_TERMINAL_PROMPT: '0',
    GIT_ASKPASS: process.execPath,
    SSH_ASKPASS: process.execPath,
    GCM_INTERACTIVE: 'never',
    GIT_CONFIG_COUNT: '2',
    GIT_CONFIG_KEY_0: 'credential.interactive',
    GIT_CONFIG_VALUE_0: 'false',
    GIT_CONFIG_KEY_1: 'core.askPass',
    GIT_CONFIG_VALUE_1: '',
    ...macOSCredentialHelperEnvironment(),
  }
}

function macOSCredentialHelperEnvironment() {
  if (process.platform !== 'darwin') return {}

  // Dugite's macOS Git intentionally does not bundle the Keychain helper. If
  // the user selected `credential.helper=osxkeychain`, point Git at a system
  // Git exec directory that does include it. This preserves the user's helper
  // configuration instead of replacing it with an app-specific credential.
  if (!resolvedMacOSCredentialHelperExecPath) {
    resolvedMacOSCredentialHelperExecPath = true
    try {
      const execPath = execFileSync('git', ['--exec-path'], {
        encoding: 'utf8',
        env: { ...process.env, GIT_EXEC_PATH: '' },
        timeout: 5_000,
      }).trim()
      if (fs.existsSync(path.join(execPath, 'git-credential-osxkeychain')))
        macOSCredentialHelperExecPath = execPath
    } catch {}
  }
  if (macOSCredentialHelperExecPath)
    return { GIT_EXEC_PATH: macOSCredentialHelperExecPath }

  for (const execPath of [
    '/opt/homebrew/opt/git/libexec/git-core',
    '/usr/local/opt/git/libexec/git-core',
    '/Library/Developer/CommandLineTools/usr/libexec/git-core',
    '/Applications/Xcode.app/Contents/Developer/usr/libexec/git-core',
  ]) {
    if (fs.existsSync(path.join(execPath, 'git-credential-osxkeychain'))) {
      macOSCredentialHelperExecPath = execPath
      return { GIT_EXEC_PATH: execPath }
    }
  }
  return {}
}

module.exports = { credentialLookupEnvironment }
