import { createFileRoute, Link } from '@tanstack/react-router'
import { MarkdownDocument } from '@comark/react'

import { DemoShell } from '../components/DemoShell.tsx'
import { accountQuery, noteQuery, useAccount, useNote } from '../queries.ts'

export const Route = createFileRoute('/notes/$rkey')({
  loader: ({ context, params }) =>
    Promise.all([
      context.queryClient.ensureQueryData(noteQuery(params.rkey)).catch(() => null),
      context.queryClient.ensureQueryData(accountQuery()),
    ]),
  component: NotePage,
})

function formatDate(iso: string) {
  return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}

function NotePage() {
  const { rkey } = Route.useParams()
  const { data } = useNote(rkey)
  const { data: account } = useAccount()

  return (
    <DemoShell>
      <div className="demo-page">
        {data
          ? (
              <>
                <header>
                  <Link to="/" className="back">← Notes</Link>
                  <h1>{data.note.value.title}</h1>
                </header>

                <dl className="demo-props">
                  {data.tag
                    ? (
                        <>
                          <dt>tag</dt>
                          <dd><span className="tag">{data.tag}</span></dd>
                        </>
                      )
                    : null}
                  {data.note.value.createdAt
                    ? (
                        <>
                          <dt>created</dt>
                          <dd>{formatDate(data.note.value.createdAt)}</dd>
                        </>
                      )
                    : null}
                  <dt>record</dt>
                  <dd>
                    <code>{rkey}</code>
                    {account
                      ? (
                          <a
                            href={`https://pdsls.dev/at://${account.did}/tech.dogpawhat.airspace-demo.notes.note/${rkey}`}
                            target="_blank"
                            rel="noopener"
                          >
                            view on pdsls ↗
                          </a>
                        )
                      : null}
                  </dd>
                </dl>

                {data.cover ? <img src={data.cover} alt={data.note.value.title} className="demo-cover" /> : null}
                <div className="demo-body">
                  <MarkdownDocument value={data.note.meta.markdown ?? undefined} />
                  {!data.note.meta.markdown ? <p>{data.note.value.body}</p> : null}
                </div>
              </>
            )
          : (
              <>
                <header>
                  <Link to="/" className="back">← Notes</Link>
                  <h1>Note</h1>
                </header>
                <p className="demo-empty">
                  {account ? 'no such note' : <>Press <strong>Try it</strong> to create a sandbox account first.</>}
                </p>
              </>
            )}
      </div>
    </DemoShell>
  )
}
