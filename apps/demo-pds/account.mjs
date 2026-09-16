/* eslint-disable no-console, antfu/no-top-level-await */
import { Buffer } from 'node:buffer'
import { randomBytes } from 'node:crypto'
import process from 'node:process'

const service = (process.env.PDS_SERVICE ?? 'http://localhost:2583').replace(/\/$/, '')
const inviteCode = process.env.PDS_INVITE_CODE
const adminPassword = process.env.PDS_ADMIN_PASSWORD
const name = process.env.ACCOUNT_NAME ?? 'alice'
const password = process.env.ACCOUNT_PASSWORD ?? 'hunter2'
const email = process.env.ACCOUNT_EMAIL ?? `${name}@demo.invalid`

async function xrpc(method, { body, params, token, admin } = {}) {
  const url = new URL(`${service}/xrpc/${method}`)
  for (const [key, value] of Object.entries(params ?? {})) url.searchParams.set(key, value)
  const headers = {}
  if (body)
    headers['content-type'] = 'application/json'
  if (token)
    headers.authorization = `Bearer ${token}`
  if (admin)
    headers.authorization = `Basic ${Buffer.from(`admin:${adminPassword}`).toString('base64')}`
  const res = await fetch(url, { method: body ? 'POST' : 'GET', headers, body: body && JSON.stringify(body) })
  const text = await res.text()
  if (!res.ok)
    throw new Error(`${method} -> ${res.status} ${text}`)
  return text ? JSON.parse(text) : {}
}

const server = await xrpc('com.atproto.server.describeServer')
const domain = server.availableUserDomains[0] ?? '.test'
const handle = name.includes('.') ? name : `${name}${domain}`
const body = { handle, email, password }
if (server.inviteCodeRequired) {
  if (adminPassword) {
    const code = await xrpc('com.atproto.server.createInviteCode', { admin: true, body: { useCount: 1 } })
    body.inviteCode = code.code
  }
  else if (inviteCode) {
    body.inviteCode = inviteCode
  }
  else {
    throw new Error('invite required: run `pnpm invite` and set PDS_INVITE_CODE, or set PDS_ADMIN_PASSWORD')
  }
}

const account = await xrpc('com.atproto.server.createAccount', { body })
console.log(`# ${service} (did ${account.did}). Copy into apps/web/.env:`)
console.log(`AIRSPACE_SERVICE=${service}`)
console.log(`AIRSPACE_IDENTIFIER=${handle}`)
console.log(`AIRSPACE_PASSWORD=${password}`)
