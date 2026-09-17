import { createFileRoute } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'

import { DemoShell } from '../components/DemoShell.tsx'
import { saveProfile } from '../server/air.ts'
import { accountQuery, profileQuery, useAccount, useProfile } from '../queries.ts'

export const Route = createFileRoute('/profile')({
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData(profileQuery()),
      context.queryClient.ensureQueryData(accountQuery()),
    ]),
  component: ProfilePage,
})

function ProfilePage() {
  const { data } = useProfile()
  const { data: account } = useAccount()
  const saveProfileFn = useServerFn(saveProfile)
  const queryClient = useQueryClient()
  const [displayName, setDisplayName] = useState('')
  const [bio, setBio] = useState('')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (data) {
      setDisplayName(data.displayName ?? '')
      setBio(data.bio ?? '')
    }
  }, [data])

  async function save() {
    setBusy(true)
    setError('')
    setNotice('')
    try {
      await saveProfileFn({ data: { displayName, bio } })
      await queryClient.invalidateQueries({ queryKey: ['profile'] })
      await queryClient.invalidateQueries({ queryKey: ['notes'] })
      setNotice('saved')
    }
    catch (cause) {
      setError((cause as Error).message ?? 'could not save the profile')
    }
    finally {
      setBusy(false)
    }
  }

  return (
    <DemoShell>
      <div className="demo-page">
        <header>
          <span className="icon" aria-hidden="true">○</span>
          <h1>Profile</h1>
          <p>One record at a <code>literal:self</code> key, so the collection is a singleton and takes no record key.</p>
        </header>

        {account
          ? (
              <dl className="demo-props">
                <dt>handle</dt>
                <dd><code>{account.handle}</code></dd>
                <dt>did</dt>
                <dd><code>{account.did}</code></dd>
                <dt>record</dt>
                <dd>
                  <a
                    href={`https://pdsls.dev/at://${account.did}/space.getair.notes.profile/self`}
                    target="_blank"
                    rel="noopener"
                  >
                    view on pdsls ↗
                  </a>
                </dd>
              </dl>
            )
          : null}

        <form className="demo-form" onSubmit={e => void save()}>
          <h3>Edit</h3>
          <input
            value={displayName}
            onChange={e => setDisplayName(e.target.value)}
            placeholder="Display name"
            required
          />
          <textarea value={bio} onChange={e => setBio(e.target.value)} rows={3} placeholder="Bio" />
          <footer>
            <button type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
            {error ? <p className="error" role="alert">{error}</p> : null}
            {notice && !error ? <p className="ok" role="status">{notice}</p> : null}
          </footer>
        </form>
      </div>
    </DemoShell>
  )
}
