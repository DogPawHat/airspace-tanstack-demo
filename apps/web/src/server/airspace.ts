import { createAirspace, passwordSession } from 'airspace'
import { timestamps } from 'airspace/plugins/timestamps'

import { profile, workspace } from '../../collections.ts'
import { requireAccount } from './session.ts'
import type { DemoAccount } from './session.ts'

async function createNotesAirspace(account: DemoAccount) {
  const service = process.env.AIRSPACE_SERVICE ?? 'http://localhost:2583'
  const session = await passwordSession({
    service,
    identifier: account.handle,
    password: account.password,
  })
  const airspace = createAirspace({
    identity: { did: account.did as `did:${string}:${string}`, service },
    collections: { profile },
    spaces: { workspace },
    plugins: [timestamps()],
    session,
    cache: { ttl: 5_000 },
  })
  await airspace.workspace.manage.ensure()
  return airspace
}

const ttl = 15 * 60_000
const limit = 100
const instances = new Map<string, { at: number, instance: Promise<AirspaceInstance> }>()

export async function useAirspace(): Promise<AirspaceInstance> {
  const account = await requireAccount()
  return instanceFor(account)
}

export async function airspaceFor(account: DemoAccount): Promise<AirspaceInstance> {
  return instanceFor(account)
}

async function instanceFor(account: DemoAccount): Promise<AirspaceInstance> {
  const now = Date.now()
  for (const [did, entry] of instances) {
    if (now - entry.at > ttl)
      instances.delete(did)
  }
  const hit = instances.get(account.did)
  if (hit) {
    hit.at = now
    return await hit.instance
  }
  if (instances.size >= limit)
    instances.delete(instances.keys().next().value!)
  const instance = createNotesAirspace(account)
  instances.set(account.did, { at: now, instance })
  return await instance.catch((error) => {
    instances.delete(account.did)
    throw error
  })
}

export function forgetAirspace(did: string) {
  instances.delete(did)
}

export type AirspaceInstance = Awaited<ReturnType<typeof createNotesAirspace>>
