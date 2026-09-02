const path = require('path')

const MAX_ARGUMENT_LENGTH = 64 * 1024
const MAX_PATH_LENGTH = 32 * 1024

function requireString(value, name, maxLength = MAX_ARGUMENT_LENGTH) {
  if (typeof value !== 'string' || value.length === 0) {
    throw Object.assign(new Error(`${name} (string) is required`), {
      statusCode: 400,
    })
  }
  if (value.length > maxLength || value.includes('\0')) {
    throw Object.assign(new Error(`${name} is too large or invalid`), {
      statusCode: 400,
    })
  }
  return value
}

function requireText(value, name, maxLength = MAX_ARGUMENT_LENGTH) {
  if (typeof value !== 'string' || value.includes('\0')) {
    throw Object.assign(new Error(`${name} (string) is required`), {
      statusCode: 400,
    })
  }
  if (value.length > maxLength) {
    throw Object.assign(new Error(`${name} is too large or invalid`), {
      statusCode: 400,
    })
  }
  return value
}

function requireGitValue(value, name) {
  const result = requireString(value, name)
  if (
    result.startsWith('-') ||
    /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(result)
  ) {
    throw Object.assign(new Error(`${name} is invalid`), { statusCode: 400 })
  }
  return result
}

function requireAbsolutePath(value, name = 'path') {
  const result = requireString(value, name, MAX_PATH_LENGTH)
  if (!path.isAbsolute(result)) {
    throw Object.assign(new Error(`${name} must be an absolute path`), {
      statusCode: 400,
    })
  }
  return path.normalize(result)
}

function requireArray(value, name) {
  if (!Array.isArray(value)) {
    throw Object.assign(new Error(`${name} must be an array`), {
      statusCode: 400,
    })
  }
  return value
}

function requireBoolean(value, name) {
  if (typeof value !== 'boolean') {
    throw Object.assign(new Error(`${name} must be a boolean`), {
      statusCode: 400,
    })
  }
  return value
}

function requireInteger(value, name, min = 0, max = Number.MAX_SAFE_INTEGER) {
  if (!Number.isInteger(value) || value < min || value > max) {
    throw Object.assign(
      new Error(`${name} must be an integer between ${min} and ${max}`),
      {
        statusCode: 400,
      }
    )
  }
  return value
}

module.exports = {
  MAX_ARGUMENT_LENGTH,
  MAX_PATH_LENGTH,
  requireString,
  requireText,
  requireGitValue,
  requireAbsolutePath,
  requireArray,
  requireBoolean,
  requireInteger,
}
