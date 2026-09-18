import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { noop, useSuspenseQuery } from "@tanstack/react-query";

import { notesQuery, optionalAccountQuery } from "../../queries.ts";

export const Route = createFileRoute("/_public/")({
  loader: ({ context }) => {
    void context.queryClient.query(optionalAccountQuery()).catch(noop);
    void context.queryClient.query(notesQuery()).catch(noop);
  },
  component: HomePage,
});

const collection = "tech.dogpawhat.airspace-demo.notes.note";

function formatDate(iso: string | null | undefined) {
  return iso ? new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short" }) : "";
}

function HomePage() {
  const { data: account } = useSuspenseQuery(optionalAccountQuery());

  return account ? <AuthenticatedHome /> : <UnauthenticatedHome />;
}

function UnauthenticatedHome() {
  return (
    <div className="demo-page">
      <header>
        <span className="icon" aria-hidden="true">
          ◇
        </span>
        <h1>Notes</h1>
        <p>
          A notes app on a sandbox account on our own PDS. Published notes live in the account's
          public repo, drafts in a permissioned space. Sandbox accounts are wiped periodically.
        </p>
      </header>
      <p className="demo-empty">
        Press <strong>Try it</strong> to create a sandbox account and start writing.
      </p>
    </div>
  );
}

function AuthenticatedHome() {
  const { data } = useSuspenseQuery(notesQuery());
  const { data: account } = useSuspenseQuery(optionalAccountQuery());
  const did = account!.did;

  return (
    <div className="demo-page">
      <header>
        <span className="icon" aria-hidden="true">
          ◇
        </span>
        <h1>{data.profile?.displayName ?? "Notes"}</h1>
        {data.profile?.bio ? (
          <p>{data.profile.bio}</p>
        ) : (
          <p>Published notes live in the account's public repo.</p>
        )}
      </header>

      {data.notes.length ? (
        <ul className="demo-rows">
          {data.notes.map((note) => {
            const tag = note.related?.tag?.value.name;
            return (
              <li key={note.uri}>
                <Link to="/notes/$rkey" params={{ rkey: note.rkey }} className="title">
                  {note.value.title}
                </Link>
                {tag ? <span className="tag">{tag}</span> : null}
                {note.value.createdAt ? (
                  <span className="meta">{formatDate(note.value.createdAt)}</span>
                ) : null}
                <a
                  href={`https://pdsls.dev/at://${did}/${collection}/${note.rkey}`}
                  className="meta"
                  target="_blank"
                  rel="noopener"
                >
                  record ↗
                </a>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="demo-empty">
          Nothing published yet. Write a draft on the <Link to="/drafts">drafts</Link> page and
          publish it.
        </p>
      )}
    </div>
  );
}
