import { K as reactExports, P as jsxRuntimeExports } from "../server.js";
import { u as useServerFn } from "./useServerFn-CgLAj4KG.js";
import { d as useProfile, s as saveProfile, b as useQueryClient } from "./router-813Zfs0r.js";
import "node:async_hooks";
import "node:stream";
import "node:stream/web";
import "util";
import "crypto";
import "async_hooks";
import "stream";
function ProfilePage() {
  const {
    data
  } = useProfile();
  const saveProfileFn = useServerFn(saveProfile);
  const queryClient = useQueryClient();
  const [displayName, setDisplayName] = reactExports.useState("");
  const [bio, setBio] = reactExports.useState("");
  const [saved, setSaved] = reactExports.useState(false);
  reactExports.useEffect(() => {
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
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("form", { onSubmit: (e) => void save(), children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx("h1", { children: "Profile" }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("p", { children: /* @__PURE__ */ jsxRuntimeExports.jsx("input", { value: displayName, onChange: (e) => setDisplayName(e.target.value), placeholder: "Display name", required: true }) }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("p", { children: /* @__PURE__ */ jsxRuntimeExports.jsx("textarea", { value: bio, onChange: (e) => setBio(e.target.value), placeholder: "Bio" }) }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("button", { type: "submit", children: "Save" }),
    saved ? /* @__PURE__ */ jsxRuntimeExports.jsx("p", { children: "Saved" }) : null
  ] });
}
export {
  ProfilePage as component
};
