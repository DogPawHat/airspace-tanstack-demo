import { createFileRoute } from '@tanstack/react-router'
import { Link } from '@tanstack/react-router'

import { notesQuery, useNotes } from '../queries.ts'

export const Route = createFileRoute('/')({
  loader: ({ context }) => context.queryClient.ensureQueryData(notesQuery()),
  component: HomePage,
})

function HomePage() {
  const { data } = useNotes()
  if (!data)
    return null
  return (
    <div>
      <h1>{data.profile?.displayName ?? 'Notes'}</h1>
      {data.profile?.bio ? <p>{data.profile.bio}</p> : null}
      <ul>
        {data.notes.map(note => (
          <li key={note.uri}>
            <Link to="/notes/$rkey" params={{ rkey: note.rkey }}>
              {note.value.title}
            </Link>
            {note.related?.tag ? <em> {note.related.tag.value.name}</em> : null}
          </li>
        ))}
      </ul>
    </div>
  )
}
