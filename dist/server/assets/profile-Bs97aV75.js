import { jsxs, jsx } from "react/jsx-runtime";
import { u as useServerFn } from "./useServerFn-DL2oePlL.js";
import { useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { b as useProfile, s as saveProfile } from "./router-MC7vLz9E.js";
import "@tanstack/react-router";
import "../server.js";
import "node:async_hooks";
import "node:stream";
import "@tanstack/react-router/ssr/server";
function ProfilePage() {
  const {
    data
  } = useProfile();
  const saveProfileFn = useServerFn(saveProfile);
  const queryClient = useQueryClient();
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    if (data) {
      setDisplayName(data.displayName ?? "");
      setBio(data.bio ?? "");
    }
  }, [data]);
  async function save() {
    await saveProfileFn({
      data: {
        displayName,
        bio
      }
    });
    await queryClient.invalidateQueries({
      queryKey: ["profile"]
    });
    await queryClient.invalidateQueries({
      queryKey: ["notes"]
    });
    setSaved(true);
  }
  return /* @__PURE__ */ jsxs("form", { onSubmit: (e) => void save(), children: [
    /* @__PURE__ */ jsx("h1", { children: "Profile" }),
    /* @__PURE__ */ jsx("p", { children: /* @__PURE__ */ jsx("input", { value: displayName, onChange: (e) => setDisplayName(e.target.value), placeholder: "Display name", required: true }) }),
    /* @__PURE__ */ jsx("p", { children: /* @__PURE__ */ jsx("textarea", { value: bio, onChange: (e) => setBio(e.target.value), placeholder: "Bio" }) }),
    /* @__PURE__ */ jsx("button", { type: "submit", children: "Save" }),
    saved ? /* @__PURE__ */ jsx("p", { children: "Saved" }) : null
  ] });
}
export {
  ProfilePage as component
};
