import { createServerFn } from '@tanstack/react-start'
import { parseAtUri } from 'airspace'

import { createAccount, demoSession, endSession, useDemoAirspace } from './demo.ts'

/** The visitor's sandbox account, or null when not signed in. */
export const getAccount = createServerFn({ method: 'GET', strict: false }).handler(async () => {
  const { data } = await demoSession()
  return data.did && data.handle ? { did: data.did, handle: data.handle } : null
})

export const getNotes = createServerFn({ method: 'GET', strict: false }).handler(async () => {
  const airspace = await useDemoAirspace()
  const me = await airspace.profile.get()
  const notes = await airspace.notes.list({ with: ['tag'] })
  return { profile: me?.value ?? null, notes }
})

export const getNote = createServerFn({ method: 'GET', strict: false })
  .validator((rkey: string) => rkey)
  .handler(async ({ data: rkey }) => {
    const airspace = await useDemoAirspace()
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
  const airspace = await useDemoAirspace()
  return (await airspace.profile.get())?.value ?? null
})

export const saveProfile = createServerFn({ method: 'POST', strict: false })
  .validator((body: { displayName: string, bio?: string }) => body)
  .handler(async ({ data }) => {
    const airspace = await useDemoAirspace()
    return await airspace.profile.put({ displayName: data.displayName, bio: data.bio || undefined })
  })

export const getDrafts = createServerFn({ method: 'GET', strict: false }).handler(async () => {
  const airspace = await useDemoAirspace()
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

    const airspace = await useDemoAirspace()
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
    const airspace = await useDemoAirspace()
    const draft = await airspace.workspace.notes.get(rkey)
    if (!draft)
      throw new Error('No such draft')

    const tagRkey = draft.value.tag ? parseAtUri(draft.value.tag.uri).rkey : undefined
    if (tagRkey && !(await airspace.workspace.tags.published()).includes(tagRkey))
      await airspace.workspace.tags.publish(tagRkey)

    return await airspace.workspace.notes.publish(rkey)
  })

/** Port of the upstream `session.post.ts`: create a sandbox account and seed it. */
export const startSession = createServerFn({ method: 'POST', strict: false }).handler(async () => {
  const account = await createAccount()
  const airspace = await useDemoAirspace()
  await airspace.workspace.manage.ensure()
  await airspace.profile.put({ displayName: account.handle.split('.')[0]!, bio: 'A sandbox account on the airspace demo PDS.' })
  for (const name of ['ideas', 'writing']) await airspace.workspace.tags.create({ name })
  return { did: account.did, handle: account.handle }
})

/** Port of the upstream `reset.post.ts`: wipe the account's drafts and published notes. */
export const resetNotes = createServerFn({ method: 'POST', strict: false }).handler(async () => {
  const airspace = await useDemoAirspace()
  const [drafts, notes] = await Promise.all([airspace.workspace.notes.list(), airspace.notes.list()])
  await Promise.all([
    ...drafts.map(draft => airspace.workspace.notes.delete(draft.rkey)),
    ...notes.map(note => airspace.notes.delete(note.rkey)),
  ])
  return { deleted: drafts.length + notes.length }
})

/** Port of the upstream `session.delete.ts`: clear the cookie and server caches. */
export const signOut = createServerFn({ method: 'POST', strict: false }).handler(async () => {
  await endSession()
  return { ok: true }
})
