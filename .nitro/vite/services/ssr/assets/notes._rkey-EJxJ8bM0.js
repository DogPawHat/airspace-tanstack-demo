import { K as reactExports, P as jsxRuntimeExports, R as React } from "../server.js";
import { R as Route, e as useNote } from "./router-813Zfs0r.js";
import { g as get, p as pascalCase, c as camelCase } from "./index-DhNZQhvL.js";
import "node:async_hooks";
import "node:stream";
import "node:stream/web";
import "util";
import "crypto";
import "async_hooks";
import "stream";
const unsafeLinkPrefix = [
  "javascript:",
  "data:text/html",
  "vbscript:",
  "data:text/javascript",
  "data:text/vbscript",
  "data:text/css",
  "data:text/plain",
  "data:text/xml"
];
const NAMED_ENTITIES = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  colon: ":",
  sol: "/",
  bsol: "\\",
  Tab: "	",
  NewLine: "\n"
};
function decodeHtmlEntities(value) {
  let result = value;
  for (let pass = 0; pass < 10; pass++) {
    const decoded = result.replace(/&#x([0-9a-f]+);?/gi, (match, hex) => {
      const code = Number.parseInt(hex, 16);
      return code <= 1114111 ? String.fromCodePoint(code) : match;
    }).replace(/&#(\d+);?/g, (match, dec) => {
      const code = Number.parseInt(dec, 10);
      return code <= 1114111 ? String.fromCodePoint(code) : match;
    }).replace(/&([a-z]+);?/gi, (match, name) => NAMED_ENTITIES[name] ?? match);
    if (decoded === result)
      break;
    result = decoded;
  }
  return result;
}
function isUnsafeUrlValue(value) {
  let decoded = value;
  try {
    decoded = decodeURIComponent(value);
  } catch {
  }
  const sanitized = decodeHtmlEntities(decoded);
  let url;
  try {
    url = new URL(sanitized);
  } catch {
    return false;
  }
  return unsafeLinkPrefix.some((prefix) => url.href.toLowerCase().startsWith(prefix));
}
const HTML_SINK_PROPS = /* @__PURE__ */ new Set(["innerhtml", "dangerouslysetinnerhtml", "textcontent"]);
function resolveAttributes(attrs, renderData, options = {}) {
  const result = {};
  for (const key in attrs) {
    if (key === "$")
      continue;
    const value = attrs[key];
    const isBinding = key.charCodeAt(0) === 58;
    const outKey = isBinding ? key.slice(1) : key;
    if (HTML_SINK_PROPS.has(outKey.toLowerCase()))
      continue;
    let outValue;
    let resultKey = key;
    if (options.parseJson && isBinding) {
      if (typeof value === "string") {
        try {
          outValue = JSON.parse(value);
        } catch {
          outValue = get(renderData, value);
        }
      } else {
        outValue = value;
      }
      resultKey = outKey;
    } else if (isBinding && typeof value === "string") {
      const resolved = get(renderData, value);
      if (resolved !== void 0) {
        outValue = resolved;
        resultKey = outKey;
      } else {
        outValue = value;
      }
    } else {
      outValue = value;
    }
    const lowerOutKey = outKey.toLowerCase();
    if (isBinding && (lowerOutKey === "href" || lowerOutKey === "src" || lowerOutKey === "xlink:href") && typeof outValue === "string" && isUnsafeUrlValue(outValue)) {
      continue;
    }
    result[resultKey] = outValue;
  }
  return result;
}
const CARET_TEXT = " ";
const CARET_STYLE = "background-color: currentColor; display: inline-block; margin-left: 0.25rem; margin-right: 0.25rem; animation: pulse 0.75s cubic-bezier(0.4,0,0.6,1) infinite;";
function getCaret(options) {
  if (options === true) {
    return ["span", { key: "stream-caret", style: CARET_STYLE }, CARET_TEXT];
  }
  if (typeof options === "object") {
    const userClass = options?.class || "";
    return [
      "span",
      {
        key: "stream-caret",
        style: CARET_STYLE,
        ...userClass ? { class: userClass } : {}
      },
      CARET_TEXT
    ];
  }
  return null;
}
function findLastTextNodeAndAppendNode(parent, nodeToAppend) {
  for (let i = parent.length - 1; i >= 2; i--) {
    const node = parent[i];
    if (typeof node === "string" && parent[1]?.key !== "stream-caret") {
      parent.push(nodeToAppend);
      return true;
    }
    if (Array.isArray(node)) {
      if (findLastTextNodeAndAppendNode(node, nodeToAppend)) {
        return true;
      }
    }
  }
  return false;
}
function getTag(node) {
  if (Array.isArray(node) && node.length >= 1) {
    return node[0];
  }
  return null;
}
function cssStringToObject(cssString) {
  return cssString.split(";").filter(Boolean).reduce((acc, rule) => {
    const [prop, value] = rule.split(":");
    if (!prop || !value)
      return acc;
    let camelProp = prop.trim();
    if (!prop.startsWith("--")) {
      camelProp = camelCase(camelProp);
    }
    acc[camelProp] = value.trim();
    return acc;
  }, {});
}
function getProps(node) {
  if (Array.isArray(node) && node.length >= 2) {
    return node[1] || {};
  }
  return {};
}
function getChildren(node) {
  if (Array.isArray(node) && node.length > 2) {
    return node.slice(2);
  }
  return [];
}
const asyncComponentCache = /* @__PURE__ */ new Map();
function isPromiseLike(value) {
  return !!value && typeof value.then === "function";
}
function unwrapComponent(mod) {
  return mod && typeof mod === "object" && "default" in mod ? mod.default : mod;
}
function resolveComponent(tag, components, componentsManifest) {
  const pascalTag = pascalCase(tag);
  const proseTag = `Prose${pascalTag}`;
  let resolvedComponent = components[proseTag] || components[pascalTag] || components[tag];
  if (!resolvedComponent && componentsManifest) {
    const cacheKey = tag;
    if (!asyncComponentCache.has(cacheKey)) {
      const resolved = componentsManifest(tag);
      if (isPromiseLike(resolved)) {
        asyncComponentCache.set(cacheKey, reactExports.lazy(() => resolved));
      } else if (resolved) {
        asyncComponentCache.set(cacheKey, unwrapComponent(resolved));
      }
    }
    resolvedComponent = asyncComponentCache.get(cacheKey);
  }
  return resolvedComponent;
}
function renderNode(node, components = {}, key, componentsManifest, parent, renderData = { frontmatter: {}, meta: {}, data: {}, props: {} }) {
  if (typeof node === "string") {
    return node;
  }
  if (Array.isArray(node)) {
    const tag = getTag(node);
    if (!tag)
      return null;
    const nodeProps = getProps(node);
    const children = getChildren(node);
    let customComponent;
    if (parent?.[0] !== "pre") {
      if (nodeProps.as) {
        customComponent = resolveComponent(nodeProps.as, components, componentsManifest);
      }
      if (!customComponent) {
        customComponent = resolveComponent(tag, components, componentsManifest);
      }
    }
    const Component = customComponent || tag;
    const resolved = resolveAttributes(nodeProps, renderData, { parseJson: true });
    const props = {};
    for (const k in resolved) {
      const v = resolved[k];
      if (k === "className" || k === "class") {
        props.className = v;
      } else if (k === "style" && typeof v === "string") {
        props.style = cssStringToObject(v);
      } else if (k === "tabindex") {
        props.tabIndex = v;
      } else {
        props[k] = v;
      }
    }
    if (typeof Component !== "string" && Component?.propTypes?.__node !== void 0) {
      props.__node = node;
    }
    if (key !== void 0) {
      props.key = key;
    }
    if (["hr", "br", "img"].includes(tag)) {
      return React.createElement(Component, props);
    }
    const hasOwnAttrs = Object.keys(resolved).length > 0;
    const childrenRenderData = hasOwnAttrs ? { ...renderData, props } : renderData;
    const slots = {};
    const regularChildren = [];
    for (let i = 0; i < children.length; i++) {
      const child = children[i];
      if (child === void 0 || child === null)
        continue;
      const childTag = getTag(child);
      const childProps = getProps(child);
      if (childTag === "template" && childProps) {
        let slotName;
        if (childProps.name) {
          slotName = childProps.name;
        } else {
          for (const pk in childProps) {
            if (pk.startsWith("#")) {
              slotName = pk.substring(1);
              break;
            }
          }
        }
        if (slotName) {
          const slotChildren = getChildren(child);
          slots[slotName] = slotChildren.map((slotChild, idx) => renderNode(slotChild, components, idx, componentsManifest, node, childrenRenderData)).filter((slotChild) => slotChild !== null);
          continue;
        }
      }
      const rendered = renderNode(child, components, i, componentsManifest, node, childrenRenderData);
      if (rendered !== null) {
        regularChildren.push(rendered);
      }
    }
    if (customComponent) {
      if (regularChildren.length > 0) {
        slots.default = regularChildren;
      }
      const finalProps = { ...props };
      for (const slotName in slots) {
        if (slotName === "default") {
          finalProps.children = slots[slotName];
        } else {
          finalProps[`slot${slotName.charAt(0).toUpperCase() + slotName.slice(1)}`] = slots[slotName];
        }
      }
      const componentTag = nodeProps.as || tag;
      const isLazyComponent = asyncComponentCache.has(componentTag);
      if (isLazyComponent) {
        return jsxRuntimeExports.jsx(reactExports.Suspense, { fallback: null, children: React.createElement(Component, finalProps) }, key);
      }
      return React.createElement(Component, finalProps);
    }
    return React.createElement(Component, props, ...regularChildren);
  }
  return null;
}
const MarkdownDocument = ({ value, components: customComponents = {}, componentsManifest, streaming = false, caret: caretProp = false, data, className }) => {
  const document = value ?? { nodes: [] };
  const caret = reactExports.useMemo(() => getCaret(caretProp), [caretProp]);
  const renderedNodes = reactExports.useMemo(() => {
    const nodes = [...document.nodes || []];
    if (streaming && caret && nodes.length > 0) {
      const hasStreamCaret = findLastTextNodeAndAppendNode(nodes[nodes.length - 1], caret);
      if (!hasStreamCaret) {
        nodes.push(caret);
      }
    }
    const renderData = {
      frontmatter: document.frontmatter || document.data || {},
      meta: document.meta || {},
      data: data || {},
      props: {}
    };
    return nodes.map((node, index) => renderNode(node, customComponents, index, componentsManifest, void 0, renderData)).filter((child) => child !== null);
  }, [document, customComponents, componentsManifest, streaming, caret, data]);
  return jsxRuntimeExports.jsx("div", { className: `comark-content ${className || ""}`, children: renderedNodes });
};
function NotePage() {
  const {
    rkey
  } = Route.useParams();
  const {
    data
  } = useNote(rkey);
  if (!data) return null;
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("article", { children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx("h1", { children: data.note.value.title }),
    data.tag ? /* @__PURE__ */ jsxRuntimeExports.jsxs("p", { children: [
      "tagged ",
      data.tag
    ] }) : null,
    data.cover ? /* @__PURE__ */ jsxRuntimeExports.jsx("img", { src: data.cover, alt: data.note.value.title }) : null,
    /* @__PURE__ */ jsxRuntimeExports.jsx(MarkdownDocument, { value: data.note.meta.markdown ?? void 0 }),
    !data.note.meta.markdown ? /* @__PURE__ */ jsxRuntimeExports.jsx("p", { children: data.note.value.body }) : null
  ] });
}
export {
  NotePage as component
};
