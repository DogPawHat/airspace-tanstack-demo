import { createAirspace, passwordSession } from 'airspace'
import { timestamps } from 'airspace/plugins/timestamps'

import { profile, workspace } from '../../collections.ts'

export async function createNotesAirspace() {
  const service = process.env.AIRSPACE_SERVICE ?? 'http://localhost:2583'
  const identifier = process.env.AIRSPACE_IDENTIFIER ?? 'alice.test'
  const password = process.env.AIRSPACE_PASSWORD ?? 'hunter2'

  const session = await passwordSession({
    service,
    identifier,
    password,
  })
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

export type AirspaceInstance = Awaited<ReturnType<typeof createNotesAirspace>>
