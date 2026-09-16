import { jsxs, jsx } from "react/jsx-runtime";
import { MarkdownDocument } from "@comark/react";
import { R as Route, d as useNote } from "./router-MC7vLz9E.js";
import "@tanstack/react-query";
import "@tanstack/react-router";
import "../server.js";
import "node:async_hooks";
import "node:stream";
import "react";
import "@tanstack/react-router/ssr/server";
function NotePage() {
  const {
    rkey
  } = Route.useParams();
  const {
    data
  } = useNote(rkey);
  if (!data) return null;
  return /* @__PURE__ */ jsxs("article", { children: [
    /* @__PURE__ */ jsx("h1", { children: data.note.value.title }),
    data.tag ? /* @__PURE__ */ jsxs("p", { children: [
      "tagged ",
      data.tag
    ] }) : null,
    data.cover ? /* @__PURE__ */ jsx("img", { src: data.cover, alt: data.note.value.title }) : null,
    /* @__PURE__ */ jsx(MarkdownDocument, { value: data.note.meta.markdown ?? void 0 }),
    !data.note.meta.markdown ? /* @__PURE__ */ jsx("p", { children: data.note.value.body }) : null
  ] });
}
export {
  NotePage as component
};
