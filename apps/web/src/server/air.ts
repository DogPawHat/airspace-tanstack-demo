import { createServerFn } from '@tanstack/react-start'
import { parseAtUri } from 'airspace'

import { getDemoAccount, useAirspace } from './airspace.ts'

export const getAccount = createServerFn({ method: 'GET', strict: false }).handler(async () => {
  return await getDemoAccount()
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
