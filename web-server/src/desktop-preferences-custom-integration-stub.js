const TargetPathArgument = '%TARGET_PATH%'
const WindowsExecutableExtensions = ['exe', 'com']

function parseCustomIntegrationArguments(value) {
  return value.trim() ? value.trim().split(/\s+/) : []
}

function checkTargetPathArgument(args) {
  return args.some(arg => arg.includes(TargetPathArgument))
}

async function validateCustomIntegrationPath(path) {
  return { isValid: Boolean(path.trim()) }
}

async function isValidCustomIntegration(integration) {
  return (
    Boolean(integration?.path?.trim()) &&
    checkTargetPathArgument(
      parseCustomIntegrationArguments(integration.arguments || '')
    )
  )
}

module.exports = {
  TargetPathArgument,
  WindowsExecutableExtensions,
  checkTargetPathArgument,
  isValidCustomIntegration,
  parseCustomIntegrationArguments,
  validateCustomIntegrationPath,
}
