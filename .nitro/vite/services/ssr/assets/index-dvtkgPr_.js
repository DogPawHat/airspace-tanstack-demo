import { P as jsxRuntimeExports } from "../server.js";
import { u as useNotes, L as Link } from "./router-813Zfs0r.js";
import "node:async_hooks";
import "node:stream";
import "node:stream/web";
import "util";
import "crypto";
import "async_hooks";
import "stream";
function HomePage() {
  const {
    data
  } = useNotes();
  if (!data) return null;
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx("h1", { children: data.profile?.displayName ?? "Notes" }),
    data.profile?.bio ? /* @__PURE__ */ jsxRuntimeExports.jsx("p", { children: data.profile.bio }) : null,
    /* @__PURE__ */ jsxRuntimeExports.jsx("ul", { children: data.notes.map((note) => /* @__PURE__ */ jsxRuntimeExports.jsxs("li", { children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx(Link, { to: "/notes/$rkey", params: {
        rkey: note.rkey
      }, children: note.value.title }),
      note.related?.tag ? /* @__PURE__ */ jsxRuntimeExports.jsxs("em", { children: [
        " ",
        note.related.tag.value.name
      ] }) : null
    ] }, note.uri)) })
  ] });
}
export {
  HomePage as component
};
