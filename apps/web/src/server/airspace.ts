import { createAirspace, passwordSession } from 'airspace'
import { timestamps } from 'airspace/plugins/timestamps'

import { profile, workspace } from '../../collections.ts'

export interface DemoAccount {
  did: string
  handle: string
  service: string
}

let account: DemoAccount | undefined

export async function createNotesAirspace() {
  const service = process.env.AIRSPACE_SERVICE ?? 'http://localhost:2583'
  const identifier = process.env.AIRSPACE_IDENTIFIER ?? 'alice.test'
  const password = process.env.AIRSPACE_PASSWORD ?? 'hunter2'

  const session = await passwordSession({
    service,
    identifier,
    password,
  })
  account = { did: session.did, handle: session.handle, service }
  const airspace = createAirspace({
    identity: { did: session.did, service },
    collections: { profile },
    spaces: { workspace },
    plugins: [timestamps()],
    session,
    cache: { ttl: 5_000 },
  })
  await airspace.workspace.manage.ensure()
  return airspace
}

let pending: Promise<AirspaceInstance> | undefined

export function useAirspace(): Promise<AirspaceInstance> {
  pending ??= createNotesAirspace()
  return pending
}

/** The demo service account the web app writes through. */
export async function getDemoAccount(): Promise<DemoAccount> {
  pending ??= createNotesAirspace()
  await pending
  if (!account)
    throw new Error('no demo account')
  return account
}

export type AirspaceInstance = Awaited<ReturnType<typeof createNotesAirspace>>
