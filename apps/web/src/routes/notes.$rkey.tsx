import { createFileRoute } from '@tanstack/react-router'
import { MarkdownDocument } from '@comark/react'

import { noteQuery, useNote } from '../queries.ts'

export const Route = createFileRoute('/notes/$rkey')({
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(noteQuery(params.rkey)),
  component: NotePage,
})

function NotePage() {
  const { rkey } = Route.useParams()
  const { data } = useNote(rkey)
  if (!data)
    return null
  return (
    <article>
      <h1>{data.note.value.title}</h1>
      {data.tag ? <p>tagged {data.tag}</p> : null}
      {data.cover ? <img src={data.cover} alt={data.note.value.title} /> : null}
      <MarkdownDocument value={data.note.meta.markdown ?? undefined} />
      {!data.note.meta.markdown ? <p>{data.note.value.body}</p> : null}
    </article>
  )
}
