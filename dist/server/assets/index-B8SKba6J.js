import { jsxs, jsx } from "react/jsx-runtime";
import { Link } from "@tanstack/react-router";
import { u as useNotes } from "./router-MC7vLz9E.js";
import "@tanstack/react-query";
import "../server.js";
import "node:async_hooks";
import "node:stream";
import "react";
import "@tanstack/react-router/ssr/server";
function HomePage() {
  const {
    data
  } = useNotes();
  if (!data) return null;
  return /* @__PURE__ */ jsxs("div", { children: [
    /* @__PURE__ */ jsx("h1", { children: data.profile?.displayName ?? "Notes" }),
    data.profile?.bio ? /* @__PURE__ */ jsx("p", { children: data.profile.bio }) : null,
    /* @__PURE__ */ jsx("ul", { children: data.notes.map((note) => /* @__PURE__ */ jsxs("li", { children: [
      /* @__PURE__ */ jsx(Link, { to: "/notes/$rkey", params: {
        rkey: note.rkey
      }, children: note.value.title }),
      note.related?.tag ? /* @__PURE__ */ jsxs("em", { children: [
        " ",
        note.related.tag.value.name
      ] }) : null
    ] }, note.uri)) })
  ] });
}
export {
  HomePage as component
};
