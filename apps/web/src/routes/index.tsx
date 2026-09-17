import { createFileRoute } from '@tanstack/react-router'
import { Link } from '@tanstack/react-router'

import { DemoShell } from '../components/DemoShell.tsx'
import { accountQuery, notesQuery, useAccount, useNotes } from '../queries.ts'

export const Route = createFileRoute('/')({
  loader: ({ context }) => Promise.all([
    context.queryClient.ensureQueryData(accountQuery()),
    context.queryClient.ensureQueryData(notesQuery()).catch(() => null),
  ]),
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
                  A notes app on a sandbox account on our own PDS. Published notes live in the
                  account's public repo, drafts in a permissioned space. Sandbox accounts are
                  wiped periodically.
                </p>
              )}
        </header>

        {account
          ? data
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
                          <a
                            href={`https://pdsls.dev/at://${account.did}/${collection}/${note.rkey}`}
                            className="meta"
                            target="_blank"
                            rel="noopener"
                          >
                            record ↗
                          </a>
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
            : (
                <p className="demo-empty">
                  Couldn't load notes.
                </p>
              )
          : (
              <p className="demo-empty">
                Press <strong>Try it</strong> to create a sandbox account and start writing.
              </p>
            )}
      </div>
    </DemoShell>
  )
}
