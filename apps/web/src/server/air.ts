import { createServerFn } from '@tanstack/react-start'
import { parseAtUri } from 'airspace'
import { randomBytes, randomUUID } from 'node:crypto'
import { setResponseHeader } from '@tanstack/react-start/server'

import { airspaceFor, forgetAirspace, useAirspace } from './airspace.ts'
import { currentAccount, requireAccount, useDemoSession } from './session.ts'

export const getAccount = createServerFn({ method: 'GET', strict: false }).handler(async () => {
  setResponseHeader('Cache-Control', 'private, no-store')
  const account = await currentAccount()
  return account ? { did: account.did, handle: account.handle } : null
})

export const createAccount = createServerFn({ method: 'POST', strict: false }).handler(async () => {
  const existing = await currentAccount()
  if (existing)
    return { did: existing.did, handle: existing.handle }

  const service = (process.env.AIRSPACE_SERVICE ?? 'http://localhost:2583').replace(/\/$/, '')
  const describe = await fetch(`${service}/xrpc/com.atproto.server.describeServer`)
  if (!describe.ok)
    throw new Error(`demo PDS at ${service} is not answering`)
  const server = await describe.json() as { availableUserDomains?: string[], inviteCodeRequired?: boolean }
  const name = `demo-${randomUUID().slice(0, 8)}`
  const account = {
    did: '',
    handle: `${name}${server.availableUserDomains?.[0] ?? '.test'}`,
    password: randomBytes(15).toString('base64url'),
  }
  const inviteCode = process.env.AIRSPACE_PDS_INVITE_CODE
  if (server.inviteCodeRequired && !inviteCode)
    throw new Error('demo PDS requires an invite code, but AIRSPACE_PDS_INVITE_CODE is not configured')
  const created = await fetch(`${service}/xrpc/com.atproto.server.createAccount`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      handle: account.handle,
      email: `${name}@demo.invalid`,
      password: account.password,
      ...(inviteCode ? { inviteCode } : {}),
    }),
  })
  if (!created.ok)
    throw new Error(`could not create a sandbox account: ${await created.text()}`)
  account.did = (await created.json() as { did: string }).did
  await (await useDemoSession()).update(account)
  try {
    const airspace = await airspaceFor(account)
    await airspace.profile.put({ displayName: name, bio: 'A sandbox account on the airspace demo PDS.' })
    for (const tag of ['ideas', 'writing'])
      await airspace.tags.create({ name: tag })
  }
  catch (error) {
    forgetAirspace(account.did)
    await (await useDemoSession()).clear()
    throw error
  }
  return { did: account.did, handle: account.handle }
})

export const signOut = createServerFn({ method: 'POST', strict: false }).handler(async () => {
  const account = await currentAccount()
  if (account)
    forgetAirspace(account.did)
  await (await useDemoSession()).clear()
  return { ok: true }
})

export const resetSandbox = createServerFn({ method: 'POST', strict: false }).handler(async () => {
  await requireAccount()
  const airspace = await useAirspace()
  const [drafts, notes] = await Promise.all([airspace.workspace.notes.list(), airspace.notes.list()])
  await Promise.all([
    ...drafts.map(draft => airspace.workspace.notes.delete(draft.rkey)),
    ...notes.map(note => airspace.notes.delete(note.rkey)),
  ])
  return { deleted: drafts.length + notes.length }
})

export const getNotes = createServerFn({ method: 'GET', strict: false }).handler(async () => {
  const airspace = await useAirspace()
  const me = await airspace.profile.get()
  const notes = await airspace.notes.list({ with: ['tag'] })
  return { profile: me?.value ?? null, notes }
})

export const getNote = createServerFn({ method: 'GET', strict: false })
  .validator((rkey: string) => rkey)
  .handler(async ({ data: rkey }) => {
    const airspace = await useAirspace()
    const note = await airspace.notes.get(rkey)
    if (!note)
      throw new Error('No such note')
    const [tag, cover] = await Promise.all([
      airspace.notes.resolve(note, 'tag'),
      airspace.blobs.url(note.value.cover),
    ])
    return { note, tag: tag?.value.name ?? null, cover }
  })

export const getProfile = createServerFn({ method: 'GET', strict: false }).handler(async () => {
  const airspace = await useAirspace()
  return (await airspace.profile.get())?.value ?? null
})

export const saveProfile = createServerFn({ method: 'POST', strict: false })
  .validator((body: { displayName: string, bio?: string }) => body)
  .handler(async ({ data }) => {
    const airspace = await useAirspace()
    return await airspace.profile.put({ displayName: data.displayName, bio: data.bio || undefined })
  })

export const getDrafts = createServerFn({ method: 'GET', strict: false }).handler(async () => {
  const airspace = await useAirspace()
  const [drafts, live, tags] = await Promise.all([
    airspace.workspace.notes.list(),
    airspace.workspace.notes.published(),
    airspace.workspace.tags.list(),
  ])
  return {
    drafts: drafts.map(draft => ({ ...draft, published: live.includes(draft.rkey) })),
    tags: tags.map(tag => ({ rkey: tag.rkey, name: tag.value.name })),
  }
})

export const createDraft = createServerFn({ method: 'POST', strict: false })
  .validator((data: FormData) => data)
  .handler(async ({ data }) => {
  const str = (name: string) => {
    const value = data.get(name)
    return typeof value === 'string' ? value.trim() : undefined
  }

  const airspace = await useAirspace()
  const newTag = str('newTag')
  const existingTag = str('tag')
  const tag = newTag
    ? await airspace.workspace.tags.create({ name: newTag })
    : existingTag
      ? ((await airspace.workspace.tags.get(existingTag)) ?? null)
      : null

  const file = data.get('cover') as File | null
  const cover = file?.size
    ? (await airspace.blobs.upload(new Uint8Array(await file.arrayBuffer()), { mimeType: file.type || 'application/octet-stream' })).blob
    : undefined

  return await airspace.workspace.notes.create({
    title: str('title') ?? '',
    body: str('body') ?? '',
    tag: tag ? { uri: tag.uri, cid: tag.cid } : undefined,
    cover,
  })
})

export const publishDraft = createServerFn({ method: 'POST', strict: false })
  .validator((rkey: string) => rkey)
  .handler(async ({ data: rkey }) => {
    const airspace = await useAirspace()
    const draft = await airspace.workspace.notes.get(rkey)
    if (!draft)
      throw new Error('No such draft')

    const tagRkey = draft.value.tag ? parseAtUri(draft.value.tag.uri).rkey : undefined
    if (tagRkey && !(await airspace.workspace.tags.published()).includes(tagRkey))
      await airspace.workspace.tags.publish(tagRkey)

    return await airspace.workspace.notes.publish(rkey)
  })
