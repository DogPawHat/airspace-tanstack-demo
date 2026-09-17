import { useQuery, useQueryClient } from '@tanstack/react-query'

import {
  createDraft,
  getAccount,
  getDrafts,
  getNote,
  getNotes,
  getProfile,
  publishDraft,
  saveProfile,
} from './server/air.ts'

export const accountQuery = () => ({
  queryKey: ['account'],
  queryFn: () => getAccount(),
})

export function useAccount() {
  return useQuery(accountQuery())
}

export const notesQuery = (did?: string) => ({
  queryKey: ['notes', did],
  queryFn: () => getNotes(),
  enabled: Boolean(did),
})

export const noteQuery = (rkey: string, did?: string) => ({
  queryKey: ['notes', did, rkey],
  queryFn: () => getNote({ data: rkey }),
  enabled: Boolean(did),
})

export const profileQuery = (did?: string) => ({
  queryKey: ['profile', did],
  queryFn: () => getProfile(),
  enabled: Boolean(did),
})

export const draftsQuery = (did?: string) => ({
  queryKey: ['drafts', did],
  queryFn: () => getDrafts(),
  enabled: Boolean(did),
})

export function useNotes() {
  const { data: account } = useAccount()
  return useQuery(notesQuery(account?.did))
}
export function useNote(rkey: string) {
  const { data: account } = useAccount()
  return useQuery(noteQuery(rkey, account?.did))
}
export function useProfile() {
  const { data: account } = useAccount()
  return useQuery(profileQuery(account?.did))
}
export function useDrafts() {
  const { data: account } = useAccount()
  return useQuery(draftsQuery(account?.did))
}
export function useInvalidate() {
  const queryClient = useQueryClient()
  return (keys: string[]) => queryClient.invalidateQueries({ queryKey: keys })
}
