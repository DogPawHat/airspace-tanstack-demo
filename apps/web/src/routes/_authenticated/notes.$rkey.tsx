import { MarkdownDocument } from "@comark/react";
import { noop, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";

import { noteQuery } from "../../queries.ts";

export const Route = createFileRoute("/_authenticated/notes/$rkey")({
  context: ({ params }) => {
    return { noteOptions: noteQuery(params.rkey) };
  },
  loader: ({ context }) => {
    void context.queryClient.query(context.noteOptions).catch(noop);
  },
  component: NotePage,
});

function formatDate(iso: string) {
  return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function NotePage() {
  const { rkey } = Route.useParams();
  const { accountOptions, noteOptions } = Route.useRouteContext();
  const { data: account } = useSuspenseQuery(accountOptions);
  const { data: notes } = useSuspenseQuery(noteOptions);

  return (
    <div className="demo-page">
      <>
        <header>
          <Link to="/" className="back">
            ← Notes
          </Link>
          <h1>{notes.note.value.title}</h1>
        </header>

        <dl className="demo-props">
          {notes.tag ? (
            <>
              <dt>tag</dt>
              <dd>
                <span className="tag">{notes.tag}</span>
              </dd>
            </>
          ) : null}
          {notes.note.value.createdAt ? (
            <>
              <dt>created</dt>
              <dd>{formatDate(notes.note.value.createdAt)}</dd>
            </>
          ) : null}
          <dt>record</dt>
          <dd>
            <code>{rkey}</code>
            <a
              href={`https://pdsls.dev/at://${account.did}/tech.dogpawhat.airspace-demo.notes.note/${rkey}`}
              target="_blank"
              rel="noopener"
            >
              view on pdsls ↗
            </a>
          </dd>
        </dl>

        {notes.cover ? (
          <img src={notes.cover} alt={notes.note.value.title} className="demo-cover" />
        ) : null}
        <div className="demo-body">
          <MarkdownDocument value={notes.note.meta.markdown ?? undefined} />
          {!notes.note.meta.markdown ? <p>{notes.note.value.body}</p> : null}
        </div>
      </>
    </div>
  );
}
