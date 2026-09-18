import { queryOptions } from "@tanstack/react-query";
import {
  getAccount,
  getDrafts,
  getNote,
  getNotes,
  getOptionalAccount,
  getProfile,
} from "./server/air.ts";

export const optionalAccountQuery = () =>
  queryOptions({
    queryKey: ["account", "optional"],
    queryFn: () => getOptionalAccount(),
  });

export const accountQuery = () =>
  queryOptions({
    queryKey: ["account", "required"],
    queryFn: () => getAccount(),
  });

export const notesQuery = () =>
  queryOptions({
    queryKey: ["notes"],
    queryFn: () => getNotes(),
  });

export const noteQuery = (rkey: string) =>
  queryOptions({
    queryKey: ["notes", rkey],
    queryFn: () => getNote({ data: rkey }),
  });

export const profileQuery = () =>
  queryOptions({
    queryKey: ["profile"],
    queryFn: () => getProfile(),
  });

export const draftsQuery = () =>
  queryOptions({
    queryKey: ["drafts"],
    queryFn: () => getDrafts(),
  });
