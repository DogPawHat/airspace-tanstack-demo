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

export const notesQuery = () => ({
  queryKey: ['notes'],
  queryFn: () => getNotes(),
})

export const noteQuery = (rkey: string) => ({
  queryKey: ['notes', rkey],
  queryFn: () => getNote({ data: rkey }),
})

export const profileQuery = () => ({
  queryKey: ['profile'],
  queryFn: () => getProfile(),
})

export const draftsQuery = () => ({
  queryKey: ['drafts'],
  queryFn: () => getDrafts(),
})

export function useAccount() {
  return useQuery(accountQuery())
}

export function useNotes() {
  return useQuery(notesQuery())
}
export function useNote(rkey: string) {
  return useQuery(noteQuery(rkey))
}
export function useProfile() {
  return useQuery(profileQuery())
}
export function useDrafts() {
  return useQuery(draftsQuery())
}
export function useInvalidate() {
  const queryClient = useQueryClient()
  return (keys: string[]) => queryClient.invalidateQueries({ queryKey: keys })
}
