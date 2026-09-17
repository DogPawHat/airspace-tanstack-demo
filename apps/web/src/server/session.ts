import { setResponseHeader, useSession } from '@tanstack/react-start/server'

export interface DemoAccount {
  did: string
  handle: string
  password: string
}

export function useDemoSession() {
  const password = process.env.AIRSPACE_SESSION_SECRET
    ?? (process.env.NODE_ENV === 'production'
      ? undefined
      : 'local-airspace-demo-session-secret-change-me')

  if (!password)
    throw new Error('AIRSPACE_SESSION_SECRET must be configured')
  if (password.length < 32)
    throw new Error('AIRSPACE_SESSION_SECRET must be at least 32 characters')

  return useSession<Partial<DemoAccount>>({
    name: 'airspace-demo',
    password,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
    },
  })
}

export async function currentAccount(): Promise<DemoAccount | null> {
  setResponseHeader('Cache-Control', 'private, no-store')
  const { data } = await useDemoSession()
  return data.did && data.handle && data.password ? data as DemoAccount : null
}

export async function requireAccount(): Promise<DemoAccount> {
  const account = await currentAccount()
  if (!account)
    throw new Error('no sandbox account; press "Try it" first')
  return account
}
