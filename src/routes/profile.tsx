import { createFileRoute } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'

import { saveProfile } from '../server/air.ts'
import { profileQuery, useProfile } from '../queries.ts'

export const Route = createFileRoute('/profile')({
  loader: ({ context }) => context.queryClient.ensureQueryData(profileQuery()),
  component: ProfilePage,
})

function ProfilePage() {
  const { data } = useProfile()
  const saveProfileFn = useServerFn(saveProfile)
  const queryClient = useQueryClient()
  const [displayName, setDisplayName] = useState('')
  const [bio, setBio] = useState('')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (data) {
      setDisplayName(data.displayName ?? '')
      setBio(data.bio ?? '')
    }
  }, [data])

  async function save() {
    await saveProfileFn({ data: { displayName, bio } })
    await queryClient.invalidateQueries({ queryKey: ['profile'] })
    await queryClient.invalidateQueries({ queryKey: ['notes'] })
    setSaved(true)
  }

  return (
    <form onSubmit={e => void save()}>
      <h1>Profile</h1>
      <p><input value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="Display name" required /></p>
      <p><textarea value={bio} onChange={e => setBio(e.target.value)} placeholder="Bio" /></p>
      <button type="submit">Save</button>
      {saved ? <p>Saved</p> : null}
    </form>
  )
}
