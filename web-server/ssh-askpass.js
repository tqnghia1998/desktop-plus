#!/usr/bin/env node

const http = require('http')

const baseURL = process.env.DESKTOP_PLUS_AUTH_URL
const operationID = process.env.DESKTOP_PLUS_AUTH_OPERATION
const token = process.env.DESKTOP_PLUS_AUTH_TOKEN
const sessionToken = process.env.DESKTOP_PLUS_SESSION_TOKEN
const prompt = process.argv.slice(2).join(' ')

if (!baseURL || !operationID || !token || !sessionToken) process.exit(1)

const payload = JSON.stringify({ action: 'auth-prompt', prompt, token })
const target = new URL(
  `/api/git/operations/${encodeURIComponent(operationID)}`,
  baseURL
)
const request = http.request(
  target,
  {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(payload),
      'X-Desktop-Plus-Session': sessionToken,
    },
  },
  response => {
    let body = ''
    response.setEncoding('utf8')
    response.on('data', chunk => {
      body += chunk
    })
    response.on('end', () => {
      if (response.statusCode !== 200) process.exit(1)
      try {
        const value = JSON.parse(body).response
        if (typeof value !== 'string') process.exit(1)
        process.stdout.write(value)
      } catch {
        process.exit(1)
      }
    })
  }
)
request.on('error', () => process.exit(1))
request.end(payload)
