import { createFileRoute } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { useQueryClient } from '@tanstack/react-query'
import { useRef, useState } from 'react'

import { createDraft, publishDraft } from '../server/air.ts'
import { draftsQuery, useDrafts } from '../queries.ts'

export const Route = createFileRoute('/drafts')({
  loader: ({ context }) => context.queryClient.ensureQueryData(draftsQuery()),
  component: DraftsPage,
})

function DraftsPage() {
  const { data } = useDrafts()
  const createDraftFn = useServerFn(createDraft)
  const publishDraftFn = useServerFn(publishDraft)
  const formRef = useRef<HTMLFormElement>(null)
  const [busy, setBusy] = useState(false)
  const queryClient = useQueryClient()

  if (!data)
    return null

  async function create() {
    if (!formRef.current)
      return
    setBusy(true)
    try {
      await createDraftFn({ data: new FormData(formRef.current) })
      formRef.current.reset()
      formRef.current.querySelector<HTMLInputElement>('input[name="newTag"]')!.value = ''
    }
    finally {
      setBusy(false)
      await queryClient.invalidateQueries({ queryKey: ['drafts'] })
      await queryClient.invalidateQueries({ queryKey: ['notes'] })
    }
  }

  async function publish(rkey: string) {
    await publishDraftFn({ data: rkey })
    await queryClient.invalidateQueries({ queryKey: ['drafts'] })
    await queryClient.invalidateQueries({ queryKey: ['notes'] })
  }

  return (
    <div>
      <h1>Drafts</h1>
      <form ref={formRef} onSubmit={e => void create()}>
        <p><input name="title" placeholder="Title" required /></p>
        <p><textarea name="body" placeholder="# Markdown body" /></p>
        <p>
          <select name="tag">
            <option value="">no tag</option>
            {data.tags.map(tag => (
              <option key={tag.rkey} value={tag.rkey}>{tag.name}</option>
            ))}
          </select>
          <input name="newTag" placeholder="or a new tag" />
        </p>
        <p><input type="file" name="cover" accept="image/*" /></p>
        <button type="submit" disabled={busy}>Create draft</button>
      </form>

      {data.drafts.map(draft => (
        <article key={draft.uri}>
          <h2>{draft.value.title}</h2>
          {draft.published ? <p>published</p> : <button onClick={() => void publish(draft.rkey)}>Publish</button>}
        </article>
      ))}
    </div>
  )
}
