import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { useForm, useSelector } from "@tanstack/react-form";
import { useServerFn } from "@tanstack/react-start";
import { noop, useSuspenseQuery, useMutation } from "@tanstack/react-query";

import { draftFormOpts, formErrorMessages } from "../../form-options.ts";
import { createDraft, publishDraft } from "../../server/air.ts";
import { draftsQuery } from "../../queries.ts";

export const Route = createFileRoute("/_authenticated/drafts")({
  context: () => {
    return {
      draftOptions: draftsQuery(),
    };
  },
  loader: ({ context }) => {
    void context.queryClient.query(context.draftOptions).catch(noop);
  },
  component: DraftsPage,
});

function DraftsPage() {
  const { draftOptions } = Route.useRouteContext();
  const { data: drafts } = useSuspenseQuery(draftOptions);

  const createDraftFn = useServerFn(createDraft);
  const publishDraftFn = useServerFn(publishDraft);
  const {
    mutateAsync: createDraftMutateAsync,
    error: createDraftError,
    isSuccess: createDraftSucceeded,
  } = useMutation({
    mutationFn: createDraftFn,
  });
  const {
    mutate: publishMutate,
    isPending: isPublishing,
    variables: publishVariables,
    error: publishError,
    isSuccess: publishSucceeded,
  } = useMutation({
    mutationFn: publishDraftFn,
  });
  const publishing = isPublishing ? publishVariables?.data : null;
  const form = useForm({
    ...draftFormOpts,
    onSubmit: async ({ value, formApi }) => {
      await createDraftMutateAsync({ data: value });
      formApi.reset();
    },
  });
  const isSubmitting = useSelector(form.store, (state) => state.isSubmitting);

  const tagName = (draft: (typeof drafts.drafts)[number]) => {
    if (!draft.value.tag) return undefined;
    const rkey = draft.value.tag.uri.split("/").pop();
    return drafts.tags.find((tag) => tag.rkey === rkey)?.name;
  };

  return (
    <div className="demo-page">
      <header>
        <span className="icon" aria-hidden="true">
          ◐
        </span>
        <h1>Drafts</h1>
        <p>
          Private to this account, in a permissioned space. Publishing copies a draft into the
          public repo.
        </p>
      </header>

      {drafts.drafts.length ? (
        <ul className="demo-rows">
          {drafts.drafts.map((draft) => {
            const tag = tagName(draft);
            return (
              <li key={draft.uri}>
                <span className="title">{draft.value.title}</span>
                {tag ? <span className="tag">{tag}</span> : null}
                {draft.published ? (
                  <Link to="/notes/$rkey" params={{ rkey: draft.rkey }} className="meta">
                    published ↗
                  </Link>
                ) : (
                  <button
                    disabled={isSubmitting || publishing !== null}
                    onClick={() => publishMutate({ data: draft.rkey })}
                  >
                    {publishing === draft.rkey ? "Publishing…" : "Publish"}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="demo-empty">No drafts yet.</p>
      )}

      <form
        className="demo-form"
        method="post"
        onSubmit={(event) => {
          event.preventDefault();
          event.stopPropagation();
          void form.handleSubmit().catch(noop);
        }}
      >
        <h3>New draft</h3>
        <form.Field name="title">
          {(field) => (
            <>
              <input
                name={field.name}
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(event) => field.handleChange(event.target.value)}
                placeholder="Title"
                required
              />
              {field.state.meta.errors.length ? (
                <p className="error" role="alert">
                  {formErrorMessages(field.state.meta.errors)}
                </p>
              ) : null}
            </>
          )}
        </form.Field>
        <form.Field name="body">
          {(field) => (
            <textarea
              name={field.name}
              value={field.state.value}
              onBlur={field.handleBlur}
              onChange={(event) => field.handleChange(event.target.value)}
              rows={5}
              placeholder="Body, in markdown"
            />
          )}
        </form.Field>
        <div className="row">
          <form.Field name="tag">
            {(field) => (
              <select
                name={field.name}
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(event) => field.handleChange(event.target.value)}
              >
                <option value="">No tag</option>
                {drafts.tags.map((tag) => (
                  <option key={tag.rkey} value={tag.rkey}>
                    {tag.name}
                  </option>
                ))}
              </select>
            )}
          </form.Field>
          <form.Field name="newTag">
            {(field) => (
              <>
                <input
                  name={field.name}
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(event) => field.handleChange(event.target.value)}
                  placeholder="or a new tag"
                />
                {field.state.meta.errors.length ? (
                  <p className="error" role="alert">
                    {formErrorMessages(field.state.meta.errors)}
                  </p>
                ) : null}
              </>
            )}
          </form.Field>
        </div>
        <div className="row">
          <form.Field name="cover">
            {(field) => (
              <>
                <input
                  type="file"
                  name={field.name}
                  accept="image/*"
                  onBlur={field.handleBlur}
                  onChange={(event) => field.handleChange(event.target.files?.[0] ?? null)}
                />
                {field.state.meta.errors.length ? (
                  <p className="error" role="alert">
                    {formErrorMessages(field.state.meta.errors)}
                  </p>
                ) : null}
              </>
            )}
          </form.Field>
        </div>
        <footer>
          <form.Subscribe selector={(state) => state.isSubmitting}>
            {(submitting) => (
              <button type="submit" disabled={submitting}>
                {submitting ? "Saving…" : "Save draft"}
              </button>
            )}
          </form.Subscribe>
          {createDraftError ? (
            <p className="error" role="alert">
              {createDraftError.message}
            </p>
          ) : null}
          {createDraftSucceeded && !createDraftError ? (
            <p className="ok" role="status">
              draft saved
            </p>
          ) : null}
        </footer>
      </form>
      {publishError ? (
        <p className="error" role="alert">
          {publishError.message}
        </p>
      ) : null}
      {publishSucceeded && !publishError ? (
        <p className="ok" role="status">
          published
        </p>
      ) : null}
    </div>
  );
}
