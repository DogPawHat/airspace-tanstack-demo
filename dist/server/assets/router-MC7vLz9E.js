import { QueryClientProvider, useQuery, QueryClient } from "@tanstack/react-query";
import { createRootRouteWithContext, Outlet, HeadContent, Scripts, createFileRoute, lazyRouteComponent, createRouter } from "@tanstack/react-router";
import { jsx, jsxs } from "react/jsx-runtime";
import { T as TSS_SERVER_FUNCTION, g as getServerFnById, c as createServerFn } from "../server.js";
const Route$4 = createRootRouteWithContext()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "airspace notes" }
    ]
  }),
  component: RootComponent
});
function RootComponent() {
  const queryClient = Route$4.useRouteContext().queryClient;
  return /* @__PURE__ */ jsx(QueryClientProvider, { client: queryClient, children: /* @__PURE__ */ jsx(RootDocument, { children: /* @__PURE__ */ jsx(Outlet, {}) }) });
}
function RootDocument({ children }) {
  return /* @__PURE__ */ jsxs("html", { children: [
    /* @__PURE__ */ jsx("head", { children: /* @__PURE__ */ jsx(HeadContent, {}) }),
    /* @__PURE__ */ jsxs("body", { children: [
      /* @__PURE__ */ jsxs("nav", { children: [
        /* @__PURE__ */ jsx("a", { href: "/", children: "notes" }),
        " · ",
        /* @__PURE__ */ jsx("a", { href: "/drafts", children: "drafts" }),
        " ·",
        " ",
        /* @__PURE__ */ jsx("a", { href: "/profile", children: "profile" })
      ] }),
      children,
      /* @__PURE__ */ jsx(Scripts, {})
    ] })
  ] });
}
var createSsrRpc = (functionId) => {
  const url = "/_serverFn/" + functionId;
  const serverFnMeta = { id: functionId };
  const fn = async (...args) => {
    return (await getServerFnById(functionId))(...args);
  };
  return Object.assign(fn, {
    url,
    serverFnMeta,
    [TSS_SERVER_FUNCTION]: true
  });
};
const getNotes = createServerFn({
  method: "GET",
  strict: false
}).handler(createSsrRpc("bc3ee0222366ccd2612be7e43cf2343ef3d9c3cff7f73da471e095bcde8691d8"));
const getNote = createServerFn({
  method: "GET",
  strict: false
}).validator((rkey) => rkey).handler(createSsrRpc("d7a5f4ccca35265f4495f103e283a4b85c9d5663e6a79c4e72c83cf6e2a373d2"));
const getProfile = createServerFn({
  method: "GET",
  strict: false
}).handler(createSsrRpc("1d3f14775aa741e13186ee52d5a6c9c1dc3aedb6f63ce977535ab3bfb61c6ff0"));
const saveProfile = createServerFn({
  method: "POST",
  strict: false
}).validator((body) => body).handler(createSsrRpc("0c83aa605d6b352175b0ae70be57537216a4801b9500473442a40ff1eed034dd"));
const getDrafts = createServerFn({
  method: "GET",
  strict: false
}).handler(createSsrRpc("d61140479c52004fdb824bfd6689653d23e1da0f082bc4b445b04da6fec91a87"));
const createDraft = createServerFn({
  method: "POST",
  strict: false
}).validator((data) => data).handler(createSsrRpc("d5e90189475ef3ba055a89641edbe9d71875ef2e70062c913df9e69bdbbd4ee1"));
const publishDraft = createServerFn({
  method: "POST",
  strict: false
}).validator((rkey) => rkey).handler(createSsrRpc("213b38372a5308f9764de551c8c31353a00a79beaf012370359ea6088334161f"));
const notesQuery = () => ({
  queryKey: ["notes"],
  queryFn: () => getNotes()
});
const noteQuery = (rkey) => ({
  queryKey: ["notes", rkey],
  queryFn: () => getNote({ data: rkey })
});
const profileQuery = () => ({
  queryKey: ["profile"],
  queryFn: () => getProfile()
});
const draftsQuery = () => ({
  queryKey: ["drafts"],
  queryFn: () => getDrafts()
});
function useNotes() {
  return useQuery(notesQuery());
}
function useNote(rkey) {
  return useQuery(noteQuery(rkey));
}
function useProfile() {
  return useQuery(profileQuery());
}
function useDrafts() {
  return useQuery(draftsQuery());
}
const $$splitComponentImporter$3 = () => import("./index-B8SKba6J.js");
const Route$3 = createFileRoute("/")({
  loader: ({
    context
  }) => context.queryClient.ensureQueryData(notesQuery()),
  component: lazyRouteComponent($$splitComponentImporter$3, "component")
});
const $$splitComponentImporter$2 = () => import("./drafts-Ci95KJ_f.js");
const Route$2 = createFileRoute("/drafts")({
  loader: ({
    context
  }) => context.queryClient.ensureQueryData(draftsQuery()),
  component: lazyRouteComponent($$splitComponentImporter$2, "component")
});
const $$splitComponentImporter$1 = () => import("./profile-Bs97aV75.js");
const Route$1 = createFileRoute("/profile")({
  loader: ({
    context
  }) => context.queryClient.ensureQueryData(profileQuery()),
  component: lazyRouteComponent($$splitComponentImporter$1, "component")
});
const $$splitComponentImporter = () => import("./notes._rkey-CksX9uVI.js");
const Route = createFileRoute("/notes/$rkey")({
  loader: ({
    context,
    params
  }) => context.queryClient.ensureQueryData(noteQuery(params.rkey)),
  component: lazyRouteComponent($$splitComponentImporter, "component")
});
const IndexRoute = Route$3.update({
  id: "/",
  path: "/",
  getParentRoute: () => Route$4
});
const DraftsRoute = Route$2.update({
  id: "/drafts",
  path: "/drafts",
  getParentRoute: () => Route$4
});
const ProfileRoute = Route$1.update({
  id: "/profile",
  path: "/profile",
  getParentRoute: () => Route$4
});
const NotesRkeyRoute = Route.update({
  id: "/notes/$rkey",
  path: "/notes/$rkey",
  getParentRoute: () => Route$4
});
const rootRouteChildren = {
  IndexRoute,
  DraftsRoute,
  ProfileRoute,
  NotesRkeyRoute
};
const routeTree = Route$4._addFileChildren(rootRouteChildren)._addFileTypes();
function getRouter() {
  const queryClient = new QueryClient();
  const router2 = createRouter({
    routeTree,
    scrollRestoration: true,
    context: { queryClient }
  });
  return router2;
}
const router = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  getRouter
}, Symbol.toStringTag, { value: "Module" }));
export {
  Route as R,
  useDrafts as a,
  useProfile as b,
  createDraft as c,
  useNote as d,
  publishDraft as p,
  router as r,
  saveProfile as s,
  useNotes as u
};
