import { createFileRoute } from '@tanstack/react-router'
import { Link } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { useQueryClient } from '@tanstack/react-query'
import { useRef, useState } from 'react'

import { DemoShell } from '../components/DemoShell.tsx'
import { createDraft, publishDraft } from '../server/air.ts'
import { accountQuery, draftsQuery, useAccount, useDrafts } from '../queries.ts'

export const Route = createFileRoute('/drafts')({
  loader: ({ context }) => Promise.all([
    context.queryClient.ensureQueryData(accountQuery()),
    context.queryClient.ensureQueryData(draftsQuery()).catch(() => null),
  ]),
  component: DraftsPage,
})

function DraftsPage() {
  const { data } = useDrafts()
  const { data: account } = useAccount()
  const createDraftFn = useServerFn(createDraft)
  const publishDraftFn = useServerFn(publishDraft)
  const formRef = useRef<HTMLFormElement>(null)
  const [busy, setBusy] = useState(false)
  const [publishing, setPublishing] = useState<string | null>(null)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const queryClient = useQueryClient()

  if (!account) {
    return (
      <DemoShell>
        <div className="demo-page">
          <header>
            <span className="icon" aria-hidden="true">◐</span>
            <h1>Drafts</h1>
            <p>Private to this account, in a permissioned space. Publishing copies a draft into the public repo.</p>
          </header>
          <p className="demo-empty">
            Press <strong>Try it</strong> to create a sandbox account first.
          </p>
        </div>
      </DemoShell>
    )
  }

  if (!data)
    return null

  const tagName = (draft: typeof data.drafts[number]) => {
    if (!draft.value.tag)
      return undefined
    const rkey = draft.value.tag.uri.split('/').pop()
    return data.tags.find(tag => tag.rkey === rkey)?.name
  }

  async function create() {
    if (!formRef.current)
      return
    setBusy(true)
    setError('')
    setNotice('')
    try {
      await createDraftFn({ data: new FormData(formRef.current) })
      formRef.current.reset()
      formRef.current.querySelector<HTMLInputElement>('input[name="newTag"]')!.value = ''
      setNotice('saved to the workspace space')
    }
    catch (cause) {
      setError((cause as Error).message ?? 'something went wrong')
    }
    finally {
      setBusy(false)
      await queryClient.invalidateQueries({ queryKey: ['drafts'] })
      await queryClient.invalidateQueries({ queryKey: ['notes'] })
    }
  }

  async function publish(rkey: string) {
    setPublishing(rkey)
    setError('')
    try {
      await publishDraftFn({ data: rkey })
    }
    catch (cause) {
      setError((cause as Error).message ?? 'something went wrong')
    }
    finally {
      setPublishing(null)
      await queryClient.invalidateQueries({ queryKey: ['drafts'] })
      await queryClient.invalidateQueries({ queryKey: ['notes'] })
    }
  }

  return (
    <DemoShell>
      <div className="demo-page">
        <header>
          <span className="icon" aria-hidden="true">◐</span>
          <h1>Drafts</h1>
          <p>Private to this account, in a permissioned space. Publishing copies a draft into the public repo.</p>
        </header>

        {data.drafts.length
          ? (
              <ul className="demo-rows">
                {data.drafts.map((draft) => {
                  const tag = tagName(draft)
                  return (
                    <li key={draft.uri}>
                      <span className="title">{draft.value.title}</span>
                      {tag ? <span className="tag">{tag}</span> : null}
                      {draft.published
                        ? <Link to="/notes/$rkey" params={{ rkey: draft.rkey }} className="meta">published ↗</Link>
                        : (
                            <button disabled={busy || publishing !== null} onClick={() => void publish(draft.rkey)}>
                              {publishing === draft.rkey ? 'Publishing…' : 'Publish'}
                            </button>
                          )}
                    </li>
                  )
                })}
              </ul>
            )
          : <p className="demo-empty">No drafts yet.</p>}

        <form ref={formRef} className="demo-form" onSubmit={e => void create()}>
          <h3>New draft</h3>
          <input name="title" placeholder="Title" required />
          <textarea name="body" rows={5} placeholder="Body, in markdown" />
          <div className="row">
            <select name="tag">
              <option value="">No tag</option>
              {data.tags.map(tag => (
                <option key={tag.rkey} value={tag.rkey}>{tag.name}</option>
              ))}
            </select>
            <input name="newTag" placeholder="or a new tag" />
          </div>
          <div className="row">
            <input type="file" name="cover" accept="image/*" />
          </div>
          <footer>
            <button type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save draft'}</button>
            {error ? <p className="error" role="alert">{error}</p> : null}
            {notice && !error ? <p className="ok" role="status">{notice}</p> : null}
          </footer>
        </form>
      </div>
    </DemoShell>
  )
}
