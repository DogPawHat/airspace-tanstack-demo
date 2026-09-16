import { T as TSS_SERVER_FUNCTION, c as createServerFn } from "../server.js";
import { defineCollections, belongsTo, defineSpace, passwordSession, createAirspace, parseAtUri } from "airspace";
import { timestamps } from "airspace/plugins/timestamps";
import { markdown } from "airspace/plugins/markdown";
import { defineLexicons, space, field } from "airspace/lexicon";
import "node:async_hooks";
import "node:stream";
import "react";
import "@tanstack/react-router";
import "react/jsx-runtime";
import "@tanstack/react-router/ssr/server";
var createServerRpc = (serverFnMeta, splitImportFn) => {
  const url = "/_serverFn/" + serverFnMeta.id;
  return Object.assign(splitImportFn, {
    url,
    serverFnMeta,
    [TSS_SERVER_FUNCTION]: true
  });
};
const lexicons = defineLexicons("space.getair.notes", {
  tag: {
    name: field.text({ max: 32 })
  },
  note: {
    description: "A note. The body is markdown.",
    title: field.text({ max: 120 }),
    body: field.markdown(),
    tag: field.ref("tag").optional(),
    cover: field.image({ max: 1e6 }).optional(),
    createdAt: field.datetime().optional(),
    updatedAt: field.datetime().optional()
  },
  profile: {
    key: "self",
    displayName: field.text({ max: 64 }),
    bio: field.text().optional()
  },
  workspace: space(["note", "tag"])
});
const { note: notes, tag: tags, profile } = defineCollections(lexicons, (c) => ({
  note: {
    sort: [["createdAt", "desc"]],
    relations: { tag: belongsTo(c.tag, "tag") },
    plugins: [markdown("body")]
  }
}));
const workspace = defineSpace(lexicons.workspace, {
  collections: { notes, tags }
});
async function createNotesAirspace() {
  const service = process.env.AIRSPACE_SERVICE ?? "http://localhost:2583";
  const identifier = process.env.AIRSPACE_IDENTIFIER ?? "alice.test";
  const password = process.env.AIRSPACE_PASSWORD ?? "hunter2";
  const session = await passwordSession({
    service,
    identifier,
    password
  });
  const airspace = createAirspace({
    identity: { did: session.did, service },
    collections: { profile },
    spaces: { workspace },
    plugins: [timestamps()],
    session,
    cache: { ttl: 5e3 }
  });
  await airspace.workspace.manage.ensure();
  return airspace;
}
let pending;
function useAirspace() {
  pending ??= createNotesAirspace();
  return pending;
}
const getNotes_createServerFn_handler = createServerRpc({
  id: "bc3ee0222366ccd2612be7e43cf2343ef3d9c3cff7f73da471e095bcde8691d8",
  name: "getNotes",
  filename: "src/server/air.ts"
}, (opts) => getNotes.__executeServer(opts));
const getNotes = createServerFn({
  method: "GET",
  strict: false
}).handler(getNotes_createServerFn_handler, async () => {
  const airspace = await useAirspace();
  const me = await airspace.profile.get();
  const notes2 = await airspace.notes.list({
    with: ["tag"]
  });
  return {
    profile: me?.value ?? null,
    notes: notes2
  };
});
const getNote_createServerFn_handler = createServerRpc({
  id: "d7a5f4ccca35265f4495f103e283a4b85c9d5663e6a79c4e72c83cf6e2a373d2",
  name: "getNote",
  filename: "src/server/air.ts"
}, (opts) => getNote.__executeServer(opts));
const getNote = createServerFn({
  method: "GET",
  strict: false
}).validator((rkey) => rkey).handler(getNote_createServerFn_handler, async ({
  data: rkey
}) => {
  const airspace = await useAirspace();
  const note = await airspace.notes.get(rkey);
  if (!note) throw new Error("No such note");
  const [tag, cover] = await Promise.all([airspace.notes.resolve(note, "tag"), airspace.blobs.url(note.value.cover)]);
  return {
    note,
    tag: tag?.value.name ?? null,
    cover
  };
});
const getProfile_createServerFn_handler = createServerRpc({
  id: "1d3f14775aa741e13186ee52d5a6c9c1dc3aedb6f63ce977535ab3bfb61c6ff0",
  name: "getProfile",
  filename: "src/server/air.ts"
}, (opts) => getProfile.__executeServer(opts));
const getProfile = createServerFn({
  method: "GET",
  strict: false
}).handler(getProfile_createServerFn_handler, async () => {
  const airspace = await useAirspace();
  return (await airspace.profile.get())?.value ?? null;
});
const saveProfile_createServerFn_handler = createServerRpc({
  id: "0c83aa605d6b352175b0ae70be57537216a4801b9500473442a40ff1eed034dd",
  name: "saveProfile",
  filename: "src/server/air.ts"
}, (opts) => saveProfile.__executeServer(opts));
const saveProfile = createServerFn({
  method: "POST",
  strict: false
}).validator((body) => body).handler(saveProfile_createServerFn_handler, async ({
  data
}) => {
  const airspace = await useAirspace();
  return await airspace.profile.put({
    displayName: data.displayName,
    bio: data.bio || void 0
  });
});
const getDrafts_createServerFn_handler = createServerRpc({
  id: "d61140479c52004fdb824bfd6689653d23e1da0f082bc4b445b04da6fec91a87",
  name: "getDrafts",
  filename: "src/server/air.ts"
}, (opts) => getDrafts.__executeServer(opts));
const getDrafts = createServerFn({
  method: "GET",
  strict: false
}).handler(getDrafts_createServerFn_handler, async () => {
  const airspace = await useAirspace();
  const [drafts, live, tags2] = await Promise.all([airspace.workspace.notes.list(), airspace.workspace.notes.published(), airspace.workspace.tags.list()]);
  return {
    drafts: drafts.map((draft) => ({
      ...draft,
      published: live.includes(draft.rkey)
    })),
    tags: tags2.map((tag) => ({
      rkey: tag.rkey,
      name: tag.value.name
    }))
  };
});
const createDraft_createServerFn_handler = createServerRpc({
  id: "d5e90189475ef3ba055a89641edbe9d71875ef2e70062c913df9e69bdbbd4ee1",
  name: "createDraft",
  filename: "src/server/air.ts"
}, (opts) => createDraft.__executeServer(opts));
const createDraft = createServerFn({
  method: "POST",
  strict: false
}).validator((data) => data).handler(createDraft_createServerFn_handler, async ({
  data
}) => {
  const str = (name) => {
    const value = data.get(name);
    return typeof value === "string" ? value.trim() : void 0;
  };
  const airspace = await useAirspace();
  const newTag = str("newTag");
  const existingTag = str("tag");
  const tag = newTag ? await airspace.workspace.tags.create({
    name: newTag
  }) : existingTag ? await airspace.workspace.tags.get(existingTag) ?? null : null;
  const file = data.get("cover");
  const cover = file?.size ? (await airspace.blobs.upload(new Uint8Array(await file.arrayBuffer()), {
    mimeType: file.type || "application/octet-stream"
  })).blob : void 0;
  return await airspace.workspace.notes.create({
    title: str("title") ?? "",
    body: str("body") ?? "",
    tag: tag ? {
      uri: tag.uri,
      cid: tag.cid
    } : void 0,
    cover
  });
});
const publishDraft_createServerFn_handler = createServerRpc({
  id: "213b38372a5308f9764de551c8c31353a00a79beaf012370359ea6088334161f",
  name: "publishDraft",
  filename: "src/server/air.ts"
}, (opts) => publishDraft.__executeServer(opts));
const publishDraft = createServerFn({
  method: "POST",
  strict: false
}).validator((rkey) => rkey).handler(publishDraft_createServerFn_handler, async ({
  data: rkey
}) => {
  const airspace = await useAirspace();
  const draft = await airspace.workspace.notes.get(rkey);
  if (!draft) throw new Error("No such draft");
  const tagRkey = draft.value.tag ? parseAtUri(draft.value.tag.uri).rkey : void 0;
  if (tagRkey && !(await airspace.workspace.tags.published()).includes(tagRkey)) await airspace.workspace.tags.publish(tagRkey);
  return await airspace.workspace.notes.publish(rkey);
});
export {
  createDraft_createServerFn_handler,
  getDrafts_createServerFn_handler,
  getNote_createServerFn_handler,
  getNotes_createServerFn_handler,
  getProfile_createServerFn_handler,
  publishDraft_createServerFn_handler,
  saveProfile_createServerFn_handler
};
