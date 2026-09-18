import { Buffer } from "node:buffer";
import { randomBytes, randomUUID } from "node:crypto";
import process from "node:process";
import { clearSession, useSession } from "@tanstack/react-start/server";
import { createAirspace, passwordSession } from "airspace";
import { timestamps } from "airspace/plugins/timestamps";

import { profile, workspace } from "../../collections.ts";

export interface DemoAccount {
  did: string;
  handle: string;
  password: string;
}

export class UnauthorizedError extends Error {
  constructor(message = 'no sandbox account; press "Try it" first') {
    super(message);
    this.name = "UnauthorizedError";
  }
}

type Env = Record<string, string | undefined>;
const env = (key: string): string | undefined => (import.meta.env as Env)[key] ?? process.env[key];

const service = () => env("AIRSPACE_SERVICE") ?? "http://localhost:2583";

const sessionPassword = () => {
  const password = env("SESSION_PASSWORD");
  if (password) return password;
  if (env("NODE_ENV") === "production" || env("PROD"))
    throw new Error("SESSION_PASSWORD is required to keep demo account cookies encrypted");
  return "airspace-demo-dev-password-0123456789abcdef";
};

const sessionConfig = () => ({
  password: sessionPassword(),
  name: "airspace-demo",
  cookie: { secure: env("NODE_ENV") === "production" || !!env("PROD") },
});

export const demoSession = () => useSession<Partial<DemoAccount>>(sessionConfig());

export async function requireAccount(): Promise<DemoAccount> {
  const { data } = await demoSession();
  if (!data.did || !data.handle || !data.password) throw new UnauthorizedError();
  return data as DemoAccount;
}

/** The demo PDS is invite-only; reuse a minted code, or mint one as admin. */
let inviteCode: string | undefined;
async function inviteFor(describe: { inviteCodeRequired?: boolean }): Promise<string | undefined> {
  if (!describe.inviteCodeRequired) return undefined;
  if (env("AIRSPACE_INVITE_CODE")) return env("AIRSPACE_INVITE_CODE");
  const adminPassword = env("PDS_ADMIN_PASSWORD");
  if (!adminPassword) return undefined;
  inviteCode ??= await (async () => {
    const created = await fetch(`${service()}/xrpc/com.atproto.server.createInviteCode`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Basic ${Buffer.from(`admin:${adminPassword}`).toString("base64")}`,
      },
      body: JSON.stringify({ useCount: 1000 }),
    });
    if (!created.ok) throw new Error(`could not mint an invite code: ${await created.text()}`);
    return ((await created.json()) as { code: string }).code;
  })();
  return inviteCode;
}

/** Create a throwaway account on the demo PDS and remember it in the visitor's cookie. */
export async function createAccount(): Promise<DemoAccount> {
  let describe: { availableUserDomains?: string[]; inviteCodeRequired?: boolean };
  try {
    describe = (await (
      await fetch(`${service()}/xrpc/com.atproto.server.describeServer`)
    ).json()) as typeof describe;
  } catch {
    throw new Error(`demo PDS at ${service()} is not answering`);
  }
  const name = `demo-${randomUUID().slice(0, 8)}`;
  const account: DemoAccount = {
    did: "",
    handle: `${name}${describe.availableUserDomains?.[0] ?? ".test"}`,
    password: randomBytes(15).toString("base64url"),
  };
  const inviteCode = await inviteFor(describe);
  const created = await fetch(`${service()}/xrpc/com.atproto.server.createAccount`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      handle: account.handle,
      email: `${name}@demo.invalid`,
      password: account.password,
      ...(inviteCode ? { inviteCode } : {}),
    }),
  });
  if (!created.ok) throw new Error(`could not create a sandbox account: ${await created.text()}`);
  account.did = ((await created.json()) as { did: string }).did;

  const session = await demoSession();
  await session.update(account);
  return account;
}

export async function endSession(): Promise<void> {
  const { did } = (await demoSession()).data;
  if (did) instances.delete(did);
  await clearSession({ password: sessionPassword(), name: "airspace-demo" });
}

async function build(account: DemoAccount) {
  const session = await passwordSession({
    service: service(),
    identifier: account.handle,
    password: account.password,
  });
  const airspace = createAirspace({
    identity: { did: account.did as `did:${string}:${string}`, service: service() },
    collections: { profile },
    spaces: { workspace },
    plugins: [timestamps()],
    session,
    cache: { ttl: 5_000 },
  });
  return { session, airspace };
}

type DemoInstance = Awaited<ReturnType<typeof build>>;
export type DemoAirspace = DemoInstance["airspace"];

const ttl = 15 * 60_000;
const limit = 100;
const instances = new Map<string, { at: number; instance: Promise<DemoInstance> }>();

export const useDemoAirspace = async (account?: DemoAccount): Promise<DemoAirspace> =>
  (await instanceFor(account ?? (await requireAccount()))).airspace;

async function instanceFor(account: DemoAccount): Promise<DemoInstance> {
  const now = Date.now();
  for (const [did, entry] of instances) {
    if (now - entry.at > ttl) instances.delete(did);
  }
  const hit = instances.get(account.did);
  if (hit) {
    hit.at = now;
    return await hit.instance;
  }
  if (instances.size >= limit) instances.delete(instances.keys().next().value!);
  const instance = build(account);
  instances.set(account.did, { at: now, instance });
  return await instance.catch((error) => {
    instances.delete(account.did);
    throw error;
  });
}
