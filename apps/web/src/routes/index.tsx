import { createFileRoute } from '@tanstack/react-router'
import { Link } from '@tanstack/react-router'

import { DemoShell } from '../components/DemoShell.tsx'
import { accountQuery, notesQuery, useAccount, useNotes } from '../queries.ts'

export const Route = createFileRoute('/')({
  loader: ({ context }) => context.queryClient.ensureQueryData(notesQuery()),
  component: HomePage,
})

const collection = 'space.getair.notes.note'

function formatDate(iso: string | null | undefined) {
  return iso
    ? new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
    : ''
}

function HomePage() {
  const { data } = useNotes()
  const { data: account } = useAccount()
  return (
    <DemoShell>
      <div className="demo-page">
        <header>
          <span className="icon" aria-hidden="true">◇</span>
          <h1>{data?.profile?.displayName ?? 'Notes'}</h1>
          {data?.profile?.bio
            ? <p>{data.profile.bio}</p>
            : (
                <p>
                  A notes app on a service account on our own PDS. Published notes live in the
                  account's public repo, drafts in a permissioned space.
                </p>
              )}
        </header>

        {data
          ? data.notes.length
            ? (
                <ul className="demo-rows">
                  {data.notes.map((note) => {
                    const tag = note.related?.tag?.value.name
                    return (
                      <li key={note.uri}>
                        <Link to="/notes/$rkey" params={{ rkey: note.rkey }} className="title">
                          {note.value.title}
                        </Link>
                        {tag ? <span className="tag">{tag}</span> : null}
                        {note.value.createdAt ? <span className="meta">{formatDate(note.value.createdAt)}</span> : null}
                        {account
                          ? (
                              <a
                                href={`https://pdsls.dev/at://${account.did}/${collection}/${note.rkey}`}
                                className="meta"
                                target="_blank"
                                rel="noopener"
                              >
                                record ↗
                              </a>
                            )
                          : null}
                      </li>
                    )
                  })}
                </ul>
              )
            : (
                <p className="demo-empty">
                  Nothing published yet. Write a draft on the
                  {' '}
                  <Link to="/drafts">drafts</Link>
                  {' '}
                  page and publish it.
                </p>
              )
          : null}
      </div>
    </DemoShell>
  )
}
