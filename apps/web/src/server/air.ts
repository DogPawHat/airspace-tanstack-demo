import { createServerFn } from "@tanstack/react-start";
import { parseAtUri } from "airspace";

import { profileFormSchema, draftFormSchema } from "../form-options.ts";
import { createAccount, demoSession, endSession, useDemoAirspace } from "./demo.ts";
import { requireAccountMiddleware } from "./middleware.ts";

/** The visitor's sandbox account, or null when not signed in. */
export const getOptionalAccount = createServerFn({ method: "GET", strict: false }).handler(
  async () => {
    const { data } = await demoSession();
    return data.did && data.handle ? { did: data.did, handle: data.handle } : null;
  },
);

/** The visitor's sandbox account. Responds with 401 when not signed in. */
export const getAccount = createServerFn({ method: "GET", strict: false })
  .middleware([requireAccountMiddleware])
  .handler(({ context: { account } }) => ({
    did: account.did,
    handle: account.handle,
  }));

export const getNotes = createServerFn({ method: "GET", strict: false })
  .middleware([requireAccountMiddleware])
  .handler(async ({ context: { airspace } }) => {
    const me = await airspace.profile.get();
    const notes = await airspace.notes.list({ with: ["tag"] });
    return { profile: me?.value ?? null, notes };
  });

export const getNote = createServerFn({ method: "GET", strict: false })
  .middleware([requireAccountMiddleware])
  .validator((rkey: string) => rkey)
  .handler(async ({ data: rkey, context: { airspace } }) => {
    const note = await airspace.notes.get(rkey);
    if (!note) throw new Error("No such note");
    const [tag, cover] = await Promise.all([
      airspace.notes.resolve(note, "tag"),
      airspace.blobs.url(note.value.cover),
    ]);
    return { note, tag: tag?.value.name ?? null, cover };
  });

export const getProfile = createServerFn({ method: "GET", strict: false })
  .middleware([requireAccountMiddleware])
  .handler(async ({ context: { airspace } }) => (await airspace.profile.get())?.value ?? null);

export const saveProfile = createServerFn({ method: "POST", strict: false })
  .middleware([requireAccountMiddleware])
  .validator(profileFormSchema)
  .handler(async ({ data, context: { airspace } }) => {
    return await airspace.profile.put({
      displayName: data.displayName.trim(),
      bio: data.bio.trim() || undefined,
    });
  });

export const getDrafts = createServerFn({ method: "GET", strict: false })
  .middleware([requireAccountMiddleware])
  .handler(async ({ context: { airspace } }) => {
    const [drafts, live, tags] = await Promise.all([
      airspace.workspace.notes.list(),
      airspace.workspace.notes.published(),
      airspace.workspace.tags.list(),
    ]);
    return {
      drafts: drafts.map((draft) => ({ ...draft, published: live.includes(draft.rkey) })),
      tags: tags.map((tag) => ({ rkey: tag.rkey, name: tag.value.name })),
    };
  });

export const createDraft = createServerFn({ method: "POST", strict: false })
  .middleware([requireAccountMiddleware])
  .validator(draftFormSchema)
  .handler(async ({ data, context: { airspace } }) => {
    const newTag = data.newTag.trim();
    const existingTag = data.tag.trim();
    const tag = newTag
      ? await airspace.workspace.tags.create({ name: newTag })
      : existingTag
        ? ((await airspace.workspace.tags.get(existingTag)) ?? null)
        : null;

    const file = data.cover;
    const cover = file?.size
      ? (
          await airspace.blobs.upload(new Uint8Array(await file.arrayBuffer()), {
            mimeType: file.type || "application/octet-stream",
          })
        ).blob
      : undefined;

    return await airspace.workspace.notes.create({
      title: data.title.trim(),
      body: data.body.trim(),
      tag: tag ? { uri: tag.uri, cid: tag.cid } : undefined,
      cover,
    });
  });

export const publishDraft = createServerFn({ method: "POST", strict: false })
  .middleware([requireAccountMiddleware])
  .validator((rkey: string) => rkey)
  .handler(async ({ data: rkey, context: { airspace } }) => {
    const draft = await airspace.workspace.notes.get(rkey);
    if (!draft) throw new Error("No such draft");

    const tagRkey = draft.value.tag ? parseAtUri(draft.value.tag.uri).rkey : undefined;
    if (tagRkey && !(await airspace.workspace.tags.published()).includes(tagRkey))
      await airspace.workspace.tags.publish(tagRkey);

    return await airspace.workspace.notes.publish(rkey);
  });

/** Port of the upstream `session.post.ts`: create a sandbox account and seed it. */
export const startSession = createServerFn({ method: "POST", strict: false }).handler(async () => {
  const account = await createAccount();
  const airspace = await useDemoAirspace();
  await airspace.workspace.manage.ensure();
  await airspace.profile.put({
    displayName: account.handle.split(".")[0]!,
    bio: "A sandbox account on the airspace demo PDS.",
  });
  for (const name of ["ideas", "writing"]) await airspace.workspace.tags.create({ name });
  return { did: account.did, handle: account.handle };
});

/** Port of the upstream `reset.post.ts`: wipe the account's drafts and published notes. */
export const resetNotes = createServerFn({ method: "POST", strict: false })
  .middleware([requireAccountMiddleware])
  .handler(async ({ context: { airspace } }) => {
    const [drafts, notes] = await Promise.all([
      airspace.workspace.notes.list(),
      airspace.notes.list(),
    ]);
    await Promise.all([
      ...drafts.map((draft) => airspace.workspace.notes.delete(draft.rkey)),
      ...notes.map((note) => airspace.notes.delete(note.rkey)),
    ]);
    return { deleted: drafts.length + notes.length };
  });

/** Port of the upstream `session.delete.ts`: clear the cookie and server caches. */
export const signOut = createServerFn({ method: "POST", strict: false }).handler(async () => {
  await endSession();
  return { ok: true };
});
