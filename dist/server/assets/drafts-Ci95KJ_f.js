import { jsxs, jsx } from "react/jsx-runtime";
import { u as useServerFn } from "./useServerFn-DL2oePlL.js";
import { useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { a as useDrafts, c as createDraft, p as publishDraft } from "./router-MC7vLz9E.js";
import "@tanstack/react-router";
import "../server.js";
import "node:async_hooks";
import "node:stream";
import "@tanstack/react-router/ssr/server";
function DraftsPage() {
  const {
    data
  } = useDrafts();
  const createDraftFn = useServerFn(createDraft);
  const publishDraftFn = useServerFn(publishDraft);
  const formRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const queryClient = useQueryClient();
  if (!data) return null;
  async function create() {
    if (!formRef.current) return;
    setBusy(true);
    try {
      await createDraftFn({
        data: new FormData(formRef.current)
      });
      formRef.current.reset();
      formRef.current.querySelector('input[name="newTag"]').value = "";
    } finally {
      setBusy(false);
      await queryClient.invalidateQueries({
        queryKey: ["drafts"]
      });
      await queryClient.invalidateQueries({
        queryKey: ["notes"]
      });
    }
  }
  async function publish(rkey) {
    await publishDraftFn({
      data: rkey
    });
    await queryClient.invalidateQueries({
      queryKey: ["drafts"]
    });
    await queryClient.invalidateQueries({
      queryKey: ["notes"]
    });
  }
  return /* @__PURE__ */ jsxs("div", { children: [
    /* @__PURE__ */ jsx("h1", { children: "Drafts" }),
    /* @__PURE__ */ jsxs("form", { ref: formRef, onSubmit: (e) => void create(), children: [
      /* @__PURE__ */ jsx("p", { children: /* @__PURE__ */ jsx("input", { name: "title", placeholder: "Title", required: true }) }),
      /* @__PURE__ */ jsx("p", { children: /* @__PURE__ */ jsx("textarea", { name: "body", placeholder: "# Markdown body" }) }),
      /* @__PURE__ */ jsxs("p", { children: [
        /* @__PURE__ */ jsxs("select", { name: "tag", children: [
          /* @__PURE__ */ jsx("option", { value: "", children: "no tag" }),
          data.tags.map((tag) => /* @__PURE__ */ jsx("option", { value: tag.rkey, children: tag.name }, tag.rkey))
        ] }),
        /* @__PURE__ */ jsx("input", { name: "newTag", placeholder: "or a new tag" })
      ] }),
      /* @__PURE__ */ jsx("p", { children: /* @__PURE__ */ jsx("input", { type: "file", name: "cover", accept: "image/*" }) }),
      /* @__PURE__ */ jsx("button", { type: "submit", disabled: busy, children: "Create draft" })
    ] }),
    data.drafts.map((draft) => /* @__PURE__ */ jsxs("article", { children: [
      /* @__PURE__ */ jsx("h2", { children: draft.value.title }),
      draft.published ? /* @__PURE__ */ jsx("p", { children: "published" }) : /* @__PURE__ */ jsx("button", { onClick: () => void publish(draft.rkey), children: "Publish" })
    ] }, draft.uri))
  ] });
}
export {
  DraftsPage as component
};
