import { K as reactExports, P as jsxRuntimeExports } from "../server.js";
import { u as useServerFn } from "./useServerFn-CgLAj4KG.js";
import { a as useDrafts, b as useQueryClient, c as createDraft, p as publishDraft } from "./router-813Zfs0r.js";
import "node:async_hooks";
import "node:stream";
import "node:stream/web";
import "util";
import "crypto";
import "async_hooks";
import "stream";
function DraftsPage() {
  const {
    data
  } = useDrafts();
  const createDraftFn = useServerFn(createDraft);
  const publishDraftFn = useServerFn(publishDraft);
  const formRef = reactExports.useRef(null);
  const [busy, setBusy] = reactExports.useState(false);
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
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx("h1", { children: "Drafts" }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("form", { ref: formRef, onSubmit: (e) => void create(), children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("p", { children: /* @__PURE__ */ jsxRuntimeExports.jsx("input", { name: "title", placeholder: "Title", required: true }) }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("p", { children: /* @__PURE__ */ jsxRuntimeExports.jsx("textarea", { name: "body", placeholder: "# Markdown body" }) }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("p", { children: [
        /* @__PURE__ */ jsxRuntimeExports.jsxs("select", { name: "tag", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("option", { value: "", children: "no tag" }),
          data.tags.map((tag) => /* @__PURE__ */ jsxRuntimeExports.jsx("option", { value: tag.rkey, children: tag.name }, tag.rkey))
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("input", { name: "newTag", placeholder: "or a new tag" })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("p", { children: /* @__PURE__ */ jsxRuntimeExports.jsx("input", { type: "file", name: "cover", accept: "image/*" }) }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("button", { type: "submit", disabled: busy, children: "Create draft" })
    ] }),
    data.drafts.map((draft) => /* @__PURE__ */ jsxRuntimeExports.jsxs("article", { children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("h2", { children: draft.value.title }),
      draft.published ? /* @__PURE__ */ jsxRuntimeExports.jsx("p", { children: "published" }) : /* @__PURE__ */ jsxRuntimeExports.jsx("button", { onClick: () => void publish(draft.rkey), children: "Publish" })
    ] }, draft.uri))
  ] });
}
export {
  DraftsPage as component
};
