import { createFileRoute } from "@tanstack/react-router";
import { useForm } from "@tanstack/react-form";
import { useServerFn } from "@tanstack/react-start";
import { noop, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { formErrorMessages, profileFormOpts } from "../../form-options.ts";
import { saveProfile } from "../../server/air.ts";
import { profileQuery } from "../../queries.ts";

export const Route = createFileRoute("/_authenticated/profile")({
  loader: ({ context }) => {
    void context.queryClient.query(profileQuery()).catch(noop);
  },
  component: ProfilePage,
});

function ProfilePage() {
  const { accountOptions } = Route.useRouteContext();
  const { data: account } = useSuspenseQuery(accountOptions);
  const { data } = useSuspenseQuery(profileQuery());
  const saveProfileFn = useServerFn(saveProfile);
  const queryClient = useQueryClient();
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const form = useForm({
    ...profileFormOpts,
    onSubmit: async ({ value }) => {
      setError("");
      setNotice("");
      try {
        await saveProfileFn({ data: value });
        await queryClient.invalidateQueries({ queryKey: ["profile"] });
        await queryClient.invalidateQueries({ queryKey: ["notes"] });
        setNotice("saved");
      } catch (cause) {
        setError((cause as Error).message ?? "could not save the profile");
      }
    },
  });

  useEffect(() => {
    if (data) form.reset({ displayName: data.displayName ?? "", bio: data.bio ?? "" });
  }, [data, form]);

  return (
    <div className="demo-page">
      <header>
        <span className="icon" aria-hidden="true">
          ○
        </span>
        <h1>Profile</h1>
        <p>
          One record at a <code>literal:self</code> key, so the collection is a singleton and takes
          no record key.
        </p>
      </header>

      <>
        <dl className="demo-props">
          <dt>handle</dt>
          <dd>
            <code>{account.handle}</code>
          </dd>
          <dt>did</dt>
          <dd>
            <code>{account.did}</code>
          </dd>
          <dt>record</dt>
          <dd>
            <a
              href={`https://pdsls.dev/at://${account.did}/tech.dogpawhat.airspace-demo.notes.profile/self`}
              target="_blank"
              rel="noopener"
            >
              view on pdsls ↗
            </a>
          </dd>
        </dl>

        <form
          className="demo-form"
          onSubmit={(event) => {
            event.preventDefault();
            event.stopPropagation();
            void form.handleSubmit();
          }}
        >
          <h3>Edit</h3>
          <form.Field name="displayName">
            {(field) => (
              <>
                <input
                  name={field.name}
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(event) => field.handleChange(event.target.value)}
                  placeholder="Display name"
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
          <form.Field name="bio">
            {(field) => (
              <textarea
                name={field.name}
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(event) => field.handleChange(event.target.value)}
                rows={3}
                placeholder="Bio"
              />
            )}
          </form.Field>
          <footer>
            <form.Subscribe selector={(state) => state.isSubmitting}>
              {(isSubmitting) => (
                <button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? "Saving…" : "Save"}
                </button>
              )}
            </form.Subscribe>
            {error ? (
              <p className="error" role="alert">
                {error}
              </p>
            ) : null}
            {notice && !error ? (
              <p className="ok" role="status">
                {notice}
              </p>
            ) : null}
          </footer>
        </form>
      </>
    </div>
  );
}
