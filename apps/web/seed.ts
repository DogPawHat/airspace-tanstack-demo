import process from "node:process";
import { createAirspace, passwordSession } from "airspace";
import { timestamps } from "airspace/plugins/timestamps";

import { profile, workspace } from "./collections.ts";

const service = process.env.AIRSPACE_SERVICE ?? "http://localhost:2583";
const identifier = process.env.AIRSPACE_IDENTIFIER ?? "alice.test";
const password = process.env.AIRSPACE_PASSWORD ?? "hunter2";

/** Seed the fixed service account (e.g. alice.test) with demo content. */
const session = await passwordSession({ service, identifier, password });
const airspace = createAirspace({
  identity: { did: session.did, service },
  collections: { profile },
  spaces: { workspace },
  plugins: [timestamps()],
  session,
  cache: { ttl: 5_000 },
});
await airspace.workspace.manage.ensure();

console.log("did:", airspace.notes ? "notes ok" : "no notes");

const tag =
  (await airspace.workspace.tags.list()).find((t) => t.value.name === "demo") ??
  (await airspace.workspace.tags.create({ name: "demo" }));

const note = await airspace.workspace.notes.create({
  title: "Hello from TanStack Start",
  body: "# hello\n\nfrom the **tanstack** demo.",
  tag: { uri: tag.uri, cid: tag.cid },
});
await airspace.workspace.notes.publish(note.rkey);

const note2 = await airspace.workspace.notes.create({
  title: "A published note, directly in the repo",
  body: "draft-free note 🎉",
});
console.log("created:", note.rkey, note2.rkey);
