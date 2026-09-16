import { createNotesAirspace } from './src/server/airspace.ts'

const airspace = await createNotesAirspace()
console.log('did:', airspace.notes ? 'notes ok' : 'no notes')

const tag =
  (await airspace.workspace.tags.list()).find(t => t.value.name === 'demo')
  ?? await airspace.workspace.tags.create({ name: 'demo' })

const note = await airspace.workspace.notes.create({
  title: 'Hello from TanStack Start',
  body: '# hello\n\nfrom the **tanstack** demo.',
  tag: { uri: tag.uri, cid: tag.cid },
})
await airspace.workspace.notes.publish(note.rkey)

const note2 = await airspace.workspace.notes.create({
  title: 'A published note, directly in the repo',
  body: 'draft-free note 🎉',
})
console.log('created:', note.rkey, note2.rkey)
