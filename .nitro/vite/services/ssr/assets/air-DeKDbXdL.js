import { $ as TSS_SERVER_FUNCTION, a2 as getDefaultExportFromCjs, a1 as createServerFn } from "../server.js";
import crypto from "crypto";
import { k as kebabCase, v as visit, E as EntityDecoder$1, x as xmlDecodeTree, h as htmlDecodeTree$1, D as DecodingMode$1, t as textContent } from "./index-DhNZQhvL.js";
function _mergeNamespaces(n, m) {
  for (var i = 0; i < m.length; i++) {
    const e = m[i];
    if (typeof e !== "string" && !Array.isArray(e)) {
      for (const k in e) {
        if (k !== "default" && !(k in n)) {
          const d = Object.getOwnPropertyDescriptor(e, k);
          if (d) {
            Object.defineProperty(n, k, d.get ? d : {
              enumerable: true,
              get: () => e[k]
            });
          }
        }
      }
    }
  }
  return Object.freeze(Object.defineProperty(n, Symbol.toStringTag, { value: "Module" }));
}
var createServerRpc = (serverFnMeta, splitImportFn) => {
  const url = "/_serverFn/" + serverFnMeta.id;
  return Object.assign(splitImportFn, {
    url,
    serverFnMeta,
    [TSS_SERVER_FUNCTION]: true
  });
};
var AirspaceError = class extends Error {
  name = "AirspaceError";
  constructor(message, options) {
    super(`[airspace] ${message}`, options);
  }
};
var SpacesUnsupportedError = class extends AirspaceError {
  name = "SpacesUnsupportedError";
  service;
  constructor(service, options) {
    super(`${service} does not serve permissioned spaces`, options);
    this.service = service;
  }
};
var ValidationError = class extends AirspaceError {
  name = "ValidationError";
  issues;
  constructor(context, cause) {
    super(`${context}: ${cause.message}`, { cause });
    this.issues = issuesOf(cause);
  }
};
var ConflictError = class extends AirspaceError {
  name = "ConflictError";
  collection;
  rkey;
  /** The CID passed as `ifMatch`, which is no longer the record's. */
  cid;
  constructor(collection, rkey, cid, options) {
    super(`${collection}/${rkey} has changed since ${cid}`, options);
    this.collection = collection;
    this.rkey = rkey;
    this.cid = cid;
  }
};
var ScopeError = class extends AirspaceError {
  name = "ScopeError";
  missingScope;
  constructor(missingScope, options) {
    super(`the session is missing the "${missingScope}" scope; the user has to authorize again`, options);
    this.missingScope = missingScope;
  }
};
function issuesOf(error2) {
  return error2.issues.map((issue) => {
    return {
      path: [...issue.path, ..."key" in issue && typeof issue.key === "string" ? [issue.key] : []].map(String).join("."),
      message: issue.message
    };
  });
}
const FETCH_TIMEOUT = 5e3;
const MAX_BODY = 262144;
async function boundedText(res, limit = MAX_BODY) {
  const declared = Number(res.headers.get("content-length"));
  if (declared > limit) throw new AirspaceError(`response body is ${declared} bytes, over the ${limit} byte limit`);
  if (!res.body) return "";
  const chunks = [];
  let size = 0;
  const reader = res.body.getReader();
  try {
    for (; ; ) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) throw new AirspaceError(`response body is over the ${limit} byte limit`);
      chunks.push(value);
    }
  } finally {
    reader.cancel().catch(() => {
    });
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}
async function boundedJson(res, limit = MAX_BODY) {
  return JSON.parse(await boundedText(res, limit));
}
const HOSTNAME = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z](?:[a-z0-9-]{0,61}[a-z0-9])?$/i;
const RESERVED_TLD = /\.(?:alt|arpa|corp|example|home|internal|intranet|invalid|lan|local|localhost|onion)$/i;
const isPublicHostname = (value) => typeof value === "string" && value.length <= 253 && HOSTNAME.test(value) && !RESERVED_TLD.test(value);
function assertPublicUrl(url, options = {}) {
  if (url.username || url.password) throw new AirspaceError(`refusing to fetch ${url.host}: the URL carries credentials`);
  if (options.allowPrivateNetwork) {
    if (url.protocol !== "https:" && url.protocol !== "http:") throw new AirspaceError(`refusing to fetch ${url.href}: not an http(s) URL`);
    return;
  }
  if (url.protocol !== "https:") throw new AirspaceError(`refusing to fetch ${url.href}: only https is allowed; pass \`allowPrivateNetwork\` for a local PDS`);
  if (!isPublicHostname(url.hostname)) throw new AirspaceError(`refusing to fetch ${url.host}: not a public hostname; pass \`allowPrivateNetwork\` for a local PDS`);
}
const PUBLIC_API = "https://public.api.bsky.app";
const DOH = "https://cloudflare-dns.com/dns-query";
const PLC = "https://plc.directory";
const DID_PLC = /^did:plc:[a-z2-7]{24}$/;
const DID_WEB_LOCALHOST = /^did:web:localhost(?:%3A\d{1,5})?$/i;
const DID_SYNTAX = /^did:[a-z]+:[\w.:%-]*[\w.-]$/i;
const isDid = (value) => typeof value === "string" && DID_SYNTAX.test(value) && value.length <= 2048;
const isHandle = isPublicHostname;
function didWebUrl(did) {
  const host = did.slice(8);
  if (!isHandle(host) && !DID_WEB_LOCALHOST.test(did)) return void 0;
  return new URL(`https://${decodeURIComponent(host)}/.well-known/did.json`);
}
const isResolvableDid = (value) => typeof value === "string" && (DID_PLC.test(value) || value.startsWith("did:web:") && !!didWebUrl(value));
const guarded = (url) => fetch(url, {
  signal: AbortSignal.timeout(FETCH_TIMEOUT),
  redirect: "error"
});
async function resolveHandle(handle) {
  const fromDns = await resolveHandleDns(handle);
  if (fromDns) return fromDns;
  try {
    const res2 = await guarded(new URL(`https://${handle}/.well-known/atproto-did`));
    if (res2.ok) {
      const text2 = (await boundedText(res2)).trim();
      if (isResolvableDid(text2)) return text2;
    }
  } catch {
  }
  const res = await fetch(`${PUBLIC_API}/xrpc/com.atproto.identity.resolveHandle?handle=${encodeURIComponent(handle)}`, { signal: AbortSignal.timeout(FETCH_TIMEOUT) });
  if (!res.ok) throw new AirspaceError(`could not resolve handle ${handle}: ${res.status}`);
  const { did } = await boundedJson(res);
  if (!isResolvableDid(did)) throw new AirspaceError(`could not resolve handle ${handle}: the directory answered with ${JSON.stringify(did)}`);
  return did;
}
function didFromTxt(records) {
  for (const value of records) if (value.startsWith("did=") && isResolvableDid(value.slice(4))) return value.slice(4);
}
let nodeResolver;
function loadNodeResolver() {
  return nodeResolver ??= import("node:dns/promises").then((dns) => dns.resolveTxt, () => void 0);
}
async function resolveHandleDns(handle) {
  const name = `_atproto.${handle}`;
  const resolveTxt = await loadNodeResolver();
  if (resolveTxt) try {
    return didFromTxt((await resolveTxt(name)).map((chunks) => chunks.join("")));
  } catch {
    return;
  }
  try {
    const res = await fetch(`${DOH}?name=${encodeURIComponent(name)}&type=TXT`, {
      headers: { accept: "application/dns-json" },
      signal: AbortSignal.timeout(FETCH_TIMEOUT)
    });
    if (!res.ok) return void 0;
    const { Answer } = await boundedJson(res);
    return didFromTxt((Array.isArray(Answer) ? Answer : []).map((answer) => String(answer?.data ?? "").replace(/^"|"$/g, "")));
  } catch {
    return;
  }
}
async function resolveDidDocument(did, options) {
  let res;
  if (DID_PLC.test(did)) res = await fetch(`${PLC}/${did}`, { signal: AbortSignal.timeout(FETCH_TIMEOUT) });
  else if (did.startsWith("did:web:")) {
    const url = didWebUrl(did);
    if (!url) throw new AirspaceError(`malformed did:web: ${did}`);
    assertPublicUrl(url, options);
    res = await guarded(url);
  } else throw new AirspaceError(`unsupported DID method: ${did}`);
  if (!res.ok) throw new AirspaceError(`could not resolve ${did}: ${res.status}`);
  const doc = await boundedJson(res);
  if (!doc || typeof doc !== "object") throw new AirspaceError(`could not resolve ${did}: not a DID document`);
  if (did.startsWith("did:web:") && doc.id !== did) throw new AirspaceError(`could not resolve ${did}: the document describes ${JSON.stringify(doc.id)}`);
  return doc;
}
function pdsEndpoint(did, doc, options) {
  const endpoint = (Array.isArray(doc.service) ? doc.service : []).find((s) => s && typeof s.id === "string" && (s.id === "#atproto_pds" || s.id.endsWith("#atproto_pds")))?.serviceEndpoint;
  if (typeof endpoint !== "string") throw new AirspaceError(`${did} has no #atproto_pds service`);
  let url;
  try {
    url = new URL(endpoint);
  } catch {
    throw new AirspaceError(`${did} has an invalid #atproto_pds endpoint: ${endpoint}`);
  }
  if (url.pathname !== "/" || url.search || url.hash || url.username || url.password) throw new AirspaceError(`${did} has an invalid #atproto_pds endpoint: ${endpoint}`);
  assertPublicUrl(url, options);
  return url.origin;
}
function resolveIdentity(input, options = {}) {
  if (typeof input !== "string" && !isDid(input?.did)) throw new AirspaceError(`identity.did must be a DID, got ${JSON.stringify(input?.did)}`);
  if (typeof input === "string" && !input.trim()) throw new AirspaceError("identity must be a handle or a DID, got an empty string");
  if (typeof input === "string" && !isDid(input) && !isHandle(input)) throw new AirspaceError(`identity must be a handle or a DID, got ${JSON.stringify(input)}`);
  if (typeof input !== "string" && input.service) return {
    did: input.did,
    handle: input.handle,
    service: input.service
  };
  return (async () => {
    const did = typeof input !== "string" ? input.did : isDid(input) ? input : await resolveHandle(input.toLowerCase());
    if (!isResolvableDid(did)) throw new AirspaceError(`unsupported or malformed DID: ${did}`);
    const doc = await resolveDidDocument(did, options);
    const service = pdsEndpoint(did, doc, options);
    return {
      did,
      handle: (typeof input === "string" ? isDid(input) ? void 0 : input : input.handle) ?? handleFromDoc(doc),
      service
    };
  })();
}
function handleFromDoc(doc) {
  const handle = (Array.isArray(doc.alsoKnownAs) ? doc.alsoKnownAs : []).find((a) => typeof a === "string" && a.startsWith("at://"))?.slice(5);
  return isHandle(handle) ? handle : void 0;
}
async function passwordSession(options) {
  const { PasswordSession } = await import("./index-D4RNpX7f.js");
  return await PasswordSession.login(options);
}
function applyDefaults(options, ...defaults) {
  const combined = { ...options };
  for (const def of defaults) {
    for (const key of Object.keys(def)) {
      if (combined[key] === void 0) {
        combined[key] = def[key];
      }
    }
  }
  return combined;
}
function isBlobLike(value) {
  if (value == null)
    return false;
  if (typeof value !== "object")
    return false;
  if (typeof Blob === "function" && value instanceof Blob)
    return true;
  const tag = value[Symbol.toStringTag];
  if (tag === "Blob" || tag === "File") {
    return "stream" in value && typeof value.stream === "function";
  }
  return false;
}
function isAsyncIterable(value) {
  return value != null && typeof value[Symbol.asyncIterator] === "function";
}
function asUint8ArrayArrayBuffer(bytes) {
  if (bytes.buffer instanceof ArrayBuffer) {
    return bytes;
  }
  return new Uint8Array(bytes);
}
function buildXrpcRequestHeaders({ service, labelers, appLabelers, headers: headersInit }) {
  const headers = new Headers(headersInit);
  if (service !== void 0) {
    if (service === null) {
      headers.delete("atproto-proxy");
    } else {
      headers.set("atproto-proxy", service);
    }
  }
  const combinedLabelers = /* @__PURE__ */ new Set();
  if (appLabelers) {
    for (const labeler of appLabelers) {
      combinedLabelers.add(`${labeler};redact`);
    }
  }
  if (labelers) {
    for (const labeler of labelers) {
      combinedLabelers.add(labeler);
    }
  }
  if (labelers !== null) {
    const headersLabelers = headers.get("atproto-accept-labelers");
    if (headersLabelers) {
      for (const labeler of headersLabelers.split(",").map(trim).filter(Boolean)) {
        if (labeler)
          combinedLabelers.add(labeler);
      }
    }
  }
  if (combinedLabelers.size > 0) {
    headers.set("atproto-accept-labelers", Array.from(combinedLabelers).join(", "));
  } else {
    headers.delete("atproto-accept-labelers");
  }
  return headers;
}
function toReadableStream(data) {
  if ("from" in ReadableStream && typeof ReadableStream.from === "function") {
    return ReadableStream.from(data);
  }
  return toReadableStreamPonyfill(data);
}
function toReadableStreamPonyfill(data) {
  let iterator;
  return new ReadableStream({
    async pull(controller) {
      try {
        iterator ??= data[Symbol.asyncIterator]();
        const result = await iterator.next();
        if (result.done)
          controller.close();
        else
          controller.enqueue(result.value);
      } catch (err) {
        controller.error(err);
        iterator = void 0;
      }
    },
    async cancel() {
      await iterator?.return?.();
      iterator = void 0;
    }
  });
}
function getDefaultRecordKey(schema) {
  if (schema.key === "tid")
    return void 0;
  if (schema.key === "any")
    return void 0;
  return getLiteralRecordKey(schema);
}
function getLiteralRecordKey(schema) {
  if (schema.key.startsWith("literal:")) {
    return schema.key.slice(8);
  }
  throw new TypeError(`An "rkey" must be provided for record key type "${schema.key}" (${schema.$type})`);
}
function mergeHeaders(defaultHeaders, requestHeaders) {
  const result = new Headers(defaultHeaders);
  const overrides = requestHeaders instanceof Headers ? requestHeaders : new Headers(requestHeaders);
  for (const [key, value] of overrides.entries()) {
    result.set(key, value);
  }
  return result;
}
function getAbortReason(signal) {
  if ("reason" in signal)
    return signal.reason;
  return typeof DOMException !== "undefined" ? new DOMException("Aborted", "AbortError") : new Error("Aborted");
}
function throwIfAborted(signal) {
  if (!signal)
    return;
  if (typeof signal.throwIfAborted === "function") {
    signal.throwIfAborted();
    return;
  }
  if (signal.aborted)
    throw getAbortReason(signal);
}
function wait(ms, { signal } = {}) {
  return new Promise((resolve, reject) => {
    throwIfAborted(signal);
    const cleanup = () => {
      clearTimeout(timeout);
      signal?.removeEventListener("abort", onAbort);
    };
    const timeout = setTimeout(() => {
      cleanup();
      resolve();
    }, ms);
    const onAbort = () => {
      cleanup();
      reject(getAbortReason(signal));
    };
    signal?.addEventListener("abort", onAbort);
  });
}
function trim(value) {
  return value.trim();
}
function isAgent(value) {
  return typeof value === "object" && value !== null && "fetchHandler" in value && typeof value.fetchHandler === "function" && (!("did" in value) || value.did === void 0 || typeof value.did === "string");
}
function buildAgent(options) {
  if (typeof options === "function") {
    return { did: void 0, fetchHandler: options };
  }
  const config2 = typeof options === "string" || options instanceof URL ? { did: void 0, service: options } : options;
  if ("fetchHandler" in config2) {
    if (isAgent(config2))
      return config2;
    throw new TypeError("fetchHandler must not be provided when using AgentConfig");
  }
  const { did, service, fetch: fetch2 = globalThis.fetch, headers: defaultHeaders } = config2;
  if (typeof fetch2 !== "function") {
    throw new TypeError("fetch() is not available in this environment");
  }
  return {
    get did() {
      return did;
    },
    async fetchHandler(path, init) {
      const headers = defaultHeaders != null && init.headers != null ? mergeHeaders(defaultHeaders, init.headers) : defaultHeaders || init.headers;
      return fetch2(new URL(path, service), headers !== init.headers ? { ...init, headers } : init);
    }
  };
}
// @__NO_SIDE_EFFECTS__
function $type(nsid, hash) {
  return hash === "main" ? nsid : `${nsid}#${hash}`;
}
function $typed(value, $type2) {
  return value.$type === $type2 ? value : { ...value, $type: $type2 };
}
const DID_REGEX = /^did:[a-z]+:[a-zA-Z0-9._:%-]*[a-zA-Z0-9._-]$/;
function isValidDid(input) {
  return typeof input === "string" && input.length <= 2048 && DID_REGEX.test(input);
}
const HANDLE_REGEX = /^([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?$/;
function isValidHandle(input) {
  return typeof input === "string" && input.length <= 253 && HANDLE_REGEX.test(input);
}
function isAtIdentifierString(input) {
  if (!input || typeof input !== "string") {
    return false;
  } else if (input.startsWith("did:")) {
    return isValidDid(input);
  } else {
    return isValidHandle(input);
  }
}
function success$1(value) {
  return { success: true, value };
}
function failure$1(message) {
  return { success: false, message };
}
function isValidNsid(input) {
  return typeof input === "string" && validateNsidRegex(input).success;
}
function validateNsidRegex(value) {
  if (value.length > 253 + 1 + 63) {
    return failure$1("NSID is too long (317 chars max)");
  }
  if (
    // Fast check for small values
    value.length < 5 || !/^[a-zA-Z](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+(?:\.[a-zA-Z](?:[a-zA-Z0-9]{0,62})?)$/.test(value)
  ) {
    return failure$1("NSID didn't validate via regex");
  }
  return success$1(value);
}
const RECORD_KEY_MAX_LENGTH = 512;
const RECORD_KEY_MIN_LENGTH = 1;
const RECORD_KEY_INVALID_VALUES = /* @__PURE__ */ new Set([".", ".."]);
const RECORD_KEY_REGEX = /^[a-zA-Z0-9_~.:-]{1,512}$/;
function isValidRecordKey(input) {
  return typeof input === "string" && input.length >= RECORD_KEY_MIN_LENGTH && input.length <= RECORD_KEY_MAX_LENGTH && RECORD_KEY_REGEX.test(input) && !RECORD_KEY_INVALID_VALUES.has(input);
}
function isAtUriString(input, options) {
  return parseAtUriString(input, options).success;
}
const INVALID_CHAR_REGEXP = /[^a-zA-Z0-9._~:@!$&'()*+,;=%/\\[\]#?-]/;
const AT_URI_REGEXP = /^(?<uri>at:\/\/(?<authority>[^/?#\s]+)(?:\/(?<collection>[^/?#\s]+)(?:\/(?<rkey>[^/?#\s]+))?)?(?<trailingSlash>\/)?)(?:\?(?<query>[^#\s]*))?(?:#(?<hash>[^\s]*))?$/;
function parseAtUriString(input, options) {
  if (typeof input !== "string") {
    return failure$1("ATURI must be a string");
  }
  if (input.length > 8192) {
    return failure$1("ATURI exceeds maximum length");
  }
  const invalidChar = input.match(INVALID_CHAR_REGEXP);
  if (invalidChar) {
    return failure$1("Disallowed characters in ATURI (ASCII)");
  }
  const match2 = input.match(AT_URI_REGEXP);
  const groups = match2?.groups;
  if (!groups) {
    if (options?.detailed) {
      if (!input.startsWith("at://")) {
        return failure$1('ATURI must start with "at://"');
      }
      if (input.includes(" ")) {
        return failure$1("ATURI can not contain spaces");
      }
      if (input.includes("//", 5)) {
        return failure$1("ATURI can not have empty path segments");
      }
      const pathStart = input.indexOf("/", 5);
      if (pathStart !== -1) {
        const fragmentIndex = input.indexOf("#");
        const pathEnd = fragmentIndex !== -1 ? fragmentIndex : input.length;
        const secondSlash = input.indexOf("/", pathStart + 1);
        if (secondSlash !== -1 && secondSlash !== pathEnd - 1) {
          return failure$1("ATURI can not have more than two path segments");
        }
      }
    }
    return failure$1("ATURI does not match expected format");
  }
  if (!isAtIdentifierString(groups.authority)) {
    return failure$1("ATURI has invalid authority");
  }
  if (groups.collection != null && !isValidNsid(groups.collection)) {
    return failure$1("ATURI has invalid collection");
  }
  if (groups.hash != null) {
    const result = parseJsonPointer(groups.hash, options);
    if (result.success) {
      groups.hash = result.value;
    } else {
      return failure$1(`ATURI has invalid fragment (${result.message})`);
    }
  }
  if (options?.strict !== false) {
    if (groups.trailingSlash != null) {
      return failure$1("ATURI can not have a trailing slash");
    }
    if (groups.query != null) {
      return failure$1("ATURI query part is not allowed");
    }
    if (groups.rkey != null && !isValidRecordKey(groups.rkey)) {
      return failure$1("ATURI has invalid record key");
    }
  }
  return success$1(groups);
}
const BASIC_JSON_POINTER_REGEXP = /^\/[a-zA-Z0-9._~:@!$&')(*+,;=%[\]/-]*$/;
function parseJsonPointer(value, options) {
  if (!BASIC_JSON_POINTER_REGEXP.test(value)) {
    return failure$1("Invalid JSON pointer");
  }
  const result = parsePercentEncoding(value);
  if (!result.success && options?.strict === false) {
    return success$1(value);
  }
  return result;
}
function parsePercentEncoding(value) {
  try {
    return success$1(decodeURIComponent(value));
  } catch {
    return failure$1("Invalid percent-encoding");
  }
}
var dist = {};
var hasRequiredDist;
function requireDist() {
  if (hasRequiredDist) return dist;
  hasRequiredDist = 1;
  (function(exports) {
    (() => {
      var e = { d: (t2, r2) => {
        for (var n2 in r2) e.o(r2, n2) && !e.o(t2, n2) && Object.defineProperty(t2, n2, { enumerable: true, get: r2[n2] });
      }, o: (e2, t2) => Object.prototype.hasOwnProperty.call(e2, t2), r: (e2) => {
        "undefined" != typeof Symbol && Symbol.toStringTag && Object.defineProperty(e2, Symbol.toStringTag, { value: "Module" }), Object.defineProperty(e2, "__esModule", { value: true });
      } }, t = {};
      function r(e2, t2) {
        return void 0 === t2 && (t2 = "-"), new RegExp("^(?!0{4}" + t2 + "0{2}" + t2 + "0{2})((?=[0-9]{4}" + t2 + "(((0[^2])|1[0-2])|02(?=" + t2 + "(([0-1][0-9])|2[0-8])))" + t2 + "[0-9]{2})|(?=((([13579][26])|([2468][048])|(0[48]))0{2})|([0-9]{2}((((0|[2468])[48])|[2468][048])|([13579][26])))" + t2 + "02" + t2 + "29))([0-9]{4})" + t2 + "(?!((0[469])|11)" + t2 + "31)((0[1,3-9]|1[0-2])|(02(?!" + t2 + "3)))" + t2 + "(0[1-9]|[1-2][0-9]|3[0-1])$").test(e2);
      }
      function n(e2) {
        var t2 = /\D/.exec(e2);
        return t2 ? t2[0] : "";
      }
      function i(e2, t2, r2) {
        void 0 === t2 && (t2 = ":"), void 0 === r2 && (r2 = false);
        var i2 = new RegExp("^([0-1]|2(?=([0-3])|4" + t2 + "00))[0-9]" + t2 + "[0-5][0-9](" + t2 + "([0-5]|6(?=0))[0-9])?(.[0-9]{1,9})?$");
        if (!r2 || !/[Z+\-]/.test(e2)) return i2.test(e2);
        if (/Z$/.test(e2)) return i2.test(e2.replace("Z", ""));
        var o2 = e2.includes("+"), a2 = e2.split(/[+-]/), u2 = a2[0], d2 = a2[1];
        return i2.test(u2) && (function(e3, t3, r3) {
          return void 0 === r3 && (r3 = ":"), new RegExp(t3 ? "^(0(?!(2" + r3 + "4)|0" + r3 + "3)|1(?=([0-1]|2(?=" + r3 + "[04])|[34](?=" + r3 + "0))))([03469](?=" + r3 + "[03])|[17](?=" + r3 + "0)|2(?=" + r3 + "[04])|5(?=" + r3 + "[034])|8(?=" + r3 + "[04]))" + r3 + "([03](?=0)|4(?=5))[05]$" : "^(0(?=[^0])|1(?=[0-2]))([39](?=" + r3 + "[03])|[0-24-8](?=" + r3 + "00))" + r3 + "[03]0$").test(e3);
        })(d2, o2, n(d2));
      }
      function o(e2) {
        var t2 = e2.split("T"), o2 = t2[0], a2 = t2[1], u2 = r(o2, n(o2));
        if (!a2) return false;
        var d2, s = (d2 = a2.match(/([^Z+\-\d])(?=\d+\1)/), Array.isArray(d2) ? d2[0] : "");
        return u2 && i(a2, s, true);
      }
      function a(e2, t2) {
        return void 0 === t2 && (t2 = "-"), new RegExp("^[0-9]{4}" + t2 + "(0(?=[^0])|1(?=[0-2]))[0-9]$").test(e2);
      }
      e.r(t), e.d(t, { isValidDate: () => r, isValidISODateString: () => o, isValidTime: () => i, isValidYearMonth: () => a });
      var u = exports;
      for (var d in t) u[d] = t[d];
      t.__esModule && Object.defineProperty(u, "__esModule", { value: true });
    })();
  })(dist);
  return dist;
}
var distExports = requireDist();
const index = /* @__PURE__ */ getDefaultExportFromCjs(distExports);
const isoDatestringValidator = /* @__PURE__ */ _mergeNamespaces({
  __proto__: null,
  default: index
}, [distExports]);
const { isValidISODateString } = ((m) => m.default ?? m)(isoDatestringValidator);
function isDatetimeString(input) {
  return parseString(input).success;
}
function isDatetimeStringLenient(input) {
  if (typeof input !== "string")
    return false;
  try {
    if (isValidISODateString(input))
      return true;
  } catch {
  }
  return isDatetimeString(input);
}
const failure = (m) => ({ success: false, message: m });
const success = (v) => ({ success: true, value: v });
const DATETIME_REGEX = /^(?<full_year>[0-9]{4})-(?<date_month>0[1-9]|1[012])-(?<date_mday>[0-2][0-9]|3[01])T(?<time_hour>[0-1][0-9]|2[0-3]):(?<time_minute>[0-5][0-9]):(?<time_second>[0-5][0-9]|60)(?<time_secfrac>\.[0-9]+)?(?<time_offset>Z|(?<time_numoffset>[+-](?:[0-1][0-9]|2[0-3]):[0-5][0-9]))$/;
function parseString(input) {
  if (typeof input !== "string") {
    return failure("datetime must be a string");
  }
  if (input.length > 64) {
    return failure("datetime is too long (64 chars max)");
  }
  if (input.endsWith("-00:00")) {
    return failure('datetime can not use "-00:00" for UTC timezone');
  }
  if (!DATETIME_REGEX.test(input)) {
    return failure("datetime is not in a valid format (must match RFC 3339 & ISO 8601 with 'Z' or ±hh:mm timezone)");
  }
  const date = new Date(input);
  return parseDate(date);
}
function parseDate(date) {
  const fullYear = date.getUTCFullYear();
  if (Number.isNaN(fullYear)) {
    return failure("datetime did not parse as ISO 8601");
  }
  if (fullYear < 0) {
    return failure("datetime normalized to a negative time");
  }
  if (fullYear > 9999) {
    return failure("datetime year is too far in the future");
  }
  return success(date);
}
const BCP47_REGEXP = /^((?<grandfathered>(en-GB-oed|i-ami|i-bnn|i-default|i-enochian|i-hak|i-klingon|i-lux|i-mingo|i-navajo|i-pwn|i-tao|i-tay|i-tsu|sgn-BE-FR|sgn-BE-NL|sgn-CH-DE)|(art-lojban|cel-gaulish|no-bok|no-nyn|zh-guoyu|zh-hakka|zh-min|zh-min-nan|zh-xiang))|((?<language>([A-Za-z]{2,3}(-(?<extlang>[A-Za-z]{3}(-[A-Za-z]{3}){0,2}))?)|[A-Za-z]{4}|[A-Za-z]{5,8})(-(?<script>[A-Za-z]{4}))?(-(?<region>[A-Za-z]{2}|[0-9]{3}))?(-(?<variant>[A-Za-z0-9]{5,8}|[0-9][A-Za-z0-9]{3}))*(-(?<extension>[0-9A-WY-Za-wy-z](-[A-Za-z0-9]{2,8})+))*(-(?<privateUseA>[xX](-[A-Za-z0-9]{1,8})+))?)|(?<privateUseB>[xX](-[A-Za-z0-9]{1,8})+))$/;
function hasStrictPrimarySubtag(groups) {
  const language = groups.language;
  if (!language)
    return true;
  const primary = language.split("-")[0];
  return /^[a-z]{2,3}$/.test(primary);
}
function matchValidLanguage(input) {
  const parsed = input.match(BCP47_REGEXP);
  if (!parsed?.groups)
    return null;
  if (hasDuplicateVariantOrSingleton(input, parsed.groups))
    return null;
  return parsed;
}
function hasDuplicateVariantOrSingleton(input, groups) {
  if (groups.grandfathered || groups.privateUseB)
    return false;
  const subtags = input.split("-");
  let i = 1;
  if (subtags[0].length === 2 || subtags[0].length === 3) {
    let count = 0;
    while (count < 3 && i < subtags.length && /^[A-Za-z]{3}$/.test(subtags[i])) {
      i++;
      count++;
    }
  }
  if (i < subtags.length && /^[A-Za-z]{4}$/.test(subtags[i]))
    i++;
  if (i < subtags.length && /^([A-Za-z]{2}|[0-9]{3})$/.test(subtags[i]))
    i++;
  const seenVariants = /* @__PURE__ */ new Set();
  while (i < subtags.length && /^([A-Za-z0-9]{5,8}|[0-9][A-Za-z0-9]{3})$/.test(subtags[i])) {
    const key = subtags[i].toLowerCase();
    if (seenVariants.has(key))
      return true;
    seenVariants.add(key);
    i++;
  }
  const seenSingletons = /* @__PURE__ */ new Set();
  while (i < subtags.length && /^[0-9A-WYZa-wyz]$/.test(subtags[i])) {
    const singleton = subtags[i].toLowerCase();
    if (seenSingletons.has(singleton))
      return true;
    seenSingletons.add(singleton);
    i++;
    while (i < subtags.length && /^[A-Za-z0-9]{2,8}$/.test(subtags[i]))
      i++;
  }
  return false;
}
function parseLanguageString(input) {
  const parsed = matchValidLanguage(input);
  if (!parsed?.groups)
    return null;
  const { groups } = parsed;
  if (!hasStrictPrimarySubtag(groups))
    return null;
  return {
    grandfathered: groups.grandfathered,
    language: groups.language,
    extlang: groups.extlang,
    script: groups.script,
    region: groups.region,
    variant: groups.variant,
    extension: groups.extension,
    privateUse: groups.privateUseA || groups.privateUseB
  };
}
function isValidLanguage(input) {
  return BCP47_REGEXP.test(input);
}
const TID_LENGTH = 13;
const TID_REGEX = /^[234567abcdefghij][234567abcdefghijklmnopqrstuvwxyz]{12}$/;
function isValidTid(input) {
  return typeof input === "string" && input.length === TID_LENGTH && TID_REGEX.test(input);
}
function isValidUri(input) {
  return typeof input === "string" && /^\w+:(?:\/\/)?[^\s/][^\s]*$/.test(input);
}
// @__NO_SIDE_EFFECTS__
function lazyProperty(obj, key, value) {
  Object.defineProperty(obj, key, {
    value,
    writable: false,
    enumerable: false,
    configurable: true
  });
  return value;
}
function equals$1(aa, bb) {
  if (aa === bb) {
    return true;
  }
  if (aa.byteLength !== bb.byteLength) {
    return false;
  }
  for (let ii = 0; ii < aa.byteLength; ii++) {
    if (aa[ii] !== bb[ii]) {
      return false;
    }
  }
  return true;
}
function coerce(o) {
  if (o instanceof Uint8Array && o.constructor.name === "Uint8Array") {
    return o;
  }
  if (o instanceof ArrayBuffer) {
    return new Uint8Array(o);
  }
  if (ArrayBuffer.isView(o)) {
    return new Uint8Array(o.buffer, o.byteOffset, o.byteLength);
  }
  throw new Error("Unknown type, must be binary type");
}
function base$1(ALPHABET, name) {
  if (ALPHABET.length >= 255) {
    throw new TypeError("Alphabet too long");
  }
  var BASE_MAP = new Uint8Array(256);
  for (var j = 0; j < BASE_MAP.length; j++) {
    BASE_MAP[j] = 255;
  }
  for (var i = 0; i < ALPHABET.length; i++) {
    var x = ALPHABET.charAt(i);
    var xc = x.charCodeAt(0);
    if (BASE_MAP[xc] !== 255) {
      throw new TypeError(x + " is ambiguous");
    }
    BASE_MAP[xc] = i;
  }
  var BASE = ALPHABET.length;
  var LEADER = ALPHABET.charAt(0);
  var FACTOR = Math.log(BASE) / Math.log(256);
  var iFACTOR = Math.log(256) / Math.log(BASE);
  function encode2(source) {
    if (source instanceof Uint8Array)
      ;
    else if (ArrayBuffer.isView(source)) {
      source = new Uint8Array(source.buffer, source.byteOffset, source.byteLength);
    } else if (Array.isArray(source)) {
      source = Uint8Array.from(source);
    }
    if (!(source instanceof Uint8Array)) {
      throw new TypeError("Expected Uint8Array");
    }
    if (source.length === 0) {
      return "";
    }
    var zeroes = 0;
    var length2 = 0;
    var pbegin = 0;
    var pend = source.length;
    while (pbegin !== pend && source[pbegin] === 0) {
      pbegin++;
      zeroes++;
    }
    var size = (pend - pbegin) * iFACTOR + 1 >>> 0;
    var b58 = new Uint8Array(size);
    while (pbegin !== pend) {
      var carry = source[pbegin];
      var i2 = 0;
      for (var it1 = size - 1; (carry !== 0 || i2 < length2) && it1 !== -1; it1--, i2++) {
        carry += 256 * b58[it1] >>> 0;
        b58[it1] = carry % BASE >>> 0;
        carry = carry / BASE >>> 0;
      }
      if (carry !== 0) {
        throw new Error("Non-zero carry");
      }
      length2 = i2;
      pbegin++;
    }
    var it2 = size - length2;
    while (it2 !== size && b58[it2] === 0) {
      it2++;
    }
    var str = LEADER.repeat(zeroes);
    for (; it2 < size; ++it2) {
      str += ALPHABET.charAt(b58[it2]);
    }
    return str;
  }
  function decodeUnsafe(source) {
    if (typeof source !== "string") {
      throw new TypeError("Expected String");
    }
    if (source.length === 0) {
      return new Uint8Array();
    }
    var psz = 0;
    if (source[psz] === " ") {
      return;
    }
    var zeroes = 0;
    var length2 = 0;
    while (source[psz] === LEADER) {
      zeroes++;
      psz++;
    }
    var size = (source.length - psz) * FACTOR + 1 >>> 0;
    var b256 = new Uint8Array(size);
    while (source[psz]) {
      var carry = BASE_MAP[source.charCodeAt(psz)];
      if (carry === 255) {
        return;
      }
      var i2 = 0;
      for (var it3 = size - 1; (carry !== 0 || i2 < length2) && it3 !== -1; it3--, i2++) {
        carry += BASE * b256[it3] >>> 0;
        b256[it3] = carry % 256 >>> 0;
        carry = carry / 256 >>> 0;
      }
      if (carry !== 0) {
        throw new Error("Non-zero carry");
      }
      length2 = i2;
      psz++;
    }
    if (source[psz] === " ") {
      return;
    }
    var it4 = size - length2;
    while (it4 !== size && b256[it4] === 0) {
      it4++;
    }
    var vch = new Uint8Array(zeroes + (size - it4));
    var j2 = zeroes;
    while (it4 !== size) {
      vch[j2++] = b256[it4++];
    }
    return vch;
  }
  function decode2(string2) {
    var buffer = decodeUnsafe(string2);
    if (buffer) {
      return buffer;
    }
    throw new Error(`Non-${name} character`);
  }
  return {
    encode: encode2,
    decodeUnsafe,
    decode: decode2
  };
}
var src = base$1;
var _brrp__multiformats_scope_baseX = src;
class Encoder {
  name;
  prefix;
  baseEncode;
  constructor(name, prefix, baseEncode) {
    this.name = name;
    this.prefix = prefix;
    this.baseEncode = baseEncode;
  }
  encode(bytes) {
    if (bytes instanceof Uint8Array) {
      return `${this.prefix}${this.baseEncode(bytes)}`;
    } else {
      throw Error("Unknown type, must be binary type");
    }
  }
}
class Decoder {
  name;
  prefix;
  baseDecode;
  prefixCodePoint;
  constructor(name, prefix, baseDecode) {
    this.name = name;
    this.prefix = prefix;
    const prefixCodePoint = prefix.codePointAt(0);
    if (prefixCodePoint === void 0) {
      throw new Error("Invalid prefix character");
    }
    this.prefixCodePoint = prefixCodePoint;
    this.baseDecode = baseDecode;
  }
  decode(text2) {
    if (typeof text2 === "string") {
      if (text2.codePointAt(0) !== this.prefixCodePoint) {
        throw Error(`Unable to decode multibase string ${JSON.stringify(text2)}, ${this.name} decoder only supports inputs prefixed with ${this.prefix}`);
      }
      return this.baseDecode(text2.slice(this.prefix.length));
    } else {
      throw Error("Can only multibase decode strings");
    }
  }
  or(decoder) {
    return or(this, decoder);
  }
}
class ComposedDecoder {
  decoders;
  constructor(decoders) {
    this.decoders = decoders;
  }
  or(decoder) {
    return or(this, decoder);
  }
  decode(input) {
    const prefix = input[0];
    const decoder = this.decoders[prefix];
    if (decoder != null) {
      return decoder.decode(input);
    } else {
      throw RangeError(`Unable to decode multibase string ${JSON.stringify(input)}, only inputs prefixed with ${Object.keys(this.decoders)} are supported`);
    }
  }
}
function or(left, right) {
  return new ComposedDecoder({
    ...left.decoders ?? { [left.prefix]: left },
    ...right.decoders ?? { [right.prefix]: right }
  });
}
class Codec {
  name;
  prefix;
  baseEncode;
  baseDecode;
  encoder;
  decoder;
  constructor(name, prefix, baseEncode, baseDecode) {
    this.name = name;
    this.prefix = prefix;
    this.baseEncode = baseEncode;
    this.baseDecode = baseDecode;
    this.encoder = new Encoder(name, prefix, baseEncode);
    this.decoder = new Decoder(name, prefix, baseDecode);
  }
  encode(input) {
    return this.encoder.encode(input);
  }
  decode(input) {
    return this.decoder.decode(input);
  }
}
function from$1({ name, prefix, encode: encode2, decode: decode2 }) {
  return new Codec(name, prefix, encode2, decode2);
}
function baseX({ name, prefix, alphabet }) {
  const { encode: encode2, decode: decode2 } = _brrp__multiformats_scope_baseX(alphabet, name);
  return from$1({
    prefix,
    name,
    encode: encode2,
    decode: (text2) => coerce(decode2(text2))
  });
}
function decode$5(string2, alphabetIdx, bitsPerChar, name) {
  let end = string2.length;
  while (string2[end - 1] === "=") {
    --end;
  }
  const out = new Uint8Array(end * bitsPerChar / 8 | 0);
  let bits = 0;
  let buffer = 0;
  let written = 0;
  for (let i = 0; i < end; ++i) {
    const value = alphabetIdx[string2[i]];
    if (value === void 0) {
      throw new SyntaxError(`Non-${name} character`);
    }
    buffer = buffer << bitsPerChar | value;
    bits += bitsPerChar;
    if (bits >= 8) {
      bits -= 8;
      out[written++] = 255 & buffer >> bits;
    }
  }
  if (bits >= bitsPerChar || (255 & buffer << 8 - bits) !== 0) {
    throw new SyntaxError("Unexpected end of data");
  }
  return out;
}
function encode$3(data, alphabet, bitsPerChar) {
  const pad = alphabet[alphabet.length - 1] === "=";
  const mask = (1 << bitsPerChar) - 1;
  let out = "";
  let bits = 0;
  let buffer = 0;
  for (let i = 0; i < data.length; ++i) {
    buffer = buffer << 8 | data[i];
    bits += 8;
    while (bits > bitsPerChar) {
      bits -= bitsPerChar;
      out += alphabet[mask & buffer >> bits];
    }
  }
  if (bits !== 0) {
    out += alphabet[mask & buffer << bitsPerChar - bits];
  }
  if (pad) {
    while ((out.length * bitsPerChar & 7) !== 0) {
      out += "=";
    }
  }
  return out;
}
function createAlphabetIdx(alphabet) {
  const alphabetIdx = {};
  for (let i = 0; i < alphabet.length; ++i) {
    alphabetIdx[alphabet[i]] = i;
  }
  return alphabetIdx;
}
function rfc4648({ name, prefix, bitsPerChar, alphabet }) {
  const alphabetIdx = createAlphabetIdx(alphabet);
  return from$1({
    prefix,
    name,
    encode(input) {
      return encode$3(input, alphabet, bitsPerChar);
    },
    decode(input) {
      return decode$5(input, alphabetIdx, bitsPerChar, name);
    }
  });
}
const base32 = rfc4648({
  prefix: "b",
  name: "base32",
  alphabet: "abcdefghijklmnopqrstuvwxyz234567",
  bitsPerChar: 5
});
rfc4648({
  prefix: "B",
  name: "base32upper",
  alphabet: "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567",
  bitsPerChar: 5
});
rfc4648({
  prefix: "c",
  name: "base32pad",
  alphabet: "abcdefghijklmnopqrstuvwxyz234567=",
  bitsPerChar: 5
});
rfc4648({
  prefix: "C",
  name: "base32padupper",
  alphabet: "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567=",
  bitsPerChar: 5
});
rfc4648({
  prefix: "v",
  name: "base32hex",
  alphabet: "0123456789abcdefghijklmnopqrstuv",
  bitsPerChar: 5
});
rfc4648({
  prefix: "V",
  name: "base32hexupper",
  alphabet: "0123456789ABCDEFGHIJKLMNOPQRSTUV",
  bitsPerChar: 5
});
rfc4648({
  prefix: "t",
  name: "base32hexpad",
  alphabet: "0123456789abcdefghijklmnopqrstuv=",
  bitsPerChar: 5
});
rfc4648({
  prefix: "T",
  name: "base32hexpadupper",
  alphabet: "0123456789ABCDEFGHIJKLMNOPQRSTUV=",
  bitsPerChar: 5
});
rfc4648({
  prefix: "h",
  name: "base32z",
  alphabet: "ybndrfg8ejkmcpqxot1uwisza345h769",
  bitsPerChar: 5
});
const base36 = baseX({
  prefix: "k",
  name: "base36",
  alphabet: "0123456789abcdefghijklmnopqrstuvwxyz"
});
baseX({
  prefix: "K",
  name: "base36upper",
  alphabet: "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ"
});
const base58btc = baseX({
  name: "base58btc",
  prefix: "z",
  alphabet: "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz"
});
baseX({
  name: "base58flickr",
  prefix: "Z",
  alphabet: "123456789abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ"
});
var encode_1 = encode$2;
var MSB = 128, MSBALL = -128, INT = Math.pow(2, 31);
function encode$2(num, out, offset) {
  out = out || [];
  offset = offset || 0;
  var oldOffset = offset;
  while (num >= INT) {
    out[offset++] = num & 255 | MSB;
    num /= 128;
  }
  while (num & MSBALL) {
    out[offset++] = num & 255 | MSB;
    num >>>= 7;
  }
  out[offset] = num | 0;
  encode$2.bytes = offset - oldOffset + 1;
  return out;
}
var decode$4 = read;
var MSB$1 = 128, REST$1 = 127;
function read(buf, offset) {
  var res = 0, offset = offset || 0, shift = 0, counter = offset, b, l = buf.length;
  do {
    if (counter >= l) {
      read.bytes = 0;
      throw new RangeError("Could not decode varint");
    }
    b = buf[counter++];
    res += shift < 28 ? (b & REST$1) << shift : (b & REST$1) * Math.pow(2, shift);
    shift += 7;
  } while (b >= MSB$1);
  read.bytes = counter - offset;
  return res;
}
var N1 = Math.pow(2, 7);
var N2 = Math.pow(2, 14);
var N3 = Math.pow(2, 21);
var N4 = Math.pow(2, 28);
var N5 = Math.pow(2, 35);
var N6 = Math.pow(2, 42);
var N7 = Math.pow(2, 49);
var N8 = Math.pow(2, 56);
var N9 = Math.pow(2, 63);
var length = function(value) {
  return value < N1 ? 1 : value < N2 ? 2 : value < N3 ? 3 : value < N4 ? 4 : value < N5 ? 5 : value < N6 ? 6 : value < N7 ? 7 : value < N8 ? 8 : value < N9 ? 9 : 10;
};
var varint = {
  encode: encode_1,
  decode: decode$4,
  encodingLength: length
};
var _brrp_varint = varint;
function decode$3(data, offset = 0) {
  const code2 = _brrp_varint.decode(data, offset);
  return [code2, _brrp_varint.decode.bytes];
}
function encodeTo(int, target, offset = 0) {
  _brrp_varint.encode(int, target, offset);
  return target;
}
function encodingLength(int) {
  return _brrp_varint.encodingLength(int);
}
function create$1(code2, digest) {
  const size = digest.byteLength;
  const sizeOffset = encodingLength(code2);
  const digestOffset = sizeOffset + encodingLength(size);
  const bytes = new Uint8Array(digestOffset + size);
  encodeTo(code2, bytes, 0);
  encodeTo(size, bytes, sizeOffset);
  bytes.set(digest, digestOffset);
  return new Digest(code2, size, digest, bytes);
}
function decode$2(multihash) {
  const bytes = coerce(multihash);
  const [code2, sizeOffset] = decode$3(bytes);
  const [size, digestOffset] = decode$3(bytes.subarray(sizeOffset));
  const digest = bytes.subarray(sizeOffset + digestOffset);
  if (digest.byteLength !== size) {
    throw new Error("Incorrect length");
  }
  return new Digest(code2, size, digest, bytes);
}
function equals(a, b) {
  if (a === b) {
    return true;
  } else {
    const data = b;
    return a.code === data.code && a.size === data.size && data.bytes instanceof Uint8Array && equals$1(a.bytes, data.bytes);
  }
}
class Digest {
  code;
  size;
  digest;
  bytes;
  /**
   * Creates a multihash digest.
   */
  constructor(code2, size, digest, bytes) {
    this.code = code2;
    this.size = size;
    this.digest = digest;
    this.bytes = bytes;
  }
}
function format$1(link2, base2) {
  const { bytes, version } = link2;
  switch (version) {
    case 0:
      return toStringV0(bytes, baseCache(link2), base2 ?? base58btc.encoder);
    default:
      return toStringV1(bytes, baseCache(link2), base2 ?? base32.encoder);
  }
}
const cache = /* @__PURE__ */ new WeakMap();
function baseCache(cid) {
  const baseCache2 = cache.get(cid);
  if (baseCache2 == null) {
    const baseCache3 = /* @__PURE__ */ new Map();
    cache.set(cid, baseCache3);
    return baseCache3;
  }
  return baseCache2;
}
class CID {
  code;
  version;
  multihash;
  bytes;
  "/";
  /**
   * @param version - Version of the CID
   * @param code - Code of the codec content is encoded in, see https://github.com/multiformats/multicodec/blob/master/table.csv
   * @param multihash - (Multi)hash of the of the content.
   */
  constructor(version, code2, multihash, bytes) {
    this.code = code2;
    this.version = version;
    this.multihash = multihash;
    this.bytes = bytes;
    this["/"] = bytes;
  }
  /**
   * Signalling `cid.asCID === cid` has been replaced with `cid['/'] === cid.bytes`
   * please either use `CID.asCID(cid)` or switch to new signalling mechanism
   *
   * @deprecated
   */
  get asCID() {
    return this;
  }
  // ArrayBufferView
  get byteOffset() {
    return this.bytes.byteOffset;
  }
  // ArrayBufferView
  get byteLength() {
    return this.bytes.byteLength;
  }
  toV0() {
    switch (this.version) {
      case 0: {
        return this;
      }
      case 1: {
        const { code: code2, multihash } = this;
        if (code2 !== DAG_PB_CODE) {
          throw new Error("Cannot convert a non dag-pb CID to CIDv0");
        }
        if (multihash.code !== SHA_256_CODE) {
          throw new Error("Cannot convert non sha2-256 multihash CID to CIDv0");
        }
        return CID.createV0(multihash);
      }
      default: {
        throw Error(`Can not convert CID version ${this.version} to version 0. This is a bug please report`);
      }
    }
  }
  toV1() {
    switch (this.version) {
      case 0: {
        const { code: code2, digest } = this.multihash;
        const multihash = create$1(code2, digest);
        return CID.createV1(this.code, multihash);
      }
      case 1: {
        return this;
      }
      default: {
        throw Error(`Can not convert CID version ${this.version} to version 1. This is a bug please report`);
      }
    }
  }
  equals(other) {
    return CID.equals(this, other);
  }
  static equals(self, other) {
    const unknown = other;
    return unknown != null && self.code === unknown.code && self.version === unknown.version && equals(self.multihash, unknown.multihash);
  }
  toString(base2) {
    return format$1(this, base2);
  }
  toJSON() {
    return { "/": format$1(this) };
  }
  link() {
    return this;
  }
  [Symbol.toStringTag] = "CID";
  // Legacy
  [/* @__PURE__ */ Symbol.for("nodejs.util.inspect.custom")]() {
    return `CID(${this.toString()})`;
  }
  /**
   * Takes any input `value` and returns a `CID` instance if it was
   * a `CID` otherwise returns `null`. If `value` is instanceof `CID`
   * it will return value back. If `value` is not instance of this CID
   * class, but is compatible CID it will return new instance of this
   * `CID` class. Otherwise returns null.
   *
   * This allows two different incompatible versions of CID library to
   * co-exist and interop as long as binary interface is compatible.
   */
  static asCID(input) {
    if (input == null) {
      return null;
    }
    const value = input;
    if (value instanceof CID) {
      return value;
    } else if (value["/"] != null && value["/"] === value.bytes || value.asCID === value) {
      const { version, code: code2, multihash, bytes } = value;
      return new CID(version, code2, multihash, bytes ?? encodeCID(version, code2, multihash.bytes));
    } else if (value[cidSymbol] === true) {
      const { version, multihash, code: code2 } = value;
      const digest = decode$2(multihash);
      return CID.create(version, code2, digest);
    } else {
      return null;
    }
  }
  /**
   * @param version - Version of the CID
   * @param code - Code of the codec content is encoded in, see https://github.com/multiformats/multicodec/blob/master/table.csv
   * @param digest - (Multi)hash of the of the content.
   */
  static create(version, code2, digest) {
    if (typeof code2 !== "number") {
      throw new Error("String codecs are no longer supported");
    }
    if (!(digest.bytes instanceof Uint8Array)) {
      throw new Error("Invalid digest");
    }
    switch (version) {
      case 0: {
        if (code2 !== DAG_PB_CODE) {
          throw new Error(`Version 0 CID must use dag-pb (code: ${DAG_PB_CODE}) block encoding`);
        } else {
          return new CID(version, code2, digest, digest.bytes);
        }
      }
      case 1: {
        const bytes = encodeCID(version, code2, digest.bytes);
        return new CID(version, code2, digest, bytes);
      }
      default: {
        throw new Error("Invalid version");
      }
    }
  }
  /**
   * Simplified version of `create` for CIDv0.
   */
  static createV0(digest) {
    return CID.create(0, DAG_PB_CODE, digest);
  }
  /**
   * Simplified version of `create` for CIDv1.
   *
   * @param code - Content encoding format code.
   * @param digest - Multihash of the content.
   */
  static createV1(code2, digest) {
    return CID.create(1, code2, digest);
  }
  /**
   * Decoded a CID from its binary representation. The byte array must contain
   * only the CID with no additional bytes.
   *
   * An error will be thrown if the bytes provided do not contain a valid
   * binary representation of a CID.
   */
  static decode(bytes) {
    const [cid, remainder] = CID.decodeFirst(bytes);
    if (remainder.length !== 0) {
      throw new Error("Incorrect length");
    }
    return cid;
  }
  /**
   * Decoded a CID from its binary representation at the beginning of a byte
   * array.
   *
   * Returns an array with the first element containing the CID and the second
   * element containing the remainder of the original byte array. The remainder
   * will be a zero-length byte array if the provided bytes only contained a
   * binary CID representation.
   */
  static decodeFirst(bytes) {
    const specs = CID.inspectBytes(bytes);
    const prefixSize = specs.size - specs.multihashSize;
    const multihashBytes = coerce(bytes.subarray(prefixSize, prefixSize + specs.multihashSize));
    if (multihashBytes.byteLength !== specs.multihashSize) {
      throw new Error("Incorrect length");
    }
    const digestBytes = multihashBytes.subarray(specs.multihashSize - specs.digestSize);
    const digest = new Digest(specs.multihashCode, specs.digestSize, digestBytes, multihashBytes);
    const cid = specs.version === 0 ? CID.createV0(digest) : CID.createV1(specs.codec, digest);
    return [cid, bytes.subarray(specs.size)];
  }
  /**
   * Inspect the initial bytes of a CID to determine its properties.
   *
   * Involves decoding up to 4 varints. Typically this will require only 4 to 6
   * bytes but for larger multicodec code values and larger multihash digest
   * lengths these varints can be quite large. It is recommended that at least
   * 10 bytes be made available in the `initialBytes` argument for a complete
   * inspection.
   */
  static inspectBytes(initialBytes) {
    let offset = 0;
    const next = () => {
      const [i, length2] = decode$3(initialBytes.subarray(offset));
      offset += length2;
      return i;
    };
    let version = next();
    let codec = DAG_PB_CODE;
    if (version === 18) {
      version = 0;
      offset = 0;
    } else {
      codec = next();
    }
    if (version !== 0 && version !== 1) {
      throw new RangeError(`Invalid CID version ${version}`);
    }
    const prefixSize = offset;
    const multihashCode = next();
    const digestSize = next();
    const size = offset + digestSize;
    const multihashSize = size - prefixSize;
    return { version, codec, multihashCode, digestSize, multihashSize, size };
  }
  /**
   * Takes cid in a string representation and creates an instance. If `base`
   * decoder is not provided will use a default from the configuration. It will
   * throw an error if encoding of the CID is not compatible with supplied (or
   * a default decoder).
   */
  static parse(source, base2) {
    const [prefix, bytes] = parseCIDtoBytes(source, base2);
    const cid = CID.decode(bytes);
    if (cid.version === 0 && source[0] !== "Q") {
      throw Error("Version 0 CID string must not include multibase prefix");
    }
    baseCache(cid).set(prefix, source);
    return cid;
  }
}
function parseCIDtoBytes(source, base2) {
  switch (source[0]) {
    // CIDv0 is parsed differently
    case "Q": {
      const decoder = base2 ?? base58btc;
      return [
        base58btc.prefix,
        decoder.decode(`${base58btc.prefix}${source}`)
      ];
    }
    case base58btc.prefix: {
      const decoder = base2 ?? base58btc;
      return [base58btc.prefix, decoder.decode(source)];
    }
    case base32.prefix: {
      const decoder = base2 ?? base32;
      return [base32.prefix, decoder.decode(source)];
    }
    case base36.prefix: {
      const decoder = base2 ?? base36;
      return [base36.prefix, decoder.decode(source)];
    }
    default: {
      if (base2 == null) {
        throw Error("To parse non base32, base36 or base58btc encoded CID multibase decoder must be provided");
      }
      return [source[0], base2.decode(source)];
    }
  }
}
function toStringV0(bytes, cache2, base2) {
  const { prefix } = base2;
  if (prefix !== base58btc.prefix) {
    throw Error(`Cannot string encode V0 in ${base2.name} encoding`);
  }
  const cid = cache2.get(prefix);
  if (cid == null) {
    const cid2 = base2.encode(bytes).slice(1);
    cache2.set(prefix, cid2);
    return cid2;
  } else {
    return cid;
  }
}
function toStringV1(bytes, cache2, base2) {
  const { prefix } = base2;
  const cid = cache2.get(prefix);
  if (cid == null) {
    const cid2 = base2.encode(bytes);
    cache2.set(prefix, cid2);
    return cid2;
  } else {
    return cid;
  }
}
const DAG_PB_CODE = 112;
const SHA_256_CODE = 18;
function encodeCID(version, code2, multihash) {
  const codeOffset = encodingLength(version);
  const hashOffset = codeOffset + encodingLength(code2);
  const bytes = new Uint8Array(hashOffset + multihash.byteLength);
  encodeTo(version, bytes, 0);
  encodeTo(code2, bytes, codeOffset);
  bytes.set(multihash, hashOffset);
  return bytes;
}
const cidSymbol = /* @__PURE__ */ Symbol.for("@ipld/js-cid/CID");
const DEFAULT_MIN_DIGEST_LENGTH = 20;
function from({ name, code: code2, encode: encode2, minDigestLength, maxDigestLength }) {
  return new Hasher(name, code2, encode2, minDigestLength, maxDigestLength);
}
class Hasher {
  name;
  code;
  encode;
  minDigestLength;
  maxDigestLength;
  constructor(name, code2, encode2, minDigestLength, maxDigestLength) {
    this.name = name;
    this.code = code2;
    this.encode = encode2;
    this.minDigestLength = minDigestLength ?? DEFAULT_MIN_DIGEST_LENGTH;
    this.maxDigestLength = maxDigestLength;
  }
  digest(input, options) {
    if (options?.truncate != null) {
      if (options.truncate < this.minDigestLength) {
        throw new Error(`Invalid truncate option, must be greater than or equal to ${this.minDigestLength}`);
      }
      if (this.maxDigestLength != null && options.truncate > this.maxDigestLength) {
        throw new Error(`Invalid truncate option, must be less than or equal to ${this.maxDigestLength}`);
      }
    }
    if (input instanceof Uint8Array) {
      const result = this.encode(input);
      if (result instanceof Uint8Array) {
        return createDigest(result, this.code, options?.truncate);
      }
      return result.then((digest) => createDigest(digest, this.code, options?.truncate));
    } else {
      throw Error("Unknown type, must be binary type");
    }
  }
}
function createDigest(digest, code2, truncate) {
  if (truncate != null && truncate !== digest.byteLength) {
    if (truncate > digest.byteLength) {
      throw new Error(`Invalid truncate option, must be less than or equal to ${digest.byteLength}`);
    }
    digest = digest.subarray(0, truncate);
  }
  return create$1(code2, digest);
}
const sha256 = from({
  name: "sha2-256",
  code: 18,
  encode: (input) => coerce(crypto.createHash("sha256").update(input).digest())
});
const sha512 = from({
  name: "sha2-512",
  code: 19,
  encode: (input) => coerce(crypto.createHash("sha512").update(input).digest())
});
function isUint8(val) {
  return Number.isInteger(val) && val >= 0 && val < 256;
}
function isObject$1(input) {
  return input != null && typeof input === "object";
}
const ObjectProto = Object.prototype;
const ObjectToString = Object.prototype.toString;
function isPlainObject$1(input) {
  return isObject$1(input) && isPlainProto(input);
}
function isPlainProto(input) {
  const proto = Object.getPrototypeOf(input);
  if (proto === null)
    return true;
  return (proto === ObjectProto || // Needed to support NodeJS's `runInNewContext` which produces objects
  // with a different prototype
  Object.getPrototypeOf(proto) === null) && ObjectToString.call(input) === "[object Object]";
}
const BUFFER = /* @__PURE__ */ (() => "Bu" + "f".repeat(2) + "er")();
const NodeJSBuffer = globalThis?.[BUFFER]?.prototype instanceof Uint8Array && "byteLength" in globalThis[BUFFER] ? globalThis[BUFFER] : (
  /* v8 ignore next -- @preserve */
  null
);
const base64 = rfc4648({
  prefix: "m",
  name: "base64",
  alphabet: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/",
  bitsPerChar: 6
});
const base64pad = rfc4648({
  prefix: "M",
  name: "base64pad",
  alphabet: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=",
  bitsPerChar: 6
});
const base64url = rfc4648({
  prefix: "u",
  name: "base64url",
  alphabet: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_",
  bitsPerChar: 6
});
const base64urlpad = rfc4648({
  prefix: "U",
  name: "base64urlpad",
  alphabet: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_=",
  bitsPerChar: 6
});
const Buffer$2 = NodeJSBuffer;
const fromBase64Native = typeof Uint8Array.fromBase64 === "function" ? function fromBase64Native2(b64, alphabet = "base64") {
  return Uint8Array.fromBase64(b64, {
    alphabet,
    lastChunkHandling: "loose"
  });
} : (
  /* v8 ignore next -- @preserve */
  null
);
const fromBase64Node = Buffer$2 ? function fromBase64Node2(b64, alphabet = "base64") {
  const bytes = Buffer$2.from(b64, alphabet);
  verifyBase64ForBytes(b64, bytes);
  return new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength);
} : (
  /* v8 ignore next -- @preserve */
  null
);
function fromBase64Ponyfill(b64, alphabet = "base64") {
  const isPadded = b64.endsWith("=");
  const base2 = alphabet === "base64url" ? isPadded ? base64urlpad : base64url : isPadded ? base64pad : base64;
  const bytes = base2.decoder.decode(`${base2.prefix}${b64}`);
  verifyBase64ForBytes(b64, bytes);
  return bytes;
}
function verifyBase64ForBytes(b64, bytes) {
  const paddingCount = b64.endsWith("==") ? 2 : b64.endsWith("=") ? 1 : 0;
  const trimmedLength = b64.length - paddingCount;
  const expectedByteLength = Math.floor(trimmedLength * 3 / 4);
  if (bytes.length !== expectedByteLength) {
    throw new Error("Invalid base64 string");
  }
  const expectedB64Length = bytes.length / 3 * 4;
  const expectedPaddingCount = expectedB64Length % 4 === 0 ? 0 : 4 - expectedB64Length % 4;
  const expectedFullB64Length = expectedB64Length + expectedPaddingCount;
  if (b64.length > expectedFullB64Length) {
    throw new Error("Invalid base64 string");
  }
  for (let i = Math.ceil(expectedB64Length); i < b64.length - paddingCount; i++) {
    const code2 = b64.charCodeAt(i);
    if (!(code2 >= 65 && code2 <= 90) && // A-Z
    !(code2 >= 97 && code2 <= 122) && // a-z
    !(code2 >= 48 && code2 <= 57) && // 0-9
    code2 !== 43 && // +
    code2 !== 47) {
      throw new Error("Invalid base64 string");
    }
  }
}
const Buffer$1 = NodeJSBuffer;
const toBase64Native = typeof Uint8Array.prototype.toBase64 === "function" ? function toBase64Native2(bytes, alphabet = "base64") {
  return bytes.toBase64({ alphabet, omitPadding: true });
} : (
  /* v8 ignore next -- @preserve */
  null
);
const toBase64Node = Buffer$1 ? function toBase64Node2(bytes, alphabet = "base64") {
  const buffer = bytes instanceof Buffer$1 ? bytes : Buffer$1.from(bytes);
  const b64 = buffer.toString(alphabet);
  return b64.charCodeAt(b64.length - 1) === /* '=' */
  61 ? b64.charCodeAt(b64.length - 2) === /* '=' */
  61 ? b64.slice(0, -2) : b64.slice(0, -1) : b64;
} : (
  /* v8 ignore next -- @preserve */
  null
);
function toBase64Ponyfill(bytes, alphabet = "base64") {
  const codec = alphabet === "base64url" ? base64url : base64;
  return codec.encoder.encode(bytes).slice(codec.prefix.length);
}
const toBase64 = (
  /* v8 ignore next -- @preserve */
  toBase64Native ?? toBase64Node ?? toBase64Ponyfill
);
const fromBase64 = (
  /* v8 ignore next -- @preserve */
  fromBase64Native ?? fromBase64Node ?? fromBase64Ponyfill
);
function ui8Equals(a, b) {
  if (a.byteLength !== b.byteLength) {
    return false;
  }
  for (let i = 0; i < a.byteLength; i++) {
    if (a[i] !== b[i]) {
      return false;
    }
  }
  return true;
}
const CBOR_DATA_CODEC = 113;
const RAW_DATA_CODEC = 85;
const SHA256_HASH_CODE = sha256.code;
sha512.code;
function isRawCid(cid) {
  return cid.version === 1 && cid.code === RAW_DATA_CODEC;
}
function isDaslCid(cid) {
  return cid.version === 1 && (cid.code === RAW_DATA_CODEC || cid.code === CBOR_DATA_CODEC) && cid.multihash.code === SHA256_HASH_CODE && cid.multihash.digest.byteLength === 32;
}
function isCborCid(cid) {
  return cid.code === CBOR_DATA_CODEC && isDaslCid(cid);
}
function checkCid(cid, options) {
  switch (options?.flavor) {
    case void 0:
      return true;
    case "cbor":
      return isCborCid(cid);
    case "dasl":
      return isDaslCid(cid);
    case "raw":
      return isRawCid(cid);
    default:
      throw new TypeError(`Unknown CID flavor: ${options?.flavor}`);
  }
}
function isCid(value, options) {
  return isCidImplementation(value) && checkCid(value, options);
}
function ifCid(value, options) {
  if (isCid(value, options))
    return value;
  return null;
}
function asCid(value, options) {
  if (isCid(value, options))
    return value;
  throw new Error(`Invalid ${options?.flavor ? `${options.flavor} CID` : "CID"} "${value}"`);
}
function parseCid(input, options) {
  const cid = CID.parse(input);
  return asCid(cid, options);
}
function validateCidString(input, options) {
  return parseCidSafe(input, options)?.toString() === input;
}
function parseCidSafe(input, options) {
  try {
    return parseCid(input, options);
  } catch {
    return null;
  }
}
function isCidImplementation(value) {
  if (CID.asCID(value)) {
    return value.bytes != null;
  } else {
    try {
      if (!isObject$1(value))
        return false;
      const val = value;
      if (val.version !== 0 && val.version !== 1)
        return false;
      if (!isUint8(val.code))
        return false;
      if (!isObject$1(val.multihash))
        return false;
      const mh = val.multihash;
      if (!isUint8(mh.code))
        return false;
      if (!(mh.digest instanceof Uint8Array))
        return false;
      if (!(val.bytes instanceof Uint8Array))
        return false;
      if (val.bytes[0] !== val.version)
        return false;
      if (val.bytes[1] !== val.code)
        return false;
      if (val.bytes[2] !== mh.code)
        return false;
      if (val.bytes[3] !== mh.digest.length)
        return false;
      if (val.bytes.length !== 4 + mh.digest.length)
        return false;
      if (!ui8Equals(val.bytes.subarray(4), mh.digest))
        return false;
      if (typeof val.equals !== "function")
        return false;
      if (val.equals(val) !== true)
        return false;
      return true;
    } catch {
      return false;
    }
  }
}
const STRICT_CID_CHECK_OPTIONS = { flavor: "raw" };
const isSafeInteger = Number.isSafeInteger;
function getBlobSize(blob2) {
  if ("$type" in blob2 && blob2.size >= 0)
    return blob2.size;
  return void 0;
}
function isTypedBlobRef(input, options) {
  if (!isPlainObject$1(input)) {
    return false;
  }
  if (input?.$type !== "blob") {
    return false;
  }
  const { mimeType, size, ref: ref2 } = input;
  if (typeof mimeType !== "string" || !mimeType.includes("/")) {
    return false;
  }
  if (size === -1 && options?.strict === false) ;
  else if (!isSafeInteger(size) || size < 0) {
    return false;
  }
  if (typeof ref2 !== "object" || ref2 === null) {
    return false;
  }
  for (const key in input) {
    if (key !== "$type" && key !== "mimeType" && key !== "ref" && key !== "size") {
      return false;
    }
  }
  const cid = ifCid(
    ref2,
    // Strict unless explicitly disabled
    options?.strict === false ? void 0 : STRICT_CID_CHECK_OPTIONS
  );
  if (!cid) {
    return false;
  }
  return true;
}
function isLegacyBlobRef(input, options) {
  if (!isPlainObject$1(input)) {
    return false;
  }
  const { cid, mimeType } = input;
  if (typeof cid !== "string") {
    return false;
  }
  if (typeof mimeType !== "string" || mimeType.length === 0) {
    return false;
  }
  for (const key in input) {
    if (key !== "cid" && key !== "mimeType") {
      return false;
    }
  }
  if (!validateCidString(cid, options?.strict === false ? void 0 : STRICT_CID_CHECK_OPTIONS)) {
    return false;
  }
  return true;
}
class LexError extends Error {
  /**
   * @param error - The error code identifying the type of error, typically used in XRPC error payloads
   * @param message - Optional human-readable error message
   * @param options - Standard Error options (e.g., cause)
   */
  constructor(error2, message, options) {
    super(message, options);
    this.error = error2;
    this.name = "LexError";
  }
  /**
   * Returns a string representation of this error.
   *
   * @returns A formatted string: "LexErrorClass: [MyErrorCode] My message"
   */
  toString() {
    return `${this.name}: [${this.error}] ${this.message}`;
  }
  /**
   * Converts this error to a JSON-serializable object.
   *
   * @returns The error data suitable for JSON serialization
   * @note The `error` generic is *not* constrained to {@link N} to allow subclasses to override the error code type.
   */
  toJSON() {
    const { error: error2, message } = this;
    return { error: error2, message: message || void 0 };
  }
}
function isLexScalar(value) {
  switch (typeof value) {
    case "object":
      return value === null || value instanceof Uint8Array || isCid(value);
    case "string":
    case "boolean":
      return true;
    case "number":
      if (Number.isInteger(value))
        return true;
    // fallthrough
    default:
      return false;
  }
}
function decodeUnicodeData(data, cats = "") {
  let buf = (
    /** @type {Array<CategorizedUnicodeRange<T>>} */
    []
  ), nums = data.split(",").map((s) => s ? parseInt(s, 36) : 0), n = 0;
  for (let i = 0; i < nums.length; i++)
    i % 2 ? buf.push([
      n,
      n + nums[i],
      /** @type {T} */
      cats ? parseInt(cats[i >> 1], 36) : 0
    ]) : n = nums[i];
  return buf;
}
function findUnicodeRangeIndex(cp, ranges, lo = 0, hi = ranges.length - 1) {
  while (lo <= hi) {
    let mid = lo + hi >>> 1, range = ranges[mid];
    if (cp < range[0]) hi = mid - 1;
    else if (cp > range[1]) lo = mid + 1;
    else return mid;
  }
  return -1;
}
const grapheme_ranges = decodeUnicodeData(
  /** @type {UnicodeDataEncoding} */
  ",9,a,,b,1,d,,e,h,3j,w,4p,,4t,,4u,,lc,33,w3,6,13l,18,14v,,14x,1,150,1,153,,16o,5,174,a,17g,,18r,k,19s,,1cm,6,1ct,,1cv,5,1d3,1,1d6,3,1e7,,1e9,,1f4,q,1ie,a,1kb,8,1kt,,1li,3,1ln,8,1lx,2,1m1,4,1nd,2,1ow,1,1p3,8,1qi,n,1r6,,1r7,v,1s3,,1tm,,1tn,,1to,,1tq,2,1tt,7,1u1,3,1u5,,1u6,1,1u9,6,1uq,1,1vl,,1vm,1,1x8,,1xa,,1xb,1,1xd,3,1xj,1,1xn,1,1xp,,1xz,,1ya,1,1z2,,1z5,1,1z7,,20s,,20u,2,20x,1,213,1,217,2,21d,,228,1,22d,,22p,1,22r,,24c,,24e,2,24h,4,24n,1,24p,,24r,1,24t,,25e,1,262,5,269,,26a,1,27w,,27y,1,280,,281,3,287,1,28b,1,28d,,28l,2,28y,1,29u,,2bi,,2bj,,2bk,,2bl,1,2bq,2,2bu,2,2bx,,2c7,,2dc,,2dd,2,2dg,,2f0,,2f2,2,2f5,3,2fa,2,2fe,3,2fp,1,2g2,1,2gx,,2gy,1,2ik,,2im,,2in,1,2ip,,2iq,,2ir,1,2iu,2,2iy,3,2j9,1,2jm,1,2k3,,2kg,1,2ki,1,2m3,1,2m6,,2m7,1,2m9,3,2me,2,2mi,2,2ml,,2mm,,2mv,,2n6,1,2o1,,2o2,1,2q2,,2q7,,2q8,1,2qa,2,2qe,,2qg,6,2qn,,2r6,1,2sx,,2sz,,2t0,6,2tj,7,2wh,,2wj,,2wk,8,2x4,6,2zc,1,305,,307,,309,,30e,1,31t,d,327,,328,4,32e,1,32l,a,32x,z,346,,371,3,375,,376,5,37d,1,37f,1,37h,1,386,1,388,1,38e,2,38x,3,39e,,39g,,39h,1,39p,,3a5,,3cw,2n,3fk,1z,3hk,2f,3tp,2,4k2,3,4ky,2,4lu,1,4mq,1,4ok,1,4om,,4on,6,4ou,7,4p2,,4p3,1,4p5,a,4pp,,4qz,2,4r2,,4r3,,4ud,1,4vd,,4yo,2,4yr,3,4yv,1,4yx,2,4z4,1,4z6,,4z7,5,4zd,2,55j,1,55l,1,55n,,579,,57a,,57b,,57c,6,57k,,57m,,57p,7,57x,5,583,9,58f,,59s,u,5c0,3,5c4,,5dg,9,5dq,3,5du,2,5ez,8,5fk,1,5fm,,5gh,,5gi,3,5gm,1,5go,5,5ie,,5if,,5ig,1,5ii,2,5il,,5im,,5in,4,5k4,7,5kc,7,5kk,1,5km,1,5ow,2,5p0,c,5pd,,5pe,6,5pp,,5pw,,5pz,,5q0,1,5vk,1r,6bv,,6bw,,6bx,,6by,1,6co,6,6d8,,6dl,,6e8,f,6hc,w,6jm,,6k9,,6ms,5,6nd,1,6xm,1,6y0,,70o,,72n,,73d,a,73s,2,79e,,7fu,1,7g6,,7gg,,7i3,3,7i8,5,7if,b,7is,35,7m8,39,7pk,a,7pw,,7py,,7q5,,7q9,,7qg,,7qr,1,7r8,,7rb,,7rg,,7ri,,7rn,2,7rr,,7s3,4,7th,2,7tt,,7u8,,7un,,850,1,8hx,2,8ij,1,8k0,,8k5,,8vj,2,8zj,,928,v,wvj,3,wvo,9,wwu,1,wz4,1,x6q,,x6u,,x6z,,x7n,1,x7p,1,x7r,,x7w,,xa8,1,xbo,f,xc4,1,xcw,h,xdr,,xeu,7,xfr,a,xg2,,xg3,,xgg,s,xhc,2,xhf,,xir,,xis,1,xiu,3,xiy,1,xj0,1,xj2,1,xj4,,xk5,,xm1,5,xm7,1,xm9,1,xmb,1,xmd,1,xmr,,xn0,,xn1,,xoc,,xps,,xpu,2,xpz,1,xq6,1,xq9,,xrf,,xrg,1,xri,1,xrp,,xrq,,xyb,1,xyd,,xye,1,xyg,,xyh,1,xyk,,xyl,,1e68,f,1e74,f,1edb,,1ehq,1,1ek0,b,1eyl,,1f4w,,1f92,4,1gjl,2,1gjp,1,1gjw,3,1gl4,2,1glb,,1gpx,1,1h5w,3,1h7t,4,1hgr,1,1hj0,3,1hl2,a,1hmq,3,1hq8,,1hq9,,1hqa,,1hrs,e,1htc,,1htf,1,1htr,2,1htu,,1hv4,2,1hv7,3,1hvb,1,1hvd,1,1hvh,,1hvm,,1hvx,,1hxc,2,1hyf,4,1hyk,,1hyl,7,1hz9,1,1i0j,,1i0w,1,1i0y,,1i2b,2,1i2e,8,1i2n,,1i2o,,1i2q,1,1i2x,3,1i32,,1i33,,1i5o,2,1i5r,2,1i5u,1,1i5w,3,1i66,,1i69,,1ian,,1iao,2,1iar,7,1ibk,1,1ibm,1,1id7,1,1ida,,1idb,,1idc,,1idd,3,1idj,1,1idn,1,1idp,,1idz,,1iea,1,1iee,6,1ieo,4,1igo,,1igp,1,1igr,5,1igy,,1ih1,,1ih3,2,1ih6,,1ih8,1,1iha,2,1ihd,,1ihe,,1iht,1,1ik5,2,1ik8,7,1ikg,1,1iki,2,1ikl,,1ikm,,1ila,,1ink,,1inl,1,1inn,5,1int,,1inu,,1inv,1,1inx,,1iny,,1inz,1,1io1,,1io2,1,1iun,,1iuo,1,1iuq,3,1iuw,3,1iv0,1,1iv2,,1iv3,1,1ivw,1,1iy8,2,1iyb,7,1iyj,1,1iyl,,1iym,,1iyn,1,1j1n,,1j1o,,1j1p,,1j1q,1,1j1s,7,1j4t,,1j4u,,1j4v,,1j4y,3,1j52,,1j53,4,1jcc,2,1jcf,8,1jco,,1jcp,1,1jjk,,1jjl,4,1jjr,1,1jjv,3,1jjz,,1jk0,,1jk1,,1jk2,,1jk3,,1jo1,2,1jo4,3,1joa,1,1joc,3,1jog,,1jok,,1jpd,9,1jqr,5,1jqx,,1jqy,,1jqz,3,1jrb,,1jrl,5,1jrr,1,1jrt,2,1jt0,5,1jt6,c,1jtj,,1jtk,1,1k4v,,1k4w,6,1k54,5,1k5a,,1k5b,,1k7m,l,1k89,,1k8a,6,1k8h,,1k8i,1,1k8k,,1k8l,1,1kc1,5,1kca,,1kcc,1,1kcf,6,1kcm,,1kcn,,1kei,4,1keo,1,1ker,1,1ket,,1keu,,1kev,,1koj,1,1kol,1,1kow,1,1koy,,1koz,,1kqc,1,1kqe,4,1kqm,1,1kqo,2,1kre,,1ovk,f,1ow0,,1ow7,e,1xr2,b,1xre,2,1xrh,2,1zow,4,1zqo,6,206b,,206f,3,20jz,,20k1,1i,20lr,3,20o4,,20og,1,2ftp,1,2fts,3,2jgg,19,2jhs,m,2jxh,4,2jxp,5,2jxv,7,2jy3,7,2jyd,6,2jze,3,2k3m,2,2lmo,1i,2lob,1d,2lpx,,2lqc,,2lqz,4,2lr5,e,2mtc,6,2mtk,g,2mu3,6,2mub,1,2mue,4,2mxb,,2n1s,6,2nce,,2ne4,3,2nsc,3,2nzi,1,2ok0,6,2on8,6,2pz4,73,2q6l,2,2q7j,,2q98,5,2q9q,1,2qa6,,2qa9,9,2qb1,1k,2qcm,p,2qdd,e,2qe2,,2qen,,2qeq,8,2qf0,3,2qfd,c1,2qrf,4,2qrk,8t,2r0m,7d,2r9c,3j,2rg4,b,2rit,16,2rkc,3,2rm0,7,2rmi,5,2rns,7,2rou,29,2rrg,1a,2rss,9,2rt3,c8,2scg,sd,jny8,v,jnz4,2n,jo1s,3j,jo5c,6n,joc0,2rz",
  "262122424333333393233393339333333333393393b3b3b3b3b333b33b3bb33333b3b3333333b3b33bb3333b33b3bb33333b3bbb333b333b33333b3b3b3b3333b3b33b3bb39333b33b33b3b3b333b333333b3b333333b33b3b3333b3335dc333333b3b3b33323333b3bb3b33b3b3b3333b3333b3b333bb3b33b3b3b3b3b333b333b3323e2244234444444444444444444444444444444444444444443333333333b3b3bb33333b353b3b3b3b333b3b333b333333b3bb3b3b3bb333232333333333333333b3b3333bb3b393933b3b33bb3b393b3b3b3333b33b33b3bbb33b333b3333bb3933b3b3b333b3b3b3b3b33b3b3b33b3b3b33b3b33b33b3b3b33bb39b9b3b33b3b33b9333b393b3b33b33b3b3b3333393b3b3b33b39bb3b332333b333dd3b33332333323333333333333333333333344444444a44444434444444444444423232"
);
const consonant_ranges = decodeUnicodeData(
  /** @type {UnicodeDataEncoding} */
  "1sl,10,1ug,7,1vc,7,1w5,j,1wq,6,1wy,,1x2,3,1y4,1,1y7,,1yo,1,239,j,23u,6,242,1,245,4,261,,26t,j,27e,6,27m,1,27p,4,28s,1,28v,,29d,,2dx,j,2ei,f,2fs,2,2l1,11"
);
const BMP_MAX = 65535;
function* graphemeSegments(input) {
  let cp = input.codePointAt(0);
  if (cp == null) return;
  let cursor = cp <= BMP_MAX ? 1 : 2;
  let len = input.length;
  let catBefore = cat(cp);
  let catAfter = 0;
  let risCount = 0;
  let emoji = false;
  let consonant = false;
  let linker = false;
  let index2 = 0;
  let _catBegin = catBefore;
  let _hd = cp;
  while (cursor < len) {
    cp = /** @type {number} */
    input.codePointAt(cursor);
    catAfter = cat(cp);
    let boundary = true;
    if (catBefore === 1) {
      boundary = catAfter !== 6;
    } else if (catBefore === 2 || catBefore === 6) {
      boundary = true;
    } else if (catAfter === 1 || catAfter === 2 || catAfter === 6) {
      boundary = true;
    } else if (catAfter === 3 || catAfter === 14 || catAfter === 11) {
      boundary = false;
    } else if (catBefore === 9) {
      boundary = false;
    } else if (catBefore === 14 && catAfter === 4) {
      boundary = !emoji;
    } else if (catBefore === 10 && catAfter === 10) {
      boundary = risCount++ % 2 === 1;
    } else if (catBefore === 5) {
      boundary = !(catAfter === 5 || catAfter === 13 || catAfter === 7 || catAfter === 8);
    } else if ((catBefore === 7 || catBefore === 13) && (catAfter === 13 || catAfter === 12)) {
      boundary = false;
    } else if ((catBefore === 8 || catBefore === 12) && catAfter === 12) {
      boundary = false;
    } else if (catAfter === 0 && consonant && linker && isIndicConjunctConsonant(cp)) {
      boundary = false;
    }
    if (boundary) {
      yield {
        segment: input.slice(index2, cursor),
        index: index2,
        input,
        _hd,
        _catBegin,
        _catEnd: catBefore
      };
      emoji = false;
      risCount = 0;
      index2 = cursor;
      _catBegin = catAfter;
      _hd = cp;
    } else {
      if (catAfter === 14 && (catBefore === 3 || catBefore === 4)) {
        emoji = true;
      } else if (cp >= 2325) {
        if (!consonant && catBefore === 0) {
          consonant = isIndicConjunctConsonant(_hd);
        }
        if (consonant && catAfter === 3) {
          linker = linker || cp === 2381 || cp === 2509 || cp === 2637 || cp === 2765 || cp === 2893 || cp === 3149 || cp === 3405;
        } else {
          linker = false;
        }
      }
    }
    cursor += cp <= BMP_MAX ? 1 : 2;
    catBefore = catAfter;
  }
  if (index2 < len) {
    yield {
      segment: input.slice(index2),
      index: index2,
      input,
      _hd,
      _catBegin,
      _catEnd: catBefore
    };
  }
}
function countGraphemes(text2) {
  let count = 0;
  for (let _ of graphemeSegments(text2)) count += 1;
  return count;
}
const SEG0 = new Uint8Array(6080), SEG0_MIN = 128, SEG0_MAX = 12287;
const SEG1 = new Uint8Array(1536), SEG1_MIN = 40960, SEG1_MAX = 44031;
const SEG_CURSOR = (() => {
  let cursor = 0;
  while (true) {
    let [start, end, cat2] = grapheme_ranges[cursor];
    if (start > SEG1_MAX) break;
    cursor++;
    if (end < SEG0_MIN || start > SEG0_MAX && end < SEG1_MIN) continue;
    for (let cp = start; cp <= end; cp++) {
      let seg, idx = 0;
      if (cp <= SEG0_MAX) {
        seg = SEG0;
        idx = cp - SEG0_MIN >> 1;
      } else {
        seg = SEG1;
        idx = cp - SEG1_MIN >> 1;
      }
      seg[idx] = cp & 1 ? seg[idx] & 15 | cat2 << 4 : seg[idx] & 240 | cat2;
    }
  }
  return cursor;
})();
function cat(cp) {
  if (cp < SEG0_MIN) {
    if (cp >= 32) return 0;
    if (cp === 10) return 6;
    if (cp === 13) return 1;
    return 2;
  }
  if (cp <= SEG0_MAX) {
    let byte = SEG0[cp - SEG0_MIN >> 1];
    return (
      /** @type {GraphemeCategoryNum} */
      cp & 1 ? byte >> 4 : byte & 15
    );
  }
  if (cp < SEG1_MIN) {
    if (cp < 12336) return cp >= 12330 ? 3 : 0;
    if (cp < 12443) {
      if (cp === 12336 || cp === 12349) return 4;
      return cp >= 12441 ? 3 : 0;
    }
    if (cp === 12951 || cp === 12953) return 4;
    return 0;
  }
  if (cp <= SEG1_MAX) {
    let byte = SEG1[cp - SEG1_MIN >> 1];
    return (
      /** @type {GraphemeCategoryNum} */
      cp & 1 ? byte >> 4 : byte & 15
    );
  }
  if (cp <= 55203) {
    return (cp - 44032) % 28 === 0 ? 7 : 8;
  }
  if (cp <= 55295) {
    if (cp <= 55238) return cp >= 55216 ? 13 : 0;
    return cp >= 55243 ? 12 : 0;
  }
  if (cp < 65024) {
    return cp === 64286 ? 3 : 0;
  }
  let idx = findUnicodeRangeIndex(cp, grapheme_ranges, SEG_CURSOR);
  return idx < 0 ? 0 : grapheme_ranges[idx][2];
}
function isIndicConjunctConsonant(cp) {
  return findUnicodeRangeIndex(cp, consonant_ranges) >= 0;
}
const segmenter = "Segmenter" in Intl && typeof Intl.Segmenter === "function" ? /* @__PURE__ */ new Intl.Segmenter() : (
  /* v8 ignore next -- @preserve */
  null
);
const graphemeLenNative = segmenter ? function graphemeLenNative2(str) {
  let length2 = 0;
  for (const _ of segmenter.segment(str))
    length2++;
  return length2;
} : (
  /* v8 ignore next -- @preserve */
  null
);
function graphemeLenPonyfill(str) {
  return countGraphemes(str);
}
const utf8LenNode = NodeJSBuffer ? function utf8LenNode2(string2) {
  return NodeJSBuffer.byteLength(string2, "utf8");
} : (
  /* v8 ignore next -- @preserve */
  null
);
function utf8LenCompute(string2) {
  let len = string2.length;
  let code2;
  for (let i = 0; i < string2.length; i += 1) {
    code2 = string2.charCodeAt(i);
    if (code2 <= 127) ;
    else if (code2 <= 2047) {
      len += 1;
    } else {
      len += 2;
      if (code2 >= 55296 && code2 <= 56319) {
        code2 = string2.charCodeAt(i + 1);
        if (code2 >= 56320 && code2 <= 57343) {
          i++;
        }
      }
    }
  }
  return len;
}
const graphemeLen = (
  /* v8 ignore next -- @preserve */
  graphemeLenNative ?? graphemeLenPonyfill
);
const utf8Len = (
  /* v8 ignore next -- @preserve */
  utf8LenNode ?? utf8LenCompute
);
// @__NO_SIDE_EFFECTS__
function arrayAgg(arr, cmp, agg) {
  if (arr.length === 0)
    return [];
  const groups = [[arr[0]]];
  const skipped = Array(arr.length);
  outer: for (let i = 1; i < arr.length; i++) {
    if (skipped[i])
      continue;
    const item = arr[i];
    for (let j = 0; j < groups.length; j++) {
      if (cmp(item, groups[j][0])) {
        groups[j].push(item);
        skipped[i] = true;
        continue outer;
      }
    }
    groups.push([item]);
  }
  return groups.map(agg);
}
const STRING_PREVIEW_MAX_LENGTH = 256;
const STRING_PREVIEW_TRUNCATED_SUFFIX = "…";
class Issue {
  constructor(code2, path, input) {
    this.code = code2;
    this.path = path;
    this.input = input;
  }
  /**
   * Returns a human-readable description of the validation issue.
   */
  toString() {
    return `${this.message}${stringifyPath(this.path)}`;
  }
  /**
   * Converts the issue to a JSON-serializable object.
   *
   * @returns An object containing the issue code, path, and message
   */
  toJSON() {
    return {
      code: this.code,
      path: this.path,
      message: this.message
    };
  }
}
class IssueInvalidFormat extends Issue {
  constructor(path, input, format2, detail) {
    super("invalid_format", path, input);
    this.format = format2;
    this.detail = detail;
  }
  get message() {
    return `Invalid ${this.formatDescription}${this.detail ? ` (${this.detail}, ` : " ("}got ${stringifyValue(this.input)})`;
  }
  /** Returns a human-readable description of the expected format. */
  get formatDescription() {
    switch (this.format) {
      case "at-identifier":
        return `AT identifier`;
      case "did":
        return `DID`;
      case "nsid":
        return `NSID`;
      case "cid":
        return `CID string`;
      case "tid":
        return `TID string`;
      case "record-key":
        return `record key`;
      default:
        return this.format;
    }
  }
  toJSON() {
    return {
      ...super.toJSON(),
      format: this.format
    };
  }
}
class IssueInvalidType extends Issue {
  constructor(path, input, expected) {
    super("invalid_type", path, input);
    this.expected = expected;
  }
  get message() {
    return `Expected ${oneOf(this.expected.map(stringifyExpectedType))} value type (got ${stringifyValue(this.input)})`;
  }
  toJSON() {
    return {
      ...super.toJSON(),
      expected: this.expected
    };
  }
}
class IssueInvalidValue extends Issue {
  constructor(path, input, values) {
    super("invalid_value", path, input);
    this.values = values;
  }
  get message() {
    return `Expected ${oneOf(this.values.map(stringifyValue))} (got ${stringifyValue(this.input)})`;
  }
  toJSON() {
    return {
      ...super.toJSON(),
      values: this.values
    };
  }
}
class IssueRequiredKey extends Issue {
  constructor(path, input, key) {
    super("required_key", path, input);
    this.key = key;
  }
  get message() {
    return `Missing required key "${String(this.key)}"`;
  }
  toJSON() {
    return {
      ...super.toJSON(),
      key: this.key
    };
  }
}
class IssueTooBig extends Issue {
  constructor(path, input, maximum, type, actual) {
    super("too_big", path, input);
    this.maximum = maximum;
    this.type = type;
    this.actual = actual;
  }
  get message() {
    return `${this.type} too big (maximum ${this.maximum}, got ${this.actual})`;
  }
  toJSON() {
    return {
      ...super.toJSON(),
      type: this.type,
      maximum: this.maximum
    };
  }
}
class IssueTooSmall extends Issue {
  constructor(path, input, minimum, type, actual) {
    super("too_small", path, input);
    this.minimum = minimum;
    this.type = type;
    this.actual = actual;
  }
  get message() {
    return `${this.type} too small (minimum ${this.minimum}, got ${this.actual})`;
  }
  toJSON() {
    return {
      ...super.toJSON(),
      type: this.type,
      minimum: this.minimum
    };
  }
}
function stringifyExpectedType(expected) {
  if (expected === "$typed") {
    return 'an object which includes the "$type" property';
  }
  return expected;
}
function stringifyPath(path) {
  return ` at ${buildJsonPath(path)}`;
}
function buildJsonPath(path) {
  return `$${path.map(toJsonPathSegment).join("")}`;
}
function toJsonPathSegment(segment) {
  if (typeof segment === "number" || typeof segment === "symbol") {
    return `[${String(segment)}]`;
  } else if (/^[a-zA-Z_$][a-zA-Z0-9_]*$/.test(segment)) {
    return `.${segment}`;
  } else {
    return `[${JSON.stringify(segment)}]`;
  }
}
function oneOf(arr) {
  if (arr.length === 0)
    return "";
  if (arr.length === 1)
    return arr[0];
  return `one of ${arr.slice(0, -1).join(", ")} or ${arr.at(-1)}`;
}
function stringifyValue(value) {
  switch (typeof value) {
    case "bigint":
      return `${value}n`;
    case "number":
    case "boolean":
      return String(value);
    case "string":
      return JSON.stringify(value.length < STRING_PREVIEW_MAX_LENGTH ? value : `${value.slice(0, STRING_PREVIEW_MAX_LENGTH - STRING_PREVIEW_TRUNCATED_SUFFIX.length)}${STRING_PREVIEW_TRUNCATED_SUFFIX}`);
    case "object":
      if (value === null)
        return "null";
      if (Array.isArray(value)) {
        return `[${/* @__PURE__ */ stringifyArray(value, stringifyValue)}]`;
      }
      if (isPlainObject$1(value)) {
        return `{${/* @__PURE__ */ stringifyArray(Object.entries(value), stringifyObjectEntry)}}`;
      }
      if (ifCid(value))
        return "cid";
      if (isLegacyBlobRef(value))
        return "legacy-blob";
      if (value instanceof Date)
        return "date";
      if (value instanceof RegExp)
        return "regexp";
      if (value instanceof Map)
        return "map";
      if (value instanceof Set)
        return "set";
      return "object";
    default:
      return typeof value;
  }
}
// @__NO_SIDE_EFFECTS__
function stringifyObjectEntry([key, _value]) {
  return `${JSON.stringify(key)}: ...`;
}
// @__NO_SIDE_EFFECTS__
function stringifyArray(arr, fn, n = 2) {
  return arr.slice(0, n).map(fn).join(", ") + (arr.length > n ? ", ..." : "");
}
class LexValidationError extends LexError {
  /**
   * Creates a new validation error from a list of issues.
   *
   * Issues are automatically aggregated to combine related issues at the same
   * path (e.g., multiple type expectations from a union schema).
   *
   * @param issues - The validation issues that caused this error
   * @param options - Standard Error options (e.g., `cause`)
   */
  constructor(issues, options) {
    const issuesAgg = aggregateIssues(issues);
    super("InvalidRequest", issuesAgg.join(", "), options);
    this.name = "LexValidationError";
    this.success = false;
    this.issues = issuesAgg;
  }
  /** @see {ResultFailure.reason} */
  get reason() {
    return this;
  }
  /**
   * Converts the error to a JSON-serializable object.
   *
   * @returns An object containing the error details and issues details
   */
  toJSON() {
    return {
      ...super.toJSON(),
      issues: this.issues.map((issue) => issue.toJSON())
    };
  }
}
function aggregateIssues(issues) {
  if (issues.length <= 1)
    return issues;
  if (issues.length === 2 && issues[0].code !== issues[1].code)
    return issues;
  return [
    // Aggregate invalid_type with identical paths
    .../* @__PURE__ */ arrayAgg(issues.filter((issue) => issue instanceof IssueInvalidType), (a, b) => /* @__PURE__ */ comparePropertyPaths(a.path, b.path), (issues2) => new IssueInvalidType(issues2[0].path, issues2[0].input, Array.from(new Set(issues2.flatMap((iss) => iss.expected))))),
    // Aggregate invalid_value with identical paths
    .../* @__PURE__ */ arrayAgg(issues.filter((issue) => issue instanceof IssueInvalidValue), (a, b) => /* @__PURE__ */ comparePropertyPaths(a.path, b.path), (issues2) => new IssueInvalidValue(issues2[0].path, issues2[0].input, Array.from(new Set(issues2.flatMap((iss) => iss.values))))),
    // Pass through other issues
    ...issues.filter((issue) => !(issue instanceof IssueInvalidType) && !(issue instanceof IssueInvalidValue))
  ];
}
// @__NO_SIDE_EFFECTS__
function comparePropertyPaths(a, b) {
  if (a.length !== b.length)
    return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i])
      return false;
  }
  return true;
}
class ValidationContext {
  static validate(input, validator, options) {
    const context = new ValidationContext({
      path: options?.path ?? [],
      mode: options?.mode ?? "validate",
      strict: options?.strict ?? true
    });
    return context.validate(input, validator);
  }
  /**
   * Creates a new validation context with the specified options.
   *
   * @param options - The validation options (path and mode are required)
   */
  constructor(options) {
    this.issues = [];
    this.currentPath = Array.from(options.path);
    this.options = options;
  }
  /**
   * Returns a copy of the current validation path.
   *
   * The path represents the location in the data structure being validated,
   * used for constructing meaningful error messages.
   */
  get path() {
    return Array.from(this.currentPath);
  }
  /**
   * Creates a new path by appending segments to the current path.
   *
   * @param path - Optional path segment(s) to append
   * @returns A new path array with the segment(s) appended
   */
  concatPath(path) {
    if (path == null)
      return this.path;
    return this.currentPath.concat(path);
  }
  /**
   * Validates input against a validator within this context.
   *
   * This is the primary entry point for validation within a context. Always use
   * this method instead of calling {@link Validator.validateInContext} directly,
   * as this method enforces validation mode rules and handles transformation detection.
   *
   * @typeParam V - The validator type
   * @param input - The value to validate
   * @param validator - The validator to use
   * @returns A validation result with the validated value or error
   */
  validate(input, validator) {
    const result = validator.validateInContext(input, this);
    if (result.success) {
      if (this.issues.length > 0) {
        return new LexValidationError(Array.from(this.issues));
      }
      if (this.options.mode !== "parse" && !Object.is(result.value, input)) {
        return this.issueInvalidValue(input, [result.value]);
      }
    }
    return result;
  }
  /**
   * Validates a child property of an object within this context.
   *
   * This method automatically manages the path stack, pushing the property key
   * before validation and popping it afterward. Use this for validating object
   * properties to ensure proper path tracking in error messages.
   *
   * @typeParam I - The input object type
   * @typeParam K - The property key type
   * @typeParam V - The validator type
   * @param input - The parent object containing the property
   * @param key - The property key to validate
   * @param validator - The validator to use for the property value
   * @returns A validation result for the property value
   *
   * @example
   * ```typescript
   * // In a custom object validator
   * const result = ctx.validateChild(input, 'name', stringSchema)
   * // If validation fails, error path will include 'name'
   * ```
   */
  validateChild(input, key, validator) {
    this.currentPath.push(key);
    try {
      return this.validate(input[key], validator);
    } finally {
      this.currentPath.length--;
    }
  }
  /**
   * Adds a validation issue to the context without immediately failing.
   *
   * Use this method to collect multiple issues during validation before
   * determining the final result. Issues added this way will be included
   * in the final error if validation fails.
   *
   * @param issue - The validation issue to add
   */
  addIssue(issue) {
    this.issues.push(issue);
  }
  /**
   * Helper method to create a successful validation result.
   *
   * @typeParam V - The value type
   * @param value - The validated value
   * @returns A successful validation result
   */
  success(value) {
    return { success: true, value };
  }
  /**
   * Creates a failed validation result from a single issue.
   *
   * Any previously accumulated issues in the context are included in the error.
   *
   * @param issue - The validation issue that caused the failure
   * @returns A failed validation result
   */
  issue(issue) {
    return new LexValidationError([...this.issues, issue]);
  }
  /**
   * Creates a failure for an invalid value that doesn't match expected values.
   *
   * @param input - The actual value that was received
   * @param values - The expected valid values
   * @returns A failed validation result with an invalid value issue
   */
  issueInvalidValue(input, values) {
    return this.issue(new IssueInvalidValue(this.path, input, values));
  }
  /**
   * Creates a failure for an invalid type.
   *
   * @param input - The actual value that was received
   * @param expected - An array of expected type names
   * @returns A failed validation result with an invalid type issue
   */
  issueInvalidType(input, expected) {
    return this.issue(new IssueInvalidType(this.path, input, expected));
  }
  /**
   * Creates a failure for an invalid type.
   *
   * @param input - The actual value that was received
   * @param expected - The expected type name
   * @returns A failed validation result with an invalid type issue
   */
  issueUnexpectedType(input, expected) {
    return this.issueInvalidType(input, [expected]);
  }
  /**
   * Creates a failure for a missing required key in an object.
   *
   * @param input - The object missing the required key
   * @param key - The name of the required key
   * @returns A failed validation result with a required key issue
   */
  issueRequiredKey(input, key) {
    return this.issue(new IssueRequiredKey(this.path, input, key));
  }
  /**
   * Creates a failure for an invalid string format.
   *
   * @param input - The actual value that was received
   * @param format - The expected format name (e.g., 'did', 'handle', 'uri')
   * @param msg - Optional additional message describing the format error
   * @returns A failed validation result with an invalid format issue
   */
  issueInvalidFormat(input, format2, msg) {
    return this.issue(new IssueInvalidFormat(this.path, input, format2, msg));
  }
  /**
   * Creates a failure for a value that exceeds a maximum constraint.
   *
   * @param input - The actual value that was received
   * @param type - The type of measurement (e.g., 'string', 'array', 'bytes')
   * @param max - The maximum allowed value
   * @param actual - The actual measured value
   * @returns A failed validation result with a too big issue
   */
  issueTooBig(input, type, max, actual) {
    return this.issue(new IssueTooBig(this.path, input, max, type, actual));
  }
  /**
   * Creates a failure for a value that is below a minimum constraint.
   *
   * @param input - The actual value that was received
   * @param type - The type of measurement (e.g., 'string', 'array', 'bytes')
   * @param min - The minimum required value
   * @param actual - The actual measured value
   * @returns A failed validation result with a too small issue
   */
  issueTooSmall(input, type, min, actual) {
    return this.issue(new IssueTooSmall(this.path, input, min, type, actual));
  }
  /**
   * Creates a failure for an invalid property value within an object.
   *
   * This is a convenience method that automatically extracts the property value
   * and constructs the appropriate path.
   *
   * @typeParam I - The input object type
   * @param input - The object containing the invalid property
   * @param property - The property key with the invalid value
   * @param values - The expected valid values
   * @returns A failed validation result with an invalid value issue at the property path
   */
  issueInvalidPropertyValue(input, property, values) {
    const value = input[property];
    const path = this.concatPath(property);
    return this.issue(new IssueInvalidValue(path, value, values));
  }
  /**
   * Creates a failure for an invalid property type within an object.
   *
   * This is a convenience method that automatically extracts the property value
   * and constructs the appropriate path.
   *
   * @typeParam I - The input object type
   * @param input - The object containing the invalid property
   * @param property - The property key with the invalid type
   * @param expected - The expected type name
   * @returns A failed validation result with an invalid type issue at the property path
   */
  issueInvalidPropertyType(input, property, expected) {
    const value = input[property];
    const path = this.concatPath(property);
    return this.issue(new IssueInvalidType(path, value, [expected]));
  }
}
class StandardSchemaAdapter {
  constructor(validator) {
    this.version = 1;
    this.vendor = "@atproto/lex-schema";
    this.validator = validator;
  }
  validate(value, options) {
    return ValidationContext.validate(value, this.validator, {
      ...options?.libraryOptions,
      mode: "parse"
    });
  }
}
let Schema$1 = class Schema {
  get "~standard"() {
    return /* @__PURE__ */ lazyProperty(this, "~standard", new StandardSchemaAdapter(this));
  }
  /**
   * @note use {@link check}() instead of {@link assert}() if you encounter a
   * `ts(2775)` error and you are not able to fully type the validator. This
   * will typically arise in generic contexts, where the narrowed type is not
   * needed.
   */
  assert(input, options) {
    const result = this.safeValidate(input, options);
    if (!result.success)
      throw result.reason;
  }
  /**
   * Alias for {@link assert}(). Most useful in generic contexts where the
   * validator is not exactly typed, allowing to avoid "_Assertions require
   * every name in the call target to be declared with an explicit type
   * annotation. ts(2775)_" errors.
   */
  check(input, options) {
    this.assert(input, options);
  }
  /**
   * Casts the input (by validating it) to the output type if it matches the
   * schema, otherwise throws. This is the same as calling {@link parse}() with
   * `mode: "validate"`.
   */
  cast(input, options) {
    const result = this.safeValidate(input, options);
    if (result.success)
      return result.value;
    throw result.reason;
  }
  /**
   * Type guard that checks if the input matches this schema.
   *
   * @example
   * ```typescript
   * if (schema.matches(data)) {
   *   // data is narrowed to the schema's input type
   *   console.log(data)
   * }
   * ```
   */
  matches(input, options) {
    const result = this.safeValidate(input, options);
    return result.success;
  }
  /**
   * Returns the input if it matches this schema, otherwise returns `undefined`.
   *
   * This is useful for optional filtering operations where you want to
   * conditionally extract values that match a schema.
   *
   * @example
   * ```typescript
   * const validData = schema.ifMatches(data)
   * if (validData !== undefined) {
   *   // validData is the schema's input type
   *   console.log(validData)
   * }
   * ```
   */
  ifMatches(input, options) {
    return this.matches(input, options) ? input : void 0;
  }
  /**
   * Parses the input, allowing value transformations and coercion.
   *
   * Unlike {@link validate}, this method allows the schema to transform
   * the input value (e.g., applying default values, type coercion).
   * Throws a {@link LexValidationError} if the input is invalid.
   *
   * @param input - The value to parse
   * @param options - Optional parsing configuration
   * @returns The parsed and potentially transformed value
   * @throws {LexValidationError} If the input fails validation
   *
   * @example
   * ```typescript
   * const result = schema.parse(rawData)
   * // result has defaults applied and is fully typed
   * ```
   */
  parse(input, options) {
    const result = this.safeParse(input, options);
    if (result.success)
      return result.value;
    throw result.reason;
  }
  /**
   * Safely parses the input without throwing, returning a result object.
   *
   * This method allows value transformations like {@link parse}, but
   * returns a discriminated union result instead of throwing on error.
   *
   * @param input - The value to parse
   * @param options - Optional parsing configuration
   * @returns A {@link ValidationResult} with either the parsed value or validation errors
   *
   * @example
   * ```typescript
   * const result = schema.safeParse(data)
   * if (result.success) {
   *   console.log(result.value)
   * } else {
   *   console.error(result.reason.issues)
   * }
   * ```
   */
  safeParse(input, options) {
    return ValidationContext.validate(input, this, {
      ...options,
      mode: "parse"
    });
  }
  /**
   * Validates the input strictly without allowing transformations.
   *
   * Unlike {@link parse}, this method requires the input to exactly match
   * the schema without any transformations (no defaults applied, no coercion).
   * Throws a {@link LexValidationError} if the input is invalid or would require transformation.
   *
   * @typeParam I - The input type (preserved in the return type)
   * @param input - The value to validate
   * @param options - Optional validation configuration
   * @returns The validated input with narrowed type
   * @throws {LexValidationError} If the input fails validation or requires transformation
   *
   * @example
   * ```typescript
   * const validated = schema.validate(data)
   * // validated is typed as the intersection of input type and schema type
   * ```
   */
  validate(input, options) {
    const result = this.safeValidate(input, options);
    if (result.success)
      return result.value;
    throw result.reason;
  }
  /**
   * Safely validates the input without throwing, returning a result object.
   *
   * This method performs strict validation like {@link validate}, but
   * returns a discriminated union result instead of throwing on error.
   *
   * @typeParam I - The input type (preserved in the result value type)
   * @param input - The value to validate
   * @param options - Optional validation configuration
   * @returns A {@link ValidationResult} with either the validated value or validation errors
   *
   * @example
   * ```typescript
   * const result = schema.safeValidate(data)
   * if (result.success) {
   *   console.log(result.value)
   * } else {
   *   console.error(result.reason.issues)
   * }
   * ```
   */
  safeValidate(input, options) {
    return ValidationContext.validate(input, this, {
      ...options,
      mode: "validate"
    });
  }
  // @NOTE Dollar-prefixed aliases
  //
  // The `lex-builder` lib generates namespaced utility functions that allow
  // accessing the schema's methods without the need to specify the ".main."
  // part of the namespace. This allows utilities for a particular record type
  // to be called like "app.bsky.feed.post.<utility>()" instead of
  // "app.bsky.feed.post.main.<utility>()".
  //
  // Because those utilities could conflict with other schemas (e.g. if there is
  // a lexicon definition with the same name as the "<utility>"), those exported
  // utilities will be prefixed with "$".
  //
  // Similarly, since those utilities are defined as simple "const", they are
  // also bound (using JS's .bind) to the schema instance, so that they can be
  // used without worrying about the context (e.g. "app.bsky.feed.post.$parse()"
  // will work regardless of how it is imported or called).
  //
  // In order to provide the same functionalities for non-main definitions, we
  // also define those aliases directly on the schema instance, so that they can
  // be used in the same way as the utilities generated by "lex-builder". For
  // example, if there is a non-main definition "app.bsky.feed.defs.postView",
  // it will also be possible to call "app.bsky.feed.defs.postView.$parse()".
  //
  // These methods are also "bound" to the instance so that they can be used
  // exactly like the utilities generated by "lex-builder", without worrying
  // about the context.
  //
  // There are two ways we could "bind" those methods to the instance:
  // 1. Define them as getters that return the bound method (e.g. get $parse() {
  //    return this.parse.bind(this) })
  // 2. Define them as properties that are initialized in the constructor (e.g.
  //    this.$parse = this.parse.bind(this))
  //
  // Since a **lot** of those methods would end-up being created in systems that
  // contains many schemas (e.g. the appview), we choose the first approach
  // (getters) in order to avoid the overhead of creating all those bound
  // functions upfront when instantiating the schemas.
  /**
   * Bound alias for {@link assert} for compatibility with generated utilities.
   * @see {@link assert}
   */
  get $assert() {
    return /* @__PURE__ */ lazyProperty(this, "$assert", this.assert.bind(this));
  }
  /**
   * Bound alias for {@link check} for compatibility with generated utilities.
   * @see {@link check}
   */
  get $check() {
    return /* @__PURE__ */ lazyProperty(this, "$check", this.check.bind(this));
  }
  /**
   * Bound alias for {@link cast} for compatibility with generated utilities.
   * @see {@link cast}
   */
  get $cast() {
    return /* @__PURE__ */ lazyProperty(this, "$cast", this.cast.bind(this));
  }
  /**
   * Bound alias for {@link matches} for compatibility with generated utilities.
   * @see {@link matches}
   */
  get $matches() {
    return /* @__PURE__ */ lazyProperty(this, "$matches", this.matches.bind(this));
  }
  /**
   * Bound alias for {@link ifMatches} for compatibility with generated utilities.
   * @see {@link ifMatches}
   */
  get $ifMatches() {
    return /* @__PURE__ */ lazyProperty(this, "$ifMatches", this.ifMatches.bind(this));
  }
  /**
   * Bound alias for {@link parse} for compatibility with generated utilities.
   * @see {@link parse}
   */
  get $parse() {
    return /* @__PURE__ */ lazyProperty(this, "$parse", this.parse.bind(this));
  }
  /**
   * Bound alias for {@link safeParse} for compatibility with generated utilities.
   * @see {@link safeParse}
   */
  get $safeParse() {
    return /* @__PURE__ */ lazyProperty(this, "$safeParse", this.safeParse.bind(this));
  }
  /**
   * Bound alias for {@link validate} for compatibility with generated utilities.
   * @see {@link validate}
   */
  get $validate() {
    return /* @__PURE__ */ lazyProperty(this, "$validate", this.validate.bind(this));
  }
  /**
   * Bound alias for {@link safeValidate} for compatibility with generated utilities.
   * @see {@link safeValidate}
   */
  get $safeValidate() {
    return /* @__PURE__ */ lazyProperty(this, "$safeValidate", this.safeValidate.bind(this));
  }
};
function isAtUriStringLenient(input) {
  return isAtUriString(input, { strict: false });
}
const isCidString = ((input) => typeof input === "string" && validateCidString(input));
const isDidString = isValidDid;
const isHandleString = isValidHandle;
const isLanguageString = ((input) => typeof input === "string" && parseLanguageString(input) !== null);
const isLanguageStringLenient = isValidLanguage;
const isNsidString = isValidNsid;
const isRecordKeyString = isValidRecordKey;
const isTidString = isValidTid;
const isUriString = isValidUri;
const stringFormatVerifiers = /* @__PURE__ */ Object.freeze({
  __proto__: null,
  "at-identifier": [isAtIdentifierString],
  "at-uri": [isAtUriString, isAtUriStringLenient],
  cid: [isCidString],
  datetime: [isDatetimeString, isDatetimeStringLenient],
  did: [isDidString],
  handle: [isHandleString],
  language: [isLanguageString, isLanguageStringLenient],
  nsid: [isNsidString],
  "record-key": [isRecordKeyString],
  tid: [isTidString],
  uri: [isUriString]
});
// @__NO_SIDE_EFFECTS__
function isStringFormat(input, format2, options) {
  const formatVerifier = stringFormatVerifiers[format2];
  if (!formatVerifier)
    throw new TypeError(`Unknown string format: ${format2}`);
  const check = options?.strict === false && formatVerifier.length > 1 ? formatVerifier[1] : formatVerifier[0];
  return check(input);
}
const STRING_FORMATS = /* @__PURE__ */ Object.freeze(
  /* @__PURE__ */ Object.keys(stringFormatVerifiers)
);
// @__NO_SIDE_EFFECTS__
function memoizedOptions(fn) {
  let cache2 = null;
  return function cached(...args) {
    if (args.length > 0) {
      return fn(...args);
    }
    if (cache2 != null) {
      return cache2.value;
    }
    const value = fn(...args);
    cache2 = { value };
    return value;
  };
}
// @__NO_SIDE_EFFECTS__
function memoizedTransformer(fn) {
  let cache2;
  return function cached(key, ...args) {
    if (args.length > 0)
      return fn(key, ...args);
    cache2 ??= /* @__PURE__ */ new WeakMap();
    const cached2 = cache2.get(key);
    if (cached2)
      return cached2;
    const result = fn(key, ...args);
    cache2.set(key, result);
    return result;
  };
}
class ArraySchema extends Schema$1 {
  constructor(validator, options = {}) {
    super();
    this.type = "array";
    this.validator = validator;
    this.options = options;
  }
  validateInContext(input, ctx) {
    if (!Array.isArray(input)) {
      return ctx.issueUnexpectedType(input, "array");
    }
    const { minLength, maxLength } = this.options;
    if (minLength != null && input.length < minLength) {
      return ctx.issueTooSmall(input, "array", minLength, input.length);
    }
    if (maxLength != null && input.length > maxLength) {
      return ctx.issueTooBig(input, "array", maxLength, input.length);
    }
    let copy;
    for (let i = 0; i < input.length; i++) {
      const result = ctx.validateChild(input, i, this.validator);
      if (!result.success)
        return result;
      if (result.value !== input[i]) {
        if (ctx.options.mode === "validate") {
          return ctx.issueInvalidPropertyValue(input, i, [result.value]);
        }
        copy ??= Array.from(input);
        copy[i] = result.value;
      }
    }
    return ctx.success(copy ?? input);
  }
}
function arraySchema(items, options) {
  return new ArraySchema(items, options);
}
const array = /* @__PURE__ */ memoizedTransformer(arraySchema);
class BlobSchema extends Schema$1 {
  constructor(options) {
    super();
    this.type = "blob";
    this.options = options;
  }
  validateInContext(input, ctx) {
    const blob2 = parseValue.call(ctx, input);
    if (!blob2) {
      return ctx.issueUnexpectedType(input, "blob");
    }
    if (ctx.options.strict && this.options != null) {
      const { accept } = this.options;
      if (accept && !matchesMime(blob2.mimeType, accept)) {
        return ctx.issueInvalidPropertyValue(blob2, "mimeType", accept);
      }
      const { maxSize } = this.options;
      if (maxSize != null) {
        const size = getBlobSize(blob2);
        if (size === void 0) {
          return ctx.issueInvalidPropertyType(blob2, "size", "integer");
        } else if (size > maxSize) {
          return ctx.issueTooBig(blob2, "blob", maxSize, size);
        }
      }
    }
    return ctx.success(blob2);
  }
  matchesMime(mime) {
    const accept = this.options?.accept;
    if (!accept)
      return true;
    return matchesMime(mime, accept);
  }
}
function parseValue(input) {
  if (input?.$type !== void 0) {
    return isTypedBlobRef(input, this.options) ? input : null;
  }
  if (!this.options.strict) {
    if (isLegacyBlobRef(input, this.options))
      return input;
  }
  return null;
}
function matchesMime(mime, accepted) {
  if (accepted.includes("*/*"))
    return true;
  if (accepted.includes(mime))
    return true;
  for (const value of accepted) {
    if (value.endsWith("/*") && mime.startsWith(value.slice(0, -1))) {
      return true;
    }
  }
  return false;
}
const blob = /* @__PURE__ */ memoizedOptions((options) => new BlobSchema(options));
class BooleanSchema extends Schema$1 {
  constructor() {
    super(...arguments);
    this.type = "boolean";
  }
  validateInContext(input, ctx) {
    if (typeof input === "boolean") {
      return ctx.success(input);
    }
    return ctx.issueUnexpectedType(input, "boolean");
  }
}
const boolean = /* @__PURE__ */ memoizedOptions(() => new BooleanSchema());
class DictSchema extends Schema$1 {
  constructor(keySchema2, valueSchema) {
    super();
    this.type = "dict";
    this.keySchema = keySchema2;
    this.valueSchema = valueSchema;
  }
  validateInContext(input, ctx, options) {
    if (!isPlainObject$1(input)) {
      return ctx.issueUnexpectedType(input, "dict");
    }
    let copy;
    for (const key in input) {
      if (options?.ignoredKeys?.has(key))
        continue;
      const keyResult = ctx.validate(key, this.keySchema);
      if (!keyResult.success)
        return keyResult;
      if (keyResult.value !== key) {
        return ctx.issueRequiredKey(input, key);
      }
      const valueResult = ctx.validateChild(input, key, this.valueSchema);
      if (!valueResult.success)
        return valueResult;
      if (!Object.is(valueResult.value, input[key])) {
        if (ctx.options.mode === "validate") {
          return ctx.issueInvalidPropertyValue(input, key, [valueResult.value]);
        }
        copy ??= { ...input };
        copy[key] = valueResult.value;
      }
    }
    return ctx.success(copy ?? input);
  }
}
// @__NO_SIDE_EFFECTS__
function dict(key, value) {
  return new DictSchema(key, value);
}
class EnumSchema extends Schema$1 {
  constructor(values) {
    super();
    this.type = "enum";
    this.values = values;
  }
  validateInContext(input, ctx) {
    if (!this.values.includes(input)) {
      return ctx.issueInvalidValue(input, this.values);
    }
    return ctx.success(input);
  }
}
// @__NO_SIDE_EFFECTS__
function enumSchema(value) {
  return new EnumSchema(value);
}
class IntegerSchema extends Schema$1 {
  constructor(options) {
    super();
    this.type = "integer";
    this.options = options;
  }
  validateInContext(input, ctx) {
    if (!isInteger(input)) {
      return ctx.issueUnexpectedType(input, "integer");
    }
    if (this.options?.minimum != null && input < this.options.minimum) {
      return ctx.issueTooSmall(input, "integer", this.options.minimum, input);
    }
    if (this.options?.maximum != null && input > this.options.maximum) {
      return ctx.issueTooBig(input, "integer", this.options.maximum, input);
    }
    return ctx.success(input);
  }
}
function isInteger(input) {
  return Number.isSafeInteger(input);
}
const integer = /* @__PURE__ */ memoizedOptions((options) => new IntegerSchema(options));
const EXPECTED_TYPES = Object.freeze([
  // Scalar types
  "null",
  "boolean",
  "integer",
  "string",
  "cid",
  "bytes",
  // Recursive types
  "array",
  "object"
]);
class LexValueSchema extends Schema$1 {
  constructor() {
    super(...arguments);
    this.type = "lexValue";
  }
  validateInContext(input, ctx) {
    if (isPlainObject$1(input)) {
      for (const key of Object.keys(input)) {
        const r = ctx.validateChild(input, key, this);
        if (!r.success)
          return r;
      }
    } else if (Array.isArray(input)) {
      for (let i = 0; i < input.length; i++) {
        const r = ctx.validateChild(input, i, this);
        if (!r.success)
          return r;
      }
    } else if (!isLexScalar(input)) {
      return ctx.issueInvalidType(input, EXPECTED_TYPES);
    }
    return ctx.success(input);
  }
}
const lexValue = /* @__PURE__ */ memoizedOptions(() => new LexValueSchema());
const propertyValueSchema = /* @__PURE__ */ lexValue();
class LexMapSchema extends Schema$1 {
  constructor() {
    super(...arguments);
    this.type = "lexMap";
  }
  validateInContext(input, ctx) {
    if (!isPlainObject$1(input)) {
      return ctx.issueUnexpectedType(input, "object");
    }
    for (const key of Object.keys(input)) {
      const r = ctx.validateChild(input, key, propertyValueSchema);
      if (!r.success)
        return r;
    }
    return ctx.success(input);
  }
}
const lexMap = /* @__PURE__ */ memoizedOptions(() => new LexMapSchema());
class LiteralSchema extends Schema$1 {
  constructor(value) {
    super();
    this.type = "literal";
    this.value = value;
  }
  validateInContext(input, ctx) {
    if (input !== this.value) {
      return ctx.issueInvalidValue(input, [this.value]);
    }
    return ctx.success(this.value);
  }
}
// @__NO_SIDE_EFFECTS__
function literal(value) {
  return new LiteralSchema(value);
}
class ObjectSchema extends Schema$1 {
  constructor(shape) {
    super();
    this.type = "object";
    this.shape = shape;
  }
  get validatorsMap() {
    const map2 = new Map(Object.entries(this.shape));
    return /* @__PURE__ */ lazyProperty(this, "validatorsMap", map2);
  }
  validateInContext(input, ctx) {
    if (!isPlainObject$1(input)) {
      return ctx.issueUnexpectedType(input, "object");
    }
    let copy;
    for (const [key, propDef] of this.validatorsMap) {
      const result = ctx.validateChild(input, key, propDef);
      if (!result.success) {
        if (!(key in input)) {
          return ctx.issueRequiredKey(input, key);
        }
        return result;
      }
      if (result.value === void 0 && !(key in input)) {
        continue;
      }
      if (!Object.is(result.value, input[key])) {
        if (ctx.options.mode === "validate") {
          return ctx.issueInvalidPropertyValue(input, key, [result.value]);
        }
        copy ??= { ...input };
        copy[key] = result.value;
      }
    }
    return ctx.success(copy ?? input);
  }
}
// @__NO_SIDE_EFFECTS__
function object(properties) {
  return new ObjectSchema(properties);
}
class RegexpSchema extends Schema$1 {
  constructor(pattern, message) {
    super();
    this.type = "regexp";
    this.pattern = pattern;
    this.message = message;
  }
  validateInContext(input, ctx) {
    if (typeof input !== "string") {
      return ctx.issueUnexpectedType(input, "string");
    }
    if (!this.pattern.test(input)) {
      return ctx.issueInvalidFormat(input, this.pattern.toString(), this.message);
    }
    return ctx.success(input);
  }
}
// @__NO_SIDE_EFFECTS__
function regexp(pattern, message) {
  return new RegexpSchema(pattern, message);
}
class TokenSchema extends Schema$1 {
  constructor(value) {
    super();
    this.type = "token";
    this.value = value;
  }
  get $token() {
    return this.value;
  }
  validateInContext(input, ctx) {
    if (input === this.value) {
      return ctx.success(this.value);
    }
    if (ctx.options.mode === "parse" && input instanceof TokenSchema && input.value === this.value) {
      return ctx.success(this.value);
    }
    if (typeof input !== "string") {
      return ctx.issueUnexpectedType(input, "token");
    }
    return ctx.issueInvalidValue(input, [this.value]);
  }
  // When using the TokenSchema instance as data, let's serialize it to the
  // token value
  toJSON() {
    return this.value;
  }
  toString() {
    return this.value;
  }
}
class StringSchema extends Schema$1 {
  constructor(options) {
    super();
    this.type = "string";
    this.options = options;
  }
  validateInContext(input, ctx) {
    const str = coerceToString(input);
    if (str == null) {
      return ctx.issueUnexpectedType(input, "string");
    }
    let lazyUtf8Len;
    const minLength = this.options.minLength;
    if (minLength != null) {
      if ((lazyUtf8Len ??= utf8Len(str)) < minLength) {
        return ctx.issueTooSmall(str, "string", minLength, lazyUtf8Len);
      }
    }
    const maxLength = this.options.maxLength;
    if (maxLength != null) {
      if (str.length * 3 <= maxLength) ;
      else if ((lazyUtf8Len ??= utf8Len(str)) > maxLength) {
        return ctx.issueTooBig(str, "string", maxLength, lazyUtf8Len);
      }
    }
    let lazyGraphLen;
    const minGraphemes = this.options.minGraphemes;
    if (minGraphemes != null) {
      if (str.length < minGraphemes) {
        return ctx.issueTooSmall(str, "grapheme", minGraphemes, str.length);
      } else if ((lazyGraphLen ??= graphemeLen(str)) < minGraphemes) {
        return ctx.issueTooSmall(str, "grapheme", minGraphemes, lazyGraphLen);
      }
    }
    const maxGraphemes = this.options.maxGraphemes;
    if (maxGraphemes != null) {
      if (str.length <= maxGraphemes) ;
      else if ((lazyGraphLen ??= graphemeLen(str)) > maxGraphemes) {
        return ctx.issueTooBig(str, "grapheme", maxGraphemes, lazyGraphLen);
      }
    }
    const format2 = this.options.format;
    if (format2 != null && !/* @__PURE__ */ isStringFormat(str, format2, ctx.options)) {
      return ctx.issueInvalidFormat(str, format2);
    }
    return ctx.success(str);
  }
}
function coerceToString(input) {
  switch (typeof input) {
    // @NOTE We do *not* coerce numbers/booleans to strings because that can
    // lead to them being accepted as string instead of being coerced to
    // number/boolean when the input is a string and the expected result is
    // number/boolean (e.g. in params).
    case "string":
      return input;
    case "object": {
      if (input == null)
        return null;
      if (input instanceof TokenSchema) {
        return input.toString();
      }
      if (input instanceof Date) {
        if (Number.isNaN(input.getTime()))
          return null;
        return input.toISOString();
      }
      if (input instanceof URL) {
        return input.toString();
      }
      const cid = ifCid(input);
      if (cid)
        return cid.toString();
      if (input instanceof String) {
        return input.valueOf();
      }
    }
    // falls through
    default:
      return null;
  }
}
const string = /* @__PURE__ */ memoizedOptions((options = {}) => new StringSchema(options));
class NullableSchema extends Schema$1 {
  constructor(validator) {
    super();
    this.type = "nullable";
    this.validator = validator;
  }
  validateInContext(input, ctx) {
    if (input === null) {
      return ctx.success(null);
    }
    return ctx.validate(input, this.validator);
  }
}
const nullable = /* @__PURE__ */ memoizedTransformer((validator) => new NullableSchema(validator));
class OptionalSchema extends Schema$1 {
  constructor(validator) {
    super();
    this.type = "optional";
    this.validator = validator;
  }
  validateInContext(input, ctx) {
    if (input === void 0 && ctx.options.mode === "validate") {
      return ctx.success(input);
    }
    const result = ctx.validate(input, this.validator);
    if (result.success) {
      return result;
    }
    if (input === void 0) {
      return ctx.success(input);
    }
    return result;
  }
}
const optional = /* @__PURE__ */ memoizedTransformer((validator) => new OptionalSchema(validator));
class RefSchema extends Schema$1 {
  #getter;
  constructor(getter) {
    super();
    this.type = "ref";
    this.#getter = getter;
  }
  get validator() {
    return this.#getter.call(null);
  }
  unwrap() {
    return this.validator;
  }
  validateInContext(input, ctx) {
    return ctx.validate(input, this.validator);
  }
}
function ref(get) {
  return new RefSchema(get);
}
class UnionSchema extends Schema$1 {
  constructor(validators) {
    super();
    this.type = "union";
    this.validators = validators;
  }
  validateInContext(input, ctx) {
    const issues = [];
    for (const validator of this.validators) {
      const result = ctx.validate(input, validator);
      if (result.success)
        return result;
      issues.push(...result.issues);
    }
    return new LexValidationError(issues);
  }
}
// @__NO_SIDE_EFFECTS__
function union(validators) {
  return new UnionSchema(validators);
}
class WithDefaultSchema extends Schema$1 {
  constructor(validator, defaultValue) {
    super();
    this.type = "withDefault";
    this.validator = validator;
    this.defaultValue = defaultValue;
  }
  validateInContext(input, ctx) {
    if (input === void 0 && ctx.options.mode !== "validate") {
      return ctx.validate(this.defaultValue, this.validator);
    }
    return ctx.validate(input, this.validator);
  }
}
function withDefault(validator, defaultValue) {
  return new WithDefaultSchema(validator, defaultValue);
}
const paramScalarSchema = /* @__PURE__ */ union([
  boolean(),
  integer(),
  string()
]);
const paramSchema = /* @__PURE__ */ union([
  paramScalarSchema,
  array(boolean()),
  array(integer()),
  array(string())
]);
/* @__PURE__ */ dict(string(), optional(paramSchema));
class ParamsSchema extends Schema$1 {
  constructor(shape) {
    super();
    this.type = "params";
    this.shape = shape;
  }
  get shapeValidators() {
    const map2 = new Map(Object.entries(this.shape));
    return /* @__PURE__ */ lazyProperty(this, "shapeValidators", map2);
  }
  validateInContext(input, ctx) {
    if (!isPlainObject$1(input)) {
      return ctx.issueUnexpectedType(input, "object");
    }
    let copy;
    for (const key in input) {
      if (this.shapeValidators.has(key))
        continue;
      const result = ctx.validateChild(input, key, paramSchema);
      if (!result.success)
        return result;
      if (result.value !== input[key]) {
        if (ctx.options.mode === "validate") {
          return ctx.issueInvalidPropertyValue(input, key, [result.value]);
        }
        copy ??= { ...input };
        copy[key] = result.value;
      }
    }
    for (const [key, propDef] of this.shapeValidators) {
      const result = ctx.validateChild(input, key, propDef);
      if (!result.success) {
        if (!(key in input)) {
          return ctx.issueRequiredKey(input, key);
        }
        return result;
      }
      if (result.value === void 0 && !(key in input)) {
        continue;
      }
      if (!Object.is(result.value, input[key])) {
        if (ctx.options.mode === "validate") {
          return ctx.issueInvalidPropertyValue(input, key, [result.value]);
        }
        copy ??= { ...input };
        copy[key] = result.value;
      }
    }
    return ctx.success(copy ?? input);
  }
  fromURLSearchParams(input, options) {
    const params2 = {};
    const iterable = typeof input === "string" ? new URLSearchParams(input) : input;
    const entries = iterable instanceof URLSearchParams ? iterable.entries() : iterable;
    for (const [name, value] of entries) {
      if (!value)
        continue;
      const validator = this.shapeValidators.get(name);
      const innerValidator = validator ? unwrapSchema(validator) : void 0;
      const expectsArray = innerValidator instanceof ArraySchema;
      const scalarValidator = expectsArray ? unwrapSchema(innerValidator.validator) : innerValidator;
      const coerced = coerceParam(name, value, scalarValidator, options);
      const currentParam = params2[name];
      if (currentParam === void 0) {
        params2[name] = expectsArray ? [coerced] : coerced;
      } else if (Array.isArray(currentParam)) {
        currentParam.push(coerced);
      } else {
        params2[name] = [currentParam, coerced];
      }
    }
    return this.parse(params2, options);
  }
  toURLSearchParams(input) {
    const urlSearchParams = new URLSearchParams();
    const params2 = this.parse(input);
    for (const [key, value] of Object.entries(params2)) {
      if (Array.isArray(value)) {
        for (const v of value) {
          urlSearchParams.append(key, String(v));
        }
      } else if (value !== void 0) {
        urlSearchParams.append(key, String(value));
      }
    }
    return urlSearchParams;
  }
}
function coerceParam(name, param, schema, options) {
  let issue;
  if (!schema) {
    return param;
  } else if (schema instanceof StringSchema) {
    return param;
  } else if (schema instanceof IntegerSchema) {
    if (/^-?\d+$/.test(param))
      return Number(param);
    issue = new IssueInvalidType(paramPath(name, options), param, ["integer"]);
  } else if (schema instanceof BooleanSchema) {
    if (param === "true")
      return true;
    if (param === "false")
      return false;
    issue = new IssueInvalidType(paramPath(name, options), param, ["boolean"]);
  } else if (schema instanceof LiteralSchema) {
    const { value } = schema;
    if (String(value) === param)
      return value;
    issue = new IssueInvalidValue(paramPath(name, options), param, [value]);
  } else if (schema instanceof EnumSchema) {
    const { values } = schema;
    for (const value of values) {
      if (String(value) === param)
        return value;
    }
    issue = new IssueInvalidValue(paramPath(name, options), param, values);
  } else {
    throw new Error(`Unsupported schema type for param coercion: ${schema}`);
  }
  throw new LexValidationError([issue]);
}
function paramPath(key, options) {
  return options?.path ? [...options.path, key] : [key];
}
const params = /* @__PURE__ */ memoizedOptions((properties = {}) => new ParamsSchema(properties));
function unwrapSchema(schema) {
  while (schema instanceof OptionalSchema || schema instanceof WithDefaultSchema) {
    return unwrapSchema(schema.validator);
  }
  return schema;
}
class Payload {
  constructor(encoding, schema) {
    if (encoding === void 0 && schema !== void 0) {
      throw new TypeError("schema cannot be defined when encoding is undefined");
    }
    this.encoding = encoding;
    this.schema = schema;
  }
  /**
   * Checks whether the given content-type matches the expected payload schema's
   * encoding.
   */
  matchesEncoding(contentType) {
    const { encoding } = this;
    if (encoding === void 0) {
      return true;
    } else if (contentType == null) {
      return false;
    }
    if (encoding === "*/*") {
      return true;
    }
    const mime = contentType?.split(";", 1)[0].trim();
    if (encoding.endsWith("/*")) {
      return mime.startsWith(encoding.slice(0, -1));
    }
    if (encoding.includes("*")) {
      return false;
    }
    return encoding === mime;
  }
}
// @__NO_SIDE_EFFECTS__
function payload(encoding = void 0, validator = void 0) {
  return new Payload(encoding, validator);
}
// @__NO_SIDE_EFFECTS__
function jsonPayload(properties) {
  return /* @__PURE__ */ payload("application/json", /* @__PURE__ */ object(properties));
}
class Procedure {
  constructor(nsid, parameters, input, output, errors2) {
    this.type = "procedure";
    this.nsid = nsid;
    this.parameters = parameters;
    this.input = input;
    this.output = output;
    this.errors = errors2;
  }
}
// @__NO_SIDE_EFFECTS__
function procedure(nsid, parameters, input, output, errors2 = void 0) {
  return new Procedure(nsid, parameters, input, output, errors2);
}
class Query {
  constructor(nsid, parameters, output, errors2) {
    this.type = "query";
    this.nsid = nsid;
    this.parameters = parameters;
    this.output = output;
    this.errors = errors2;
  }
}
// @__NO_SIDE_EFFECTS__
function query(nsid, parameters, output, errors2 = void 0) {
  return new Query(nsid, parameters, output, errors2);
}
class RecordSchema extends Schema$1 {
  constructor(key, $type2, schema) {
    super();
    this.type = "record";
    this.key = key;
    this.$type = $type2;
    this.schema = schema;
    this.keySchema = recordKey(key);
  }
  validateInContext(input, ctx) {
    const result = ctx.validate(input, this.schema);
    if (!result.success) {
      return result;
    }
    if (result.value.$type !== this.$type) {
      return ctx.issueInvalidPropertyValue(result.value, "$type", [this.$type]);
    }
    return result;
  }
  build(input) {
    return $typed(input, this.$type);
  }
  isTypeOf(value) {
    return value.$type === this.$type;
  }
  /**
   * Bound alias for {@link build} for compatibility with generated utilities.
   * @see {@link build}
   */
  get $build() {
    return /* @__PURE__ */ lazyProperty(this, "$build", this.build.bind(this));
  }
  /**
   * Bound alias for {@link isTypeOf} for compatibility with generated utilities.
   * @see {@link isTypeOf}
   */
  get $isTypeOf() {
    return /* @__PURE__ */ lazyProperty(this, "$isTypeOf", this.isTypeOf.bind(this));
  }
}
const keySchema = string({ format: "record-key" });
const tidSchema = string({ format: "tid" });
const nsidSchema = string({ format: "nsid" });
const selfLiteralSchema = withDefault(/* @__PURE__ */ literal("self"), "self");
function recordKey(key) {
  if (key === "any")
    return keySchema;
  if (key === "tid")
    return tidSchema;
  if (key === "nsid")
    return nsidSchema;
  if (key.startsWith("literal:")) {
    const value = key.slice(8);
    if (value === "self")
      return selfLiteralSchema;
    return withDefault(/* @__PURE__ */ literal(value), value);
  }
  throw new Error(`Unsupported record key type: ${key}`);
}
// @__NO_SIDE_EFFECTS__
function record(key, type, validator) {
  return new RecordSchema(key, type, validator);
}
class TypedObjectSchema extends Schema$1 {
  constructor($type2, schema) {
    super();
    this.type = "typedObject";
    this.$type = $type2;
    this.schema = schema;
  }
  validateInContext(input, ctx) {
    if (!isPlainObject$1(input)) {
      return ctx.issueUnexpectedType(input, "object");
    }
    if ("$type" in input && input.$type !== void 0 && input.$type !== this.$type) {
      return ctx.issueInvalidPropertyValue(input, "$type", [this.$type]);
    }
    return ctx.validate(input, this.schema);
  }
  build(input) {
    return $typed(input, this.$type);
  }
  isTypeOf(value) {
    return value.$type === void 0 || value.$type === this.$type;
  }
  /**
   * Bound alias for {@link build} for compatibility with generated utilities.
   * @see {@link build}
   */
  get $build() {
    return /* @__PURE__ */ lazyProperty(this, "$build", this.build.bind(this));
  }
  /**
   * Bound alias for {@link isTypeOf} for compatibility with generated utilities.
   * @see {@link isTypeOf}
   */
  get $isTypeOf() {
    return /* @__PURE__ */ lazyProperty(this, "$isTypeOf", this.isTypeOf.bind(this));
  }
}
// @__NO_SIDE_EFFECTS__
function typedObject(nsid, hash, validator) {
  return new TypedObjectSchema(/* @__PURE__ */ $type(nsid, hash), validator);
}
class TypedRefSchema extends Schema$1 {
  #getter;
  constructor(getter) {
    super();
    this.type = "typedRef";
    this.#getter = getter;
  }
  get validator() {
    return this.#getter.call(null);
  }
  get $type() {
    return this.validator.$type;
  }
  validateInContext(input, ctx) {
    const result = ctx.validate(input, this.validator);
    if (!result.success)
      return result;
    if (result.value.$type !== this.$type) {
      return ctx.issueInvalidPropertyValue(result.value, "$type", [this.$type]);
    }
    return result;
  }
}
function typedRef(get) {
  return new TypedRefSchema(get);
}
class TypedUnionSchema extends Schema$1 {
  constructor(validators, closed) {
    super();
    this.type = "typedUnion";
    this.validators = validators;
    this.closed = closed;
  }
  get validatorsMap() {
    const map2 = /* @__PURE__ */ new Map();
    for (const ref2 of this.validators)
      map2.set(ref2.$type, ref2);
    return /* @__PURE__ */ lazyProperty(this, "validatorsMap", map2);
  }
  get $types() {
    return Array.from(this.validatorsMap.keys());
  }
  validateInContext(input, ctx) {
    if (!isPlainObject$1(input) || !("$type" in input)) {
      return ctx.issueUnexpectedType(input, "$typed");
    }
    const { $type: $type2 } = input;
    const validator = this.validatorsMap.get($type2);
    if (validator) {
      return ctx.validate(input, validator);
    }
    if (this.closed) {
      return ctx.issueInvalidPropertyValue(input, "$type", this.$types);
    }
    if (typeof $type2 !== "string") {
      return ctx.issueInvalidPropertyType(input, "$type", "string");
    }
    return ctx.success(input);
  }
}
// @__NO_SIDE_EFFECTS__
function typedUnion(refs, closed) {
  return new TypedUnionSchema(refs, closed);
}
function getMain(ns) {
  return "main" in ns ? ns.main : ns;
}
const lexErrorDataSchema = /* @__PURE__ */ object({
  // type name of the error (generic ASCII constant, no whitespace)
  error: /* @__PURE__ */ regexp(/^[\w_-]+$/, "Expected ASCII constant with no whitespace"),
  // description of the error, appropriate for display to humans
  message: optional(string())
});
const $nsid$8 = "com.atproto.repo.defs";
const commitMeta = /* @__PURE__ */ typedObject(
  $nsid$8,
  "commitMeta",
  /* @__PURE__ */ object({
    cid: /* @__PURE__ */ string({ format: "cid" }),
    rev: /* @__PURE__ */ string({ format: "tid" })
  })
);
const $nsid$7 = "com.atproto.repo.applyWrites";
const $params$7 = /* @__PURE__ */ params();
const $input$4 = /* @__PURE__ */ jsonPayload({
  repo: /* @__PURE__ */ string({ format: "at-identifier" }),
  validate: /* @__PURE__ */ optional(/* @__PURE__ */ boolean()),
  writes: /* @__PURE__ */ array(
    /* @__PURE__ */ typedUnion([
      /* @__PURE__ */ typedRef((() => create)),
      /* @__PURE__ */ typedRef((() => update)),
      /* @__PURE__ */ typedRef((() => delete$0))
    ], true)
  ),
  swapCommit: /* @__PURE__ */ optional(
    /* @__PURE__ */ string({ format: "cid" })
  )
});
const $output$7 = /* @__PURE__ */ jsonPayload({
  commit: /* @__PURE__ */ optional(
    /* @__PURE__ */ ref((() => commitMeta))
  ),
  results: /* @__PURE__ */ optional(
    /* @__PURE__ */ array(
      /* @__PURE__ */ typedUnion([
        /* @__PURE__ */ typedRef((() => createResult)),
        /* @__PURE__ */ typedRef((() => updateResult)),
        /* @__PURE__ */ typedRef((() => deleteResult))
      ], true)
    )
  )
});
const main$7 = /* @__PURE__ */ procedure($nsid$7, $params$7, $input$4, $output$7, [
  "InvalidSwap"
]);
const create = /* @__PURE__ */ typedObject(
  $nsid$7,
  "create",
  /* @__PURE__ */ object({
    collection: /* @__PURE__ */ string({ format: "nsid" }),
    rkey: /* @__PURE__ */ optional(
      /* @__PURE__ */ string({ maxLength: 512, format: "record-key" })
    ),
    value: /* @__PURE__ */ lexMap()
  })
);
const update = /* @__PURE__ */ typedObject(
  $nsid$7,
  "update",
  /* @__PURE__ */ object({
    collection: /* @__PURE__ */ string({ format: "nsid" }),
    rkey: /* @__PURE__ */ string({ format: "record-key" }),
    value: /* @__PURE__ */ lexMap()
  })
);
const delete$0 = /* @__PURE__ */ typedObject(
  $nsid$7,
  "delete",
  /* @__PURE__ */ object({
    collection: /* @__PURE__ */ string({ format: "nsid" }),
    rkey: /* @__PURE__ */ string({ format: "record-key" })
  })
);
const createResult = /* @__PURE__ */ typedObject(
  $nsid$7,
  "createResult",
  /* @__PURE__ */ object({
    uri: /* @__PURE__ */ string({ format: "at-uri" }),
    cid: /* @__PURE__ */ string({ format: "cid" }),
    validationStatus: /* @__PURE__ */ optional(
      /* @__PURE__ */ string()
    )
  })
);
const updateResult = /* @__PURE__ */ typedObject(
  $nsid$7,
  "updateResult",
  /* @__PURE__ */ object({
    uri: /* @__PURE__ */ string({ format: "at-uri" }),
    cid: /* @__PURE__ */ string({ format: "cid" }),
    validationStatus: /* @__PURE__ */ optional(
      /* @__PURE__ */ string()
    )
  })
);
const deleteResult = /* @__PURE__ */ typedObject(
  $nsid$7,
  "deleteResult",
  /* @__PURE__ */ object({})
);
const $nsid$6 = "com.atproto.repo.createRecord";
const $params$6 = /* @__PURE__ */ params();
const $input$3 = /* @__PURE__ */ jsonPayload({
  repo: /* @__PURE__ */ string({ format: "at-identifier" }),
  collection: /* @__PURE__ */ string({ format: "nsid" }),
  rkey: /* @__PURE__ */ optional(
    /* @__PURE__ */ string({ format: "record-key", maxLength: 512 })
  ),
  validate: /* @__PURE__ */ optional(/* @__PURE__ */ boolean()),
  record: /* @__PURE__ */ lexMap(),
  swapCommit: /* @__PURE__ */ optional(
    /* @__PURE__ */ string({ format: "cid" })
  )
});
const $output$6 = /* @__PURE__ */ jsonPayload({
  uri: /* @__PURE__ */ string({ format: "at-uri" }),
  cid: /* @__PURE__ */ string({ format: "cid" }),
  commit: /* @__PURE__ */ optional(
    /* @__PURE__ */ ref((() => commitMeta))
  ),
  validationStatus: /* @__PURE__ */ optional(
    /* @__PURE__ */ string()
  )
});
const main$6 = /* @__PURE__ */ procedure($nsid$6, $params$6, $input$3, $output$6, [
  "InvalidSwap"
]);
const $nsid$5 = "com.atproto.repo.deleteRecord";
const $params$5 = /* @__PURE__ */ params();
const $input$2 = /* @__PURE__ */ jsonPayload({
  repo: /* @__PURE__ */ string({ format: "at-identifier" }),
  collection: /* @__PURE__ */ string({ format: "nsid" }),
  rkey: /* @__PURE__ */ string({ format: "record-key" }),
  swapRecord: /* @__PURE__ */ optional(
    /* @__PURE__ */ string({ format: "cid" })
  ),
  swapCommit: /* @__PURE__ */ optional(
    /* @__PURE__ */ string({ format: "cid" })
  )
});
const $output$5 = /* @__PURE__ */ jsonPayload({
  commit: /* @__PURE__ */ optional(
    /* @__PURE__ */ ref((() => commitMeta))
  )
});
const main$5 = /* @__PURE__ */ procedure($nsid$5, $params$5, $input$2, $output$5, [
  "InvalidSwap"
]);
const $nsid$4 = "com.atproto.repo.getRecord";
const $params$4 = /* @__PURE__ */ params({
  repo: /* @__PURE__ */ string({ format: "at-identifier" }),
  collection: /* @__PURE__ */ string({ format: "nsid" }),
  rkey: /* @__PURE__ */ string({ format: "record-key" }),
  cid: /* @__PURE__ */ optional(/* @__PURE__ */ string({ format: "cid" }))
});
const $output$4 = /* @__PURE__ */ jsonPayload({
  uri: /* @__PURE__ */ string({ format: "at-uri" }),
  cid: /* @__PURE__ */ optional(/* @__PURE__ */ string({ format: "cid" })),
  value: /* @__PURE__ */ lexMap()
});
const main$4 = /* @__PURE__ */ query($nsid$4, $params$4, $output$4, ["RecordNotFound"]);
const $nsid$3 = "com.atproto.repo.listRecords";
const $params$3 = /* @__PURE__ */ params({
  repo: /* @__PURE__ */ string({ format: "at-identifier" }),
  collection: /* @__PURE__ */ string({ format: "nsid" }),
  limit: /* @__PURE__ */ optional(
    /* @__PURE__ */ withDefault(
      /* @__PURE__ */ integer({ minimum: 1, maximum: 100 }),
      50
    )
  ),
  cursor: /* @__PURE__ */ optional(/* @__PURE__ */ string()),
  reverse: /* @__PURE__ */ optional(/* @__PURE__ */ boolean())
});
const $output$3 = /* @__PURE__ */ jsonPayload({
  cursor: /* @__PURE__ */ optional(/* @__PURE__ */ string()),
  records: /* @__PURE__ */ array(
    /* @__PURE__ */ ref((() => record$0))
  )
});
const main$3 = /* @__PURE__ */ query($nsid$3, $params$3, $output$3);
const record$0 = /* @__PURE__ */ typedObject(
  $nsid$3,
  "record",
  /* @__PURE__ */ object({
    uri: /* @__PURE__ */ string({ format: "at-uri" }),
    cid: /* @__PURE__ */ string({ format: "cid" }),
    value: /* @__PURE__ */ lexMap()
  })
);
const $nsid$2 = "com.atproto.repo.putRecord";
const $params$2 = /* @__PURE__ */ params();
const $input$1 = /* @__PURE__ */ jsonPayload({
  repo: /* @__PURE__ */ string({ format: "at-identifier" }),
  collection: /* @__PURE__ */ string({ format: "nsid" }),
  rkey: /* @__PURE__ */ string({ format: "record-key", maxLength: 512 }),
  validate: /* @__PURE__ */ optional(/* @__PURE__ */ boolean()),
  record: /* @__PURE__ */ lexMap(),
  swapRecord: /* @__PURE__ */ optional(
    /* @__PURE__ */ nullable(/* @__PURE__ */ string({ format: "cid" }))
  ),
  swapCommit: /* @__PURE__ */ optional(
    /* @__PURE__ */ string({ format: "cid" })
  )
});
const $output$2 = /* @__PURE__ */ jsonPayload({
  uri: /* @__PURE__ */ string({ format: "at-uri" }),
  cid: /* @__PURE__ */ string({ format: "cid" }),
  commit: /* @__PURE__ */ optional(
    /* @__PURE__ */ ref((() => commitMeta))
  ),
  validationStatus: /* @__PURE__ */ optional(
    /* @__PURE__ */ string()
  )
});
const main$2 = /* @__PURE__ */ procedure($nsid$2, $params$2, $input$1, $output$2, [
  "InvalidSwap"
]);
const $nsid$1 = "com.atproto.repo.uploadBlob";
const $params$1 = /* @__PURE__ */ params();
const $input = /* @__PURE__ */ payload("*/*");
const $output$1 = /* @__PURE__ */ jsonPayload({
  blob: /* @__PURE__ */ blob()
});
const main$1 = /* @__PURE__ */ procedure($nsid$1, $params$1, $input, $output$1);
const $nsid = "com.atproto.sync.getBlob";
const $params = /* @__PURE__ */ params({
  did: /* @__PURE__ */ string({ format: "did" }),
  cid: /* @__PURE__ */ string({ format: "cid" })
});
const $output = /* @__PURE__ */ payload("*/*");
const main = /* @__PURE__ */ query($nsid, $params, $output, [
  "BlobNotFound",
  "RepoNotFound",
  "RepoTakendown",
  "RepoSuspended",
  "RepoDeactivated"
]);
const isService = (value) => {
  const hashIndex = value.indexOf("#");
  if (hashIndex < 7)
    return false;
  if (hashIndex > value.length - 3)
    return false;
  if (value.includes("#", hashIndex + 1))
    return false;
  const did = value.slice(0, hashIndex);
  return isDidString(did);
};
function isEncodingString(contentType) {
  return contentType.includes("/");
}
class WriteOperationHelper {
  constructor() {
  }
  create(ns, input, options = {}) {
    const schema = getMain(ns);
    const value = schema.build(input);
    return create.$build({
      collection: schema.$type,
      value,
      rkey: options?.rkey ?? getDefaultRecordKey(schema)
    });
  }
  update(ns, input, options = {}) {
    const schema = getMain(ns);
    const value = schema.build(input);
    return update.$build({
      collection: schema.$type,
      value,
      rkey: options?.rkey ?? getLiteralRecordKey(schema)
    });
  }
  delete(ns, options = {}) {
    const schema = getMain(ns);
    return delete$0.$build({
      collection: schema.$type,
      rkey: options?.rkey ?? getLiteralRecordKey(schema)
    });
  }
  static build(factory) {
    return Array.from(factory(new WriteOperationHelper()));
  }
}
function parseLexBytes(input) {
  if (!input || !("$bytes" in input)) {
    return void 0;
  }
  for (const key in input) {
    if (key !== "$bytes") {
      return void 0;
    }
  }
  if (typeof input.$bytes !== "string") {
    return void 0;
  }
  try {
    return fromBase64(input.$bytes);
  } catch {
    return void 0;
  }
}
function encodeLexBytes(bytes) {
  return { $bytes: toBase64(bytes) };
}
function parseLexLink(input, options) {
  if (!input || !("$link" in input)) {
    return void 0;
  }
  for (const key in input) {
    if (key !== "$link") {
      return void 0;
    }
  }
  const { $link } = input;
  if (typeof $link !== "string") {
    return void 0;
  }
  if ($link.length === 0) {
    return void 0;
  }
  if ($link.length > 2048) {
    return void 0;
  }
  try {
    return parseCid($link, options);
  } catch {
    return void 0;
  }
}
function encodeLexLink(cid) {
  return { $link: cid.toString() };
}
function parseTypedBlobRef(input, options) {
  if (input.$type !== "blob")
    return void 0;
  const ref2 = input?.ref;
  if (!ref2 || typeof ref2 !== "object")
    return void 0;
  if ("$link" in ref2) {
    const cid = parseLexLink(ref2);
    if (!cid)
      return void 0;
    const blob2 = { ...input, ref: cid };
    if (isTypedBlobRef(blob2, options))
      return blob2;
  }
  if (isTypedBlobRef(input)) {
    return input;
  }
  return void 0;
}
function lexStringify(input) {
  return JSON.stringify(lexToJson(input));
}
function jsonToLex(value, options = { strict: false }) {
  switch (typeof value) {
    case "object": {
      if (value === null)
        return null;
      if (Array.isArray(value))
        return jsonArrayToLex(value, options);
      return parseSpecialJsonObject(value, options) ?? jsonObjectToLexMap(value, options);
    }
    case "number":
      if (Number.isSafeInteger(value))
        return value;
      if (options.strict === false)
        return value;
      throw new TypeError(`Invalid non-integer number: ${value}`);
    case "boolean":
    case "string":
      return value;
    default:
      throw new TypeError(`Invalid JSON value: ${typeof value}`);
  }
}
function jsonArrayToLex(input, options) {
  let copy;
  for (let i = 0; i < input.length; i++) {
    const inputItem = input[i];
    const item = jsonToLex(inputItem, options);
    if (item !== inputItem) {
      copy ??= Array.from(input);
      copy[i] = item;
    }
  }
  return copy ?? input;
}
function jsonObjectToLexMap(input, options) {
  let copy = void 0;
  for (const [key, jsonValue] of Object.entries(input)) {
    if (key === "__proto__") {
      throw new TypeError("Invalid key: __proto__");
    }
    if (jsonValue === void 0) {
      copy ??= { ...input };
      delete copy[key];
      continue;
    }
    const value = jsonToLex(jsonValue, options);
    if (value !== jsonValue) {
      copy ??= { ...input };
      copy[key] = value;
    }
  }
  return copy ?? input;
}
function lexToJson(value) {
  switch (typeof value) {
    case "object":
      if (value === null) {
        return value;
      } else if (Array.isArray(value)) {
        return lexArrayToJson(value);
      } else if (isCid(value)) {
        return encodeLexLink(value);
      } else if (ArrayBuffer.isView(value)) {
        return encodeLexBytes(value);
      } else {
        return encodeLexMap(value);
      }
    case "boolean":
    case "string":
    case "number":
      return value;
    default:
      throw new TypeError(`Invalid Lex value: ${typeof value}`);
  }
}
function lexArrayToJson(input) {
  let copy;
  for (let i = 0; i < input.length; i++) {
    const inputItem = input[i];
    const item = lexToJson(inputItem);
    if (item !== inputItem) {
      copy ??= Array.from(input);
      copy[i] = item;
    }
  }
  return copy ?? input;
}
function encodeLexMap(input) {
  let copy = void 0;
  for (const [key, lexValue2] of Object.entries(input)) {
    if (key === "__proto__") {
      throw new TypeError("Invalid key: __proto__");
    }
    if (lexValue2 === void 0) {
      copy ??= { ...input };
      delete copy[key];
      continue;
    }
    const jsonValue = lexToJson(lexValue2);
    if (jsonValue !== lexValue2) {
      copy ??= { ...input };
      copy[key] = jsonValue;
    }
  }
  return copy ?? input;
}
function parseSpecialJsonObject(input, options) {
  if (input.$link !== void 0) {
    const cid = parseLexLink(input);
    if (cid)
      return cid;
    if (options.strict)
      throw new TypeError(`Invalid $link object`);
  } else if (input.$bytes !== void 0) {
    const bytes = parseLexBytes(input);
    if (bytes)
      return bytes;
    if (options.strict)
      throw new TypeError(`Invalid $bytes object`);
  } else if (input.$type !== void 0) {
    if (options.strict) {
      if (input.$type === "blob") {
        const blob2 = parseTypedBlobRef(input, options);
        if (blob2)
          return blob2;
        throw new TypeError(`Invalid blob object`);
      } else if (typeof input.$type !== "string") {
        throw new TypeError(`Invalid $type property (${typeof input.$type})`);
      } else if (input.$type.length === 0) {
        throw new TypeError(`Empty $type property`);
      }
    }
  }
  return void 0;
}
function parseWWWAuthenticateHeader(header) {
  if (typeof header !== "string")
    return void 0;
  const wwwAuthenticate = {};
  const trimmedHeader = header.trim();
  if (!trimmedHeader)
    return wwwAuthenticate;
  const parts = trimmedHeader.split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/);
  let currentParams = null;
  for (let part of parts) {
    const schemeMatch = part.trim().match(/^([^"=\s]+)(\s+.*)?$/);
    if (schemeMatch) {
      const scheme = schemeMatch[1];
      if (Object.hasOwn(wwwAuthenticate, scheme))
        return void 0;
      const rest = schemeMatch[2]?.trim();
      if (!rest) {
        currentParams = null;
        wwwAuthenticate[scheme] = /* @__PURE__ */ Object.create(null);
        continue;
      }
      if (!rest.includes("=")) {
        currentParams = null;
        wwwAuthenticate[scheme] = rest;
        continue;
      }
      currentParams = /* @__PURE__ */ Object.create(null);
      wwwAuthenticate[scheme] = currentParams;
      part = rest;
    }
    if (!currentParams)
      return void 0;
    const param = part.match(/^\s*([^"\s=]+)=(?:("[^"\\]*(?:\\.[^"\\]*)*")|([^\s,"]*))\s*$/);
    if (!param)
      return void 0;
    const paramName = param[1];
    const paramValue = param[3] ?? param[2].slice(1, -1).replaceAll(/\\(.)/g, "$1");
    currentParams[paramName] = paramValue;
  }
  return wwwAuthenticate;
}
const StatusErrorCodes = /* @__PURE__ */ new Map([
  [400, "InvalidRequest"],
  [401, "AuthenticationRequired"],
  [403, "Forbidden"],
  [404, "XRPCNotSupported"],
  [406, "NotAcceptable"],
  [413, "PayloadTooLarge"],
  [415, "UnsupportedMediaType"],
  [429, "RateLimitExceeded"],
  [500, "InternalServerError"],
  [501, "MethodNotImplemented"],
  [502, "UpstreamFailure"],
  [503, "NotEnoughResources"],
  [504, "UpstreamTimeout"]
]);
const RETRYABLE_HTTP_STATUS_CODES = /* @__PURE__ */ new Set([
  408,
  425,
  429,
  500,
  502,
  503,
  504,
  522,
  524
]);
function isXrpcErrorPayload(payload2) {
  return payload2 != null && payload2.encoding === "application/json" && lexErrorDataSchema.matches(payload2.body);
}
class XrpcError extends LexError {
  constructor(method, error2, message = `${error2} Lexicon RPC error`, options) {
    super(error2, message, options);
    this.method = method;
    this.name = "XrpcError";
    this.success = false;
  }
  matchesSchemaErrors() {
    return this.method.errors?.includes(this.error) ?? false;
  }
}
class XrpcResponseError extends XrpcError {
  constructor(method, response, payload2, options) {
    const { error: error2, message } = isXrpcErrorPayload(payload2) ? payload2.body : {
      error: StatusErrorCodes.get(response.status) ?? (response.status >= 500 ? "UpstreamFailure" : "InvalidRequest"),
      message: buildResponseOverviewMessage(response)
    };
    super(method, error2, message, options);
    this.response = response;
    this.payload = payload2;
    this.name = "XrpcResponseError";
  }
  get reason() {
    return this;
  }
  shouldRetry() {
    return RETRYABLE_HTTP_STATUS_CODES.has(this.response.status);
  }
  toJSON() {
    const { payload: payload2 } = this;
    if (isXrpcErrorPayload(payload2)) {
      return payload2.body;
    }
    return super.toJSON();
  }
  toDownstreamError() {
    const { status, headers } = this.response;
    return {
      status: status === 500 ? 502 : status,
      headers: stripHopByHopHeaders(headers),
      body: this.toJSON()
    };
  }
  get status() {
    return this.response.status;
  }
  get headers() {
    return this.response.headers;
  }
  get body() {
    return this.payload?.body;
  }
}
class XrpcAuthenticationError extends XrpcResponseError {
  constructor() {
    super(...arguments);
    this.name = "XrpcAuthenticationError";
  }
  shouldRetry() {
    return false;
  }
  #wwwAuthenticateCached;
  /**
   * Parsed WWW-Authenticate header from the response.
   * Contains authentication scheme parameters (e.g., Bearer realm, DPoP nonce).
   */
  get wwwAuthenticate() {
    return this.#wwwAuthenticateCached ??= parseWWWAuthenticateHeader(this.response.headers.get("www-authenticate")) ?? {};
  }
}
class XrpcInvalidResponseError extends XrpcError {
  constructor(method, response, payload2, message = buildResponseOverviewMessage(response), options) {
    super(method, "InvalidResponse", message, options);
    this.response = response;
    this.payload = payload2;
    this.name = "XrpcInvalidResponseError";
  }
  get reason() {
    return this;
  }
  shouldRetry() {
    return RETRYABLE_HTTP_STATUS_CODES.has(this.response.status);
  }
  toDownstreamError() {
    return { status: 502, body: this.toJSON() };
  }
}
class XrpcResponseValidationError extends XrpcInvalidResponseError {
  constructor(method, response, payload2, cause) {
    super(method, response, payload2, `Invalid response payload: ${cause.message}`, { cause });
    this.cause = cause;
    this.name = "XrpcResponseValidationError";
  }
}
class XrpcInternalError extends XrpcError {
  constructor(method, message, options) {
    super(method, "InternalServerError", message ?? "Unable to fulfill XRPC request", options);
    this.name = "XrpcInternalError";
  }
  get reason() {
    return this;
  }
  shouldRetry() {
    return false;
  }
  toJSON() {
    return { error: this.error, message: "Internal Server Error" };
  }
  toDownstreamError() {
    return { status: 500, body: this.toJSON() };
  }
}
class XrpcFetchError extends XrpcInternalError {
  constructor(method, cause) {
    const message = cause instanceof Error ? cause.message : String(cause);
    super(method, `Unexpected fetchHandler() error: ${message}`, { cause });
    this.name = "XrpcFetchError";
  }
  shouldRetry() {
    return true;
  }
  toJSON() {
    return { error: this.error, message: "Failed to perform upstream request" };
  }
  toDownstreamError() {
    return { status: 502, body: this.toJSON() };
  }
}
function asXrpcFailure(method, cause) {
  if (cause instanceof XrpcResponseError || cause instanceof XrpcInvalidResponseError || cause instanceof XrpcInternalError) {
    if (cause.method === method)
      return cause;
  }
  return new XrpcInternalError(method, void 0, { cause });
}
const HOP_BY_HOP_HEADERS = /* @__PURE__ */ new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade"
]);
function stripHopByHopHeaders(headers) {
  const result = new Headers(headers);
  for (const name of HOP_BY_HOP_HEADERS) {
    result.delete(name);
  }
  const connection = headers.get("connection");
  if (connection) {
    for (const name of connection.split(",")) {
      result.delete(name.trim());
    }
  }
  result.delete("content-length");
  result.delete("content-encoding");
  return result;
}
function buildResponseOverviewMessage(response) {
  if (response.status < 400) {
    return `Upstream server responded with an invalid status code (${response.status})`;
  }
  return `Upstream server responded with a ${response.status} error`;
}
const CONTENT_TYPE_BINARY = "application/octet-stream";
const CONTENT_TYPE_JSON = "application/json";
class XrpcResponse {
  /** @see {@link ResultSuccess.value} */
  get value() {
    return this;
  }
  constructor(method, status, headers, payload2) {
    this.method = method;
    this.status = status;
    this.headers = headers;
    this.payload = payload2;
    this.success = true;
  }
  /**
   * Whether the response payload was parsed as {@link LexValue} (`true`) or is
   * in binary form {@link Uint8Array} (`false`).
   */
  get isParsed() {
    return this.method.output.encoding === CONTENT_TYPE_JSON;
  }
  /**
   * The Content-Type encoding of the response (e.g., 'application/json').
   * Returns `undefined` if the response has no body.
   */
  get encoding() {
    return this.payload?.encoding;
  }
  /**
   * The parsed response body.
   *
   * For 'application/json' responses, this is the parsed and validated LexValue.
   * For binary responses, this is a Uint8Array.
   * Returns `undefined` if the response has no body.
   */
  get body() {
    return this.payload?.body;
  }
  /**
   * @throws {XrpcResponseError} in case of (valid) XRPC error responses. Use
   * {@link XrpcResponseError.matchesSchemaErrors} to narrow the error type based on
   * the method's declared error schema. This can be narrowed further as a
   * {@link XrpcAuthenticationError} if the error is an authentication error.
   * @throws {XrpcInvalidResponseError} when the response is not a valid XRPC
   * response, or if the response does not conform to the method's schema.
   */
  static async fromFetchResponse(method, response, options) {
    if (response.status >= 400) {
      const payload3 = await readPayload(method, response, {
        // Always parse errors in non-strict mode
        parse: { strict: false }
      });
      if (response.status === 401) {
        throw new XrpcAuthenticationError(method, response, payload3);
      }
      throw new XrpcResponseError(method, response, payload3);
    }
    if (response.status < 200 || response.status >= 300) {
      await response.body?.cancel();
      throw new XrpcInvalidResponseError(method, response, void 0, `Unexpected status code ${response.status}`);
    }
    const payload2 = await readPayload(method, response, {
      // Parse response if there is a schema, or if the encoding is
      // "application/json"
      parse: method.output.schema || method.output.encoding === CONTENT_TYPE_JSON ? { strict: options?.strictResponseProcessing ?? true } : (
        // If there is no declared output encoding, we'll parse the output (in loose mode)
        method.output.encoding == null ? { strict: false } : false
      )
    });
    if (!method.output.matchesEncoding(payload2?.encoding)) {
      throw new XrpcInvalidResponseError(method, response, payload2, `Expected ${stringifyEncoding(method.output.encoding)} response (got ${stringifyEncoding(payload2?.encoding)})`);
    }
    if (method.output.encoding != null) {
      if (!payload2)
        throw new Error("Expected payload");
      if (method.output.schema && options?.validateResponse !== false) {
        const result = method.output.schema.safeParse(payload2.body, {
          strict: options?.strictResponseProcessing ?? true
        });
        if (!result.success) {
          throw new XrpcResponseValidationError(method, response, payload2, result.reason);
        }
        const parsedPayload = {
          body: result.value,
          encoding: payload2.encoding
        };
        return new XrpcResponse(method, response.status, response.headers, parsedPayload);
      }
    }
    return new XrpcResponse(method, response.status, response.headers, payload2);
  }
}
async function readPayload(method, response, options) {
  try {
    const encoding = response.headers.get("content-type")?.split(";")[0].trim().toLowerCase();
    if (!encoding) {
      const arrayBuffer2 = await response.arrayBuffer();
      if (arrayBuffer2.byteLength === 0)
        return void 0;
      return {
        encoding: CONTENT_TYPE_BINARY,
        body: new Uint8Array(arrayBuffer2)
      };
    }
    if (!isEncodingString(encoding)) {
      throw new TypeError(`Invalid content-type "${encoding}" in response`);
    }
    if (options?.parse && encoding === CONTENT_TYPE_JSON) {
      const json = await response.json();
      const body = jsonToLex(json, options.parse);
      return { encoding, body };
    }
    const arrayBuffer = await response.arrayBuffer();
    return { encoding, body: new Uint8Array(arrayBuffer) };
  } catch (cause) {
    const message = "Unable to parse response payload";
    const messageDetail = cause instanceof TypeError ? cause.message : void 0;
    throw new XrpcInvalidResponseError(method, response, void 0, messageDetail ? `${message}: ${messageDetail}` : message, { cause });
  }
}
function stringifyEncoding(encoding) {
  return encoding ? `"${encoding}"` : "no payload";
}
async function xrpc(agentOpts, ns, options = {}) {
  const response = await xrpcSafe(agentOpts, ns, options);
  if (response.success)
    return response;
  else
    throw response;
}
async function xrpcSafe(agentOpts, ns, options = {}) {
  const method = getMain(ns);
  for (let counter = 1; ; counter++) {
    throwIfAborted(options.signal);
    try {
      const agent = buildAgent(agentOpts);
      const url = xrpcRequestUrl(method, options);
      const request = xrpcRequestInit(method, options);
      const response = await agent.fetchHandler(url, request).catch((err) => {
        const cause = extractFetchErrorCause(err);
        throw new XrpcFetchError(method, cause);
      });
      return await XrpcResponse.fromFetchResponse(method, response, options);
    } catch (cause) {
      const failure2 = asXrpcFailure(method, cause);
      if (options.body instanceof ReadableStream || isAsyncIterable(options.body)) {
        return failure2;
      }
      const waitTime = getRetryWaitTime(failure2, options, counter);
      if (waitTime == null) {
        return failure2;
      }
      await wait(waitTime, options);
    }
  }
}
function xrpcRequestUrl(method, options) {
  const path = `/xrpc/${method.nsid}`;
  const queryString = method.parameters?.toURLSearchParams(options.params ?? {}).toString();
  return queryString ? `${path}?${queryString}` : path;
}
function xrpcRequestInit(schema, options) {
  const headers = buildXrpcRequestHeaders(options);
  if (schema.output.encoding) {
    headers.set("accept", schema.output.encoding);
  }
  if (headers.has("content-type")) {
    const contentType = headers.get("content-type");
    throw new TypeError(`Unexpected content-type header (${contentType})`);
  }
  if ("input" in schema) {
    const encodingHint = options.encoding;
    const input = xrpcProcedureInput(schema, options, encodingHint);
    if (input) {
      headers.set("content-type", input.encoding);
    } else if (encodingHint != null) {
      throw new TypeError(`Unexpected encoding hint (${encodingHint})`);
    }
    return {
      duplex: "half",
      redirect: "follow",
      referrerPolicy: "strict-origin-when-cross-origin",
      // (default)
      mode: "cors",
      // (default)
      signal: options.signal,
      method: "POST",
      headers,
      body: input?.body
    };
  }
  return {
    duplex: "half",
    redirect: "follow",
    referrerPolicy: "strict-origin-when-cross-origin",
    // (default)
    mode: "cors",
    // (default)
    signal: options.signal,
    method: "GET",
    headers
  };
}
function xrpcProcedureInput(method, options, encodingHint) {
  const { input } = method;
  const { body } = options;
  if (options.validateRequest) {
    input.schema?.check(body);
  }
  if (input.encoding === "application/json") {
    if (!isLexScalar(body) && !isPlainObject$1(body) && !Array.isArray(body)) {
      throw new TypeError(`Expected LexValue body, got ${typeof body}`);
    }
    return buildPayload(input, lexStringify(body), encodingHint);
  }
  switch (typeof body) {
    case "undefined":
    case "string":
      return buildPayload(input, body, encodingHint);
    case "object": {
      if (body === null)
        break;
      if (ArrayBuffer.isView(body)) {
        return buildPayload(input, asUint8ArrayArrayBuffer(body), encodingHint);
      } else if (body instanceof ArrayBuffer || body instanceof ReadableStream) {
        return buildPayload(input, body, encodingHint);
      } else if (isAsyncIterable(body)) {
        return buildPayload(input, toReadableStream(body), encodingHint);
      } else if (isBlobLike(body)) {
        return buildPayload(input, body, encodingHint || body.type);
      }
    }
  }
  throw new TypeError(`Invalid ${typeof body} body for ${input.encoding} encoding`);
}
function buildPayload(schema, body, encodingHint) {
  if (schema.encoding === void 0) {
    if (body !== void 0) {
      throw new TypeError(`Endpoint expects no payload`);
    }
    return null;
  }
  if (body === void 0) {
    throw new TypeError(`A request body is expected but none was provided`);
  }
  const encoding = buildEncoding(schema, encodingHint);
  return { encoding, body };
}
function buildEncoding(schema, encodingHint) {
  if (!schema.encoding) {
    throw new TypeError("Unexpected payload");
  }
  if (encodingHint?.length) {
    if (!schema.matchesEncoding(encodingHint)) {
      throw new TypeError(`Cannot send a body with content-type "${encodingHint}" for "${schema.encoding}" encoding`);
    }
    return encodingHint;
  }
  if (schema.encoding === "*/*") {
    return "application/octet-stream";
  }
  if (schema.encoding.startsWith("text/")) {
    return schema.encoding.includes("*") ? "text/plain; charset=utf-8" : `${schema.encoding}; charset=utf-8`;
  }
  if (!schema.encoding.includes("*")) {
    return schema.encoding;
  }
  throw new TypeError(`Unable to determine payload encoding. Please provide a 'content-type' header matching ${schema.encoding}.`);
}
function extractFetchErrorCause(err) {
  if (err instanceof TypeError && err.message === "fetch failed" && err.cause !== void 0) {
    return err.cause;
  }
  return err;
}
function getRetryWaitTime(failure2, options, counter) {
  const { retry, maxRetries = 0, minRetryTimeout = 500, maxRetryTimeout = 3e4, retryTimeoutFactor = 2, retryHeaders = true } = options;
  if (counter > maxRetries) {
    return void 0;
  }
  const shouldRetry = retry ? retry(failure2, { counter }) : failure2.shouldRetry();
  if (!shouldRetry) {
    return void 0;
  }
  const waitTime = retryHeaders && failure2 instanceof XrpcResponseError ? getWaitTimeFromHeaders(failure2.headers) : void 0;
  return Math.min(maxRetryTimeout, waitTime ?? minRetryTimeout * retryTimeoutFactor ** (counter - 1));
}
function getWaitTimeFromHeaders(headers) {
  const retryAfterHeader = headers.get("retry-after");
  if (retryAfterHeader) {
    const waitTime = /^\s*\d+\s*$/.test(retryAfterHeader) ? (
      // Retry-After is in seconds
      Number(retryAfterHeader) * 1e3
    ) : (
      // Retry-After is an http-date
      new Date(retryAfterHeader).getTime() - Date.now()
    );
    if (waitTime > 0)
      return waitTime;
  }
  const resetsAt = headers.get("RateLimit-Reset");
  if (resetsAt) {
    const waitTime = Number(resetsAt) * 1e3 - Date.now();
    if (waitTime > 0)
      return waitTime;
  }
}
const _Client = class _Client {
  /**
   * Configures the Client (or its sub classes) globally.
   */
  static configure(opts) {
    if (opts.appLabelers)
      this.appLabelers = [...opts.appLabelers];
  }
  constructor(agent, options = {}) {
    this.agent = buildAgent(agent);
    this.headers = new Headers(options.headers);
    const service = this.headers.get("atproto-proxy")?.trim();
    this.xrpcDefaults = Object.freeze({
      service: options.service === void 0 && service != null && isService(service) ? service : options.service ?? null,
      labelers: new Set(options.labelers),
      // @NOTE when provided (including `null`), will override the class wide
      // Client.appLabelers
      appLabelers: options.appLabelers != null ? new Set(options.appLabelers) : options.appLabelers,
      validateRequest: options.validateRequest ?? false,
      validateResponse: options.validateResponse ?? true,
      strictResponseProcessing: options.strictResponseProcessing ?? true
    });
  }
  /**
   * The DID of the authenticated user, or `undefined` if not authenticated.
   */
  get did() {
    return this.agent.did;
  }
  /**
   * The DID of the authenticated user.
   * @throws {Error} if not authenticated
   */
  get assertDid() {
    this.assertAuthenticated();
    return this.did;
  }
  get service() {
    return this.xrpcDefaults.service;
  }
  get labelers() {
    return this.xrpcDefaults.labelers;
  }
  /**
   * Asserts that the client is authenticated.
   * Use as a type guard when you need to ensure authentication.
   *
   * @throws {Error} if not authenticated
   *
   * @example
   * ```typescript
   * client.assertAuthenticated()
   * // TypeScript now knows client.did is defined
   * console.log(client.did)
   * ```
   */
  assertAuthenticated() {
    if (!this.did)
      throw new Error("Client is not authenticated");
  }
  /**
   * Replaces all labelers with the given set.
   * @param labelers - Iterable of labeler DIDs
   */
  setLabelers(labelers = []) {
    this.clearLabelers();
    this.addLabelers(labelers);
  }
  /**
   * Adds labelers to the current set.
   * @param labelers - Iterable of labeler DIDs to add
   */
  addLabelers(labelers) {
    for (const labeler of labelers)
      this.xrpcDefaults.labelers.add(labeler);
  }
  /**
   * Removes all labelers from this client instance.
   */
  clearLabelers() {
    this.xrpcDefaults.labelers.clear();
  }
  async xrpc(ns, options = {}) {
    return xrpc(this.agent, ns, this.buildXrpcOptions(options));
  }
  async xrpcSafe(ns, options = {}) {
    return xrpcSafe(this.agent, ns, this.buildXrpcOptions(options));
  }
  buildXrpcOptions(options) {
    const combined = applyDefaults(options, this.xrpcDefaults);
    if (combined.appLabelers === void 0) {
      combined.appLabelers = this.constructor.appLabelers;
    }
    const optionsHeaders = options.headers != null ? new Headers(options.headers) : null;
    if (options.service === void 0 && optionsHeaders?.has("atproto-proxy")) {
      const serviceHeader = optionsHeaders.get("atproto-proxy")?.trim();
      if (serviceHeader != null && isService(serviceHeader)) {
        combined.service = serviceHeader;
      }
    }
    combined.headers = optionsHeaders ? mergeHeaders(this.headers, optionsHeaders) : new Headers(this.headers);
    return combined;
  }
  /**
   * Creates a new record in an AT Protocol repository.
   *
   * @param record - The record to create, must include an {@link NsidString} `$type`
   * @param rkey - Optional record key; if omitted, server generates a TID
   * @param options - Create options including repo, swapCommit, validate
   * @returns The XRPC response containing the created record's URI and CID
   *
   * @example
   * ```typescript
   * const response = await client.createRecord(
   *   { $type: 'app.bsky.feed.post', text: 'Hello!', createdAt: new Date().toISOString() },
   *   undefined, // Let server generate rkey
   *   { validate: true }
   * )
   * console.log(response.body.uri)
   * ```
   *
   * @see {@link create} for a higher-level typed alternative
   *
   * @note This method will ignore the `service` and `labelers` instance wide
   * defaults, and will always use `null` unless explicitly overridden in the
   * options.
   */
  async createRecord(record2, rkey, { service = null, labelers = null, ...options } = {}) {
    return this.xrpc(main$6, {
      ...options,
      service,
      labelers,
      body: {
        repo: options?.repo ?? this.assertDid,
        collection: record2.$type,
        record: record2,
        rkey,
        validate: options?.validate,
        swapCommit: options?.swapCommit
      }
    });
  }
  /**
   * Deletes a record from an AT Protocol repository.
   *
   * @param collection - The collection NSID
   * @param rkey - The record key
   * @param options - Delete options including repo, swapCommit, swapRecord
   *
   * @see {@link delete} for a higher-level typed alternative
   *
   * @note This method will ignore the `service` and `labelers` instance wide
   * defaults, and will always use `null` unless explicitly overridden in the
   * options.
   */
  async deleteRecord(collection, rkey, { service = null, labelers = null, ...options } = {}) {
    return this.xrpc(main$5, {
      ...options,
      service,
      labelers,
      body: {
        repo: options?.repo ?? this.assertDid,
        collection,
        rkey,
        swapCommit: options?.swapCommit,
        swapRecord: options?.swapRecord
      }
    });
  }
  /**
   * Retrieves a record from an AT Protocol repository.
   *
   * @param collection - The collection NSID
   * @param rkey - The record key
   * @param options - Get options including repo
   *
   * @see {@link get} for a higher-level typed alternative
   *
   * @note This method will ignore the `service` and `labelers` instance wide
   * defaults, and will always use `null` unless explicitly overridden in the
   * options.
   */
  async getRecord(collection, rkey, { service = null, labelers = null, ...options } = {}) {
    return this.xrpc(main$4, {
      ...options,
      service,
      labelers,
      params: {
        repo: options?.repo ?? this.assertDid,
        collection,
        rkey
      }
    });
  }
  /**
   * Creates or updates a record in a repository.
   *
   * @param record - The record to put, must include an {@link NsidString} `$type`
   * @param rkey - The record key
   * @param options - Put options including repo, swapCommit, swapRecord, validate
   *
   * @see {@link put} for a higher-level typed alternative
   *
   * @note This method will ignore the `service` and `labelers` instance wide
   * defaults, and will always use `null` unless explicitly overridden in the
   * options.
   */
  async putRecord(record2, rkey, { service = null, labelers = null, ...options } = {}) {
    return this.xrpc(main$2, {
      ...options,
      service,
      labelers,
      body: {
        repo: options?.repo ?? this.assertDid,
        collection: record2.$type,
        rkey,
        record: record2,
        validate: options?.validate,
        swapCommit: options?.swapCommit,
        swapRecord: options?.swapRecord
      }
    });
  }
  /**
   * Lists records in a collection.
   *
   * @param nsid - The collection NSID
   * @param options - List options including repo, limit, cursor, reverse
   *
   * @see {@link list} for a higher-level typed alternative
   *
   * @note This method will ignore the `service` and `labelers` instance wide
   * defaults, and will always use `null` unless explicitly overridden in the
   * options.
   */
  async listRecords(nsid, { service = null, labelers = null, ...options } = {}) {
    return this.xrpc(main$3, {
      ...options,
      service,
      labelers,
      params: {
        repo: options?.repo ?? this.assertDid,
        collection: nsid,
        cursor: options?.cursor,
        limit: options?.limit,
        reverse: options?.reverse
      }
    });
  }
  /**
   * Performs an atomic batch of create, update, and delete operations on records in a repository.
   *
   * @param builder - A function that receives an {@link ApplyWritesOperations} instance to build the operations
   * @param options - ApplyWrites options including repo, validate, swapCommit
   * @returns The XRPC response from the applyWrites call
   *
   * @example
   * ```typescript
   * const response = await client.applyWrites((op) => [
   *   op.create(app.bsky.feed.post, { text: 'Hello!' }),
   *   op.update(app.bsky.feed.post, { text: 'Updated text' }, { rkey: 'post123' }),
   *   op.delete(app.bsky.feed.post, 'post456'),
   *   op.update(app.bsky.actor.profile, { displayName: 'Alice' }),
   * ], {
   *   validate: true,
   * })
   *
   * for (const result of response.body.results) {
   *   console.log(result.uri)
   * }
   * ```
   *
   * @note This method will ignore the `service` and `labelers` instance wide
   * defaults, and will always use `null` unless explicitly overridden in the
   * options.
   */
  async applyWrites(factory, { service = null, labelers = null, ...options } = {}) {
    return this.xrpc(main$7, {
      ...options,
      service,
      labelers,
      body: {
        repo: options?.repo ?? this.assertDid,
        writes: WriteOperationHelper.build(factory),
        validate: options?.validate,
        swapCommit: options?.swapCommit
      }
    });
  }
  /**
   * Uploads a blob to an AT Protocol repository.
   *
   * @param body - The blob data (Uint8Array, ReadableStream, Blob, etc.)
   * @param options - Upload options including encoding hint
   * @returns Response containing the blob reference
   *
   * @example
   * ```typescript
   * const imageData = await fetch('image.png').then(r => r.arrayBuffer())
   * const response = await client.uploadBlob(new Uint8Array(imageData), {
   *   encoding: 'image/png'
   * })
   * console.log(response.body.blob) // Use this ref in records
   * ```
   *
   * @note This method will ignore the `service` and `labelers` instance wide
   * defaults, and will always use `null` unless explicitly overridden in the
   * options.
   */
  async uploadBlob(body, { service = null, labelers = null, ...options } = {}) {
    return this.xrpc(main$1, { ...options, service, labelers, body });
  }
  /**
   * Retrieves a blob by DID and CID.
   *
   * @param did - The DID of the repository containing the blob
   * @param cid - The CID of the blob
   * @param options - Call options
   *
   * @note This method will ignore the `service` and `labelers` instance wide
   * defaults, and will always use `null` unless explicitly overridden in the
   * options.
   */
  async getBlob(did, cid, { service = null, labelers = null, ...options } = {}) {
    return this.xrpc(main, {
      ...options,
      service,
      labelers,
      params: { did, cid }
    });
  }
  async call(ns, arg, options = {}) {
    const method = getMain(ns);
    if (typeof method === "function") {
      return method(this, arg, options);
    }
    if (method instanceof Procedure) {
      const result = await this.xrpc(method, { ...options, body: arg });
      return result.body;
    } else if (method instanceof Query) {
      const result = await this.xrpc(method, { ...options, params: arg });
      return result.body;
    } else {
      throw new TypeError("Invalid lexicon");
    }
  }
  async create(ns, input, options = {}) {
    const schema = getMain(ns);
    const record2 = schema.build(input);
    if (options?.validateRequest)
      schema.validate(record2);
    const rkey = options.rkey ?? getDefaultRecordKey(schema);
    if (rkey !== void 0)
      schema.keySchema.assert(rkey);
    const response = await this.createRecord(record2, rkey, options);
    return response.body;
  }
  async delete(ns, options = {}) {
    const schema = getMain(ns);
    const rkey = schema.keySchema.parse(options.rkey ?? getLiteralRecordKey(schema));
    const response = await this.deleteRecord(schema.$type, rkey, options);
    return response.body;
  }
  async get(ns, options = {}) {
    const schema = getMain(ns);
    const rkey = schema.keySchema.parse(options.rkey ?? getLiteralRecordKey(schema));
    const response = await this.getRecord(schema.$type, rkey, options);
    const value = schema.validate(response.body.value);
    return { ...response.body, value };
  }
  async put(ns, input, options = {}) {
    const schema = getMain(ns);
    const record2 = schema.build(input);
    if (options?.validateRequest)
      schema.validate(record2);
    const rkey = options.rkey ?? getLiteralRecordKey(schema);
    const response = await this.putRecord(record2, rkey, options);
    return response.body;
  }
  /**
   * Lists records with type-safe validation and separation of valid/invalid records.
   *
   * @param ns - The record schema definition
   * @param options - List options
   * @returns Records validated against the schema, with invalid records included as LexMap
   *
   * @example
   * ```typescript
   * const result = await client.list(app.bsky.feed.post, { limit: 100 })
   * for (const record of result.records) {
   *   if (record.valid) {
   *     record.value // Fully typed
   *   } else {
   *     record.value // Invalid record, typed as LexMap
   *   }
   * }
   * ```
   *
   * @see {@link listRecords} for a lower-level method that returns the raw records without schema validation
   */
  async list(ns, options) {
    const schema = getMain(ns);
    const { body } = await this.listRecords(schema.$type, options);
    const records = body.records.map(processListRecord, schema);
    return { ...body, records };
  }
  /**
   * Asynchronously iterates over all records in a collection, handling
   * pagination automatically.
   *
   * @param ns - The record schema definition
   * @param options - List options including limit and cursor
   * @returns An async generator yielding each record validated against the schema
   *
   * @see {@link list} for a method that returns a single page of records
   * @see {@link listRecords} for a lower-level method that returns raw records without schema validation
   */
  async *listAll(ns, { maxRetries = 3, ...options } = {}) {
    const schema = getMain(ns);
    do {
      throwIfAborted(options.signal);
      const { body } = await this.listRecords(schema.$type, {
        ...options,
        maxRetries
      });
      for (const record2 of body.records) {
        yield processListRecord.call(schema, record2);
      }
      if (body.cursor && body.cursor === options.cursor) {
        return;
      }
      options.cursor = body.cursor;
    } while (options.cursor);
  }
};
_Client.appLabelers = [];
let Client = _Client;
function processListRecord(record2) {
  const result = this.safeValidate(record2.value);
  if (result.success) {
    return { ...record2, valid: true, value: result.value };
  } else {
    return { ...record2, valid: false };
  }
}
function cidFromBlob(blob2) {
  if (!blob2 || typeof blob2 !== "object") return null;
  const b = blob2;
  const ref2 = b.ref ?? b.cid;
  if (!ref2) return null;
  if (typeof ref2 === "string") return ref2;
  if (typeof ref2 === "object") {
    const r = ref2;
    if (typeof r.$link === "string") return r.$link;
    if (typeof r["/"] === "string") return r["/"];
    const s = String(ref2);
    if (s && s !== "[object Object]") return s;
  }
  return null;
}
function blobUrl(service, did, cid) {
  return `${service.replace(/\/$/, "")}/xrpc/com.atproto.sync.getBlob?did=${encodeURIComponent(did)}&cid=${encodeURIComponent(cid)}`;
}
async function toBytes(input) {
  if (input instanceof Uint8Array) return input;
  if (input instanceof ArrayBuffer) return new Uint8Array(input);
  return new Uint8Array(await input.arrayBuffer());
}
async function uploadBlob(client, input, options = {}) {
  const bytes = await toBytes(input);
  const mimeType = options.mimeType ?? (input instanceof Blob && input.type || "application/octet-stream");
  if (options.maxBytes !== void 0 && bytes.byteLength > options.maxBytes) throw new AirspaceError(`blob is ${bytes.byteLength} bytes, over the ${options.maxBytes} byte limit`);
  const blob2 = (await client.uploadBlob(bytes, { encoding: mimeType })).body.blob;
  return {
    blob: lexToJson(blob2),
    cid: cidFromBlob(blob2),
    mimeType,
    size: bytes.byteLength,
    ...await imageDimensions(bytes, mimeType)
  };
}
async function imageDimensions(bytes, mimeType) {
  if (!mimeType.startsWith("image/")) return {};
  try {
    const { imageMeta } = await import("./index-mH_0pvGP.js");
    const { width, height } = imageMeta(bytes);
    return width && height ? { aspectRatio: {
      width,
      height
    } } : {};
  } catch {
    return {};
  }
}
function isNotFound(err) {
  return err instanceof XrpcResponseError && (err.status === 404 || err.error === "RecordNotFound");
}
async function scoped(call) {
  try {
    return await call();
  } catch (err) {
    const scope = err instanceof XrpcResponseError && err.status === 403 ? /Missing required scope "([^"]+)"/.exec(err.message)?.[1] : void 0;
    throw scope ? new ScopeError(scope, { cause: err }) : err;
  }
}
function scopedClient(client) {
  if (!client) return client;
  return new Proxy(client, { get(target, property, receiver) {
    const value = Reflect.get(target, property, receiver);
    if (property !== "call" || typeof value !== "function") return value;
    return (...args) => scoped(() => value.apply(target, args));
  } });
}
async function swapping(schema, rkey, ifMatch, write) {
  try {
    return await scoped(write);
  } catch (err) {
    if (ifMatch && err instanceof XrpcResponseError && err.error === "InvalidSwap") throw new ConflictError(schema.$type, rkey, ifMatch, { cause: err });
    throw err;
  }
}
const readOnly = (what = "write") => new AirspaceError(`this Airspace instance is read-only; pass a \`session\` to createAirspace to ${what}`);
async function* paginate(page, schema, limit, unvalidated) {
  let cursor;
  let left = limit;
  do {
    const res = await page(schema, {
      limit: left === void 0 ? 100 : Math.min(left, 100),
      cursor,
      unvalidated
    });
    for (const record2 of res.records) {
      yield record2;
      if (left !== void 0 && --left <= 0) return;
    }
    cursor = res.cursor;
  } while (cursor);
}
function spaceUri(authority, type, skey) {
  return `at://${authority}/space/${type}/${skey}`;
}
const NSID = /^[a-z][a-z0-9-]{0,62}(?:\.[a-z0-9][a-z0-9-]{0,62})+\.[a-z][a-z0-9]{0,62}$/i;
const RKEY = /^(?!\.\.?$)[\w.:~-]{1,512}$/;
const malformed = (uri, what) => new AirspaceError(`malformed at:// URI (${what}): ${uri}`);
function parseAtUri(uri) {
  const m = /^at:\/\/([^/?#]+)(?:\/(.*))?$/.exec(uri);
  if (!m || uri.length > 8192) throw new AirspaceError(`not an at:// URI: ${uri}`);
  const authority = m[1];
  if (!isDid(authority) && !isHandle(authority)) throw malformed(uri, "authority");
  const parts = m[2] === void 0 ? [] : m[2].split("/");
  if (parts.some((part) => !part)) throw malformed(uri, "empty segment");
  const collectionAt = (index2) => {
    const collection = parts[index2];
    if (collection !== void 0 && !NSID.test(collection)) throw malformed(uri, "collection");
    return collection;
  };
  const rkeyAt = (index2) => {
    const rkey = parts[index2];
    if (rkey !== void 0 && !RKEY.test(rkey)) throw malformed(uri, "rkey");
    return rkey;
  };
  if (parts[0] === "space") {
    if (parts.length > 6) throw malformed(uri, "too many segments");
    const [, type, skey, author] = parts;
    if (!type || !skey || !NSID.test(type) || !RKEY.test(skey)) throw new AirspaceError(`malformed space URI: ${uri}`);
    if (author !== void 0 && !isDid(author)) throw malformed(uri, "author");
    return {
      authority,
      space: {
        type,
        skey
      },
      author,
      collection: collectionAt(4),
      rkey: rkeyAt(5)
    };
  }
  if (parts.length > 2) throw malformed(uri, "too many segments");
  return {
    authority,
    author: authority,
    collection: collectionAt(0),
    rkey: rkeyAt(1)
  };
}
function repoShapedRefs(value, space2, repo) {
  const prefix = `${space2}/${repo}/`;
  const walk = (node) => {
    if (Array.isArray(node)) return node.map(walk);
    if (node && typeof node === "object" && Object.getPrototypeOf(node) === Object.prototype) {
      const out = {};
      for (const [k, v] of Object.entries(node)) out[k] = k === "uri" && typeof v === "string" && v.startsWith(prefix) ? `at://${repo}/${v.slice(prefix.length)}` : walk(v);
      return out;
    }
    return node;
  };
  return walk(value);
}
function repoElsewhere(err) {
  if (!(err instanceof XrpcResponseError)) return false;
  return err.error === "UpstreamFailure" || err.error === "InvalidRequest" && /could not find repo/i.test(err.message);
}
function withRepoFallback(primary, elsewhere) {
  let active = primary;
  let resolved;
  const fallback = async () => active = await (resolved ??= elsewhere());
  const attempt = async (call) => {
    try {
      return await call(active);
    } catch (err) {
      if (!repoElsewhere(err)) throw err;
      return await call(await fallback());
    }
  };
  return {
    repo: primary.repo,
    get location() {
      return active.location;
    },
    blobUrl: (blob2) => active.blobUrl(blob2),
    get: (schema, rkey) => attempt((backend) => backend.get(schema, rkey)),
    page: (schema, options) => attempt((backend) => backend.page(schema, options)),
    async *list(schema, options) {
      let started = false;
      try {
        for await (const raw of active.list(schema, options)) {
          started = true;
          yield raw;
        }
        return;
      } catch (err) {
        if (started || !repoElsewhere(err)) throw err;
      }
      yield* (await fallback()).list(schema, options);
    },
    create: (schema, value, rkey) => attempt((backend) => backend.create(schema, value, rkey)),
    put: (schema, rkey, value, ifMatch) => attempt((backend) => backend.put(schema, rkey, value, ifMatch)),
    delete: (schema, rkey, ifMatch) => attempt((backend) => backend.delete(schema, rkey, ifMatch)),
    batch: (writes) => attempt((backend) => backend.batch(writes))
  };
}
function createPublicBackend({ repo, service, read: read2, write }) {
  const requireWrite = () => {
    if (!write) throw readOnly();
    return write;
  };
  const page = async (schema, { limit = 100, cursor, reverse, unvalidated } = {}) => {
    const res = await read2.list(schema, {
      repo,
      limit,
      cursor,
      reverse
    });
    return {
      records: unvalidated ? res.records : res.records.filter((item) => item.valid),
      cursor: res.records.length < limit ? void 0 : res.cursor
    };
  };
  return {
    repo,
    location: `at://${repo}`,
    blobUrl: (blob2) => {
      const cid = cidFromBlob(blob2);
      return cid ? blobUrl(service, repo, cid) : null;
    },
    async get(schema, rkey) {
      try {
        const res = await read2.get(schema, {
          repo,
          rkey
        });
        return {
          uri: res.uri,
          cid: res.cid ?? "",
          value: res.value
        };
      } catch (err) {
        if (isNotFound(err)) return null;
        throw err;
      }
    },
    page,
    list: (schema, { limit, unvalidated } = {}) => paginate(page, schema, limit, unvalidated),
    async create(schema, value, rkey) {
      return await scoped(() => requireWrite().create(schema, value, {
        repo,
        rkey
      }));
    },
    async put(schema, rkey, value, ifMatch) {
      return await swapping(schema, rkey, ifMatch, () => requireWrite().put(schema, value, {
        repo,
        rkey,
        swapRecord: ifMatch
      }));
    },
    async delete(schema, rkey, ifMatch) {
      await swapping(schema, rkey, ifMatch, () => requireWrite().delete(schema, {
        repo,
        rkey,
        swapRecord: ifMatch
      }));
    },
    async batch(writes) {
      const ops = writes.map(({ operation, schema, rkey, value }) => ({
        $type: `com.atproto.repo.applyWrites#${operation === "put" ? "update" : operation}`,
        collection: schema.$type,
        rkey,
        value
      }));
      return ((await scoped(() => requireWrite().applyWrites(() => ops, { repo }))).body.results ?? []).map((result) => "uri" in result ? {
        uri: result.uri,
        cid: result.cid
      } : void 0);
    }
  };
}
const TYPE_ONLY = /* @__PURE__ */ Symbol.for("airspace.typeOnly");
const identity = (value) => value;
function stub(nsid) {
  return {
    [TYPE_ONLY]: true,
    type: "record",
    $type: nsid,
    nsid,
    key: "tid",
    build: (input) => ({
      ...input,
      $type: nsid
    }),
    parse: identity,
    validate: identity,
    safeParse: (value) => ({
      success: true,
      value
    }),
    safeValidate: (value) => ({
      success: true,
      value
    }),
    keySchema: {
      parse: identity,
      assert: () => {
      },
      safeParse: (value) => ({
        success: true,
        value
      })
    }
  };
}
const literalKey = (key) => key.startsWith("literal:") ? key.slice(8) : void 0;
function schemaFields(schema) {
  const shape = schema.schema.shape;
  return shape ? new Set(Object.keys(shape)) : void 0;
}
function defineCollection(schema, options = {}) {
  return {
    kind: "collection",
    schema,
    nsid: schema.$type,
    singleton: literalKey(schema.key) !== void 0,
    sort: options.sort ?? [],
    relations: options.relations ?? {},
    plugins: options.plugins ?? []
  };
}
function isRecordSchema(value) {
  return !!value && typeof value.$type === "string" && typeof value.validate === "function" && "key" in value;
}
function defineCollections(lexicons2, options) {
  const collections = {};
  for (const [name, schema] of Object.entries(lexicons2)) if (isRecordSchema(schema)) collections[name] = defineCollection(schema);
  const spec = (typeof options === "function" ? options(collections) : options) ?? {};
  for (const [name, collection] of Object.entries(collections)) {
    const own = spec[name];
    if (own) Object.assign(collection, {
      sort: own.sort ?? [],
      relations: own.relations ?? {},
      plugins: own.plugins ?? []
    });
  }
  return collections;
}
function belongsTo(target, field2) {
  return {
    kind: "belongsTo",
    target: typeof target === "function" ? target : () => target,
    field: field2
  };
}
function defineSpace(declaration2, options) {
  const skey = options.skey ?? literalKey(declaration2.key) ?? (TYPE_ONLY in declaration2 ? "self" : void 0);
  if (!skey) throw new AirspaceError(`space ${declaration2.nsid} has key "${declaration2.key}"; pass \`skey\``);
  const mapped = Object.values(options.collections).map((c) => c.nsid);
  const declared = declaration2.collections ?? mapped;
  for (const nsid of declared) if (!mapped.includes(nsid)) throw new AirspaceError(`space ${declaration2.nsid} declares ${nsid} but no collection with that NSID was passed`);
  return {
    kind: "space",
    declaration: {
      ...declaration2,
      collections: declared
    },
    type: declaration2.nsid,
    skey,
    authority: options.authority ?? "self",
    collections: options.collections
  };
}
function definePlugin(plugin) {
  return plugin;
}
async function applyRead(plugins, record2, ctx) {
  const meta = {};
  for (const plugin of plugins) {
    if (!plugin.read) continue;
    Object.assign(meta, await plugin.read(record2, ctx));
  }
  return meta;
}
async function applyWrite(plugins, value, ctx) {
  let out = value;
  for (const plugin of plugins) {
    if (!plugin.write) continue;
    out = await plugin.write(out, ctx) ?? out;
  }
  return out;
}
const INTERNAL = /* @__PURE__ */ Symbol("airspace.internal");
const rkeyFromUri = (uri) => uri.slice(uri.lastIndexOf("/") + 1);
function createCollectionClient(collection, ctx) {
  const { schema } = collection;
  const typeOnly = TYPE_ONLY in schema;
  const fixedRkey = typeOnly ? "self" : literalKey(schema.key);
  const plugins = [...ctx.plugins, ...collection.plugins];
  const context = (rkey) => `${schema.$type}${rkey ? `/${rkey}` : ""}`;
  const cache2 = /* @__PURE__ */ new Map();
  const store = ctx.store;
  const fromStore = async (key, load) => {
    const hit = await store.get(key).catch(() => void 0);
    if (hit) return hit.value;
    const value = await load();
    await store.set(key, value).catch(() => {
    });
    return value;
  };
  const remember = (key, load) => {
    const hit = cache2.get(key);
    if (hit && (ctx.ttl > 0 ? Date.now() - hit.at < ctx.ttl : hit.at === Infinity)) return hit.value;
    const entry = {
      at: ctx.ttl > 0 ? Date.now() : Infinity,
      value: store ? fromStore(key, load) : load()
    };
    cache2.set(key, entry);
    entry.value.then(() => {
      if (ctx.ttl === 0) cache2.delete(key);
    }, () => cache2.delete(key));
    return entry.value;
  };
  const invalidate = () => {
    cache2.clear();
    store?.clear().catch(() => {
    });
  };
  const pluginCtx = async (operation) => {
    const [identity2, backend] = await Promise.all([ctx.identity(), ctx.backend()]);
    return {
      identity: identity2,
      collection,
      blobUrl: backend.blobUrl,
      operation
    };
  };
  const shell = async (raw) => ({
    uri: raw.uri,
    cid: raw.cid,
    rkey: rkeyFromUri(raw.uri),
    author: (await ctx.backend()).repo,
    value: lexToJson(raw.value),
    meta: {}
  });
  const withMeta = async (record2) => {
    record2.meta = await applyRead(plugins, record2, await pluginCtx("read"));
    return record2;
  };
  const envelope = async (raw) => withMeta(await shell(raw));
  async function prepare(value, operation, rkey) {
    const written2 = await applyWrite(plugins, value, await pluginCtx(operation));
    const lex = jsonToLex({
      ...written2,
      $type: schema.$type
    });
    const rewritten = ctx.prepareWrite ? await ctx.prepareWrite(lex) : lex;
    try {
      return schema.parse(rewritten);
    } catch (err) {
      if (err instanceof LexValidationError) throw new ValidationError(context(rkey), err);
      throw err;
    }
  }
  const writeResult = (res, changed = true) => ({
    uri: res.uri,
    cid: res.cid,
    rkey: rkeyFromUri(res.uri),
    changed
  });
  async function get(rkey = fixedRkey) {
    if (!schema.keySchema.safeParse(rkey).success) return null;
    const raw = await remember(`get\0${rkey}`, async () => {
      try {
        return await (await ctx.backend()).get(schema, rkey);
      } catch (err) {
        if (err instanceof LexValidationError) throw new ValidationError(context(rkey), err);
        throw err;
      }
    });
    return raw && await envelope(raw);
  }
  async function page(query2 = {}) {
    const raw = await remember(`page\0${query2.limit ?? ""}\0${query2.cursor ?? ""}\0${query2.reverse ?? ""}`, async () => (await ctx.backend()).page(schema, query2));
    return {
      records: await Promise.all(raw.records.map(envelope)),
      cursor: raw.cursor
    };
  }
  async function listRaw(limit, unvalidated) {
    return await remember(`list\0${limit ?? ""}\0${unvalidated ?? ""}`, async () => {
      const out = [];
      for await (const raw of (await ctx.backend()).list(schema, {
        limit,
        unvalidated
      })) out.push(raw);
      return out;
    });
  }
  async function listAll(limit, unvalidated) {
    return await Promise.all((await listRaw(limit, unvalidated)).map(envelope));
  }
  const uriOf = (ref2) => {
    const uri = typeof ref2 === "string" ? ref2 : ref2?.uri;
    return uri?.startsWith("at://") ? uri : void 0;
  };
  function refUris(record2, relation) {
    const rel = collection.relations[relation];
    if (!rel) throw new AirspaceError(`${schema.$type} has no relation "${String(relation)}"`);
    const held = record2.value[rel.field];
    if (rel.kind === "hasMany") return Array.isArray(held) ? held.map(uriOf) : [];
    return [uriOf(held)];
  }
  async function resolve(record2, relation) {
    const uris = refUris(record2, relation);
    const found = await ctx.resolveRefs(collection.relations[relation].target(), uris.filter((u) => !!u));
    if (collection.relations[relation].kind === "hasMany") return uris.map((uri) => uri && found.get(uri)).filter(Boolean);
    return (uris[0] && found.get(uris[0])) ?? null;
  }
  async function list2(query2 = {}) {
    const sort = query2.sort ?? collection.sort;
    const pushdown = query2.limit !== void 0 && !query2.where && !sort.length && !query2.offset;
    const records = applyQuery(await Promise.all((await listRaw(pushdown ? query2.limit : void 0)).map(shell)), query2, collection.sort);
    await Promise.all(records.map(withMeta));
    if (!query2.with?.length) return records;
    const related = records.map(() => ({}));
    await Promise.all(query2.with.map(async (name) => {
      const many = collection.relations[name].kind === "hasMany";
      const per = records.map((record2) => refUris(record2, name));
      const found = await ctx.resolveRefs(collection.relations[name].target(), per.flat().filter((u) => !!u));
      per.forEach((uris, i) => {
        related[i][name] = many ? uris.map((uri) => uri && found.get(uri)).filter(Boolean) : (uris[0] && found.get(uris[0])) ?? null;
      });
    }));
    return records.map((record2, i) => Object.assign(record2, { related: related[i] }));
  }
  async function validate(value) {
    try {
      await prepare(value, "put");
      return { ok: true };
    } catch (err) {
      if (err instanceof ValidationError) return {
        ok: false,
        issues: err.issues
      };
      throw err;
    }
  }
  const written = async (write) => {
    const res = await write(await ctx.backend());
    invalidate();
    return writeResult(res);
  };
  async function create2(value, options = {}) {
    const lex = await prepare(value, "create", options.rkey);
    return written((backend) => backend.create(schema, lex, options.rkey));
  }
  async function put(...args) {
    const keyed = typeof args[0] === "string";
    const rkey = keyed ? args[0] : fixedRkey;
    const value = keyed ? args[1] : args[0];
    const options = (keyed ? args[2] : args[1]) ?? {};
    const lex = await prepare(value, "put", rkey);
    if (options.ifChanged) {
      const existing = await get(rkey);
      if (existing && deepEqual(lexToJson(lex), existing.value)) return writeResult(existing, false);
    }
    return written((backend) => backend.put(schema, rkey, lex, options.ifMatch));
  }
  async function del(...args) {
    const keyed = typeof args[0] === "string";
    const rkey = keyed ? args[0] : fixedRkey;
    const options = (keyed ? args[1] : args[0]) ?? {};
    await (await ctx.backend()).delete(schema, rkey, options.ifMatch);
    invalidate();
  }
  async function publish(...args) {
    const rkey = typeof args[0] === "string" ? args[0] : fixedRkey;
    const options = (typeof args[0] === "string" ? args[1] : args[0]) ?? {};
    const draft = await get(rkey);
    if (!draft) throw new AirspaceError(`${context(rkey)} not found in ${(await ctx.backend()).location}`);
    const { $type: $type2, ...value } = draft.value;
    const next = options.transform ? options.transform(draft.value) : value;
    return await ctx.publishTarget(collection).put(rkey, next, { ifMatch: options.ifMatch });
  }
  async function published() {
    const target = ctx.publishTarget(collection);
    const [drafts, live] = await Promise.all([listAll(), target.list()]);
    const keys = new Set(live.map((record2) => record2.rkey));
    return drafts.map((record2) => record2.rkey).filter((rkey) => keys.has(rkey));
  }
  async function migrate(transform, options = {}) {
    const records = await listAll(void 0, true);
    const report = {
      scanned: records.length,
      changed: 0,
      unchanged: 0,
      failed: {}
    };
    const writes = [];
    for (const record2 of records) {
      let lex;
      try {
        lex = await prepare(transform(record2.value, record2), "put", record2.rkey);
      } catch (err) {
        if (!(err instanceof ValidationError)) throw err;
        report.failed[record2.rkey] = err.issues;
        continue;
      }
      if (deepEqual(lexToJson(lex), record2.value)) {
        report.unchanged++;
        continue;
      }
      report.changed++;
      writes.push({
        operation: "put",
        schema,
        rkey: record2.rkey,
        value: lex
      });
    }
    if (!options.dryRun && writes.length) {
      const backend = await ctx.backend();
      for (let i = 0; i < writes.length; i += 200) await backend.batch(writes.slice(i, i + 200));
      invalidate();
    }
    return report;
  }
  const api = collection.singleton ? {
    page,
    list: list2,
    resolve,
    get,
    put,
    delete: del,
    migrate,
    invalidate
  } : {
    page,
    list: list2,
    resolve,
    get,
    create: create2,
    put,
    delete: del,
    migrate,
    invalidate
  };
  if (!typeOnly) api.validate = validate;
  if (ctx.publishTarget) {
    api.publish = publish;
    api.published = published;
  }
  api[INTERNAL] = {
    schema,
    fixedRkey,
    prepare: (value, operation, rkey) => prepare(value, operation, rkey),
    invalidate
  };
  return api;
}
function applyQuery(records, query2, defaultSort) {
  let out = records;
  if (query2.where) {
    const where = query2.where;
    out = typeof where === "function" ? out.filter((r) => where(r.value)) : out.filter((r) => Object.entries(where).every(([k, v]) => r.value[k] === v));
  }
  const sort = query2.sort ?? defaultSort;
  if (sort.length) out = [...out].sort((a, b) => {
    for (const [field2, direction = "asc"] of sort) {
      const cmp = compare(a.value[field2], b.value[field2]);
      if (cmp !== 0) return direction === "asc" ? cmp : -cmp;
    }
    return 0;
  });
  if (query2.offset) out = out.slice(query2.offset);
  if (query2.limit !== void 0) out = out.slice(0, query2.limit);
  return out;
}
function deepEqual(a, b) {
  if (a === b) return true;
  if (typeof a !== "object" || typeof b !== "object" || !a || !b) return false;
  if (Array.isArray(a) || Array.isArray(b)) return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((item, i) => deepEqual(item, b[i]));
  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length && keys.every((key) => deepEqual(a[key], b[key]));
}
function compare(a, b) {
  if (a === b) return 0;
  if (a === void 0 || a === null) return 1;
  if (b === void 0 || b === null) return -1;
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b));
}
function createBatch(clients, backend) {
  const builder = {};
  let intents;
  const push = (intent) => {
    if (!intents) throw new AirspaceError("batch operations can only be added while the builder runs");
    intents.push(intent);
  };
  for (const [name, client] of Object.entries(clients)) {
    const { fixedRkey } = client[INTERNAL];
    builder[name] = {
      create: (value, options = {}) => push({
        client,
        operation: "create",
        rkey: options.rkey,
        value
      }),
      put: (...args) => push({
        client,
        operation: "put",
        rkey: typeof args[0] === "string" ? args[0] : fixedRkey,
        value: typeof args[0] === "string" ? args[1] : args[0]
      }),
      delete: (rkey) => push({
        client,
        operation: "delete",
        rkey: rkey ?? fixedRkey
      })
    };
  }
  return async (build) => {
    const collected = [];
    intents = collected;
    try {
      build(builder);
    } finally {
      intents = void 0;
    }
    const writes = await Promise.all(collected.map(async ({ client, operation, rkey, value }) => {
      const internal = client[INTERNAL];
      return {
        operation,
        schema: internal.schema,
        rkey,
        value: operation === "delete" ? void 0 : await internal.prepare(value, operation === "create" ? "create" : "put", rkey)
      };
    }));
    const refs = await (await backend()).batch(writes);
    for (const { client } of collected) client[INTERNAL].invalidate();
    return collected.map(({ client, operation, rkey }, i) => {
      const collection = client[INTERNAL].schema.$type;
      const ref2 = refs[i];
      if (operation === "delete" || !ref2) return {
        operation: "delete",
        collection,
        rkey
      };
      return {
        operation,
        collection,
        rkey: rkey ?? rkeyFromUri(ref2.uri),
        uri: ref2.uri,
        cid: ref2.cid
      };
    });
  };
}
const isBlobRef = (value) => value.$type === "blob" || "ref" in value && !("image" in value) && !("uri" in value);
function webUrl(value) {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? value : null;
  } catch {
    return null;
  }
}
function resolveImage(source, blobUrl2) {
  if (!source) return null;
  const image2 = isBlobRef(source) ? { image: source } : source;
  const url = image2.image ? blobUrl2(image2.image) : webUrl(image2.uri);
  if (!url) return null;
  return {
    url,
    alt: image2.alt ?? "",
    width: image2.aspectRatio?.width,
    height: image2.aspectRatio?.height
  };
}
const publicClient = (service) => new Client({
  service,
  fetch: (input, init) => fetch(input, init)
});
function once(load) {
  let pending2;
  return () => pending2 ??= load().catch((err) => {
    pending2 = void 0;
    throw err;
  });
}
function createAirspace(options) {
  const plugins = options.plugins ?? [];
  const ttl = options.cache?.ttl ?? 0;
  const storage = options.cache?.storage;
  if (storage && !(ttl > 0)) throw new AirspaceError("cache.storage needs a ttl above 0");
  const network = { allowPrivateNetwork: options.allowPrivateNetwork };
  const keyOf = /* @__PURE__ */ new WeakMap();
  const runtime = once(async () => {
    const identity3 = await resolveIdentity(options.identity, network);
    const session = options.session ? new Client(options.session) : void 0;
    const backend2 = createPublicBackend({
      repo: identity3.did,
      service: identity3.service,
      read: publicClient(identity3.service),
      write: session
    });
    keyOf.set(backend2, "public");
    return {
      identity: identity3,
      session,
      public: backend2
    };
  });
  const identity2 = async () => (await runtime()).identity;
  const spaceLib = once(() => import("./space-BhlfPd1q-BJlzT3xr.js"));
  const backends = /* @__PURE__ */ new Map();
  const backend = (key, create2) => {
    let pending2 = backends.get(key);
    if (!pending2) backends.set(key, pending2 = create2().then((created) => {
      keyOf.set(created, key);
      return created;
    }, (err) => {
      backends.delete(key);
      throw err;
    }));
    return pending2;
  };
  const support = /* @__PURE__ */ new Map();
  const spacesSupported = async (uri) => {
    const [rt, lib2] = await Promise.all([runtime(), spaceLib()]);
    if (!rt.session) throw readOnly("probe for spaces");
    let pending2 = support.get(rt.identity.service);
    if (!pending2) support.set(rt.identity.service, pending2 = lib2.probeSpaces(rt.session, uri).catch((err) => {
      support.delete(rt.identity.service);
      throw err;
    }));
    return pending2;
  };
  const spaceClient = async (uri) => {
    const [rt, lib2] = await Promise.all([runtime(), spaceLib()]);
    return rt.session && lib2.guardSpaces(rt.session, rt.identity.service, () => spacesSupported(uri));
  };
  const spaceBackend = (uri, author) => backend(`${uri}|${author}`, async () => {
    const [rt, lib2] = await Promise.all([runtime(), spaceLib()]);
    return lib2.createSpaceBackend({
      space: uri,
      repo: author,
      service: rt.identity.service,
      client: await spaceClient(uri)
    });
  });
  const backendFor = async (uri) => {
    const ref2 = parseAtUri(uri);
    const author = ref2.author ?? ref2.authority;
    if (ref2.space) return spaceBackend(spaceUri(ref2.authority, ref2.space.type, ref2.space.skey), author);
    const rt = await runtime();
    if (author === rt.identity.did) return rt.public;
    return backend(author, async () => {
      const foreign = (repo, service) => createPublicBackend({
        repo,
        service,
        read: publicClient(service)
      });
      if (!isDid(author)) {
        const resolved = await resolveIdentity(author, network);
        return foreign(resolved.did, resolved.service);
      }
      return withRepoFallback(foreign(author, rt.identity.service), async () => foreign(author, (await resolveIdentity({ did: author }, network)).service));
    });
  };
  const clients = /* @__PURE__ */ new Map();
  function clientFor(repo, collection) {
    let byCollection = clients.get(repo.key);
    if (!byCollection) clients.set(repo.key, byCollection = /* @__PURE__ */ new Map());
    let client = byCollection.get(collection);
    if (!client) byCollection.set(collection, client = createCollectionClient(collection, {
      backend: repo.backend,
      identity: identity2,
      plugins,
      ttl,
      store: storage && persistentStore(storage, `${repo.key}\0${collection.nsid}`, ttl),
      resolveRefs: resolveRefs(repo.backend),
      ...repo.extra
    }));
    return client;
  }
  const repoOf = (backend2) => ({
    key: keyOf.get(backend2) ?? backend2.location,
    backend: async () => backend2
  });
  function resolveRefs(fromRepo) {
    return async (collection, uris) => {
      const from2 = await fromRepo();
      const found = /* @__PURE__ */ new Map();
      const byBackend = /* @__PURE__ */ new Map();
      for (const uri of new Set(uris)) {
        const ref2 = parseAtUri(uri);
        if (!ref2.rkey || ref2.collection !== collection.nsid) continue;
        const backend2 = await backendFor(uri);
        byBackend.set(backend2, [...byBackend.get(backend2) ?? [], uri]);
      }
      const lookup = async (backend2, group) => {
        const client = clientFor(repoOf(backend2), collection);
        if (group.length === 1) {
          const record2 = await client.get(parseAtUri(group[0]).rkey);
          if (record2) found.set(group[0], record2);
          return record2 ? [] : group;
        }
        const wanted = new Set(group);
        for (const record2 of await client.list()) if (wanted.has(record2.uri)) found.set(record2.uri, record2);
        return group.filter((uri) => !found.has(uri));
      };
      await Promise.all([...byBackend].map(async ([backend2, group]) => {
        if (from2 !== backend2 && from2.repo === backend2.repo && from2.location !== backend2.location) {
          const spaceUris = group.map((uri) => uri.replace(`at://${backend2.repo}/`, `${from2.location}/`));
          const stillMissing = await lookup(from2, spaceUris);
          for (const [i, uri] of spaceUris.entries()) {
            const record2 = found.get(uri);
            if (record2) {
              found.delete(uri);
              found.set(group[i], record2);
            }
          }
          const remaining = group.filter((_, i) => stillMissing.includes(spaceUris[i]));
          if (remaining.length) await lookup(backend2, remaining);
          return;
        }
        await lookup(backend2, group);
      }));
      return found;
    };
  }
  const publicRepo = {
    key: "public",
    backend: async () => (await runtime()).public
  };
  const blobUrl2 = async (blob2) => (await runtime()).public.blobUrl(blob2);
  const collect = (defined, repo) => Object.fromEntries(Object.keys(defined).map((name) => [name, clientFor(repo, defined[name])]));
  function attach(target, attached2) {
    for (const [name, client] of Object.entries(attached2)) {
      if (name in target) throw new AirspaceError(`"${name}" is a reserved name`);
      Object.assign(target.collections, { [name]: client });
      Object.assign(target, { [name]: client });
    }
  }
  function space2(def) {
    const authority = async () => def.authority === "self" ? (await identity2()).did : def.authority;
    const uri = async () => spaceUri(await authority(), def.type, def.skey);
    const backend2 = async () => spaceBackend(await uri(), (await identity2()).did);
    const manager = once(async () => (await spaceLib()).createSpaceManager(def, await authority(), scopedClient(await spaceClient(await uri()))));
    const repo = {
      key: `space:${def.type}/${def.skey}/${def.authority}`,
      backend: backend2,
      extra: {
        publishTarget: (c) => clientFor(publicRepo, c),
        prepareWrite: async (value) => repoShapedRefs(value, await uri(), (await identity2()).did)
      }
    };
    const attached2 = collect(def.collections, repo);
    const base3 = {
      uri,
      supported: async () => spacesSupported(await uri()),
      collections: {},
      batch: createBatch(attached2, backend2),
      manage: {
        exists: async () => (await manager()).exists(),
        info: async () => (await manager()).info(),
        ensure: async (opts) => (await manager()).ensure(opts),
        update: async (opts) => (await manager()).update(opts),
        delete: async () => (await manager()).delete(),
        members: {
          list: async () => (await manager()).members.list(),
          add: async (did, access) => (await manager()).members.add(did, access),
          remove: async (did) => (await manager()).members.remove(did)
        }
      },
      blobs: {
        url: async (blob2) => (await backend2()).blobUrl(blob2),
        image: async (image2) => resolveImage(image2, (await backend2()).blobUrl)
      }
    };
    attach(base3, attached2);
    return base3;
  }
  const attached = collect(publicCollections(options.collections, options.spaces), publicRepo);
  const base2 = {
    identity: identity2,
    collections: {},
    spaces: {},
    batch: createBatch(attached, publicRepo.backend),
    blobs: {
      url: blobUrl2,
      image: async (image2) => resolveImage(image2, (await runtime()).public.blobUrl),
      upload: async (input, opts) => {
        const { session } = await runtime();
        if (!session) throw readOnly("upload");
        return await uploadBlob(session, input, opts);
      }
    },
    resolve: (async (uri, collection) => {
      const ref2 = parseAtUri(uri);
      if (!ref2.collection || !ref2.rkey) throw new AirspaceError(`not a record URI: ${uri}`);
      if (collection && collection.nsid !== ref2.collection) throw new AirspaceError(`${uri} is not a ${collection.nsid} record`);
      const backend2 = await backendFor(uri);
      if (collection) return await clientFor(repoOf(backend2), collection).get(ref2.rkey);
      const raw = await backend2.get(stub(ref2.collection), ref2.rkey);
      return raw && {
        uri: raw.uri,
        cid: raw.cid,
        rkey: ref2.rkey,
        author: backend2.repo,
        value: lexToJson(raw.value)
      };
    }),
    invalidate: (nsid) => {
      for (const byCollection of clients.values()) for (const [collection, client] of byCollection) if (!nsid || collection.nsid === nsid) client.invalidate();
    }
  };
  attach(base2, attached);
  for (const name of Object.keys(options.spaces ?? {})) {
    if (name in base2) throw new AirspaceError(`"${name}" is a reserved or duplicate name`);
    const client = space2(options.spaces[name]);
    Object.assign(base2.spaces, { [name]: client });
    Object.assign(base2, { [name]: client });
  }
  return base2;
}
function publicCollections(collections = {}, spaces = {}) {
  const derived = {};
  for (const space2 of Object.values(spaces)) for (const [name, collection] of Object.entries(space2.collections)) {
    const existing = derived[name];
    if (existing && existing !== collection) throw new AirspaceError(`spaces give the name "${name}" to two different collections (${existing.nsid} and ${collection.nsid}); name one of them in \`collections\``);
    derived[name] = collection;
  }
  return {
    ...derived,
    ...collections
  };
}
function persistentStore(storage, prefix, ttl) {
  const keyOf = (key) => `airspace:${prefix}\0${key}`.replaceAll(/[\0/]/g, ":");
  return {
    async get(key) {
      const raw = await storage.getItem(keyOf(key));
      return raw === null || raw === void 0 ? void 0 : { value: jsonToLex(raw) };
    },
    async set(key, value) {
      await storage.setItem(keyOf(key), lexToJson(value), ttl > 0 ? { ttl: Math.ceil(ttl / 1e3) } : void 0);
    },
    async clear() {
      const base2 = keyOf("");
      await Promise.all((await storage.getKeys(base2)).map((key) => storage.removeItem(key)));
    }
  };
}
function timestamps(options = {}) {
  const createdAt = options.createdAt ?? "createdAt";
  const updatedAt = options.updatedAt ?? "updatedAt";
  return definePlugin({
    name: "timestamps",
    write(value, ctx) {
      const fields = schemaFields(ctx.collection.schema);
      const now = (/* @__PURE__ */ new Date()).toISOString();
      const out = { ...value };
      if (ctx.operation === "create" && out[createdAt] === void 0 && fields?.has(createdAt)) out[createdAt] = now;
      if (ctx.operation === "put" && fields?.has(updatedAt)) out[updatedAt] = now;
      return out;
    }
  });
}
function parseCellWidths(row) {
  const widths = [];
  let cellContent = "";
  let inCell = false;
  for (let i = 0; i < row.length; i++) {
    const ch = row[i];
    const isEscapedPipe = ch === "|" && i > 0 && row[i - 1] === "\\";
    if (ch === "|" && !isEscapedPipe) {
      if (inCell && cellContent) {
        widths.push(cellContent.length);
        cellContent = "";
      }
      inCell = true;
    } else if (inCell) {
      cellContent += ch;
    }
  }
  if (inCell && cellContent) {
    widths.push(cellContent.length);
  }
  return widths;
}
function parseCells(row) {
  const cells = [];
  let cell = "";
  let inCell = false;
  for (let i = 0; i < row.length; i++) {
    const ch = row[i];
    const isEscapedPipe = ch === "|" && i > 0 && row[i - 1] === "\\";
    if (ch === "|" && !isEscapedPipe) {
      if (inCell) {
        cells.push(cell.trim());
        cell = "";
      }
      inCell = true;
    } else if (inCell) {
      cell += ch;
    }
  }
  if (cell.trim()) {
    cells.push(cell.trim());
  }
  return cells;
}
function closeTables(markdown2) {
  const lines = markdown2.split("\n");
  const tableBlocks = [];
  let blockStart = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim().startsWith("|")) {
      if (blockStart === -1)
        blockStart = i;
    } else if (blockStart !== -1) {
      tableBlocks.push({ start: blockStart, end: i - 1 });
      blockStart = -1;
    }
  }
  if (blockStart !== -1) {
    tableBlocks.push({ start: blockStart, end: lines.length - 1 });
  }
  if (tableBlocks.length === 0)
    return markdown2;
  const { start, end } = tableBlocks[tableBlocks.length - 1];
  const headerLine = lines[start].trim();
  if (!headerLine.endsWith("|")) {
    lines[start] += " |";
  }
  const columnCount = parseCellWidths(lines[start].trim()).length;
  const generateSeparator = () => "| " + Array(columnCount).fill("---").join(" | ") + " |";
  const secondLine = end - start >= 1 ? lines[start + 1].trim() : "";
  const hasSeparator = secondLine.startsWith("|") && (secondLine.includes("-") || secondLine.includes(":"));
  const lastLine = lines[end].trim();
  const isSeparator = lastLine.startsWith("|") && (lastLine.includes("-") || lastLine.includes(":"));
  if (isSeparator) {
    const sepCells = parseCells(lastLine);
    const completedCells = sepCells.map((cell) => {
      const hasLeftAlign = cell.startsWith(":");
      const hasRightAlign = cell.endsWith(":") && cell.length > 1;
      let dashes = cell.replace(/^:/, "").replace(/:$/, "");
      if (hasLeftAlign && hasRightAlign) {
        if (dashes.length < 1)
          dashes = "-";
        return ":" + dashes + ":";
      } else if (hasLeftAlign) {
        if (dashes.length < 1)
          dashes = "-";
        return ":" + dashes;
      } else if (hasRightAlign) {
        if (dashes.length < 1)
          dashes = "-";
        return dashes + ":";
      } else {
        while (dashes.length < 3)
          dashes += "-";
        return dashes;
      }
    });
    while (completedCells.length < columnCount) {
      completedCells.push("---");
    }
    lines[end] = "| " + completedCells.join(" | ") + " |";
  } else if (lastLine.startsWith("|") && !lastLine.endsWith("|")) {
    let refRow = lines[start].trim();
    for (let i = start + (hasSeparator ? 2 : 1); i < end; i++) {
      const row = lines[i].trim();
      if (row.startsWith("|") && row.endsWith("|") && !row.includes("-")) {
        refRow = row;
        break;
      }
    }
    const refWidths = parseCellWidths(refRow);
    const cells = parseCells(lastLine);
    const lastCell = cells[cells.length - 1] ?? "";
    const lastCellIncomplete = /(?:\*\*?|__?|~~|`|\$)$/.test(lastCell) || /(?:\*\*|__|~~|`)[^\s*_~`]+$/.test(lastCell);
    const padded = "| " + cells.map((cell, i) => {
      const targetWidth = refWidths[i] || cell.length + 2;
      const padding = " ".repeat(Math.max(0, targetWidth - cell.length - 2));
      return cell + padding;
    }).join(" | ");
    lines[end] = lastCellIncomplete ? padded : padded + " |";
  }
  if (!hasSeparator) {
    lines.splice(start + 1, 0, generateSeparator());
  }
  return lines.join("\n");
}
const INCOMPLETE_LINK_PLACEHOLDER = "comark:incomplete-link";
const INCOMPLETE_IMAGE_PLACEHOLDER = "comark:incomplete-image";
function autoCloseMarkdown(markdown2, options = {}) {
  if (!markdown2)
    return markdown2;
  const syntaxEnabled = options.syntax !== false;
  const attributesEnabled = options.attributes ?? syntaxEnabled;
  const linkMode = options.linkMode ?? "protocol";
  const linkPh = options.incompleteLinkPlaceholder ?? INCOMPLETE_LINK_PLACEHOLDER;
  const imagePh = options.incompleteImagePlaceholder ?? INCOMPLETE_IMAGE_PLACEHOLDER;
  const math = options.math === true;
  if (options.dropTrailingOpeners === true)
    markdown2 = dropTrailingOpeners(markdown2);
  const lines = markdown2.split("\n");
  const n = lines.length;
  let inFrontmatter = false;
  let frontmatterHasContent = false;
  let tableStart = -1;
  let inRawTextElement = null;
  let fenceOpen = false;
  let inBlockMath = false;
  const componentStack = [];
  const RAW_TEXT_OPEN_RE = /^<(script|pre|style|textarea)(\s|>|$)/i;
  for (let idx = 0; idx < n; idx++) {
    const line = lines[idx];
    const trimmed = line.trim();
    if (inRawTextElement) {
      if (new RegExp(`</${inRawTextElement}\\s*>`, "i").test(line))
        inRawTextElement = null;
      continue;
    }
    const rawMatch = trimmed.match(RAW_TEXT_OPEN_RE);
    if (rawMatch) {
      const tag = rawMatch[1].toLowerCase();
      if (!new RegExp(`</${tag}\\s*>`, "i").test(line))
        inRawTextElement = tag;
      continue;
    }
    if (isFenceLine(line)) {
      const t = line.trim();
      if (t.startsWith("```") && t.endsWith("``") && !t.endsWith("```") && !t.slice(3).includes("```")) {
        continue;
      }
      fenceOpen = !fenceOpen;
      continue;
    }
    if (fenceOpen)
      continue;
    if (math && trimmed === "$$") {
      inBlockMath = !inBlockMath;
      continue;
    }
    if (idx === 0 && options.frontmatter && trimmed === "---") {
      inFrontmatter = true;
      continue;
    }
    if (inFrontmatter) {
      if (trimmed === "---")
        inFrontmatter = false;
      else if (trimmed)
        frontmatterHasContent = true;
      continue;
    }
    if (trimmed === "---" && componentStack.length > 0) {
      const top = componentStack[componentStack.length - 1];
      top.hasYamlProps = !top.hasYamlProps;
      continue;
    }
    if (trimmed.startsWith("|"))
      tableStart = tableStart === -1 ? idx : tableStart;
    else if (tableStart !== -1)
      tableStart = -1;
    if (idx === n - 1 && syntaxEnabled && trimmed[0] === ":" && componentStack.length === 0) {
      let c = 0;
      while (c < trimmed.length && trimmed[c] === ":")
        c++;
      if (trimmed.slice(c).trim() === "")
        lines[idx] = "";
    }
    if (syntaxEnabled && trimmed[0] === ":") {
      let colonCount = 0;
      while (colonCount < trimmed.length && trimmed[colonCount] === ":")
        colonCount++;
      if (colonCount >= 2) {
        let ie = 0;
        while (ie < line.length && (line[ie] === " " || line[ie] === "	"))
          ie++;
        const indent = line.slice(0, ie);
        const ch = trimmed[colonCount] ?? "";
        if (ch >= "a" && ch <= "z" || ch >= "A" && ch <= "Z" || ch === "$") {
          let ne = colonCount;
          while (ne < trimmed.length) {
            const c = trimmed[ne];
            if (!(c >= "a" && c <= "z" || c >= "A" && c <= "Z" || c >= "0" && c <= "9" || c === "$" || c === "." || c === "-" || c === "_"))
              break;
            ne++;
          }
          componentStack.push({ depth: colonCount, name: trimmed.slice(colonCount, ne), indent, hasYamlProps: false });
        } else if (colonCount === trimmed.length && componentStack.length > 0) {
          if (componentStack[componentStack.length - 1].depth === colonCount)
            componentStack.pop();
        }
      }
    }
  }
  if (!fenceOpen && !inFrontmatter && !inBlockMath) {
    let healIdx = n - 1;
    while (healIdx > 0 && lines[healIdx] === "")
      healIdx--;
    const healLine = healIdx >= 0 ? lines[healIdx] : "";
    const trimmedHeal = healLine.trim();
    const incompleteInlineFence = trimmedHeal.startsWith("```") && trimmedHeal.endsWith("``") && !trimmedHeal.endsWith("```");
    if (healLine !== "" && trimmedHeal !== "$$" && (!isFenceLine(healLine) || incompleteInlineFence)) {
      lines[healIdx] = healInline(healLine, {
        attributesEnabled,
        linkMode,
        linkPh,
        imagePh,
        math
      });
    }
  }
  let result = lines.join("\n");
  result = applySetextGuard(result);
  if (tableStart !== -1)
    result = closeTables(result);
  if (math && inBlockMath) {
    result += result.endsWith("\n") ? "$$" : "\n$$";
  }
  if (inFrontmatter && frontmatterHasContent) {
    const last = result.includes("\n") ? result.slice(result.lastIndexOf("\n") + 1) : result;
    const t = last.trim().replace(/\u200B/g, "");
    if (t === "-" || t === "--")
      result = result.replace(/\u200B+$/, "") + "-".repeat(3 - t.length);
    else
      result += result.endsWith("\n") ? "---" : "\n---";
  }
  if (syntaxEnabled && markdown2.includes("::")) {
    const ls = result.lastIndexOf("\n") + 1;
    const fl = result.slice(ls);
    let brace = -1;
    for (let i = fl.length - 1; i >= 0; i--) {
      if (fl[i] === "}")
        break;
      if (fl[i] === "{") {
        brace = i;
        break;
      }
    }
    if (brace >= 0) {
      const body = fl.slice(brace + 1);
      let dq = 0, sq = 0;
      for (let i = 0; i < body.length; i++) {
        if (body[i] === '"')
          dq++;
        if (body[i] === "'")
          sq++;
      }
      result += (dq % 2 === 1 ? '"' : "") + (sq % 2 === 1 ? "'" : "") + "}";
    }
    if (componentStack.length > 0) {
      const top = componentStack[componentStack.length - 1];
      const nt = result.slice(result.lastIndexOf("\n") + 1).trim().replace(/\u200B/g, "");
      if (top.hasYamlProps && (nt === "-" || nt === "--")) {
        result = result.replace(/\u200B+$/, "") + "-".repeat(3 - nt.length);
        top.hasYamlProps = false;
      }
      const closers = [];
      while (componentStack.length) {
        const c = componentStack.pop();
        if (c.hasYamlProps)
          closers.push(c.indent + "---");
        closers.push(c.indent + ":".repeat(c.depth));
      }
      result += "\n" + closers.join("\n");
    }
  }
  return result;
}
function isFenceLine(line) {
  let i = 0;
  while (i < line.length && (line[i] === " " || line[i] === "	"))
    i++;
  const ch = line[i];
  if (ch !== "`" && ch !== "~")
    return false;
  let n = 0;
  while (i + n < line.length && line[i + n] === ch)
    n++;
  return n >= 3;
}
function isWord(ch) {
  if (!ch)
    return false;
  const c = ch.charCodeAt(0);
  return c >= 48 && c <= 57 || c >= 65 && c <= 90 || c >= 97 && c <= 122 || c === 95;
}
function isSpace$1(ch) {
  return ch === "" || ch === " " || ch === "	" || ch === "\n";
}
const TRAILING_OPENERS = "*_$:[{!";
function dropTrailingOpeners(text2) {
  let ws = text2.length;
  while (ws > 0) {
    const c = text2[ws - 1];
    if (c === " " || c === "	" || c === "\n" || c === "\r")
      ws--;
    else
      break;
  }
  if (ws === 0)
    return text2;
  let i = ws;
  while (i > 0 && TRAILING_OPENERS.includes(text2[i - 1])) {
    if (i >= 2 && text2[i - 2] === "\\")
      break;
    i--;
  }
  if (i === ws)
    return text2;
  const before = i > 0 ? text2[i - 1] : "";
  if (before !== "" && before !== " " && before !== "	" && before !== "\n" && before !== "\r") {
    return text2;
  }
  let keep = i;
  if (keep > 0 && (text2[keep - 1] === " " || text2[keep - 1] === "	"))
    keep--;
  return text2.slice(0, keep) + text2.slice(ws);
}
function healInline(text2, opts) {
  if (text2.endsWith(" ") && !text2.endsWith("  ")) {
    const nl = text2.lastIndexOf("\n");
    const last = nl === -1 ? text2 : text2.slice(nl + 1);
    if (!/^[ \t]*[A-Za-z_][\w.-]*: $/.test(last))
      text2 = text2.slice(0, -1);
  }
  const len = text2.length;
  const out = [];
  let stack = [];
  let fence2 = false;
  let inCode = false;
  let inMath = false;
  let inBlockMath = false;
  let inAttr = 0;
  let lineStartSrc = 0;
  let bracketDepth = 0;
  let linkUrlOpen = false;
  let lastLtOut = -1;
  let asteriskTotal = 0;
  let doubleAsteriskCount = 0;
  let tripleCount = 0;
  const toggleFlanking = (m, prevCh, afterCh) => {
    const canClose = !isSpace$1(prevCh) && stack[stack.length - 1] === m;
    const canOpen = !isSpace$1(afterCh);
    if (canClose)
      stack.pop();
    else if (canOpen)
      stack.push(m);
  };
  const toggle = (m) => {
    if (stack[stack.length - 1] === m)
      stack.pop();
    else
      stack.push(m);
  };
  for (let i = 0; i < len; i++) {
    const ch = text2[i];
    const prev = i > 0 ? text2[i - 1] : "";
    const next = i + 1 < len ? text2[i + 1] : "";
    if (ch === "\n") {
      out.push(ch);
      lineStartSrc = i + 1;
      continue;
    }
    if (i === lineStartSrc || i > 0 && text2[i - 1] === "\n") {
      let j = i;
      while (j < len && (text2[j] === " " || text2[j] === "	"))
        j++;
      const fenceCh = text2[j];
      if (fenceCh === "`" || fenceCh === "~") {
        let n = 0;
        while (j + n < len && text2[j + n] === fenceCh)
          n++;
        if (n >= 3) {
          let lineEnd = j;
          while (lineEnd < len && text2[lineEnd] !== "\n")
            lineEnd++;
          const lineBody = text2.slice(j, lineEnd);
          if (fenceCh === "`" && lineBody.startsWith("```") && lineBody.endsWith("``") && !lineBody.endsWith("```") && !lineBody.slice(3).includes("```")) {
            while (i < lineEnd) {
              out.push(text2[i]);
              i++;
            }
            out.push("`");
            i--;
            continue;
          }
          fence2 = !fence2;
          while (i < len && text2[i] !== "\n") {
            out.push(text2[i]);
            i++;
          }
          if (i < len) {
            out.push("\n");
            lineStartSrc = i + 1;
          } else
            i--;
          continue;
        }
      }
    }
    if (fence2) {
      out.push(ch);
      continue;
    }
    if (ch === "\\") {
      out.push(ch);
      if (i + 1 < len) {
        out.push(text2[++i]);
      }
      continue;
    }
    if (ch === ">") {
      let ls = i;
      while (ls > 0 && text2[ls - 1] !== "\n")
        ls--;
      const prefix = text2.slice(ls, i);
      if (/^(\s*(?:[-*+]|\d+[.)]) +)$/.test(prefix) && /^=?\s*\$?\d/.test(text2.slice(i + 1))) {
        out.push("\\", ">");
        continue;
      }
    }
    if (ch === "~" && next !== "~" && prev !== "~" && isWord(prev) && isWord(next) && !inCode && !inMath && !inBlockMath && !isPairedSingleTilde(text2, i)) {
      out.push("\\", "~");
      continue;
    }
    if (ch === "<" && (next >= "a" && next <= "z" || next >= "A" && next <= "Z" || next === "/")) {
      lastLtOut = out.length;
    }
    if (ch === ">")
      lastLtOut = -1;
    if (inCode) {
      out.push(ch);
      if (ch === "`" && next !== "`" && prev !== "`") {
        inCode = false;
        if (stack[stack.length - 1] === "`")
          stack.pop();
      }
      continue;
    }
    if (inBlockMath) {
      out.push(ch);
      if (ch === "$" && next === "$") {
        out.push("$");
        i++;
        inBlockMath = false;
        if (stack[stack.length - 1] === "$$")
          stack.pop();
      }
      continue;
    }
    if (inMath) {
      out.push(ch);
      if (ch === "$" && next !== "$") {
        inMath = false;
        if (stack[stack.length - 1] === "$")
          stack.pop();
      }
      continue;
    }
    if (opts.attributesEnabled && ch === "{" && prev && prev !== " " && prev !== "	" && prev !== "\n") {
      inAttr++;
      out.push(ch);
      continue;
    }
    if (opts.attributesEnabled && ch === "}") {
      if (inAttr > 0)
        inAttr--;
      out.push(ch);
      continue;
    }
    if (inAttr > 0) {
      out.push(ch);
      continue;
    }
    if (ch === "[") {
      bracketDepth++;
      out.push(ch);
      continue;
    }
    if (ch === "]") {
      if (bracketDepth > 0)
        bracketDepth--;
      out.push(ch);
      if (next === "(") {
        linkUrlOpen = true;
      }
      continue;
    }
    if (linkUrlOpen) {
      out.push(ch);
      if (ch === ")" && bracketDepth === 0) {
        linkUrlOpen = false;
      }
      continue;
    }
    if (bracketDepth > 0) {
      out.push(ch);
      continue;
    }
    if (ch === "`") {
      if (next === "`" && text2[i + 2] === "`") {
        out.push("`", "`", "`");
        i += 2;
        continue;
      }
      out.push(ch);
      inCode = true;
      stack.push("`");
      continue;
    }
    if (ch === "$") {
      out.push(ch);
      if (next === "$") {
        out.push("$");
        i++;
        if (opts.math) {
          inBlockMath = !inBlockMath;
          toggle("$$");
        }
      } else if (opts.math && looksLikeInlineMathOpen(text2, i)) {
        inMath = true;
        stack.push("$");
      }
      continue;
    }
    if (ch === "*") {
      let end = i;
      while (end + 1 < len && text2[end + 1] === "*")
        end++;
      const run = end - i + 1;
      const after = end + 1 < len ? text2[end + 1] : "";
      const leftSpace = isSpace$1(prev);
      const rightSpace = isSpace$1(after);
      const surroundedSingle = run === 1 && leftSpace && rightSpace;
      for (let k = i; k <= end; k++)
        out.push("*");
      if (!surroundedSingle) {
        if (run === 1 && isWord(prev) && isWord(after) && asteriskTotal % 2 === 0) {
          i = end;
          continue;
        }
        asteriskTotal += run;
        if (run === 1)
          toggleFlanking("*", prev, after);
        else if (run === 2) {
          doubleAsteriskCount++;
          toggleFlanking("**", prev, after);
        } else if (run >= 3) {
          let ls = i;
          while (ls > 0 && text2[ls - 1] !== "\n")
            ls--;
          let le = end + 1;
          while (le < len && text2[le] !== "\n")
            le++;
          const lineContent = text2.slice(ls, le);
          let onlyStars = true;
          for (let li = 0; li < lineContent.length; li++) {
            const c = lineContent[li];
            if (c !== "*" && c !== " " && c !== "	") {
              onlyStars = false;
              break;
            }
          }
          if (onlyStars) {
            i = end;
            continue;
          }
          if (run === 3) {
            const hasStar = stack.includes("*");
            const hasBold = stack.includes("**");
            if (hasStar && hasBold && !leftSpace) {
              for (let si = stack.length - 1; si >= 0; si--) {
                if (stack[si] === "*" || stack[si] === "**")
                  stack.splice(si, 1);
              }
              doubleAsteriskCount++;
            } else {
              tripleCount++;
              toggleFlanking("***", prev, after);
            }
          } else {
            const pairs = Math.floor(run / 2);
            for (let p = 0; p < pairs; p++) {
              doubleAsteriskCount++;
              toggleFlanking("**", prev, after);
            }
            if (run % 2 === 1)
              toggleFlanking("*", prev, after);
          }
          i = end;
          continue;
        }
      }
      i = end;
      continue;
    }
    if (ch === "_") {
      let end = i;
      while (end + 1 < len && text2[end + 1] === "_")
        end++;
      const run = end - i + 1;
      const after = end + 1 < len ? text2[end + 1] : "";
      const surrounded = isSpace$1(prev) && isSpace$1(after);
      for (let k = i; k <= end; k++)
        out.push("_");
      if (run >= 3) {
        let ls = i;
        while (ls > 0 && text2[ls - 1] !== "\n")
          ls--;
        let le = end + 1;
        while (le < len && text2[le] !== "\n")
          le++;
        const lineContent = text2.slice(ls, le);
        let only = true;
        for (let li = 0; li < lineContent.length; li++) {
          const c = lineContent[li];
          if (c !== "_" && c !== " " && c !== "	") {
            only = false;
            break;
          }
        }
        if (only) {
          i = end;
          continue;
        }
      }
      if (!(isWord(prev) && isWord(after)) && !surrounded) {
        if (run === 1)
          toggleFlanking("_", prev, after);
        else if (run >= 2) {
          const pairs = Math.floor(run / 2);
          for (let p = 0; p < pairs; p++) {
            toggleFlanking("__", prev, after);
          }
          if (run % 2 === 1)
            toggleFlanking("_", prev, after);
        }
      }
      i = end;
      continue;
    }
    if (ch === "~") {
      let end = i;
      while (end + 1 < len && text2[end + 1] === "~")
        end++;
      const run = end - i + 1;
      const after = end + 1 < len ? text2[end + 1] : "";
      const surrounded = isSpace$1(prev) && isSpace$1(after);
      for (let k = i; k <= end; k++)
        out.push("~");
      if (!surrounded && run >= 2) {
        const pairs = Math.floor(run / 2);
        for (let p = 0; p < pairs; p++)
          toggleFlanking("~~", prev, after);
      }
      i = end;
      continue;
    }
    out.push(ch);
  }
  let result = out.join("");
  if (lastLtOut >= 0) {
    result = stripIncompleteHtmlEnd(result);
  }
  const linked = healLinks(result, opts);
  if (linked !== result) {
    if (opts.linkMode === "protocol" && (linked.endsWith(`](${opts.linkPh})`) || linked.endsWith(`](${opts.imagePh})`))) {
      return linked;
    }
    result = linked;
  }
  if (stack.length === 0) {
    return result;
  }
  if (isBareOrHr(result))
    return result;
  if (inCode) {
    const lastBq = result.lastIndexOf("`");
    const afterBq = lastBq >= 0 ? result.slice(lastBq + 1) : "";
    if (afterBq.length > 0) {
      let codeIdx = -1;
      for (let si = 0; si < stack.length; si++)
        if (stack[si] === "`")
          codeIdx = si;
      let inner = "";
      if (codeIdx > 0) {
        for (let si = codeIdx - 1; si >= 0; si--) {
          const m = stack[si];
          if (m === "**" || m === "*" || m === "__" || m === "_" || m === "~~" || m === "***")
            inner += m;
        }
      }
      for (let si = stack.length - 1; si > codeIdx; si--) {
        const m = stack[si];
        if (m === "**" || m === "*" || m === "__" || m === "_" || m === "~~" || m === "***")
          inner += m;
      }
      return result + inner + "`";
    }
    return result;
  }
  result = closeOpenStack(result, stack, {
    asteriskTotal,
    doubleAsteriskCount,
    tripleCount
  });
  return result;
}
function stripIncompleteHtmlEnd(text2) {
  for (let i = text2.length - 1; i >= 0; i--) {
    if (text2[i] === ">")
      return text2;
    if (text2[i] === "\n")
      return text2;
    if (text2[i] === "<") {
      const n = text2[i + 1] ?? "";
      if (n >= "a" && n <= "z" || n >= "A" && n <= "Z" || n === "/") {
        return text2.slice(0, i).replace(/[ \t]+$/, "");
      }
      return text2;
    }
  }
  return text2;
}
function isBareOrHr(text2) {
  const nl = text2.lastIndexOf("\n");
  const last = (nl === -1 ? text2 : text2.slice(nl + 1)).trim();
  if (!last)
    return false;
  if (last === "*" || last === "**" || last === "***" || last === "****" || last === "_" || last === "__" || last === "___" || last === "~" || last === "~~" || last === "`")
    return true;
  if (/^\*{3,}$/.test(last) || /^_{3,}$/.test(last) || /^-{3,}$/.test(last))
    return true;
  return false;
}
function closeOpenStack(text2, stack, counts) {
  if (/\*\*\*[^*]+\*{1,2}$/.test(text2) && !/\*{3}$/.test(text2)) {
    const trail = text2.match(/\*+$/)?.[0].length ?? 0;
    if (trail >= 1 && trail <= 2 && (stack.includes("***") || counts.tripleCount % 2 === 1)) {
      return text2 + "*".repeat(3 - trail);
    }
  }
  if (/\*\*[^*]+\*$/.test(text2) && stack.includes("**") && !stack.includes("***"))
    return text2 + "*";
  if (/__[^_]+_$/.test(text2) && stack.includes("__"))
    return text2 + "_";
  if (/~~[^~]+~$/.test(text2) && stack.includes("~~"))
    return text2 + "~";
  const balancedOverlap = counts.doubleAsteriskCount >= 2 && counts.doubleAsteriskCount % 2 === 0 && counts.asteriskTotal % 2 === 0;
  let workStack = stack.slice();
  if (balancedOverlap) {
    workStack = workStack.filter((m) => m !== "***" && m !== "**" && m !== "*");
  }
  const closable = [];
  for (let i = workStack.length - 1; i >= 0; i--) {
    const m = workStack[i];
    if (m === "$$") {
      closable.push("$$");
      continue;
    }
    if (m === "$") {
      closable.push("$");
      continue;
    }
    if (m === "`")
      continue;
    const token = m;
    const pos = text2.lastIndexOf(token);
    if (pos < 0)
      continue;
    const after = text2.slice(pos + token.length);
    if (!hasClosableContentAfter(after))
      continue;
    closable.push(m);
  }
  if (closable.length === 0)
    return text2;
  const hasStarFamily = closable.includes("*") || closable.includes("**") || closable.includes("***");
  if (hasStarFamily) {
    let firstStar = null;
    for (const m of closable) {
      if (m === "*" || m === "**" || m === "***") {
        firstStar = m;
        break;
      }
    }
    if (firstStar === "*" && closable.includes("**") && !closable.includes("***")) {
      if (closable[0] === "*") {
        for (let ci = closable.length - 1; ci >= 0; ci--) {
          if (closable[ci] === "**" || closable[ci] === "***")
            closable.splice(ci, 1);
        }
      }
    }
  }
  let suffix = "";
  for (const m of closable) {
    if (m === "$$") {
      if (text2.endsWith("$") && !text2.endsWith("$$"))
        suffix += "$";
      else {
        const first = text2.indexOf("$$");
        const multi = first !== -1 && text2.indexOf("\n", first) !== -1;
        suffix += multi && !text2.endsWith("\n") ? "\n$$" : "$$";
      }
    } else {
      suffix += m;
    }
  }
  if (text2.endsWith(" ") && !text2.endsWith("  "))
    return text2.slice(0, -1) + suffix;
  let end = text2.length;
  while (end > 0 && text2[end - 1] === "\n")
    end--;
  if (end < text2.length)
    return text2.slice(0, end) + suffix + text2.slice(end);
  return text2 + suffix;
}
function healLinks(text2, opts) {
  const lastParen = text2.lastIndexOf("](");
  if (lastParen !== -1) {
    const after = text2.slice(lastParen + 2);
    if (!after.includes(")") && !isPosInFence(text2, lastParen)) {
      let depth = 1;
      let open = -1;
      for (let i = lastParen - 1; i >= 0; i--) {
        if (text2[i] === "]")
          depth++;
        else if (text2[i] === "[") {
          depth--;
          if (depth === 0) {
            open = i;
            break;
          }
        }
      }
      if (open >= 0 && !isPosInFence(text2, open)) {
        const isImage = open > 0 && text2[open - 1] === "!";
        const start = isImage ? open - 1 : open;
        const before = text2.slice(0, start);
        const alt = text2.slice(open + 1, lastParen);
        if (isImage)
          return `${before}![${alt}](${opts.imagePh})`;
        if (opts.linkMode === "text-only")
          return before + alt;
        return `${before}[${alt}](${opts.linkPh})`;
      }
    }
  }
  for (let i = text2.length - 1; i >= 0; i--) {
    if (text2[i] !== "[" || isPosInFence(text2, i))
      continue;
    const isImage = i > 0 && text2[i - 1] === "!";
    let depth = 1;
    let close = -1;
    for (let j = i + 1; j < text2.length; j++) {
      if (text2[j] === "[")
        depth++;
      else if (text2[j] === "]") {
        depth--;
        if (depth === 0) {
          close = j;
          break;
        }
      }
    }
    if (close === -1) {
      const start = isImage ? i - 1 : i;
      const before = text2.slice(0, start);
      if (isImage)
        return `${before}![${text2.slice(i + 1)}](${opts.imagePh})`;
      if (opts.linkMode === "text-only")
        return text2.slice(0, i) + text2.slice(i + 1);
      return `${text2}](${opts.linkPh})`;
    }
    if (isImage && (close === text2.length - 1 || text2[close + 1] !== "(")) {
      if (text2.slice(close + 1).trim() === "") {
        return `${text2.slice(0, i - 1)}![${text2.slice(i + 1, close)}](${opts.imagePh})`;
      }
    }
  }
  return text2;
}
function isPosInFence(text2, pos) {
  let fence2 = false;
  let i = 0;
  while (i < pos) {
    if (i === 0 || text2[i - 1] === "\n") {
      let j = i;
      while (j < text2.length && (text2[j] === " " || text2[j] === "	"))
        j++;
      const ch = text2[j];
      if (ch === "`" || ch === "~") {
        let n = 0;
        while (j + n < text2.length && text2[j + n] === ch)
          n++;
        if (n >= 3) {
          fence2 = !fence2;
          while (i < text2.length && text2[i] !== "\n")
            i++;
          if (i < text2.length)
            i++;
          continue;
        }
      }
    }
    i++;
  }
  return fence2;
}
function applySetextGuard(text2) {
  const lastNl = text2.lastIndexOf("\n");
  if (lastNl === -1)
    return text2;
  const last = text2.slice(lastNl + 1);
  const t = last.trim();
  if (!/^(-{1,2}|={1,2})$/.test(t))
    return text2;
  if (/\s$/.test(last) && last !== t)
    return text2;
  const prevBlock = text2.slice(0, lastNl);
  const pNl = prevBlock.lastIndexOf("\n");
  const prev = (pNl === -1 ? prevBlock : prevBlock.slice(pNl + 1)).trim();
  if (!prev)
    return text2;
  if (prev === "---" || /^[A-Za-z_][\w.-]*\s*:/.test(prev))
    return text2;
  return text2 + "​";
}
function isPairedSingleTilde(text2, i) {
  const isSingleTildeAt = (j) => {
    if (text2[j] !== "~")
      return false;
    const p = j > 0 ? text2[j - 1] : "";
    const n = j + 1 < text2.length ? text2[j + 1] : "";
    return p !== "~" && n !== "~";
  };
  const tightBetween = (from2, to) => {
    if (to - from2 < 1)
      return false;
    for (let k = from2; k < to; k++) {
      const c = text2[k];
      if (c === "~" || c === " " || c === "	" || c === "\n" || c === "\r")
        return false;
    }
    return true;
  };
  for (let j = i - 1; j >= 0; j--) {
    if (text2[j] === "\n")
      break;
    if (text2[j] === "~") {
      if (!isSingleTildeAt(j))
        return false;
      const openPrev = j > 0 ? text2[j - 1] : "";
      if (!isWord(openPrev))
        return false;
      const closeNext = i + 1 < text2.length ? text2[i + 1] : "";
      if (!isWord(closeNext))
        return false;
      return tightBetween(j + 1, i);
    }
  }
  for (let j = i + 1; j < text2.length; j++) {
    if (text2[j] === "\n")
      break;
    if (text2[j] === "~") {
      if (!isSingleTildeAt(j))
        return false;
      const openPrev = i > 0 ? text2[i - 1] : "";
      if (!isWord(openPrev))
        return false;
      const closeNext = j + 1 < text2.length ? text2[j + 1] : "";
      if (!isWord(closeNext))
        return false;
      return tightBetween(i + 1, j);
    }
  }
  return false;
}
function looksLikeInlineMathOpen(text2, i) {
  const next = i + 1 < text2.length ? text2[i + 1] : "";
  if (!next || next === " " || next === "	" || next === "\n")
    return false;
  if (next >= "0" && next <= "9")
    return false;
  const prev = i > 0 ? text2[i - 1] : "";
  if (prev === ":")
    return false;
  return true;
}
function hasClosableContentAfter(after) {
  for (let i = 0; i < after.length; i++) {
    const c = after[i];
    if (c === " " || c === "	" || c === "\n" || c === "\r")
      continue;
    if (c === "*" || c === "_" || c === "~" || c === "`")
      continue;
    return true;
  }
  return false;
}
function applyAutoUnwrap(node) {
  if (typeof node === "string" || node.length < 2) {
    return node;
  }
  const [tag, props, ...children] = node;
  const nonEmptyChildren = children.filter((child) => typeof child !== "string" || child && child.trim());
  if (nonEmptyChildren.length === 0) {
    return node;
  }
  if (nonEmptyChildren.length > 1 || typeof nonEmptyChildren[0] === "string" || nonEmptyChildren[0][0] !== "p") {
    return [tag, props, ...children.map((child) => applyAutoUnwrap(child))];
  }
  const paragraphAttrs = nonEmptyChildren[0][1];
  const mergedProps = paragraphAttrs && Object.keys(paragraphAttrs).length > 0 ? { ...paragraphAttrs, ...props } : props;
  return [tag, mergedProps, ...nonEmptyChildren[0].slice(2)];
}
var __defProp = Object.defineProperty;
var __exportAll = (all, symbols) => {
  let target = {};
  for (var name in all) {
    __defProp(target, name, {
      get: all[name],
      enumerable: true
    });
  }
  return target;
};
var _a;
const decodeMap = /* @__PURE__ */ new Map([
  [0, 65533],
  // C1 Unicode control character reference replacements
  [128, 8364],
  [130, 8218],
  [131, 402],
  [132, 8222],
  [133, 8230],
  [134, 8224],
  [135, 8225],
  [136, 710],
  [137, 8240],
  [138, 352],
  [139, 8249],
  [140, 338],
  [142, 381],
  [145, 8216],
  [146, 8217],
  [147, 8220],
  [148, 8221],
  [149, 8226],
  [150, 8211],
  [151, 8212],
  [152, 732],
  [153, 8482],
  [154, 353],
  [155, 8250],
  [156, 339],
  [158, 382],
  [159, 376]
]);
const fromCodePoint$2 = (
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition, n/no-unsupported-features/es-builtins
  (_a = String.fromCodePoint) !== null && _a !== void 0 ? _a : ((codePoint) => {
    let output = "";
    if (codePoint > 65535) {
      codePoint -= 65536;
      output += String.fromCharCode(codePoint >>> 10 & 1023 | 55296);
      codePoint = 56320 | codePoint & 1023;
    }
    output += String.fromCharCode(codePoint);
    return output;
  })
);
function replaceCodePoint(codePoint) {
  var _a2;
  if (codePoint >= 55296 && codePoint <= 57343 || codePoint > 1114111) {
    return 65533;
  }
  return (_a2 = decodeMap.get(codePoint)) !== null && _a2 !== void 0 ? _a2 : codePoint;
}
function decodeBase64(input) {
  const binary = (
    // eslint-disable-next-line n/no-unsupported-features/node-builtins
    typeof atob === "function" ? (
      // Browser (and Node >=16)
      // eslint-disable-next-line n/no-unsupported-features/node-builtins
      atob(input)
    ) : (
      // Older Node versions (<16)
      // eslint-disable-next-line n/no-unsupported-features/node-builtins
      typeof Buffer.from === "function" ? (
        // eslint-disable-next-line n/no-unsupported-features/node-builtins
        Buffer.from(input, "base64").toString("binary")
      ) : (
        // eslint-disable-next-line unicorn/no-new-buffer, n/no-deprecated-api
        new Buffer(input, "base64").toString("binary")
      )
    )
  );
  const evenLength = binary.length & -2;
  const out = new Uint16Array(evenLength / 2);
  for (let index2 = 0, outIndex = 0; index2 < evenLength; index2 += 2) {
    const lo = binary.charCodeAt(index2);
    const hi = binary.charCodeAt(index2 + 1);
    out[outIndex++] = lo | hi << 8;
  }
  return out;
}
const htmlDecodeTree = /* @__PURE__ */ decodeBase64("QR08ALkAAgH6AYsDNQR2BO0EPgXZBQEGLAbdBxMISQrvCmQLfQurDKQNLw4fD4YPpA+6D/IPAAAAAAAAAAAAAAAAKhBMEY8TmxUWF2EYLBkxGuAa3RsJHDscWR8YIC8jSCSIJcMl6ie3Ku8rEC0CLjoupS7kLgAIRU1hYmNmZ2xtbm9wcnN0dVQAWgBeAGUAaQBzAHcAfgCBAIQAhwCSAJoAoACsALMAbABpAGcAO4DGAMZAUAA7gCYAJkBjAHUAdABlADuAwQDBQHIiZXZlAAJhAAFpeW0AcgByAGMAO4DCAMJAEGRyAADgNdgE3XIAYQB2AGUAO4DAAMBA8CFoYZFj4SFjcgBhZAAAoFMqAAFncIsAjgBvAG4ABGFmAADgNdg43fAlbHlGdW5jdGlvbgCgYSBpAG4AZwA7gMUAxUAAAWNzpACoAHIAAOA12Jzc6SFnbgCgVCJpAGwAZABlADuAwwDDQG0AbAA7gMQAxEAABGFjZWZvcnN1xQDYANoA7QDxAPYA+QD8AAABY3LJAM8AayNzbGFzaAAAoBYidgHTANUAAKDnKmUAZAAAoAYjeQARZIABY3J0AOAA5QDrAGEidXNlAACgNSLuI291bGxpcwCgLCFhAJJjcgAA4DXYBd1wAGYAAOA12Dnd5SF2ZdhiYwDyAOoAbSJwZXEAAKBOIgAHSE9hY2RlZmhpbG9yc3UXARoBHwE6AVIBVQFiAWQBZgGCAakB6QHtAfIBYwB5ACdkUABZADuAqQCpQIABY3B5ACUBKAE1AfUhdGUGYWmg0iJ0KGFsRGlmZmVyZW50aWFsRAAAoEUhbCJleXMAAKAtIQACYWVpb0EBRAFKAU0B8iFvbgxhZABpAGwAO4DHAMdAcgBjAAhhbiJpbnQAAKAwIm8AdAAKYQABZG5ZAV0BaSJsbGEAuGB0I2VyRG90ALdg8gA5AWkAp2NyImNsZQAAAkRNUFRwAXQBeQF9AW8AdAAAoJkiaSJudXMAAKCWIuwhdXMAoJUiaSJtZXMAAKCXIm8AAAFjc4cBlAFrKndpc2VDb250b3VySW50ZWdyYWwAAKAyImUjQ3VybHkAAAFEUZwBpAFvJXVibGVRdW90ZQAAoB0gdSJvdGUAAKAZIAACbG5wdbABtgHNAdgBbwBuAGWgNyIAoHQqgAFnaXQAvAHBAcUB8iJ1ZW50AKBhIm4AdAAAoC8i7yV1ckludGVncmFsAKAuIgABZnLRAdMBAKACIe8iZHVjdACgECJuLnRlckNsb2Nrd2lzZUNvbnRvdXJJbnRlZ3JhbAAAoDMi7yFzcwCgLypjAHIAAOA12J7ccABDoNMiYQBwAACgTSKABURKU1phY2VmaW9zAAsCEgIVAhgCGwIsAjQCOQI9AnMCfwNvoEUh9CJyYWhkAKARKWMAeQACZGMAeQAFZGMAeQAPZIABZ3JzACECJQIoAuchZXIAoCEgcgAAoKEhaAB2AACg5CoAAWF5MAIzAvIhb24OYRRkbAB0oAciYQCUY3IAAOA12AfdAAFhZkECawIAAWNtRQJnAvIjaXRpY2FsAAJBREdUUAJUAl8CYwJjInV0ZQC0YG8AdAFZAloC2WJiJGxlQWN1dGUA3WJyImF2ZQBgYGkibGRlANxi7yFuZACgxCJmJWVyZW50aWFsRAAAoEYhcAR9AgAAAAAAAIECjgIAABoDZgAA4DXYO91EoagAhQKJAm8AdAAAoNwgcSJ1YWwAAKBQIuIhbGUAA0NETFJVVpkCqAK1Au8C/wIRA28AbgB0AG8AdQByAEkAbgB0AGUAZwByAGEA7ADEAW8AdAKvAgAAAACwAqhgbiNBcnJvdwAAoNMhAAFlb7kC0AJmAHQAgAFBUlQAwQLGAs0CciJyb3cAAKDQIekkZ2h0QXJyb3cAoNQhZQDlACsCbgBnAAABTFLWAugC5SFmdAABQVLcAuECciJyb3cAAKD4J+kkZ2h0QXJyb3cAoPon6SRnaHRBcnJvdwCg+SdpImdodAAAAUFU9gL7AnIicm93AACg0iFlAGUAAKCoInAAQQIGAwAAAAALA3Iicm93AACg0SFvJHduQXJyb3cAAKDVIWUlcnRpY2FsQmFyAACgJSJuAAADQUJMUlRhJAM2AzoDWgNxA3oDciJyb3cAAKGTIUJVLAMwA2EAcgAAoBMpcCNBcnJvdwAAoPUhciJldmUAEWPlIWZ00gJDAwAASwMAAFIDaSVnaHRWZWN0b3IAAKBQKWUkZVZlY3RvcgAAoF4p5SJjdG9yQqC9IWEAcgAAoFYpaSJnaHQA1AFiAwAAaQNlJGVWZWN0b3IAAKBfKeUiY3RvckKgwSFhAHIAAKBXKWUAZQBBoKQiciJyb3cAAKCnIXIAcgBvAPcAtAIAAWN0gwOHA3IAAOA12J/c8iFvaxBhAAhOVGFjZGZnbG1vcHFzdHV4owOlA6kDsAO/A8IDxgPNA9ID8gP9AwEEFAQeBCAEJQRHAEphSAA7gNAA0EBjAHUAdABlADuAyQDJQIABYWl5ALYDuQO+A/Ihb24aYXIAYwA7gMoAykAtZG8AdAAWYXIAAOA12AjdcgBhAHYAZQA7gMgAyEDlIm1lbnQAoAgiAAFhcNYD2QNjAHIAEmF0AHkAUwLhAwAAAADpA20lYWxsU3F1YXJlAACg+yVlJ3J5U21hbGxTcXVhcmUAAKCrJQABZ3D2A/kDbwBuABhhZgAA4DXYPN3zImlsb26VY3UAAAFhaQYEDgRsAFSgdSppImxkZQAAoEIi7CNpYnJpdW0AoMwhAAFjaRgEGwRyAACgMCFtAACgcyphAJdjbQBsADuAywDLQAABaXApBC0E8yF0cwCgAyLvJG5lbnRpYWxFAKBHIYACY2Zpb3MAPQQ/BEMEXQRyBHkAJGRyAADgNdgJ3WwibGVkAFMCTAQAAAAAVARtJWFsbFNxdWFyZQAAoPwlZSdyeVNtYWxsU3F1YXJlAACgqiVwA2UEAABpBAAAAABtBGYAAOA12D3dwSFsbACgACLyI2llcnRyZgCgMSFjAPIAcQQABkpUYWJjZGZnb3JzdIgEiwSOBJMElwSkBKcEqwStBLIE5QTqBGMAeQADZDuAPgA+QO0hbWFkoJMD3GNyImV2ZQAeYYABZWl5AJ0EoASjBOQhaWwiYXIAYwAcYRNkbwB0ACBhcgAA4DXYCt0AoNkicABmAADgNdg+3eUiYXRlcgADRUZHTFNUvwTIBM8E1QTZBOAEcSJ1YWwATKBlIuUhc3MAoNsidSRsbEVxdWFsAACgZyJyI2VhdGVyAACgoirlIXNzAKB3IuwkYW50RXF1YWwAoH4qaSJsZGUAAKBzImMAcgAA4DXYotwAoGsiAARBYWNmaW9zdfkE/QQFBQgFCwUTBSIFKwVSIkRjeQAqZAABY3QBBQQFZQBrAMdiXmDpIXJjJGFyAACgDCFsJWJlcnRTcGFjZQAAoAsh8AEYBQAAGwVmAACgDSHpJXpvbnRhbExpbmUAoAAlAAFjdCYFKAXyABIF8iFvayZhbQBwAEQBMQU5BW8AdwBuAEgAdQBtAPAAAAFxInVhbAAAoE8iAAdFSk9hY2RmZ21ub3N0dVMFVgVZBVwFYwVtBXAFcwV6BZAFtgXFBckFzQVjAHkAFWTsIWlnMmFjAHkAAWRjAHUAdABlADuAzQDNQAABaXlnBWwFcgBjADuAzgDOQBhkbwB0ADBhcgAAoBEhcgBhAHYAZQA7gMwAzEAAoREhYXB/BYsFAAFjZ4MFhQVyACphaSNuYXJ5SQAAoEghbABpAGUA8wD6AvQBlQUAAKUFZaAsIgABZ3KaBZ4F8iFhbACgKyLzI2VjdGlvbgCgwiJpI3NpYmxlAAABQ1SsBbEFbyJtbWEAAKBjIGkibWVzAACgYiCAAWdwdAC8Bb8FwwVvAG4ALmFmAADgNdhA3WEAmWNjAHIAAKAQIWkibGRlAChh6wHSBQAA1QVjAHkABmRsADuAzwDPQIACY2Zvc3UA4QXpBe0F8gX9BQABaXnlBegFcgBjADRhGWRyAADgNdgN3XAAZgAA4DXYQd3jAfcFAAD7BXIAAOA12KXc8iFjeQhk6yFjeQRkgANISmFjZm9zAAwGDwYSBhUGHQYhBiYGYwB5ACVkYwB5AAxk8CFwYZpjAAFleRkGHAbkIWlsNmEaZHIAAOA12A7dcABmAADgNdhC3WMAcgAA4DXYptyABUpUYWNlZmxtb3N0AD0GQAZDBl4GawZkB2gHcAd0B80H2gdjAHkACWQ7gDwAPECAAmNtbnByAEwGTwZSBlUGWwb1IXRlOWHiIWRhm2NnAACg6ifsI2FjZXRyZgCgEiFyAACgniGAAWFleQBkBmcGagbyIW9uPWHkIWlsO2EbZAABZnNvBjQHdAAABUFDREZSVFVWYXKABp4GpAbGBssG3AYDByEHwQIqBwABbnKEBowGZyVsZUJyYWNrZXQAAKDoJ/Ihb3cAoZAhQlKTBpcGYQByAACg5CHpJGdodEFycm93AKDGIWUjaWxpbmcAAKAII28A9QGqBgAAsgZiJWxlQnJhY2tldAAAoOYnbgDUAbcGAAC+BmUkZVZlY3RvcgAAoGEp5SJjdG9yQqDDIWEAcgAAoFkpbCJvb3IAAKAKI2kiZ2h0AAABQVbSBtcGciJyb3cAAKCUIeUiY3RvcgCgTikAAWVy4AbwBmUAAKGjIkFW5gbrBnIicm93AACgpCHlImN0b3IAoFopaSNhbmdsZQBCorIi+wYAAAAA/wZhAHIAAKDPKXEidWFsAACgtCJwAIABRFRWAAoHEQcYB+8kd25WZWN0b3IAoFEpZSRlVmVjdG9yAACgYCnlImN0b3JCoL8hYQByAACgWCnlImN0b3JCoLwhYQByAACgUilpAGcAaAB0AGEAcgByAG8A9wDMAnMAAANFRkdMU1Q/B0cHTgdUB1gHXwfxJXVhbEdyZWF0ZXIAoNoidSRsbEVxdWFsAACgZiJyI2VhdGVyAACgdiLlIXNzAKChKuwkYW50RXF1YWwAoH0qaSJsZGUAAKByInIAAOA12A/dZaDYIuYjdGFycm93AKDaIWkiZG90AD9hgAFucHcAege1B7kHZwAAAkxSbHKCB5QHmwerB+UhZnQAAUFSiAeNB3Iicm93AACg9SfpJGdodEFycm93AKD3J+kkZ2h0QXJyb3cAoPYn5SFmdAABYXLcAqEHaQBnAGgAdABhAHIAcgBvAPcA5wJpAGcAaAB0AGEAcgByAG8A9wDuAmYAAOA12EPdZQByAAABTFK/B8YHZSRmdEFycm93AACgmSHpJGdodEFycm93AKCYIYABY2h0ANMH1QfXB/IAWgYAoLAh8iFva0FhAKBqIgAEYWNlZmlvc3XpB+wH7gf/BwMICQgOCBEIcAAAoAUpeQAcZAABZGzyB/kHaSR1bVNwYWNlAACgXyBsI2ludHJmAACgMyFyAADgNdgQ3e4jdXNQbHVzAKATInAAZgAA4DXYRN1jAPIA/gecY4AESmFjZWZvc3R1ACEIJAgoCDUIgQiFCDsKQApHCmMAeQAKZGMidXRlAENhgAFhZXkALggxCDQI8iFvbkdh5CFpbEVhHWSAAWdzdwA7CGEIfQjhInRpdmWAAU1UVgBECEwIWQhlJWRpdW1TcGFjZQAAoAsgaABpAAABY25SCFMIawBTAHAAYQBjAOUASwhlAHIAeQBUAGgAaQDuAFQI9CFlZAABR0xnCHUIcgBlAGEAdABlAHIARwByAGUAYQB0AGUA8gDrBGUAcwBzAEwAZQBzAPMA2wdMImluZQAKYHIAAOA12BHdAAJCbnB0jAiRCJkInAhyImVhawAAoGAgwiZyZWFraW5nU3BhY2WgYGYAAKAVIUOq7CqzCMIIzQgAAOcIGwkAAAAAAAAtCQAAbwkAAIcJAACdCcAJGQoAADQKAAFvdbYIvAjuI2dydWVudACgYiJwIkNhcAAAoG0ibyh1YmxlVmVydGljYWxCYXIAAKAmIoABbHF4ANII1wjhCOUibWVudACgCSL1IWFsVKBgImkibGRlAADgQiI4A2kic3RzAACgBCJyI2VhdGVyAACjbyJFRkdMU1T1CPoIAgkJCQ0JFQlxInVhbAAAoHEidSRsbEVxdWFsAADgZyI4A3IjZWF0ZXIAAOBrIjgD5SFzcwCgeSLsJGFudEVxdWFsAOB+KjgDaSJsZGUAAKB1IvUhbXBEASAJJwnvI3duSHVtcADgTiI4A3EidWFsAADgTyI4A2UAAAFmczEJRgn0JFRyaWFuZ2xlQqLqIj0JAAAAAEIJYQByAADgzyk4A3EidWFsAACg7CJzAICibiJFR0xTVABRCVYJXAlhCWkJcSJ1YWwAAKBwInIjZWF0ZXIAAKB4IuUhc3MA4GoiOAPsJGFudEVxdWFsAOB9KjgDaSJsZGUAAKB0IuUic3RlZAABR0x1CX8J8iZlYXRlckdyZWF0ZXIA4KIqOAPlI3NzTGVzcwDgoSo4A/IjZWNlZGVzAKGAIkVTjwmVCXEidWFsAADgryo4A+wkYW50RXF1YWwAoOAiAAFlaaAJqQl2JmVyc2VFbGVtZW50AACgDCLnJWh0VHJpYW5nbGVCousitgkAAAAAuwlhAHIAAODQKTgDcSJ1YWwAAKDtIgABcXXDCeAJdSNhcmVTdQAAAWJwywnVCfMhZXRF4I8iOANxInVhbAAAoOIi5SJyc2V0ReCQIjgDcSJ1YWwAAKDjIoABYmNwAOYJ8AkNCvMhZXRF4IIi0iBxInVhbAAAoIgi4yJlZWRzgKGBIkVTVAD6CQAKBwpxInVhbAAA4LAqOAPsJGFudEVxdWFsAKDhImkibGRlAADgfyI4A+UicnNldEXggyLSIHEidWFsAACgiSJpImxkZQCAoUEiRUZUACIKJwouCnEidWFsAACgRCJ1JGxsRXF1YWwAAKBHImkibGRlAACgSSJlJXJ0aWNhbEJhcgAAoCQiYwByAADgNdip3GkAbABkAGUAO4DRANFAnWMAB0VhY2RmZ21vcHJzdHV2XgphCmgKcgp2CnoKgQqRCpYKqwqtCrsKyArNCuwhaWdSYWMAdQB0AGUAO4DTANNAAAFpeWwKcQpyAGMAO4DUANRAHmRiImxhYwBQYXIAAOA12BLdcgBhAHYAZQA7gNIA0kCAAWFlaQCHCooKjQpjAHIATGFnAGEAqWNjInJvbgCfY3AAZgAA4DXYRt3lI25DdXJseQABRFGeCqYKbyV1YmxlUXVvdGUAAKAcIHUib3RlAACgGCAAoFQqAAFjbLEKtQpyAADgNdiq3GEAcwBoADuA2ADYQGkAbAHACsUKZABlADuA1QDVQGUAcwAAoDcqbQBsADuA1gDWQGUAcgAAAUJQ0wrmCgABYXLXCtoKcgAAoD4gYQBjAAABZWvgCuIKAKDeI2UAdAAAoLQjYSVyZW50aGVzaXMAAKDcI4AEYWNmaGlsb3JzAP0KAwsFCwkLCwsMCxELIwtaC3IjdGlhbEQAAKACInkAH2RyAADgNdgT3WkApmOgY/Ujc01pbnVzsWAAAWlwFQsgC24AYwBhAHIAZQBwAGwAYQBuAOUACgVmAACgGSGAobsqZWlvACoLRQtJC+MiZWRlc4CheiJFU1QANAs5C0ALcSJ1YWwAAKCvKuwkYW50RXF1YWwAoHwiaSJsZGUAAKB+Im0AZQAAoDMgAAFkcE0LUQv1IWN0AKAPIm8jcnRpb24AYaA3ImwAAKAdIgABY2leC2ILcgAA4DXYq9yoYwACVWZvc2oLbwtzC3cLTwBUADuAIgAiQHIAAOA12BTdcABmAACgGiFjAHIAAOA12KzcAAZCRWFjZWZoaW9yc3WPC5MLlwupC7YL2AvbC90LhQyTDJoMowzhIXJyAKAQKUcAO4CuAK5AgAFjbnIAnQugC6ML9SF0ZVRhZwAAoOsncgB0oKAhbAAAoBYpgAFhZXkArwuyC7UL8iFvblhh5CFpbFZhIGR2oBwhZSJyc2UAAAFFVb8LzwsAAWxxwwvIC+UibWVudACgCyL1JGlsaWJyaXVtAKDLIXAmRXF1aWxpYnJpdW0AAKBvKXIAAKAcIW8AoWPnIWh0AARBQ0RGVFVWYewLCgwQDDIMNwxeDHwM9gIAAW5y8Av4C2clbGVCcmFja2V0AACg6SfyIW93AKGSIUJM/wsDDGEAcgAAoOUhZSRmdEFycm93AACgxCFlI2lsaW5nAACgCSNvAPUBFgwAAB4MYiVsZUJyYWNrZXQAAKDnJ24A1AEjDAAAKgxlJGVWZWN0b3IAAKBdKeUiY3RvckKgwiFhAHIAAKBVKWwib29yAACgCyMAAWVyOwxLDGUAAKGiIkFWQQxGDHIicm93AACgpiHlImN0b3IAoFspaSNhbmdsZQBCorMiVgwAAAAAWgxhAHIAAKDQKXEidWFsAACgtSJwAIABRFRWAGUMbAxzDO8kd25WZWN0b3IAoE8pZSRlVmVjdG9yAACgXCnlImN0b3JCoL4hYQByAACgVCnlImN0b3JCoMAhYQByAACgUykAAXB1iQyMDGYAAKAdIe4kZEltcGxpZXMAoHAp6SRnaHRhcnJvdwCg2yEAAWNongyhDHIAAKAbIQCgsSHsJGVEZWxheWVkAKD0KYAGSE9hY2ZoaW1vcXN0dQC/DMgMzAzQDOIM5gwKDQ0NFA0ZDU8NVA1YDQABQ2PDDMYMyCFjeSlkeQAoZEYiVGN5ACxkYyJ1dGUAWmEAorwqYWVpedgM2wzeDOEM8iFvbmBh5CFpbF5hcgBjAFxhIWRyAADgNdgW3e8hcnQAAkRMUlXvDPYM/QwEDW8kd25BcnJvdwAAoJMhZSRmdEFycm93AACgkCHpJGdodEFycm93AKCSIXAjQXJyb3cAAKCRIechbWGjY+EkbGxDaXJjbGUAoBgicABmAADgNdhK3XICHw0AAAAAIg10AACgGiLhIXJlgKGhJUlTVQAqDTINSg3uJXRlcnNlY3Rpb24AoJMidQAAAWJwNw1ADfMhZXRFoI8icSJ1YWwAAKCRIuUicnNldEWgkCJxInVhbAAAoJIibiJpb24AAKCUImMAcgAA4DXYrtxhAHIAAKDGIgACYmNtcF8Nag2ODZANc6DQImUAdABFoNAicSJ1YWwAAKCGIgABY2huDYkNZSJlZHMAgKF7IkVTVAB4DX0NhA1xInVhbAAAoLAq7CRhbnRFcXVhbACgfSJpImxkZQAAoH8iVABoAGEA9ADHCwCgESIAodEiZXOVDZ8NciJzZXQARaCDInEidWFsAACghyJlAHQAAKDRIoAFSFJTYWNmaGlvcnMAtQ27Db8NyA3ODdsN3w3+DRgOHQ4jDk8AUgBOADuA3gDeQMEhREUAoCIhAAFIY8MNxg1jAHkAC2R5ACZkAAFidcwNzQ0JYKRjgAFhZXkA1A3XDdoN8iFvbmRh5CFpbGJhImRyAADgNdgX3QABZWnjDe4N8gHoDQAA7Q3lImZvcmUAoDQiYQCYYwABY27yDfkNayNTcGFjZQAA4F8gCiDTInBhY2UAoAkg7CFkZYChPCJFRlQABw4MDhMOcSJ1YWwAAKBDInUkbGxFcXVhbAAAoEUiaSJsZGUAAKBIInAAZgAA4DXYS93pI3BsZURvdACg2yAAAWN0Jw4rDnIAAOA12K/c8iFva2Zh4QpFDlYOYA5qDgAAbg5yDgAAAAAAAAAAAAB5DnwOqA6zDgAADg8RDxYPGg8AAWNySA5ODnUAdABlADuA2gDaQHIAb6CfIeMhaXIAoEkpcgDjAVsOAABdDnkADmR2AGUAbGEAAWl5Yw5oDnIAYwA7gNsA20AjZGIibGFjAHBhcgAA4DXYGN1yAGEAdgBlADuA2QDZQOEhY3JqYQABZGl/Dp8OZQByAAABQlCFDpcOAAFhcokOiw5yAF9gYQBjAAABZWuRDpMOAKDfI2UAdAAAoLUjYSVyZW50aGVzaXMAAKDdI28AbgBQoMMi7CF1cwCgjiIAAWdwqw6uDm8AbgByYWYAAOA12EzdAARBREVUYWRwc78O0g7ZDuEOBQPqDvMOBw9yInJvdwDCoZEhyA4AAMwOYQByAACgEilvJHduQXJyb3cAAKDFIW8kd25BcnJvdwAAoJUhcSV1aWxpYnJpdW0AAKBuKWUAZQBBoKUiciJyb3cAAKClIW8AdwBuAGEAcgByAG8A9wAQA2UAcgAAAUxS+Q4AD2UkZnRBcnJvdwAAoJYh6SRnaHRBcnJvdwCglyFpAGyg0gNvAG4ApWPpIW5nbmFjAHIAAOA12LDcaSJsZGUAaGFtAGwAO4DcANxAgAREYmNkZWZvc3YALQ8xDzUPNw89D3IPdg97D4AP4SFzaACgqyJhAHIAAKDrKnkAEmThIXNobKCpIgCg5ioAAWVyQQ9DDwCgwSKAAWJ0eQBJD00Paw9hAHIAAKAWIGmgFiDjIWFsAAJCTFNUWA9cD18PZg9hAHIAAKAjIukhbmV8YGUkcGFyYXRvcgAAoFgnaSJsZGUAAKBAItQkaGluU3BhY2UAoAogcgAA4DXYGd1wAGYAAOA12E3dYwByAADgNdix3GQiYXNoAACgqiKAAmNlZm9zAI4PkQ+VD5kPng/pIXJjdGHkIWdlAKDAInIAAOA12BrdcABmAADgNdhO3WMAcgAA4DXYstwAAmZpb3OqD64Prw+0D3IAAOA12BvdnmNwAGYAAOA12E/dYwByAADgNdiz3IAEQUlVYWNmb3N1AMgPyw/OD9EP2A/gD+QP6Q/uD2MAeQAvZGMAeQAHZGMAeQAuZGMAdQB0AGUAO4DdAN1AAAFpedwP3w9yAGMAdmErZHIAAOA12BzdcABmAADgNdhQ3WMAcgAA4DXYtNxtAGwAeGEABEhhY2RlZm9z/g8BEAUQDRAQEB0QIBAkEGMAeQAWZGMidXRlAHlhAAFheQkQDBDyIW9ufWEXZG8AdAB7YfIBFRAAABwQbwBXAGkAZAB0AOgAVAhhAJZjcgAAoCghcABmAACgJCFjAHIAAOA12LXc4QtCEEkQTRAAAGcQbRByEAAAAAAAAAAAeRCKEJcQ8hD9EAAAGxEhETIROREAAD4RYwB1AHQAZQA7gOEA4UByImV2ZQADYYCiPiJFZGl1eQBWEFkQWxBgEGUQAOA+IjMDAKA/InIAYwA7gOIA4kB0AGUAO4C0ALRAMGRsAGkAZwA7gOYA5kByoGEgAOA12B7dcgBhAHYAZQA7gOAA4EAAAWVwfBCGEAABZnCAEIQQ8yF5bQCgNSHoAIMQaABhALFjAAFhcI0QWwAAAWNskRCTEHIAAWFnAACgPypkApwQAAAAALEQAKInImFkc3ajEKcQqRCuEG4AZAAAoFUqAKBcKmwib3BlAACgWCoAoFoqAKMgImVsbXJzersQvRDAEN0Q5RDtEACgpCllAACgICJzAGQAYaAhImEEzhDQENIQ1BDWENgQ2hDcEACgqCkAoKkpAKCqKQCgqykAoKwpAKCtKQCgrikAoK8pdAB2oB8iYgBkoL4iAKCdKQABcHTpEOwQaAAAoCIixWDhIXJyAKB8IwABZ3D1EPgQbwBuAAVhZgAA4DXYUt0Ao0giRWFlaW9wBxEJEQ0RDxESERQRAKBwKuMhaXIAoG8qAKBKImQAAKBLInMAJ2DyIW94ZaBIIvEADhFpAG4AZwA7gOUA5UCAAWN0eQAmESoRKxFyAADgNdi23CpgbQBwAGWgSCLxAPgBaQBsAGQAZQA7gOMA40BtAGwAO4DkAORAAAFjaUERRxFvAG4AaQBuAPQA6AFuAHQAAKARKgAITmFiY2RlZmlrbG5vcHJzdWQRaBGXEZ8RpxGrEdIR1hErEjASexKKEn0RThNbE3oTbwB0AACg7SoAAWNybBGJEWsAAAJjZXBzdBF4EX0RghHvIW5nAKBMInAjc2lsb24A9mNyImltZQAAoDUgaQBtAGWgPSJxAACgzSJ2AY0RkRFlAGUAAKC9ImUAZABnoAUjZQAAoAUjcgBrAHSgtSPiIXJrAKC2IwABb3mjEaYRbgDnAHcRMWTxIXVvAKAeIIACY21wcnQAtBG5Eb4RwRHFEeEhdXPloDUi5ABwInR5dgAAoLApcwDpAH0RbgBvAPUA6gCAAWFodwDLEcwRzhGyYwCgNiHlIWVuAKBsInIAAOA12B/dZwCAA2Nvc3R1dncA4xHyEQUSEhIhEiYSKRKAAWFpdQDpEesR7xHwAKMFcgBjAACg7yVwAACgwyKAAWRwdAD4EfwRABJvAHQAAKAAKuwhdXMAoAEqaSJtZXMAAKACKnECCxIAAAAADxLjIXVwAKAGKmEAcgAAoAUm8iNpYW5nbGUAAWR1GhIeEu8hd24AoL0lcAAAoLMlcCJsdXMAAKAEKmUA5QBCD+UAkg9hInJvdwAAoA0pgAFha28ANhJoEncSAAFjbjoSZRJrAIABbHN0AEESRxJNEm8jemVuZ2UAAKDrKXEAdQBhAHIA5QBcBPIjaWFuZ2xlgKG0JWRscgBYElwSYBLvIXduAKC+JeUhZnQAoMIlaSJnaHQAAKC4JWsAAKAjJLEBbRIAAHUSsgFxEgAAcxIAoJIlAKCRJTQAAKCTJWMAawAAoIglAAFlb38ShxJx4D0A5SD1IWl2AOBhIuUgdAAAoBAjAAJwdHd4kRKVEpsSnxJmAADgNdhT3XSgpSJvAG0AAKClIvQhaWUAoMgiAAZESFVWYmRobXB0dXayEsES0RLgEvcS+xIKExoTHxMjEygTNxMAAkxSbHK5ErsSvRK/EgCgVyUAoFQlAKBWJQCgUyUAolAlRFVkdckSyxLNEs8SAKBmJQCgaSUAoGQlAKBnJQACTFJsctgS2hLcEt4SAKBdJQCgWiUAoFwlAKBZJQCjUSVITFJobHLrEu0S7xLxEvMS9RIAoGwlAKBjJQCgYCUAoGslAKBiJQCgXyVvAHgAAKDJKQACTFJscgITBBMGEwgTAKBVJQCgUiUAoBAlAKAMJQCiACVEVWR1EhMUExYTGBMAoGUlAKBoJQCgLCUAoDQlaSJudXMAAKCfIuwhdXMAoJ4iaSJtZXMAAKCgIgACTFJsci8TMRMzEzUTAKBbJQCgWCUAoBglAKAUJQCjAiVITFJobHJCE0QTRhNIE0oTTBMAoGolAKBhJQCgXiUAoDwlAKAkJQCgHCUAAWV2UhNVE3YA5QD5AGIAYQByADuApgCmQAACY2Vpb2ITZhNqE24TcgAA4DXYt9xtAGkAAKBPIG0A5aA9IogRbAAAoVwAYmh0E3YTAKDFKfMhdWIAoMgnbAF+E4QTbABloCIgdAAAoCIgcAAAoU4iRWWJE4sTAKCuKvGgTyI8BeEMqRMAAN8TABQDFB8UAAAjFDQUAAAAAIUUAAAAAI0UAAAAANcU4xT3FPsUAACIFQAAlhWAAWNwcgCuE7ET1RP1IXRlB2GAoikiYWJjZHMAuxO/E8QTzhPSE24AZAAAoEQqciJjdXAAAKBJKgABYXXIE8sTcAAAoEsqcAAAoEcqbwB0AACgQCoA4CkiAP4AAWVv2RPcE3QAAKBBIO4ABAUAAmFlaXXlE+8T9RP4E/AB6hMAAO0TcwAAoE0qbwBuAA1hZABpAGwAO4DnAOdAcgBjAAlhcABzAHOgTCptAACgUCpvAHQAC2GAAWRtbgAIFA0UEhRpAGwAO4C4ALhAcCJ0eXYAAKCyKXQAAIGiADtlGBQZFKJAcgBkAG8A9ABiAXIAAOA12CDdgAFjZWkAKBQqFDIUeQBHZGMAawBtoBMn4SFyawCgEyfHY3IAAKPLJUVjZWZtcz8UQRRHFHcUfBSAFACgwykAocYCZWxGFEkUcQAAoFciZQBhAlAUAAAAAGAUciJyb3cAAAFsclYUWhTlIWZ0AKC6IWkiZ2h0AACguyGAAlJTYWNkAGgUaRRrFG8UcxSuYACgyCRzAHQAAKCbIukhcmMAoJoi4SFzaACgnSJuImludAAAoBAqaQBkAACg7yrjIWlyAKDCKfUhYnN1oGMmaQB0AACgYybsApMUmhS2FAAAwxRvAG4AZaA6APGgVCKrAG0CnxQAAAAAoxRhAHSgLABAYAChASJmbKcUqRTuABMNZQAAAW14rhSyFOUhbnQAoAEiZQDzANIB5wG6FAAAwBRkoEUibwB0AACgbSpuAPQAzAGAAWZyeQDIFMsUzhQA4DXYVN1vAOQA1wEAgakAO3MeAdMUcgAAoBchAAFhb9oU3hRyAHIAAKC1IXMAcwAAoBcnAAFjdeYU6hRyAADgNdi43AABYnDuFPIUZaDPKgCg0SploNAqAKDSKuQhb3QAoO8igANkZWxwcnZ3AAYVEBUbFSEVRBVlFYQV4SFycgABbHIMFQ4VAKA4KQCgNSlwAhYVAAAAABkVcgAAoN4iYwAAoN8i4SFycnCgtiEAoD0pgKIqImJjZG9zACsVMBU6FT4VQRVyImNhcAAAoEgqAAFhdTQVNxVwAACgRipwAACgSipvAHQAAKCNInIAAKBFKgDgKiIA/gACYWxydksVURVuFXMVcgByAG2gtyEAoDwpeQCAAWV2dwBYFWUVaRVxAHACXxUAAAAAYxVyAGUA4wAXFXUA4wAZFWUAZQAAoM4iZSJkZ2UAAKDPImUAbgA7gKQApEBlI2Fycm93AAABbHJ7FX8V5SFmdACgtiFpImdodAAAoLchZQDkAG0VAAFjaYsVkRVvAG4AaQBuAPQAkwFuAHQAAKAxImwiY3R5AACgLSOACUFIYWJjZGVmaGlqbG9yc3R1d3oAuBW7Fb8V1RXgFegV+RUKFhUWHxZUFlcWZRbFFtsW7xb7FgUXChdyAPIAtAJhAHIAAKBlKQACZ2xyc8YVyhXOFdAV5yFlcgCgICDlIXRoAKA4IfIA9QxoAHagECAAoKMiawHZFd4VYSJyb3cAAKAPKWEA4wBfAgABYXnkFecV8iFvbg9hNGQAoUYhYW/tFfQVAAFnciEC8RVyAACgyiF0InNlcQAAoHcqgAFnbG0A/xUCFgUWO4CwALBAdABhALRjcCJ0eXYAAKCxKQABaXIOFhIW8yFodACgfykA4DXYId1hAHIAAAFschsWHRYAoMMhAKDCIYACYWVnc3YAKBauAjYWOhY+Fm0AAKHEIm9zLhY0Fm4AZABzoMQi9SFpdACgZiZhIm1tYQDdY2kAbgAAoPIiAKH3AGlvQxZRFmQAZQAAgfcAO29KFksW90BuI3RpbWVzAACgxyJuAPgAUBZjAHkAUmRjAG8CXhYAAAAAYhZyAG4AAKAeI28AcAAAoA0jgAJscHR1dwBuFnEWdRaSFp4W7CFhciRgZgAA4DXYVd0AotkCZW1wc30WhBaJFo0WcQBkoFAibwB0AACgUSJpIm51cwAAoDgi7CF1cwCgFCLxInVhcmUAoKEiYgBsAGUAYgBhAHIAdwBlAGQAZwDlANcAbgCAAWFkaAClFqoWtBZyAHIAbwD3APUMbwB3AG4AYQByAHIAbwB3APMA8xVhI3Jwb29uAAABbHK8FsAWZQBmAPQAHBZpAGcAaAD0AB4WYgHJFs8WawBhAHIAbwD3AJILbwLUFgAAAADYFnIAbgAAoB8jbwBwAACgDCOAAWNvdADhFukW7BYAAXJ55RboFgDgNdi53FVkbAAAoPYp8iFvaxFhAAFkcvMW9xZvAHQAAKDxImkA5qC/JVsSAAFhaP8WAhdyAPIANQNhAPIA1wvhIm5nbGUAoKYpAAFjaQ4XEBd5AF9k5yJyYXJyAKD/JwAJRGFjZGVmZ2xtbm9wcXJzdHV4MRc4F0YXWxcyBF4XaRd5F40XrBe0F78X2RcVGCEYLRg1GEAYAAFEbzUXgRZvAPQA+BUAAWNzPBdCF3UAdABlADuA6QDpQPQhZXIAoG4qAAJhaW95TRdQF1YXWhfyIW9uG2FyAGOgViI7gOoA6kDsIW9uAKBVIk1kbwB0ABdhAAFEcmIXZhdvAHQAAKBSIgDgNdgi3XKhmipuF3QXYQB2AGUAO4DoAOhAZKCWKm8AdAAAoJgqgKGZKmlscwCAF4UXhxfuInRlcnMAoOcjAKATIWSglSpvAHQAAKCXKoABYXBzAJMXlheiF2MAcgATYXQAeQBzogUinxcAAAAAoRdlAHQAAKAFInAAMaADIDMBqRerFwCgBCAAoAUgAAFnc7AXsRdLYXAAAKACIAABZ3C4F7sXbwBuABlhZgAA4DXYVt2AAWFscwDFF8sXzxdyAHOg1SJsAACg4yl1AHMAAKBxKmkAAKG1A2x21RfYF28AbgC1Y/VjAAJjc3V24BfoF/0XEBgAAWlv5BdWF3IAYwAAoFYiaQLuFwAAAADwF+0ADQThIW50AAFnbPUX+Rd0AHIAAKCWKuUhc3MAoJUqgAFhZWkAAxgGGAoYbABzAD1gcwB0AACgXyJ2AESgYSJEAACgeCrwImFyc2wAoOUpAAFEYRkYHRhvAHQAAKBTInIAcgAAoHEpgAFjZGkAJxgqGO0XcgAAoC8hbwD0AIwCAAFhaDEYMhi3YzuA8ADwQAABbXI5GD0YbAA7gOsA60BvAACgrCCAAWNpcABGGEgYSxhsACFgcwD0ACwEAAFlb08YVxhjAHQAYQB0AGkAbwDuABoEbgBlAG4AdABpAGEAbADlADME4Ql1GAAAgRgAAIMYiBgAAAAAoRilGAAAqhgAALsYvhjRGAAA1xgnGWwAbABpAG4AZwBkAG8AdABzAGUA8QBlF3kARGRtImFsZQAAoEAmgAFpbHIAjRiRGJ0Y7CFpZwCgA/tpApcYAAAAAJoYZwAAoAD7aQBnAACgBPsA4DXYI93sIWlnAKAB++whaWcA4GYAagCAAWFsdACvGLIYthh0AACgbSZpAGcAAKAC+24AcwAAoLElbwBmAJJh8AHCGAAAxhhmAADgNdhX3QABYWvJGMwYbADsAGsEdqDUIgCg2SphI3J0aW50AACgDSoAAWFv2hgiGQABY3PeGB8ZsQPnGP0YBRkSGRUZAAAdGbID7xjyGPQY9xj5GAAA+xg7gL0AvUAAoFMhO4C8ALxAAKBVIQCgWSEAoFshswEBGQAAAxkAoFQhAKBWIbQCCxkOGQAAAAAQGTuAvgC+QACgVyEAoFwhNQAAoFghtgEZGQAAGxkAoFohAKBdITgAAKBeIWwAAKBEIHcAbgAAoCIjYwByAADgNdi73IAIRWFiY2RlZmdpamxub3JzdHYARhlKGVoZXhlmGWkZkhmWGZkZnRmgGa0ZxhnLGc8Z4BkjGmygZyIAoIwqgAFjbXAAUBlTGVgZ9SF0ZfVhbQBhAOSgswM6FgCghipyImV2ZQAfYQABaXliGWUZcgBjAB1hM2RvAHQAIWGAoWUibHFzAMYEcBl6GfGhZSLOBAAAdhlsAGEAbgD0AN8EgKF+KmNkbACBGYQZjBljAACgqSpvAHQAb6CAKmyggioAoIQqZeDbIgD+cwAAoJQqcgAA4DXYJN3noGsirATtIWVsAKA3IWMAeQBTZIChdyJFYWoApxmpGasZAKCSKgCgpSoAoKQqAAJFYWVztBm2Gb0ZwhkAoGkicABwoIoq8iFveACgiipxoIgq8aCIKrUZaQBtAACg5yJwAGYAAOA12FjdYQB2AOUAYwIAAWNp0xnWGXIAAKAKIW0AAKFzImVs3BneGQCgjioAoJAqAIM+ADtjZGxxco0E6xn0GfgZ/BkBGgABY2nvGfEZAKCnKnIAAKB6Km8AdAAAoNci0CFhcgCglSl1ImVzdAAAoHwqgAJhZGVscwAKGvQZFhrVBCAa8AEPGgAAFBpwAHIAbwD4AFkZcgAAoHgpcQAAAWxxxAQbGmwAZQBzAPMASRlpAO0A5AQAAWVuJxouGnIjdG5lcXEAAOBpIgD+xQAsGgAFQWFiY2Vma29zeUAaQxpmGmoabRqDGocalhrCGtMacgDyAMwCAAJpbG1yShpOGlAaVBpyAHMA8ABxD2YAvWBpAGwA9AASBQABZHJYGlsaYwB5AEpkAKGUIWN3YBpkGmkAcgAAoEgpAKCtIWEAcgAAoA8h6SFyYyVhgAFhbHIAcxp7Gn8a8iF0c3WgZSZpAHQAAKBlJuwhaXAAoCYg4yFvbgCguSJyAADgNdgl3XMAAAFld4wakRphInJvdwAAoCUpYSJyb3cAAKAmKYACYW1vcHIAnxqjGqcauhq+GnIAcgAAoP8h9CFodACgOyJrAAABbHKsGrMaZSRmdGFycm93AACgqSHpJGdodGFycm93AKCqIWYAAOA12Fnd4iFhcgCgFSCAAWNsdADIGswa0BpyAADgNdi93GEAcwDoAGka8iFvaydhAAFicNca2xr1IWxsAKBDIOghZW4AoBAg4Qr2GgAA/RoAAAgbExsaGwAAIRs7GwAAAAA+G2IbmRuVG6sbAACyG80b0htjAHUAdABlADuA7QDtQAChYyBpeQEbBhtyAGMAO4DuAO5AOGQAAWN4CxsNG3kANWRjAGwAO4ChAKFAAAFmcssCFhsA4DXYJt1yAGEAdgBlADuA7ADsQIChSCFpbm8AJxsyGzYbAAFpbisbLxtuAHQAAKAMKnQAAKAtIuYhaW4AoNwpdABhAACgKSHsIWlnM2GAAWFvcABDG1sbXhuAAWNndABJG0sbWRtyACthgAFlbHAAcQVRG1UbaQBuAOUAyAVhAHIA9AByBWgAMWFmAACgtyJlAGQAtWEAoggiY2ZvdGkbbRt1G3kb4SFyZQCgBSFpAG4AdKAeImkAZQAAoN0pZABvAPQAWxsAoisiY2VscIEbhRuPG5QbYQBsAACguiIAAWdyiRuNG2UAcgDzACMQ4wCCG2EicmhrAACgFyryIW9kAKA8KgACY2dwdJ8boRukG6gbeQBRZG8AbgAvYWYAAOA12FrdYQC5Y3UAZQBzAHQAO4C/AL9AAAFjabUbuRtyAADgNdi+3G4AAKIIIkVkc3bCG8QbyBvQAwCg+SJvAHQAAKD1Inag9CIAoPMiaaBiIOwhZGUpYesB1hsAANkbYwB5AFZkbAA7gO8A70AAA2NmbW9zdeYb7hvyG/Ub+hsFHAABaXnqG+0bcgBjADVhOWRyAADgNdgn3eEhdGg3YnAAZgAA4DXYW93jAf8bAAADHHIAAOA12L/c8iFjeVhk6yFjeVRkAARhY2ZnaGpvcxUcGhwiHCYcKhwtHDAcNRzwIXBhdqC6A/BjAAFleR4cIRzkIWlsN2E6ZHIAAOA12CjdciJlZW4AOGFjAHkARWRjAHkAXGRwAGYAAOA12FzdYwByAADgNdjA3IALQUJFSGFiY2RlZmdoamxtbm9wcnN0dXYAXhxtHHEcdRx5HN8cBx0dHTwd3B3tHfEdAR4EHh0eLB5FHrwewx7hHgkfPR9LH4ABYXJ0AGQcZxxpHHIA8gBvB/IAxQLhIWlsAKAbKeEhcnIAoA4pZ6BmIgCgiyphAHIAAKBiKWMJjRwAAJAcAACVHAAAAAAAAAAAAACZHJwcAACmHKgcrRwAANIc9SF0ZTph7SJwdHl2AKC0KXIAYQDuAFoG4iFkYbtjZwAAoegnZGyhHKMcAKCRKeUAiwYAoIUqdQBvADuAqwCrQHIAgKOQIWJmaGxwc3QAuhy/HMIcxBzHHMoczhxmoOQhcwAAoB8pcwAAoB0p6wCyGnAAAKCrIWwAAKA5KWkAbQAAoHMpbAAAoKIhAKGrKmFl1hzaHGkAbAAAoBkpc6CtKgDgrSoA/oABYWJyAOUc6RztHHIAcgAAoAwpcgBrAACgcicAAWFr8Rz4HGMAAAFla/Yc9xx7YFtgAAFlc/wc/hwAoIspbAAAAWR1Ax0FHQCgjykAoI0pAAJhZXV5Dh0RHRodHB3yIW9uPmEAAWRpFR0YHWkAbAA8YewAowbiAPccO2QAAmNxcnMkHScdLB05HWEAAKA2KXUAbwDyoBwgqhEAAWR1MB00HeghYXIAoGcpcyJoYXIAAKBLKWgAAKCyIQCiZCJmZ3FzRB1FB5Qdnh10AIACYWhscnQATh1WHWUdbB2NHXIicm93AHSgkCFhAOkAzxxhI3Jwb29uAAABZHVeHWId7yF3bgCgvSFwAACgvCHlJGZ0YXJyb3dzAKDHIWkiZ2h0AIABYWhzAHUdex2DHXIicm93APOglCGdBmEAcgBwAG8AbwBuAPMAzgtxAHUAaQBnAGEAcgByAG8A9wBlGugkcmVldGltZXMAoMsi8aFkIk0HAACaHWwAYQBuAPQAXgcAon0qY2Rnc6YdqR2xHbcdYwAAoKgqbwB0AG+gfypyoIEqAKCDKmXg2iIA/nMAAKCTKoACYWRlZ3MAwB3GHcod1h3ZHXAAcAByAG8A+ACmHG8AdAAAoNYicQAAAWdxzx3SHXQA8gBGB2cAdADyAHQcdADyAFMHaQDtAGMHgAFpbHIA4h3mHeod8yFodACgfClvAG8A8gDKBgDgNdgp3UWgdiIAoJEqYQH1Hf4dcgAAAWR1YB35HWygvCEAoGopbABrAACghCVjAHkAWWQAomoiYWNodAweDx4VHhkecgDyAGsdbwByAG4AZQDyAGAW4SFyZACgaylyAGkAAKD6JQABaW8hHiQe5CFvdEBh9SFzdGGgsCPjIWhlAKCwIwACRWFlczMeNR48HkEeAKBoInAAcKCJKvIhb3gAoIkqcaCHKvGghyo0HmkAbQAAoOYiAARhYm5vcHR3elIeXB5fHoUelh6mHqsetB4AAW5yVh5ZHmcAAKDsJ3IAAKD9IXIA6wCwBmcAgAFsbXIAZh52Hnse5SFmdAABYXKIB2weaQBnAGgAdABhAHIAcgBvAPcAkwfhInBzdG8AoPwnaQBnAGgAdABhAHIAcgBvAPcAmgdwI2Fycm93AAABbHKNHpEeZQBmAPQAxhxpImdodAAAoKwhgAFhZmwAnB6fHqIecgAAoIUpAOA12F3ddQBzAACgLSppIm1lcwAAoDQqYQGvHrMecwB0AACgFyLhAIoOZaHKJbkeRhLuIWdlAKDKJWEAcgBsoCgAdAAAoJMpgAJhY2htdADMHs8e1R7bHt0ecgDyAJ0GbwByAG4AZQDyANYWYQByAGSgyyEAoG0pAKAOIHIAaQAAoL8iAANhY2hpcXTrHu8e1QfzHv0eBh/xIXVvAKA5IHIAAOA12MHcbQDloXIi+h4AAPweAKCNKgCgjyoAAWJ19xwBH28AcqAYIACgGiDyIW9rQmEAhDwAO2NkaGlscXJCBhcfxh0gHyQfKB8sHzEfAAFjaRsfHR8AoKYqcgAAoHkqcgBlAOUAkx3tIWVzAKDJIuEhcnIAoHYpdSJlc3QAAKB7KgABUGk1HzkfYQByAACglillocMlAgdfEnIAAAFkdUIfRx9zImhhcgAAoEop6CFhcgCgZikAAWVuTx9WH3IjdG5lcXEAAOBoIgD+xQBUHwAHRGFjZGVmaGlsbm9wc3VuH3Ifoh+rH68ftx+7H74f5h/uH/MfBwj/HwsgxCFvdACgOiIAAmNscHJ5H30fiR+eH3IAO4CvAK9AAAFldIEfgx8AoEImZaAgJ3MAZQAAoCAnc6CmIXQAbwCAoaYhZGx1AJQfmB+cH28AdwDuAHkDZQBmAPQA6gbwAOkO6yFlcgCgriUAAW95ph+qH+0hbWEAoCkqPGThIXNoAKAUIOElc3VyZWRhbmdsZQCgISJyAADgNdgq3W8AAKAnIYABY2RuAMQfyR/bH3IAbwA7gLUAtUBhoiMi0B8AANMf1x9zAPQAKxFpAHIAAKDwKm8AdAA7gLcAt0B1AHMA4qESIh4TAADjH3WgOCIAoCoqYwHqH+0fcAAAoNsq8gB+GnAAbAB1APMACAgAAWRw9x/7H+UhbHMAoKciZgAA4DXYXt0AAWN0AyAHIHIAAOA12MLc8CFvcwCgPiJsobwDECAVIPQiaW1hcACguCJhAPAAEyAADEdMUlZhYmNkZWZnaGlqbG1vcHJzdHV2dzwgRyBmIG0geSCqILgg2iDeIBEhFSEyIUMhTSFQIZwhnyHSIQAiIyKLIrEivyIUIwABZ3RAIEMgAODZIjgD9uBrItIgBwmAAWVsdABNIF8gYiBmAHQAAAFhclMgWCByInJvdwAAoM0h6SRnaHRhcnJvdwCgziEA4NgiOAP24Goi0iBfCekkZ2h0YXJyb3cAoM8hAAFEZHEgdSDhIXNoAKCvIuEhc2gAoK4igAJiY25wdACCIIYgiSCNIKIgbABhAACgByL1IXRlRGFnAADgICLSIACiSSJFaW9wlSCYIJwgniAA4HAqOANkAADgSyI4A3MASWFyAG8A+AAyCnUAcgBhoG4mbADzoG4mmwjzAa8gAACzIHAAO4CgAKBAbQBwAOXgTiI4AyoJgAJhZW91eQDBIMogzSDWINkg8AHGIAAAyCAAoEMqbwBuAEhh5CFpbEZhbgBnAGSgRyJvAHQAAOBtKjgDcAAAoEIqPWThIXNoAKATIACjYCJBYWRxc3jpIO0g+SD+IAIhDCFyAHIAAKDXIXIAAAFocvIg9SBrAACgJClvoJch9wAGD28AdAAA4FAiOAN1AGkA9gC7CAABZWkGIQohYQByAACgKCntAN8I6SFzdPOgBCLlCHIAAOA12CvdAAJFZXN0/wgcISshLiHxoXEiIiEAABMJ8aFxIgAJAAAnIWwAYQBuAPQAEwlpAO0AGQlyoG8iAKBvIoABQWFwADghOyE/IXIA8gBeIHIAcgAAoK4hYQByAACg8ipzogsiSiEAAAAAxwtkoPwiAKD6ImMAeQBaZIADQUVhZGVzdABcIV8hYiFmIWkhkyGWIXIA8gBXIADgZiI4A3IAcgAAoJohcgAAoCUggKFwImZxcwBwIYQhjiF0AAABYXJ1IXohcgByAG8A9wBlIWkAZwBoAHQAYQByAHIAbwD3AD4h8aFwImAhAACKIWwAYQBuAPQAZwlz4H0qOAMAoG4iaQDtAG0JcqBuImkA5aDqIkUJaQDkADoKAAFwdKMhpyFmAADgNdhf3YCBrAA7aW4AriGvIcchrEBuAIChCSJFZHYAtyG6Ib8hAOD5IjgDbwB0AADg9SI4A+EB1gjEIcYhAKD3IgCg9iJpAHagDCLhAagJzyHRIQCg/iIAoP0igAFhb3IA2CHsIfEhcgCAoSYiYXN0AOAh5SHpIWwAbABlAOwAywhsAADg/SrlIADgAiI4A2wiaW50AACgFCrjoYAi9yEAAPohdQDlAJsJY+CvKjgDZaCAIvEAkwkAAkFhaXQHIgoiFyIeInIA8gBsIHIAcgAAoZshY3cRIhQiAOAzKTgDAOCdITgDZyRodGFycm93AACgmyFyAGkA5aDrIr4JgANjaGltcHF1AC8iPCJHIpwhTSJQIloigKGBImNlcgA2Iv0JOSJ1AOUABgoA4DXYw9zvIXJ0bQKdIQAAAABEImEAcgDhAOEhbQBloEEi8aBEIiYKYQDyAMsIcwB1AAABYnBWIlgi5QDUCeUA3wmAAWJjcABgInMieCKAoYQiRWVzAGci7glqIgDgxSo4A2UAdABl4IIi0iBxAPGgiCJoImMAZaCBIvEA/gmAoYUiRWVzAH8iFgqCIgDgxio4A2UAdABl4IMi0iBxAPGgiSKAIgACZ2lscpIilCKaIpwi7AAMCWwAZABlADuA8QDxQOcAWwlpI2FuZ2xlAAABbHKkIqoi5SFmdGWg6iLxAEUJaSJnaHQAZaDrIvEAvgltoL0DAKEjAGVzuCK8InIAbwAAoBYhcAAAoAcggARESGFkZ2lscnMAziLSItYi2iLeIugi7SICIw8j4SFzaACgrSLhIXJyAKAEKXAAAOBNItIg4SFzaACgrCIAAWV04iLlIgDgZSLSIADgPgDSIG4iZmluAACg3imAAUFldADzIvci+iJyAHIAAKACKQDgZCLSIHLgPADSIGkAZQAA4LQi0iAAAUF0BiMKI3IAcgAAoAMp8iFpZQDgtSLSIGkAbQAA4Dwi0iCAAUFhbgAaIx4jKiNyAHIAAKDWIXIAAAFociMjJiNrAACgIylvoJYh9wD/DuUhYXIAoCcpUxJqFAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAVCMAAF4jaSN/I4IjjSOeI8AUAAAAAKYjwCMAANoj3yMAAO8jHiQvJD8kRCQAAWNzVyNsFHUAdABlADuA8wDzQAABaXlhI2cjcgBjoJoiO4D0APRAPmSAAmFiaW9zAHEjdCN3I3EBeiNzAOgAdhTsIWFjUWF2AACgOCrvIWxkAKC8KewhaWdTYQABY3KFI4kjaQByAACgvykA4DXYLN1vA5QjAAAAAJYjAACcI24A22JhAHYAZQA7gPIA8kAAoMEpAAFibaEjjAphAHIAAKC1KQACYWNpdKwjryO6I70jcgDyAFkUAAFpcrMjtiNyAACgvinvIXNzAKC7KW4A5QDZCgCgwCmAAWFlaQDFI8gjyyNjAHIATWFnAGEAyWOAAWNkbgDRI9Qj1iPyIW9uv2MAoLYpdQDzAHgBcABmAADgNdhg3YABYWVsAOQj5yPrI3IAAKC3KXIAcAAAoLkpdQDzAHwBAKMoImFkaW9zdvkj/CMPJBMkFiQbJHIA8gBeFIChXSplZm0AAyQJJAwkcgBvoDQhZgAAoDQhO4CqAKpAO4C6ALpA5yFvZgCgtiJyAACgVipsIm9wZQAAoFcqAKBbKoABY2xvACMkJSQrJPIACCRhAHMAaAA7gPgA+EBsAACgmCJpAGwBMyQ4JGQAZQA7gPUA9UBlAHMAYaCXInMAAKA2Km0AbAA7gPYA9kDiIWFyAKA9I+EKXiQAAHokAAB8JJQkAACYJKkkAAAAALUkEQsAAPAkAAAAAAQleiUAAIMlcgCAoSUiYXN0AGUkbyQBCwCBtgA7bGokayS2QGwAZQDsABgDaQJ1JAAAAAB4JG0AAKDzKgCg/Sp5AD9kcgCAAmNpbXB0AIUkiCSLJJkSjyRuAHQAJWBvAGQALmBpAGwAAKAwIOUhbmsAoDEgcgAA4DXYLd2AAWltbwCdJKAkpCR2oMYD1WNtAGEA9AD+B24AZQAAoA4m9KHAA64kAAC0JGMjaGZvcmsAAKDUItZjAAFhdbgkxCRuAAABY2u9JMIkawBooA8hAKAOIfYAaRpzAACkKwBhYmNkZW1zdNMkIRPXJNsk4STjJOck6yTjIWlyAKAjKmkAcgAAoCIqAAFvdYsW3yQAoCUqAKByKm4AO4CxALFAaQBtAACgJip3AG8AAKAnKoABaXB1APUk+iT+JO4idGludACgFSpmAADgNdhh3W4AZAA7gKMAo0CApHoiRWFjZWlub3N1ABMlFSUYJRslTCVRJVklSSV1JQCgsypwAACgtyp1AOUAPwtjoK8qgKJ6ImFjZW5zACclLSU0JTYlSSVwAHAAcgBvAPgAFyV1AHIAbAB5AGUA8QA/C/EAOAuAAWFlcwA8JUElRSXwInByb3gAoLkqcQBxAACgtSppAG0AAKDoImkA7QBEC20AZQDzoDIgIguAAUVhcwBDJVclRSXwAEAlgAFkZnAATwtfJXElgAFhbHMAZSVpJW0l7CFhcgCgLiPpIW5lAKASI/UhcmYAoBMjdKAdIu8AWQvyIWVsAKCwIgABY2l9JYElcgAA4DXYxdzIY24iY3NwAACgCCAAA2Zpb3BzdZElKxuVJZolnyWkJXIAAOA12C7dcABmAADgNdhi3XIiaW1lAACgVyBjAHIAAOA12MbcgAFhZW8AqiW6JcAldAAAAWVpryW2JXIAbgBpAG8AbgDzABkFbgB0AACgFipzAHQAZaA/APEACRj0AG0LgApBQkhhYmNkZWZoaWxtbm9wcnN0dXgA4yXyJfYl+iVpJpAmpia9JtUm5ib4JlonaCdxJ3UnnietJ7EnyCfiJ+cngAFhcnQA6SXsJe4lcgDyAJkM8gD6AuEhaWwAoBwpYQByAPIA3BVhAHIAAKBkKYADY2RlbnFydAAGJhAmEyYYJiYmKyZaJgABZXUKJg0mAOA9IjEDdABlAFVhaQDjACAN7SJwdHl2AKCzKWcAgKHpJ2RlbAAgJiImJCYAoJIpAKClKeUA9wt1AG8AO4C7ALtAcgAApZIhYWJjZmhscHN0dz0mQCZFJkcmSiZMJk4mUSZVJlgmcAAAoHUpZqDlIXMAAKAgKQCgMylzAACgHinrALka8ACVHmwAAKBFKWkAbQAAoHQpbAAAoKMhAKCdIQABYWleJmImaQBsAACgGilvAG6gNiJhAGwA8wB2C4ABYWJyAG8mciZ2JnIA8gAvEnIAawAAoHMnAAFha3omgSZjAAABZWt/JoAmfWBdYAABZXOFJocmAKCMKWwAAAFkdYwmjiYAoI4pAKCQKQACYWV1eZcmmiajJqUm8iFvbllhAAFkaZ4moSZpAGwAV2HsAA8M4gCAJkBkAAJjbHFzrSawJrUmuiZhAACgNylkImhhcgAAoGkpdQBvAPKgHSCjAWgAAKCzIYABYWNnAMMm0iaUC2wAgKEcIWlwcwDLJs4migxuAOUAoAxhAHIA9ADaC3QAAKCtJYABaWxyANsm3ybjJvMhaHQAoH0pbwBvAPIANgwA4DXYL90AAWFv6ib1JnIAAAFkde8m8SYAoMEhbKDAIQCgbCl2oMED8WOAAWducwD+Jk4nUCdoAHQAAANhaGxyc3QKJxInISc1Jz0nRydyInJvdwB0oJIhYQDpAFYmYSNycG9vbgAAAWR1GiceJ28AdwDuAPAmcAAAoMAh5SFmdAABYWgnJy0ncgByAG8AdwDzAAkMYQByAHAAbwBvAG4A8wATBGklZ2h0YXJyb3dzAACgySFxAHUAaQBnAGEAcgByAG8A9wBZJugkcmVldGltZXMAoMwiZwDaYmkAbgBnAGQAbwB0AHMAZQDxABwYgAFhaG0AYCdjJ2YncgDyAAkMYQDyABMEAKAPIG8idXN0AGGgsSPjIWhlAKCxI+0haWQAoO4qAAJhYnB0fCeGJ4knmScAAW5ygCeDJ2cAAKDtJ3IAAKD+IXIA6wAcDIABYWZsAI8nkieVJ3IAAKCGKQDgNdhj3XUAcwAAoC4qaSJtZXMAAKA1KgABYXCiJ6gncgBnoCkAdAAAoJQp7yJsaW50AKASKmEAcgDyADwnAAJhY2hxuCe8J6EMwCfxIXVvAKA6IHIAAOA12MfcAAFidYAmxCdvAPKgGSCoAYABaGlyAM4n0ifWJ3IAZQDlAE0n7SFlcwCgyiJpAIChuSVlZmwAXAxjEt4n9CFyaQCgzinsInVoYXIAoGgpAKAeIWENBSgJKA0oSyhVKIYoAACLKLAoAAAAAOMo5ygAABApJCkxKW0pcSmHKaYpAACYKgAAAACxKmMidXRlAFthcQB1AO8ABR+ApHsiRWFjZWlucHN5ABwoHignKCooLygyKEEoRihJKACgtCrwASMoAAAlKACguCpvAG4AYWF1AOUAgw1koLAqaQBsAF9hcgBjAF1hgAFFYXMAOCg6KD0oAKC2KnAAAKC6KmkAbQAAoOki7yJsaW50AKATKmkA7QCIDUFkbwB0AGKixSKRFgAAAABTKACgZiqAA0FhY21zdHgAYChkKG8ocyh1KHkogihyAHIAAKDYIXIAAAFocmkoayjrAJAab6CYIfcAzAd0ADuApwCnQGkAO2D3IWFyAKApKW0AAAFpbn4ozQBuAHUA8wDOAHQAAKA2J3IA7+A12DDdIxkAAmFjb3mRKJUonSisKHIAcAAAoG8mAAFoeZkonChjAHkASWRIZHIAdABtAqUoAAAAAKgoaQDkAFsPYQByAGEA7ABsJDuArQCtQAABZ22zKLsobQBhAAChwwNmdroouijCY4CjPCJkZWdsbnByAMgozCjPKNMo1yjaKN4obwB0AACgairxoEMiCw5FoJ4qAKCgKkWgnSoAoJ8qZQAAoEYi7CF1cwCgJCrhIXJyAKByKWEAcgDyAPwMAAJhZWl07Sj8KAEpCCkAAWxz8Sj4KGwAcwBlAHQAbQDpAH8oaABwAACgMyrwImFyc2wAoOQpAAFkbFoPBSllAACgIyNloKoqc6CsKgDgrCoA/oABZmxwABUpGCkfKfQhY3lMZGKgLwBhoMQpcgAAoD8jZgAA4DXYZN1hAAABZHIoKRcDZQBzAHWgYCZpAHQAAKBgJoABY3N1ADYpRilhKQABYXU6KUApcABzoJMiAOCTIgD+cABzoJQiAOCUIgD+dQAAAWJwSylWKQChjyJlcz4NUCllAHQAZaCPIvEAPw0AoZAiZXNIDVspZQB0AGWgkCLxAEkNAKGhJWFmZilbBHIAZQFrKVwEAKChJWEAcgDyAAMNAAJjZW10dyl7KX8pgilyAADgNdjI3HQAbQDuAM4AaQDsAAYpYQByAOYAVw0AAWFyiimOKXIA5qAGJhESAAFhbpIpoylpImdodAAAAWVwmSmgKXAAcwBpAGwAbwDuANkXaADpAKAkcwCvYIACYmNtbnAArin8KY4NJSooKgCkgiJFZGVtbnByc7wpvinCKcgpzCnUKdgp3CkAoMUqbwB0AACgvSpkoIYibwB0AACgwyr1IWx0AKDBKgABRWXQKdIpAKDLKgCgiiLsIXVzAKC/KuEhcnIAoHkpgAFlaXUA4inxKfQpdAAAoYIiZW7oKewpcQDxoIYivSllAHEA8aCKItEpbQAAoMcqAAFicPgp+ikAoNUqAKDTKmMAgKJ7ImFjZW5zAAcqDSoUKhYqRihwAHAAcgBvAPgAIyh1AHIAbAB5AGUA8QCDDfEAfA2AAWFlcwAcKiIqPShwAHAAcgBvAPgAPChxAPEAOShnAACgaiYApoMiMTIzRWRlaGxtbnBzPCo/KkIqRSpHKlIqWCpjKmcqaypzKncqO4C5ALlAO4CyALJAO4CzALNAAKDGKgABb3NLKk4qdAAAoL4qdQBiAACg2CpkoIcibwB0AACgxCpzAAABb3VdKmAqbAAAoMknYgAAoNcq4SFycgCgeyn1IWx0AKDCKgABRWVvKnEqAKDMKgCgiyLsIXVzAKDAKoABZWl1AH0qjCqPKnQAAKGDImVugyqHKnEA8aCHIkYqZQBxAPGgiyJwKm0AAKDIKgABYnCTKpUqAKDUKgCg1iqAAUFhbgCdKqEqrCpyAHIAAKDZIXIAAAFocqYqqCrrAJUab6CZIfcAxQf3IWFyAKAqKWwAaQBnADuA3wDfQOELzyrZKtwq6SrsKvEqAAD1KjQrAAAAAAAAAAAAAEwrbCsAAHErvSsAAAAAAADRK3IC1CoAAAAA2CrnIWV0AKAWI8RjcgDrAOUKgAFhZXkA4SrkKucq8iFvbmVh5CFpbGNhQmRvAPQAIg5sInJlYwAAoBUjcgAA4DXYMd0AAmVpa2/7KhIrKCsuK/IBACsAAAkrZQAAATRm6g0EK28AcgDlAOsNYQBzorgDECsAAAAAEit5AG0A0WMAAWNuFislK2sAAAFhcxsrIStwAHAAcgBvAPgAFw5pAG0AAKA8InMA8AD9DQABYXMsKyEr8AAXDnIAbgA7gP4A/kDsATgrOyswG2QA5QBnAmUAcwCAgdcAO2JkAEMrRCtJK9dAYaCgInIAAKAxKgCgMCqAAWVwcwBRK1MraSvhAAkh4qKkIlsrXysAAAAAYytvAHQAAKA2I2kAcgAAoPEqb+A12GXdcgBrAACg2irhAHgociJpbWUAAKA0IIABYWlwAHYreSu3K2QA5QC+DYADYWRlbXBzdACFK6MrmiunK6wrsCuzK24iZ2xlAACitSVkbHFykCuUK5ornCvvIXduAKC/JeUhZnRloMMl8QACBwCgXCJpImdodABloLkl8QBdDG8AdAAAoOwlaSJudXMAAKA6KuwhdXMAoDkqYgAAoM0p6SFtZQCgOyrlInppdW0AoOIjgAFjaHQAwivKK80rAAFyecYrySsA4DXYydxGZGMAeQBbZPIhb2tnYQABaW/UK9creAD0ANERaCJlYWQAAAFsct4r5ytlAGYAdABhAHIAcgBvAPcAXQbpJGdodGFycm93AKCgIQAJQUhhYmNkZmdobG1vcHJzdHV3CiwNLBEsHSwnLDEsQCxLLFIsYix6LIQsjyzLLOgs7Sz/LAotcgDyAAkDYQByAACgYykAAWNyFSwbLHUAdABlADuA+gD6QPIACQ1yAOMBIywAACUseQBeZHYAZQBtYQABaXkrLDAscgBjADuA+wD7QENkgAFhYmgANyw6LD0scgDyANEO7CFhY3FhYQDyAOAOAAFpckQsSCzzIWh0AKB+KQDgNdgy3XIAYQB2AGUAO4D5APlAYQFWLF8scgAAAWxyWixcLACgvyEAoL4hbABrAACggCUAAWN0Zix2LG8CbCwAAAAAcyxyAG4AZaAcI3IAAKAcI28AcAAAoA8jcgBpAACg+CUAAWFsfiyBLGMAcgBrYTuAqACoQAABZ3CILIssbwBuAHNhZgAA4DXYZt0AA2FkaGxzdZksniynLLgsuyzFLHIAcgBvAPcACQ1vAHcAbgBhAHIAcgBvAPcA2A5hI3Jwb29uAAABbHKvLLMsZQBmAPQAWyxpAGcAaAD0AF0sdQDzAKYOaQAAocUDaGzBLMIs0mNvAG4AxWPwI2Fycm93cwCgyCGAAWNpdADRLOEs5CxvAtcsAAAAAN4scgBuAGWgHSNyAACgHSNvAHAAAKAOI24AZwBvYXIAaQAAoPklYwByAADgNdjK3IABZGlyAPMs9yz6LG8AdAAAoPAi7CFkZWlhaQBmoLUlAKC0JQABYW0DLQYtcgDyAMosbAA7gPwA/EDhIm5nbGUAoKcpgAdBQkRhY2RlZmxub3Byc3oAJy0qLTAtNC2bLZ0toS2/LcMtxy3TLdgt3C3gLfwtcgDyABADYQByAHag6CoAoOkqYQBzAOgA/gIAAW5yOC08LechcnQAoJwpgANla25wcnN0AJkpSC1NLVQtXi1iLYItYQBwAHAA4QAaHG8AdABoAGkAbgDnAKEXgAFoaXIAoSmzJFotbwBwAPQAdCVooJUh7wD4JgABaXVmLWotZwBtAOEAuygAAWJwbi14LXMjZXRuZXEAceCKIgD+AODLKgD+cyNldG5lcQBx4IsiAP4A4MwqAP4AAWhyhi2KLWUAdADhABIraSNhbmdsZQAAAWxyki2WLeUhZnQAoLIiaSJnaHQAAKCzInkAMmThIXNoAKCiIoABZWxyAKcttC24LWKiKCKuLQAAAACyLWEAcgAAoLsicQAAoFoi7CFpcACg7iIAAWJ0vC1eD2EA8gBfD3IAAOA12DPddAByAOkAlS1zAHUAAAFicM0t0C0A4IIi0iAA4IMi0iBwAGYAAOA12GfdcgBvAPAAWQt0AHIA6QCaLQABY3XkLegtcgAA4DXYy9wAAWJw7C30LW4AAAFFZXUt8S0A4IoiAP5uAAABRWV/LfktAOCLIgD+6SJnemFnAKCaKYADY2Vmb3BycwANLhAuJS4pLiMuLi40LukhcmN1YQABZGkULiEuAAFiZxguHC5hAHIAAKBfKmUAcaAnIgCgWSLlIXJwAKAYIXIAAOA12DTdcABmAADgNdho3WWgQCJhAHQA6ABqD2MAcgAA4DXYzNzjCuQRUC4AAFQuAABYLmIuAAAAAGMubS5wLnQuAAAAAIguki4AAJouJxIqEnQAcgDpAB0ScgAA4DXYNd0AAUFhWy5eLnIA8gDnAnIA8gCTB75jAAFBYWYuaS5yAPIA4AJyAPIAjAdhAPAAeh5pAHMAAKD7IoABZHB0APgReS6DLgABZmx9LoAuAOA12GnddQDzAP8RaQBtAOUABBIAAUFhiy6OLnIA8gDuAnIA8gCaBwABY3GVLgoScgAA4DXYzdwAAXB0nS6hLmwAdQDzACUScgDpACASAARhY2VmaW9zdbEuvC7ELsguzC7PLtQu2S5jAAABdXm2LrsudABlADuA/QD9QE9kAAFpecAuwy5yAGMAd2FLZG4AO4ClAKVAcgAA4DXYNt1jAHkAV2RwAGYAAOA12GrdYwByAADgNdjO3AABY23dLt8ueQBOZGwAO4D/AP9AAAVhY2RlZmhpb3N38y73Lv8uAi8MLxAvEy8YLx0vIi9jInV0ZQB6YQABYXn7Lv4u8iFvbn5hN2RvAHQAfGEAAWV0Bi8KL3QAcgDmAB8QYQC2Y3IAAOA12DfdYwB5ADZk5yJyYXJyAKDdIXAAZgAA4DXYa91jAHIAAOA12M/cAAFqbiYvKC8AoA0gagAAoAwg");
var BinTrieFlags;
(function(BinTrieFlags2) {
  BinTrieFlags2[BinTrieFlags2["VALUE_LENGTH"] = 49152] = "VALUE_LENGTH";
  BinTrieFlags2[BinTrieFlags2["FLAG13"] = 8192] = "FLAG13";
  BinTrieFlags2[BinTrieFlags2["BRANCH_LENGTH"] = 8064] = "BRANCH_LENGTH";
  BinTrieFlags2[BinTrieFlags2["JUMP_TABLE"] = 127] = "JUMP_TABLE";
})(BinTrieFlags || (BinTrieFlags = {}));
var CharCodes$1;
(function(CharCodes2) {
  CharCodes2[CharCodes2["NUM"] = 35] = "NUM";
  CharCodes2[CharCodes2["SEMI"] = 59] = "SEMI";
  CharCodes2[CharCodes2["EQUALS"] = 61] = "EQUALS";
  CharCodes2[CharCodes2["ZERO"] = 48] = "ZERO";
  CharCodes2[CharCodes2["NINE"] = 57] = "NINE";
  CharCodes2[CharCodes2["LOWER_A"] = 97] = "LOWER_A";
  CharCodes2[CharCodes2["LOWER_F"] = 102] = "LOWER_F";
  CharCodes2[CharCodes2["LOWER_X"] = 120] = "LOWER_X";
  CharCodes2[CharCodes2["LOWER_Z"] = 122] = "LOWER_Z";
  CharCodes2[CharCodes2["UPPER_A"] = 65] = "UPPER_A";
  CharCodes2[CharCodes2["UPPER_F"] = 70] = "UPPER_F";
  CharCodes2[CharCodes2["UPPER_Z"] = 90] = "UPPER_Z";
})(CharCodes$1 || (CharCodes$1 = {}));
const TO_LOWER_BIT = 32;
function isNumber(code2) {
  return code2 >= CharCodes$1.ZERO && code2 <= CharCodes$1.NINE;
}
function isHexadecimalCharacter(code2) {
  return code2 >= CharCodes$1.UPPER_A && code2 <= CharCodes$1.UPPER_F || code2 >= CharCodes$1.LOWER_A && code2 <= CharCodes$1.LOWER_F;
}
function isAsciiAlphaNumeric(code2) {
  return code2 >= CharCodes$1.UPPER_A && code2 <= CharCodes$1.UPPER_Z || code2 >= CharCodes$1.LOWER_A && code2 <= CharCodes$1.LOWER_Z || isNumber(code2);
}
function isEntityInAttributeInvalidEnd(code2) {
  return code2 === CharCodes$1.EQUALS || isAsciiAlphaNumeric(code2);
}
var EntityDecoderState;
(function(EntityDecoderState2) {
  EntityDecoderState2[EntityDecoderState2["EntityStart"] = 0] = "EntityStart";
  EntityDecoderState2[EntityDecoderState2["NumericStart"] = 1] = "NumericStart";
  EntityDecoderState2[EntityDecoderState2["NumericDecimal"] = 2] = "NumericDecimal";
  EntityDecoderState2[EntityDecoderState2["NumericHex"] = 3] = "NumericHex";
  EntityDecoderState2[EntityDecoderState2["NamedEntity"] = 4] = "NamedEntity";
})(EntityDecoderState || (EntityDecoderState = {}));
var DecodingMode;
(function(DecodingMode2) {
  DecodingMode2[DecodingMode2["Legacy"] = 0] = "Legacy";
  DecodingMode2[DecodingMode2["Strict"] = 1] = "Strict";
  DecodingMode2[DecodingMode2["Attribute"] = 2] = "Attribute";
})(DecodingMode || (DecodingMode = {}));
class EntityDecoder {
  constructor(decodeTree, emitCodePoint, errors2) {
    this.decodeTree = decodeTree;
    this.emitCodePoint = emitCodePoint;
    this.errors = errors2;
    this.state = EntityDecoderState.EntityStart;
    this.consumed = 1;
    this.result = 0;
    this.treeIndex = 0;
    this.excess = 1;
    this.decodeMode = DecodingMode.Strict;
    this.runConsumed = 0;
  }
  /** Resets the instance to make it reusable. */
  startEntity(decodeMode) {
    this.decodeMode = decodeMode;
    this.state = EntityDecoderState.EntityStart;
    this.result = 0;
    this.treeIndex = 0;
    this.excess = 1;
    this.consumed = 1;
    this.runConsumed = 0;
  }
  /**
   * Write an entity to the decoder. This can be called multiple times with partial entities.
   * If the entity is incomplete, the decoder will return -1.
   *
   * Mirrors the implementation of `getDecoder`, but with the ability to stop decoding if the
   * entity is incomplete, and resume when the next string is written.
   *
   * @param input The string containing the entity (or a continuation of the entity).
   * @param offset The offset at which the entity begins. Should be 0 if this is not the first call.
   * @returns The number of characters that were consumed, or -1 if the entity is incomplete.
   */
  write(input, offset) {
    switch (this.state) {
      case EntityDecoderState.EntityStart: {
        if (input.charCodeAt(offset) === CharCodes$1.NUM) {
          this.state = EntityDecoderState.NumericStart;
          this.consumed += 1;
          return this.stateNumericStart(input, offset + 1);
        }
        this.state = EntityDecoderState.NamedEntity;
        return this.stateNamedEntity(input, offset);
      }
      case EntityDecoderState.NumericStart: {
        return this.stateNumericStart(input, offset);
      }
      case EntityDecoderState.NumericDecimal: {
        return this.stateNumericDecimal(input, offset);
      }
      case EntityDecoderState.NumericHex: {
        return this.stateNumericHex(input, offset);
      }
      case EntityDecoderState.NamedEntity: {
        return this.stateNamedEntity(input, offset);
      }
    }
  }
  /**
   * Switches between the numeric decimal and hexadecimal states.
   *
   * Equivalent to the `Numeric character reference state` in the HTML spec.
   *
   * @param input The string containing the entity (or a continuation of the entity).
   * @param offset The current offset.
   * @returns The number of characters that were consumed, or -1 if the entity is incomplete.
   */
  stateNumericStart(input, offset) {
    if (offset >= input.length) {
      return -1;
    }
    if ((input.charCodeAt(offset) | TO_LOWER_BIT) === CharCodes$1.LOWER_X) {
      this.state = EntityDecoderState.NumericHex;
      this.consumed += 1;
      return this.stateNumericHex(input, offset + 1);
    }
    this.state = EntityDecoderState.NumericDecimal;
    return this.stateNumericDecimal(input, offset);
  }
  /**
   * Parses a hexadecimal numeric entity.
   *
   * Equivalent to the `Hexademical character reference state` in the HTML spec.
   *
   * @param input The string containing the entity (or a continuation of the entity).
   * @param offset The current offset.
   * @returns The number of characters that were consumed, or -1 if the entity is incomplete.
   */
  stateNumericHex(input, offset) {
    while (offset < input.length) {
      const char = input.charCodeAt(offset);
      if (isNumber(char) || isHexadecimalCharacter(char)) {
        const digit = char <= CharCodes$1.NINE ? char - CharCodes$1.ZERO : (char | TO_LOWER_BIT) - CharCodes$1.LOWER_A + 10;
        this.result = this.result * 16 + digit;
        this.consumed++;
        offset++;
      } else {
        return this.emitNumericEntity(char, 3);
      }
    }
    return -1;
  }
  /**
   * Parses a decimal numeric entity.
   *
   * Equivalent to the `Decimal character reference state` in the HTML spec.
   *
   * @param input The string containing the entity (or a continuation of the entity).
   * @param offset The current offset.
   * @returns The number of characters that were consumed, or -1 if the entity is incomplete.
   */
  stateNumericDecimal(input, offset) {
    while (offset < input.length) {
      const char = input.charCodeAt(offset);
      if (isNumber(char)) {
        this.result = this.result * 10 + (char - CharCodes$1.ZERO);
        this.consumed++;
        offset++;
      } else {
        return this.emitNumericEntity(char, 2);
      }
    }
    return -1;
  }
  /**
   * Validate and emit a numeric entity.
   *
   * Implements the logic from the `Hexademical character reference start
   * state` and `Numeric character reference end state` in the HTML spec.
   *
   * @param lastCp The last code point of the entity. Used to see if the
   *               entity was terminated with a semicolon.
   * @param expectedLength The minimum number of characters that should be
   *                       consumed. Used to validate that at least one digit
   *                       was consumed.
   * @returns The number of characters that were consumed.
   */
  emitNumericEntity(lastCp, expectedLength) {
    var _a2;
    if (this.consumed <= expectedLength) {
      (_a2 = this.errors) === null || _a2 === void 0 ? void 0 : _a2.absenceOfDigitsInNumericCharacterReference(this.consumed);
      return 0;
    }
    if (lastCp === CharCodes$1.SEMI) {
      this.consumed += 1;
    } else if (this.decodeMode === DecodingMode.Strict) {
      return 0;
    }
    this.emitCodePoint(replaceCodePoint(this.result), this.consumed);
    if (this.errors) {
      if (lastCp !== CharCodes$1.SEMI) {
        this.errors.missingSemicolonAfterCharacterReference();
      }
      this.errors.validateNumericCharacterReference(this.result);
    }
    return this.consumed;
  }
  /**
   * Parses a named entity.
   *
   * Equivalent to the `Named character reference state` in the HTML spec.
   *
   * @param input The string containing the entity (or a continuation of the entity).
   * @param offset The current offset.
   * @returns The number of characters that were consumed, or -1 if the entity is incomplete.
   */
  stateNamedEntity(input, offset) {
    const { decodeTree } = this;
    let current = decodeTree[this.treeIndex];
    let valueLength = (current & BinTrieFlags.VALUE_LENGTH) >> 14;
    while (offset < input.length) {
      if (valueLength === 0 && (current & BinTrieFlags.FLAG13) !== 0) {
        const runLength = (current & BinTrieFlags.BRANCH_LENGTH) >> 7;
        if (this.runConsumed === 0) {
          const firstChar = current & BinTrieFlags.JUMP_TABLE;
          if (input.charCodeAt(offset) !== firstChar) {
            return this.result === 0 ? 0 : this.emitNotTerminatedNamedEntity();
          }
          offset++;
          this.excess++;
          this.runConsumed++;
        }
        while (this.runConsumed < runLength) {
          if (offset >= input.length) {
            return -1;
          }
          const charIndexInPacked = this.runConsumed - 1;
          const packedWord = decodeTree[this.treeIndex + 1 + (charIndexInPacked >> 1)];
          const expectedChar = charIndexInPacked % 2 === 0 ? packedWord & 255 : packedWord >> 8 & 255;
          if (input.charCodeAt(offset) !== expectedChar) {
            this.runConsumed = 0;
            return this.result === 0 ? 0 : this.emitNotTerminatedNamedEntity();
          }
          offset++;
          this.excess++;
          this.runConsumed++;
        }
        this.runConsumed = 0;
        this.treeIndex += 1 + (runLength >> 1);
        current = decodeTree[this.treeIndex];
        valueLength = (current & BinTrieFlags.VALUE_LENGTH) >> 14;
      }
      if (offset >= input.length)
        break;
      const char = input.charCodeAt(offset);
      if (char === CharCodes$1.SEMI && valueLength !== 0 && (current & BinTrieFlags.FLAG13) !== 0) {
        return this.emitNamedEntityData(this.treeIndex, valueLength, this.consumed + this.excess);
      }
      this.treeIndex = determineBranch(decodeTree, current, this.treeIndex + Math.max(1, valueLength), char);
      if (this.treeIndex < 0) {
        return this.result === 0 || // If we are parsing an attribute
        this.decodeMode === DecodingMode.Attribute && // We shouldn't have consumed any characters after the entity,
        (valueLength === 0 || // And there should be no invalid characters.
        isEntityInAttributeInvalidEnd(char)) ? 0 : this.emitNotTerminatedNamedEntity();
      }
      current = decodeTree[this.treeIndex];
      valueLength = (current & BinTrieFlags.VALUE_LENGTH) >> 14;
      if (valueLength !== 0) {
        if (char === CharCodes$1.SEMI) {
          return this.emitNamedEntityData(this.treeIndex, valueLength, this.consumed + this.excess);
        }
        if (this.decodeMode !== DecodingMode.Strict && (current & BinTrieFlags.FLAG13) === 0) {
          this.result = this.treeIndex;
          this.consumed += this.excess;
          this.excess = 0;
        }
      }
      offset++;
      this.excess++;
    }
    return -1;
  }
  /**
   * Emit a named entity that was not terminated with a semicolon.
   *
   * @returns The number of characters consumed.
   */
  emitNotTerminatedNamedEntity() {
    var _a2;
    const { result, decodeTree } = this;
    const valueLength = (decodeTree[result] & BinTrieFlags.VALUE_LENGTH) >> 14;
    this.emitNamedEntityData(result, valueLength, this.consumed);
    (_a2 = this.errors) === null || _a2 === void 0 ? void 0 : _a2.missingSemicolonAfterCharacterReference();
    return this.consumed;
  }
  /**
   * Emit a named entity.
   *
   * @param result The index of the entity in the decode tree.
   * @param valueLength The number of bytes in the entity.
   * @param consumed The number of characters consumed.
   *
   * @returns The number of characters consumed.
   */
  emitNamedEntityData(result, valueLength, consumed) {
    const { decodeTree } = this;
    this.emitCodePoint(valueLength === 1 ? decodeTree[result] & ~(BinTrieFlags.VALUE_LENGTH | BinTrieFlags.FLAG13) : decodeTree[result + 1], consumed);
    if (valueLength === 3) {
      this.emitCodePoint(decodeTree[result + 2], consumed);
    }
    return consumed;
  }
  /**
   * Signal to the parser that the end of the input was reached.
   *
   * Remaining data will be emitted and relevant errors will be produced.
   *
   * @returns The number of characters consumed.
   */
  end() {
    var _a2;
    switch (this.state) {
      case EntityDecoderState.NamedEntity: {
        return this.result !== 0 && (this.decodeMode !== DecodingMode.Attribute || this.result === this.treeIndex) ? this.emitNotTerminatedNamedEntity() : 0;
      }
      // Otherwise, emit a numeric entity if we have one.
      case EntityDecoderState.NumericDecimal: {
        return this.emitNumericEntity(0, 2);
      }
      case EntityDecoderState.NumericHex: {
        return this.emitNumericEntity(0, 3);
      }
      case EntityDecoderState.NumericStart: {
        (_a2 = this.errors) === null || _a2 === void 0 ? void 0 : _a2.absenceOfDigitsInNumericCharacterReference(this.consumed);
        return 0;
      }
      case EntityDecoderState.EntityStart: {
        return 0;
      }
    }
  }
}
function getDecoder(decodeTree) {
  let returnValue = "";
  const decoder = new EntityDecoder(decodeTree, (data) => returnValue += fromCodePoint$2(data));
  return function decodeWithTrie(input, decodeMode) {
    let lastIndex = 0;
    let offset = 0;
    while ((offset = input.indexOf("&", offset)) >= 0) {
      returnValue += input.slice(lastIndex, offset);
      decoder.startEntity(decodeMode);
      const length2 = decoder.write(
        input,
        // Skip the "&"
        offset + 1
      );
      if (length2 < 0) {
        lastIndex = offset + decoder.end();
        break;
      }
      lastIndex = offset + length2;
      offset = length2 === 0 ? lastIndex + 1 : lastIndex;
    }
    const result = returnValue + input.slice(lastIndex);
    returnValue = "";
    return result;
  };
}
function determineBranch(decodeTree, current, nodeIndex, char) {
  const branchCount = (current & BinTrieFlags.BRANCH_LENGTH) >> 7;
  const jumpOffset = current & BinTrieFlags.JUMP_TABLE;
  if (branchCount === 0) {
    return jumpOffset !== 0 && char === jumpOffset ? nodeIndex : -1;
  }
  if (jumpOffset) {
    const value = char - jumpOffset;
    return value < 0 || value >= branchCount ? -1 : decodeTree[nodeIndex + value] - 1;
  }
  const packedKeySlots = branchCount + 1 >> 1;
  let lo = 0;
  let hi = branchCount - 1;
  while (lo <= hi) {
    const mid = lo + hi >>> 1;
    const slot = mid >> 1;
    const packed = decodeTree[nodeIndex + slot];
    const midKey = packed >> (mid & 1) * 8 & 255;
    if (midKey < char) {
      lo = mid + 1;
    } else if (midKey > char) {
      hi = mid - 1;
    } else {
      return decodeTree[nodeIndex + packedKeySlots + mid];
    }
  }
  return -1;
}
const htmlDecoder = /* @__PURE__ */ getDecoder(htmlDecodeTree);
function decodeHTML(htmlString, mode = DecodingMode.Legacy) {
  return htmlDecoder(htmlString, mode);
}
function decodeHTMLStrict(htmlString) {
  return htmlDecoder(htmlString, DecodingMode.Strict);
}
const decodeCache = {};
function getDecodeCache(exclude) {
  let cache2 = decodeCache[exclude];
  if (cache2) {
    return cache2;
  }
  cache2 = decodeCache[exclude] = [];
  for (let i = 0; i < 128; i++) {
    const ch = String.fromCharCode(i);
    cache2.push(ch);
  }
  for (let i = 0; i < exclude.length; i++) {
    const ch = exclude.charCodeAt(i);
    cache2[ch] = "%" + ("0" + ch.toString(16).toUpperCase()).slice(-2);
  }
  return cache2;
}
function decode$1(string2, exclude) {
  if (typeof exclude !== "string") {
    exclude = decode$1.defaultChars;
  }
  const cache2 = getDecodeCache(exclude);
  return string2.replace(/(%[a-f0-9]{2})+/gi, function(seq) {
    let result = "";
    for (let i = 0, l = seq.length; i < l; i += 3) {
      const b1 = parseInt(seq.slice(i + 1, i + 3), 16);
      if (b1 < 128) {
        result += cache2[b1];
        continue;
      }
      if ((b1 & 224) === 192 && i + 3 < l) {
        const b2 = parseInt(seq.slice(i + 4, i + 6), 16);
        if ((b2 & 192) === 128) {
          const chr = b1 << 6 & 1984 | b2 & 63;
          if (chr < 128) {
            result += "��";
          } else {
            result += String.fromCharCode(chr);
          }
          i += 3;
          continue;
        }
      }
      if ((b1 & 240) === 224 && i + 6 < l) {
        const b2 = parseInt(seq.slice(i + 4, i + 6), 16);
        const b3 = parseInt(seq.slice(i + 7, i + 9), 16);
        if ((b2 & 192) === 128 && (b3 & 192) === 128) {
          const chr = b1 << 12 & 61440 | b2 << 6 & 4032 | b3 & 63;
          if (chr < 2048 || chr >= 55296 && chr <= 57343) {
            result += "���";
          } else {
            result += String.fromCharCode(chr);
          }
          i += 6;
          continue;
        }
      }
      if ((b1 & 248) === 240 && i + 9 < l) {
        const b2 = parseInt(seq.slice(i + 4, i + 6), 16);
        const b3 = parseInt(seq.slice(i + 7, i + 9), 16);
        const b4 = parseInt(seq.slice(i + 10, i + 12), 16);
        if ((b2 & 192) === 128 && (b3 & 192) === 128 && (b4 & 192) === 128) {
          let chr = b1 << 18 & 1835008 | b2 << 12 & 258048 | b3 << 6 & 4032 | b4 & 63;
          if (chr < 65536 || chr > 1114111) {
            result += "����";
          } else {
            chr -= 65536;
            result += String.fromCharCode(55296 + (chr >> 10), 56320 + (chr & 1023));
          }
          i += 9;
          continue;
        }
      }
      result += "�";
    }
    return result;
  });
}
decode$1.defaultChars = ";/?:@&=+$,#";
decode$1.componentChars = "";
const encodeCache = {};
function getEncodeCache(exclude) {
  let cache2 = encodeCache[exclude];
  if (cache2) {
    return cache2;
  }
  cache2 = encodeCache[exclude] = [];
  for (let i = 0; i < 128; i++) {
    const ch = String.fromCharCode(i);
    if (/^[0-9a-z]$/i.test(ch)) {
      cache2.push(ch);
    } else {
      cache2.push("%" + ("0" + i.toString(16).toUpperCase()).slice(-2));
    }
  }
  for (let i = 0; i < exclude.length; i++) {
    cache2[exclude.charCodeAt(i)] = exclude[i];
  }
  return cache2;
}
function encode$1(string2, exclude, keepEscaped) {
  if (typeof exclude !== "string") {
    keepEscaped = exclude;
    exclude = encode$1.defaultChars;
  }
  if (typeof keepEscaped === "undefined") {
    keepEscaped = true;
  }
  const cache2 = getEncodeCache(exclude);
  let result = "";
  for (let i = 0, l = string2.length; i < l; i++) {
    const code2 = string2.charCodeAt(i);
    if (keepEscaped && code2 === 37 && i + 2 < l) {
      if (/^[0-9a-f]{2}$/i.test(string2.slice(i + 1, i + 3))) {
        result += string2.slice(i, i + 3);
        i += 2;
        continue;
      }
    }
    if (code2 < 128) {
      result += cache2[code2];
      continue;
    }
    if (code2 >= 55296 && code2 <= 57343) {
      if (code2 >= 55296 && code2 <= 56319 && i + 1 < l) {
        const nextCode = string2.charCodeAt(i + 1);
        if (nextCode >= 56320 && nextCode <= 57343) {
          result += encodeURIComponent(string2[i] + string2[i + 1]);
          i++;
          continue;
        }
      }
      result += "%EF%BF%BD";
      continue;
    }
    result += encodeURIComponent(string2[i]);
  }
  return result;
}
encode$1.defaultChars = ";/?:@&=+$,-_.!~*'()#";
encode$1.componentChars = "-_.!~*'()";
function format(url) {
  let result = "";
  result += url.protocol || "";
  result += url.slashes ? "//" : "";
  result += url.auth ? url.auth + "@" : "";
  if (url.hostname && url.hostname.indexOf(":") !== -1) {
    result += "[" + url.hostname + "]";
  } else {
    result += url.hostname || "";
  }
  result += url.port ? ":" + url.port : "";
  result += url.pathname || "";
  result += url.search || "";
  result += url.hash || "";
  return result;
}
function Url() {
  this.protocol = null;
  this.slashes = null;
  this.auth = null;
  this.port = null;
  this.hostname = null;
  this.hash = null;
  this.search = null;
  this.pathname = null;
}
const protocolPattern = /^([a-z0-9.+-]+:)/i;
const portPattern = /:[0-9]*$/;
const simplePathPattern = /^(\/\/?(?!\/)[^\?\s]*)(\?[^\s]*)?$/;
const delims = ["<", ">", '"', "`", " ", "\r", "\n", "	"];
const unwise = ["{", "}", "|", "\\", "^", "`"].concat(delims);
const autoEscape = ["'"].concat(unwise);
const nonHostChars = ["%", "/", "?", ";", "#"].concat(autoEscape);
const hostEndingChars = ["/", "?", "#"];
const hostnameMaxLen = 255;
const hostnamePartPattern = /^[+a-z0-9A-Z_-]{0,63}$/;
const hostnamePartStart = /^([+a-z0-9A-Z_-]{0,63})(.*)$/;
const hostlessProtocol = {
  javascript: true,
  "javascript:": true
};
const slashedProtocol = {
  http: true,
  https: true,
  ftp: true,
  gopher: true,
  file: true,
  "http:": true,
  "https:": true,
  "ftp:": true,
  "gopher:": true,
  "file:": true
};
function urlParse(url, slashesDenoteHost) {
  if (url && url instanceof Url) return url;
  const u = new Url();
  u.parse(url, slashesDenoteHost);
  return u;
}
Url.prototype.parse = function(url, slashesDenoteHost) {
  let lowerProto, hec, slashes;
  let rest = url;
  rest = rest.trim();
  if (!slashesDenoteHost && url.split("#").length === 1) {
    const simplePath = simplePathPattern.exec(rest);
    if (simplePath) {
      this.pathname = simplePath[1];
      if (simplePath[2]) {
        this.search = simplePath[2];
      }
      return this;
    }
  }
  let proto = protocolPattern.exec(rest);
  if (proto) {
    proto = proto[0];
    lowerProto = proto.toLowerCase();
    this.protocol = proto;
    rest = rest.substr(proto.length);
  }
  if (slashesDenoteHost || proto || rest.match(/^\/\/[^@\/]+@[^@\/]+/)) {
    slashes = rest.substr(0, 2) === "//";
    if (slashes && !(proto && hostlessProtocol[proto])) {
      rest = rest.substr(2);
      this.slashes = true;
    }
  }
  if (!hostlessProtocol[proto] && (slashes || proto && !slashedProtocol[proto])) {
    let hostEnd = -1;
    for (let i = 0; i < hostEndingChars.length; i++) {
      hec = rest.indexOf(hostEndingChars[i]);
      if (hec !== -1 && (hostEnd === -1 || hec < hostEnd)) {
        hostEnd = hec;
      }
    }
    let auth, atSign;
    if (hostEnd === -1) {
      atSign = rest.lastIndexOf("@");
    } else {
      atSign = rest.lastIndexOf("@", hostEnd);
    }
    if (atSign !== -1) {
      auth = rest.slice(0, atSign);
      rest = rest.slice(atSign + 1);
      this.auth = auth;
    }
    hostEnd = -1;
    for (let i = 0; i < nonHostChars.length; i++) {
      hec = rest.indexOf(nonHostChars[i]);
      if (hec !== -1 && (hostEnd === -1 || hec < hostEnd)) {
        hostEnd = hec;
      }
    }
    if (hostEnd === -1) {
      hostEnd = rest.length;
    }
    if (rest[hostEnd - 1] === ":") {
      hostEnd--;
    }
    const host = rest.slice(0, hostEnd);
    rest = rest.slice(hostEnd);
    this.parseHost(host);
    this.hostname = this.hostname || "";
    const ipv6Hostname = this.hostname[0] === "[" && this.hostname[this.hostname.length - 1] === "]";
    if (!ipv6Hostname) {
      const hostparts = this.hostname.split(/\./);
      for (let i = 0, l = hostparts.length; i < l; i++) {
        const part = hostparts[i];
        if (!part) {
          continue;
        }
        if (!part.match(hostnamePartPattern)) {
          let newpart = "";
          for (let j = 0, k = part.length; j < k; j++) {
            if (part.charCodeAt(j) > 127) {
              newpart += "x";
            } else {
              newpart += part[j];
            }
          }
          if (!newpart.match(hostnamePartPattern)) {
            const validParts = hostparts.slice(0, i);
            const notHost = hostparts.slice(i + 1);
            const bit = part.match(hostnamePartStart);
            if (bit) {
              validParts.push(bit[1]);
              notHost.unshift(bit[2]);
            }
            if (notHost.length) {
              rest = notHost.join(".") + rest;
            }
            this.hostname = validParts.join(".");
            break;
          }
        }
      }
    }
    if (this.hostname.length > hostnameMaxLen) {
      this.hostname = "";
    }
    if (ipv6Hostname) {
      this.hostname = this.hostname.substr(1, this.hostname.length - 2);
    }
  }
  const hash = rest.indexOf("#");
  if (hash !== -1) {
    this.hash = rest.substr(hash);
    rest = rest.slice(0, hash);
  }
  const qm = rest.indexOf("?");
  if (qm !== -1) {
    this.search = rest.substr(qm);
    rest = rest.slice(0, qm);
  }
  if (rest) {
    this.pathname = rest;
  }
  if (slashedProtocol[lowerProto] && this.hostname && !this.pathname) {
    this.pathname = "";
  }
  return this;
};
Url.prototype.parseHost = function(host) {
  let port = portPattern.exec(host);
  if (port) {
    port = port[0];
    if (port !== ":") {
      this.port = port.substr(1);
    }
    host = host.substr(0, host.length - port.length);
  }
  if (host) {
    this.hostname = host;
  }
};
const mdurl = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  decode: decode$1,
  encode: encode$1,
  format,
  parse: urlParse
}, Symbol.toStringTag, { value: "Module" }));
const Any = /[\0-\uD7FF\uE000-\uFFFF]|[\uD800-\uDBFF][\uDC00-\uDFFF]|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?:[^\uD800-\uDBFF]|^)[\uDC00-\uDFFF]/;
const Cc = /[\0-\x1F\x7F-\x9F]/;
const regex$1 = /[\xAD\u0600-\u0605\u061C\u06DD\u070F\u0890\u0891\u08E2\u180E\u200B-\u200F\u202A-\u202E\u2060-\u2064\u2066-\u206F\uFEFF\uFFF9-\uFFFB]|\uD804[\uDCBD\uDCCD]|\uD80D[\uDC30-\uDC3F]|\uD82F[\uDCA0-\uDCA3]|\uD834[\uDD73-\uDD7A]|\uDB40[\uDC01\uDC20-\uDC7F]/;
const P = /[!-#%-\*,-\/:;\?@\[-\]_\{\}\xA1\xA7\xAB\xB6\xB7\xBB\xBF\u037E\u0387\u055A-\u055F\u0589\u058A\u05BE\u05C0\u05C3\u05C6\u05F3\u05F4\u0609\u060A\u060C\u060D\u061B\u061D-\u061F\u066A-\u066D\u06D4\u0700-\u070D\u07F7-\u07F9\u0830-\u083E\u085E\u0964\u0965\u0970\u09FD\u0A76\u0AF0\u0C77\u0C84\u0DF4\u0E4F\u0E5A\u0E5B\u0F04-\u0F12\u0F14\u0F3A-\u0F3D\u0F85\u0FD0-\u0FD4\u0FD9\u0FDA\u104A-\u104F\u10FB\u1360-\u1368\u1400\u166E\u169B\u169C\u16EB-\u16ED\u1735\u1736\u17D4-\u17D6\u17D8-\u17DA\u1800-\u180A\u1944\u1945\u1A1E\u1A1F\u1AA0-\u1AA6\u1AA8-\u1AAD\u1B5A-\u1B60\u1B7D\u1B7E\u1BFC-\u1BFF\u1C3B-\u1C3F\u1C7E\u1C7F\u1CC0-\u1CC7\u1CD3\u2010-\u2027\u2030-\u2043\u2045-\u2051\u2053-\u205E\u207D\u207E\u208D\u208E\u2308-\u230B\u2329\u232A\u2768-\u2775\u27C5\u27C6\u27E6-\u27EF\u2983-\u2998\u29D8-\u29DB\u29FC\u29FD\u2CF9-\u2CFC\u2CFE\u2CFF\u2D70\u2E00-\u2E2E\u2E30-\u2E4F\u2E52-\u2E5D\u3001-\u3003\u3008-\u3011\u3014-\u301F\u3030\u303D\u30A0\u30FB\uA4FE\uA4FF\uA60D-\uA60F\uA673\uA67E\uA6F2-\uA6F7\uA874-\uA877\uA8CE\uA8CF\uA8F8-\uA8FA\uA8FC\uA92E\uA92F\uA95F\uA9C1-\uA9CD\uA9DE\uA9DF\uAA5C-\uAA5F\uAADE\uAADF\uAAF0\uAAF1\uABEB\uFD3E\uFD3F\uFE10-\uFE19\uFE30-\uFE52\uFE54-\uFE61\uFE63\uFE68\uFE6A\uFE6B\uFF01-\uFF03\uFF05-\uFF0A\uFF0C-\uFF0F\uFF1A\uFF1B\uFF1F\uFF20\uFF3B-\uFF3D\uFF3F\uFF5B\uFF5D\uFF5F-\uFF65]|\uD800[\uDD00-\uDD02\uDF9F\uDFD0]|\uD801\uDD6F|\uD802[\uDC57\uDD1F\uDD3F\uDE50-\uDE58\uDE7F\uDEF0-\uDEF6\uDF39-\uDF3F\uDF99-\uDF9C]|\uD803[\uDEAD\uDF55-\uDF59\uDF86-\uDF89]|\uD804[\uDC47-\uDC4D\uDCBB\uDCBC\uDCBE-\uDCC1\uDD40-\uDD43\uDD74\uDD75\uDDC5-\uDDC8\uDDCD\uDDDB\uDDDD-\uDDDF\uDE38-\uDE3D\uDEA9]|\uD805[\uDC4B-\uDC4F\uDC5A\uDC5B\uDC5D\uDCC6\uDDC1-\uDDD7\uDE41-\uDE43\uDE60-\uDE6C\uDEB9\uDF3C-\uDF3E]|\uD806[\uDC3B\uDD44-\uDD46\uDDE2\uDE3F-\uDE46\uDE9A-\uDE9C\uDE9E-\uDEA2\uDF00-\uDF09]|\uD807[\uDC41-\uDC45\uDC70\uDC71\uDEF7\uDEF8\uDF43-\uDF4F\uDFFF]|\uD809[\uDC70-\uDC74]|\uD80B[\uDFF1\uDFF2]|\uD81A[\uDE6E\uDE6F\uDEF5\uDF37-\uDF3B\uDF44]|\uD81B[\uDE97-\uDE9A\uDFE2]|\uD82F\uDC9F|\uD836[\uDE87-\uDE8B]|\uD83A[\uDD5E\uDD5F]/;
const regex = /[\$\+<->\^`\|~\xA2-\xA6\xA8\xA9\xAC\xAE-\xB1\xB4\xB8\xD7\xF7\u02C2-\u02C5\u02D2-\u02DF\u02E5-\u02EB\u02ED\u02EF-\u02FF\u0375\u0384\u0385\u03F6\u0482\u058D-\u058F\u0606-\u0608\u060B\u060E\u060F\u06DE\u06E9\u06FD\u06FE\u07F6\u07FE\u07FF\u0888\u09F2\u09F3\u09FA\u09FB\u0AF1\u0B70\u0BF3-\u0BFA\u0C7F\u0D4F\u0D79\u0E3F\u0F01-\u0F03\u0F13\u0F15-\u0F17\u0F1A-\u0F1F\u0F34\u0F36\u0F38\u0FBE-\u0FC5\u0FC7-\u0FCC\u0FCE\u0FCF\u0FD5-\u0FD8\u109E\u109F\u1390-\u1399\u166D\u17DB\u1940\u19DE-\u19FF\u1B61-\u1B6A\u1B74-\u1B7C\u1FBD\u1FBF-\u1FC1\u1FCD-\u1FCF\u1FDD-\u1FDF\u1FED-\u1FEF\u1FFD\u1FFE\u2044\u2052\u207A-\u207C\u208A-\u208C\u20A0-\u20C0\u2100\u2101\u2103-\u2106\u2108\u2109\u2114\u2116-\u2118\u211E-\u2123\u2125\u2127\u2129\u212E\u213A\u213B\u2140-\u2144\u214A-\u214D\u214F\u218A\u218B\u2190-\u2307\u230C-\u2328\u232B-\u2426\u2440-\u244A\u249C-\u24E9\u2500-\u2767\u2794-\u27C4\u27C7-\u27E5\u27F0-\u2982\u2999-\u29D7\u29DC-\u29FB\u29FE-\u2B73\u2B76-\u2B95\u2B97-\u2BFF\u2CE5-\u2CEA\u2E50\u2E51\u2E80-\u2E99\u2E9B-\u2EF3\u2F00-\u2FD5\u2FF0-\u2FFF\u3004\u3012\u3013\u3020\u3036\u3037\u303E\u303F\u309B\u309C\u3190\u3191\u3196-\u319F\u31C0-\u31E3\u31EF\u3200-\u321E\u322A-\u3247\u3250\u3260-\u327F\u328A-\u32B0\u32C0-\u33FF\u4DC0-\u4DFF\uA490-\uA4C6\uA700-\uA716\uA720\uA721\uA789\uA78A\uA828-\uA82B\uA836-\uA839\uAA77-\uAA79\uAB5B\uAB6A\uAB6B\uFB29\uFBB2-\uFBC2\uFD40-\uFD4F\uFDCF\uFDFC-\uFDFF\uFE62\uFE64-\uFE66\uFE69\uFF04\uFF0B\uFF1C-\uFF1E\uFF3E\uFF40\uFF5C\uFF5E\uFFE0-\uFFE6\uFFE8-\uFFEE\uFFFC\uFFFD]|\uD800[\uDD37-\uDD3F\uDD79-\uDD89\uDD8C-\uDD8E\uDD90-\uDD9C\uDDA0\uDDD0-\uDDFC]|\uD802[\uDC77\uDC78\uDEC8]|\uD805\uDF3F|\uD807[\uDFD5-\uDFF1]|\uD81A[\uDF3C-\uDF3F\uDF45]|\uD82F\uDC9C|\uD833[\uDF50-\uDFC3]|\uD834[\uDC00-\uDCF5\uDD00-\uDD26\uDD29-\uDD64\uDD6A-\uDD6C\uDD83\uDD84\uDD8C-\uDDA9\uDDAE-\uDDEA\uDE00-\uDE41\uDE45\uDF00-\uDF56]|\uD835[\uDEC1\uDEDB\uDEFB\uDF15\uDF35\uDF4F\uDF6F\uDF89\uDFA9\uDFC3]|\uD836[\uDC00-\uDDFF\uDE37-\uDE3A\uDE6D-\uDE74\uDE76-\uDE83\uDE85\uDE86]|\uD838[\uDD4F\uDEFF]|\uD83B[\uDCAC\uDCB0\uDD2E\uDEF0\uDEF1]|\uD83C[\uDC00-\uDC2B\uDC30-\uDC93\uDCA0-\uDCAE\uDCB1-\uDCBF\uDCC1-\uDCCF\uDCD1-\uDCF5\uDD0D-\uDDAD\uDDE6-\uDE02\uDE10-\uDE3B\uDE40-\uDE48\uDE50\uDE51\uDE60-\uDE65\uDF00-\uDFFF]|\uD83D[\uDC00-\uDED7\uDEDC-\uDEEC\uDEF0-\uDEFC\uDF00-\uDF76\uDF7B-\uDFD9\uDFE0-\uDFEB\uDFF0]|\uD83E[\uDC00-\uDC0B\uDC10-\uDC47\uDC50-\uDC59\uDC60-\uDC87\uDC90-\uDCAD\uDCB0\uDCB1\uDD00-\uDE53\uDE60-\uDE6D\uDE70-\uDE7C\uDE80-\uDE88\uDE90-\uDEBD\uDEBF-\uDEC5\uDECE-\uDEDB\uDEE0-\uDEE8\uDEF0-\uDEF8\uDF00-\uDF92\uDF94-\uDFCA]/;
const Z = /[ \xA0\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000]/;
const ucmicro = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  Any,
  Cc,
  Cf: regex$1,
  P,
  S: regex,
  Z
}, Symbol.toStringTag, { value: "Module" }));
function reFactory(opts) {
  const re = {};
  opts = opts || {};
  re.src_Any = Any.source;
  re.src_Cc = Cc.source;
  re.src_Z = Z.source;
  re.src_P = P.source;
  re.src_ZPCc = [re.src_Z, re.src_P, re.src_Cc].join("|");
  re.src_ZCc = [re.src_Z, re.src_Cc].join("|");
  const text_separators = "[><｜]";
  re.src_pseudo_letter = `(?:(?!${text_separators}|${re.src_ZPCc})${re.src_Any})`;
  re.src_ip4 = "(?:(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\\.){3}(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)";
  re.src_auth = `(?:(?:(?!${re.src_ZCc}|[@/\\[\\]()]).){1,50}@)?`;
  re.src_port = "(?::(?:6(?:[0-4]\\d{3}|5(?:[0-4]\\d{2}|5(?:[0-2]\\d|3[0-5])))|[1-5]?\\d{1,4}))?";
  re.src_host_terminator = `(?=$|${text_separators}|${re.src_ZPCc})(?!${opts["---"] ? "-(?!--)|" : "-|"}_|:\\d|\\.-|\\.(?!$|${re.src_ZPCc}))`;
  re.src_path = `(?:[/?#](?:(?!${re.src_ZCc}|${text_separators}|[()[\\]{}.,"'?!\\-;]).|\\[(?:(?!${re.src_ZCc}|\\]).)*\\]|\\((?:(?!${re.src_ZCc}|[)]).)*\\)|\\{(?:(?!${re.src_ZCc}|[}]).)*\\}|\\"(?:(?!${re.src_ZCc}|["]).)+\\"|\\'(?:(?!${re.src_ZCc}|[']).)+\\'|\\'(?=${re.src_pseudo_letter}|[-])|\\.{2,}[a-zA-Z0-9%/&]|\\.(?!${re.src_ZCc}|[.]|$)|` + (opts["---"] ? "\\-(?!--(?:[^-]|$))(?:-*)|" : "\\-+|") + // allow `,,,` in paths
  `,(?!${re.src_ZCc}|$)|;(?!${re.src_ZCc}|$)|\\!+(?!${re.src_ZCc}|[!]|$)|\\?(?!${re.src_ZCc}|[?]|$))+|\\/)?`;
  re.src_email_name = '[\\-;:&=\\+\\$,\\.a-zA-Z0-9_][\\-;:&=\\+\\$,\\"\\.a-zA-Z0-9_]{0,63}';
  re.src_xn = "xn--[a-z0-9\\-]{1,59}";
  re.src_domain_root = // Allow letters & digits (http://test1)
  "(?:" + re.src_xn + `|${re.src_pseudo_letter}{1,63})`;
  re.src_domain = "(?:" + re.src_xn + `|(?:${re.src_pseudo_letter})|(?:${re.src_pseudo_letter}(?:-|${re.src_pseudo_letter}){0,61}${re.src_pseudo_letter}))`;
  re.src_host = `(?:(?:(?:(?:${re.src_domain})\\.)*${re.src_domain}))`;
  re.tpl_host_fuzzy = "(?:" + re.src_ip4 + `|(?:(?:(?:${re.src_domain})\\.)+(?:%TLDS%)))`;
  re.tpl_host_no_ip_fuzzy = `(?:(?:(?:${re.src_domain})\\.)+(?:%TLDS%))`;
  re.src_host_strict = re.src_host + re.src_host_terminator;
  re.tpl_host_fuzzy_strict = re.tpl_host_fuzzy + re.src_host_terminator;
  re.src_host_port_strict = re.src_host + re.src_port + re.src_host_terminator;
  re.tpl_host_port_fuzzy_strict = re.tpl_host_fuzzy + re.src_port + re.src_host_terminator;
  re.tpl_host_port_no_ip_fuzzy_strict = re.tpl_host_no_ip_fuzzy + re.src_port + re.src_host_terminator;
  re.tpl_host_fuzzy_test = `localhost|www\\.|\\.\\d{1,3}\\.|(?:\\.(?:%TLDS%)(?:${re.src_ZPCc}|>|$))`;
  re.tpl_email_fuzzy = `(^|${text_separators}|"|\\(|${re.src_ZCc})(${re.src_email_name}@${re.tpl_host_fuzzy_strict})`;
  re.tpl_link_fuzzy = // Fuzzy link can't be prepended with .:/\- and non punctuation.
  // but can start with > (markdown blockquote)
  `(^|(?![.:/\\-_@])(?:[$+<=>^\`|｜]|${re.src_ZPCc}))((?![$+<=>^\`|｜])${re.tpl_host_port_fuzzy_strict}${re.src_path})`;
  re.tpl_link_no_ip_fuzzy = // Fuzzy link can't be prepended with .:/\- and non punctuation.
  // but can start with > (markdown blockquote)
  `(^|(?![.:/\\-_@])(?:[$+<=>^\`|｜]|${re.src_ZPCc}))((?![$+<=>^\`|｜])${re.tpl_host_port_no_ip_fuzzy_strict}${re.src_path})`;
  return re;
}
function assign$1(obj) {
  const sources = Array.prototype.slice.call(arguments, 1);
  sources.forEach(function(source) {
    if (!source) {
      return;
    }
    Object.keys(source).forEach(function(key) {
      obj[key] = source[key];
    });
  });
  return obj;
}
function _class(obj) {
  return Object.prototype.toString.call(obj);
}
function isString$1(obj) {
  return _class(obj) === "[object String]";
}
function isObject(obj) {
  return _class(obj) === "[object Object]";
}
function isRegExp(obj) {
  return _class(obj) === "[object RegExp]";
}
function isFunction(obj) {
  return _class(obj) === "[object Function]";
}
function escapeRE$1(str) {
  return str.replace(/[.?*+^$[\]\\(){}|-]/g, "\\$&");
}
const defaultOptions$1 = {
  fuzzyLink: true,
  fuzzyEmail: true,
  fuzzyIP: false
};
function isOptionsObj(obj) {
  return Object.keys(obj || {}).reduce(function(acc, k) {
    return acc || defaultOptions$1.hasOwnProperty(k);
  }, false);
}
const defaultSchemas = {
  "http:": {
    validate: function(text2, pos, self) {
      const tail = text2.slice(pos);
      if (!self.re.http) {
        self.re.http = new RegExp(
          `^\\/\\/${self.re.src_auth}${self.re.src_host_port_strict}${self.re.src_path}`,
          "i"
        );
      }
      if (self.re.http.test(tail)) {
        return tail.match(self.re.http)[0].length;
      }
      return 0;
    }
  },
  "https:": "http:",
  "ftp:": "http:",
  "//": {
    validate: function(text2, pos, self) {
      const tail = text2.slice(pos);
      if (!self.re.no_http) {
        self.re.no_http = new RegExp(
          "^" + self.re.src_auth + // Don't allow single-level domains, because of false positives like '//test'
          // with code comments
          `(?:localhost|(?:(?:${self.re.src_domain})\\.)+${self.re.src_domain_root})` + self.re.src_port + self.re.src_host_terminator + self.re.src_path,
          "i"
        );
      }
      if (self.re.no_http.test(tail)) {
        if (pos >= 3 && text2[pos - 3] === ":") {
          return 0;
        }
        if (pos >= 3 && text2[pos - 3] === "/") {
          return 0;
        }
        return tail.match(self.re.no_http)[0].length;
      }
      return 0;
    }
  },
  "mailto:": {
    validate: function(text2, pos, self) {
      const tail = text2.slice(pos);
      if (!self.re.mailto) {
        self.re.mailto = new RegExp(
          `^${self.re.src_email_name}@${self.re.src_host_strict}`,
          "i"
        );
      }
      if (self.re.mailto.test(tail)) {
        return tail.match(self.re.mailto)[0].length;
      }
      return 0;
    }
  }
};
const tlds_2ch_src_re = "a[cdefgilmnoqrstuwxz]|b[abdefghijmnorstvwyz]|c[acdfghiklmnoruvwxyz]|d[ejkmoz]|e[cegrstu]|f[ijkmor]|g[abdefghilmnpqrstuwy]|h[kmnrtu]|i[delmnoqrst]|j[emop]|k[eghimnprwyz]|l[abcikrstuvy]|m[acdeghklmnopqrstuvwxyz]|n[acefgilopruz]|om|p[aefghklmnrstwy]|qa|r[eosuw]|s[abcdeghijklmnortuvxyz]|t[cdfghjklmnortvwz]|u[agksyz]|v[aceginu]|w[fs]|y[et]|z[amw]";
const tlds_default = "biz|com|edu|gov|net|org|pro|web|xxx|aero|asia|coop|info|museum|name|shop|рф".split("|");
function createValidator(re) {
  return function(text2, pos) {
    const tail = text2.slice(pos);
    if (re.test(tail)) {
      return tail.match(re)[0].length;
    }
    return 0;
  };
}
function createNormalizer() {
  return function(match2, self) {
    self.normalize(match2);
  };
}
function compile(self) {
  const re = self.re = reFactory(self.__opts__);
  const tlds2 = self.__tlds__.slice();
  self.onCompile();
  if (!self.__tlds_replaced__) {
    tlds2.push(tlds_2ch_src_re);
  }
  tlds2.push(re.src_xn);
  re.src_tlds = tlds2.join("|");
  function untpl(tpl) {
    return tpl.replace("%TLDS%", re.src_tlds);
  }
  re.email_fuzzy = RegExp(untpl(re.tpl_email_fuzzy), "i");
  re.email_fuzzy_global = RegExp(untpl(re.tpl_email_fuzzy), "ig");
  re.link_fuzzy = RegExp(untpl(re.tpl_link_fuzzy), "i");
  re.link_fuzzy_global = RegExp(untpl(re.tpl_link_fuzzy), "ig");
  re.link_no_ip_fuzzy = RegExp(untpl(re.tpl_link_no_ip_fuzzy), "i");
  re.link_no_ip_fuzzy_global = RegExp(untpl(re.tpl_link_no_ip_fuzzy), "ig");
  re.host_fuzzy_test = RegExp(untpl(re.tpl_host_fuzzy_test), "i");
  const aliases = [];
  self.__compiled__ = {};
  function schemaError(name, val) {
    throw new Error(`(LinkifyIt) Invalid schema "${name}": ${val}`);
  }
  Object.keys(self.__schemas__).forEach(function(name) {
    const val = self.__schemas__[name];
    if (val === null) {
      return;
    }
    const compiled = { validate: null, link: null };
    self.__compiled__[name] = compiled;
    if (isObject(val)) {
      if (isRegExp(val.validate)) {
        compiled.validate = createValidator(val.validate);
      } else if (isFunction(val.validate)) {
        compiled.validate = val.validate;
      } else {
        schemaError(name, val);
      }
      if (isFunction(val.normalize)) {
        compiled.normalize = val.normalize;
      } else if (!val.normalize) {
        compiled.normalize = createNormalizer();
      } else {
        schemaError(name, val);
      }
      return;
    }
    if (isString$1(val)) {
      aliases.push(name);
      return;
    }
    schemaError(name, val);
  });
  aliases.forEach(function(alias) {
    if (!self.__compiled__[self.__schemas__[alias]]) {
      return;
    }
    self.__compiled__[alias].validate = self.__compiled__[self.__schemas__[alias]].validate;
    self.__compiled__[alias].normalize = self.__compiled__[self.__schemas__[alias]].normalize;
  });
  self.__compiled__[""] = { validate: null, normalize: createNormalizer() };
  const slist = Object.keys(self.__compiled__).filter(function(name) {
    return name.length > 0 && self.__compiled__[name];
  }).map(escapeRE$1).join("|");
  self.re.schema_test = RegExp(`(^|(?!_)(?:[><｜]|${re.src_ZPCc}))(${slist})`, "i");
  self.re.schema_search = RegExp(`(^|(?!_)(?:[><｜]|${re.src_ZPCc}))(${slist})`, "ig");
  self.re.schema_at_start = RegExp(`^${self.re.schema_search.source}`, "i");
  self.re.pretest = RegExp(
    `(${self.re.schema_test.source})|(${self.re.host_fuzzy_test.source})|@`,
    "i"
  );
}
function Match(text2, schema, index2, lastIndex) {
  const raw = text2.slice(index2, lastIndex);
  this.schema = schema.toLowerCase();
  this.index = index2;
  this.lastIndex = lastIndex;
  this.raw = raw;
  this.text = raw;
  this.url = raw;
}
function LinkifyIt(schemas, options) {
  if (!(this instanceof LinkifyIt)) {
    return new LinkifyIt(schemas, options);
  }
  if (!options) {
    if (isOptionsObj(schemas)) {
      options = schemas;
      schemas = {};
    }
  }
  this.__opts__ = assign$1({}, defaultOptions$1, options);
  this.__schemas__ = assign$1({}, defaultSchemas, schemas);
  this.__compiled__ = {};
  this.__tlds__ = tlds_default;
  this.__tlds_replaced__ = false;
  this.re = {};
  compile(this);
}
LinkifyIt.prototype.add = function add(schema, definition) {
  this.__schemas__[schema] = definition;
  compile(this);
  return this;
};
LinkifyIt.prototype.set = function set(options) {
  this.__opts__ = assign$1(this.__opts__, options);
  return this;
};
LinkifyIt.prototype.test = function test(text2) {
  if (!text2.length) {
    return false;
  }
  let m, re;
  if (this.re.schema_test.test(text2)) {
    re = this.re.schema_search;
    re.lastIndex = 0;
    while ((m = re.exec(text2)) !== null) {
      if (this.testSchemaAt(text2, m[2], re.lastIndex)) {
        return true;
      }
    }
  }
  if (this.__opts__.fuzzyLink && this.__compiled__["http:"]) {
    if (text2.search(this.re.host_fuzzy_test) >= 0) {
      if (text2.match(this.__opts__.fuzzyIP ? this.re.link_fuzzy : this.re.link_no_ip_fuzzy) !== null) {
        return true;
      }
    }
  }
  if (this.__opts__.fuzzyEmail && this.__compiled__["mailto:"]) {
    if (text2.indexOf("@") >= 0) {
      if (text2.match(this.re.email_fuzzy) !== null) {
        return true;
      }
    }
  }
  return false;
};
LinkifyIt.prototype.pretest = function pretest(text2) {
  return this.re.pretest.test(text2);
};
LinkifyIt.prototype.testSchemaAt = function testSchemaAt(text2, schema, pos) {
  if (!this.__compiled__[schema.toLowerCase()]) {
    return 0;
  }
  return this.__compiled__[schema.toLowerCase()].validate(text2, pos, this);
};
LinkifyIt.prototype.match = function match(text2) {
  const result = [];
  const type_schemed = [];
  const type_fuzzy_link = [];
  const type_fuzzy_email = [];
  let m, len, re;
  function choose(a, b) {
    if (!a) {
      return b;
    }
    if (!b) {
      return a;
    }
    if (a.index !== b.index) {
      return a.index < b.index ? a : b;
    }
    return a.lastIndex >= b.lastIndex ? a : b;
  }
  if (!text2.length) {
    return null;
  }
  if (this.re.schema_test.test(text2)) {
    re = this.re.schema_search;
    re.lastIndex = 0;
    while ((m = re.exec(text2)) !== null) {
      len = this.testSchemaAt(text2, m[2], re.lastIndex);
      if (len) {
        type_schemed.push({
          schema: m[2],
          index: m.index + m[1].length,
          lastIndex: m.index + m[0].length + len
        });
      }
    }
  }
  if (this.__opts__.fuzzyLink && this.__compiled__["http:"]) {
    re = this.__opts__.fuzzyIP ? this.re.link_fuzzy_global : this.re.link_no_ip_fuzzy_global;
    re.lastIndex = 0;
    while ((m = re.exec(text2)) !== null) {
      type_fuzzy_link.push({
        schema: "",
        index: m.index + m[1].length,
        lastIndex: m.index + m[0].length
      });
    }
  }
  if (this.__opts__.fuzzyEmail && this.__compiled__["mailto:"]) {
    re = this.re.email_fuzzy_global;
    re.lastIndex = 0;
    while ((m = re.exec(text2)) !== null) {
      type_fuzzy_email.push({
        schema: "mailto:",
        index: m.index + m[1].length,
        lastIndex: m.index + m[0].length
      });
    }
  }
  const indexes = [0, 0, 0];
  let lastIndex = 0;
  for (; ; ) {
    const candidates = [
      type_schemed[indexes[0]],
      type_fuzzy_email[indexes[1]],
      type_fuzzy_link[indexes[2]]
    ];
    const candidate = choose(choose(candidates[0], candidates[1]), candidates[2]);
    if (!candidate) {
      break;
    }
    if (candidate === candidates[0]) {
      indexes[0]++;
    } else if (candidate === candidates[1]) {
      indexes[1]++;
    } else {
      indexes[2]++;
    }
    if (candidate.index < lastIndex) {
      continue;
    }
    const match2 = new Match(text2, candidate.schema, candidate.index, candidate.lastIndex);
    this.__compiled__[match2.schema].normalize(match2, this);
    result.push(match2);
    lastIndex = candidate.lastIndex;
  }
  if (result.length) {
    return result;
  }
  return null;
};
LinkifyIt.prototype.matchAtStart = function matchAtStart(text2) {
  if (!text2.length) return null;
  const m = this.re.schema_at_start.exec(text2);
  if (!m) return null;
  const len = this.testSchemaAt(text2, m[2], m[0].length);
  if (!len) return null;
  const match2 = new Match(text2, m[2], m.index + m[1].length, m.index + m[0].length + len);
  this.__compiled__[match2.schema].normalize(match2, this);
  return match2;
};
LinkifyIt.prototype.tlds = function tlds(list2, keepOld) {
  list2 = Array.isArray(list2) ? list2 : [list2];
  if (!keepOld) {
    this.__tlds__ = list2.slice();
    this.__tlds_replaced__ = true;
    compile(this);
    return this;
  }
  this.__tlds__ = this.__tlds__.concat(list2).sort().filter(function(el, idx, arr) {
    return el !== arr[idx - 1];
  }).reverse();
  compile(this);
  return this;
};
LinkifyIt.prototype.normalize = function normalize(match2) {
  if (!match2.schema) {
    match2.url = `http://${match2.url}`;
  }
  if (match2.schema === "mailto:" && !/^mailto:/i.test(match2.url)) {
    match2.url = `mailto:${match2.url}`;
  }
};
LinkifyIt.prototype.onCompile = function onCompile() {
};
const maxInt = 2147483647;
const base = 36;
const tMin = 1;
const tMax = 26;
const skew = 38;
const damp = 700;
const initialBias = 72;
const initialN = 128;
const delimiter = "-";
const regexPunycode = /^xn--/;
const regexNonASCII = /[^\0-\x7F]/;
const regexSeparators = /[\x2E\u3002\uFF0E\uFF61]/g;
const errors = {
  "overflow": "Overflow: input needs wider integers to process",
  "not-basic": "Illegal input >= 0x80 (not a basic code point)",
  "invalid-input": "Invalid input"
};
const baseMinusTMin = base - tMin;
const floor = Math.floor;
const stringFromCharCode = String.fromCharCode;
function error(type) {
  throw new RangeError(errors[type]);
}
function map(array2, callback) {
  const result = [];
  let length2 = array2.length;
  while (length2--) {
    result[length2] = callback(array2[length2]);
  }
  return result;
}
function mapDomain(domain, callback) {
  const parts = domain.split("@");
  let result = "";
  if (parts.length > 1) {
    result = parts[0] + "@";
    domain = parts[1];
  }
  domain = domain.replace(regexSeparators, ".");
  const labels = domain.split(".");
  const encoded = map(labels, callback).join(".");
  return result + encoded;
}
function ucs2decode(string2) {
  const output = [];
  let counter = 0;
  const length2 = string2.length;
  while (counter < length2) {
    const value = string2.charCodeAt(counter++);
    if (value >= 55296 && value <= 56319 && counter < length2) {
      const extra = string2.charCodeAt(counter++);
      if ((extra & 64512) == 56320) {
        output.push(((value & 1023) << 10) + (extra & 1023) + 65536);
      } else {
        output.push(value);
        counter--;
      }
    } else {
      output.push(value);
    }
  }
  return output;
}
const ucs2encode = (codePoints) => String.fromCodePoint(...codePoints);
const basicToDigit = function(codePoint) {
  if (codePoint >= 48 && codePoint < 58) {
    return 26 + (codePoint - 48);
  }
  if (codePoint >= 65 && codePoint < 91) {
    return codePoint - 65;
  }
  if (codePoint >= 97 && codePoint < 123) {
    return codePoint - 97;
  }
  return base;
};
const digitToBasic = function(digit, flag) {
  return digit + 22 + 75 * (digit < 26) - ((flag != 0) << 5);
};
const adapt = function(delta, numPoints, firstTime) {
  let k = 0;
  delta = firstTime ? floor(delta / damp) : delta >> 1;
  delta += floor(delta / numPoints);
  for (; delta > baseMinusTMin * tMax >> 1; k += base) {
    delta = floor(delta / baseMinusTMin);
  }
  return floor(k + (baseMinusTMin + 1) * delta / (delta + skew));
};
const decode = function(input) {
  const output = [];
  const inputLength = input.length;
  let i = 0;
  let n = initialN;
  let bias = initialBias;
  let basic = input.lastIndexOf(delimiter);
  if (basic < 0) {
    basic = 0;
  }
  for (let j = 0; j < basic; ++j) {
    if (input.charCodeAt(j) >= 128) {
      error("not-basic");
    }
    output.push(input.charCodeAt(j));
  }
  for (let index2 = basic > 0 ? basic + 1 : 0; index2 < inputLength; ) {
    const oldi = i;
    for (let w = 1, k = base; ; k += base) {
      if (index2 >= inputLength) {
        error("invalid-input");
      }
      const digit = basicToDigit(input.charCodeAt(index2++));
      if (digit >= base) {
        error("invalid-input");
      }
      if (digit > floor((maxInt - i) / w)) {
        error("overflow");
      }
      i += digit * w;
      const t = k <= bias ? tMin : k >= bias + tMax ? tMax : k - bias;
      if (digit < t) {
        break;
      }
      const baseMinusT = base - t;
      if (w > floor(maxInt / baseMinusT)) {
        error("overflow");
      }
      w *= baseMinusT;
    }
    const out = output.length + 1;
    bias = adapt(i - oldi, out, oldi == 0);
    if (floor(i / out) > maxInt - n) {
      error("overflow");
    }
    n += floor(i / out);
    i %= out;
    output.splice(i++, 0, n);
  }
  return String.fromCodePoint(...output);
};
const encode = function(input) {
  const output = [];
  input = ucs2decode(input);
  const inputLength = input.length;
  let n = initialN;
  let delta = 0;
  let bias = initialBias;
  for (const currentValue of input) {
    if (currentValue < 128) {
      output.push(stringFromCharCode(currentValue));
    }
  }
  const basicLength = output.length;
  let handledCPCount = basicLength;
  if (basicLength) {
    output.push(delimiter);
  }
  while (handledCPCount < inputLength) {
    let m = maxInt;
    for (const currentValue of input) {
      if (currentValue >= n && currentValue < m) {
        m = currentValue;
      }
    }
    const handledCPCountPlusOne = handledCPCount + 1;
    if (m - n > floor((maxInt - delta) / handledCPCountPlusOne)) {
      error("overflow");
    }
    delta += (m - n) * handledCPCountPlusOne;
    n = m;
    for (const currentValue of input) {
      if (currentValue < n && ++delta > maxInt) {
        error("overflow");
      }
      if (currentValue === n) {
        let q = delta;
        for (let k = base; ; k += base) {
          const t = k <= bias ? tMin : k >= bias + tMax ? tMax : k - bias;
          if (q < t) {
            break;
          }
          const qMinusT = q - t;
          const baseMinusT = base - t;
          output.push(
            stringFromCharCode(digitToBasic(t + qMinusT % baseMinusT, 0))
          );
          q = floor(qMinusT / baseMinusT);
        }
        output.push(stringFromCharCode(digitToBasic(q, 0)));
        bias = adapt(delta, handledCPCountPlusOne, handledCPCount === basicLength);
        delta = 0;
        ++handledCPCount;
      }
    }
    ++delta;
    ++n;
  }
  return output.join("");
};
const toUnicode = function(input) {
  return mapDomain(input, function(string2) {
    return regexPunycode.test(string2) ? decode(string2.slice(4).toLowerCase()) : string2;
  });
};
const toASCII = function(input) {
  return mapDomain(input, function(string2) {
    return regexNonASCII.test(string2) ? "xn--" + encode(string2) : string2;
  });
};
const punycode = {
  /**
   * A string representing the current Punycode.js version number.
   * @memberOf punycode
   * @type String
   */
  "version": "2.3.1",
  /**
   * An object of methods to convert from JavaScript's internal character
   * representation (UCS-2) to Unicode code points, and back.
   * @see <https://mathiasbynens.be/notes/javascript-encoding>
   * @memberOf punycode
   * @type Object
   */
  "ucs2": {
    "decode": ucs2decode,
    "encode": ucs2encode
  },
  "decode": decode,
  "encode": encode,
  "toASCII": toASCII,
  "toUnicode": toUnicode
};
var utils_exports = /* @__PURE__ */ __exportAll({
  arrayReplaceAt: () => arrayReplaceAt,
  asciiTrim: () => asciiTrim,
  assign: () => assign,
  escapeHtml: () => escapeHtml,
  escapeRE: () => escapeRE,
  fromCodePoint: () => fromCodePoint$1,
  has: () => has,
  isMdAsciiPunct: () => isMdAsciiPunct,
  isPromiseLike: () => isPromiseLike,
  isPunctChar: () => isPunctChar,
  isPunctCharCode: () => isPunctCharCode,
  isSpace: () => isSpace,
  isString: () => isString,
  isValidEntityCode: () => isValidEntityCode,
  isWhiteSpace: () => isWhiteSpace$1,
  lib: () => lib,
  normalizeReference: () => normalizeReference,
  unescapeAll: () => unescapeAll,
  unescapeMd: () => unescapeMd
});
function isString(obj) {
  return typeof obj === "string";
}
const _hasOwnProperty = Object.prototype.hasOwnProperty;
function has(object2, key) {
  return _hasOwnProperty.call(object2, key);
}
function assign(target, ...sources) {
  for (const s of sources) {
    if (!s) continue;
    if (typeof s !== "object") throw new TypeError("source must be object");
    Object.assign(target, s);
  }
  return target;
}
function arrayReplaceAt(src2, pos, newElements) {
  return src2.slice(0, pos).concat(newElements, src2.slice(pos + 1));
}
function isValidEntityCode(c) {
  if (c >= 55296 && c <= 57343) return false;
  if (c >= 64976 && c <= 65007) return false;
  if ((c & 65535) === 65535 || (c & 65535) === 65534) return false;
  if (c >= 0 && c <= 8) return false;
  if (c === 11) return false;
  if (c >= 14 && c <= 31) return false;
  if (c >= 127 && c <= 159) return false;
  if (c > 1114111) return false;
  return true;
}
function fromCodePoint$1(c) {
  if (c > 65535) {
    c -= 65536;
    const surrogate1 = 55296 + (c >> 10);
    const surrogate2 = 56320 + (c & 1023);
    return String.fromCharCode(surrogate1, surrogate2);
  }
  return String.fromCharCode(c);
}
const UNESCAPE_MD_RE = /\\([!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~])/g;
const UNESCAPE_ALL_RE = new RegExp(`${UNESCAPE_MD_RE.source}|${/&([a-z#][a-z0-9]{1,31});/gi.source}`, "gi");
const DIGITAL_ENTITY_TEST_RE = /^#(x[a-f0-9]{1,8}|\d{1,8})$/i;
function replaceEntityPattern(match2, name) {
  if (name.charCodeAt(0) === 35 && DIGITAL_ENTITY_TEST_RE.test(name)) {
    const code$1 = name[1].toLowerCase() === "x" ? Number.parseInt(name.slice(2), 16) : Number.parseInt(name.slice(1), 10);
    if (isValidEntityCode(code$1)) return fromCodePoint$1(code$1);
    return match2;
  }
  const decoded = decodeHTML(match2);
  if (decoded !== match2) return decoded;
  return match2;
}
function unescapeMd(str) {
  if (!str.includes("\\")) return str;
  return str.replace(UNESCAPE_MD_RE, "$1");
}
function unescapeAll(str) {
  if (!str.includes("\\") && !str.includes("&")) return str;
  return str.replace(UNESCAPE_ALL_RE, (match2, escaped, entity$1) => {
    if (escaped) return escaped;
    return replaceEntityPattern(match2, entity$1);
  });
}
const HTML_ESCAPE_TEST_RE = /[&<>"]/;
const HTML_ESCAPE_REPLACE_RE = /[&<>"]/g;
const HTML_REPLACEMENTS = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;"
};
function replaceUnsafeChar(ch) {
  return HTML_REPLACEMENTS[ch];
}
function escapeHtml(str) {
  if (HTML_ESCAPE_TEST_RE.test(str)) return str.replace(HTML_ESCAPE_REPLACE_RE, replaceUnsafeChar);
  return str;
}
const REGEXP_ESCAPE_RE = /[.?*+^$[\]\\(){}|-]/g;
function escapeRE(str) {
  return str.replace(REGEXP_ESCAPE_RE, "\\$&");
}
function isSpace(code$1) {
  switch (code$1) {
    case 9:
    case 32:
      return true;
  }
  return false;
}
function isWhiteSpace$1(code$1) {
  if (code$1 >= 8192 && code$1 <= 8202) return true;
  switch (code$1) {
    case 9:
    case 10:
    case 11:
    case 12:
    case 13:
    case 32:
    case 160:
    case 5760:
    case 8239:
    case 8287:
    case 12288:
      return true;
  }
  return false;
}
function isPunctChar(ch) {
  return P.test(ch) || regex.test(ch);
}
function isPunctCharCode(code$1) {
  return isPunctChar(fromCodePoint$1(code$1));
}
function isMdAsciiPunct(ch) {
  switch (ch) {
    case 33:
    case 34:
    case 35:
    case 36:
    case 37:
    case 38:
    case 39:
    case 40:
    case 41:
    case 42:
    case 43:
    case 44:
    case 45:
    case 46:
    case 47:
    case 58:
    case 59:
    case 60:
    case 61:
    case 62:
    case 63:
    case 64:
    case 91:
    case 92:
    case 93:
    case 94:
    case 95:
    case 96:
    case 123:
    case 124:
    case 125:
    case 126:
      return true;
    default:
      return false;
  }
}
function normalizeReference(str) {
  str = str.trim().replace(/\s+/g, " ");
  if ("ẞ".toLowerCase() === "Ṿ")
    str = str.replace(/ẞ/g, "ß");
  return str.toLowerCase().toUpperCase();
}
function isAsciiTrimmable(c) {
  return c === 32 || c === 9 || c === 10 || c === 13;
}
function asciiTrim(str) {
  let start = 0;
  for (; start < str.length; start++) if (!isAsciiTrimmable(str.charCodeAt(start))) break;
  let end = str.length - 1;
  for (; end >= start; end--) if (!isAsciiTrimmable(str.charCodeAt(end))) break;
  return str.slice(start, end + 1);
}
function isPromiseLike(v) {
  return typeof v?.then === "function";
}
const lib = {
  mdurl,
  ucmicro
};
var Token = class {
  /**
  * Type of the token, e.g. "paragraph_open"
  */
  type;
  /**
  * HTML tag name, e.g. "p"
  */
  tag;
  /**
  * HTML attributes. Format: `[ [ name1, value1 ], [ name2, value2 ] ]`
  */
  attrs = null;
  /**
  * Source map info. Format: `[ line_begin, line_end ]`
  */
  map = null;
  /**
  * Level change (number in {-1, 0, 1} set)
  */
  nesting;
  /**
  * Nesting level, the same as `state.level`
  */
  level = 0;
  /**
  * An array of child nodes (inline and img tokens)
  */
  children = null;
  /**
  * In a case of self-closing tag (code, html, fence, etc.),
  * it has contents of this tag.
  */
  content = "";
  /**
  * '*' or '_' for emphasis, fence string for fence, etc.
  */
  markup = "";
  /**
  * - Info string for "fence" tokens
  * - The value "auto" for autolink "link_open" and "link_close" tokens
  * - The string value of the item marker for ordered-list "list_item_open" tokens
  * - Label string of "reference" tokens
  */
  info = "";
  /**
  * A place for plugins to store an arbitrary data
  */
  meta = null;
  /**
  * True for block-level tokens, false for inline tokens.
  * Used in renderer to calculate line breaks
  */
  block = false;
  /**
  * If it's true, ignore this element when rendering. Used for tight lists
  * to hide paragraphs.
  */
  hidden = false;
  /**
  * Create new token and fill passed properties.
  */
  constructor(type, tag, nesting) {
    this.type = type;
    this.tag = tag;
    this.nesting = nesting;
  }
  /**
  * Search attribute index by name.
  */
  attrIndex(name) {
    if (!this.attrs) return -1;
    const attrs = this.attrs;
    for (let i = 0, len = attrs.length; i < len; i++) if (attrs[i][0] === name) return i;
    return -1;
  }
  /**
  * Add `[ name, value ]` attribute to list. Init attrs if necessary
  */
  attrPush(attrData) {
    if (this.attrs) this.attrs.push(attrData);
    else this.attrs = [attrData];
  }
  /**
  * Set `name` attribute to `value`. Override old value if exists.
  */
  attrSet(name, value) {
    const idx = this.attrIndex(name);
    const attrData = [name, value];
    if (idx < 0) this.attrPush(attrData);
    else this.attrs[idx] = attrData;
  }
  /**
  * Get the value of attribute `name`, or null if it does not exist.
  */
  attrGet(name) {
    const idx = this.attrIndex(name);
    let value = null;
    if (idx >= 0) value = this.attrs[idx][1];
    return value;
  }
  /**
  * Join value to existing attribute via space. Or create new attribute if not
  * exists. Useful to operate with token classes.
  */
  attrJoin(name, value) {
    const idx = this.attrIndex(name);
    if (idx < 0) this.attrPush([name, value]);
    else this.attrs[idx][1] = `${this.attrs[idx][1]} ${value}`;
  }
};
var StateBlock = class {
  src;
  /**
  * link to parser instance
  */
  md;
  env;
  tokens;
  /**
  * line begin offsets for fast jumps
  */
  bMarks = [];
  /**
  * line end offsets for fast jumps
  */
  eMarks = [];
  /**
  * offsets of the first non-space characters (tabs not expanded)
  */
  tShift = [];
  /**
  * indents for each line (tabs expanded)
  */
  sCount = [];
  /**
  * An amount of virtual spaces (tabs expanded) between beginning
  * of each line (bMarks) and real beginning of that line.
  *
  * It exists only as a hack because blockquotes override bMarks
  * losing information in the process.
  *
  * It's used only when expanding tabs, you can think about it as
  * an initial tab length, e.g. bsCount=21 applied to string `\t123`
  * means first tab should be expanded to 4-21%4 === 3 spaces.
  */
  bsCount = [];
  /**
  * required block content indent (for example, if we are
  * inside a list, it would be positioned after list marker)
  */
  blkIndent = 0;
  /**
  * line index in src
  */
  line = 0;
  /**
  * lines count
  */
  lineMax = 0;
  /**
  * loose/tight mode for lists
  */
  tight = false;
  /**
  * indent of the current dd block (-1 if there isn't any)
  */
  ddIndent = -1;
  /**
  * indent of the current list block (-1 if there isn't any)
  */
  listIndent = -1;
  /**
  * used in lists to determine if they interrupt a paragraph
  */
  parentType = "root";
  level = 0;
  /**
  * re-export Token class to use in block rules
  */
  Token = Token;
  constructor(src2, md, env, tokens) {
    this.src = src2;
    this.md = md;
    this.env = env;
    this.tokens = tokens;
    const s = this.src;
    const len = s.length;
    for (let start = 0; start < len; ) {
      const lineEnd = s.indexOf("\n", start);
      const end = lineEnd === -1 ? len : lineEnd;
      let indent = 0;
      let offset = 0;
      let pos = start;
      while (pos < end) {
        const ch = s.charCodeAt(pos);
        if (isSpace(ch)) {
          indent++;
          offset += ch === 9 ? 4 - offset % 4 : 1;
          pos++;
          continue;
        }
        break;
      }
      this.bMarks.push(start);
      this.eMarks.push(end);
      this.tShift.push(indent);
      this.sCount.push(offset);
      this.bsCount.push(0);
      start = end + 1;
    }
    this.bMarks.push(s.length);
    this.eMarks.push(s.length);
    this.tShift.push(0);
    this.sCount.push(0);
    this.bsCount.push(0);
    this.lineMax = this.bMarks.length - 1;
  }
  /**
  * Push new token to "stream".
  */
  push(type, tag, nesting) {
    const token = new Token(type, tag, nesting);
    token.block = true;
    if (nesting < 0) this.level--;
    token.level = this.level;
    if (nesting > 0) this.level++;
    this.tokens.push(token);
    return token;
  }
  isEmpty(line) {
    return this.bMarks[line] + this.tShift[line] >= this.eMarks[line];
  }
  skipEmptyLines(from2) {
    for (let max = this.lineMax; from2 < max; from2++) if (this.bMarks[from2] + this.tShift[from2] < this.eMarks[from2]) break;
    return from2;
  }
  /**
  * Skip spaces from given position.
  */
  skipSpaces(pos) {
    const src2 = this.src;
    for (let max = src2.length; pos < max; pos++) if (!isSpace(src2.charCodeAt(pos))) break;
    return pos;
  }
  /**
  * Skip spaces from given position in reverse.
  */
  skipSpacesBack(pos, min) {
    if (pos <= min) return pos;
    const src2 = this.src;
    while (pos > min) if (!isSpace(src2.charCodeAt(--pos))) return pos + 1;
    return pos;
  }
  /**
  * Skip char codes from given position
  */
  skipChars(pos, code$1) {
    const src2 = this.src;
    for (let max = src2.length; pos < max; pos++) if (src2.charCodeAt(pos) !== code$1) break;
    return pos;
  }
  /**
  * Skip char codes reverse from given position - 1
  */
  skipCharsBack(pos, code$1, min) {
    if (pos <= min) return pos;
    const src2 = this.src;
    while (pos > min) if (code$1 !== src2.charCodeAt(--pos)) return pos + 1;
    return pos;
  }
  /**
  * cut lines range from source.
  */
  getLines(begin, end, indent, keepLastLF) {
    if (begin >= end) return "";
    const queue = new Array(end - begin);
    const src2 = this.src;
    for (let i = 0, line = begin; line < end; line++, i++) {
      let lineIndent = 0;
      const lineStart = this.bMarks[line];
      let first = lineStart;
      let last;
      if (line + 1 < end || keepLastLF) last = this.eMarks[line] + 1;
      else last = this.eMarks[line];
      while (first < last && lineIndent < indent) {
        const ch = src2.charCodeAt(first);
        if (isSpace(ch)) if (ch === 9) lineIndent += 4 - (lineIndent + this.bsCount[line]) % 4;
        else lineIndent++;
        else if (first - lineStart < this.tShift[line]) lineIndent++;
        else break;
        first++;
      }
      if (lineIndent > indent) queue[i] = " ".repeat(lineIndent - indent) + this.src.slice(first, last);
      else queue[i] = this.src.slice(first, last);
    }
    return queue.join("");
  }
};
var StateCore = class {
  src;
  env;
  tokens = [];
  inlineMode = false;
  /**
  * link to parser instance
  */
  md;
  constructor(src2, md, env) {
    this.src = src2;
    this.env = env;
    this.md = md;
  }
  Token = Token;
};
var StateInline = class {
  src;
  env;
  md;
  tokens;
  tokens_meta;
  pos = 0;
  posMax;
  level = 0;
  pending = "";
  pendingLevel = 0;
  /**
  * Stores { start: end } pairs. Useful for backtrack
  * optimization of pairs parse (emphasis, strikes).
  */
  cache = {};
  /**
  * List of emphasis-like delimiters for current tag
  */
  delimiters = [];
  /**
  * Stack of delimiter lists for upper level tags
  */
  _prev_delimiters = [];
  /**
  * backtick length => last seen position
  */
  backticks = {};
  backticksScanned = false;
  /**
  * Counter used to disable inline linkify-it execution
  * inside `<a>` and markdown links
  */
  linkLevel = 0;
  constructor(src2, md, env, outTokens) {
    this.src = src2;
    this.env = env;
    this.md = md;
    this.tokens = outTokens;
    this.tokens_meta = new Array(outTokens.length);
    this.posMax = this.src.length;
  }
  /**
  * Flush pending text
  */
  pushPending() {
    const token = new Token("text", "", 0);
    token.content = this.pending;
    token.level = this.pendingLevel;
    this.tokens.push(token);
    this.pending = "";
    return token;
  }
  /**
  * Push new token to "stream".
  * If pending text exists - flush it as text token
  */
  push(type, tag, nesting) {
    if (this.pending) this.pushPending();
    const token = new Token(type, tag, nesting);
    let token_meta = null;
    if (nesting < 0) {
      this.level--;
      this.delimiters = this._prev_delimiters.pop() ?? [];
    }
    token.level = this.level;
    if (nesting > 0) {
      this.level++;
      this._prev_delimiters.push(this.delimiters);
      this.delimiters = [];
      token_meta = { delimiters: this.delimiters };
    }
    this.pendingLevel = this.level;
    this.tokens.push(token);
    this.tokens_meta.push(token_meta);
    return token;
  }
  /**
  * Scan a sequence of emphasis-like markers, and determine whether
  * it can start an emphasis sequence or end an emphasis sequence.
  *
  *  - start - position to scan from (it should point at a valid marker);
  *  - canSplitWord - determine if these markers can be found inside a word
  */
  scanDelims(start, canSplitWord) {
    const src2 = this.src;
    const max = this.posMax;
    const marker = src2.charCodeAt(start);
    let lastChar;
    if (start === 0) lastChar = 32;
    else if (start === 1) {
      lastChar = this.src.charCodeAt(0);
      if ((lastChar & 63488) === 55296) lastChar = 65533;
    } else {
      lastChar = this.src.charCodeAt(start - 1);
      if ((lastChar & 64512) === 56320) {
        const highSurr = this.src.charCodeAt(start - 2);
        lastChar = (highSurr & 64512) === 55296 ? 65536 + (highSurr - 55296 << 10) + (lastChar - 56320) : 65533;
      } else if ((lastChar & 64512) === 55296) lastChar = 65533;
    }
    let pos = start;
    while (pos < max && src2.charCodeAt(pos) === marker) pos++;
    const count = pos - start;
    let nextChar = pos < max ? this.src.charCodeAt(pos) : 32;
    if ((nextChar & 64512) === 55296) {
      const lowSurr = this.src.charCodeAt(pos + 1);
      nextChar = (lowSurr & 64512) === 56320 ? 65536 + (nextChar - 55296 << 10) + (lowSurr - 56320) : 65533;
    } else if ((nextChar & 64512) === 56320) nextChar = 65533;
    const isLastPunctChar = isMdAsciiPunct(lastChar) || isPunctCharCode(lastChar);
    const isNextPunctChar = isMdAsciiPunct(nextChar) || isPunctCharCode(nextChar);
    const isLastWhiteSpace = isWhiteSpace$1(lastChar);
    const isNextWhiteSpace = isWhiteSpace$1(nextChar);
    const left_flanking = !isNextWhiteSpace && (!isNextPunctChar || isLastWhiteSpace || isLastPunctChar);
    const right_flanking = !isLastWhiteSpace && (!isLastPunctChar || isNextWhiteSpace || isNextPunctChar);
    return {
      can_open: left_flanking && (canSplitWord || !right_flanking || isLastPunctChar),
      can_close: right_flanking && (canSplitWord || !left_flanking || isNextPunctChar),
      length: count
    };
  }
  Token = Token;
};
var Ruler = class {
  /**
  * List of added rules. Each element is:
  *
  * ```js
  * {
  *   name: XXX,
  *   enabled: Boolean,
  *   fn: Function(),
  *   alt: [ name2, name3 ]
  * }
  * ```
  */
  __rules__ = [];
  /**
  * Cached rule chains.
  *
  * First level - chain name, '' for default.
  * Second level - diginal anchor for fast filtering by charcodes.
  */
  __cache__ = null;
  /**
  * Helper methods, should not be used directly
  * Find rule index by name
  */
  __find__(name) {
    for (let i = 0; i < this.__rules__.length; i++) if (this.__rules__[i].name === name) return i;
    return -1;
  }
  /**
  * Build rules lookup cache
  */
  __compile__() {
    const chains = /* @__PURE__ */ new Set([""]);
    for (const rule of this.__rules__) {
      if (!rule.enabled) continue;
      for (const altName of rule.alt) chains.add(altName);
    }
    this.__cache__ = {};
    for (const chain of chains) {
      const fns = [];
      for (const rule of this.__rules__) {
        if (!rule.enabled) continue;
        if (chain && !rule.alt.includes(chain)) continue;
        fns.push(rule.fn);
      }
      this.__cache__[chain] = fns;
    }
  }
  /**
  * Ruler.at(name, fn [, options])
  * - name (String): rule name to replace.
  * - fn (Function): new rule function.
  * - options (Object): new rule options (not mandatory).
  *
  * Replace rule by name with new function & options. Throws error if name not
  * found.
  *
  * ##### Options:
  *
  * - __alt__ - array with names of "alternate" chains.
  *
  * ##### Example
  *
  * Replace existing typographer replacement rule with new one:
  *
  * ```javascript
  * md.core.ruler.at('replacements', function replace(state) {
  *   //...
  * });
  * ```
  */
  at(name, fn, options = {}) {
    const index2 = this.__find__(name);
    const opt = options || {};
    if (index2 === -1) throw new Error(`Parser rule not found: ${name}`);
    this.__rules__[index2].fn = fn;
    this.__rules__[index2].alt = opt.alt || [];
    this.__cache__ = null;
  }
  /**
  * Ruler.before(beforeName, ruleName, fn [, options])
  * - beforeName (String): new rule will be added before this one.
  * - ruleName (String): name of added rule.
  * - fn (Function): rule function.
  * - options (Object): rule options (not mandatory).
  *
  * Add new rule to chain before one with given name. See also
  * [[Ruler.after]], [[Ruler.push]].
  *
  * ##### Options:
  *
  * - __alt__ - array with names of "alternate" chains.
  *
  * ##### Example
  *
  * ```javascript
  * md.block.ruler.before('paragraph', 'my_rule', function replace(state) {
  *   //...
  * });
  * ```
  */
  before(beforeName, ruleName, fn, options) {
    const index2 = this.__find__(beforeName);
    const opt = options || {};
    if (index2 === -1) throw new Error(`Parser rule not found: ${beforeName}`);
    this.__rules__.splice(index2, 0, {
      name: ruleName,
      enabled: true,
      fn,
      alt: opt.alt || []
    });
    this.__cache__ = null;
  }
  /**
  * Ruler.after(afterName, ruleName, fn [, options])
  * - afterName (String): new rule will be added after this one.
  * - ruleName (String): name of added rule.
  * - fn (Function): rule function.
  * - options (Object): rule options (not mandatory).
  *
  * Add new rule to chain after one with given name. See also
  * [[Ruler.before]], [[Ruler.push]].
  *
  * ##### Options:
  *
  * - __alt__ - array with names of "alternate" chains.
  *
  * ##### Example
  *
  * ```javascript
  * md.inline.ruler.after('text', 'my_rule', function replace(state) {
  *   //...
  * });
  * ```
  */
  after(afterName, ruleName, fn, options) {
    const index2 = this.__find__(afterName);
    const opt = options || {};
    if (index2 === -1) throw new Error(`Parser rule not found: ${afterName}`);
    this.__rules__.splice(index2 + 1, 0, {
      name: ruleName,
      enabled: true,
      fn,
      alt: opt.alt || []
    });
    this.__cache__ = null;
  }
  /**
  * Ruler.push(ruleName, fn [, options])
  * - ruleName (String): name of added rule.
  * - fn (Function): rule function.
  * - options (Object): rule options (not mandatory).
  *
  * Push new rule to the end of chain. See also
  * [[Ruler.before]], [[Ruler.after]].
  *
  * ##### Options:
  *
  * - __alt__ - array with names of "alternate" chains.
  *
  * ##### Example
  *
  * ```javascript
  * md.core.ruler.push('my_rule', function replace(state) {
  *   //...
  * });
  * ```
  */
  push(ruleName, fn, options) {
    const opt = options || {};
    this.__rules__.push({
      name: ruleName,
      enabled: true,
      fn,
      alt: opt.alt || []
    });
    this.__cache__ = null;
  }
  /**
  * Ruler.enable(list [, ignoreInvalid]) -> Array
  * - list (String|Array): list of rule names to enable.
  * - ignoreInvalid (Boolean): set `true` to ignore errors when rule not found.
  *
  * Enable rules with given names. If any rule name not found - throw Error.
  * Errors can be disabled by second param.
  *
  * Returns list of found rule names (if no exception happened).
  *
  * See also [[Ruler.disable]], [[Ruler.enableOnly]].
  */
  enable(list$1, ignoreInvalid) {
    if (!Array.isArray(list$1)) list$1 = [list$1];
    const result = [];
    for (const name of list$1) {
      const idx = this.__find__(name);
      if (idx < 0) {
        if (ignoreInvalid) continue;
        throw new Error(`Rules manager: invalid rule name ${name}`);
      }
      this.__rules__[idx].enabled = true;
      result.push(name);
    }
    this.__cache__ = null;
    return result;
  }
  /**
  * Ruler.enableOnly(list [, ignoreInvalid])
  * - list (String|Array): list of rule names to enable (whitelist).
  * - ignoreInvalid (Boolean): set `true` to ignore errors when rule not found.
  *
  * Enable rules with given names, and disable everything else. If any rule name
  * not found - throw Error. Errors can be disabled by second param.
  *
  * See also [[Ruler.disable]], [[Ruler.enable]].
  */
  enableOnly(list$1, ignoreInvalid) {
    if (!Array.isArray(list$1)) list$1 = [list$1];
    for (const rule of this.__rules__) rule.enabled = false;
    this.enable(list$1, ignoreInvalid);
  }
  /**
  * Ruler.disable(list [, ignoreInvalid]) -> Array
  * - list (String|Array): list of rule names to disable.
  * - ignoreInvalid (Boolean): set `true` to ignore errors when rule not found.
  *
  * Disable rules with given names. If any rule name not found - throw Error.
  * Errors can be disabled by second param.
  *
  * Returns list of found rule names (if no exception happened).
  *
  * See also [[Ruler.enable]], [[Ruler.enableOnly]].
  */
  disable(list$1, ignoreInvalid) {
    if (!Array.isArray(list$1)) list$1 = [list$1];
    const result = [];
    for (const name of list$1) {
      const idx = this.__find__(name);
      if (idx < 0) {
        if (ignoreInvalid) continue;
        throw new Error(`Rules manager: invalid rule name ${name}`);
      }
      this.__rules__[idx].enabled = false;
      result.push(name);
    }
    this.__cache__ = null;
    return result;
  }
  /**
  * Ruler.getRules(chainName) -> Array
  *
  * Return array of active functions (rules) for given chain name. It analyzes
  * rules configuration, compiles caches if not exists and returns result.
  *
  * Default chain name is `''` (empty string). It can't be skipped. That's
  * done intentionally, to keep signature monomorphic for high speed.
  */
  getRules(chainName) {
    if (this.__cache__ === null) this.__compile__();
    return this.__cache__[chainName] || [];
  }
};
function blockquote(state, startLine, endLine, silent) {
  let pos = state.bMarks[startLine] + state.tShift[startLine];
  let max = state.eMarks[startLine];
  const oldLineMax = state.lineMax;
  if (state.sCount[startLine] - state.blkIndent >= 4) return false;
  if (state.src.charCodeAt(pos) !== 62) return false;
  if (silent) return true;
  const oldBMarks = [];
  const oldBSCount = [];
  const oldSCount = [];
  const oldTShift = [];
  const terminatorRules = state.md.block.ruler.getRules("blockquote");
  const oldParentType = state.parentType;
  state.parentType = "blockquote";
  let lastLineEmpty = false;
  let nextLine;
  for (nextLine = startLine; nextLine < endLine; nextLine++) {
    const isOutdented = state.sCount[nextLine] < state.blkIndent;
    pos = state.bMarks[nextLine] + state.tShift[nextLine];
    max = state.eMarks[nextLine];
    if (pos >= max) break;
    if (state.src.charCodeAt(pos++) === 62 && !isOutdented) {
      let initial = state.sCount[nextLine] + 1;
      let spaceAfterMarker;
      let adjustTab;
      if (state.src.charCodeAt(pos) === 32) {
        pos++;
        initial++;
        adjustTab = false;
        spaceAfterMarker = true;
      } else if (state.src.charCodeAt(pos) === 9) {
        spaceAfterMarker = true;
        if ((state.bsCount[nextLine] + initial) % 4 === 3) {
          pos++;
          initial++;
          adjustTab = false;
        } else adjustTab = true;
      } else spaceAfterMarker = false;
      let offset = initial;
      oldBMarks.push(state.bMarks[nextLine]);
      state.bMarks[nextLine] = pos;
      while (pos < max) {
        const ch = state.src.charCodeAt(pos);
        if (isSpace(ch)) if (ch === 9) offset += 4 - (offset + state.bsCount[nextLine] + (adjustTab ? 1 : 0)) % 4;
        else offset++;
        else break;
        pos++;
      }
      lastLineEmpty = pos >= max;
      oldBSCount.push(state.bsCount[nextLine]);
      state.bsCount[nextLine] = state.sCount[nextLine] + 1 + (spaceAfterMarker ? 1 : 0);
      oldSCount.push(state.sCount[nextLine]);
      state.sCount[nextLine] = offset - initial;
      oldTShift.push(state.tShift[nextLine]);
      state.tShift[nextLine] = pos - state.bMarks[nextLine];
      continue;
    }
    if (lastLineEmpty) break;
    let terminate = false;
    for (let i = 0, l = terminatorRules.length; i < l; i++) if (terminatorRules[i](state, nextLine, endLine, true)) {
      terminate = true;
      break;
    }
    if (terminate) {
      state.lineMax = nextLine;
      if (state.blkIndent !== 0) {
        oldBMarks.push(state.bMarks[nextLine]);
        oldBSCount.push(state.bsCount[nextLine]);
        oldTShift.push(state.tShift[nextLine]);
        oldSCount.push(state.sCount[nextLine]);
        state.sCount[nextLine] -= state.blkIndent;
      }
      break;
    }
    oldBMarks.push(state.bMarks[nextLine]);
    oldBSCount.push(state.bsCount[nextLine]);
    oldTShift.push(state.tShift[nextLine]);
    oldSCount.push(state.sCount[nextLine]);
    state.sCount[nextLine] = -1;
  }
  const oldIndent = state.blkIndent;
  state.blkIndent = 0;
  const token_o = state.push("blockquote_open", "blockquote", 1);
  token_o.markup = ">";
  const lines = [startLine, 0];
  token_o.map = lines;
  state.md.block.tokenize(state, startLine, nextLine);
  const token_c = state.push("blockquote_close", "blockquote", -1);
  token_c.markup = ">";
  state.lineMax = oldLineMax;
  state.parentType = oldParentType;
  lines[1] = state.line;
  for (let i = 0; i < oldTShift.length; i++) {
    state.bMarks[i + startLine] = oldBMarks[i];
    state.tShift[i + startLine] = oldTShift[i];
    state.sCount[i + startLine] = oldSCount[i];
    state.bsCount[i + startLine] = oldBSCount[i];
  }
  state.blkIndent = oldIndent;
  return true;
}
function code(state, startLine, endLine) {
  if (state.sCount[startLine] - state.blkIndent < 4) return false;
  let nextLine = startLine + 1;
  let last = nextLine;
  while (nextLine < endLine) {
    if (state.isEmpty(nextLine)) {
      nextLine++;
      continue;
    }
    if (state.sCount[nextLine] - state.blkIndent >= 4) {
      nextLine++;
      last = nextLine;
      continue;
    }
    break;
  }
  state.line = last;
  const token = state.push("code_block", "code", 0);
  token.content = `${state.getLines(startLine, last, 4 + state.blkIndent, false)}
`;
  token.map = [startLine, state.line];
  return true;
}
function fence(state, startLine, endLine, silent) {
  let pos = state.bMarks[startLine] + state.tShift[startLine];
  let max = state.eMarks[startLine];
  if (state.sCount[startLine] - state.blkIndent >= 4) return false;
  if (pos + 3 > max) return false;
  const marker = state.src.charCodeAt(pos);
  if (marker !== 126 && marker !== 96) return false;
  let mem = pos;
  pos = state.skipChars(pos, marker);
  let len = pos - mem;
  if (len < 3) return false;
  const markup = state.src.slice(mem, pos);
  const params2 = state.src.slice(pos, max);
  if (marker === 96) {
    if (params2.includes(String.fromCharCode(marker))) return false;
  }
  if (silent) return true;
  let nextLine = startLine;
  let haveEndMarker = false;
  for (; ; ) {
    nextLine++;
    if (nextLine >= endLine) break;
    pos = mem = state.bMarks[nextLine] + state.tShift[nextLine];
    max = state.eMarks[nextLine];
    if (pos < max && state.sCount[nextLine] < state.blkIndent) break;
    if (state.src.charCodeAt(pos) !== marker) continue;
    if (state.sCount[nextLine] - state.blkIndent >= 4) continue;
    pos = state.skipChars(pos, marker);
    if (pos - mem < len) continue;
    pos = state.skipSpaces(pos);
    if (pos < max) continue;
    haveEndMarker = true;
    break;
  }
  len = state.sCount[startLine];
  state.line = nextLine + (haveEndMarker ? 1 : 0);
  const token = state.push("fence", "code", 0);
  token.info = params2;
  token.content = state.getLines(startLine + 1, nextLine, len, true);
  token.markup = markup;
  token.map = [startLine, state.line];
  return true;
}
function heading(state, startLine, endLine, silent) {
  let pos = state.bMarks[startLine] + state.tShift[startLine];
  let max = state.eMarks[startLine];
  if (state.sCount[startLine] - state.blkIndent >= 4) return false;
  let ch = state.src.charCodeAt(pos);
  if (ch !== 35 || pos >= max) return false;
  let level = 1;
  ch = state.src.charCodeAt(++pos);
  while (ch === 35 && pos < max && level <= 6) {
    level++;
    ch = state.src.charCodeAt(++pos);
  }
  if (level > 6 || pos < max && !isSpace(ch)) return false;
  if (silent) return true;
  max = state.skipSpacesBack(max, pos);
  const tmp = state.skipCharsBack(max, 35, pos);
  if (tmp > pos && isSpace(state.src.charCodeAt(tmp - 1))) max = tmp;
  state.line = startLine + 1;
  const token_o = state.push("heading_open", `h${String(level)}`, 1);
  token_o.markup = "########".slice(0, level);
  token_o.map = [startLine, state.line];
  const token_i = state.push("inline", "", 0);
  token_i.content = asciiTrim(state.src.slice(pos, max));
  token_i.map = [startLine, state.line];
  token_i.children = [];
  const token_c = state.push("heading_close", `h${String(level)}`, -1);
  token_c.markup = "########".slice(0, level);
  return true;
}
function hr(state, startLine, endLine, silent) {
  const max = state.eMarks[startLine];
  if (state.sCount[startLine] - state.blkIndent >= 4) return false;
  let pos = state.bMarks[startLine] + state.tShift[startLine];
  const marker = state.src.charCodeAt(pos++);
  if (marker !== 42 && marker !== 45 && marker !== 95) return false;
  let cnt = 1;
  while (pos < max) {
    const ch = state.src.charCodeAt(pos++);
    if (ch !== marker && !isSpace(ch)) return false;
    if (ch === marker) cnt++;
  }
  if (cnt < 3) return false;
  if (silent) return true;
  state.line = startLine + 1;
  const token = state.push("hr", "hr", 0);
  token.map = [startLine, state.line];
  token.markup = String.fromCharCode(marker).repeat(cnt);
  return true;
}
var html_blocks_default = [
  "address",
  "article",
  "aside",
  "base",
  "basefont",
  "blockquote",
  "body",
  "caption",
  "center",
  "col",
  "colgroup",
  "dd",
  "details",
  "dialog",
  "dir",
  "div",
  "dl",
  "dt",
  "fieldset",
  "figcaption",
  "figure",
  "footer",
  "form",
  "frame",
  "frameset",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "head",
  "header",
  "hr",
  "html",
  "iframe",
  "legend",
  "li",
  "link",
  "main",
  "menu",
  "menuitem",
  "nav",
  "noframes",
  "ol",
  "optgroup",
  "option",
  "p",
  "param",
  "search",
  "section",
  "summary",
  "table",
  "tbody",
  "td",
  "tfoot",
  "th",
  "thead",
  "title",
  "tr",
  "track",
  "ul"
];
const open_tag$1 = `<[A-Za-z][A-Za-z0-9\\-]*(?:\\s+[a-zA-Z_:][a-zA-Z0-9:._-]*(?:\\s*=\\s*(?:[^"'=<>\`\\x00-\\x20]+|'[^']*'|"[^"]*"))?)*\\s*\\/?>`;
const close_tag$1 = "<\\/[A-Za-z][A-Za-z0-9\\-]*\\s*>";
const HTML_TAG_RE$1 = /* @__PURE__ */ new RegExp(`^(?:${open_tag$1}|${close_tag$1}|<!---?>|<!--(?:[^-]|-[^-]|--[^>])*-->|<\\?[\\s\\S]*?\\?>|<![A-Za-z][^>]*>|<!\\[CDATA\\[[\\s\\S]*?\\]\\]>)`);
const HTML_OPEN_CLOSE_TAG_RE$1 = /* @__PURE__ */ new RegExp(`^(?:${open_tag$1}|${close_tag$1})`);
const HTML_SEQUENCES$1 = [
  [
    /^<(script|pre|style|textarea)(?=(\s|>|$))/i,
    /<\/(script|pre|style|textarea)>/i,
    true
  ],
  [
    /^<!--/,
    /-->/,
    true
  ],
  [
    /^<\?/,
    /\?>/,
    true
  ],
  [
    /^<![A-Z]/,
    />/,
    true
  ],
  [
    /^<!\[CDATA\[/,
    /\]\]>/,
    true
  ],
  [
    new RegExp(`^</?(${html_blocks_default.join("|")})(?=(\\s|/?>|$))`, "i"),
    /^$/,
    true
  ],
  [
    /* @__PURE__ */ new RegExp(`${HTML_OPEN_CLOSE_TAG_RE$1.source}\\s*$`),
    /^$/,
    false
  ]
];
function html_block$1(state, startLine, endLine, silent) {
  let pos = state.bMarks[startLine] + state.tShift[startLine];
  let max = state.eMarks[startLine];
  if (state.sCount[startLine] - state.blkIndent >= 4) return false;
  if (!state.md.options.html) return false;
  if (state.src.charCodeAt(pos) !== 60) return false;
  let lineText = state.src.slice(pos, max);
  let i = 0;
  for (; i < HTML_SEQUENCES$1.length; i++) if (HTML_SEQUENCES$1[i][0].test(lineText)) break;
  if (i === HTML_SEQUENCES$1.length) return false;
  if (silent) return HTML_SEQUENCES$1[i][2];
  let nextLine = startLine + 1;
  const endsOnBlankLine = HTML_SEQUENCES$1[i][1].test("");
  if (!HTML_SEQUENCES$1[i][1].test(lineText)) for (; nextLine < endLine; nextLine++) {
    if (state.sCount[nextLine] < state.blkIndent) {
      if (endsOnBlankLine || !state.isEmpty(nextLine)) break;
    }
    pos = state.bMarks[nextLine] + state.tShift[nextLine];
    max = state.eMarks[nextLine];
    lineText = state.src.slice(pos, max);
    if (HTML_SEQUENCES$1[i][1].test(lineText)) {
      if (lineText.length !== 0) nextLine++;
      break;
    }
  }
  state.line = nextLine;
  const token = state.push("html_block", "", 0);
  token.map = [startLine, nextLine];
  token.content = state.getLines(startLine, nextLine, state.blkIndent, true);
  return true;
}
function lheading(state, startLine, endLine) {
  const terminatorRules = state.md.block.ruler.getRules("paragraph");
  if (state.sCount[startLine] - state.blkIndent >= 4) return false;
  const oldParentType = state.parentType;
  state.parentType = "paragraph";
  let level = 0;
  let marker;
  let nextLine = startLine + 1;
  for (; nextLine < endLine && !state.isEmpty(nextLine); nextLine++) {
    if (state.sCount[nextLine] - state.blkIndent > 3) continue;
    if (state.sCount[nextLine] >= state.blkIndent) {
      let pos = state.bMarks[nextLine] + state.tShift[nextLine];
      const max = state.eMarks[nextLine];
      if (pos < max) {
        marker = state.src.charCodeAt(pos);
        if (marker === 45 || marker === 61) {
          pos = state.skipChars(pos, marker);
          pos = state.skipSpaces(pos);
          if (pos >= max) {
            level = marker === 61 ? 1 : 2;
            break;
          }
        }
      }
    }
    if (state.sCount[nextLine] < 0) continue;
    let terminate = false;
    for (let i = 0, l = terminatorRules.length; i < l; i++) if (terminatorRules[i](state, nextLine, endLine, true)) {
      terminate = true;
      break;
    }
    if (terminate) break;
  }
  if (!level || marker === void 0) {
    state.parentType = oldParentType;
    return false;
  }
  const content = asciiTrim(state.getLines(startLine, nextLine, state.blkIndent, false));
  state.line = nextLine + 1;
  const token_o = state.push("heading_open", `h${String(level)}`, 1);
  token_o.markup = String.fromCharCode(marker);
  token_o.map = [startLine, state.line];
  const token_i = state.push("inline", "", 0);
  token_i.content = content;
  token_i.map = [startLine, state.line - 1];
  token_i.children = [];
  const token_c = state.push("heading_close", `h${String(level)}`, -1);
  token_c.markup = String.fromCharCode(marker);
  state.parentType = oldParentType;
  return true;
}
function skipBulletListMarker(state, startLine) {
  const max = state.eMarks[startLine];
  let pos = state.bMarks[startLine] + state.tShift[startLine];
  const marker = state.src.charCodeAt(pos++);
  if (marker !== 42 && marker !== 45 && marker !== 43) return -1;
  if (pos < max) {
    if (!isSpace(state.src.charCodeAt(pos))) return -1;
  }
  return pos;
}
function skipOrderedListMarker(state, startLine) {
  const start = state.bMarks[startLine] + state.tShift[startLine];
  const max = state.eMarks[startLine];
  let pos = start;
  if (pos + 1 >= max) return -1;
  let ch = state.src.charCodeAt(pos++);
  if (ch < 48 || ch > 57) return -1;
  for (; ; ) {
    if (pos >= max) return -1;
    ch = state.src.charCodeAt(pos++);
    if (ch >= 48 && ch <= 57) {
      if (pos - start >= 10) return -1;
      continue;
    }
    if (ch === 41 || ch === 46) break;
    return -1;
  }
  if (pos < max) {
    ch = state.src.charCodeAt(pos);
    if (!isSpace(ch)) return -1;
  }
  return pos;
}
function markTightParagraphs(state, idx) {
  const level = state.level + 2;
  for (let i = idx + 2, l = state.tokens.length - 2; i < l; i++) if (state.tokens[i].level === level && state.tokens[i].type === "paragraph_open") {
    state.tokens[i + 2].hidden = true;
    state.tokens[i].hidden = true;
    i += 2;
  }
}
function list(state, startLine, endLine, silent) {
  let max, pos, start, token;
  let nextLine = startLine;
  let tight = true;
  if (state.sCount[nextLine] - state.blkIndent >= 4) return false;
  if (state.listIndent >= 0 && state.sCount[nextLine] - state.listIndent >= 4 && state.sCount[nextLine] < state.blkIndent) return false;
  let isTerminatingParagraph = false;
  if (silent && state.parentType === "paragraph") {
    if (state.sCount[nextLine] >= state.blkIndent) isTerminatingParagraph = true;
  }
  let isOrdered;
  let markerValue;
  let posAfterMarker = skipOrderedListMarker(state, nextLine);
  if (posAfterMarker >= 0) {
    isOrdered = true;
    start = state.bMarks[nextLine] + state.tShift[nextLine];
    markerValue = Number(state.src.slice(start, posAfterMarker - 1));
    if (isTerminatingParagraph && markerValue !== 1) return false;
  } else {
    posAfterMarker = skipBulletListMarker(state, nextLine);
    if (posAfterMarker >= 0) isOrdered = false;
    else return false;
  }
  if (isTerminatingParagraph) {
    if (state.skipSpaces(posAfterMarker) >= state.eMarks[nextLine]) return false;
  }
  if (silent) return true;
  const markerCharCode = state.src.charCodeAt(posAfterMarker - 1);
  const listTokIdx = state.tokens.length;
  if (isOrdered) {
    token = state.push("ordered_list_open", "ol", 1);
    if (markerValue !== 1) token.attrs = [["start", markerValue.toString()]];
  } else token = state.push("bullet_list_open", "ul", 1);
  const listLines = [nextLine, 0];
  token.map = listLines;
  token.markup = String.fromCharCode(markerCharCode);
  let prevEmptyEnd = false;
  const terminatorRules = state.md.block.ruler.getRules("list");
  const oldParentType = state.parentType;
  state.parentType = "list";
  while (nextLine < endLine) {
    pos = posAfterMarker;
    max = state.eMarks[nextLine];
    const initial = state.sCount[nextLine] + posAfterMarker - (state.bMarks[nextLine] + state.tShift[nextLine]);
    let offset = initial;
    while (pos < max) {
      const ch = state.src.charCodeAt(pos);
      if (ch === 9) offset += 4 - (offset + state.bsCount[nextLine]) % 4;
      else if (ch === 32) offset++;
      else break;
      pos++;
    }
    const contentStart = pos;
    let indentAfterMarker;
    if (contentStart >= max) indentAfterMarker = 1;
    else indentAfterMarker = offset - initial;
    if (indentAfterMarker > 4) indentAfterMarker = 1;
    const indent = initial + indentAfterMarker;
    token = state.push("list_item_open", "li", 1);
    token.markup = String.fromCharCode(markerCharCode);
    const itemLines = [nextLine, 0];
    token.map = itemLines;
    if (isOrdered) token.info = state.src.slice(start, posAfterMarker - 1);
    const oldTight = state.tight;
    const oldTShift = state.tShift[nextLine];
    const oldSCount = state.sCount[nextLine];
    const oldListIndent = state.listIndent;
    state.listIndent = state.blkIndent;
    state.blkIndent = indent;
    state.tight = true;
    state.tShift[nextLine] = contentStart - state.bMarks[nextLine];
    state.sCount[nextLine] = offset;
    if (contentStart >= max && state.isEmpty(nextLine + 1)) state.line = Math.min(state.line + 2, endLine);
    else state.md.block.tokenize(state, nextLine, endLine, true);
    if (!state.tight || prevEmptyEnd) tight = false;
    prevEmptyEnd = state.line - nextLine > 1 && state.isEmpty(state.line - 1);
    state.blkIndent = state.listIndent;
    state.listIndent = oldListIndent;
    state.tShift[nextLine] = oldTShift;
    state.sCount[nextLine] = oldSCount;
    state.tight = oldTight;
    token = state.push("list_item_close", "li", -1);
    token.markup = String.fromCharCode(markerCharCode);
    nextLine = state.line;
    itemLines[1] = nextLine;
    if (nextLine >= endLine) break;
    if (state.sCount[nextLine] < state.blkIndent) break;
    if (state.sCount[nextLine] - state.blkIndent >= 4) break;
    let terminate = false;
    for (let i = 0, l = terminatorRules.length; i < l; i++) if (terminatorRules[i](state, nextLine, endLine, true)) {
      terminate = true;
      break;
    }
    if (terminate) break;
    if (isOrdered) {
      posAfterMarker = skipOrderedListMarker(state, nextLine);
      if (posAfterMarker < 0) break;
      start = state.bMarks[nextLine] + state.tShift[nextLine];
    } else {
      posAfterMarker = skipBulletListMarker(state, nextLine);
      if (posAfterMarker < 0) break;
    }
    if (markerCharCode !== state.src.charCodeAt(posAfterMarker - 1)) break;
  }
  if (isOrdered) token = state.push("ordered_list_close", "ol", -1);
  else token = state.push("bullet_list_close", "ul", -1);
  token.markup = String.fromCharCode(markerCharCode);
  listLines[1] = nextLine;
  state.line = nextLine;
  state.parentType = oldParentType;
  if (tight) markTightParagraphs(state, listTokIdx);
  return true;
}
function paragraph(state, startLine, endLine) {
  const terminatorRules = state.md.block.ruler.getRules("paragraph");
  const oldParentType = state.parentType;
  let nextLine = startLine + 1;
  state.parentType = "paragraph";
  for (; nextLine < endLine && !state.isEmpty(nextLine); nextLine++) {
    if (state.sCount[nextLine] - state.blkIndent > 3) continue;
    if (state.sCount[nextLine] < 0) continue;
    let terminate = false;
    for (let i = 0, l = terminatorRules.length; i < l; i++) if (terminatorRules[i](state, nextLine, endLine, true)) {
      terminate = true;
      break;
    }
    if (terminate) break;
  }
  const content = asciiTrim(state.getLines(startLine, nextLine, state.blkIndent, false));
  state.line = nextLine;
  const token_o = state.push("paragraph_open", "p", 1);
  token_o.map = [startLine, state.line];
  const token_i = state.push("inline", "", 0);
  token_i.content = content;
  token_i.map = [startLine, state.line];
  token_i.children = [];
  state.push("paragraph_close", "p", -1);
  state.parentType = oldParentType;
  return true;
}
function reference(state, startLine, endLine, silent) {
  let pos = state.bMarks[startLine] + state.tShift[startLine];
  let max = state.eMarks[startLine];
  let nextLine = startLine + 1;
  if (state.sCount[startLine] - state.blkIndent >= 4) return false;
  if (state.src.charCodeAt(pos) !== 91) return false;
  function getNextLine(nextLine$1) {
    const endLine$1 = state.lineMax;
    if (nextLine$1 >= endLine$1 || state.isEmpty(nextLine$1)) return null;
    let isContinuation = false;
    if (state.sCount[nextLine$1] - state.blkIndent > 3) isContinuation = true;
    if (state.sCount[nextLine$1] < 0) isContinuation = true;
    if (!isContinuation) {
      const terminatorRules = state.md.block.ruler.getRules("reference");
      const oldParentType = state.parentType;
      state.parentType = "reference";
      let terminate = false;
      for (let i = 0, l = terminatorRules.length; i < l; i++) if (terminatorRules[i](state, nextLine$1, endLine$1, true)) {
        terminate = true;
        break;
      }
      state.parentType = oldParentType;
      if (terminate) return null;
    }
    const pos$1 = state.bMarks[nextLine$1] + state.tShift[nextLine$1];
    const max$1 = state.eMarks[nextLine$1];
    return state.src.slice(pos$1, max$1 + 1);
  }
  let str = state.src.slice(pos, max + 1);
  max = str.length;
  let labelEnd = -1;
  for (pos = 1; pos < max; pos++) {
    const ch = str.charCodeAt(pos);
    if (ch === 91) return false;
    else if (ch === 93) {
      labelEnd = pos;
      break;
    } else if (ch === 10) {
      const lineContent = getNextLine(nextLine);
      if (lineContent !== null) {
        str += lineContent;
        max = str.length;
        nextLine++;
      }
    } else if (ch === 92) {
      pos++;
      if (pos < max && str.charCodeAt(pos) === 10) {
        const lineContent = getNextLine(nextLine);
        if (lineContent !== null) {
          str += lineContent;
          max = str.length;
          nextLine++;
        }
      }
    }
  }
  if (labelEnd < 0 || str.charCodeAt(labelEnd + 1) !== 58) return false;
  for (pos = labelEnd + 2; pos < max; pos++) {
    const ch = str.charCodeAt(pos);
    if (ch === 10) {
      const lineContent = getNextLine(nextLine);
      if (lineContent !== null) {
        str += lineContent;
        max = str.length;
        nextLine++;
      }
    } else if (isSpace(ch)) ;
    else break;
  }
  const destRes = state.md.helpers.parseLinkDestination(str, pos, max);
  if (!destRes.ok) return false;
  const href = state.md.normalizeLink(destRes.str);
  if (!state.md.validateLink(href)) return false;
  pos = destRes.pos;
  const destEndPos = pos;
  const destEndLineNo = nextLine;
  const start = pos;
  for (; pos < max; pos++) {
    const ch = str.charCodeAt(pos);
    if (ch === 10) {
      const lineContent = getNextLine(nextLine);
      if (lineContent !== null) {
        str += lineContent;
        max = str.length;
        nextLine++;
      }
    } else if (isSpace(ch)) ;
    else break;
  }
  let titleRes = state.md.helpers.parseLinkTitle(str, pos, max);
  while (titleRes.can_continue) {
    const lineContent = getNextLine(nextLine);
    if (lineContent === null) break;
    str += lineContent;
    pos = max;
    max = str.length;
    nextLine++;
    titleRes = state.md.helpers.parseLinkTitle(str, pos, max, titleRes);
  }
  let title;
  if (pos < max && start !== pos && titleRes.ok) {
    title = titleRes.str;
    pos = titleRes.pos;
  } else {
    title = "";
    pos = destEndPos;
    nextLine = destEndLineNo;
  }
  while (pos < max) {
    if (!isSpace(str.charCodeAt(pos))) break;
    pos++;
  }
  if (pos < max && str.charCodeAt(pos) !== 10) {
    if (title) {
      title = "";
      pos = destEndPos;
      nextLine = destEndLineNo;
      while (pos < max) {
        if (!isSpace(str.charCodeAt(pos))) break;
        pos++;
      }
    }
  }
  if (pos < max && str.charCodeAt(pos) !== 10) return false;
  const label = normalizeReference(str.slice(1, labelEnd));
  if (!label) return false;
  if (silent) return true;
  if (typeof state.env.references === "undefined") state.env.references = {};
  if (typeof state.env.references[label] === "undefined") state.env.references[label] = {
    title,
    href
  };
  state.line = nextLine;
  const token = state.push("reference", "", 0);
  token.map = [startLine, state.line];
  token.info = label;
  token.meta = {
    title,
    href
  };
  return true;
}
const MAX_AUTOCOMPLETED_CELLS = 65536;
function getLine$1(state, line) {
  const pos = state.bMarks[line] + state.tShift[line];
  const max = state.eMarks[line];
  return state.src.slice(pos, max);
}
function escapedSplit(str) {
  const result = [];
  const max = str.length;
  let pos = 0;
  let ch = str.charCodeAt(pos);
  let isEscaped = false;
  let lastPos = 0;
  let current = "";
  while (pos < max) {
    if (ch === 124) if (!isEscaped) {
      result.push(current + str.substring(lastPos, pos));
      current = "";
      lastPos = pos + 1;
    } else {
      current += str.substring(lastPos, pos - 1);
      lastPos = pos;
    }
    isEscaped = ch === 92;
    pos++;
    ch = str.charCodeAt(pos);
  }
  result.push(current + str.substring(lastPos));
  return result;
}
function table(state, startLine, endLine, silent) {
  if (startLine + 2 > endLine) return false;
  let nextLine = startLine + 1;
  if (state.sCount[nextLine] < state.blkIndent) return false;
  if (state.sCount[nextLine] - state.blkIndent >= 4) return false;
  let pos = state.bMarks[nextLine] + state.tShift[nextLine];
  if (pos >= state.eMarks[nextLine]) return false;
  const firstCh = state.src.charCodeAt(pos++);
  if (firstCh !== 124 && firstCh !== 45 && firstCh !== 58) return false;
  if (pos >= state.eMarks[nextLine]) return false;
  const secondCh = state.src.charCodeAt(pos++);
  if (secondCh !== 124 && secondCh !== 45 && secondCh !== 58 && !isSpace(secondCh)) return false;
  if (firstCh === 45 && isSpace(secondCh)) return false;
  while (pos < state.eMarks[nextLine]) {
    const ch = state.src.charCodeAt(pos);
    if (ch !== 124 && ch !== 45 && ch !== 58 && !isSpace(ch)) return false;
    pos++;
  }
  let lineText = getLine$1(state, startLine + 1);
  let columns = lineText.split("|");
  const aligns = [];
  for (let i = 0; i < columns.length; i++) {
    const t = columns[i].trim();
    if (!t) if (i === 0 || i === columns.length - 1) continue;
    else return false;
    if (!/^:?-+:?$/.test(t)) return false;
    if (t.charCodeAt(t.length - 1) === 58) aligns.push(t.charCodeAt(0) === 58 ? "center" : "right");
    else if (t.charCodeAt(0) === 58) aligns.push("left");
    else aligns.push("");
  }
  lineText = getLine$1(state, startLine).trim();
  if (!lineText.includes("|")) return false;
  if (state.sCount[startLine] - state.blkIndent >= 4) return false;
  columns = escapedSplit(lineText);
  if (columns.length && columns[0] === "") columns.shift();
  if (columns.length && columns[columns.length - 1] === "") columns.pop();
  const columnCount = columns.length;
  if (columnCount === 0 || columnCount !== aligns.length) return false;
  if (silent) return true;
  const oldParentType = state.parentType;
  state.parentType = "table";
  const terminatorRules = state.md.block.ruler.getRules("blockquote");
  const token_to = state.push("table_open", "table", 1);
  const tableLines = [startLine, 0];
  token_to.map = tableLines;
  const token_tho = state.push("thead_open", "thead", 1);
  token_tho.map = [startLine, startLine + 1];
  const token_htro = state.push("tr_open", "tr", 1);
  token_htro.map = [startLine, startLine + 1];
  for (let i = 0; i < columns.length; i++) {
    const token_ho = state.push("th_open", "th", 1);
    if (aligns[i]) token_ho.attrs = [["style", `text-align:${aligns[i]}`]];
    const token_il = state.push("inline", "", 0);
    token_il.content = columns[i].trim();
    token_il.children = [];
    state.push("th_close", "th", -1);
  }
  state.push("tr_close", "tr", -1);
  state.push("thead_close", "thead", -1);
  let tbodyLines;
  let autocompletedCells = 0;
  for (nextLine = startLine + 2; nextLine < endLine; nextLine++) {
    if (state.sCount[nextLine] < state.blkIndent) break;
    let terminate = false;
    for (let i = 0, l = terminatorRules.length; i < l; i++) if (terminatorRules[i](state, nextLine, endLine, true)) {
      terminate = true;
      break;
    }
    if (terminate) break;
    lineText = getLine$1(state, nextLine).trim();
    if (!lineText) break;
    if (state.sCount[nextLine] - state.blkIndent >= 4) break;
    columns = escapedSplit(lineText);
    if (columns.length && columns[0] === "") columns.shift();
    if (columns.length && columns[columns.length - 1] === "") columns.pop();
    autocompletedCells += columnCount - columns.length;
    if (autocompletedCells > MAX_AUTOCOMPLETED_CELLS) break;
    if (nextLine === startLine + 2) {
      const token_tbo = state.push("tbody_open", "tbody", 1);
      token_tbo.map = tbodyLines = [startLine + 2, 0];
    }
    const token_tro = state.push("tr_open", "tr", 1);
    token_tro.map = [nextLine, nextLine + 1];
    for (let i = 0; i < columnCount; i++) {
      const token_tdo = state.push("td_open", "td", 1);
      if (aligns[i]) token_tdo.attrs = [["style", `text-align:${aligns[i]}`]];
      const token_il = state.push("inline", "", 0);
      token_il.content = columns[i] ? columns[i].trim() : "";
      token_il.children = [];
      state.push("td_close", "td", -1);
    }
    state.push("tr_close", "tr", -1);
  }
  if (tbodyLines) {
    state.push("tbody_close", "tbody", -1);
    tbodyLines[1] = nextLine;
  }
  state.push("table_close", "table", -1);
  tableLines[1] = nextLine;
  state.parentType = oldParentType;
  state.line = nextLine;
  return true;
}
const _rules$2 = [
  [
    "table",
    table,
    ["paragraph", "reference"]
  ],
  ["code", code],
  [
    "fence",
    fence,
    [
      "paragraph",
      "reference",
      "blockquote",
      "list"
    ]
  ],
  [
    "blockquote",
    blockquote,
    [
      "paragraph",
      "reference",
      "blockquote",
      "list"
    ]
  ],
  [
    "hr",
    hr,
    [
      "paragraph",
      "reference",
      "blockquote",
      "list"
    ]
  ],
  [
    "list",
    list,
    [
      "paragraph",
      "reference",
      "blockquote"
    ]
  ],
  ["reference", reference],
  [
    "html_block",
    html_block$1,
    [
      "paragraph",
      "reference",
      "blockquote"
    ]
  ],
  [
    "heading",
    heading,
    [
      "paragraph",
      "reference",
      "blockquote"
    ]
  ],
  ["lheading", lheading],
  ["paragraph", paragraph]
];
var ParserBlock = class {
  /**
  * {@link Ruler} instance. Keep configuration of block rules.
  */
  ruler;
  constructor() {
    this.ruler = new Ruler();
    for (let i = 0; i < _rules$2.length; i++) this.ruler.push(_rules$2[i][0], _rules$2[i][1], { alt: (_rules$2[i][2] || []).slice() });
  }
  /**
  * Generate tokens for input range
  */
  tokenize(state, startLine, endLine, silent) {
    const rules = this.ruler.getRules("");
    const len = rules.length;
    const maxNesting = state.md.options.maxNesting;
    let line = startLine;
    let hasEmptyLines = false;
    while (line < endLine) {
      state.line = line = state.skipEmptyLines(line);
      if (line >= endLine) break;
      if (state.sCount[line] < state.blkIndent) break;
      if (state.level >= maxNesting) {
        state.line = endLine;
        break;
      }
      const prevLine = state.line;
      let ok = false;
      for (let i = 0; i < len; i++) {
        ok = rules[i](state, line, endLine, false);
        if (ok) {
          if (prevLine >= state.line) throw new Error("block rule didn't increment state.line");
          break;
        }
      }
      if (!ok) throw new Error("none of the block rules matched");
      state.tight = !hasEmptyLines;
      if (state.isEmpty(state.line - 1)) hasEmptyLines = true;
      line = state.line;
      if (line < endLine && state.isEmpty(line)) {
        hasEmptyLines = true;
        line++;
        state.line = line;
      }
    }
  }
  /**
  * Process input string and push block tokens into `outTokens`
  */
  parse(src2, md, env, outTokens) {
    if (!src2) return;
    const state = new this.State(src2, md, env, outTokens);
    this.tokenize(state, state.line, state.lineMax);
  }
  State = StateBlock;
};
function block(state) {
  let token;
  if (state.inlineMode) {
    token = new state.Token("inline", "", 0);
    token.content = state.src;
    token.map = [0, 1];
    token.children = [];
    state.tokens.push(token);
  } else state.md.block.parse(state.src, state.md, state.env, state.tokens);
}
function inline(state) {
  const tokens = state.tokens;
  for (let i = 0, l = tokens.length; i < l; i++) {
    const tok = tokens[i];
    if (tok.type === "inline") state.md.inline.parse(tok.content, state.md, state.env, tok.children);
  }
}
function isLinkOpen$1(str) {
  return /^<a[>\s]/i.test(str);
}
function isLinkClose$1(str) {
  return /^<\/a\s*>/i.test(str);
}
function linkify$1(state) {
  if (!state.md.options.linkify) return;
  const blockTokens = state.tokens;
  const linkify$2 = state.md.linkify;
  for (let j = 0, l = blockTokens.length; j < l; j++) {
    if (blockTokens[j].type !== "inline" || !linkify$2.pretest(blockTokens[j].content)) continue;
    const tokens = blockTokens[j].children;
    let htmlLinkLevel = 0;
    for (let i = tokens.length - 1; i >= 0; i--) {
      const currentToken = tokens[i];
      if (currentToken.type === "link_close") {
        i--;
        while (tokens[i].level !== currentToken.level && tokens[i].type !== "link_open") i--;
        continue;
      }
      if (currentToken.type === "html_inline") {
        if (isLinkOpen$1(currentToken.content) && htmlLinkLevel > 0) htmlLinkLevel--;
        if (isLinkClose$1(currentToken.content)) htmlLinkLevel++;
      }
      if (htmlLinkLevel > 0) continue;
      if (currentToken.type === "text") {
        const text$12 = currentToken.content;
        if (!linkify$2.pretest(text$12)) continue;
        const links = linkify$2.match(text$12);
        if (!links?.length) continue;
        const nodes = [];
        let level = currentToken.level;
        let lastPos = 0;
        const startFrom = links[0].index === 0 && i > 0 && tokens[i - 1].type === "text_special" ? 1 : 0;
        for (let ln = startFrom; ln < links.length; ln++) {
          const link$1 = links[ln];
          const fullUrl = state.md.normalizeLink(link$1.url);
          if (!state.md.validateLink(fullUrl)) continue;
          let urlText = link$1.text;
          if (!link$1.schema) urlText = state.md.normalizeLinkText(`http://${urlText}`).replace(/^http:\/\//, "");
          else if (link$1.schema === "mailto:" && !/^mailto:/i.test(urlText)) urlText = state.md.normalizeLinkText(`mailto:${urlText}`).replace(/^mailto:/, "");
          else urlText = state.md.normalizeLinkText(urlText);
          const pos = link$1.index;
          if (pos > lastPos) {
            const token = new state.Token("text", "", 0);
            token.content = text$12.slice(lastPos, pos);
            token.level = level;
            nodes.push(token);
          }
          const token_o = new state.Token("link_open", "a", 1);
          token_o.attrs = [["href", fullUrl]];
          token_o.level = level++;
          token_o.markup = "linkify";
          token_o.info = "auto";
          nodes.push(token_o);
          const token_t = new state.Token("text", "", 0);
          token_t.content = urlText;
          token_t.level = level;
          nodes.push(token_t);
          const token_c = new state.Token("link_close", "a", -1);
          token_c.level = --level;
          token_c.markup = "linkify";
          token_c.info = "auto";
          nodes.push(token_c);
          lastPos = link$1.lastIndex;
        }
        if (lastPos < text$12.length) {
          const token = new state.Token("text", "", 0);
          token.content = text$12.slice(lastPos);
          token.level = level;
          nodes.push(token);
        }
        tokens.splice(i, 1, ...nodes);
      }
    }
  }
}
const NEWLINES_RE = /\r\n?|\n/g;
const NULL_RE = /\0/g;
function normalize2(state) {
  let str = state.src;
  const hasCR = str.includes("\r");
  const hasNull = str.includes("\0");
  if (!hasCR && !hasNull) return;
  if (hasCR) str = str.replace(NEWLINES_RE, "\n");
  if (hasNull) str = str.replace(NULL_RE, "�");
  state.src = str;
}
const RARE_RE = /\+-|\.\.|\?\?\?\?|!!!!|,,|--/;
const SCOPED_ABBR_TEST_RE = /\((?:c|tm|r)\)/i;
const SCOPED_ABBR_RE = /\((c|tm|r)\)/gi;
const SCOPED_ABBR = {
  c: "©",
  r: "®",
  tm: "™"
};
function replaceFn(match2, name) {
  return SCOPED_ABBR[name.toLowerCase()];
}
function replace_scoped(inlineTokens) {
  let inside_autolink = 0;
  for (let i = inlineTokens.length - 1; i >= 0; i--) {
    const token = inlineTokens[i];
    if (token.type === "text" && !inside_autolink) token.content = token.content.replace(SCOPED_ABBR_RE, replaceFn);
    if (token.type === "link_open" && token.info === "auto") inside_autolink--;
    if (token.type === "link_close" && token.info === "auto") inside_autolink++;
  }
}
function replace_rare(inlineTokens) {
  let inside_autolink = 0;
  for (let i = inlineTokens.length - 1; i >= 0; i--) {
    const token = inlineTokens[i];
    if (token.type === "text" && !inside_autolink) {
      if (RARE_RE.test(token.content)) token.content = token.content.replace(/\+-/g, "±").replace(/\.{2,}/g, "…").replace(/([?!])…/g, "$1..").replace(/([?!]){4,}/g, "$1$1$1").replace(/,{2,}/g, ",").replace(/(^|[^-])---(?=[^-]|$)/gm, "$1—").replace(/(^|\s)--(?=\s|$)/gm, "$1–").replace(/(^|[^-\s])--(?=[^-\s]|$)/gm, "$1–");
    }
    if (token.type === "link_open" && token.info === "auto") inside_autolink--;
    if (token.type === "link_close" && token.info === "auto") inside_autolink++;
  }
}
function replace(state) {
  let blkIdx;
  if (!state.md.options.typographer) return;
  for (blkIdx = state.tokens.length - 1; blkIdx >= 0; blkIdx--) {
    if (state.tokens[blkIdx].type !== "inline") continue;
    if (SCOPED_ABBR_TEST_RE.test(state.tokens[blkIdx].content)) replace_scoped(state.tokens[blkIdx].children);
    if (RARE_RE.test(state.tokens[blkIdx].content)) replace_rare(state.tokens[blkIdx].children);
  }
}
const QUOTE_TEST_RE = /['"]/;
const QUOTE_RE = /['"]/g;
const APOSTROPHE = "’";
function addReplacement(replacements, tokenIdx, pos, ch) {
  if (!replacements[tokenIdx]) replacements[tokenIdx] = [];
  replacements[tokenIdx].push({
    pos,
    ch
  });
}
function applyReplacements(str, replacements) {
  let result = "";
  let lastPos = 0;
  replacements.sort((a, b) => a.pos - b.pos);
  for (let i = 0; i < replacements.length; i++) {
    const replacement = replacements[i];
    result += str.slice(lastPos, replacement.pos) + replacement.ch;
    lastPos = replacement.pos + 1;
  }
  return result + str.slice(lastPos);
}
function process_inlines(tokens, state) {
  let j;
  const stack = [];
  const replacements = {};
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    const thisLevel = tokens[i].level;
    for (j = stack.length - 1; j >= 0; j--) if (stack[j].level <= thisLevel) break;
    stack.length = j + 1;
    if (token.type !== "text") continue;
    const text$12 = token.content;
    let pos = 0;
    const max = text$12.length;
    OUTER: while (pos < max) {
      QUOTE_RE.lastIndex = pos;
      const t = QUOTE_RE.exec(text$12);
      if (!t) break;
      let canOpen = true;
      let canClose = true;
      pos = t.index + 1;
      const isSingle = t[0] === "'";
      let lastChar = 32;
      if (t.index - 1 >= 0) lastChar = text$12.charCodeAt(t.index - 1);
      else for (j = i - 1; j >= 0; j--) {
        if (tokens[j].type === "softbreak" || tokens[j].type === "hardbreak") break;
        if (!tokens[j].content) continue;
        lastChar = tokens[j].content.charCodeAt(tokens[j].content.length - 1);
        break;
      }
      let nextChar = 32;
      if (pos < max) nextChar = text$12.charCodeAt(pos);
      else for (j = i + 1; j < tokens.length; j++) {
        if (tokens[j].type === "softbreak" || tokens[j].type === "hardbreak") break;
        if (!tokens[j].content) continue;
        nextChar = tokens[j].content.charCodeAt(0);
        break;
      }
      const isLastPunctChar = isMdAsciiPunct(lastChar) || isPunctCharCode(lastChar);
      const isNextPunctChar = isMdAsciiPunct(nextChar) || isPunctCharCode(nextChar);
      const isLastWhiteSpace = isWhiteSpace$1(lastChar);
      const isNextWhiteSpace = isWhiteSpace$1(nextChar);
      if (isNextWhiteSpace) canOpen = false;
      else if (isNextPunctChar) {
        if (!(isLastWhiteSpace || isLastPunctChar)) canOpen = false;
      }
      if (isLastWhiteSpace) canClose = false;
      else if (isLastPunctChar) {
        if (!(isNextWhiteSpace || isNextPunctChar)) canClose = false;
      }
      if (nextChar === 34 && t[0] === '"') {
        if (lastChar >= 48 && lastChar <= 57) canClose = canOpen = false;
      }
      if (canOpen && canClose) {
        canOpen = isLastPunctChar;
        canClose = isNextPunctChar;
      }
      if (!canOpen && !canClose) {
        if (isSingle) addReplacement(replacements, i, t.index, APOSTROPHE);
        continue;
      }
      if (canClose) for (j = stack.length - 1; j >= 0; j--) {
        let item = stack[j];
        if (stack[j].level < thisLevel) break;
        if (item.single === isSingle && stack[j].level === thisLevel) {
          item = stack[j];
          let openQuote;
          let closeQuote;
          if (isSingle) {
            openQuote = state.md.options.quotes[2];
            closeQuote = state.md.options.quotes[3];
          } else {
            openQuote = state.md.options.quotes[0];
            closeQuote = state.md.options.quotes[1];
          }
          addReplacement(replacements, i, t.index, closeQuote);
          addReplacement(replacements, item.token, item.pos, openQuote);
          stack.length = j;
          continue OUTER;
        }
      }
      if (canOpen) stack.push({
        token: i,
        pos: t.index,
        single: isSingle,
        level: thisLevel
      });
      else if (canClose && isSingle) addReplacement(replacements, i, t.index, APOSTROPHE);
    }
  }
  Object.keys(replacements).forEach((tokenIdx) => {
    tokens[tokenIdx].content = applyReplacements(tokens[tokenIdx].content, replacements[tokenIdx]);
  });
}
function smartquotes(state) {
  if (!state.md.options.typographer) return;
  for (let blkIdx = state.tokens.length - 1; blkIdx >= 0; blkIdx--) {
    if (state.tokens[blkIdx].type !== "inline" || !QUOTE_TEST_RE.test(state.tokens[blkIdx].content)) continue;
    process_inlines(state.tokens[blkIdx].children, state);
  }
}
function text_join(state) {
  let curr, last;
  const blockTokens = state.tokens;
  const l = blockTokens.length;
  for (let j = 0; j < l; j++) {
    if (blockTokens[j].type !== "inline") continue;
    const tokens = blockTokens[j].children;
    const max = tokens.length;
    for (curr = 0; curr < max; curr++) if (tokens[curr].type === "text_special") tokens[curr].type = "text";
    for (curr = last = 0; curr < max; curr++) if (tokens[curr].type === "text" && curr + 1 < max && tokens[curr + 1].type === "text") tokens[curr + 1].content = tokens[curr].content + tokens[curr + 1].content;
    else {
      if (curr !== last) tokens[last] = tokens[curr];
      last++;
    }
    if (curr !== last) tokens.length = last;
  }
}
const _rules$1 = [
  ["normalize", normalize2],
  ["block", block],
  ["inline", inline],
  ["linkify", linkify$1],
  ["replacements", replace],
  ["smartquotes", smartquotes],
  ["text_join", text_join]
];
var Core = class {
  /**
  * {@link Ruler} instance. Keep configuration of core rules.
  */
  ruler;
  constructor() {
    this.ruler = new Ruler();
    for (let i = 0; i < _rules$1.length; i++) this.ruler.push(_rules$1[i][0], _rules$1[i][1]);
  }
  /**
  * Executes core chain rules.
  */
  process(state) {
    const rules = this.ruler.getRules("");
    for (let i = 0, l = rules.length; i < l; i++) rules[i](state);
  }
  State = StateCore;
};
function parseLinkDestination(str, start, max) {
  let code$1;
  let pos = start;
  const result = {
    ok: false,
    pos: 0,
    str: ""
  };
  if (str.charCodeAt(pos) === 60) {
    pos++;
    while (pos < max) {
      code$1 = str.charCodeAt(pos);
      if (code$1 === 10) return result;
      if (code$1 === 60) return result;
      if (code$1 === 62) {
        result.pos = pos + 1;
        result.str = unescapeAll(str.slice(start + 1, pos));
        result.ok = true;
        return result;
      }
      if (code$1 === 92 && pos + 1 < max) {
        pos += 2;
        continue;
      }
      pos++;
    }
    return result;
  }
  let level = 0;
  while (pos < max) {
    code$1 = str.charCodeAt(pos);
    if (code$1 === 32) break;
    if (code$1 < 32 || code$1 === 127) break;
    if (code$1 === 92 && pos + 1 < max) {
      if (str.charCodeAt(pos + 1) === 32) break;
      pos += 2;
      continue;
    }
    if (code$1 === 40) {
      level++;
      if (level > 32) return result;
    }
    if (code$1 === 41) {
      if (level === 0) break;
      level--;
    }
    pos++;
  }
  if (start === pos) return result;
  if (level !== 0) return result;
  result.str = unescapeAll(str.slice(start, pos));
  result.pos = pos;
  result.ok = true;
  return result;
}
function parseLinkLabel(state, start, disableNested = false) {
  let level;
  let found = false;
  let marker;
  let prevPos;
  const max = state.posMax;
  const oldPos = state.pos;
  state.pos = start + 1;
  level = 1;
  while (state.pos < max) {
    marker = state.src.charCodeAt(state.pos);
    if (marker === 93) {
      level--;
      if (level === 0) {
        found = true;
        break;
      }
    }
    prevPos = state.pos;
    state.md.inline.skipToken(state);
    if (marker === 91) {
      if (prevPos === state.pos - 1) level++;
      else if (disableNested) {
        state.pos = oldPos;
        return -1;
      }
    }
  }
  let labelEnd = -1;
  if (found) labelEnd = state.pos;
  state.pos = oldPos;
  return labelEnd;
}
function parseLinkTitle(str, start, max, prev_state) {
  let code$1;
  let pos = start;
  const state = {
    ok: false,
    can_continue: false,
    pos: 0,
    str: "",
    marker: 0
  };
  if (prev_state) {
    state.str = prev_state.str;
    state.marker = prev_state.marker;
  } else {
    if (pos >= max) return state;
    let marker = str.charCodeAt(pos);
    if (marker !== 34 && marker !== 39 && marker !== 40) return state;
    start++;
    pos++;
    if (marker === 40) marker = 41;
    state.marker = marker;
  }
  while (pos < max) {
    code$1 = str.charCodeAt(pos);
    if (code$1 === state.marker) {
      state.pos = pos + 1;
      state.str += unescapeAll(str.slice(start, pos));
      state.ok = true;
      return state;
    } else if (code$1 === 40 && state.marker === 41) return state;
    else if (code$1 === 92 && pos + 1 < max) pos++;
    pos++;
  }
  state.can_continue = true;
  state.str += unescapeAll(str.slice(start, pos));
  return state;
}
const helpers = {
  parseLinkDestination,
  parseLinkLabel,
  parseLinkTitle
};
const EMAIL_RE = /^([\w.!#$%&'*+/=?^`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)*)$/i;
const AUTOLINK_RE = /^([a-z][a-z0-9+.-]{1,31}):([^<>\x00-\x20]*)$/i;
function autolink(state, silent) {
  let pos = state.pos;
  if (state.src.charCodeAt(pos) !== 60) return false;
  const start = state.pos;
  const max = state.posMax;
  for (; ; ) {
    if (++pos >= max) return false;
    const ch = state.src.charCodeAt(pos);
    if (ch === 60) return false;
    if (ch === 62) break;
  }
  const url = state.src.slice(start + 1, pos);
  if (AUTOLINK_RE.test(url)) {
    const fullUrl = state.md.normalizeLink(url);
    if (!state.md.validateLink(fullUrl)) return false;
    if (!silent) {
      const token_o = state.push("link_open", "a", 1);
      token_o.attrs = [["href", fullUrl]];
      token_o.markup = "autolink";
      token_o.info = "auto";
      const token_t = state.push("text", "", 0);
      token_t.content = state.md.normalizeLinkText(url);
      const token_c = state.push("link_close", "a", -1);
      token_c.markup = "autolink";
      token_c.info = "auto";
    }
    state.pos += url.length + 2;
    return true;
  }
  if (EMAIL_RE.test(url)) {
    const fullUrl = state.md.normalizeLink(`mailto:${url}`);
    if (!state.md.validateLink(fullUrl)) return false;
    if (!silent) {
      const token_o = state.push("link_open", "a", 1);
      token_o.attrs = [["href", fullUrl]];
      token_o.markup = "autolink";
      token_o.info = "auto";
      const token_t = state.push("text", "", 0);
      token_t.content = state.md.normalizeLinkText(url);
      const token_c = state.push("link_close", "a", -1);
      token_c.markup = "autolink";
      token_c.info = "auto";
    }
    state.pos += url.length + 2;
    return true;
  }
  return false;
}
function backtick(state, silent) {
  let pos = state.pos;
  const src2 = state.src;
  if (src2.charCodeAt(pos) !== 96) return false;
  const start = pos;
  pos++;
  const max = state.posMax;
  while (pos < max && src2.charCodeAt(pos) === 96) pos++;
  const marker = src2.slice(start, pos);
  const openerLength = marker.length;
  if (state.backticksScanned && (state.backticks[openerLength] || 0) <= start) {
    if (!silent) state.pending += marker;
    state.pos += openerLength;
    return true;
  }
  let matchEnd = pos;
  let matchStart;
  while (true) {
    matchStart = src2.indexOf("`", matchEnd);
    if (matchStart === -1) break;
    matchEnd = matchStart + 1;
    while (matchEnd < max && src2.charCodeAt(matchEnd) === 96) matchEnd++;
    const closerLength = matchEnd - matchStart;
    if (closerLength === openerLength) {
      if (!silent) {
        const token = state.push("code_inline", "code", 0);
        token.markup = marker;
        token.content = src2.slice(pos, matchStart).replace(/\n/g, " ").replace(/^ (.+) $/, "$1");
      }
      state.pos = matchEnd;
      return true;
    }
    state.backticks[closerLength] = matchStart;
  }
  state.backticksScanned = true;
  if (!silent) state.pending += marker;
  state.pos += openerLength;
  return true;
}
function processDelimiters(delimiters) {
  const openersBottom = {};
  const max = delimiters.length;
  if (!max) return;
  let headerIdx = 0;
  let lastTokenIdx = -2;
  const jumps = [];
  for (let closerIdx = 0; closerIdx < max; closerIdx++) {
    const closer = delimiters[closerIdx];
    jumps.push(0);
    if (delimiters[headerIdx].marker !== closer.marker || lastTokenIdx !== closer.token - 1) headerIdx = closerIdx;
    lastTokenIdx = closer.token;
    closer.length = closer.length || 0;
    if (!closer.close) continue;
    if (!openersBottom.hasOwnProperty(closer.marker)) openersBottom[closer.marker] = [
      -1,
      -1,
      -1,
      -1,
      -1,
      -1
    ];
    const minOpenerIdx = openersBottom[closer.marker][(closer.open ? 3 : 0) + closer.length % 3];
    let openerIdx = headerIdx - jumps[headerIdx] - 1;
    let newMinOpenerIdx = openerIdx;
    for (; openerIdx > minOpenerIdx; openerIdx -= jumps[openerIdx] + 1) {
      const opener = delimiters[openerIdx];
      if (opener.marker !== closer.marker) continue;
      if (opener.open && opener.end < 0) {
        let isOddMatch = false;
        if (opener.close || closer.open) {
          if ((opener.length + closer.length) % 3 === 0) {
            if (opener.length % 3 !== 0 || closer.length % 3 !== 0) isOddMatch = true;
          }
        }
        if (!isOddMatch) {
          const lastJump = openerIdx > 0 && !delimiters[openerIdx - 1].open ? jumps[openerIdx - 1] + 1 : 0;
          jumps[closerIdx] = closerIdx - openerIdx + lastJump;
          jumps[openerIdx] = lastJump;
          closer.open = false;
          opener.end = closerIdx;
          opener.close = false;
          newMinOpenerIdx = -1;
          lastTokenIdx = -2;
          break;
        }
      }
    }
    if (newMinOpenerIdx !== -1) openersBottom[closer.marker][(closer.open ? 3 : 0) + (closer.length || 0) % 3] = newMinOpenerIdx;
  }
}
function link_pairs(state) {
  const tokens_meta = state.tokens_meta;
  const max = state.tokens_meta.length;
  processDelimiters(state.delimiters);
  for (let curr = 0; curr < max; curr++) {
    const delimiters = tokens_meta[curr]?.delimiters;
    if (delimiters) processDelimiters(delimiters);
  }
}
function emphasis_tokenize(state, silent) {
  const start = state.pos;
  const marker = state.src.charCodeAt(start);
  if (silent) return false;
  if (marker !== 95 && marker !== 42) return false;
  const scanned = state.scanDelims(state.pos, marker === 42);
  for (let i = 0; i < scanned.length; i++) {
    const token = state.push("text", "", 0);
    token.content = String.fromCharCode(marker);
    state.delimiters.push({
      marker,
      length: scanned.length,
      token: state.tokens.length - 1,
      end: -1,
      open: scanned.can_open,
      close: scanned.can_close
    });
  }
  state.pos += scanned.length;
  return true;
}
function postProcess$1(state, delimiters) {
  const max = delimiters.length;
  for (let i = max - 1; i >= 0; i--) {
    const startDelim = delimiters[i];
    if (startDelim.marker !== 95 && startDelim.marker !== 42) continue;
    if (startDelim.end === -1) continue;
    const endDelim = delimiters[startDelim.end];
    const isStrong = i > 0 && delimiters[i - 1].end === startDelim.end + 1 && delimiters[i - 1].marker === startDelim.marker && delimiters[i - 1].token === startDelim.token - 1 && delimiters[startDelim.end + 1].token === endDelim.token + 1;
    const ch = String.fromCharCode(startDelim.marker);
    const token_o = state.tokens[startDelim.token];
    token_o.type = isStrong ? "strong_open" : "em_open";
    token_o.tag = isStrong ? "strong" : "em";
    token_o.nesting = 1;
    token_o.markup = isStrong ? ch + ch : ch;
    token_o.content = "";
    const token_c = state.tokens[endDelim.token];
    token_c.type = isStrong ? "strong_close" : "em_close";
    token_c.tag = isStrong ? "strong" : "em";
    token_c.nesting = -1;
    token_c.markup = isStrong ? ch + ch : ch;
    token_c.content = "";
    if (isStrong) {
      state.tokens[delimiters[i - 1].token].content = "";
      state.tokens[delimiters[startDelim.end + 1].token].content = "";
      i--;
    }
  }
}
function emphasis_post_process(state) {
  const tokens_meta = state.tokens_meta;
  const max = state.tokens_meta.length;
  postProcess$1(state, state.delimiters);
  for (let curr = 0; curr < max; curr++) {
    const delimiters = tokens_meta[curr]?.delimiters;
    if (delimiters) postProcess$1(state, delimiters);
  }
}
var emphasis_default = {
  tokenize: emphasis_tokenize,
  postProcess: emphasis_post_process
};
const DIGITAL_RE = /^&#(x[a-f0-9]{1,6}|\d{1,7});/i;
const NAMED_RE = /^&([a-z][a-z0-9]{1,31});/i;
function entity(state, silent) {
  const pos = state.pos;
  const max = state.posMax;
  if (state.src.charCodeAt(pos) !== 38) return false;
  if (pos + 1 >= max) return false;
  if (state.src.charCodeAt(pos + 1) === 35) {
    const match2 = state.src.slice(pos).match(DIGITAL_RE);
    if (match2) {
      if (!silent) {
        const code$1 = match2[1][0].toLowerCase() === "x" ? Number.parseInt(match2[1].slice(1), 16) : Number.parseInt(match2[1], 10);
        const token = state.push("text_special", "", 0);
        token.content = isValidEntityCode(code$1) ? fromCodePoint$1(code$1) : fromCodePoint$1(65533);
        token.markup = match2[0];
        token.info = "entity";
      }
      state.pos += match2[0].length;
      return true;
    }
  } else {
    const match2 = state.src.slice(pos).match(NAMED_RE);
    if (match2) {
      const decoded = decodeHTMLStrict(match2[0]);
      if (decoded !== match2[0]) {
        if (!silent) {
          const token = state.push("text_special", "", 0);
          token.content = decoded;
          token.markup = match2[0];
          token.info = "entity";
        }
        state.pos += match2[0].length;
        return true;
      }
    }
  }
  return false;
}
const ESCAPED = [];
for (let i = 0; i < 256; i++) ESCAPED.push(0);
for (const ch of "\\!\"#$%&'()*+,./:;<=>?@[]^_`{|}~-".split("")) ESCAPED[ch.charCodeAt(0)] = 1;
function escape(state, silent) {
  let pos = state.pos;
  const max = state.posMax;
  if (state.src.charCodeAt(pos) !== 92) return false;
  pos++;
  if (pos >= max) return false;
  let ch1 = state.src.charCodeAt(pos);
  if (ch1 === 10) {
    if (!silent) state.push("hardbreak", "br", 0);
    pos++;
    while (pos < max) {
      ch1 = state.src.charCodeAt(pos);
      if (!isSpace(ch1)) break;
      pos++;
    }
    state.pos = pos;
    return true;
  }
  let escapedStr = state.src[pos];
  if (ch1 >= 55296 && ch1 <= 56319 && pos + 1 < max) {
    const ch2 = state.src.charCodeAt(pos + 1);
    if (ch2 >= 56320 && ch2 <= 57343) {
      escapedStr += state.src[pos + 1];
      pos++;
    }
  }
  const origStr = `\\${escapedStr}`;
  if (!silent) {
    const token = state.push("text_special", "", 0);
    if (ch1 < 256 && ESCAPED[ch1] !== 0) token.content = escapedStr;
    else token.content = origStr;
    token.markup = origStr;
    token.info = "escape";
  }
  state.pos = pos + 1;
  return true;
}
function fragments_join(state) {
  let curr, last;
  let level = 0;
  const tokens = state.tokens;
  const max = state.tokens.length;
  for (curr = last = 0; curr < max; curr++) {
    if (tokens[curr].nesting < 0) level--;
    tokens[curr].level = level;
    if (tokens[curr].nesting > 0) level++;
    if (tokens[curr].type === "text" && curr + 1 < max && tokens[curr + 1].type === "text") tokens[curr + 1].content = tokens[curr].content + tokens[curr + 1].content;
    else {
      if (curr !== last) tokens[last] = tokens[curr];
      last++;
    }
  }
  if (curr !== last) tokens.length = last;
}
function isLinkOpen$2(str) {
  return /^<a[>\s]/i.test(str);
}
function isLinkClose$2(str) {
  return /^<\/a\s*>/i.test(str);
}
function isLetter$1(ch) {
  const lc = ch | 32;
  return lc >= 97 && lc <= 122;
}
function html_inline$1(state, silent) {
  if (!state.md.options.html) return false;
  const max = state.posMax;
  const pos = state.pos;
  if (state.src.charCodeAt(pos) !== 60 || pos + 2 >= max) return false;
  const ch = state.src.charCodeAt(pos + 1);
  if (ch !== 33 && ch !== 63 && ch !== 47 && !isLetter$1(ch)) return false;
  const match2 = state.src.slice(pos).match(HTML_TAG_RE$1);
  if (!match2) return false;
  if (!silent) {
    const token = state.push("html_inline", "", 0);
    token.content = match2[0];
    if (isLinkOpen$2(token.content)) state.linkLevel++;
    if (isLinkClose$2(token.content)) state.linkLevel--;
  }
  state.pos += match2[0].length;
  return true;
}
function image(state, silent) {
  let code$1, content, label, pos, ref2, res, title, start;
  let href = "";
  const oldPos = state.pos;
  const max = state.posMax;
  if (state.src.charCodeAt(state.pos) !== 33) return false;
  if (state.src.charCodeAt(state.pos + 1) !== 91) return false;
  const labelStart = state.pos + 2;
  const labelEnd = state.md.helpers.parseLinkLabel(state, state.pos + 1, false);
  if (labelEnd < 0) return false;
  pos = labelEnd + 1;
  if (pos < max && state.src.charCodeAt(pos) === 40) {
    pos++;
    for (; pos < max; pos++) {
      code$1 = state.src.charCodeAt(pos);
      if (!isSpace(code$1) && code$1 !== 10) break;
    }
    if (pos >= max) return false;
    start = pos;
    res = state.md.helpers.parseLinkDestination(state.src, pos, state.posMax);
    if (res.ok) {
      href = state.md.normalizeLink(res.str);
      if (state.md.validateLink(href)) pos = res.pos;
      else href = "";
    }
    start = pos;
    for (; pos < max; pos++) {
      code$1 = state.src.charCodeAt(pos);
      if (!isSpace(code$1) && code$1 !== 10) break;
    }
    res = state.md.helpers.parseLinkTitle(state.src, pos, state.posMax);
    if (pos < max && start !== pos && res.ok) {
      title = res.str;
      pos = res.pos;
      for (; pos < max; pos++) {
        code$1 = state.src.charCodeAt(pos);
        if (!isSpace(code$1) && code$1 !== 10) break;
      }
    } else title = "";
    if (pos >= max || state.src.charCodeAt(pos) !== 41) {
      state.pos = oldPos;
      return false;
    }
    pos++;
  } else {
    if (typeof state.env.references === "undefined") return false;
    if (pos < max && state.src.charCodeAt(pos) === 91) {
      start = pos + 1;
      pos = state.md.helpers.parseLinkLabel(state, pos);
      if (pos >= 0) label = state.src.slice(start, pos++);
      else pos = labelEnd + 1;
    } else pos = labelEnd + 1;
    if (!label) label = state.src.slice(labelStart, labelEnd);
    ref2 = state.env.references[normalizeReference(label)];
    if (!ref2) {
      state.pos = oldPos;
      return false;
    }
    href = ref2.href;
    title = ref2.title;
  }
  if (!silent) {
    content = state.src.slice(labelStart, labelEnd);
    const tokens = [];
    state.md.inline.parse(content, state.md, state.env, tokens);
    const token = state.push("image", "img", 0);
    const attrs = [["src", href], ["alt", ""]];
    token.attrs = attrs;
    token.children = tokens;
    token.content = content;
    if (title) attrs.push(["title", title]);
  }
  state.pos = pos;
  state.posMax = max;
  return true;
}
function link(state, silent) {
  let code$1, label, res, ref2;
  let href = "";
  let title = "";
  let start = state.pos;
  let parseReference = true;
  if (state.src.charCodeAt(state.pos) !== 91) return false;
  const oldPos = state.pos;
  const max = state.posMax;
  const labelStart = state.pos + 1;
  const labelEnd = state.md.helpers.parseLinkLabel(state, state.pos, true);
  if (labelEnd < 0) return false;
  let pos = labelEnd + 1;
  if (pos < max && state.src.charCodeAt(pos) === 40) {
    parseReference = false;
    pos++;
    for (; pos < max; pos++) {
      code$1 = state.src.charCodeAt(pos);
      if (!isSpace(code$1) && code$1 !== 10) break;
    }
    if (pos >= max) return false;
    start = pos;
    res = state.md.helpers.parseLinkDestination(state.src, pos, state.posMax);
    if (res.ok) {
      href = state.md.normalizeLink(res.str);
      if (state.md.validateLink(href)) pos = res.pos;
      else href = "";
      start = pos;
      for (; pos < max; pos++) {
        code$1 = state.src.charCodeAt(pos);
        if (!isSpace(code$1) && code$1 !== 10) break;
      }
      res = state.md.helpers.parseLinkTitle(state.src, pos, state.posMax);
      if (pos < max && start !== pos && res.ok) {
        title = res.str;
        pos = res.pos;
        for (; pos < max; pos++) {
          code$1 = state.src.charCodeAt(pos);
          if (!isSpace(code$1) && code$1 !== 10) break;
        }
      }
    }
    if (pos >= max || state.src.charCodeAt(pos) !== 41) parseReference = true;
    pos++;
  }
  if (parseReference) {
    if (typeof state.env.references === "undefined") return false;
    if (pos < max && state.src.charCodeAt(pos) === 91) {
      start = pos + 1;
      pos = state.md.helpers.parseLinkLabel(state, pos);
      if (pos >= 0) label = state.src.slice(start, pos++);
      else pos = labelEnd + 1;
    } else pos = labelEnd + 1;
    if (!label) label = state.src.slice(labelStart, labelEnd);
    ref2 = state.env.references[normalizeReference(label)];
    if (!ref2) {
      state.pos = oldPos;
      return false;
    }
    href = ref2.href;
    title = ref2.title;
  }
  if (!silent) {
    state.pos = labelStart;
    state.posMax = labelEnd;
    const token_o = state.push("link_open", "a", 1);
    const attrs = [["href", href]];
    token_o.attrs = attrs;
    if (title) attrs.push(["title", title]);
    state.linkLevel++;
    state.md.inline.tokenize(state);
    state.linkLevel--;
    state.push("link_close", "a", -1);
  }
  state.pos = pos;
  state.posMax = max;
  return true;
}
const SCHEME_RE = /(?:^|[^a-z0-9.+-])([a-z][a-z0-9.+-]*)$/i;
function linkify(state, silent) {
  if (!state.md.options.linkify) return false;
  if (state.linkLevel > 0) return false;
  const pos = state.pos;
  const max = state.posMax;
  if (pos + 3 > max) return false;
  if (state.src.charCodeAt(pos) !== 58) return false;
  if (state.src.charCodeAt(pos + 1) !== 47) return false;
  if (state.src.charCodeAt(pos + 2) !== 47) return false;
  const match2 = state.pending.match(SCHEME_RE);
  if (!match2) return false;
  const proto = match2[1];
  const link$1 = state.md.linkify.matchAtStart(state.src.slice(pos - proto.length));
  if (!link$1) return false;
  let url = link$1.url;
  if (url.length <= proto.length) return false;
  let urlEnd = url.length;
  while (urlEnd > 0 && url.charCodeAt(urlEnd - 1) === 42) urlEnd--;
  if (urlEnd !== url.length) url = url.slice(0, urlEnd);
  const fullUrl = state.md.normalizeLink(url);
  if (!state.md.validateLink(fullUrl)) return false;
  if (!silent) {
    state.pending = state.pending.slice(0, -proto.length);
    const token_o = state.push("link_open", "a", 1);
    token_o.attrs = [["href", fullUrl]];
    token_o.markup = "linkify";
    token_o.info = "auto";
    const token_t = state.push("text", "", 0);
    token_t.content = state.md.normalizeLinkText(url);
    const token_c = state.push("link_close", "a", -1);
    token_c.markup = "linkify";
    token_c.info = "auto";
  }
  state.pos += url.length - proto.length;
  return true;
}
function newline(state, silent) {
  let pos = state.pos;
  if (state.src.charCodeAt(pos) !== 10) return false;
  const pmax = state.pending.length - 1;
  const max = state.posMax;
  if (!silent) if (pmax >= 0 && state.pending.charCodeAt(pmax) === 32) if (pmax >= 1 && state.pending.charCodeAt(pmax - 1) === 32) {
    let ws = pmax - 1;
    while (ws >= 1 && state.pending.charCodeAt(ws - 1) === 32) ws--;
    state.pending = state.pending.slice(0, ws);
    state.push("hardbreak", "br", 0);
  } else {
    state.pending = state.pending.slice(0, -1);
    state.push("softbreak", "br", 0);
  }
  else state.push("softbreak", "br", 0);
  pos++;
  while (pos < max && isSpace(state.src.charCodeAt(pos))) pos++;
  state.pos = pos;
  return true;
}
function strikethrough_tokenize(state, silent) {
  const start = state.pos;
  const marker = state.src.charCodeAt(start);
  if (silent) return false;
  if (marker !== 126) return false;
  const scanned = state.scanDelims(state.pos, true);
  let len = scanned.length;
  const ch = String.fromCharCode(marker);
  if (len < 2) return false;
  let token;
  if (len % 2) {
    token = state.push("text", "", 0);
    token.content = ch;
    len--;
  }
  for (let i = 0; i < len; i += 2) {
    token = state.push("text", "", 0);
    token.content = ch + ch;
    state.delimiters.push({
      marker,
      length: 0,
      token: state.tokens.length - 1,
      end: -1,
      open: scanned.can_open,
      close: scanned.can_close
    });
  }
  state.pos += scanned.length;
  return true;
}
function postProcess(state, delimiters) {
  let token;
  const loneMarkers = [];
  const max = delimiters.length;
  for (let i = 0; i < max; i++) {
    const startDelim = delimiters[i];
    if (startDelim.marker !== 126) continue;
    if (startDelim.end === -1) continue;
    const endDelim = delimiters[startDelim.end];
    token = state.tokens[startDelim.token];
    token.type = "s_open";
    token.tag = "s";
    token.nesting = 1;
    token.markup = "~~";
    token.content = "";
    token = state.tokens[endDelim.token];
    token.type = "s_close";
    token.tag = "s";
    token.nesting = -1;
    token.markup = "~~";
    token.content = "";
    if (state.tokens[endDelim.token - 1].type === "text" && state.tokens[endDelim.token - 1].content === "~") loneMarkers.push(endDelim.token - 1);
  }
  while (loneMarkers.length) {
    const i = loneMarkers.pop();
    let j = i + 1;
    while (j < state.tokens.length && state.tokens[j].type === "s_close") j++;
    j--;
    if (i !== j) {
      token = state.tokens[j];
      state.tokens[j] = state.tokens[i];
      state.tokens[i] = token;
    }
  }
}
function strikethrough_postProcess(state) {
  const tokens_meta = state.tokens_meta;
  const max = state.tokens_meta.length;
  postProcess(state, state.delimiters);
  for (let curr = 0; curr < max; curr++) {
    const delimiters = tokens_meta[curr]?.delimiters;
    if (delimiters) postProcess(state, delimiters);
  }
}
var strikethrough_default = {
  tokenize: strikethrough_tokenize,
  postProcess: strikethrough_postProcess
};
function isTerminatorChar(ch) {
  switch (ch) {
    case 10:
    case 33:
    case 35:
    case 36:
    case 37:
    case 38:
    case 42:
    case 43:
    case 45:
    case 58:
    case 60:
    case 61:
    case 62:
    case 64:
    case 91:
    case 92:
    case 93:
    case 94:
    case 95:
    case 96:
    case 123:
    case 125:
    case 126:
      return true;
    default:
      return false;
  }
}
function text$1(state, silent) {
  let pos = state.pos;
  const src2 = state.src;
  while (pos < state.posMax && !isTerminatorChar(src2.charCodeAt(pos))) pos++;
  if (pos === state.pos) return false;
  if (!silent) state.pending += src2.slice(state.pos, pos);
  state.pos = pos;
  return true;
}
const _rules = [
  ["text", text$1],
  ["linkify", linkify],
  ["newline", newline],
  ["escape", escape],
  ["backticks", backtick],
  ["strikethrough", strikethrough_default.tokenize],
  ["emphasis", emphasis_default.tokenize],
  ["link", link],
  ["image", image],
  ["autolink", autolink],
  ["html_inline", html_inline$1],
  ["entity", entity]
];
const _rules2 = [
  ["balance_pairs", link_pairs],
  ["strikethrough", strikethrough_default.postProcess],
  ["emphasis", emphasis_default.postProcess],
  ["fragments_join", fragments_join]
];
var ParserInline = class {
  /**
  * {@link Ruler} instance. Keep configuration of inline rules.
  */
  ruler;
  /**
  * {@link Ruler} instance. Second ruler used for post-processing
  * (e.g. in emphasis-like rules).
  */
  ruler2;
  constructor() {
    this.ruler = new Ruler();
    for (let i = 0; i < _rules.length; i++) this.ruler.push(_rules[i][0], _rules[i][1]);
    this.ruler2 = new Ruler();
    for (let i = 0; i < _rules2.length; i++) this.ruler2.push(_rules2[i][0], _rules2[i][1]);
  }
  /**
  * Skip single token by running all rules in validation mode;
  * returns `true` if any rule reported success
  */
  skipToken(state) {
    const pos = state.pos;
    const rules = this.ruler.getRules("");
    const len = rules.length;
    const maxNesting = state.md.options.maxNesting;
    const cache2 = state.cache;
    const cachedPos = cache2[pos];
    if (cachedPos !== void 0) {
      state.pos = cachedPos;
      return;
    }
    let ok = false;
    if (state.level < maxNesting) for (let i = 0; i < len; i++) {
      state.level++;
      ok = rules[i](state, true);
      state.level--;
      if (ok) {
        if (pos >= state.pos) throw new Error("inline rule didn't increment state.pos");
        break;
      }
    }
    else state.pos = state.posMax;
    if (!ok) state.pos++;
    cache2[pos] = state.pos;
  }
  /**
  * Generate tokens for input range
  */
  tokenize(state) {
    const rules = this.ruler.getRules("");
    const len = rules.length;
    const end = state.posMax;
    const maxNesting = state.md.options.maxNesting;
    while (state.pos < end) {
      const prevPos = state.pos;
      let ok = false;
      if (state.level < maxNesting) for (let i = 0; i < len; i++) {
        ok = rules[i](state, false);
        if (ok) {
          if (prevPos >= state.pos) throw new Error("inline rule didn't increment state.pos");
          break;
        }
      }
      if (ok) {
        if (state.pos >= end) break;
        continue;
      }
      state.pending += state.src[state.pos++];
    }
    if (state.pending) state.pushPending();
  }
  /**
  * Process input string and push inline tokens into `outTokens`
  */
  parse(str, md, env, outTokens) {
    const state = new this.State(str, md, env, outTokens);
    this.tokenize(state);
    const rules = this.ruler2.getRules("");
    const len = rules.length;
    for (let i = 0; i < len; i++) rules[i](state);
  }
  State = StateInline;
};
const BAD_PROTO_RE = /^(vbscript|javascript|file|data):/;
const GOOD_DATA_RE = /^data:image\/(gif|png|jpeg|webp);/;
function validateLink(url) {
  const str = url.trim().toLowerCase();
  return BAD_PROTO_RE.test(str) ? GOOD_DATA_RE.test(str) : true;
}
const RECODE_HOSTNAME_FOR = [
  "http:",
  "https:",
  "mailto:"
];
function normalizeLink(url) {
  const parsed = urlParse(url, true);
  if (parsed.hostname) {
    if (!parsed.protocol || RECODE_HOSTNAME_FOR.includes(parsed.protocol)) try {
      parsed.hostname = punycode.toASCII(parsed.hostname);
    } catch {
    }
  }
  return encode$1(format(parsed));
}
function normalizeLinkText(url) {
  const parsed = urlParse(url, true);
  if (parsed.hostname) {
    if (!parsed.protocol || RECODE_HOSTNAME_FOR.includes(parsed.protocol)) try {
      parsed.hostname = punycode.toUnicode(parsed.hostname);
    } catch {
    }
  }
  return decode$1(format(parsed), `${decode$1.defaultChars}%`);
}
const defaultOptions = {
  html: false,
  linkify: false,
  typographer: false,
  quotes: "“”‘’",
  maxNesting: 100
};
var Parser$1 = class Parser {
  /**
  * Instance of {@link ParserInline}. You may need it to add new rules when writing plugins.
  */
  inline = new ParserInline();
  /**
  * Instance of {@link ParserBlock}. You may need it to add new rules when writing plugins.
  */
  block = new ParserBlock();
  /**
  * Instance of {@link Core} chain executor. You may need it to add new rules when writing plugins.
  */
  core = new Core();
  /**
  * [linkify-it](https://github.com/markdown-it/linkify-it) instance.
  * Used by [linkify](https://github.com/serkodev/markdown-exit/blob/main/packages/markdown-exit/src/parser/core/rules/linkify.ts)
  * rule.
  */
  linkify = new LinkifyIt();
  /**
  * Link validation function. CommonMark allows too much in links. By default
  * we disable `javascript:`, `vbscript:`, `file:` schemas, and almost all `data:...` schemas
  * except some embedded image types.
  *
  * You can change this behaviour:
  *
  * ```javascript
  * // enable everything
  * md.validateLink = () => true
  * ```
  */
  validateLink = validateLink;
  /**
  * Function used to encode link url to a machine-readable format,
  * which includes url-encoding, punycode, etc.
  */
  normalizeLink = normalizeLink;
  /**
  * Function used to decode link url to a human-readable format`
  */
  normalizeLinkText = normalizeLinkText;
  /**
  * Link components parser functions, useful to write plugins. See details
  * [here](https://github.com/serkodev/markdown-exit/tree/main/packages/markdown-exit/src/parser/helpers).
  */
  helpers = { ...helpers };
  options = { ...defaultOptions };
  /**
  * Parse input string and returns list of block tokens (special token type
  * "inline" will contain list of inline tokens). You should not call this
  * method directly, until you write custom renderer (for example, to produce
  * AST).
  *
  * `env` is used to pass data between "distributed" rules and return additional
  * metadata like reference info, needed for the renderer. It also can be used to
  * inject data in specific cases. Usually, you will be ok to pass `{}`,
  * and then pass updated object to renderer.
  *
  * @param src source string
  * @param env environment sandbox
  */
  parse(src2, env = {}) {
    if (typeof src2 !== "string") throw new TypeError("Input data should be a String");
    const state = new this.core.State(src2, this, env);
    this.core.process(state);
    return state.tokens;
  }
  /**
  * The same as {@link parse} but skip all block rules. It returns the
  * block tokens list with the single `inline` element, containing parsed inline
  * tokens in `children` property. Also updates `env` object.
  *
  * @param src source string
  * @param env environment sandbox
  */
  parseInline(src2, env = {}) {
    const state = new this.core.State(src2, this, env);
    state.inlineMode = true;
    this.core.process(state);
    return state.tokens;
  }
};
const commonmarkPreset = {
  options: {
    html: true,
    xhtmlOut: true,
    breaks: false,
    langPrefix: "language-",
    linkify: false,
    typographer: false,
    quotes: "“”‘’",
    highlight: null,
    maxNesting: 20
  },
  components: {
    core: { rules: [
      "normalize",
      "block",
      "inline",
      "text_join"
    ] },
    block: { rules: [
      "blockquote",
      "code",
      "fence",
      "heading",
      "hr",
      "html_block",
      "lheading",
      "list",
      "reference",
      "paragraph"
    ] },
    inline: {
      rules: [
        "autolink",
        "backticks",
        "emphasis",
        "entity",
        "escape",
        "html_inline",
        "image",
        "link",
        "newline",
        "text"
      ],
      rules2: [
        "balance_pairs",
        "emphasis",
        "fragments_join"
      ]
    }
  }
};
var commonmark_default = commonmarkPreset;
const defaultPreset = {
  options: {
    ...defaultOptions,
    xhtmlOut: false,
    breaks: false,
    langPrefix: "language-",
    highlight: null
  },
  components: {
    core: {},
    block: {},
    inline: {}
  }
};
var default_default = defaultPreset;
const zeroPreset = {
  options: {
    html: false,
    xhtmlOut: false,
    breaks: false,
    langPrefix: "language-",
    linkify: false,
    typographer: false,
    quotes: "“”‘’",
    highlight: null,
    maxNesting: 20
  },
  components: {
    core: { rules: [
      "normalize",
      "block",
      "inline",
      "text_join"
    ] },
    block: { rules: ["paragraph"] },
    inline: {
      rules: ["text"],
      rules2: ["balance_pairs", "fragments_join"]
    }
  }
};
var zero_default = zeroPreset;
const default_rules = {};
default_rules.code_inline = function(tokens, idx, options, env, slf) {
  const token = tokens[idx];
  return `<code${slf.renderAttrs(token)}>${escapeHtml(token.content)}</code>`;
};
default_rules.code_block = function(tokens, idx, options, env, slf) {
  const token = tokens[idx];
  return `<pre${slf.renderAttrs(token)}><code>${escapeHtml(tokens[idx].content)}</code></pre>
`;
};
default_rules.fence = function(tokens, idx, options, env, slf) {
  const token = tokens[idx];
  const info = token.info ? unescapeAll(token.info).trim() : "";
  let langName = "";
  let langAttrs = "";
  if (info) {
    const arr = info.split(/(\s+)/g);
    langName = arr[0];
    langAttrs = arr.slice(2).join("");
  }
  function finalize(highlighted$1) {
    if (highlighted$1.indexOf("<pre") === 0) return `${highlighted$1}
`;
    if (info) {
      const i = token.attrIndex("class");
      const tmpAttrs = token.attrs ? token.attrs.slice() : [];
      if (i < 0) tmpAttrs.push(["class", options.langPrefix + langName]);
      else {
        tmpAttrs[i] = tmpAttrs[i].slice();
        tmpAttrs[i][1] += ` ${options.langPrefix}${langName}`;
      }
      const tmpToken = { attrs: tmpAttrs };
      return `<pre><code${slf.renderAttrs(tmpToken)}>${highlighted$1}</code></pre>
`;
    }
    return `<pre><code${slf.renderAttrs(token)}>${highlighted$1}</code></pre>
`;
  }
  const resolveHighlighted = () => {
    if (!options.highlight) return escapeHtml(token.content);
    const highlighted$1 = options.highlight(token.content, langName, langAttrs, env);
    if (isPromiseLike(highlighted$1)) return highlighted$1.then((v) => v || escapeHtml(token.content));
    return highlighted$1 || escapeHtml(token.content);
  };
  const highlighted = resolveHighlighted();
  return isPromiseLike(highlighted) ? highlighted.then(finalize) : finalize(highlighted);
};
default_rules.image = function(tokens, idx, options, env, slf) {
  const token = tokens[idx];
  token.attrs[token.attrIndex("alt")][1] = slf.renderInlineAsText(token.children, options, env);
  return slf.renderToken(tokens, idx, options);
};
default_rules.hardbreak = function(tokens, idx, options) {
  return options.xhtmlOut ? "<br />\n" : "<br>\n";
};
default_rules.softbreak = function(tokens, idx, options) {
  return options.breaks ? options.xhtmlOut ? "<br />\n" : "<br>\n" : "\n";
};
default_rules.text = function(tokens, idx) {
  return escapeHtml(tokens[idx].content);
};
default_rules.html_block = function(tokens, idx) {
  return tokens[idx].content;
};
default_rules.html_inline = function(tokens, idx) {
  return tokens[idx].content;
};
default_rules.reference = function(tokens, idx) {
  return tokens[idx].content;
};
var Renderer = class {
  /**
  * Contains render rules for tokens. Can be updated and extended.
  *
  * ##### Example
  *
  * ```javascript
  * md.renderer.rules.strong_open = () => '<b>';
  * md.renderer.rules.strong_close = () => '</b>';
  *
  * var result = md.renderInline(...);
  * ```
  *
  * @see https://github.com/serkodev/markdown-exit/tree/main/packages/markdown-exit/src/renderer.ts
  */
  rules = assign({}, default_rules);
  /**
  * Creates new {@link Renderer} instance and fill {@link Renderer#rules} with defaults.
  */
  constructor() {
  }
  /**
  * Render token attributes to string.
  */
  renderAttrs(token) {
    const attrs = token.attrs;
    if (!attrs) return "";
    const len = attrs.length;
    if (len === 0) return "";
    let result = "";
    for (let i = 0; i < len; i++) result += ` ${escapeHtml(attrs[i][0])}="${escapeHtml(attrs[i][1])}"`;
    return result;
  }
  /**
  * Default token renderer. Can be overriden by custom function
  * in {@link Renderer#rules}.
  *
  * @param tokens list of tokens
  * @param idx token index to render
  * @param options params of parser instance
  * @param env additional data from parsed input (references, for example)
  */
  renderToken(tokens, idx, options, env = {}) {
    const token = tokens[idx];
    let result = "";
    if (token.hidden) return "";
    if (token.block && token.nesting !== -1 && idx && tokens[idx - 1].hidden) result += "\n";
    result += (token.nesting === -1 ? "</" : "<") + token.tag;
    result += this.renderAttrs(token);
    if (token.nesting === 0 && options.xhtmlOut) result += " /";
    let needLf = false;
    if (token.block) {
      needLf = true;
      if (token.nesting === 1) {
        if (idx + 1 < tokens.length) {
          const nextToken = tokens[idx + 1];
          if (nextToken.type === "inline" || nextToken.type === "reference" || nextToken.hidden) needLf = false;
          else if (nextToken.nesting === -1 && nextToken.tag === token.tag) needLf = false;
        }
      }
    }
    result += needLf ? ">\n" : ">";
    return result;
  }
  /**
  * The same as {@link Renderer.render}, but for single token of `inline` type.
  *
  * @param tokens list of block tokens to render
  * @param options params of parser instance
  * @param env additional data from parsed input (references, for example)
  */
  renderInline(tokens, options, env = {}) {
    let result = "";
    const rules = this.rules;
    for (let i = 0, len = tokens.length; i < len; i++) {
      const rule = rules[tokens[i].type];
      if (rule) {
        const _result = rule(tokens, i, options, env, this);
        if (isPromiseLike(_result)) throw new Error("Renderer.renderInline: async rule detected, use renderInlineAsync()");
        result += _result;
      } else result += this.renderToken(tokens, i, options, env);
    }
    return result;
  }
  /**
  * Special kludge for image `alt` attributes to conform CommonMark spec.
  * Don't try to use it! Spec requires to show `alt` content with stripped markup,
  * instead of simple escaping.
  *
  * @param tokens list of block tokens to render
  * @param options params of parser instance
  * @param env additional data from parsed input (references, for example)
  */
  renderInlineAsText(tokens, options, env = {}) {
    let result = "";
    for (let i = 0, len = tokens.length; i < len; i++) {
      const token = tokens[i];
      switch (token.type) {
        case "text":
          result += token.content;
          break;
        case "image":
          result += this.renderInlineAsText(token.children, options, env);
          break;
        case "html_inline":
        case "html_block":
          result += token.content;
          break;
        case "softbreak":
        case "hardbreak":
          result += "\n";
          break;
      }
    }
    return result;
  }
  /**
  * Takes token stream and generates HTML. Probably, you will never need to call
  * this method directly.
  *
  * @param tokens list of block tokens to render
  * @param options params of parser instance
  * @param env additional data from parsed input (references, for example)
  */
  render(tokens, options, env = {}) {
    let result = "";
    const rules = this.rules;
    for (let i = 0, len = tokens.length; i < len; i++) {
      const type = tokens[i].type;
      if (type === "inline") result += this.renderInline(tokens[i].children, options, env);
      else {
        const rule = rules[type];
        if (rule) {
          const _result = rule(tokens, i, options, env, this);
          if (isPromiseLike(_result)) throw new Error("Renderer.render: async rule detected, use renderAsync()");
          result += _result;
        } else result += this.renderToken(tokens, i, options, env);
      }
    }
    return result;
  }
  /**
  * Async version of {@link Renderer.renderInline}. Runs all render rules in parallel
  * (Promise.all) and preserves output order.
  */
  async renderInlineAsync(tokens, options, env) {
    const tasks = [];
    const rules = this.rules;
    for (let i = 0, len = tokens.length; i < len; i++) {
      const rule = rules[tokens[i].type];
      if (rule) tasks.push(Promise.resolve(rule(tokens, i, options, env, this)));
      else tasks.push(Promise.resolve(this.renderToken(tokens, i, options, env)));
    }
    return (await Promise.all(tasks)).join("");
  }
  /**
  * Async version of {@link Renderer.render}. Runs all render rules in parallel
  * (Promise.all) and preserves output order.
  */
  async renderAsync(tokens, options, env) {
    const tasks = [];
    const rules = this.rules;
    for (let i = 0, len = tokens.length; i < len; i++) {
      const tok = tokens[i];
      const type = tok.type;
      if (type === "inline") tasks.push(this.renderInlineAsync(tok.children, options, env));
      else {
        const rule = rules[type];
        if (rule) tasks.push(Promise.resolve(rule(tokens, i, options, env, this)));
        else tasks.push(Promise.resolve(this.renderToken(tokens, i, options, env)));
      }
    }
    return (await Promise.all(tasks)).join("");
  }
};
const config = {
  default: default_default,
  zero: zero_default,
  commonmark: commonmark_default
};
var MarkdownExit = class extends Parser$1 {
  /**
  * Instance of {@link Renderer}. Use it to modify output look. Or to add rendering
  * rules for new token types, generated by plugins.
  *
  * ##### Example
  *
  * ```javascript
  * function myToken(tokens, idx, options, env, self) {
  *   //...
  *   return result;
  * };
  *
  * md.renderer.rules['my_token'] = myToken
  * ```
  *
  * See {@link Renderer} docs and [source code](https://github.com/serkodev/markdown-exit/tree/main/packages/markdown-exit/src/renderer.ts).
  */
  renderer = new Renderer();
  /**
  * Assorted utility functions, useful to write plugins. See details
  * [here](https://github.com/serkodev/markdown-exit/tree/main/packages/markdown-exit/src/common/utils.ts).
  */
  utils = utils_exports;
  options = { ...config.default.options };
  constructor(presetNameOrOptions, options) {
    super();
    const [presetName, opts] = typeof presetNameOrOptions === "string" ? [presetNameOrOptions, options] : ["default", presetNameOrOptions];
    this.configure(presetName);
    if (opts) this.set(opts);
  }
  /**
  * chainable*
  *
  * Set parser options (in the same format as in constructor). Probably, you
  * will never need it, but you can change options after constructor call.
  *
  * ##### Example
  *
  * ```javascript
  * md.set({ html: true, breaks: true })
  *   .set({ typographer: true });
  * ```
  *
  * __Note:__ To achieve the best possible performance, don't modify a
  * `markdown-exit` instance options on the fly. If you need multiple configurations
  * it's best to create multiple instances and initialize each with separate
  * config.
  */
  set(options) {
    assign(this.options, options);
    return this;
  }
  /**
  * chainable*, *internal*
  *
  * Batch load of all options and compenent settings. This is internal method,
  * and you probably will not need it. But if you with - see available presets
  * and data structure [here](https://github.com/serkodev/markdown-exit/tree/main/packages/markdown-exit/src/presets)
  *
  * We strongly recommend to use presets instead of direct config loads. That
  * will give better compatibility with next versions.
  */
  configure(presets) {
    if (typeof presets === "string") {
      const presetName = presets;
      presets = config[presetName];
      if (!presets) throw new Error(`Wrong \`markdown-exit\` preset "${presetName}", check name`);
    }
    if (!presets) throw new Error("Wrong `markdown-exit` preset, can't be empty");
    if (presets.options) this.set(presets.options);
    if (presets.components) for (const name of Object.keys(presets.components)) {
      const component = presets.components[name];
      if (component.rules) this[name].ruler.enableOnly(component.rules);
      if (component.rules2) this[name].ruler2?.enableOnly(component.rules2);
    }
    return this;
  }
  /**
  * chainable*
  *
  * Enable list or rules. It will automatically find appropriate components,
  * containing rules with given names. If rule not found, and `ignoreInvalid`
  * not set - throws exception.
  *
  * ##### Example
  *
  * ```javascript
  * md.enable(['sub', 'sup'])
  *   .disable('smartquotes');
  * ```
  *
  * @param list rule name or list of rule names to enable
  * @param ignoreInvalid set `true` to ignore errors when rule not found.
  */
  enable(list$1, ignoreInvalid) {
    let result = [];
    if (!Array.isArray(list$1)) list$1 = [list$1];
    for (const chain of [
      "core",
      "block",
      "inline"
    ]) result = result.concat(this[chain].ruler.enable(list$1, true));
    result = result.concat(this.inline.ruler2.enable(list$1, true));
    const missed = list$1.filter((name) => !result.includes(name));
    if (missed.length && !ignoreInvalid) throw new Error(`MarkdownExit. Failed to enable unknown rule(s): ${missed}`);
    return this;
  }
  /**
  * chainable*
  *
  * The same as {@link MarkdownExit.enable}, but turn specified rules off.
  *
  * @param list rule name or list of rule names to disable.
  * @param ignoreInvalid set `true` to ignore errors when rule not found.
  */
  disable(list$1, ignoreInvalid) {
    let result = [];
    if (!Array.isArray(list$1)) list$1 = [list$1];
    for (const chain of [
      "core",
      "block",
      "inline"
    ]) result = result.concat(this[chain].ruler.disable(list$1, true));
    result = result.concat(this.inline.ruler2.disable(list$1, true));
    const missed = list$1.filter((name) => !result.includes(name));
    if (missed.length && !ignoreInvalid) throw new Error(`MarkdownExit. Failed to disable unknown rule(s): ${missed}`);
    return this;
  }
  use(plugin, ...params2) {
    plugin.apply(plugin, [this, ...params2]);
    return this;
  }
  /**
  * Render markdown string into html. It does all magic for you :).
  *
  * `env` can be used to inject additional metadata (`{}` by default).
  * But you will not need it with high probability. See also comment
  * in {@link MarkdownExit.parse}.
  *
  * @param src source string
  * @param env environment sandbox
  */
  render(src2, env = {}) {
    return this.renderer.render(this.parse(src2, env), this.options, env);
  }
  /**
  * Async version of {@link MarkdownExit.render}. Runs all render rules in parallel
  * (Promise.all) and preserves output order.
  */
  renderAsync(src2, env = {}) {
    return this.renderer.renderAsync(this.parse(src2, env), this.options, env);
  }
  /**
  * Similar to {@link MarkdownExit.render} but for single paragraph content. Result
  * will NOT be wrapped into `<p>` tags.
  *
  * @param src source string
  * @param env environment sandbox
  */
  renderInline(src2, env = {}) {
    return this.renderer.render(this.parseInline(src2, env), this.options, env);
  }
  /**
  * Async version of {@link MarkdownExit.renderInline}. Runs all render rules in parallel
  * (Promise.all) and preserves output order.
  */
  renderInlineAsync(src2, env = {}) {
    return this.renderer.renderAsync(this.parseInline(src2, env), this.options, env);
  }
};
function createCallableClass(Class) {
  function callable(...args) {
    return new Class(...args);
  }
  Object.setPrototypeOf(callable, MarkdownExit);
  callable.prototype = MarkdownExit.prototype;
  callable.prototype.constructor = callable;
  return callable;
}
const MarkdownExitConstructor = createCallableClass(MarkdownExit);
var src_default = MarkdownExitConstructor;
function dedupePlugins(defaultPlugins, userPlugins) {
  const plugins = /* @__PURE__ */ new Map();
  for (const plugin of defaultPlugins) {
    plugins.set(plugin.name, plugin);
  }
  const seenUserPlugins = /* @__PURE__ */ new Set();
  for (const plugin of userPlugins) {
    if (seenUserPlugins.has(plugin.name))
      continue;
    seenUserPlugins.add(plugin.name);
    plugins.delete(plugin.name);
    plugins.set(plugin.name, plugin);
  }
  return [...plugins.values()];
}
function defineComarkPlugin(fn) {
  return fn;
}
function findClosingBracket(str, openIndex) {
  if (str[openIndex] !== "[")
    return -1;
  let index2 = openIndex + 1;
  let depth = 0;
  while (index2 < str.length) {
    if (str[index2] === "\\" && index2 + 1 < str.length) {
      index2 += 2;
      continue;
    }
    if (str[index2] === "[") {
      depth++;
    } else if (str[index2] === "]") {
      if (depth === 0)
        return index2;
      depth--;
    }
    index2 += 1;
  }
  return -1;
}
function parseBracketContent(str, startIndex) {
  const close = findClosingBracket(str, startIndex);
  if (close === -1)
    return null;
  return { content: str.slice(startIndex + 1, close), endIndex: close + 1 };
}
var NOT_RESOLVED = /* @__PURE__ */ Symbol("NOT_RESOLVED");
function defineScalarTag(tagName, options) {
  return {
    tagName,
    nodeKind: "scalar",
    implicit: options.implicit ?? false,
    matchByTagPrefix: options.matchByTagPrefix ?? false,
    implicitFirstChars: options.implicitFirstChars ?? null,
    resolve: options.resolve,
    identify: options.identify,
    represent: options.represent ?? ((data) => String(data)),
    representTagName: options.representTagName ?? (() => tagName)
  };
}
function defineSequenceTag(tagName, options) {
  const carrierIsResult = options.finalize === void 0;
  return {
    tagName,
    nodeKind: "sequence",
    implicit: false,
    matchByTagPrefix: options.matchByTagPrefix ?? false,
    create: options.create,
    addItem: options.addItem,
    finalize: options.finalize ?? ((carrier) => carrier),
    carrierIsResult,
    identify: options.identify,
    represent: options.represent ?? ((data) => data),
    representTagName: options.representTagName ?? (() => tagName)
  };
}
function defineMappingTag(tagName, options) {
  const carrierIsResult = options.finalize === void 0;
  return {
    tagName,
    nodeKind: "mapping",
    implicit: false,
    matchByTagPrefix: options.matchByTagPrefix ?? false,
    create: options.create,
    addPair: options.addPair,
    has: options.has,
    keys: options.keys,
    get: options.get,
    finalize: options.finalize ?? ((carrier) => carrier),
    carrierIsResult,
    identify: options.identify,
    represent: options.represent ?? ((data) => data),
    representTagName: options.representTagName ?? (() => tagName)
  };
}
var strTag = defineScalarTag("tag:yaml.org,2002:str", {
  resolve: (source) => source,
  identify: (data) => typeof data === "string"
});
var NULL_VALUES$1 = [
  "",
  "~",
  "null",
  "Null",
  "NULL"
];
var nullCoreTag = defineScalarTag("tag:yaml.org,2002:null", {
  implicit: true,
  implicitFirstChars: [
    "",
    "~",
    "n",
    "N"
  ],
  resolve: (source) => {
    if (NULL_VALUES$1.indexOf(source) !== -1) return null;
    return NOT_RESOLVED;
  },
  identify: (object2) => object2 === null,
  represent: () => "null"
});
var nullJsonTag = defineScalarTag("tag:yaml.org,2002:null", {
  implicit: true,
  implicitFirstChars: ["n"],
  resolve: (source, isExplicit) => {
    if (source === "null" || isExplicit && source === "") return null;
    return NOT_RESOLVED;
  },
  identify: (object2) => object2 === null,
  represent: () => "null"
});
var NULL_VALUES = [
  "",
  "~",
  "null",
  "Null",
  "NULL"
];
var nullYaml11Tag = defineScalarTag("tag:yaml.org,2002:null", {
  implicit: true,
  implicitFirstChars: [
    "",
    "~",
    "n",
    "N"
  ],
  resolve: (source) => {
    if (NULL_VALUES.indexOf(source) !== -1) return null;
    return NOT_RESOLVED;
  },
  identify: (object2) => object2 === null,
  represent: () => "null"
});
var TRUE_VALUES$2 = [
  "true",
  "True",
  "TRUE"
];
var FALSE_VALUES$2 = [
  "false",
  "False",
  "FALSE"
];
var boolCoreTag = defineScalarTag("tag:yaml.org,2002:bool", {
  implicit: true,
  implicitFirstChars: [
    "t",
    "T",
    "f",
    "F"
  ],
  resolve: (source) => {
    if (TRUE_VALUES$2.indexOf(source) !== -1) return true;
    if (FALSE_VALUES$2.indexOf(source) !== -1) return false;
    return NOT_RESOLVED;
  },
  identify: (object2) => Object.prototype.toString.call(object2) === "[object Boolean]",
  represent: (object2) => object2 ? "true" : "false"
});
var TRUE_VALUES$1 = ["true"];
var FALSE_VALUES$1 = ["false"];
var boolJsonTag = defineScalarTag("tag:yaml.org,2002:bool", {
  implicit: true,
  implicitFirstChars: ["t", "f"],
  resolve: (source) => {
    if (TRUE_VALUES$1.indexOf(source) !== -1) return true;
    if (FALSE_VALUES$1.indexOf(source) !== -1) return false;
    return NOT_RESOLVED;
  },
  identify: (object2) => Object.prototype.toString.call(object2) === "[object Boolean]",
  represent: (object2) => object2 ? "true" : "false"
});
var TRUE_VALUES = [
  "true",
  "True",
  "TRUE",
  "y",
  "Y",
  "yes",
  "Yes",
  "YES",
  "on",
  "On",
  "ON"
];
var FALSE_VALUES = [
  "false",
  "False",
  "FALSE",
  "n",
  "N",
  "no",
  "No",
  "NO",
  "off",
  "Off",
  "OFF"
];
var boolYaml11Tag = defineScalarTag("tag:yaml.org,2002:bool", {
  implicit: true,
  implicitFirstChars: [
    "y",
    "Y",
    "n",
    "N",
    "t",
    "T",
    "f",
    "F",
    "o",
    "O"
  ],
  resolve: (source) => {
    if (TRUE_VALUES.indexOf(source) !== -1) return true;
    if (FALSE_VALUES.indexOf(source) !== -1) return false;
    return NOT_RESOLVED;
  },
  identify: (object2) => Object.prototype.toString.call(object2) === "[object Boolean]",
  represent: (object2) => object2 ? "true" : "false"
});
var YAML_INTEGER_IMPLICIT_PATTERN$1 = /* @__PURE__ */ new RegExp("^(?:0o[0-7]+|0x[0-9a-fA-F]+|[-+]?[0-9]+)$");
var YAML_INTEGER_EXPLICIT_PATTERN$1 = /* @__PURE__ */ new RegExp("^(?:[-+]?0b[0-1]+|[-+]?0o[0-7]+|[-+]?0x[0-9a-fA-F]+|[-+]?[0-9]+)$");
function parseYamlInteger$2(source) {
  let value = source;
  let sign = 1;
  if (value[0] === "-" || value[0] === "+") {
    if (value[0] === "-") sign = -1;
    value = value.slice(1);
  }
  if (value.startsWith("0b")) return sign * parseInt(value.slice(2), 2);
  if (value.startsWith("0o")) return sign * parseInt(value.slice(2), 8);
  if (value.startsWith("0x")) return sign * parseInt(value.slice(2), 16);
  return sign * parseInt(value, 10);
}
function resolveYamlInteger$2(source, isExplicit) {
  if (isExplicit) {
    if (!YAML_INTEGER_EXPLICIT_PATTERN$1.test(source)) return NOT_RESOLVED;
  } else if (!YAML_INTEGER_IMPLICIT_PATTERN$1.test(source)) return NOT_RESOLVED;
  const result = parseYamlInteger$2(source);
  return Number.isFinite(result) ? result : NOT_RESOLVED;
}
var intCoreTag = defineScalarTag("tag:yaml.org,2002:int", {
  implicit: true,
  implicitFirstChars: [
    "-",
    "+",
    ..."0123456789"
  ],
  resolve: resolveYamlInteger$2,
  identify: (object2) => Number.isInteger(object2) && !Object.is(object2, -0) && object2.toString(10).indexOf("e") < 0,
  represent: (object2) => object2.toString(10)
});
var YAML_INTEGER_IMPLICIT_PATTERN = /* @__PURE__ */ new RegExp("^-?(?:0|[1-9][0-9]*)$");
var YAML_INTEGER_EXPLICIT_PATTERN = /* @__PURE__ */ new RegExp("^(?:[-+]?0b[0-1]+|[-+]?0o[0-7]+|[-+]?0x[0-9a-fA-F]+|[-+]?[0-9]+)$");
function parseYamlInteger$1(source) {
  let value = source;
  let sign = 1;
  if (value[0] === "-" || value[0] === "+") {
    if (value[0] === "-") sign = -1;
    value = value.slice(1);
  }
  if (value.startsWith("0b")) return sign * parseInt(value.slice(2), 2);
  if (value.startsWith("0o")) return sign * parseInt(value.slice(2), 8);
  if (value.startsWith("0x")) return sign * parseInt(value.slice(2), 16);
  return sign * parseInt(value, 10);
}
function resolveYamlInteger$1(source, isExplicit) {
  if (isExplicit) {
    if (!YAML_INTEGER_EXPLICIT_PATTERN.test(source)) return NOT_RESOLVED;
  } else if (!YAML_INTEGER_IMPLICIT_PATTERN.test(source)) return NOT_RESOLVED;
  const result = parseYamlInteger$1(source);
  return Number.isFinite(result) ? result : NOT_RESOLVED;
}
var intJsonTag = defineScalarTag("tag:yaml.org,2002:int", {
  implicit: true,
  implicitFirstChars: ["-", ..."0123456789"],
  resolve: resolveYamlInteger$1,
  identify: (object2) => Number.isInteger(object2) && !Object.is(object2, -0) && object2.toString(10).indexOf("e") < 0,
  represent: (object2) => object2.toString(10)
});
var YAML_INTEGER_PATTERN = /* @__PURE__ */ new RegExp("^(?:[-+]?0b[0-1_]+|[-+]?0[0-7_]+|[-+]?0x[0-9a-fA-F_]+|[-+]?[0-9][0-9_]*(?::[0-5]?[0-9])+|[-+]?(?:0|[1-9][0-9_]*))$");
function parseYamlInteger(source) {
  let value = source.replace(/_/g, "");
  let sign = 1;
  if (value[0] === "-" || value[0] === "+") {
    if (value[0] === "-") sign = -1;
    value = value.slice(1);
  }
  if (value.startsWith("0b")) return sign * parseInt(value.slice(2), 2);
  if (value.startsWith("0x")) return sign * parseInt(value.slice(2), 16);
  if (value.includes(":")) {
    let result = 0;
    for (const part of value.split(":")) result = result * 60 + Number(part);
    return sign * result;
  }
  if (value !== "0" && value[0] === "0") return sign * parseInt(value, 8);
  return sign * parseInt(value, 10);
}
function resolveYamlInteger(source) {
  if (!YAML_INTEGER_PATTERN.test(source)) return NOT_RESOLVED;
  const result = parseYamlInteger(source);
  return Number.isFinite(result) ? result : NOT_RESOLVED;
}
var intYaml11Tag = defineScalarTag("tag:yaml.org,2002:int", {
  implicit: true,
  implicitFirstChars: [
    "-",
    "+",
    ..."0123456789"
  ],
  resolve: resolveYamlInteger,
  identify: (object2) => Number.isInteger(object2) && !Object.is(object2, -0) && object2.toString(10).indexOf("e") < 0,
  represent: (object2) => object2.toString(10)
});
var YAML_FLOAT_PATTERN$1 = /* @__PURE__ */ new RegExp("^(?:[-+]?[0-9]+(?:\\.[0-9]*)?(?:[eE][-+]?[0-9]+)?|[-+]?\\.[0-9]+(?:[eE][-+]?[0-9]+)?|[-+]?\\.(?:inf|Inf|INF)|\\.(?:nan|NaN|NAN))$");
var YAML_FLOAT_SPECIAL_PATTERN$1 = /* @__PURE__ */ new RegExp("^(?:[-+]?\\.(?:inf|Inf|INF)|\\.(?:nan|NaN|NAN))$");
function resolveYamlFloat$2(source) {
  if (!YAML_FLOAT_PATTERN$1.test(source)) return NOT_RESOLVED;
  let value = source.toLowerCase();
  const sign = value[0] === "-" ? -1 : 1;
  if ("+-".includes(value[0])) value = value.slice(1);
  if (value === ".inf") return sign === 1 ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY;
  if (value === ".nan") return NaN;
  const result = sign * parseFloat(value);
  if (Number.isFinite(result) || YAML_FLOAT_SPECIAL_PATTERN$1.test(source)) return result;
  return NOT_RESOLVED;
}
function representYamlFloat$2(object2) {
  if (isNaN(object2)) return ".nan";
  if (object2 === Number.POSITIVE_INFINITY) return ".inf";
  if (object2 === Number.NEGATIVE_INFINITY) return "-.inf";
  if (Object.is(object2, -0)) return "-0.0";
  const result = object2.toString(10);
  return /^[-+]?[0-9]+e/.test(result) ? result.replace("e", ".e") : result;
}
var floatCoreTag = defineScalarTag("tag:yaml.org,2002:float", {
  implicit: true,
  implicitFirstChars: [
    "-",
    "+",
    ".",
    ..."0123456789"
  ],
  resolve: resolveYamlFloat$2,
  identify: (object2) => typeof object2 === "number" && (!Number.isInteger(object2) || Object.is(object2, -0) || object2.toString(10).indexOf("e") >= 0),
  represent: representYamlFloat$2
});
var YAML_FLOAT_IMPLICIT_PATTERN = /* @__PURE__ */ new RegExp("^-?(?:0|[1-9][0-9]*)(?:\\.[0-9]*)?(?:[eE][-+]?[0-9]+)?$");
var YAML_FLOAT_EXPLICIT_PATTERN = /* @__PURE__ */ new RegExp("^(?:[-+]?[0-9]+(?:\\.[0-9]*)?(?:[eE][-+]?[0-9]+)?|[-+]?\\.[0-9]+(?:[eE][-+]?[0-9]+)?|[-+]?\\.(?:inf|Inf|INF)|\\.(?:nan|NaN|NAN))$");
function resolveYamlFloat$1(source, isExplicit) {
  if (isExplicit) {
    if (!YAML_FLOAT_EXPLICIT_PATTERN.test(source)) return NOT_RESOLVED;
    let value = source.toLowerCase();
    const sign = value[0] === "-" ? -1 : 1;
    if ("+-".includes(value[0])) value = value.slice(1);
    if (value === ".inf") return sign === 1 ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY;
    if (value === ".nan") return NaN;
    const result2 = sign * parseFloat(value);
    return Number.isFinite(result2) ? result2 : NOT_RESOLVED;
  }
  if (!YAML_FLOAT_IMPLICIT_PATTERN.test(source)) return NOT_RESOLVED;
  const result = Number(source);
  if (Number.isFinite(result)) return result;
  return NOT_RESOLVED;
}
function representYamlFloat$1(object2) {
  if (isNaN(object2)) return ".nan";
  if (object2 === Number.POSITIVE_INFINITY) return ".inf";
  if (object2 === Number.NEGATIVE_INFINITY) return "-.inf";
  if (Object.is(object2, -0)) return "-0.0";
  const result = object2.toString(10);
  return /^[-+]?[0-9]+e/.test(result) ? result.replace("e", ".e") : result;
}
var floatJsonTag = defineScalarTag("tag:yaml.org,2002:float", {
  implicit: true,
  implicitFirstChars: ["-", ..."0123456789"],
  resolve: resolveYamlFloat$1,
  identify: (object2) => typeof object2 === "number" && (!Number.isInteger(object2) || Object.is(object2, -0) || object2.toString(10).indexOf("e") >= 0),
  represent: representYamlFloat$1
});
var YAML_FLOAT_PATTERN = /* @__PURE__ */ new RegExp("^(?:[-+]?(?:(?:[0-9][0-9_]*)?\\.[0-9_]*)(?:[eE][-+][0-9]+)?|[-+]?[0-9][0-9_]*(?::[0-5]?[0-9])+\\.[0-9_]*|[-+]?\\.(?:inf|Inf|INF)|\\.(?:nan|NaN|NAN))$");
var YAML_FLOAT_SPECIAL_PATTERN = /* @__PURE__ */ new RegExp("^(?:[-+]?\\.(?:inf|Inf|INF)|\\.(?:nan|NaN|NAN))$");
function resolveYamlFloat(source) {
  if (!YAML_FLOAT_PATTERN.test(source)) return NOT_RESOLVED;
  let value = source.toLowerCase().replace(/_/g, "");
  const sign = value[0] === "-" ? -1 : 1;
  if ("+-".includes(value[0])) value = value.slice(1);
  if (value === ".inf") return sign === 1 ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY;
  if (value === ".nan") return NaN;
  let result = 0;
  if (value.includes(":")) {
    for (const part of value.split(":")) result = result * 60 + Number(part);
    result *= sign;
  } else result = sign * parseFloat(value);
  if (Number.isFinite(result) || YAML_FLOAT_SPECIAL_PATTERN.test(source)) return result;
  return NOT_RESOLVED;
}
function representYamlFloat(object2) {
  if (isNaN(object2)) return ".nan";
  if (object2 === Number.POSITIVE_INFINITY) return ".inf";
  if (object2 === Number.NEGATIVE_INFINITY) return "-.inf";
  if (Object.is(object2, -0)) return "-0.0";
  const result = object2.toString(10);
  return /^[-+]?[0-9]+e/.test(result) ? result.replace("e", ".e") : result;
}
var floatYaml11Tag = defineScalarTag("tag:yaml.org,2002:float", {
  implicit: true,
  implicitFirstChars: [
    "-",
    "+",
    ".",
    ..."0123456789"
  ],
  resolve: resolveYamlFloat,
  identify: (object2) => typeof object2 === "number" && (!Number.isInteger(object2) || Object.is(object2, -0) || object2.toString(10).indexOf("e") >= 0),
  represent: representYamlFloat
});
var mergeTag = defineScalarTag("tag:yaml.org,2002:merge", {
  implicit: true,
  implicitFirstChars: ["<"],
  resolve: (source, isExplicit) => {
    if (source === "<<" || isExplicit && source === "") return "<<";
    return NOT_RESOLVED;
  },
  identify: () => false
});
var BASE64_PATTERN = /^[A-Za-z0-9+/]*={0,2}$/;
function resolveYamlBinary(source) {
  const input = source.replace(/\s/g, "");
  if (input.length % 4 !== 0 || !BASE64_PATTERN.test(input)) return NOT_RESOLVED;
  const binary = atob(input);
  const result = new Uint8Array(binary.length);
  for (let index2 = 0; index2 < binary.length; index2++) result[index2] = binary.charCodeAt(index2);
  return result;
}
function representYamlBinary(object2) {
  let binary = "";
  for (let index2 = 0; index2 < object2.length; index2++) binary += String.fromCharCode(object2[index2]);
  return btoa(binary);
}
var binaryTag = defineScalarTag("tag:yaml.org,2002:binary", {
  resolve: resolveYamlBinary,
  identify: (object2) => Object.prototype.toString.call(object2) === "[object Uint8Array]",
  represent: representYamlBinary
});
var YAML_DATE_REGEXP = /* @__PURE__ */ new RegExp("^([0-9][0-9][0-9][0-9])-([0-9][0-9])-([0-9][0-9])$");
var YAML_TIMESTAMP_REGEXP = /* @__PURE__ */ new RegExp("^([0-9][0-9][0-9][0-9])-([0-9][0-9]?)-([0-9][0-9]?)(?:[Tt]|[ \\t]+)([0-9][0-9]?):([0-9][0-9]):([0-9][0-9])(?:\\.([0-9]*))?(?:[ \\t]*(Z|([-+])([0-9][0-9]?)(?::([0-9][0-9]))?))?$");
function makeUtcDate(year, month, day, hour = 0, minute = 0, second = 0, fraction = 0) {
  const date = new Date(Date.UTC(year, month, day, hour, minute, second, fraction));
  date.setUTCFullYear(year, month, day);
  return date;
}
function resolveYamlTimestamp(source) {
  let match2 = YAML_DATE_REGEXP.exec(source);
  if (match2 === null) match2 = YAML_TIMESTAMP_REGEXP.exec(source);
  if (match2 === null) return NOT_RESOLVED;
  const year = +match2[1];
  const month = +match2[2] - 1;
  const day = +match2[3];
  if (!match2[4]) {
    const date2 = makeUtcDate(year, month, day);
    if (date2.getUTCFullYear() !== year || date2.getUTCMonth() !== month || date2.getUTCDate() !== day) return NOT_RESOLVED;
    return date2;
  }
  const hour = +match2[4];
  const minute = +match2[5];
  const second = +match2[6];
  let fraction = 0;
  if (hour > 23 || minute > 59 || second > 59) return NOT_RESOLVED;
  if (match2[7]) {
    let value = match2[7].slice(0, 3);
    while (value.length < 3) value += "0";
    fraction = +value;
  }
  const date = makeUtcDate(year, month, day, hour, minute, second, fraction);
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month || date.getUTCDate() !== day) return NOT_RESOLVED;
  if (match2[9]) {
    const offsetHour = +match2[10];
    const offsetMinute = +(match2[11] || 0);
    if (offsetHour > 23 || offsetMinute > 59) return NOT_RESOLVED;
    const offset = (offsetHour * 60 + offsetMinute) * 6e4;
    date.setTime(date.getTime() - (match2[9] === "-" ? -offset : offset));
  }
  return date;
}
var timestampTag = defineScalarTag("tag:yaml.org,2002:timestamp", {
  implicit: true,
  implicitFirstChars: [..."0123456789"],
  resolve: resolveYamlTimestamp,
  identify: (object2) => object2 instanceof Date,
  represent: (object2) => object2.toISOString()
});
var seqTag = defineSequenceTag("tag:yaml.org,2002:seq", {
  create: () => [],
  addItem: (container, item) => {
    container.push(item);
  },
  identify: Array.isArray
});
function isPlainObject(data) {
  if (data === null || typeof data !== "object" || Array.isArray(data)) return false;
  const prototype = Object.getPrototypeOf(data);
  return prototype === null || prototype === Object.prototype;
}
function pick(object2, keys) {
  const result = {};
  for (const key of keys) if (object2[key] !== void 0) result[key] = object2[key];
  return result;
}
var omapTag = defineSequenceTag("tag:yaml.org,2002:omap", {
  create: () => ({
    list: [],
    seen: /* @__PURE__ */ new Set()
  }),
  addItem: (carrier, item) => {
    let key;
    if (item instanceof Map) {
      if (item.size !== 1) return "cannot resolve an ordered map item";
      key = item.keys().next().value;
    } else if (isPlainObject(item)) {
      const itemKeys = Object.keys(item);
      if (itemKeys.length !== 1) return "cannot resolve an ordered map item";
      key = itemKeys[0];
    } else return "cannot resolve an ordered map item";
    if (carrier.seen.has(key)) return "duplicate key in ordered map";
    carrier.seen.add(key);
    carrier.list.push(item);
    return "";
  },
  finalize: (carrier) => carrier.list,
  identify: () => false
});
var pairsTag = defineSequenceTag("tag:yaml.org,2002:pairs", {
  create: () => [],
  addItem: (container, item) => {
    if (item instanceof Map) {
      if (item.size !== 1) return "cannot resolve a pairs item";
      container.push(item.entries().next().value);
      return "";
    }
    if (Object.prototype.toString.call(item) !== "[object Object]") return "cannot resolve a pairs item";
    const object2 = item;
    const keys = Object.keys(object2);
    if (keys.length !== 1) return "cannot resolve a pairs item";
    container.push([keys[0], object2[keys[0]]]);
    return "";
  },
  identify: () => false
});
var mapTag = defineMappingTag("tag:yaml.org,2002:map", {
  create: () => ({}),
  identify: isPlainObject,
  represent: (o) => {
    const map2 = /* @__PURE__ */ new Map();
    for (const key of Object.keys(o)) map2.set(key, o[key]);
    return map2;
  },
  addPair: (container, key, value) => {
    if (key !== null && typeof key === "object") return "object-based map does not support complex keys";
    const normalizedKey = String(key);
    if (normalizedKey === "__proto__") Object.defineProperty(container, normalizedKey, {
      value,
      enumerable: true,
      configurable: true,
      writable: true
    });
    else container[normalizedKey] = value;
    return "";
  },
  has: (container, key) => {
    if (key !== null && typeof key === "object") return false;
    return Object.prototype.hasOwnProperty.call(container, String(key));
  },
  keys: (container) => Object.keys(container),
  get: (container, key) => {
    const normalizedKey = String(key);
    if (!Object.prototype.hasOwnProperty.call(container, normalizedKey)) return null;
    return container[normalizedKey];
  }
});
var setTag = defineMappingTag("tag:yaml.org,2002:set", {
  create: () => /* @__PURE__ */ new Set(),
  identify: (data) => data instanceof Set,
  represent: (data) => {
    const map2 = /* @__PURE__ */ new Map();
    for (const key of data) map2.set(key, null);
    return map2;
  },
  addPair: (container, key, value) => {
    if (value !== null) return "cannot resolve a set item";
    container.add(key);
    return "";
  },
  has: (container, key) => container.has(key),
  keys: (container) => container.keys(),
  get: () => null
});
function createTagDefinitionMap() {
  return {
    scalar: /* @__PURE__ */ Object.create(null),
    sequence: /* @__PURE__ */ Object.create(null),
    mapping: /* @__PURE__ */ Object.create(null)
  };
}
function createTagDefinitionListMap() {
  return {
    scalar: [],
    sequence: [],
    mapping: []
  };
}
function compileTags(tags2) {
  const result = [];
  for (const tag of tags2) {
    let index2 = result.length;
    for (let previousIndex = 0; previousIndex < result.length; previousIndex++) {
      const previous = result[previousIndex];
      if (previous.nodeKind === tag.nodeKind && previous.tagName === tag.tagName && previous.matchByTagPrefix === tag.matchByTagPrefix) {
        index2 = previousIndex;
        break;
      }
    }
    result[index2] = tag;
  }
  return result;
}
var Schema2 = class Schema3 {
  tags;
  /** @internal */
  implicitScalarTags;
  /**
  * Dispatch implicit scalar resolvers by `source.charAt(0)`. Each bucket holds
  * the resolvers that may match that key, in schema order; a key absent from
  * the map uses
  * {@link Schema.implicitScalarAnyFirstChar}
  * (resolvers that declared no first-char constraint, so they apply to any
  * first character).
  */
  implicitScalarByFirstChar;
  implicitScalarAnyFirstChar;
  /**
  * The default scalar tag (`!!str`), resolved once so the composer's fallback
  * for unresolved plain scalars avoids a keyed lookup per scalar.
  *
  * @internal
  */
  defaultScalarTag;
  /**
  * The default container tags (`!!seq` / `!!map`), used by the dumper: when a
  * value is identified by its default tag, the tag is implicit and not
  * printed. Undefined if the schema does not define them (then such values
  * can't be dumped).
  *
  * @internal
  */
  defaultSequenceTag;
  /** @internal */
  defaultMappingTag;
  exact;
  prefix;
  constructor(tags2) {
    const compiledTags = compileTags(tags2);
    const implicitScalarTags = [];
    const exact = createTagDefinitionMap();
    const prefix = createTagDefinitionListMap();
    for (const tag of compiledTags) {
      if (tag.nodeKind === "scalar" && tag.implicit) {
        if (tag.matchByTagPrefix) throw new Error("Implicit scalar tags cannot match by tag prefix");
        implicitScalarTags.push(tag);
      }
      switch (tag.nodeKind) {
        case "scalar":
          if (tag.matchByTagPrefix) prefix.scalar.push(tag);
          else exact.scalar[tag.tagName] = tag;
          break;
        case "sequence":
          if (tag.matchByTagPrefix) prefix.sequence.push(tag);
          else exact.sequence[tag.tagName] = tag;
          break;
        case "mapping":
          if (tag.matchByTagPrefix) prefix.mapping.push(tag);
          else exact.mapping[tag.tagName] = tag;
          break;
      }
    }
    const implicitScalarAnyFirstChar = implicitScalarTags.filter((tag) => tag.implicitFirstChars === null);
    const keys = /* @__PURE__ */ new Set();
    for (const tag of implicitScalarTags) if (tag.implicitFirstChars !== null) for (const key of tag.implicitFirstChars) keys.add(key);
    const implicitScalarByFirstChar = /* @__PURE__ */ new Map();
    for (const key of keys) implicitScalarByFirstChar.set(key, implicitScalarTags.filter((tag) => tag.implicitFirstChars === null || tag.implicitFirstChars.indexOf(key) !== -1));
    const defaultScalarTag = exact.scalar["tag:yaml.org,2002:str"];
    if (!defaultScalarTag) throw new Error("schema does not define the default scalar tag (tag:yaml.org,2002:str)");
    this.tags = compiledTags;
    this.implicitScalarTags = implicitScalarTags;
    this.implicitScalarByFirstChar = implicitScalarByFirstChar;
    this.implicitScalarAnyFirstChar = implicitScalarAnyFirstChar;
    this.defaultScalarTag = defaultScalarTag;
    this.defaultSequenceTag = exact.sequence["tag:yaml.org,2002:seq"];
    this.defaultMappingTag = exact.mapping["tag:yaml.org,2002:map"];
    this.exact = exact;
    this.prefix = prefix;
  }
  /** @internal */
  lookupScalarTag(tagName) {
    const exactTag = this.exact.scalar[tagName];
    if (exactTag) return exactTag;
    for (const tag of this.prefix.scalar) if (tagName.startsWith(tag.tagName)) return tag;
  }
  /** @internal */
  lookupSequenceTag(tagName) {
    const exactTag = this.exact.sequence[tagName];
    if (exactTag) return exactTag;
    for (const tag of this.prefix.sequence) if (tagName.startsWith(tag.tagName)) return tag;
  }
  /** @internal */
  lookupMappingTag(tagName) {
    const exactTag = this.exact.mapping[tagName];
    if (exactTag) return exactTag;
    for (const tag of this.prefix.mapping) if (tagName.startsWith(tag.tagName)) return tag;
  }
  /** @internal */
  resolveImplicitScalarTag(source) {
    const candidates = this.implicitScalarByFirstChar.get(source.charAt(0)) ?? this.implicitScalarAnyFirstChar;
    for (const tag2 of candidates) {
      const value = tag2.resolve(source, false, tag2.tagName);
      if (value !== NOT_RESOLVED) return {
        value,
        tag: tag2
      };
    }
    const tag = this.defaultScalarTag;
    return {
      value: tag.resolve(source, false, tag.tagName),
      tag
    };
  }
  /**
  * Creates a new schema with the specified tags added. If a tag already
  * exists, it is replaced by the specified tag.
  *
  * @example
  *
  * ```javascript
  * import { CORE_SCHEMA, mergeTag, realMapTag } from 'js-yaml'
  *
  * const schema = CORE_SCHEMA.withTags(mergeTag, realMapTag)
  * ```
  */
  withTags(...tags2) {
    let flatTags = [];
    for (const tag of tags2) flatTags = flatTags.concat(tag);
    return new Schema3([...this.tags, ...flatTags]);
  }
};
var FAILSAFE_SCHEMA = new Schema2([
  strTag,
  seqTag,
  mapTag
]);
var JSON_SCHEMA = new Schema2([
  ...FAILSAFE_SCHEMA.tags,
  nullJsonTag,
  boolJsonTag,
  intJsonTag,
  floatJsonTag
]);
var CORE_SCHEMA = new Schema2([
  ...FAILSAFE_SCHEMA.tags,
  nullCoreTag,
  boolCoreTag,
  intCoreTag,
  floatCoreTag
]);
var YAML11_SCHEMA = new Schema2([
  ...FAILSAFE_SCHEMA.tags,
  nullYaml11Tag,
  boolYaml11Tag,
  intYaml11Tag,
  floatYaml11Tag,
  timestampTag,
  mergeTag,
  binaryTag,
  omapTag,
  pairsTag,
  setTag
]);
YAML11_SCHEMA.withTags({
  ...intYaml11Tag,
  resolve: (source, isExplicit, tagName) => {
    const result = intYaml11Tag.resolve(source, isExplicit, tagName);
    return result === NOT_RESOLVED ? intCoreTag.resolve(source, isExplicit, tagName) : result;
  }
}, {
  ...floatYaml11Tag,
  resolve: (source, isExplicit, tagName) => {
    const result = floatYaml11Tag.resolve(source, isExplicit, tagName);
    return result === NOT_RESOLVED ? floatCoreTag.resolve(source, isExplicit, tagName) : result;
  }
});
defineMappingTag("tag:yaml.org,2002:map", {
  create: () => /* @__PURE__ */ new Map(),
  addPair: (container, key, value) => {
    container.set(key, value);
    return "";
  },
  has: (container, key) => container.has(key),
  keys: (container) => container.keys(),
  get: (container, key) => container.get(key),
  identify: (data) => data instanceof Map || isPlainObject(data),
  represent: (data) => {
    if (data instanceof Map) return data;
    const map2 = /* @__PURE__ */ new Map();
    const obj = data;
    for (const key of Object.keys(obj)) map2.set(key, obj[key]);
    return map2;
  }
});
function normalizeKey(key) {
  if (Array.isArray(key)) {
    const array2 = Array.prototype.slice.call(key);
    for (let index2 = 0; index2 < array2.length; index2++) {
      if (Array.isArray(array2[index2])) return null;
      if (typeof array2[index2] === "object" && Object.prototype.toString.call(array2[index2]) === "[object Object]") array2[index2] = "[object Object]";
    }
    return String(array2);
  }
  if (typeof key === "object" && Object.prototype.toString.call(key) === "[object Object]") return "[object Object]";
  return String(key);
}
defineMappingTag("tag:yaml.org,2002:map", {
  create: () => ({}),
  identify: isPlainObject,
  represent: (o) => {
    const map2 = /* @__PURE__ */ new Map();
    for (const key of Object.keys(o)) map2.set(key, o[key]);
    return map2;
  },
  addPair: (container, key, value) => {
    const normalizedKey = normalizeKey(key);
    if (normalizedKey === null) return "nested arrays are not supported inside keys";
    if (normalizedKey === "__proto__") Object.defineProperty(container, normalizedKey, {
      value,
      enumerable: true,
      configurable: true,
      writable: true
    });
    else container[normalizedKey] = value;
    return "";
  },
  has: (container, key) => {
    const normalizedKey = normalizeKey(key);
    return normalizedKey !== null && Object.prototype.hasOwnProperty.call(container, normalizedKey);
  },
  keys: (container) => Object.keys(container),
  get: (container, key) => {
    const normalizedKey = String(key);
    if (!Object.prototype.hasOwnProperty.call(container, normalizedKey)) return null;
    return container[normalizedKey];
  }
});
var DEFAULT_SNIPPET_OPTIONS = {
  maxLength: 79,
  indent: 1,
  linesBefore: 3,
  linesAfter: 2
};
function getLine(buffer, lineStart, lineEnd, position, maxLineLength) {
  let head = "";
  let tail = "";
  const maxHalfLength = Math.floor(maxLineLength / 2) - 1;
  if (position - lineStart > maxHalfLength) {
    head = " ... ";
    lineStart = position - maxHalfLength + head.length;
  }
  if (lineEnd - position > maxHalfLength) {
    tail = " ...";
    lineEnd = position + maxHalfLength - tail.length;
  }
  return {
    str: head + buffer.slice(lineStart, lineEnd).replace(/\t/g, "→") + tail,
    pos: position - lineStart + head.length
  };
}
function padStart(string2, max) {
  return " ".repeat(Math.max(max - string2.length, 0)) + string2;
}
function makeSnippet(mark, options) {
  if (!mark.buffer) return null;
  const opts = {
    ...DEFAULT_SNIPPET_OPTIONS,
    ...options
  };
  const re = /\r?\n|\r|\0/g;
  const lineStarts = [0];
  const lineEnds = [];
  let match2;
  let foundLineNo = -1;
  while (match2 = re.exec(mark.buffer)) {
    lineEnds.push(match2.index);
    lineStarts.push(match2.index + match2[0].length);
    if (mark.position <= match2.index && foundLineNo < 0) foundLineNo = lineStarts.length - 2;
  }
  if (foundLineNo < 0) foundLineNo = lineStarts.length - 1;
  let result = "";
  const lineNoLength = Math.min(mark.line + opts.linesAfter, lineEnds.length).toString().length;
  const maxLineLength = opts.maxLength - (opts.indent + lineNoLength + 3);
  for (let i = 1; i <= opts.linesBefore; i++) {
    if (foundLineNo - i < 0) break;
    const line2 = getLine(mark.buffer, lineStarts[foundLineNo - i], lineEnds[foundLineNo - i], mark.position - (lineStarts[foundLineNo] - lineStarts[foundLineNo - i]), maxLineLength);
    result = `${" ".repeat(opts.indent)}${padStart((mark.line - i + 1).toString(), lineNoLength)} | ${line2.str}
${result}`;
  }
  const line = getLine(mark.buffer, lineStarts[foundLineNo], lineEnds[foundLineNo], mark.position, maxLineLength);
  result += `${" ".repeat(opts.indent)}${padStart((mark.line + 1).toString(), lineNoLength)} | ${line.str}
`;
  result += `${"-".repeat(opts.indent + lineNoLength + 3 + line.pos)}^
`;
  for (let i = 1; i <= opts.linesAfter; i++) {
    if (foundLineNo + i >= lineEnds.length) break;
    const line2 = getLine(mark.buffer, lineStarts[foundLineNo + i], lineEnds[foundLineNo + i], mark.position - (lineStarts[foundLineNo] - lineStarts[foundLineNo + i]), maxLineLength);
    result += `${" ".repeat(opts.indent)}${padStart((mark.line + i + 1).toString(), lineNoLength)} | ${line2.str}
`;
  }
  return result.replace(/\n$/, "");
}
function formatError(exception, compact) {
  let where = "";
  if (!exception.mark) return exception.reason;
  if (exception.mark.name) where += `in "${exception.mark.name}" `;
  where += `(${exception.mark.line + 1}:${exception.mark.column + 1})`;
  if (!compact && exception.mark.snippet) where += `

${exception.mark.snippet}`;
  return `${exception.reason} ${where}`;
}
var YAMLException = class YAMLException2 extends Error {
  reason;
  mark;
  /**
  * Optional `mark` contains source snippet data. Usually, use
  * {@link YAMLException.throwAt} instead of passing it directly.
  */
  constructor(reason, mark) {
    super();
    this.name = "YAMLException";
    this.reason = reason;
    this.mark = mark;
    this.message = formatError(this, false);
    if (Error.captureStackTrace) Error.captureStackTrace(this, this.constructor);
  }
  /**
  * Returns the formatted error, omitting the source snippet in compact mode.
  */
  toString(compact) {
    return `${this.name}: ${formatError(this, compact)}`;
  }
  /**
  * Builds a YAMLException with a source snippet and throws it. `source` is
  * the raw input text; `position` is an offset into it.
  */
  static throwAt(source, position, message, filename = "") {
    let line = 0;
    let lineStart = 0;
    for (let index2 = 0; index2 < position; index2++) {
      const ch = source.charCodeAt(index2);
      if (ch === 10) {
        line++;
        lineStart = index2 + 1;
      } else if (ch === 13) {
        line++;
        if (source.charCodeAt(index2 + 1) === 10) index2++;
        lineStart = index2 + 1;
      }
    }
    const mark = {
      name: filename,
      buffer: source,
      position,
      line,
      column: position - lineStart
    };
    mark.snippet = makeSnippet(mark);
    throw new YAMLException2(message, mark);
  }
};
var EVENT_ID = {
  DOCUMENT: 1,
  SEQUENCE: 2,
  MAPPING: 3,
  SCALAR: 4,
  ALIAS: 5,
  POP: 6
};
var SCALAR_STYLE = {
  PLAIN: 1,
  SINGLE_QUOTED: 2,
  DOUBLE_QUOTED: 3,
  LITERAL_BLOCK: 4,
  FOLDED_BLOCK: 5
};
var COLLECTION_STYLE = {
  BLOCK: 1,
  FLOW: 2
};
var CHOMPING_MODE = {
  CLIP: 1,
  STRIP: 2,
  KEEP: 3
};
var NO_RANGE$3 = -1;
function simpleEscapeSequence(c) {
  switch (c) {
    case 48:
      return "\0";
    case 97:
      return "\x07";
    case 98:
      return "\b";
    case 116:
      return "	";
    case 9:
      return "	";
    case 110:
      return "\n";
    case 118:
      return "\v";
    case 102:
      return "\f";
    case 114:
      return "\r";
    case 101:
      return "\x1B";
    case 32:
      return " ";
    case 34:
      return '"';
    case 47:
      return "/";
    case 92:
      return "\\";
    case 78:
      return "";
    case 95:
      return " ";
    case 76:
      return "\u2028";
    case 80:
      return "\u2029";
    default:
      return "";
  }
}
var simpleEscapeCheck = new Array(256);
var simpleEscapeMap = new Array(256);
for (let i = 0; i < 256; i++) {
  simpleEscapeCheck[i] = simpleEscapeSequence(i) ? 1 : 0;
  simpleEscapeMap[i] = simpleEscapeSequence(i);
}
function charFromCodepoint(c) {
  if (c <= 65535) return String.fromCharCode(c);
  return String.fromCharCode((c - 65536 >> 10) + 55296, (c - 65536 & 1023) + 56320);
}
function fromHexCode$1(c) {
  if (c >= 48 && c <= 57) return c - 48;
  return (c | 32) - 97 + 10;
}
function escapedHexLen$1(c) {
  if (c === 120) return 2;
  if (c === 117) return 4;
  return 8;
}
function skipFoldedBreaks(input, position, end) {
  let breaks = 0;
  while (position < end) {
    const ch = input.charCodeAt(position);
    if (ch === 10) {
      breaks++;
      position++;
    } else if (ch === 13) {
      breaks++;
      position++;
      if (input.charCodeAt(position) === 10) position++;
    } else if (ch === 32 || ch === 9) position++;
    else break;
  }
  return {
    position,
    breaks
  };
}
function foldedBreaks(count) {
  if (count === 1) return " ";
  return "\n".repeat(count - 1);
}
function getPlainValue(input, start, end) {
  let result = "";
  let position = start;
  let captureStart = start;
  let captureEnd = start;
  while (position < end) {
    const ch = input.charCodeAt(position);
    if (ch === 10 || ch === 13) {
      result += input.slice(captureStart, captureEnd);
      const fold = skipFoldedBreaks(input, position, end);
      result += foldedBreaks(fold.breaks);
      position = captureStart = captureEnd = fold.position;
    } else {
      position++;
      if (ch !== 32 && ch !== 9) captureEnd = position;
    }
  }
  return result + input.slice(captureStart, captureEnd);
}
function getSingleQuotedValue(input, start, end) {
  let result = "";
  let position = start;
  let captureStart = start;
  let captureEnd = start;
  while (position < end) {
    const ch = input.charCodeAt(position);
    if (ch === 39) {
      result += input.slice(captureStart, position) + "'";
      position += 2;
      captureStart = captureEnd = position;
    } else if (ch === 10 || ch === 13) {
      result += input.slice(captureStart, captureEnd);
      const fold = skipFoldedBreaks(input, position, end);
      result += foldedBreaks(fold.breaks);
      position = captureStart = captureEnd = fold.position;
    } else {
      position++;
      if (ch !== 32 && ch !== 9) captureEnd = position;
    }
  }
  return result + input.slice(captureStart, end);
}
function getDoubleQuotedValue(input, start, end) {
  let result = "";
  let position = start;
  let captureStart = start;
  let captureEnd = start;
  while (position < end) {
    const ch = input.charCodeAt(position);
    if (ch === 92) {
      result += input.slice(captureStart, position);
      position++;
      const escaped = input.charCodeAt(position);
      if (escaped === 10 || escaped === 13) position = skipFoldedBreaks(input, position, end).position;
      else if (escaped < 256 && simpleEscapeCheck[escaped]) {
        result += simpleEscapeMap[escaped];
        position++;
      } else {
        let hexLength = escapedHexLen$1(escaped);
        let hexResult = 0;
        for (; hexLength > 0; hexLength--) {
          position++;
          const digit = fromHexCode$1(input.charCodeAt(position));
          hexResult = (hexResult << 4) + digit;
        }
        result += charFromCodepoint(hexResult);
        position++;
      }
      captureStart = captureEnd = position;
    } else if (ch === 10 || ch === 13) {
      result += input.slice(captureStart, captureEnd);
      const fold = skipFoldedBreaks(input, position, end);
      result += foldedBreaks(fold.breaks);
      position = captureStart = captureEnd = fold.position;
    } else {
      position++;
      if (ch !== 32 && ch !== 9) captureEnd = position;
    }
  }
  return result + input.slice(captureStart, end);
}
function getBlockValue(input, start, end, indent, chomping, folded) {
  const textIndent = indent < 0 ? 0 : indent;
  const region = input.slice(start, end).replace(/\r\n?/g, "\n");
  const lines = region === "" ? [] : (region.endsWith("\n") ? region.slice(0, -1) : region).split("\n");
  let result = "";
  let didReadContent = false;
  let emptyLines = 0;
  let atMoreIndented = false;
  for (const line of lines) {
    let column = 0;
    while (column < textIndent && line.charCodeAt(column) === 32) column++;
    if (indent < 0 || column >= line.length) {
      emptyLines++;
      continue;
    }
    const content = line.slice(textIndent);
    const first = content.charCodeAt(0);
    if (folded) if (first === 32 || first === 9) {
      atMoreIndented = true;
      result += "\n".repeat(didReadContent ? 1 + emptyLines : emptyLines);
    } else if (atMoreIndented) {
      atMoreIndented = false;
      result += "\n".repeat(emptyLines + 1);
    } else if (emptyLines === 0) {
      if (didReadContent) result += " ";
    } else result += "\n".repeat(emptyLines);
    else result += "\n".repeat(didReadContent ? 1 + emptyLines : emptyLines);
    result += content;
    didReadContent = true;
    emptyLines = 0;
  }
  if (chomping === CHOMPING_MODE.KEEP) result += "\n".repeat(didReadContent ? 1 + emptyLines : emptyLines);
  else if (chomping !== CHOMPING_MODE.STRIP) {
    if (didReadContent) result += "\n";
  }
  return result;
}
function getScalarValue(input, scalar) {
  if (scalar.valueStart === NO_RANGE$3) return "";
  const { valueStart, valueEnd } = scalar;
  if (scalar.fast) return input.slice(valueStart, valueEnd);
  switch (scalar.style) {
    case SCALAR_STYLE.SINGLE_QUOTED:
      return getSingleQuotedValue(input, valueStart, valueEnd);
    case SCALAR_STYLE.DOUBLE_QUOTED:
      return getDoubleQuotedValue(input, valueStart, valueEnd);
    case SCALAR_STYLE.LITERAL_BLOCK:
      return getBlockValue(input, valueStart, valueEnd, scalar.indent, scalar.chomping, false);
    case SCALAR_STYLE.FOLDED_BLOCK:
      return getBlockValue(input, valueStart, valueEnd, scalar.indent, scalar.chomping, true);
    default:
      return getPlainValue(input, valueStart, valueEnd);
  }
}
var DEFAULT_TAG_HANDLERS = Object.assign(/* @__PURE__ */ Object.create(null), {
  "!": "!",
  "!!": "tag:yaml.org,2002:"
});
function tagNameFull(rawTag, tagHandlers) {
  if (rawTag.startsWith("!<") && rawTag.endsWith(">")) return decodeURIComponent(rawTag.slice(2, -1));
  const handleEnd = rawTag.indexOf("!", 1);
  const handle = handleEnd === -1 ? "!" : rawTag.slice(0, handleEnd + 1);
  const prefix = tagHandlers?.[handle] ?? DEFAULT_TAG_HANDLERS[handle] ?? handle;
  return decodeURIComponent(prefix) + decodeURIComponent(rawTag.slice(handle.length));
}
var NO_RANGE$2 = -1;
var MERGE_TAG_NAME = "tag:yaml.org,2002:merge";
var DEFAULT_CONSTRUCTOR_OPTIONS = {
  filename: "",
  schema: CORE_SCHEMA,
  json: false,
  maxTotalMergeKeys: 1e4,
  maxAliases: -1
};
function eventPosition$1(event) {
  if ("tagStart" in event && event.tagStart !== NO_RANGE$2) return event.tagStart;
  if ("anchorStart" in event && event.anchorStart !== NO_RANGE$2) return event.anchorStart;
  if ("valueStart" in event && event.valueStart !== NO_RANGE$2) return event.valueStart;
  if ("start" in event) return event.start;
  return 0;
}
function throwError$1(state, message) {
  YAMLException.throwAt(state.source, state.position, message, state.filename);
}
function finalizeCollection(state, position, tag, carrier) {
  try {
    return tag.finalize(carrier);
  } catch (error2) {
    if (error2 instanceof YAMLException) throw error2;
    YAMLException.throwAt(state.source, position, error2 instanceof Error ? error2.message : String(error2), state.filename);
  }
}
function constructScalar(state, event) {
  const source = getScalarValue(state.source, event);
  const rawTag = event.tagStart === NO_RANGE$2 ? "" : state.source.slice(event.tagStart, event.tagEnd);
  const strTag2 = state.schema.defaultScalarTag;
  if (rawTag !== "") {
    if (rawTag === "!") return {
      value: source,
      tag: strTag2
    };
    const tagName = tagNameFull(rawTag, state.tagHandlers);
    const scalarTag = state.schema.lookupScalarTag(tagName);
    if (scalarTag) {
      const result = scalarTag.resolve(source, true, tagName);
      if (result === NOT_RESOLVED) throwError$1(state, `cannot resolve a node with !<${tagName}> explicit tag`);
      return {
        value: result,
        tag: scalarTag
      };
    }
    const collectionTagDef = state.schema.lookupMappingTag(tagName) ?? state.schema.lookupSequenceTag(tagName);
    if (collectionTagDef) {
      if (source !== "") throwError$1(state, `cannot resolve a node with !<${tagName}> explicit tag`);
      const carrier = collectionTagDef.create(tagName);
      return {
        value: collectionTagDef.carrierIsResult ? carrier : finalizeCollection(state, state.position, collectionTagDef, carrier),
        tag: collectionTagDef
      };
    }
    throwError$1(state, `unknown scalar tag !<${tagName}>`);
  }
  if (event.style === SCALAR_STYLE.PLAIN) return state.schema.resolveImplicitScalarTag(source);
  return {
    value: strTag2.resolve(source, false, strTag2.tagName),
    tag: strTag2
  };
}
function collectionTagName(state, event, defaultTagName) {
  const rawTag = event.tagStart === NO_RANGE$2 ? "" : state.source.slice(event.tagStart, event.tagEnd);
  return rawTag === "" || rawTag === "!" ? defaultTagName : tagNameFull(rawTag, state.tagHandlers);
}
function isMappingTag(tag) {
  return tag.nodeKind === "mapping";
}
function chargeMergeWork(state) {
  state.totalMergeKeys++;
  if (state.maxTotalMergeKeys !== -1 && state.totalMergeKeys > state.maxTotalMergeKeys) throwError$1(state, `merge keys exceeded maxTotalMergeKeys (${state.maxTotalMergeKeys})`);
}
function mergeKeys(state, frame, source, sourceTag) {
  chargeMergeWork(state);
  for (const sourceKey of sourceTag.keys(source)) {
    chargeMergeWork(state);
    if (frame.tag.has(frame.value, sourceKey)) continue;
    const err = frame.tag.addPair(frame.value, sourceKey, sourceTag.get(source, sourceKey));
    if (err) throwError$1(state, err);
    frame.overridable ??= /* @__PURE__ */ new Set();
    frame.overridable.add(sourceKey);
  }
}
function mergeSource(state, frame, source, sourceTag) {
  state.position = frame.keyPosition;
  if (isMappingTag(sourceTag)) mergeKeys(state, frame, source, sourceTag);
  else if (sourceTag.nodeKind === "sequence" && Array.isArray(source)) {
    if (source.length > 100) throwError$1(state, "abnormal merge sequence size");
    for (const element of source) {
      const elementTag = state.nodeTags.get(element);
      if (!elementTag) throwError$1(state, "cannot merge mappings; the provided source object is unacceptable");
      mergeKeys(state, frame, element, elementTag);
    }
  } else throwError$1(state, "cannot merge mappings; the provided source object is unacceptable");
}
function addMappingValue(state, frame, key, value, tag) {
  state.position = frame.keyPosition;
  if (frame.keyIsMerge) {
    mergeSource(state, frame, value, tag);
    return;
  }
  if (!state.json && frame.tag.has(frame.value, key) && !frame.overridable?.has(key)) throwError$1(state, "duplicated mapping key");
  const err = frame.tag.addPair(frame.value, key, value);
  if (err) throwError$1(state, err);
  frame.overridable?.delete(key);
}
function addValue(state, value, tag) {
  const frame = state.frames[state.frames.length - 1];
  if (frame.kind === "document") {
    frame.value = value;
    frame.hasValue = true;
  } else if (frame.kind === "sequence") {
    if (isMappingTag(tag)) state.nodeTags.set(value, tag);
    const err = frame.tag.addItem(frame.value, value, frame.index++);
    if (err) throwError$1(state, err);
  } else if (frame.hasKey) {
    const key = frame.key;
    frame.key = void 0;
    frame.hasKey = false;
    addMappingValue(state, frame, key, value, tag);
  } else {
    frame.key = value;
    frame.keyPosition = state.position;
    frame.hasKey = true;
    frame.keyIsMerge = tag.tagName === MERGE_TAG_NAME;
  }
}
function storeAnchor(state, event, value, tag, isValueFinal) {
  if (event.anchorStart !== NO_RANGE$2) {
    const anchor = {
      value,
      tag,
      isValueFinal
    };
    state.anchors.set(state.source.slice(event.anchorStart, event.anchorEnd), anchor);
    return anchor;
  }
  return null;
}
function constructFromEvents(events, options) {
  const state = {
    ...DEFAULT_CONSTRUCTOR_OPTIONS,
    ...options,
    events,
    documents: [],
    eventIndex: 0,
    position: 0,
    frames: [],
    anchors: /* @__PURE__ */ new Map(),
    nodeTags: /* @__PURE__ */ new Map(),
    tagHandlers: /* @__PURE__ */ Object.create(null),
    totalMergeKeys: 0,
    aliasCount: 0
  };
  while (state.eventIndex < state.events.length) {
    const event = state.events[state.eventIndex++];
    state.position = eventPosition$1(event);
    switch (event.type) {
      case EVENT_ID.DOCUMENT:
        state.anchors = /* @__PURE__ */ new Map();
        state.nodeTags = /* @__PURE__ */ new Map();
        state.aliasCount = 0;
        state.tagHandlers = /* @__PURE__ */ Object.create(null);
        for (const directive of event.directives) if (directive.kind === "tag") state.tagHandlers[directive.handle] = directive.prefix;
        state.frames.push({
          kind: "document",
          position: state.position,
          value: void 0,
          hasValue: false
        });
        break;
      case EVENT_ID.SCALAR: {
        const { value, tag } = constructScalar(state, event);
        storeAnchor(state, event, value, tag, true);
        addValue(state, value, tag);
        break;
      }
      case EVENT_ID.SEQUENCE: {
        const tagName = collectionTagName(state, event, "tag:yaml.org,2002:seq");
        const tag = state.schema.lookupSequenceTag(tagName);
        if (!tag) throwError$1(state, `unknown sequence tag !<${tagName}>`);
        const value = tag.create(tagName);
        const anchor = storeAnchor(state, event, value, tag, tag.carrierIsResult);
        state.frames.push({
          kind: "sequence",
          position: state.position,
          value,
          tag,
          anchor,
          index: 0
        });
        break;
      }
      case EVENT_ID.MAPPING: {
        const tagName = collectionTagName(state, event, "tag:yaml.org,2002:map");
        const tag = state.schema.lookupMappingTag(tagName);
        if (!tag) throwError$1(state, `unknown mapping tag !<${tagName}>`);
        const value = tag.create(tagName);
        const anchor = storeAnchor(state, event, value, tag, tag.carrierIsResult);
        state.frames.push({
          kind: "mapping",
          position: state.position,
          value,
          tag,
          anchor,
          key: void 0,
          keyPosition: state.position,
          hasKey: false,
          keyIsMerge: false,
          overridable: null
        });
        break;
      }
      case EVENT_ID.ALIAS: {
        if (state.maxAliases !== -1 && ++state.aliasCount > state.maxAliases) throwError$1(state, `aliases exceeded maxAliases (${state.maxAliases})`);
        const name = state.source.slice(event.anchorStart, event.anchorEnd);
        const anchor = state.anchors.get(name);
        if (!anchor) throwError$1(state, `unidentified alias "${name}"`);
        if (!anchor.isValueFinal) throwError$1(state, `recursive alias "${name}" is not supported for tag ${anchor.tag.tagName} because it uses finalize()`);
        addValue(state, anchor.value, anchor.tag);
        break;
      }
      case EVENT_ID.POP: {
        const frame = state.frames.pop();
        if (frame.kind === "mapping" && frame.hasKey) {
          state.position = frame.keyPosition;
          throwError$1(state, "incomplete mapping pair in event stream");
        }
        if (frame.kind === "document") state.documents.push(frame.value);
        else {
          const value = frame.tag.carrierIsResult ? frame.value : finalizeCollection(state, frame.position, frame.tag, frame.value);
          if (frame.anchor) {
            frame.anchor.value = value;
            frame.anchor.isValueFinal = true;
          }
          addValue(state, value, frame.tag);
        }
        break;
      }
    }
  }
  return state.documents;
}
var NO_RANGE$1 = -1;
var HAS_OWN = Object.prototype.hasOwnProperty;
var CONTEXT_FLOW_IN = 1;
var CONTEXT_FLOW_OUT = 2;
var CONTEXT_BLOCK_IN = 3;
var CONTEXT_BLOCK_OUT = 4;
var PATTERN_NON_PRINTABLE = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x84\x86-\x9F\uFFFE\uFFFF]|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?:[^\uD800-\uDBFF]|^)[\uDC00-\uDFFF]/;
var PATTERN_FLOW_INDICATORS = /[,\[\]{}]/;
var PATTERN_TAG_HANDLE = /^(?:!|!!|![0-9A-Za-z-]+!)$/;
var NS_URI_CHAR = String.raw`(?:%[0-9A-Fa-f]{2}|[0-9A-Za-z\-#;/?:@&=+$,_.!~*'()\[\]])`;
var NS_TAG_CHAR = String.raw`(?:%[0-9A-Fa-f]{2}|[0-9A-Za-z\-#;/?:@&=+$.~*'()_])`;
var PATTERN_TAG_URI = new RegExp(`^(?:${NS_URI_CHAR})*$`);
var PATTERN_TAG_SUFFIX = new RegExp(`^(?:${NS_TAG_CHAR})+$`);
var PATTERN_TAG_PREFIX = new RegExp(`^(?:!(?:${NS_URI_CHAR})*|${NS_TAG_CHAR}(?:${NS_URI_CHAR})*)$`);
var DEFAULT_PARSER_OPTIONS = {
  filename: "",
  maxDepth: 100
};
function addDocumentEvent(state, explicitStart, explicitEnd) {
  state.events.push({
    type: EVENT_ID.DOCUMENT,
    explicitStart,
    explicitEnd,
    directives: state.directives
  });
}
function addSequenceEvent(state, start, anchorStart, anchorEnd, tagStart, tagEnd, style) {
  state.events.push({
    type: EVENT_ID.SEQUENCE,
    start,
    anchorStart,
    anchorEnd,
    tagStart,
    tagEnd,
    style
  });
}
function addMappingEvent(state, start, anchorStart, anchorEnd, tagStart, tagEnd, style) {
  state.events.push({
    type: EVENT_ID.MAPPING,
    start,
    anchorStart,
    anchorEnd,
    tagStart,
    tagEnd,
    style
  });
}
function insertFlowPairMappingEvent(state, snapshot) {
  state.events.splice(snapshot.eventsLength, 0, {
    type: EVENT_ID.MAPPING,
    start: snapshot.position,
    anchorStart: NO_RANGE$1,
    anchorEnd: NO_RANGE$1,
    tagStart: NO_RANGE$1,
    tagEnd: NO_RANGE$1,
    style: COLLECTION_STYLE.FLOW
  });
}
function addScalarEvent(state, valueStart, valueEnd, anchorStart, anchorEnd, tagStart, tagEnd, style, chomping = CHOMPING_MODE.CLIP, indent = -1, fast = false) {
  state.events.push({
    type: EVENT_ID.SCALAR,
    valueStart,
    valueEnd,
    anchorStart,
    anchorEnd,
    tagStart,
    tagEnd,
    style,
    chomping,
    indent,
    fast
  });
}
function addAliasEvent(state, anchorStart, anchorEnd) {
  state.events.push({
    type: EVENT_ID.ALIAS,
    anchorStart,
    anchorEnd
  });
}
function addPopEvent(state) {
  state.events.push({ type: EVENT_ID.POP });
}
function addEmptyScalarEvent(state) {
  addScalarEvent(state, NO_RANGE$1, NO_RANGE$1, NO_RANGE$1, NO_RANGE$1, NO_RANGE$1, NO_RANGE$1, SCALAR_STYLE.PLAIN);
}
function emptyProperties() {
  return {
    anchorStart: NO_RANGE$1,
    anchorEnd: NO_RANGE$1,
    tagStart: NO_RANGE$1,
    tagEnd: NO_RANGE$1
  };
}
function snapshotState(state) {
  return {
    position: state.position,
    line: state.line,
    lineStart: state.lineStart,
    lineIndent: state.lineIndent,
    firstTabInLine: state.firstTabInLine,
    eventsLength: state.events.length
  };
}
function restoreState(state, snapshot) {
  state.position = snapshot.position;
  state.line = snapshot.line;
  state.lineStart = snapshot.lineStart;
  state.lineIndent = snapshot.lineIndent;
  state.firstTabInLine = snapshot.firstTabInLine;
  state.events.length = snapshot.eventsLength;
}
function throwError(state, message) {
  YAMLException.throwAt(state.input.slice(0, state.length), state.position, message, state.filename);
}
function isEol(c) {
  return c === 10 || c === 13;
}
function isWhiteSpace(c) {
  return c === 9 || c === 32;
}
function isWsOrEol(c) {
  return isWhiteSpace(c) || isEol(c);
}
function isWsOrEolOrEnd(c) {
  return c === 0 || isWsOrEol(c);
}
function isFlowIndicator(c) {
  return c === 44 || c === 91 || c === 93 || c === 123 || c === 125;
}
function fromDecimalCode(c) {
  return c >= 48 && c <= 57 ? c - 48 : -1;
}
function fromHexCode(c) {
  if (c >= 48 && c <= 57) return c - 48;
  const lc = c | 32;
  if (lc >= 97 && lc <= 102) return lc - 97 + 10;
  return -1;
}
function escapedHexLen(c) {
  if (c === 120) return 2;
  if (c === 117) return 4;
  if (c === 85) return 8;
  return 0;
}
function isSimpleEscape(c) {
  return c === 48 || c === 97 || c === 98 || c === 116 || c === 9 || c === 110 || c === 118 || c === 102 || c === 114 || c === 101 || c === 32 || c === 34 || c === 47 || c === 92 || c === 78 || c === 95 || c === 76 || c === 80;
}
function consumeLineBreak(state) {
  if (state.input.charCodeAt(state.position) === 10) state.position++;
  else {
    state.position++;
    if (state.input.charCodeAt(state.position) === 10) state.position++;
  }
  state.line++;
  state.lineStart = state.position;
  state.lineIndent = 0;
  state.firstTabInLine = -1;
}
function skipSeparationSpace(state, allowComments) {
  let lineBreaks = 0;
  let ch = state.input.charCodeAt(state.position);
  let hasSeparation = state.position === state.lineStart || isWsOrEol(state.input.charCodeAt(state.position - 1));
  while (ch !== 0) {
    while (isWhiteSpace(ch)) {
      hasSeparation = true;
      if (ch === 9 && state.firstTabInLine === -1) state.firstTabInLine = state.position;
      ch = state.input.charCodeAt(++state.position);
    }
    if (allowComments && hasSeparation && ch === 35) do
      ch = state.input.charCodeAt(++state.position);
    while (!isEol(ch) && ch !== 0);
    if (!isEol(ch)) break;
    consumeLineBreak(state);
    lineBreaks++;
    hasSeparation = true;
    ch = state.input.charCodeAt(state.position);
    while (ch === 32) {
      state.lineIndent++;
      ch = state.input.charCodeAt(++state.position);
    }
  }
  return lineBreaks;
}
function testDocumentSeparator(state, position = state.position) {
  const ch = state.input.charCodeAt(position);
  if ((ch === 45 || ch === 46) && ch === state.input.charCodeAt(position + 1) && ch === state.input.charCodeAt(position + 2)) {
    const following = state.input.charCodeAt(position + 3);
    return following === 0 || isWsOrEol(following);
  }
  return false;
}
function skipByteOrderMark(state) {
  if (state.position === state.lineStart && state.input.charCodeAt(state.position) === 65279) {
    state.position++;
    state.lineStart = state.position;
  }
}
function testDocumentBoundary(state) {
  if (state.position !== state.lineStart) return false;
  if (testDocumentSeparator(state)) return true;
  if (state.input.charCodeAt(state.position) !== 65279) return false;
  const snapshot = snapshotState(state);
  skipByteOrderMark(state);
  skipSeparationSpace(state, true);
  const ch = state.input.charCodeAt(state.position);
  const result = state.position === state.lineStart && (ch === 37 || ch === 45 && testDocumentSeparator(state));
  restoreState(state, snapshot);
  return result;
}
function skipUntilLineEnd(state) {
  let ch = state.input.charCodeAt(state.position);
  while (ch !== 0 && !isEol(ch)) ch = state.input.charCodeAt(++state.position);
}
function checkPrintable(state, start, end) {
  if (PATTERN_NON_PRINTABLE.test(state.input.slice(start, end))) throwError(state, "the stream contains non-printable characters");
}
function readTagProperty(state, props, inFlow) {
  if (state.input.charCodeAt(state.position) !== 33) return false;
  if (props.tagStart !== NO_RANGE$1) throwError(state, "duplication of a tag property");
  const start = state.position;
  let isVerbatim = false;
  let isNamed = false;
  let tagHandle = "!";
  let ch = state.input.charCodeAt(++state.position);
  if (ch === 60) {
    isVerbatim = true;
    ch = state.input.charCodeAt(++state.position);
  } else if (ch === 33) {
    isNamed = true;
    tagHandle = "!!";
    ch = state.input.charCodeAt(++state.position);
  }
  let suffixStart = state.position;
  let tagName;
  if (isVerbatim) {
    while (ch !== 0 && ch !== 62) ch = state.input.charCodeAt(++state.position);
    if (ch !== 62) throwError(state, "unexpected end of the stream within a verbatim tag");
    tagName = state.input.slice(suffixStart, state.position);
    state.position++;
  } else {
    while (ch !== 0 && !isWsOrEol(ch) && !(inFlow && isFlowIndicator(ch))) {
      if (ch === 33) if (!isNamed) {
        tagHandle = state.input.slice(suffixStart - 1, state.position + 1);
        if (!PATTERN_TAG_HANDLE.test(tagHandle)) throwError(state, "named tag handle cannot contain such characters");
        isNamed = true;
        suffixStart = state.position + 1;
      } else throwError(state, "tag suffix cannot contain exclamation marks");
      ch = state.input.charCodeAt(++state.position);
    }
    tagName = state.input.slice(suffixStart, state.position);
    if (PATTERN_FLOW_INDICATORS.test(tagName)) throwError(state, "tag suffix cannot contain flow indicator characters");
  }
  if (tagName && !(isVerbatim ? PATTERN_TAG_URI.test(tagName) : PATTERN_TAG_SUFFIX.test(tagName))) throwError(state, `tag name cannot contain such characters: ${tagName}`);
  if (!isVerbatim && tagHandle !== "!" && tagHandle !== "!!" && !HAS_OWN.call(state.tagHandlers, tagHandle)) throwError(state, `undeclared tag handle "${tagHandle}"`);
  props.tagStart = start;
  props.tagEnd = state.position;
  return true;
}
function readAnchorProperty(state, props) {
  if (state.input.charCodeAt(state.position) !== 38) return false;
  if (props.anchorStart !== NO_RANGE$1) throwError(state, "duplication of an anchor property");
  state.position++;
  const start = state.position;
  while (state.input.charCodeAt(state.position) !== 0 && !isWsOrEol(state.input.charCodeAt(state.position)) && !isFlowIndicator(state.input.charCodeAt(state.position))) state.position++;
  if (state.position === start) throwError(state, "name of an anchor node must contain at least one character");
  props.anchorStart = start;
  props.anchorEnd = state.position;
  return true;
}
function readAlias(state, props) {
  if (state.input.charCodeAt(state.position) !== 42) return false;
  if (props.anchorStart !== NO_RANGE$1 || props.tagStart !== NO_RANGE$1) throwError(state, "alias node should not have any properties");
  state.position++;
  const start = state.position;
  while (state.input.charCodeAt(state.position) !== 0 && !isWsOrEol(state.input.charCodeAt(state.position)) && !isFlowIndicator(state.input.charCodeAt(state.position))) state.position++;
  if (state.position === start) throwError(state, "name of an alias node must contain at least one character");
  addAliasEvent(state, start, state.position);
  return true;
}
function readFlowScalarBreak(state, nodeIndent) {
  skipSeparationSpace(state, false);
  if (state.lineIndent < nodeIndent) throwError(state, "deficient indentation");
}
function readSingleQuotedScalar(state, nodeIndent, props) {
  if (state.input.charCodeAt(state.position) !== 39) return false;
  state.position++;
  const start = state.position;
  let simple = true;
  while (state.input.charCodeAt(state.position) !== 0) {
    const ch = state.input.charCodeAt(state.position);
    if (ch === 39) {
      if (state.input.charCodeAt(state.position + 1) === 39) {
        simple = false;
        state.position += 2;
        continue;
      }
      const end = state.position;
      state.position++;
      addScalarEvent(state, start, end, props.anchorStart, props.anchorEnd, props.tagStart, props.tagEnd, SCALAR_STYLE.SINGLE_QUOTED, CHOMPING_MODE.CLIP, -1, simple);
      return true;
    }
    if (isEol(ch)) {
      simple = false;
      readFlowScalarBreak(state, nodeIndent);
    } else if (state.position === state.lineStart && testDocumentSeparator(state)) throwError(state, "unexpected end of the document within a single quoted scalar");
    else if (ch !== 9 && ch < 32) throwError(state, "expected valid JSON character");
    else state.position++;
  }
  throwError(state, "unexpected end of the stream within a single quoted scalar");
}
function readDoubleQuotedScalar(state, nodeIndent, props) {
  if (state.input.charCodeAt(state.position) !== 34) return false;
  state.position++;
  const start = state.position;
  let simple = true;
  while (state.input.charCodeAt(state.position) !== 0) {
    const ch = state.input.charCodeAt(state.position);
    if (ch === 34) {
      const end = state.position;
      state.position++;
      addScalarEvent(state, start, end, props.anchorStart, props.anchorEnd, props.tagStart, props.tagEnd, SCALAR_STYLE.DOUBLE_QUOTED, CHOMPING_MODE.CLIP, -1, simple);
      return true;
    }
    if (ch === 92) {
      simple = false;
      const escaped = state.input.charCodeAt(++state.position);
      if (isEol(escaped)) readFlowScalarBreak(state, nodeIndent);
      else if (isSimpleEscape(escaped)) state.position++;
      else {
        let hexLength = escapedHexLen(escaped);
        if (hexLength === 0) throwError(state, "unknown escape sequence");
        while (hexLength-- > 0) {
          state.position++;
          if (fromHexCode(state.input.charCodeAt(state.position)) < 0) throwError(state, "expected hexadecimal character");
        }
        state.position++;
      }
    } else if (isEol(ch)) {
      simple = false;
      readFlowScalarBreak(state, nodeIndent);
    } else if (state.position === state.lineStart && testDocumentSeparator(state)) throwError(state, "unexpected end of the document within a double quoted scalar");
    else if (ch !== 9 && ch < 32) throwError(state, "expected valid JSON character");
    else state.position++;
  }
  throwError(state, "unexpected end of the stream within a double quoted scalar");
}
function readBlockScalar(state, parentIndent, props) {
  const ch = state.input.charCodeAt(state.position);
  let chomping = CHOMPING_MODE.CLIP;
  let indent = -1;
  let detectedIndent = false;
  if (ch !== 124 && ch !== 62) return false;
  const style = ch === 124 ? SCALAR_STYLE.LITERAL_BLOCK : SCALAR_STYLE.FOLDED_BLOCK;
  state.position++;
  while (state.input.charCodeAt(state.position) !== 0) {
    const current = state.input.charCodeAt(state.position);
    const digit = fromDecimalCode(current);
    if (current === 43 || current === 45) {
      if (chomping !== CHOMPING_MODE.CLIP) throwError(state, "repeat of a chomping mode identifier");
      chomping = current === 43 ? CHOMPING_MODE.KEEP : CHOMPING_MODE.STRIP;
      state.position++;
    } else if (digit >= 0) {
      if (digit === 0) throwError(state, "bad explicit indentation width of a block scalar; it cannot be less than one");
      if (detectedIndent) throwError(state, "repeat of an indentation width identifier");
      indent = parentIndent + digit - 1;
      detectedIndent = true;
      state.position++;
    } else break;
  }
  let hadWhitespace = false;
  while (isWhiteSpace(state.input.charCodeAt(state.position))) {
    hadWhitespace = true;
    state.position++;
  }
  if (hadWhitespace && state.input.charCodeAt(state.position) === 35) skipUntilLineEnd(state);
  if (isEol(state.input.charCodeAt(state.position))) consumeLineBreak(state);
  else if (state.input.charCodeAt(state.position) !== 0) throwError(state, "a line break is expected");
  let contentIndent = detectedIndent ? indent : -1;
  let maxLeadingIndent = 0;
  const valueStart = state.position;
  let valueEnd = state.position;
  while (state.input.charCodeAt(state.position) !== 0) {
    const linePosition = state.position;
    let column = 0;
    while (state.input.charCodeAt(linePosition + column) === 32) column++;
    const first = state.input.charCodeAt(linePosition + column);
    if (first === 0) {
      if (contentIndent >= 0) {
        if (column > contentIndent) valueEnd = linePosition + column;
      } else if (column > 0) valueEnd = linePosition + column;
      break;
    }
    if (testDocumentBoundary(state)) break;
    if (!detectedIndent && contentIndent === -1 && isEol(first)) maxLeadingIndent = Math.max(maxLeadingIndent, column);
    if (!detectedIndent && contentIndent === -1 && !isEol(first)) {
      if (first === 9 && column < parentIndent) {
        state.position = linePosition + column;
        throwError(state, "tab characters must not be used in indentation");
      }
      if (column < maxLeadingIndent) {
        state.position = linePosition + column;
        throwError(state, "bad indentation of a mapping entry");
      }
    }
    if (contentIndent === -1 && first !== 0 && !isEol(first) && column < parentIndent) {
      state.lineIndent = column;
      state.position = linePosition + column;
      break;
    }
    if (!detectedIndent && first !== 0 && !isEol(first) && contentIndent === -1) contentIndent = column;
    const requiredIndent = contentIndent === -1 ? parentIndent + 1 : contentIndent;
    if (first !== 0 && !isEol(first) && column < requiredIndent) {
      state.lineIndent = column;
      state.position = linePosition + column;
      break;
    }
    skipUntilLineEnd(state);
    valueEnd = state.position;
    if (isEol(state.input.charCodeAt(state.position))) {
      consumeLineBreak(state);
      valueEnd = state.position;
    }
  }
  checkPrintable(state, valueStart, valueEnd);
  addScalarEvent(state, valueStart, valueEnd, props.anchorStart, props.anchorEnd, props.tagStart, props.tagEnd, style, chomping, contentIndent);
  return true;
}
function canStartPlainScalar(state, nodeContext) {
  const ch = state.input.charCodeAt(state.position);
  const inFlow = nodeContext === CONTEXT_FLOW_IN;
  if (ch === 0 || isWsOrEol(ch) || ch === 35 || ch === 38 || ch === 42 || ch === 33 || ch === 124 || ch === 62 || ch === 39 || ch === 34 || ch === 37 || ch === 64 || ch === 96 || inFlow && isFlowIndicator(ch)) return false;
  if (ch === 63 || ch === 45) {
    const following = state.input.charCodeAt(state.position + 1);
    if (isWsOrEolOrEnd(following) || inFlow && isFlowIndicator(following)) return false;
  }
  return true;
}
function readPlainScalar(state, nodeIndent, nodeContext, props) {
  if (!canStartPlainScalar(state, nodeContext)) return false;
  const start = state.position;
  let end = state.position;
  let ch = state.input.charCodeAt(state.position);
  const inFlow = nodeContext === CONTEXT_FLOW_IN;
  let multiline = false;
  while (ch !== 0) {
    if (testDocumentBoundary(state)) break;
    if (ch === 58) {
      const following = state.input.charCodeAt(state.position + 1);
      if (isWsOrEolOrEnd(following) || inFlow && isFlowIndicator(following)) break;
    } else if (ch === 35) {
      if (isWsOrEol(state.input.charCodeAt(state.position - 1))) break;
    } else if (inFlow && isFlowIndicator(ch)) break;
    else if (isEol(ch)) {
      const savedPosition = state.position;
      const savedLine = state.line;
      const savedLineStart = state.lineStart;
      const savedLineIndent = state.lineIndent;
      skipSeparationSpace(state, false);
      if (state.lineIndent >= nodeIndent) {
        multiline = true;
        ch = state.input.charCodeAt(state.position);
        continue;
      }
      state.position = savedPosition;
      state.line = savedLine;
      state.lineStart = savedLineStart;
      state.lineIndent = savedLineIndent;
      break;
    }
    if (!isWhiteSpace(ch)) end = state.position + 1;
    ch = state.input.charCodeAt(++state.position);
  }
  if (end === start) return false;
  checkPrintable(state, start, end);
  addScalarEvent(state, start, end, props.anchorStart, props.anchorEnd, props.tagStart, props.tagEnd, SCALAR_STYLE.PLAIN, CHOMPING_MODE.CLIP, -1, !multiline);
  return true;
}
function skipFlowSeparationSpace(state, nodeIndent) {
  const startLine = state.line;
  skipSeparationSpace(state, true);
  if (state.line > startLine && state.lineIndent < nodeIndent || state.firstTabInLine !== -1 && state.lineIndent < nodeIndent) throwError(state, "deficient indentation");
}
function readFlowCollection(state, nodeIndent, props) {
  const ch = state.input.charCodeAt(state.position);
  const isMapping = ch === 123;
  const start = state.position;
  let readNext = true;
  if (ch !== 91 && ch !== 123) return false;
  const terminator = isMapping ? 125 : 93;
  if (isMapping) addMappingEvent(state, start, props.anchorStart, props.anchorEnd, props.tagStart, props.tagEnd, COLLECTION_STYLE.FLOW);
  else addSequenceEvent(state, start, props.anchorStart, props.anchorEnd, props.tagStart, props.tagEnd, COLLECTION_STYLE.FLOW);
  state.position++;
  while (state.input.charCodeAt(state.position) !== 0) {
    skipFlowSeparationSpace(state, nodeIndent);
    let ch2 = state.input.charCodeAt(state.position);
    if (ch2 === terminator) {
      state.position++;
      addPopEvent(state);
      return true;
    } else if (!readNext) throwError(state, "missed comma between flow collection entries");
    else if (ch2 === 44) throwError(state, "expected the node content, but found ','");
    let isPair = false;
    let isExplicitPair = false;
    if (ch2 === 63 && isWsOrEol(state.input.charCodeAt(state.position + 1))) {
      isPair = isExplicitPair = true;
      state.position += 1;
      skipFlowSeparationSpace(state, nodeIndent);
    }
    const entryLine = state.line;
    const entryStart = snapshotState(state);
    const keyWasRead = parseNode(state, nodeIndent, CONTEXT_FLOW_IN, false, true);
    skipFlowSeparationSpace(state, nodeIndent);
    ch2 = state.input.charCodeAt(state.position);
    if ((isMapping || isExplicitPair || state.line === entryLine) && ch2 === 58) {
      isPair = true;
      state.position++;
      skipFlowSeparationSpace(state, nodeIndent);
      if (!isMapping) {
        insertFlowPairMappingEvent(state, entryStart);
        if (!keyWasRead) addEmptyScalarEvent(state);
      } else if (!keyWasRead) addEmptyScalarEvent(state);
      if (!parseNode(state, nodeIndent, CONTEXT_FLOW_IN, false, true)) addEmptyScalarEvent(state);
      skipFlowSeparationSpace(state, nodeIndent);
      if (!isMapping) addPopEvent(state);
    } else if (isMapping && isPair) {
      if (!keyWasRead) addEmptyScalarEvent(state);
      addEmptyScalarEvent(state);
    } else if (isMapping) addEmptyScalarEvent(state);
    else if (isPair) {
      insertFlowPairMappingEvent(state, entryStart);
      if (!keyWasRead) addEmptyScalarEvent(state);
      addEmptyScalarEvent(state);
      addPopEvent(state);
    }
    ch2 = state.input.charCodeAt(state.position);
    if (ch2 === 44) {
      readNext = true;
      state.position++;
    } else readNext = false;
  }
  throwError(state, "unexpected end of the stream within a flow collection");
}
function readBlockSequence(state, nodeIndent, props) {
  if (state.firstTabInLine !== -1 || state.input.charCodeAt(state.position) !== 45 || !isWsOrEolOrEnd(state.input.charCodeAt(state.position + 1))) return false;
  addSequenceEvent(state, state.position, props.anchorStart, props.anchorEnd, props.tagStart, props.tagEnd, COLLECTION_STYLE.BLOCK);
  while (state.input.charCodeAt(state.position) === 45 && isWsOrEolOrEnd(state.input.charCodeAt(state.position + 1))) {
    if (state.firstTabInLine !== -1) {
      state.position = state.firstTabInLine;
      throwError(state, "tab characters must not be used in indentation");
    }
    const entryLine = state.line;
    state.position++;
    const hadBreak = skipSeparationSpace(state, true) > 0;
    if (state.firstTabInLine !== -1 && state.input.charCodeAt(state.position) === 45 && isWsOrEolOrEnd(state.input.charCodeAt(state.position + 1))) throwError(state, "bad indentation of a sequence entry");
    if (hadBreak && state.lineIndent <= nodeIndent) addEmptyScalarEvent(state);
    else parseNode(state, nodeIndent, CONTEXT_BLOCK_IN, false, true);
    skipSeparationSpace(state, true);
    if (state.lineIndent < nodeIndent || state.position >= state.length) break;
    if (state.lineIndent > nodeIndent) throwError(state, "bad indentation of a sequence entry");
    if (state.line === entryLine && state.input.charCodeAt(state.position) === 45 && isWsOrEolOrEnd(state.input.charCodeAt(state.position + 1))) throwError(state, "bad indentation of a sequence entry");
  }
  addPopEvent(state);
  return true;
}
function readBlockMapping(state, nodeIndent, flowIndent, props) {
  let atExplicitKey = false;
  let detected = false;
  let mappingOpened = false;
  let pendingExplicitKey = false;
  if (state.firstTabInLine !== -1) return false;
  let ch = state.input.charCodeAt(state.position);
  while (ch !== 0) {
    if (!atExplicitKey && state.firstTabInLine !== -1) {
      state.position = state.firstTabInLine;
      throwError(state, "tab characters must not be used in indentation");
    }
    const following = state.input.charCodeAt(state.position + 1);
    const entryLine = state.line;
    if ((ch === 63 || ch === 58) && isWsOrEolOrEnd(following)) {
      if (!mappingOpened) {
        addMappingEvent(state, state.position, props.anchorStart, props.anchorEnd, props.tagStart, props.tagEnd, COLLECTION_STYLE.BLOCK);
        mappingOpened = true;
      }
      if (ch === 63) {
        if (atExplicitKey) addEmptyScalarEvent(state);
        detected = true;
        atExplicitKey = true;
      } else if (atExplicitKey) atExplicitKey = false;
      else {
        addEmptyScalarEvent(state);
        detected = true;
        atExplicitKey = false;
      }
      state.position += 1;
      pendingExplicitKey = true;
    } else {
      if (atExplicitKey) {
        addEmptyScalarEvent(state);
        atExplicitKey = false;
      }
      const beforeKey = snapshotState(state);
      if (!parseNode(state, flowIndent, CONTEXT_FLOW_OUT, false, true)) break;
      if (state.line === entryLine) {
        ch = state.input.charCodeAt(state.position);
        while (isWhiteSpace(ch)) ch = state.input.charCodeAt(++state.position);
        if (ch === 58) {
          ch = state.input.charCodeAt(++state.position);
          if (!isWsOrEolOrEnd(ch)) throwError(state, "a whitespace character is expected after the key-value separator within a block mapping");
          if (!mappingOpened) {
            restoreState(state, beforeKey);
            addMappingEvent(state, beforeKey.position, props.anchorStart, props.anchorEnd, props.tagStart, props.tagEnd, COLLECTION_STYLE.BLOCK);
            mappingOpened = true;
            parseNode(state, flowIndent, CONTEXT_FLOW_OUT, false, true);
            ch = state.input.charCodeAt(state.position);
            while (isWhiteSpace(ch)) ch = state.input.charCodeAt(++state.position);
            state.position++;
          }
          detected = true;
          atExplicitKey = false;
          pendingExplicitKey = false;
        } else if (detected) throwError(state, "expected ':' after a mapping key");
        else {
          if (props.anchorStart !== NO_RANGE$1 || props.tagStart !== NO_RANGE$1) {
            restoreState(state, beforeKey);
            return false;
          }
          return true;
        }
      } else if (detected) throwError(state, "can not read a block mapping entry; a multiline key may not be an implicit key");
      else {
        if (props.anchorStart !== NO_RANGE$1 || props.tagStart !== NO_RANGE$1) {
          restoreState(state, beforeKey);
          return false;
        }
        return true;
      }
    }
    if (parseNode(state, nodeIndent, CONTEXT_BLOCK_OUT, true, pendingExplicitKey)) pendingExplicitKey = false;
    if (!atExplicitKey) {
      if (pendingExplicitKey) {
        addEmptyScalarEvent(state);
        pendingExplicitKey = false;
      }
    }
    skipSeparationSpace(state, true);
    ch = state.input.charCodeAt(state.position);
    if ((state.line === entryLine || state.lineIndent > nodeIndent) && ch !== 0) throwError(state, "bad indentation of a mapping entry");
    else if (state.lineIndent < nodeIndent) break;
  }
  if (!detected) return false;
  if (atExplicitKey) addEmptyScalarEvent(state);
  if (mappingOpened) addPopEvent(state);
  return true;
}
function parseNode(state, parentIndent, nodeContext, allowToSeek, allowCompact, allowPropertyMapping = true) {
  if (state.depth >= state.maxDepth) throwError(state, `nesting exceeded maxDepth (${state.maxDepth})`);
  state.depth++;
  let indentStatus = 1;
  let atNewLine = false;
  let hasContent = false;
  let propertyStart = null;
  const props = emptyProperties();
  let allowBlockScalars = nodeContext === CONTEXT_BLOCK_OUT || nodeContext === CONTEXT_BLOCK_IN;
  let allowBlockCollections = allowBlockScalars;
  const allowBlockStyles = allowBlockScalars;
  if (allowToSeek && skipSeparationSpace(state, true)) {
    atNewLine = true;
    if (state.lineIndent > parentIndent) indentStatus = 1;
    else if (state.lineIndent === parentIndent) indentStatus = 0;
    else indentStatus = -1;
  }
  if (indentStatus === 1) while (true) {
    const ch = state.input.charCodeAt(state.position);
    const propertyState = snapshotState(state);
    if (atNewLine && indentStatus !== 1 && (ch === 33 || ch === 38)) break;
    if (atNewLine && allowBlockStyles && (props.tagStart !== NO_RANGE$1 || props.anchorStart !== NO_RANGE$1) && (ch === 33 || ch === 38)) {
      const fallbackState = snapshotState(state);
      const flowIndent = parentIndent + 1;
      if (readBlockMapping(state, state.position - state.lineStart, flowIndent, props) && state.events[fallbackState.eventsLength]?.type === EVENT_ID.MAPPING) {
        state.depth--;
        return true;
      }
      restoreState(state, fallbackState);
    }
    if (atNewLine && (ch === 33 && props.tagStart !== NO_RANGE$1 || ch === 38 && props.anchorStart !== NO_RANGE$1)) break;
    if (!readTagProperty(state, props, nodeContext === CONTEXT_FLOW_IN) && !readAnchorProperty(state, props)) break;
    if (propertyStart === null) propertyStart = propertyState;
    if (skipSeparationSpace(state, true)) {
      atNewLine = true;
      allowBlockCollections = allowBlockStyles;
      if (state.lineIndent > parentIndent) indentStatus = 1;
      else if (state.lineIndent === parentIndent) indentStatus = 0;
      else indentStatus = -1;
    } else allowBlockCollections = false;
  }
  if (allowBlockCollections) allowBlockCollections = atNewLine || allowCompact;
  if (indentStatus === 1 || nodeContext === CONTEXT_BLOCK_OUT) {
    const flowIndent = nodeContext === CONTEXT_FLOW_IN || nodeContext === CONTEXT_FLOW_OUT ? parentIndent : parentIndent + 1;
    const blockIndent = state.position - state.lineStart;
    if (indentStatus === 1) if (allowBlockCollections && (readBlockSequence(state, blockIndent, props) || readBlockMapping(state, blockIndent, flowIndent, props)) || readFlowCollection(state, flowIndent, props)) hasContent = true;
    else {
      const ch = state.input.charCodeAt(state.position);
      if (propertyStart !== null && allowPropertyMapping && allowBlockStyles && !allowBlockCollections && ch !== 124 && ch !== 62) {
        const fallbackState = snapshotState(state);
        const propertyIndent = propertyStart.position - propertyStart.lineStart;
        restoreState(state, propertyStart);
        if (readBlockMapping(state, propertyIndent, flowIndent, emptyProperties()) && state.events[fallbackState.eventsLength]?.type === EVENT_ID.MAPPING) hasContent = true;
        else restoreState(state, fallbackState);
      }
      if (!hasContent && (allowBlockScalars && readBlockScalar(state, flowIndent, props) || readSingleQuotedScalar(state, flowIndent, props) || readDoubleQuotedScalar(state, flowIndent, props) || readAlias(state, props) || readPlainScalar(state, flowIndent, nodeContext, props))) hasContent = true;
    }
    else if (indentStatus === 0) hasContent = allowBlockCollections && readBlockSequence(state, blockIndent, props);
  }
  allowBlockScalars = allowBlockScalars && !hasContent;
  if (!hasContent && (props.anchorStart !== NO_RANGE$1 || props.tagStart !== NO_RANGE$1 || allowBlockScalars)) {
    addScalarEvent(state, NO_RANGE$1, NO_RANGE$1, props.anchorStart, props.anchorEnd, props.tagStart, props.tagEnd, SCALAR_STYLE.PLAIN);
    hasContent = true;
  }
  state.depth--;
  return hasContent || props.anchorStart !== NO_RANGE$1 || props.tagStart !== NO_RANGE$1;
}
function readDirective(state) {
  if (state.lineIndent > 0 || state.input.charCodeAt(state.position) !== 37) return false;
  state.position++;
  const nameStart = state.position;
  while (state.input.charCodeAt(state.position) !== 0 && !isWsOrEol(state.input.charCodeAt(state.position))) state.position++;
  const name = state.input.slice(nameStart, state.position);
  const args = [];
  if (name.length === 0) throwError(state, "directive name must not be less than one character in length");
  while (state.input.charCodeAt(state.position) !== 0 && !isEol(state.input.charCodeAt(state.position))) {
    while (isWhiteSpace(state.input.charCodeAt(state.position))) state.position++;
    if (state.input.charCodeAt(state.position) === 35 || isEol(state.input.charCodeAt(state.position)) || state.input.charCodeAt(state.position) === 0) break;
    const start = state.position;
    while (state.input.charCodeAt(state.position) !== 0 && !isWsOrEol(state.input.charCodeAt(state.position))) state.position++;
    args.push(state.input.slice(start, state.position));
  }
  if (isEol(state.input.charCodeAt(state.position))) consumeLineBreak(state);
  if (name === "YAML") {
    if (state.directives.some((directive) => directive.kind === "yaml")) throwError(state, "duplication of %YAML directive");
    if (args.length !== 1) throwError(state, "YAML directive accepts exactly one argument");
    const match2 = /^([0-9]+)\.([0-9]+)$/.exec(args[0]);
    if (match2 === null) throwError(state, "ill-formed argument of the YAML directive");
    if (parseInt(match2[1], 10) !== 1) throwError(state, "unacceptable YAML version of the document");
    state.directives.push({
      kind: "yaml",
      version: args[0]
    });
  } else if (name === "TAG") {
    if (args.length !== 2) throwError(state, "TAG directive accepts exactly two arguments");
    const [handle, prefix] = args;
    if (!PATTERN_TAG_HANDLE.test(handle)) throwError(state, "ill-formed tag handle (first argument) of the TAG directive");
    if (HAS_OWN.call(state.tagHandlers, handle)) throwError(state, `there is a previously declared suffix for "${handle}" tag handle`);
    if (!PATTERN_TAG_PREFIX.test(prefix)) throwError(state, "ill-formed tag prefix (second argument) of the TAG directive");
    state.tagHandlers[handle] = prefix;
    state.directives.push({
      kind: "tag",
      handle,
      prefix
    });
  }
  return true;
}
function readDocument(state) {
  state.directives = [];
  state.tagHandlers = /* @__PURE__ */ Object.create(null);
  let hasDirectives = false;
  skipSeparationSpace(state, true);
  while (readDirective(state)) {
    hasDirectives = true;
    skipSeparationSpace(state, true);
  }
  let explicitStart = false;
  let explicitEnd = false;
  let allowCompact = true;
  if (state.lineIndent === 0 && state.input.charCodeAt(state.position) === 45 && state.input.charCodeAt(state.position + 1) === 45 && state.input.charCodeAt(state.position + 2) === 45 && isWsOrEolOrEnd(state.input.charCodeAt(state.position + 3))) {
    explicitStart = true;
    const markerLine = state.line;
    state.position += 3;
    skipSeparationSpace(state, true);
    allowCompact = state.line > markerLine;
  } else if (hasDirectives) throwError(state, "directives end mark is expected");
  const documentEventIndex = state.events.length;
  if (!explicitStart && state.position === state.lineStart && state.input.charCodeAt(state.position) === 46 && testDocumentSeparator(state)) {
    state.position += 3;
    skipSeparationSpace(state, true);
    return;
  }
  addDocumentEvent(state, explicitStart, false);
  if (!parseNode(state, state.lineIndent - 1, CONTEXT_BLOCK_OUT, false, allowCompact, allowCompact)) addEmptyScalarEvent(state);
  skipSeparationSpace(state, true);
  if (state.position === state.lineStart && testDocumentSeparator(state)) {
    explicitEnd = state.input.charCodeAt(state.position) === 46;
    if (explicitEnd) {
      const markerLine = state.line;
      state.position += 3;
      skipSeparationSpace(state, true);
      if (state.line === markerLine && state.position < state.length) throwError(state, "end of the stream or a document separator is expected");
    }
  }
  const documentEvent = state.events[documentEventIndex];
  if (documentEvent?.type === EVENT_ID.DOCUMENT) documentEvent.explicitEnd = explicitEnd;
  addPopEvent(state);
  if (!explicitEnd && state.position < state.length && !testDocumentBoundary(state)) throwError(state, "end of the stream or a document separator is expected");
}
function parseEvents(input, options) {
  const length2 = input.length;
  const state = {
    ...DEFAULT_PARSER_OPTIONS,
    ...options,
    input: `${input}\0`,
    length: length2,
    position: 0,
    line: 0,
    lineStart: 0,
    lineIndent: 0,
    firstTabInLine: -1,
    depth: 0,
    directives: [],
    tagHandlers: /* @__PURE__ */ Object.create(null),
    events: []
  };
  const nullpos = input.indexOf("\0");
  if (nullpos !== -1) YAMLException.throwAt(input, nullpos, "null byte is not allowed in input", state.filename);
  while (state.position < state.length) {
    skipByteOrderMark(state);
    skipSeparationSpace(state, true);
    if (state.position >= state.length) break;
    const documentStart = state.position;
    readDocument(state);
    if (state.position === documentStart)
      throwError(state, "can not read a document");
  }
  return state.events;
}
var DEFAULT_LOAD_OPTIONS = {
  ...DEFAULT_PARSER_OPTIONS,
  ...DEFAULT_CONSTRUCTOR_OPTIONS
};
function loadDocuments(input, options = {}) {
  const opts = {
    ...DEFAULT_LOAD_OPTIONS,
    ...options
  };
  const source = String(input);
  const PARSER_OPT_KEYS = Object.keys(DEFAULT_PARSER_OPTIONS);
  const CONSTRUCTOR_OPT_KEYS = Object.keys(DEFAULT_CONSTRUCTOR_OPTIONS);
  return constructFromEvents(parseEvents(source, pick(opts, PARSER_OPT_KEYS)), {
    ...pick(opts, CONSTRUCTOR_OPT_KEYS),
    source
  });
}
function loadAll(input, iteratorOrOptions, options) {
  let iterator = null;
  if (typeof iteratorOrOptions === "function") iterator = iteratorOrOptions;
  else if (iteratorOrOptions !== null && typeof iteratorOrOptions === "object") options = iteratorOrOptions;
  const documents = loadDocuments(input, options);
  if (iterator === null) return documents;
  for (const document of documents) iterator(document);
}
function hasBit(mask, bit) {
  return (mask & 1 << bit) !== 0;
}
var DEFAULT_SCALAR_STYLE_RULES = {
  applyQuoteFlowKeysOption,
  doubleQuoteForInvisibles,
  doubleQuoteWhitespaceOnly,
  applyForceQuotesOption,
  tryLongOrMultilineAsBlock,
  quoteInvalidPlain,
  fallbackToDoubleQuoted
};
function _preferredQuotedStyle(layout) {
  if (layout.presenterOptions.quoteStyle === "single" && hasBit(layout.allowedStylesMask, SCALAR_STYLE.SINGLE_QUOTED)) return SCALAR_STYLE.SINGLE_QUOTED;
  return SCALAR_STYLE.DOUBLE_QUOTED;
}
function applyQuoteFlowKeysOption(layout) {
  if (!layout.presenterOptions.quoteFlowKeys) return;
  if (!layout.isKey || !layout.flowOnly || layout.style !== SCALAR_STYLE.PLAIN) return;
  layout.style = SCALAR_STYLE.DOUBLE_QUOTED;
}
function doubleQuoteForInvisibles(layout) {
  if (layout.style === SCALAR_STYLE.PLAIN && /[\t\x7F-\xA0\u2028\u2029\uFEFF\uFFFE\uFFFF]/.test(layout.node.value)) layout.style = SCALAR_STYLE.DOUBLE_QUOTED;
}
function doubleQuoteWhitespaceOnly(layout) {
  if (layout.style === SCALAR_STYLE.PLAIN && /^\s+$/.test(layout.node.value)) layout.style = SCALAR_STYLE.DOUBLE_QUOTED;
}
function applyForceQuotesOption(layout) {
  if (!layout.presenterOptions.forceQuotes) return;
  if (layout.isKey || layout.style !== SCALAR_STYLE.PLAIN) return;
  if (layout.node.tag !== layout.presenterOptions.schema.defaultScalarTag.tagName) return;
  layout.style = layout.node.value.includes("\n") ? SCALAR_STYLE.DOUBLE_QUOTED : _preferredQuotedStyle(layout);
}
function tryLongOrMultilineAsBlock(layout) {
  if (layout.style !== SCALAR_STYLE.PLAIN || layout.isKey) return;
  const value = layout.node.value;
  const multiline = value.indexOf("\n") !== -1;
  if (!hasBit(layout.allowedStylesMask, SCALAR_STYLE.LITERAL_BLOCK)) {
    if (multiline) layout.style = SCALAR_STYLE.DOUBLE_QUOTED;
    return;
  }
  const w = layout.presenterOptions.lineWidth;
  if (w === -1) {
    if (multiline) layout.style = SCALAR_STYLE.LITERAL_BLOCK;
    return;
  }
  const availableWidth = Math.max(Math.min(w, 40), w - layout.shiftOfContent);
  let position = 0;
  let shouldFold = false;
  while (position <= value.length) {
    let lineEnd = value.length;
    const nextLineBreak = value.indexOf("\n", position);
    if (nextLineBreak !== -1) lineEnd = nextLineBreak;
    const line = value.slice(position, lineEnd);
    if (line.length > availableWidth && line[0] !== " " && / [^ \t]/.test(line)) shouldFold = true;
    if (nextLineBreak === -1) break;
    position = nextLineBreak + 1;
  }
  if (shouldFold) layout.style = SCALAR_STYLE.FOLDED_BLOCK;
  else if (multiline) layout.style = SCALAR_STYLE.LITERAL_BLOCK;
}
function quoteInvalidPlain(layout) {
  if (layout.style === SCALAR_STYLE.PLAIN && !hasBit(layout.allowedStylesMask, SCALAR_STYLE.PLAIN)) layout.style = _preferredQuotedStyle(layout);
}
function fallbackToDoubleQuoted(layout) {
  if (!hasBit(layout.allowedStylesMask, layout.style)) layout.style = SCALAR_STYLE.DOUBLE_QUOTED;
}
({
  scalarStyleRules: Object.keys(DEFAULT_SCALAR_STYLE_RULES).map((name) => Reflect.get(DEFAULT_SCALAR_STYLE_RULES, name))
});
function parseYaml(content) {
  const documents = loadAll(content, { schema: JSON_SCHEMA });
  if (documents.length > 1) {
    throw new YAMLException("expected a single document in the stream, but found more");
  }
  return documents[0];
}
const bracketPairs = {
  "[": "]",
  "{": "}",
  "(": ")"
};
const quotePairs = {
  "'": "'",
  '"': '"',
  "`": "`"
};
function searchProps(content, index2 = 0) {
  if (content[index2] !== "{")
    throw new Error(`Invalid props, expected \`{\` but got '${content[index2]}'`);
  const props = [];
  if (content[index2 + 1] === "{")
    return void 0;
  index2 += 1;
  while (index2 < content.length) {
    if (content[index2] === "\\") {
      index2 += 2;
    } else if (content[index2] === "}") {
      index2 += 1;
      break;
    } else if (content[index2] === " ") {
      index2 += 1;
    } else if (content[index2] === ".") {
      index2 += 1;
      props.push(["class", searchUntil(" #.}")]);
    } else if (content[index2] === "#") {
      index2 += 1;
      props.push(["id", searchUntil(" #.}")]);
    } else {
      const start = index2;
      while (index2 < content.length) {
        index2 += 1;
        if (" }=".includes(content[index2]))
          break;
      }
      const char = content[index2];
      if (start !== index2) {
        let key = content.slice(start, index2).trim();
        let value = "";
        if (char === "=") {
          index2 += 1;
          value = searchValue();
        } else {
          key = key[0] === ":" ? key : `:${key}`;
          value = "true";
        }
        if (key.match(/^:?[a-z_][a-z0-9_-]*$/gi)) {
          props.push([key, value]);
        }
      }
    }
  }
  function searchUntil(str) {
    const start = index2;
    while (index2 < content.length) {
      index2 += 1;
      if (content[index2] === "\\")
        index2 += 2;
      if (str.includes(content[index2]))
        break;
    }
    return content.slice(start, index2);
  }
  function searchValue() {
    const start = index2;
    if (content[index2] in bracketPairs) {
      searchBracket(bracketPairs[content[index2]]);
      index2 += 1;
      return content.slice(start, index2);
    } else if (content[index2] in quotePairs) {
      searchString(quotePairs[content[index2]]);
      index2 += 1;
      return content.slice(start, index2);
    } else {
      return searchUntil(" }");
    }
  }
  function searchBracket(end) {
    while (index2 < content.length) {
      index2++;
      if (content[index2] in quotePairs)
        searchString(quotePairs[content[index2]]);
      else if (content[index2] in bracketPairs)
        searchBracket(bracketPairs[content[index2]]);
      else if (content[index2] === end)
        return;
    }
  }
  function searchString(end) {
    return searchUntil(end);
  }
  props.forEach((v) => {
    if (/^(['"`]).*\1$/.test(v[1]))
      v[1] = v[1].slice(1, -1);
  });
  return {
    props,
    index: index2
  };
}
const RE_BLOCK_NAME = /^[a-z$][$\w.-]*/i;
function parseBlockParams(str) {
  str = str.trim();
  if (!str)
    return { name: "" };
  const name = str.match(RE_BLOCK_NAME)?.[0];
  if (!name)
    throw new Error(`Invalid block params: ${str}`);
  let remaining = str.slice(name.length).trim();
  let content;
  let props;
  let unparsedRemaining;
  if (remaining.startsWith("[")) {
    const result2 = parseBracketContent(remaining, 0);
    if (result2) {
      content = result2.content;
      remaining = remaining.slice(result2.endIndex).trim();
    }
  }
  if (remaining.startsWith("{")) {
    const propsResult = searchProps(remaining, 0);
    if (propsResult) {
      props = propsResult.props;
      const afterProps = remaining.slice(propsResult.index).trim();
      if (afterProps)
        unparsedRemaining = afterProps;
    }
  } else if (remaining) {
    unparsedRemaining = remaining;
  }
  const result = {
    name: kebabCase(name)
  };
  if (content !== void 0)
    result.content = content;
  if (props !== void 0)
    result.props = props;
  if (unparsedRemaining)
    result.remaining = unparsedRemaining;
  return result;
}
function dedentLine(state, line, columns) {
  const lineStart = state.bMarks[line];
  const max = state.eMarks[line];
  let pos = lineStart;
  let consumed = 0;
  while (pos < max && consumed < columns) {
    const code2 = state.src.charCodeAt(pos);
    if (code2 === 32) {
      consumed++;
    } else if (code2 === 9) {
      const width = 4 - (consumed + state.bsCount[line]) % 4;
      if (consumed + width > columns)
        return false;
      consumed += width;
    } else {
      break;
    }
    pos++;
  }
  if (consumed > 0) {
    state.bMarks[line] = pos;
    state.bsCount[line] += consumed;
    state.sCount[line] -= consumed;
    state.tShift[line] -= pos - lineStart;
  }
  return true;
}
function tokenizeDedented(state, from2, to, shifts) {
  const bMarks = [];
  const bsCount = [];
  const sCount = [];
  const tShift = [];
  for (let line = from2; line < to; line++) {
    bMarks.push(state.bMarks[line]);
    bsCount.push(state.bsCount[line]);
    sCount.push(state.sCount[line]);
    tShift.push(state.tShift[line]);
    if (!dedentLine(state, line, shifts[line - from2])) {
      restoreLines(state, from2, bMarks, bsCount, sCount, tShift);
      return false;
    }
  }
  const blkIndent = state.blkIndent;
  state.blkIndent = 0;
  state.md.block.tokenize(state, from2, to);
  state.blkIndent = blkIndent;
  restoreLines(state, from2, bMarks, bsCount, sCount, tShift);
  return true;
}
function restoreLines(state, from2, bMarks, bsCount, sCount, tShift) {
  for (let i = 0; i < bMarks.length; i++) {
    const line = from2 + i;
    state.bMarks[line] = bMarks[i];
    state.bsCount[line] = bsCount[i];
    state.sCount[line] = sCount[i];
    state.tShift[line] = tShift[i];
  }
}
const RE_COMPONENT_NAME = /^[a-z$][\w$-]*/i;
function isValidComponentName(name) {
  return RE_COMPONENT_NAME.test(name);
}
const blockYamlLines = {
  "---": "---",
  "```yaml [props]": "```",
  "~~~yaml [props]": "~~~",
  "```yml [props]": "```",
  "~~~yml [props]": "~~~"
};
const markdownItComarkBlock = (md) => {
  const min_markers = 2;
  const marker_str = ":";
  const marker_char = marker_str.charCodeAt(0);
  md.block.ruler.before("fence", "comark_block_shorthand", function comark_block_shorthand(state, startLine, _endLine, silent) {
    const line = state.src.slice(state.bMarks[startLine] + state.tShift[startLine], state.eMarks[startLine]);
    if (line[0] !== ":" || !isValidComponentName(line.slice(1)))
      return false;
    const { name, content, props, remaining } = parseBlockParams(line.slice(1));
    if (remaining)
      return false;
    if (!silent) {
      if (content !== void 0) {
        const tokenOpen = state.push("mdc_block_shorthand", name, 1);
        props?.forEach(([key, value]) => {
          if (key === "class")
            tokenOpen.attrJoin(key, value);
          else
            tokenOpen.attrSet(key, value);
        });
        tokenOpen.map = [startLine, startLine + 1];
        const inline2 = state.push("inline", "", 0);
        inline2.content = content;
        inline2.children = [];
        const tokenClose = state.push("mdc_block_shorthand", name, -1);
        tokenClose.map = [startLine, startLine + 1];
      } else {
        const token = state.push("mdc_block_shorthand", name, 0);
        token.map = [startLine, startLine + 1];
        props?.forEach(([key, value]) => {
          if (key === "class")
            token.attrJoin(key, value);
          else
            token.attrSet(key, value);
        });
      }
    }
    state.line = startLine + 1;
    return true;
  });
  md.block.ruler.before("fence", "comark_block", function comark_block(state, startLine, endLine, silent) {
    let pos;
    let nextLine;
    let auto_closed = false;
    let start = state.bMarks[startLine] + state.tShift[startLine];
    let max = state.eMarks[startLine];
    const indent = state.sCount[startLine];
    let inCodeFence = false;
    let codeFenceCharCode = 0;
    let codeFenceCount = 0;
    let nestingDepth = 0;
    if (state.src[start] !== ":")
      return false;
    for (pos = start + 1; pos <= max; pos++) {
      if (marker_str !== state.src[pos])
        break;
    }
    const marker_count = Math.floor(pos - start);
    if (marker_count < min_markers)
      return false;
    const markup = state.src.slice(start, pos);
    const nameStart = state.skipSpaces(pos);
    if (nameStart < max && !isValidComponentName(state.src.slice(nameStart, max)))
      return false;
    const params2 = parseBlockParams(state.src.slice(pos, max));
    if (!params2.name)
      return false;
    if (silent)
      return true;
    const childShifts = [];
    let codeFenceShift = 0;
    let hasOutdentedChild = false;
    nextLine = startLine;
    for (; ; ) {
      nextLine++;
      if (nextLine >= endLine)
        break;
      start = state.bMarks[nextLine] + state.tShift[nextLine];
      max = state.eMarks[nextLine];
      if (start < max && state.sCount[nextLine] < state.blkIndent)
        break;
      const lineIndent = start >= max ? indent : state.sCount[nextLine];
      if (lineIndent < indent)
        hasOutdentedChild = true;
      childShifts.push(start >= max ? 0 : inCodeFence ? codeFenceShift : Math.min(indent, lineIndent));
      const lineCharCode = state.src.charCodeAt(start);
      if (inCodeFence) {
        if (lineCharCode === codeFenceCharCode) {
          let fencePos = start + 1;
          while (fencePos < max && state.src.charCodeAt(fencePos) === codeFenceCharCode)
            fencePos++;
          if (fencePos - start >= codeFenceCount) {
            const afterFence = state.skipSpaces(fencePos);
            if (afterFence >= max)
              inCodeFence = false;
          }
        }
        continue;
      }
      if (lineCharCode === 96 || lineCharCode === 126) {
        let fencePos = start + 1;
        while (fencePos < max && state.src.charCodeAt(fencePos) === lineCharCode)
          fencePos++;
        if (fencePos - start >= 3) {
          inCodeFence = true;
          codeFenceCharCode = lineCharCode;
          codeFenceCount = fencePos - start;
          codeFenceShift = childShifts[childShifts.length - 1];
          continue;
        }
      }
      if (marker_char !== lineCharCode)
        continue;
      for (pos = start + 1; pos <= max; pos++) {
        if (marker_str !== state.src[pos])
          break;
      }
      if (pos - start !== marker_count)
        continue;
      pos = state.skipSpaces(pos);
      if (pos < max) {
        nestingDepth++;
        continue;
      }
      if (nestingDepth > 0) {
        nestingDepth--;
        continue;
      }
      auto_closed = true;
      break;
    }
    const old_parent = state.parentType;
    const old_line_max = state.lineMax;
    state.parentType = "comark_block";
    state.lineMax = nextLine;
    const tokenOpen = state.push("mdc_block_open", params2.name, 1);
    tokenOpen.markup = markup;
    tokenOpen.block = true;
    tokenOpen.info = params2.name;
    tokenOpen.map = [startLine, nextLine];
    params2.props?.forEach(([key, value]) => {
      if (key === "class")
        tokenOpen.attrJoin(key, value);
      else
        tokenOpen.attrSet(key, value);
    });
    if (params2.content !== void 0) {
      const pOpen = state.push("paragraph_open", "p", 1);
      pOpen.map = [startLine, startLine + 1];
      const inline2 = state.push("inline", "", 0);
      inline2.content = params2.content;
      inline2.children = [];
      state.push("paragraph_close", "p", -1);
    }
    state.env.comarkBlockTokens ||= [];
    state.env.comarkBlockTokens.unshift(tokenOpen);
    if (!hasOutdentedChild || !tokenizeDedented(state, startLine + 1, nextLine, childShifts)) {
      const blkIndent = state.blkIndent;
      state.blkIndent = indent;
      state.md.block.tokenize(state, startLine + 1, nextLine);
      state.blkIndent = blkIndent;
    }
    state.env.comarkBlockTokens.shift();
    const tokenClose = state.push("mdc_block_close", params2.name, -1);
    tokenClose.map = [startLine, nextLine];
    tokenClose.markup = state.src.slice(start, pos);
    tokenClose.block = true;
    state.tokens.slice(state.tokens.indexOf(tokenOpen) + 1, state.tokens.indexOf(tokenClose)).filter((i) => i.level === tokenOpen.level + 1).forEach((i, _, arr) => {
      if (arr.length <= 2 && i.tag === "p")
        i.hidden = true;
    });
    state.parentType = old_parent;
    state.lineMax = old_line_max;
    state.line = nextLine + (auto_closed ? 1 : 0);
    return true;
  }, {
    alt: ["paragraph", "reference", "blockquote", "list"]
  });
  md.block.ruler.after("code", "comark_block_yaml", function comark_block_yaml(state, startLine, endLine, silent) {
    if (!state.env.comarkBlockTokens?.length)
      return false;
    const start = state.bMarks[startLine] + state.tShift[startLine];
    const end = state.eMarks[startLine];
    const line = state.src.slice(start, end);
    const blockAttributesClosingFence = blockYamlLines[line] || "";
    if (!blockAttributesClosingFence)
      return false;
    if (line === "---") {
      const parentOpenLine = state.env.comarkBlockTokens[0].map?.[0];
      if (parentOpenLine === void 0 || startLine !== parentOpenLine + 1)
        return false;
    }
    let lineEnd = startLine + 1;
    let found = false;
    while (lineEnd < endLine) {
      const inner = state.src.slice(state.bMarks[lineEnd] + state.tShift[startLine], state.eMarks[lineEnd]);
      if (inner === blockAttributesClosingFence) {
        found = true;
        break;
      }
      lineEnd += 1;
    }
    if (!found)
      return false;
    if (!silent) {
      const yaml = state.getLines(startLine + 1, lineEnd, state.blkIndent, false);
      const data = parseYaml(yaml);
      const token = state.env.comarkBlockTokens[0];
      Object.entries(data || {}).forEach(([key, value]) => {
        if (key === "class") {
          token.attrJoin(key, value);
          return;
        }
        if (typeof value === "string") {
          token.attrSet(key, value);
        } else {
          token.attrSet(`:${key}`, JSON.stringify(value));
        }
      });
    }
    state.line = lineEnd + 1;
    return true;
  });
  md.block.ruler.after("code", "comark_block_slots", function comark_block_slots(state, startLine, endLine, silent) {
    if (!state.env.comarkBlockTokens?.length)
      return false;
    const start = state.bMarks[startLine] + state.tShift[startLine];
    if (!(state.src[start] === "#" && state.src[start + 1] !== " " && state.src[start + 1] !== "#"))
      return false;
    const line = state.src.slice(start, state.eMarks[startLine]);
    const { name, props } = parseBlockParams(line.slice(1));
    let lineEnd = startLine + 1;
    let inCodeFence = false;
    let codeFenceChar = "";
    let codeFenceCount = 0;
    while (lineEnd < endLine) {
      const inner = state.src.slice(state.bMarks[lineEnd] + state.tShift[startLine], state.eMarks[lineEnd]);
      if (inCodeFence) {
        if (inner[0] === codeFenceChar) {
          let fencePos = 1;
          while (fencePos < inner.length && inner[fencePos] === codeFenceChar)
            fencePos++;
          if (fencePos >= codeFenceCount && inner.slice(fencePos).trim() === "") {
            inCodeFence = false;
          }
        }
        lineEnd += 1;
        continue;
      }
      if (inner[0] === "`" || inner[0] === "~") {
        const ch = inner[0];
        let fencePos = 1;
        while (fencePos < inner.length && inner[fencePos] === ch)
          fencePos++;
        if (fencePos >= 3) {
          inCodeFence = true;
          codeFenceChar = ch;
          codeFenceCount = fencePos;
          lineEnd += 1;
          continue;
        }
      }
      if (/^#\w+/.test(inner) || inner.startsWith("::"))
        break;
      lineEnd += 1;
    }
    if (silent) {
      state.line = lineEnd;
      return true;
    }
    const oldLineMax = state.lineMax;
    const slot = state.push("mdc_block_slot", "template", 1);
    slot.attrSet(`#${name}`, "");
    props?.forEach(([key, value]) => {
      if (key === "class")
        slot.attrJoin(key, value);
      else
        slot.attrSet(key, value);
    });
    state.line = startLine + 1;
    state.lineMax = lineEnd;
    state.md.block.tokenize(state, startLine + 1, lineEnd);
    state.push("mdc_block_slot", "template", -1);
    state.line = lineEnd;
    state.lineMax = oldLineMax;
    return true;
  });
};
const ALLOWED_PREV_CHARS = /* @__PURE__ */ new Set([" ", "	", "\n", "*", "_", "["]);
const markdownItInlineComponent = (md) => {
  md.inline.ruler.after("entity", "comark_inline_component", (state, silent) => {
    const start = state.pos;
    if (state.src[start] !== ":")
      return false;
    const prevChar = state.src[start - 1];
    if (start > 0 && !ALLOWED_PREV_CHARS.has(prevChar))
      return false;
    let index2 = start + 1;
    let nameEnd = -1;
    let contentStart = -1;
    let contentEnd = -1;
    while (index2 < state.src.length) {
      const char = state.src[index2];
      if (char === "[") {
        nameEnd = index2;
        const result = parseBracketContent(state.src, index2);
        if (result) {
          contentStart = index2 + 1;
          contentEnd = result.endIndex - 1;
          index2 = result.endIndex;
        }
        break;
      }
      if (!/[\w$-]/.test(char))
        break;
      index2 += 1;
    }
    if (nameEnd === -1)
      nameEnd = index2;
    if (nameEnd <= start + 1)
      return false;
    const name = state.src.slice(start + 1, nameEnd);
    if (!isValidComponentName(name))
      return false;
    state.pos = index2;
    if (silent)
      return true;
    if (contentStart !== -1) {
      state.push("mdc_inline_component", name, 1);
      const oldPos = state.pos;
      const oldPosMax = state.posMax;
      state.pos = contentStart;
      state.posMax = contentEnd;
      state.md.inline.tokenize(state);
      state.pos = oldPos;
      state.posMax = oldPosMax;
      state.push("mdc_inline_component", name, -1);
    } else {
      state.push("mdc_inline_component", name, 0);
    }
    return true;
  });
};
const markdownItInlineSpan = (md) => {
  md.inline.ruler.before("link", "comark_inline_span", (state, silent) => {
    const start = state.pos;
    if (state.src[start] !== "[")
      return false;
    const close = findClosingBracket(state.src, start);
    const index2 = close === -1 ? state.src.length : close;
    const nextChar = state.src[index2 + 1];
    if (nextChar === "(" || nextChar === "[")
      return false;
    if (state.linkLevel > 0 && nextChar !== "{")
      return false;
    if (silent)
      return false;
    state.push("mdc_inline_span", "span", 1);
    const oldPos = state.pos;
    const oldPosMax = state.posMax;
    state.pos = start + 1;
    state.posMax = index2;
    state.md.inline.tokenize(state);
    state.pos = oldPos;
    state.posMax = oldPosMax;
    state.push("mdc_inline_span", "span", -1);
    state.pos = index2 + 1;
    return true;
  });
};
const markdownItComponents = (md) => {
  md.use(markdownItComarkBlock);
  md.use(markdownItInlineSpan);
  md.use(markdownItInlineComponent);
};
const components = defineComarkPlugin(() => ({
  name: "components",
  markdownItPlugins: [markdownItComponents]
}));
const markdownItInlineProps = (md) => {
  md.inline.ruler.after("entity", "comark_inline_props", (state, silent) => {
    const start = state.pos;
    if (state.src[start] !== "{")
      return false;
    if (state.src[start + 1] === "{" || state.src[start - 1] === "{" || state.src[start - 1] === "$")
      return false;
    const search = searchProps(state.src, start);
    if (!search)
      return false;
    const { props, index: end } = search;
    if (end === start)
      return false;
    state.pos = end;
    if (silent)
      return true;
    const token = state.push("mdc_inline_props", "span", 0);
    token.attrs = props;
    token.hidden = true;
    return true;
  });
  md.renderer.rules.mdc_inline_props = () => "";
  const _parse = md.parse;
  md.parse = function(src2, env) {
    const tokens = _parse.call(this, src2, env);
    tokens.forEach((token, index2) => {
      const prev = tokens[index2 - 1];
      const next = tokens[index2 + 1];
      if (!prev || !["heading_open", "paragraph_open", "list_item_open"].includes(prev.type) || prev.hidden)
        return;
      if (token.hidden && next?.type === "inline")
        token = next;
      if (token.type !== "inline" || !token.children?.length)
        return;
      const last = token.children[token.children.length - 1];
      if (last.type !== "mdc_inline_props")
        return;
      let beforeIdx = token.children.length - 2;
      while (beforeIdx >= 0) {
        const child = token.children[beforeIdx];
        if (child.type === "text" && !child.content) {
          beforeIdx--;
          continue;
        }
        break;
      }
      const beforeProps = beforeIdx >= 0 ? token.children[beforeIdx] : void 0;
      if (!beforeProps || beforeProps.type !== "text")
        return;
      if (typeof beforeProps.content === "string") {
        beforeProps.content = beforeProps.content.replace(/[ \t]+$/, "");
      }
      const props = last.attrs;
      token.children.length = beforeProps.content ? beforeIdx + 1 : beforeIdx;
      props?.forEach(([key, value]) => {
        if (key === "class")
          prev.attrJoin("class", value);
        else
          prev.attrSet(key, value);
      });
    });
    return tokens;
  };
  md.renderer.renderInline = wrapRenderInline(md.renderer.renderInline);
  if ("renderInlineAsync" in md.renderer) {
    md.renderer.renderInlineAsync = wrapRenderInline(md.renderer.renderInlineAsync);
  }
};
function wrapRenderInline(renderInline) {
  return function(tokens, options, env) {
    tokens = [...tokens];
    tokens.forEach((token, index2) => {
      if (token.type !== "mdc_inline_props")
        return;
      let prevIndex = index2 - 1;
      let prev = tokens[prevIndex];
      while (prevIndex >= 0) {
        if (prev.type === "text" && !prev.content.trim()) {
          prevIndex--;
          prev = tokens[prevIndex];
        } else {
          break;
        }
      }
      if (!prev.tag && prev.type === "text") {
        prev = new Token("mdc_inline_span", "span", 1);
        tokens.splice(index2 - 1, 0, prev);
        const close = new Token("mdc_inline_span", "span", -1);
        tokens.splice(index2 + 2, 0, close);
      } else if (prev.nesting === -1) {
        let searchIndex = index2 - 1;
        while (searchIndex >= 0) {
          const searchToken = tokens[searchIndex];
          if (searchToken.nesting === 1 && searchToken.tag === prev.tag && searchToken.level === prev.level) {
            prev = searchToken;
            break;
          }
          searchIndex--;
        }
      }
      if (prev.nesting === -1)
        throw new Error(`No matching opening tag found for ${JSON.stringify(prev)}`);
      token.attrs?.forEach(([key, value]) => {
        if (key === "class")
          prev.attrJoin("class", value);
        else
          prev.attrSet(key, value);
      });
    });
    return renderInline.call(this, tokens, options, env);
  };
}
const markdownItAttributes = markdownItInlineProps;
const attributes = defineComarkPlugin(() => ({
  name: "attributes",
  markdownItPlugins: [markdownItAttributes]
}));
function attrSet(token, name, value) {
  const index2 = token.attrIndex(name);
  const attr = [name, value];
  if (index2 < 0) {
    if (!token.attrs) {
      token.attrs = [];
    }
    token.attrs.push(attr);
  } else {
    token.attrs[index2] = attr;
  }
}
function markdownItTaskList(md, options) {
  const disableCheckboxes = !(options?.enabled ?? false);
  md.core.ruler.before("inline", "task-lists-mdc", (state) => {
    const tokens = state.tokens;
    const openItems = [];
    const openItemLists = [];
    const openLists = [];
    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];
      if (token.type === "bullet_list_open" || token.type === "ordered_list_open") {
        openLists.push(i);
        continue;
      }
      if (token.type === "bullet_list_close" || token.type === "ordered_list_close") {
        openLists.pop();
        continue;
      }
      if (token.type === "list_item_open") {
        openItems.push(i);
        openItemLists.push(openLists.length > 0 ? openLists[openLists.length - 1] : -1);
        continue;
      }
      if (token.type === "list_item_close") {
        openItems.pop();
        openItemLists.pop();
        continue;
      }
      if (token.type === "inline" && token.content && openItems.length > 0) {
        const match2 = token.content.match(/^(\[[ x]\])\s+/i);
        if (match2) {
          const isChecked = match2[1].toLowerCase() === "[x]";
          attrSet(tokens[openItems[openItems.length - 1]], "class", "task-list-item");
          const listIdx = openItemLists[openItemLists.length - 1];
          if (listIdx >= 0) {
            attrSet(tokens[listIdx], "class", "contains-task-list");
          }
          const checkboxPlaceholder = `TASK_CHECKBOX_${isChecked ? "CHECKED" : "UNCHECKED"} `;
          token.content = token.content.replace(/^\[[ x]\]\s+/i, checkboxPlaceholder);
        }
      }
    }
  });
  md.core.ruler.after("inline", "task-lists-mdc-post", (state) => {
    const tokens = state.tokens;
    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];
      if (token.type === "inline" && token.children) {
        for (let j = 0; j < token.children.length; j++) {
          const child = token.children[j];
          if (child.type === "text" && child.content) {
            const checkedMatch = child.content.match(/^TASK_CHECKBOX_CHECKED/);
            const uncheckedMatch = child.content.match(/^TASK_CHECKBOX_UNCHECKED/);
            if (checkedMatch || uncheckedMatch) {
              const isChecked = !!checkedMatch;
              const checkbox = new state.Token("mdc_inline_component", "input", 0);
              checkbox.attrs = [
                ["class", "task-list-item-checkbox"],
                ["type", "checkbox"]
              ];
              if (disableCheckboxes) {
                checkbox.attrs.push([":disabled", "true"]);
              }
              if (isChecked) {
                checkbox.attrs.push([":checked", "true"]);
              }
              child.content = child.content.replace(/^TASK_CHECKBOX_(CHECKED|UNCHECKED)/, "");
              token.children.splice(j, 0, checkbox);
              j++;
            }
          }
        }
      }
    }
  });
}
const taskList = defineComarkPlugin(() => ({
  name: "task-list",
  markdownItPlugins: [markdownItTaskList]
}));
const markers = {
  "!TIP": {
    type: "tip",
    title: "Tip",
    color: "#238636"
  },
  "!NOTE": {
    type: "note",
    title: "Note",
    color: "#1f6feb"
  },
  "!IMPORTANT": {
    type: "important",
    title: "Important",
    color: "#8957e5"
  },
  "!WARNING": {
    type: "warning",
    title: "Warning",
    color: "#9e6a03"
  },
  "!CAUTION": {
    type: "caution",
    title: "Caution",
    color: "#da3633"
  }
};
const alert = defineComarkPlugin(() => ({
  name: "alert",
  post(state) {
    visit(state.tree, (node) => Array.isArray(node) && node[0] === "blockquote", (node) => {
      const element = node;
      if (node[2]?.[0] === "span") {
        const content = String(node[2][2]).toUpperCase();
        const marker = markers[content];
        if (marker) {
          if (typeof node[3] === "string") {
            element[3] = String(element[3]).trimStart();
          }
          element.splice(2, 1);
          element[1].as = marker.type;
        }
      } else if (node[2]?.[0] === "p") {
        const paragraph2 = node[2];
        if (paragraph2[2]?.[0] === "span") {
          const content = String(paragraph2[2][2]).toUpperCase();
          const marker = markers[content];
          if (marker) {
            if (typeof paragraph2[3] === "string") {
              paragraph2[3] = String(paragraph2[3]).trimStart();
            }
            paragraph2.splice(2, 1);
            element[1].as = marker.type;
          }
        }
      }
    });
  }
}));
const block_names = [
  "address",
  "article",
  "aside",
  "base",
  "basefont",
  "blockquote",
  "body",
  "caption",
  "center",
  "col",
  "colgroup",
  "dd",
  "details",
  "dialog",
  "dir",
  "div",
  "dl",
  "dt",
  "fieldset",
  "figcaption",
  "figure",
  "footer",
  "form",
  "frame",
  "frameset",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "head",
  "header",
  "hr",
  "html",
  "iframe",
  "legend",
  "li",
  "link",
  "main",
  "menu",
  "menuitem",
  "nav",
  "noframes",
  "ol",
  "optgroup",
  "option",
  "p",
  "param",
  "search",
  "section",
  "summary",
  "table",
  "tbody",
  "td",
  "tfoot",
  "th",
  "thead",
  "title",
  "tr",
  "track",
  "ul"
];
const attr_name = "[a-zA-Z_:][a-zA-Z0-9:._-]*";
const unquoted = "[^\"'=<>`\\x00-\\x20]+";
const single_quoted = "'[^']*'";
const double_quoted = '"[^"]*"';
const attr_value = `(?:${unquoted}|${single_quoted}|${double_quoted})`;
const attribute = `(?:\\s+${attr_name}(?:\\s*=\\s*${attr_value})?)`;
const open_tag = `<[A-Za-z][A-Za-z0-9\\-]*${attribute}*\\s*\\/?>`;
const close_tag = "<\\/[A-Za-z][A-Za-z0-9\\-]*\\s*>";
const comment = "<!---?>|<!--(?:[^-]|-[^-]|--[^>])*-->";
const processing = "<\\?[\\s\\S]*?\\?>";
const declaration = "<![A-Za-z][^>]*>";
const cdata = "<!\\[CDATA\\[[\\s\\S]*?\\]\\]>";
const HTML_TAG_RE = new RegExp(`^(?:${open_tag}|${close_tag}|${comment}|${processing}|${declaration}|${cdata})`);
const HTML_OPEN_CLOSE_TAG_RE = new RegExp(`^(?:${open_tag}|${close_tag})`);
const HTML_SEQUENCES = [
  [/^<(script|pre|style|textarea)(?=(\s|>|$))/i, /<\/(script|pre|style|textarea)>/i, true],
  [/^<!--/, /-->/, true],
  [/^<\?/, /\?>/, true],
  [/^<![A-Z]/, />/, true],
  [/^<!\[CDATA\[/, /\]\]>/, true],
  [new RegExp(`^</?(${block_names.join("|")})(?=(\\s|/?>|$))`, "i"), /^$/, true],
  [new RegExp(`${HTML_OPEN_CLOSE_TAG_RE.source}\\s*$`), /^$/, false]
];
function html_block(state, startLine, endLine, silent) {
  let pos = state.bMarks[startLine] + state.tShift[startLine];
  let max = state.eMarks[startLine];
  if (state.sCount[startLine] - state.blkIndent >= 4)
    return false;
  if (state.src.charCodeAt(pos) !== 60)
    return false;
  let lineText = state.src.slice(pos, max);
  let i = 0;
  for (; i < HTML_SEQUENCES.length; i++) {
    if (HTML_SEQUENCES[i][0].test(lineText))
      break;
  }
  if (i === HTML_SEQUENCES.length)
    return false;
  if (silent)
    return HTML_SEQUENCES[i][2];
  let nextLine = startLine + 1;
  if (!HTML_SEQUENCES[i][1].test(lineText)) {
    for (; nextLine < endLine; nextLine++) {
      if (state.sCount[nextLine] < state.blkIndent)
        break;
      pos = state.bMarks[nextLine] + state.tShift[nextLine];
      max = state.eMarks[nextLine];
      lineText = state.src.slice(pos, max);
      if (HTML_SEQUENCES[i][1].test(lineText)) {
        if (lineText.length !== 0)
          nextLine++;
        break;
      }
    }
  }
  state.line = nextLine;
  const token = state.push("html_block", "", 1);
  token.map = [startLine, nextLine];
  token.content = state.getLines(startLine, nextLine, state.blkIndent, true);
  return true;
}
function isLinkOpen(str) {
  return /^<a[>\s]/i.test(str);
}
function isLinkClose(str) {
  return /^<\/a\s*>/i.test(str);
}
function isLetter(ch) {
  const lc = ch | 32;
  return lc >= 97 && lc <= 122;
}
function html_inline(state, silent) {
  const max = state.posMax;
  const pos = state.pos;
  if (state.src.charCodeAt(pos) !== 60 || pos + 2 >= max) {
    return false;
  }
  const ch = state.src.charCodeAt(pos + 1);
  if (ch !== 33 && ch !== 63 && ch !== 47 && !isLetter(ch)) {
    return false;
  }
  const match2 = state.src.slice(pos).match(HTML_TAG_RE);
  if (!match2)
    return false;
  if (!silent) {
    const token = state.push("html_inline", "", 0);
    token.content = match2[0];
    if (isLinkOpen(token.content))
      state.linkLevel++;
    if (isLinkClose(token.content))
      state.linkLevel--;
  }
  state.pos += match2[0].length;
  return true;
}
function markdownItHtml(md) {
  md.set({ html: true });
  md.inline.ruler.before("text", "comark_html_inline", html_inline);
  md.block.ruler.before("html_block", "comark_html_block", html_block, {
    alt: ["paragraph", "reference", "blockquote"]
  });
}
const html = defineComarkPlugin(() => ({
  name: "html",
  markdownItPlugins: [markdownItHtml]
}));
const FRONTMATTER_DELIMITER_DEFAULT = "---";
const LF = "\n";
const CR = "\r";
function parseFrontmatter(content) {
  let data = {};
  let frontmatter = "";
  if (content.startsWith(FRONTMATTER_DELIMITER_DEFAULT)) {
    const idx = content.indexOf(LF + FRONTMATTER_DELIMITER_DEFAULT);
    if (idx !== -1) {
      const hasCarriageReturn = content[idx - 1] === CR;
      frontmatter = content.slice(4, idx - (hasCarriageReturn ? 1 : 0));
      if (frontmatter) {
        data = parseYaml(frontmatter) ?? {};
        content = content.slice(idx + 4 + (hasCarriageReturn ? 1 : 0));
      }
    }
  }
  return {
    content,
    data,
    frontmatterText: frontmatter
  };
}
const frontmatterPlugin = defineComarkPlugin(() => ({
  name: "frontmatter",
  pre(state) {
    const { content, data, frontmatterText } = parseFrontmatter(state.markdown);
    state.markdown = content;
    state.frontmatter = data;
    state.frontmatterText = frontmatterText;
    if (content && frontmatterText) {
      state.parsedLines = (state.parsedLines ?? 0) + frontmatterText.split("\n").length + 1;
    }
  }
}));
function resolveUnwrapTags(unwrap) {
  if (!unwrap)
    return [];
  if (unwrap === true)
    return ["p"];
  if (typeof unwrap === "string") {
    return unwrap.split(/[,\s]/).map((tag) => tag.trim()).filter(Boolean);
  }
  return unwrap.filter(Boolean);
}
function isElement(node) {
  return Array.isArray(node) && typeof node[0] === "string";
}
function matchesTag(node, tag) {
  return isElement(node) && (tag === "*" || node[0] === tag);
}
function flatUnwrap(nodes, tags2) {
  if (tags2.length === 0)
    return nodes;
  const [head, ...rest] = tags2;
  const result = [];
  for (const node of nodes) {
    const unwrapped = matchesTag(node, head) ? node.slice(2) : [node];
    for (const child of flatUnwrap(unwrapped, rest)) {
      result.push(child);
    }
  }
  return result.filter((node) => !(typeof node === "string" && node.trim() === ""));
}
function applyUnwrap(nodes, tags2) {
  if (tags2.length === 0)
    return nodes;
  const unwrapped = flatUnwrap(nodes, tags2);
  const merged = [];
  for (const node of unwrapped) {
    if (typeof node === "string" && typeof merged[merged.length - 1] === "string") {
      merged[merged.length - 1] = merged[merged.length - 1] + node;
    } else {
      merged.push(node);
    }
  }
  return merged;
}
var CharCodes;
(function(CharCodes2) {
  CharCodes2[CharCodes2["Tab"] = 9] = "Tab";
  CharCodes2[CharCodes2["NewLine"] = 10] = "NewLine";
  CharCodes2[CharCodes2["FormFeed"] = 12] = "FormFeed";
  CharCodes2[CharCodes2["CarriageReturn"] = 13] = "CarriageReturn";
  CharCodes2[CharCodes2["Space"] = 32] = "Space";
  CharCodes2[CharCodes2["ExclamationMark"] = 33] = "ExclamationMark";
  CharCodes2[CharCodes2["Number"] = 35] = "Number";
  CharCodes2[CharCodes2["Amp"] = 38] = "Amp";
  CharCodes2[CharCodes2["SingleQuote"] = 39] = "SingleQuote";
  CharCodes2[CharCodes2["DoubleQuote"] = 34] = "DoubleQuote";
  CharCodes2[CharCodes2["Dash"] = 45] = "Dash";
  CharCodes2[CharCodes2["Slash"] = 47] = "Slash";
  CharCodes2[CharCodes2["Zero"] = 48] = "Zero";
  CharCodes2[CharCodes2["Nine"] = 57] = "Nine";
  CharCodes2[CharCodes2["Semi"] = 59] = "Semi";
  CharCodes2[CharCodes2["Lt"] = 60] = "Lt";
  CharCodes2[CharCodes2["Eq"] = 61] = "Eq";
  CharCodes2[CharCodes2["Gt"] = 62] = "Gt";
  CharCodes2[CharCodes2["Questionmark"] = 63] = "Questionmark";
  CharCodes2[CharCodes2["UpperA"] = 65] = "UpperA";
  CharCodes2[CharCodes2["LowerA"] = 97] = "LowerA";
  CharCodes2[CharCodes2["UpperF"] = 70] = "UpperF";
  CharCodes2[CharCodes2["LowerF"] = 102] = "LowerF";
  CharCodes2[CharCodes2["UpperZ"] = 90] = "UpperZ";
  CharCodes2[CharCodes2["LowerZ"] = 122] = "LowerZ";
  CharCodes2[CharCodes2["LowerX"] = 120] = "LowerX";
  CharCodes2[CharCodes2["OpeningSquareBracket"] = 91] = "OpeningSquareBracket";
})(CharCodes || (CharCodes = {}));
var State;
(function(State2) {
  State2[State2["Text"] = 1] = "Text";
  State2[State2["BeforeTagName"] = 2] = "BeforeTagName";
  State2[State2["InTagName"] = 3] = "InTagName";
  State2[State2["InSelfClosingTag"] = 4] = "InSelfClosingTag";
  State2[State2["BeforeClosingTagName"] = 5] = "BeforeClosingTagName";
  State2[State2["InClosingTagName"] = 6] = "InClosingTagName";
  State2[State2["AfterClosingTagName"] = 7] = "AfterClosingTagName";
  State2[State2["BeforeAttributeName"] = 8] = "BeforeAttributeName";
  State2[State2["InAttributeName"] = 9] = "InAttributeName";
  State2[State2["AfterAttributeName"] = 10] = "AfterAttributeName";
  State2[State2["BeforeAttributeValue"] = 11] = "BeforeAttributeValue";
  State2[State2["InAttributeValueDq"] = 12] = "InAttributeValueDq";
  State2[State2["InAttributeValueSq"] = 13] = "InAttributeValueSq";
  State2[State2["InAttributeValueNq"] = 14] = "InAttributeValueNq";
  State2[State2["BeforeDeclaration"] = 15] = "BeforeDeclaration";
  State2[State2["InDeclaration"] = 16] = "InDeclaration";
  State2[State2["InProcessingInstruction"] = 17] = "InProcessingInstruction";
  State2[State2["BeforeComment"] = 18] = "BeforeComment";
  State2[State2["CDATASequence"] = 19] = "CDATASequence";
  State2[State2["DeclarationSequence"] = 20] = "DeclarationSequence";
  State2[State2["InSpecialComment"] = 21] = "InSpecialComment";
  State2[State2["InCommentLike"] = 22] = "InCommentLike";
  State2[State2["SpecialStartSequence"] = 23] = "SpecialStartSequence";
  State2[State2["InSpecialTag"] = 24] = "InSpecialTag";
  State2[State2["InPlainText"] = 25] = "InPlainText";
  State2[State2["InEntity"] = 26] = "InEntity";
})(State || (State = {}));
function isWhitespace(c) {
  return c === CharCodes.Space || c === CharCodes.NewLine || c === CharCodes.Tab || c === CharCodes.FormFeed || c === CharCodes.CarriageReturn;
}
function isEndOfTagSection(c) {
  return c === CharCodes.Slash || c === CharCodes.Gt || isWhitespace(c);
}
function isASCIIAlpha(c) {
  return c >= CharCodes.LowerA && c <= CharCodes.LowerZ || c >= CharCodes.UpperA && c <= CharCodes.UpperZ;
}
var QuoteType;
(function(QuoteType2) {
  QuoteType2[QuoteType2["NoValue"] = 0] = "NoValue";
  QuoteType2[QuoteType2["Unquoted"] = 1] = "Unquoted";
  QuoteType2[QuoteType2["Single"] = 2] = "Single";
  QuoteType2[QuoteType2["Double"] = 3] = "Double";
})(QuoteType || (QuoteType = {}));
const Sequences = {
  Empty: new Uint8Array(0),
  Cdata: new Uint8Array([67, 68, 65, 84, 65, 91]),
  // CDATA[
  CdataEnd: new Uint8Array([93, 93, 62]),
  // ]]>
  CommentEnd: new Uint8Array([45, 45, 33, 62]),
  // `--!>`
  Doctype: new Uint8Array([100, 111, 99, 116, 121, 112, 101]),
  // `doctype`
  IframeEnd: new Uint8Array([60, 47, 105, 102, 114, 97, 109, 101]),
  // `</iframe`
  NoembedEnd: new Uint8Array([
    60,
    47,
    110,
    111,
    101,
    109,
    98,
    101,
    100
  ]),
  // `</noembed`
  NoframesEnd: new Uint8Array([
    60,
    47,
    110,
    111,
    102,
    114,
    97,
    109,
    101,
    115
  ]),
  // `</noframes`
  Plaintext: new Uint8Array([
    60,
    47,
    112,
    108,
    97,
    105,
    110,
    116,
    101,
    120,
    116
  ]),
  // `</plaintext`
  ScriptEnd: new Uint8Array([60, 47, 115, 99, 114, 105, 112, 116]),
  // `<\/script`
  StyleEnd: new Uint8Array([60, 47, 115, 116, 121, 108, 101]),
  // `</style`
  TitleEnd: new Uint8Array([60, 47, 116, 105, 116, 108, 101]),
  // `</title`
  TextareaEnd: new Uint8Array([
    60,
    47,
    116,
    101,
    120,
    116,
    97,
    114,
    101,
    97
  ]),
  // `</textarea`
  XmpEnd: new Uint8Array([60, 47, 120, 109, 112])
  // `</xmp`
};
const specialStartSequences = /* @__PURE__ */ new Map([
  [Sequences.IframeEnd[2], Sequences.IframeEnd],
  [Sequences.NoembedEnd[2], Sequences.NoembedEnd],
  [Sequences.Plaintext[2], Sequences.Plaintext],
  [Sequences.ScriptEnd[2], Sequences.ScriptEnd],
  [Sequences.TitleEnd[2], Sequences.TitleEnd],
  [Sequences.XmpEnd[2], Sequences.XmpEnd]
]);
class Tokenizer {
  cbs;
  /** The current state the tokenizer is in. */
  state = State.Text;
  /** The read buffer. */
  buffer = "";
  /** The beginning of the section that is currently being read. */
  sectionStart = 0;
  /** The index within the buffer that we are currently looking at. */
  index = 0;
  /** The start of the last entity. */
  entityStart = 0;
  /** Some behavior, eg. when decoding entities, is done while we are in another state. This keeps track of the other state type. */
  baseState = State.Text;
  /** For special parsing behavior inside of script and style tags. */
  isSpecial = false;
  /** Indicates whether the tokenizer has been paused. */
  running = true;
  /** The offset of the current buffer. */
  offset = 0;
  xmlMode;
  decodeEntities;
  recognizeSelfClosing;
  entityDecoder;
  constructor({ xmlMode = false, decodeEntities = true, recognizeSelfClosing = xmlMode }, cbs) {
    this.cbs = cbs;
    this.xmlMode = xmlMode;
    this.decodeEntities = decodeEntities;
    this.recognizeSelfClosing = recognizeSelfClosing;
    this.entityDecoder = new EntityDecoder$1(xmlMode ? xmlDecodeTree : htmlDecodeTree$1, (cp, consumed) => this.emitCodePoint(cp, consumed));
  }
  reset() {
    this.state = State.Text;
    this.buffer = "";
    this.sectionStart = 0;
    this.index = 0;
    this.baseState = State.Text;
    this.isSpecial = false;
    this.currentSequence = Sequences.Empty;
    this.sequenceIndex = 0;
    this.running = true;
    this.offset = 0;
  }
  write(chunk) {
    this.offset += this.buffer.length;
    this.buffer = chunk;
    this.parse();
  }
  end() {
    if (this.running)
      this.finish();
  }
  pause() {
    this.running = false;
  }
  resume() {
    this.running = true;
    if (this.index < this.buffer.length + this.offset) {
      this.parse();
    }
  }
  stateText(c) {
    if (c === CharCodes.Lt || !this.decodeEntities && this.fastForwardTo(CharCodes.Lt)) {
      if (this.index > this.sectionStart) {
        this.cbs.ontext(this.sectionStart, this.index);
      }
      this.state = State.BeforeTagName;
      this.sectionStart = this.index;
    } else if (this.decodeEntities && c === CharCodes.Amp) {
      this.startEntity();
    }
  }
  currentSequence = Sequences.Empty;
  sequenceIndex = 0;
  enterTagBody() {
    if (this.currentSequence === Sequences.Plaintext) {
      this.currentSequence = Sequences.Empty;
      this.state = State.InPlainText;
    } else if (this.isSpecial) {
      this.state = State.InSpecialTag;
      this.sequenceIndex = 0;
    } else {
      this.state = State.Text;
    }
  }
  /**
   * Match the opening tag name against an HTML text-only tag sequence.
   *
   * Some tags share an initial prefix (`script`/`style`, `title`/`textarea`,
   * `noembed`/`noframes`), so we may switch to an alternate sequence at the
   * first distinguishing byte.  On a successful full match we fall back to
   * the normal tag-name state; a later `>` will enter raw-text, RCDATA, or
   * plaintext mode based on `currentSequence` / `isSpecial`.
   * @param c Current character code point.
   */
  stateSpecialStartSequence(c) {
    const lower = c | 32;
    if (this.sequenceIndex < this.currentSequence.length) {
      if (lower === this.currentSequence[this.sequenceIndex]) {
        this.sequenceIndex++;
        return;
      }
      if (this.sequenceIndex === 3) {
        if (this.currentSequence === Sequences.ScriptEnd && lower === Sequences.StyleEnd[3]) {
          this.currentSequence = Sequences.StyleEnd;
          this.sequenceIndex = 4;
          return;
        }
        if (this.currentSequence === Sequences.TitleEnd && lower === Sequences.TextareaEnd[3]) {
          this.currentSequence = Sequences.TextareaEnd;
          this.sequenceIndex = 4;
          return;
        }
      } else if (this.sequenceIndex === 4 && this.currentSequence === Sequences.NoembedEnd && lower === Sequences.NoframesEnd[4]) {
        this.currentSequence = Sequences.NoframesEnd;
        this.sequenceIndex = 5;
        return;
      }
    } else if (isEndOfTagSection(c)) {
      this.sequenceIndex = 0;
      this.state = State.InTagName;
      this.stateInTagName(c);
      return;
    }
    this.isSpecial = false;
    this.currentSequence = Sequences.Empty;
    this.sequenceIndex = 0;
    this.state = State.InTagName;
    this.stateInTagName(c);
  }
  stateCDATASequence(c) {
    if (c === Sequences.Cdata[this.sequenceIndex]) {
      if (++this.sequenceIndex === Sequences.Cdata.length) {
        this.state = State.InCommentLike;
        this.currentSequence = Sequences.CdataEnd;
        this.sequenceIndex = 0;
        this.sectionStart = this.index + 1;
      }
    } else {
      this.sequenceIndex = 0;
      if (this.xmlMode) {
        this.state = State.InDeclaration;
        this.stateInDeclaration(c);
      } else {
        this.state = State.InSpecialComment;
        this.stateInSpecialComment(c);
      }
    }
  }
  /**
   * When we wait for one specific character, we can speed things up
   * by skipping through the buffer until we find it.
   * @param c Current character code point.
   * @returns Whether the character was found.
   */
  fastForwardTo(c) {
    while (++this.index < this.buffer.length + this.offset) {
      if (this.buffer.charCodeAt(this.index - this.offset) === c) {
        return true;
      }
    }
    this.index = this.buffer.length + this.offset - 1;
    return false;
  }
  /**
   * Emit a comment token and return to the text state.
   * @param offset Number of characters in the end sequence that have already been matched.
   */
  emitComment(offset) {
    this.cbs.oncomment(this.sectionStart, this.index, offset);
    this.sequenceIndex = 0;
    this.sectionStart = this.index + 1;
    this.state = State.Text;
  }
  /**
   * Comments and CDATA end with `-->` and `]]>`.
   *
   * Their common qualities are:
   * - Their end sequences have a distinct character they start with.
   * - That character is then repeated, so we have to check multiple repeats.
   * - All characters but the start character of the sequence can be skipped.
   * @param c Current character code point.
   */
  stateInCommentLike(c) {
    if (!this.xmlMode && this.currentSequence === Sequences.CommentEnd && this.sequenceIndex <= 1 && /*
     * We're still at the very start of the comment: the only
     * characters consumed since `<!--` are the dashes that
     * advanced sequenceIndex (0 for `<!-->`, 1 for `<!--->`).
     */
    this.index === this.sectionStart + this.sequenceIndex && c === CharCodes.Gt) {
      this.emitComment(this.sequenceIndex);
    } else if (this.currentSequence === Sequences.CommentEnd && this.sequenceIndex === 2 && c === CharCodes.Gt) {
      this.emitComment(2);
    } else if (this.currentSequence === Sequences.CommentEnd && this.sequenceIndex === this.currentSequence.length - 1 && c !== CharCodes.Gt) {
      this.sequenceIndex = Number(c === CharCodes.Dash);
    } else if (c === this.currentSequence[this.sequenceIndex]) {
      if (++this.sequenceIndex === this.currentSequence.length) {
        if (this.currentSequence === Sequences.CdataEnd) {
          this.cbs.oncdata(this.sectionStart, this.index, 2);
        } else {
          this.cbs.oncomment(this.sectionStart, this.index, 3);
        }
        this.sequenceIndex = 0;
        this.sectionStart = this.index + 1;
        this.state = State.Text;
      }
    } else if (this.sequenceIndex === 0) {
      if (this.fastForwardTo(this.currentSequence[0])) {
        this.sequenceIndex = 1;
      }
    } else if (c !== this.currentSequence[this.sequenceIndex - 1]) {
      this.sequenceIndex = 0;
    }
  }
  /**
   * HTML only allows ASCII alpha characters (a-z and A-Z) at the beginning of a tag name.
   *
   * XML allows a lot more characters here (@see https://www.w3.org/TR/REC-xml/#NT-NameStartChar).
   * We allow anything that wouldn't end the tag.
   * @param c Current character code point.
   */
  isTagStartChar(c) {
    return this.xmlMode ? !isEndOfTagSection(c) : isASCIIAlpha(c);
  }
  /**
   * Scan raw-text / RCDATA content for the matching end tag.
   *
   * For RCDATA tags (`<title>`, `<textarea>`) entities are decoded inline.
   * For raw-text tags (`<script>`, `<style>`, etc.) we fast-forward to `<`.
   * @param c Current character code point.
   */
  stateInSpecialTag(c) {
    if (this.sequenceIndex === this.currentSequence.length) {
      if (isEndOfTagSection(c)) {
        const endOfText = this.index - this.currentSequence.length;
        if (this.sectionStart < endOfText) {
          const actualIndex = this.index;
          this.index = endOfText;
          this.cbs.ontext(this.sectionStart, endOfText);
          this.index = actualIndex;
        }
        this.isSpecial = false;
        this.sectionStart = endOfText + 2;
        this.stateInClosingTagName(c);
        return;
      }
      this.sequenceIndex = 0;
    }
    if ((c | 32) === this.currentSequence[this.sequenceIndex]) {
      this.sequenceIndex += 1;
    } else if (this.sequenceIndex === 0) {
      if (this.currentSequence === Sequences.TitleEnd || this.currentSequence === Sequences.TextareaEnd) {
        if (this.decodeEntities && c === CharCodes.Amp) {
          this.startEntity();
        }
      } else if (this.fastForwardTo(CharCodes.Lt)) {
        this.sequenceIndex = 1;
      }
    } else {
      this.sequenceIndex = Number(c === CharCodes.Lt);
    }
  }
  stateBeforeTagName(c) {
    if (c === CharCodes.ExclamationMark) {
      this.state = State.BeforeDeclaration;
      this.sectionStart = this.index + 1;
    } else if (c === CharCodes.Questionmark) {
      if (this.xmlMode) {
        this.state = State.InProcessingInstruction;
        this.sequenceIndex = 0;
        this.sectionStart = this.index + 1;
      } else {
        this.state = State.InSpecialComment;
        this.sectionStart = this.index;
      }
    } else if (this.isTagStartChar(c)) {
      this.sectionStart = this.index;
      const special = this.xmlMode || this.cbs.isInForeignContext?.() ? void 0 : specialStartSequences.get(c | 32);
      if (special === void 0) {
        this.state = State.InTagName;
      } else {
        this.isSpecial = true;
        this.currentSequence = special;
        this.sequenceIndex = 3;
        this.state = State.SpecialStartSequence;
      }
    } else if (c === CharCodes.Slash) {
      this.state = State.BeforeClosingTagName;
    } else {
      this.state = State.Text;
      this.stateText(c);
    }
  }
  stateInTagName(c) {
    if (isEndOfTagSection(c)) {
      this.cbs.onopentagname(this.sectionStart, this.index);
      this.sectionStart = -1;
      this.state = State.BeforeAttributeName;
      this.stateBeforeAttributeName(c);
    }
  }
  stateBeforeClosingTagName(c) {
    if (isWhitespace(c)) {
      if (this.xmlMode) ;
      else {
        this.state = State.InSpecialComment;
        this.sectionStart = this.index;
      }
    } else if (c === CharCodes.Gt) {
      this.state = State.Text;
      if (!this.xmlMode) {
        this.sectionStart = this.index + 1;
      }
    } else {
      this.state = this.isTagStartChar(c) ? State.InClosingTagName : State.InSpecialComment;
      this.sectionStart = this.index;
    }
  }
  stateInClosingTagName(c) {
    if (isEndOfTagSection(c)) {
      this.cbs.onclosetag(this.sectionStart, this.index);
      this.sectionStart = -1;
      this.state = State.AfterClosingTagName;
      this.stateAfterClosingTagName(c);
    }
  }
  stateAfterClosingTagName(c) {
    if (c === CharCodes.Gt || this.fastForwardTo(CharCodes.Gt)) {
      this.state = State.Text;
      this.sectionStart = this.index + 1;
    }
  }
  stateBeforeAttributeName(c) {
    if (c === CharCodes.Gt) {
      this.cbs.onopentagend(this.index);
      this.enterTagBody();
      this.sectionStart = this.index + 1;
    } else if (c === CharCodes.Slash) {
      this.state = State.InSelfClosingTag;
    } else if (!isWhitespace(c)) {
      this.state = State.InAttributeName;
      this.sectionStart = this.index;
    }
  }
  /**
   * Handle `/` before `>` in an opening tag.
   *
   * In HTML mode, text-only tags ignore the self-closing flag and still enter
   * their raw-text/RCDATA/plaintext state unless self-closing tags are being
   * recognized. In XML mode, or for ordinary tags, the tokenizer returns to
   * regular text parsing after emitting the self-closing callback.
   * @param c Current character code point.
   */
  stateInSelfClosingTag(c) {
    if (c === CharCodes.Gt) {
      this.cbs.onselfclosingtag(this.index);
      this.sectionStart = this.index + 1;
      if (!this.recognizeSelfClosing) {
        this.enterTagBody();
        return;
      }
      this.state = State.Text;
      this.isSpecial = false;
      this.currentSequence = Sequences.Empty;
    } else if (!isWhitespace(c)) {
      this.state = State.BeforeAttributeName;
      this.stateBeforeAttributeName(c);
    }
  }
  stateInAttributeName(c) {
    if (c === CharCodes.Eq || isEndOfTagSection(c)) {
      this.cbs.onattribname(this.sectionStart, this.index);
      this.sectionStart = this.index;
      this.state = State.AfterAttributeName;
      this.stateAfterAttributeName(c);
    }
  }
  stateAfterAttributeName(c) {
    if (c === CharCodes.Eq) {
      this.state = State.BeforeAttributeValue;
    } else if (c === CharCodes.Slash || c === CharCodes.Gt) {
      this.cbs.onattribend(QuoteType.NoValue, this.sectionStart);
      this.sectionStart = -1;
      this.state = State.BeforeAttributeName;
      this.stateBeforeAttributeName(c);
    } else if (!isWhitespace(c)) {
      this.cbs.onattribend(QuoteType.NoValue, this.sectionStart);
      this.state = State.InAttributeName;
      this.sectionStart = this.index;
    }
  }
  stateBeforeAttributeValue(c) {
    if (c === CharCodes.DoubleQuote) {
      this.state = State.InAttributeValueDq;
      this.sectionStart = this.index + 1;
    } else if (c === CharCodes.SingleQuote) {
      this.state = State.InAttributeValueSq;
      this.sectionStart = this.index + 1;
    } else if (!isWhitespace(c)) {
      this.sectionStart = this.index;
      this.state = State.InAttributeValueNq;
      this.stateInAttributeValueNoQuotes(c);
    }
  }
  handleInAttributeValue(c, quote) {
    if (c === quote || !this.decodeEntities && this.fastForwardTo(quote)) {
      this.cbs.onattribdata(this.sectionStart, this.index);
      this.sectionStart = -1;
      this.cbs.onattribend(quote === CharCodes.DoubleQuote ? QuoteType.Double : QuoteType.Single, this.index + 1);
      this.state = State.BeforeAttributeName;
    } else if (this.decodeEntities && c === CharCodes.Amp) {
      this.startEntity();
    }
  }
  stateInAttributeValueDoubleQuotes(c) {
    this.handleInAttributeValue(c, CharCodes.DoubleQuote);
  }
  stateInAttributeValueSingleQuotes(c) {
    this.handleInAttributeValue(c, CharCodes.SingleQuote);
  }
  stateInAttributeValueNoQuotes(c) {
    if (isWhitespace(c) || c === CharCodes.Gt) {
      this.cbs.onattribdata(this.sectionStart, this.index);
      this.sectionStart = -1;
      this.cbs.onattribend(QuoteType.Unquoted, this.index);
      this.state = State.BeforeAttributeName;
      this.stateBeforeAttributeName(c);
    } else if (this.decodeEntities && c === CharCodes.Amp) {
      this.startEntity();
    }
  }
  /**
   * Distinguish between CDATA, declarations, HTML comments, and HTML bogus
   * comments after `<!`.
   *
   * In HTML mode, only real comments and doctypes stay on declaration paths;
   * everything else becomes a bogus comment terminated by the next `>`.
   * @param c Current character code point.
   */
  stateBeforeDeclaration(c) {
    if (c === CharCodes.OpeningSquareBracket) {
      this.state = State.CDATASequence;
      this.sequenceIndex = 0;
    } else if (this.xmlMode) {
      this.state = c === CharCodes.Dash ? State.BeforeComment : State.InDeclaration;
    } else if ((c | 32) === Sequences.Doctype[0]) {
      this.state = State.DeclarationSequence;
      this.currentSequence = Sequences.Doctype;
      this.sequenceIndex = 1;
    } else if (c === CharCodes.Gt) {
      this.cbs.oncomment(this.sectionStart, this.index, 0);
      this.state = State.Text;
      this.sectionStart = this.index + 1;
    } else if (c === CharCodes.Dash) {
      this.state = State.BeforeComment;
    } else {
      this.state = State.InSpecialComment;
    }
  }
  /**
   * Continue matching `doctype` after `<!d`.
   *
   * A full `doctype` match stays on the declaration path; any other name falls
   * back to an HTML bogus comment, which matches browser behavior for
   * non-doctype `<!...>` constructs.
   * @param c Current character code point.
   */
  stateDeclarationSequence(c) {
    if (this.sequenceIndex === this.currentSequence.length) {
      this.state = State.InDeclaration;
      this.stateInDeclaration(c);
    } else if ((c | 32) === this.currentSequence[this.sequenceIndex]) {
      this.sequenceIndex += 1;
    } else if (c === CharCodes.Gt) {
      this.cbs.oncomment(this.sectionStart, this.index, 0);
      this.state = State.Text;
      this.sectionStart = this.index + 1;
    } else {
      this.state = State.InSpecialComment;
    }
  }
  stateInDeclaration(c) {
    if (c === CharCodes.Gt || this.fastForwardTo(CharCodes.Gt)) {
      this.cbs.ondeclaration(this.sectionStart, this.index);
      this.state = State.Text;
      this.sectionStart = this.index + 1;
    }
  }
  /**
   * XML processing instructions (`<?...?>`).
   *
   * In HTML mode `<?` is routed to `InSpecialComment` instead, so this
   * state is only reachable in XML mode.
   * @param c Current character code point.
   */
  stateInProcessingInstruction(c) {
    if (c === CharCodes.Questionmark) {
      this.sequenceIndex = 1;
    } else if (c === CharCodes.Gt && this.sequenceIndex === 1) {
      this.cbs.onprocessinginstruction(this.sectionStart, this.index - 1);
      this.sequenceIndex = 0;
      this.state = State.Text;
      this.sectionStart = this.index + 1;
    } else {
      this.sequenceIndex = Number(this.fastForwardTo(CharCodes.Questionmark));
    }
  }
  stateBeforeComment(c) {
    if (c === CharCodes.Dash) {
      this.state = State.InCommentLike;
      this.currentSequence = Sequences.CommentEnd;
      this.sequenceIndex = 0;
      this.sectionStart = this.index + 1;
    } else if (this.xmlMode) {
      this.state = State.InDeclaration;
    } else if (c === CharCodes.Gt) {
      this.cbs.oncomment(this.sectionStart, this.index, 0);
      this.state = State.Text;
      this.sectionStart = this.index + 1;
    } else {
      this.state = State.InSpecialComment;
    }
  }
  stateInSpecialComment(c) {
    if (c === CharCodes.Gt || this.fastForwardTo(CharCodes.Gt)) {
      this.cbs.oncomment(this.sectionStart, this.index, 0);
      this.state = State.Text;
      this.sectionStart = this.index + 1;
    }
  }
  startEntity() {
    this.baseState = this.state;
    this.state = State.InEntity;
    this.entityStart = this.index;
    this.entityDecoder.startEntity(this.xmlMode ? DecodingMode$1.Strict : this.baseState === State.Text || this.baseState === State.InSpecialTag ? DecodingMode$1.Legacy : DecodingMode$1.Attribute);
  }
  stateInEntity() {
    const indexInBuffer = this.index - this.offset;
    const length2 = this.entityDecoder.write(this.buffer, indexInBuffer);
    if (length2 >= 0) {
      this.state = this.baseState;
      if (length2 === 0) {
        this.index -= 1;
      }
    } else {
      if (indexInBuffer < this.buffer.length && this.buffer.charCodeAt(indexInBuffer) === CharCodes.Amp) {
        this.state = this.baseState;
        this.index -= 1;
        return;
      }
      this.index = this.offset + this.buffer.length - 1;
    }
  }
  /**
   * Remove data that has already been consumed from the buffer.
   */
  cleanup() {
    if (this.running && this.sectionStart !== this.index) {
      if (this.state === State.Text || this.state === State.InPlainText || this.state === State.InSpecialTag && this.sequenceIndex === 0) {
        this.cbs.ontext(this.sectionStart, this.index);
        this.sectionStart = this.index;
      } else if (this.state === State.InAttributeValueDq || this.state === State.InAttributeValueSq || this.state === State.InAttributeValueNq) {
        this.cbs.onattribdata(this.sectionStart, this.index);
        this.sectionStart = this.index;
      }
    }
  }
  shouldContinue() {
    return this.index < this.buffer.length + this.offset && this.running;
  }
  /**
   * Iterates through the buffer, calling the function corresponding to the current state.
   *
   * States that are more likely to be hit are higher up, as a performance improvement.
   */
  parse() {
    while (this.shouldContinue()) {
      const c = this.buffer.charCodeAt(this.index - this.offset);
      switch (this.state) {
        case State.Text: {
          this.stateText(c);
          break;
        }
        case State.InPlainText: {
          this.index = this.buffer.length + this.offset - 1;
          break;
        }
        case State.SpecialStartSequence: {
          this.stateSpecialStartSequence(c);
          break;
        }
        case State.InSpecialTag: {
          this.stateInSpecialTag(c);
          break;
        }
        case State.CDATASequence: {
          this.stateCDATASequence(c);
          break;
        }
        case State.DeclarationSequence: {
          this.stateDeclarationSequence(c);
          break;
        }
        case State.InAttributeValueDq: {
          this.stateInAttributeValueDoubleQuotes(c);
          break;
        }
        case State.InAttributeName: {
          this.stateInAttributeName(c);
          break;
        }
        case State.InCommentLike: {
          this.stateInCommentLike(c);
          break;
        }
        case State.InSpecialComment: {
          this.stateInSpecialComment(c);
          break;
        }
        case State.BeforeAttributeName: {
          this.stateBeforeAttributeName(c);
          break;
        }
        case State.InTagName: {
          this.stateInTagName(c);
          break;
        }
        case State.InClosingTagName: {
          this.stateInClosingTagName(c);
          break;
        }
        case State.BeforeTagName: {
          this.stateBeforeTagName(c);
          break;
        }
        case State.AfterAttributeName: {
          this.stateAfterAttributeName(c);
          break;
        }
        case State.InAttributeValueSq: {
          this.stateInAttributeValueSingleQuotes(c);
          break;
        }
        case State.BeforeAttributeValue: {
          this.stateBeforeAttributeValue(c);
          break;
        }
        case State.BeforeClosingTagName: {
          this.stateBeforeClosingTagName(c);
          break;
        }
        case State.AfterClosingTagName: {
          this.stateAfterClosingTagName(c);
          break;
        }
        case State.InAttributeValueNq: {
          this.stateInAttributeValueNoQuotes(c);
          break;
        }
        case State.InSelfClosingTag: {
          this.stateInSelfClosingTag(c);
          break;
        }
        case State.InDeclaration: {
          this.stateInDeclaration(c);
          break;
        }
        case State.BeforeDeclaration: {
          this.stateBeforeDeclaration(c);
          break;
        }
        case State.BeforeComment: {
          this.stateBeforeComment(c);
          break;
        }
        case State.InProcessingInstruction: {
          this.stateInProcessingInstruction(c);
          break;
        }
        case State.InEntity: {
          this.stateInEntity();
          break;
        }
      }
      this.index++;
    }
    this.cleanup();
  }
  finish() {
    if (this.state === State.InEntity) {
      this.entityDecoder.end();
      this.state = this.baseState;
    }
    this.handleTrailingData();
    this.cbs.onend();
  }
  handleTrailingCommentLikeData(endIndex) {
    if (this.state !== State.InCommentLike) {
      return false;
    }
    if (this.currentSequence === Sequences.CdataEnd) {
      if (this.xmlMode) {
        if (this.sectionStart < endIndex) {
          this.cbs.oncdata(this.sectionStart, endIndex, 0);
        }
      } else {
        const cdataStart = this.sectionStart - Sequences.Cdata.length - 1;
        this.cbs.oncomment(cdataStart, endIndex, 0);
      }
    } else {
      const offset = this.xmlMode ? 0 : Math.min(this.sequenceIndex, Sequences.CommentEnd.length - 1);
      this.cbs.oncomment(this.sectionStart, endIndex, offset);
    }
    return true;
  }
  handleTrailingMarkupDeclaration(endIndex) {
    if (this.xmlMode) {
      switch (this.state) {
        case State.InSpecialComment:
        case State.BeforeComment:
        case State.CDATASequence:
        case State.DeclarationSequence:
        case State.InDeclaration: {
          this.cbs.ontext(this.sectionStart, endIndex);
          return true;
        }
        default: {
          return false;
        }
      }
    }
    switch (this.state) {
      case State.BeforeDeclaration:
      case State.InSpecialComment:
      case State.BeforeComment:
      case State.CDATASequence: {
        this.cbs.oncomment(this.sectionStart, endIndex, 0);
        return true;
      }
      case State.DeclarationSequence: {
        if (this.sequenceIndex !== Sequences.Doctype.length) {
          this.cbs.oncomment(this.sectionStart, endIndex, 0);
        }
        return true;
      }
      case State.InDeclaration: {
        return true;
      }
      default: {
        return false;
      }
    }
  }
  /** Handle any trailing data. */
  handleTrailingData() {
    const endIndex = this.buffer.length + this.offset;
    if (this.handleTrailingCommentLikeData(endIndex) || this.handleTrailingMarkupDeclaration(endIndex)) {
      return;
    }
    if (this.sectionStart >= endIndex) {
      return;
    }
    switch (this.state) {
      case State.InTagName:
      case State.BeforeAttributeName:
      case State.BeforeAttributeValue:
      case State.AfterAttributeName:
      case State.InAttributeName:
      case State.InAttributeValueSq:
      case State.InAttributeValueDq:
      case State.InAttributeValueNq:
      case State.InClosingTagName: {
        break;
      }
      default: {
        this.cbs.ontext(this.sectionStart, endIndex);
      }
    }
  }
  emitCodePoint(cp, consumed) {
    if (this.baseState !== State.Text && this.baseState !== State.InSpecialTag) {
      if (this.sectionStart < this.entityStart) {
        this.cbs.onattribdata(this.sectionStart, this.entityStart);
      }
      this.sectionStart = this.entityStart + consumed;
      this.index = this.sectionStart - 1;
      this.cbs.onattribentity(cp);
    } else {
      if (this.sectionStart < this.entityStart) {
        this.cbs.ontext(this.sectionStart, this.entityStart);
      }
      this.sectionStart = this.entityStart + consumed;
      this.index = this.sectionStart - 1;
      this.cbs.ontextentity(cp, this.sectionStart);
    }
  }
}
const { fromCodePoint } = String;
const formTags = /* @__PURE__ */ new Set([
  "input",
  "option",
  "optgroup",
  "select",
  "button",
  "datalist",
  "textarea"
]);
const pTag = /* @__PURE__ */ new Set(["p"]);
const headingTags = /* @__PURE__ */ new Set(["h1", "h2", "h3", "h4", "h5", "h6", "p"]);
const tableSectionTags = /* @__PURE__ */ new Set(["thead", "tbody"]);
const ddtTags = /* @__PURE__ */ new Set(["dd", "dt"]);
const rtpTags = /* @__PURE__ */ new Set(["rt", "rp"]);
const openImpliesClose = /* @__PURE__ */ new Map([
  ["tr", /* @__PURE__ */ new Set(["tr", "th", "td"])],
  ["th", /* @__PURE__ */ new Set(["th"])],
  ["td", /* @__PURE__ */ new Set(["thead", "th", "td"])],
  ["body", /* @__PURE__ */ new Set(["head", "link", "script"])],
  ["a", /* @__PURE__ */ new Set(["a"])],
  ["li", /* @__PURE__ */ new Set(["li"])],
  ["p", pTag],
  ["h1", headingTags],
  ["h2", headingTags],
  ["h3", headingTags],
  ["h4", headingTags],
  ["h5", headingTags],
  ["h6", headingTags],
  ["select", formTags],
  ["input", formTags],
  ["output", formTags],
  ["button", formTags],
  ["datalist", formTags],
  ["textarea", formTags],
  ["option", /* @__PURE__ */ new Set(["option"])],
  ["optgroup", /* @__PURE__ */ new Set(["optgroup", "option"])],
  ["dd", ddtTags],
  ["dt", ddtTags],
  ["address", pTag],
  ["article", pTag],
  ["aside", pTag],
  ["blockquote", pTag],
  ["details", pTag],
  ["div", pTag],
  ["dl", pTag],
  ["fieldset", pTag],
  ["figcaption", pTag],
  ["figure", pTag],
  ["footer", pTag],
  ["form", pTag],
  ["header", pTag],
  ["hr", pTag],
  ["main", pTag],
  ["nav", pTag],
  ["ol", pTag],
  ["pre", pTag],
  ["section", pTag],
  ["table", pTag],
  ["ul", pTag],
  ["rt", rtpTags],
  ["rp", rtpTags],
  ["tbody", tableSectionTags],
  ["tfoot", tableSectionTags]
]);
const DOCUMENT_TYPE = "doctype";
const voidElements = /* @__PURE__ */ new Set([
  "area",
  "base",
  "basefont",
  "br",
  "col",
  "command",
  "embed",
  "frame",
  "hr",
  "img",
  "input",
  "isindex",
  "keygen",
  "link",
  "meta",
  "param",
  "source",
  "track",
  "wbr"
]);
const foreignContextElements = /* @__PURE__ */ new Set(["math", "svg"]);
const htmlIntegrationElements = /* @__PURE__ */ new Set([
  "mi",
  "mo",
  "mn",
  "ms",
  "mtext",
  "annotation-xml",
  "foreignObject",
  "desc",
  "title"
]);
const svgTagNameAdjustments = /* @__PURE__ */ new Map([
  ["altglyph", "altGlyph"],
  ["altglyphdef", "altGlyphDef"],
  ["altglyphitem", "altGlyphItem"],
  ["animatecolor", "animateColor"],
  ["animatemotion", "animateMotion"],
  ["animatetransform", "animateTransform"],
  ["clippath", "clipPath"],
  ["feblend", "feBlend"],
  ["fecolormatrix", "feColorMatrix"],
  ["fecomponenttransfer", "feComponentTransfer"],
  ["fecomposite", "feComposite"],
  ["feconvolvematrix", "feConvolveMatrix"],
  ["fediffuselighting", "feDiffuseLighting"],
  ["fedisplacementmap", "feDisplacementMap"],
  ["fedistantlight", "feDistantLight"],
  ["fedropshadow", "feDropShadow"],
  ["feflood", "feFlood"],
  ["fefunca", "feFuncA"],
  ["fefuncb", "feFuncB"],
  ["fefuncg", "feFuncG"],
  ["fefuncr", "feFuncR"],
  ["fegaussianblur", "feGaussianBlur"],
  ["feimage", "feImage"],
  ["femerge", "feMerge"],
  ["femergenode", "feMergeNode"],
  ["femorphology", "feMorphology"],
  ["feoffset", "feOffset"],
  ["fepointlight", "fePointLight"],
  ["fespecularlighting", "feSpecularLighting"],
  ["fespotlight", "feSpotLight"],
  ["fetile", "feTile"],
  ["feturbulence", "feTurbulence"],
  ["foreignobject", "foreignObject"],
  ["glyphref", "glyphRef"],
  ["lineargradient", "linearGradient"],
  ["radialgradient", "radialGradient"],
  ["textpath", "textPath"]
]);
var ForeignContext;
(function(ForeignContext2) {
  ForeignContext2[ForeignContext2["None"] = 0] = "None";
  ForeignContext2[ForeignContext2["Svg"] = 1] = "Svg";
  ForeignContext2[ForeignContext2["MathML"] = 2] = "MathML";
})(ForeignContext || (ForeignContext = {}));
const reNameEnd = /\s|\//;
class Parser2 {
  options;
  /** The start index of the last event. */
  startIndex = 0;
  /** The end index of the last event. */
  endIndex = 0;
  /**
   * Store the start index of the current open tag,
   * so we can update the start index for attributes.
   */
  openTagStart = 0;
  tagname = "";
  attribname = "";
  attribvalue = "";
  attribs = null;
  stack = [];
  foreignContext;
  cbs;
  lowerCaseTagNames;
  lowerCaseAttributeNames;
  recognizeSelfClosing;
  /** We are parsing HTML. Inverse of the `xmlMode` option. */
  htmlMode;
  tokenizer;
  buffers = [];
  bufferOffset = 0;
  /** The index of the last written buffer. Used when resuming after a `pause()`. */
  writeIndex = 0;
  /** Indicates whether the parser has finished running / `.end` has been called. */
  ended = false;
  constructor(cbs, options = {}) {
    this.options = options;
    this.cbs = cbs ?? {};
    this.htmlMode = !this.options.xmlMode;
    this.lowerCaseTagNames = options.lowerCaseTags ?? this.htmlMode;
    this.lowerCaseAttributeNames = options.lowerCaseAttributeNames ?? this.htmlMode;
    this.recognizeSelfClosing = options.recognizeSelfClosing ?? !this.htmlMode;
    this.tokenizer = new (options.Tokenizer ?? Tokenizer)(this.options, this);
    this.foreignContext = [ForeignContext.None];
    this.cbs.onparserinit?.(this);
  }
  // Tokenizer event handlers
  /**
   * @param start Start index for the current parser event.
   * @param endIndex End index for the current parser event.
   * @internal
   */
  ontext(start, endIndex) {
    const data = this.getSlice(start, endIndex);
    this.endIndex = endIndex - 1;
    this.cbs.ontext?.(data);
    this.startIndex = endIndex;
  }
  /**
   * @param cp Current Unicode code point.
   * @param endIndex End index for the current parser event.
   * @internal
   */
  ontextentity(cp, endIndex) {
    this.endIndex = endIndex - 1;
    this.cbs.ontext?.(fromCodePoint(cp));
    this.startIndex = endIndex;
  }
  /** @internal */
  isInForeignContext() {
    return this.foreignContext[0] !== ForeignContext.None;
  }
  /**
   * Checks if the current tag is a void element. Override this if you want
   * to specify your own additional void elements.
   * @param name Name of the pseudo selector.
   */
  isVoidElement(name) {
    return this.htmlMode && voidElements.has(name);
  }
  /**
   * Read a tag name from the buffer.
   *
   * When `lowerCaseTagNames` is enabled (the default in HTML mode), the name
   * is lowercased and may be adjusted for SVG casing or the `image` → `img`
   * alias.
   * @param start Start index of the tag name in the buffer.
   * @param endIndex End index of the tag name in the buffer.
   */
  readTagName(start, endIndex) {
    const name = this.lowerCaseTagNames ? this.getSlice(start, endIndex).toLowerCase() : this.getSlice(start, endIndex);
    if (!(this.lowerCaseTagNames && this.htmlMode)) {
      return name;
    }
    if (this.foreignContext[0] === ForeignContext.Svg) {
      return svgTagNameAdjustments.get(name) ?? name;
    }
    if (this.foreignContext.length > 1) {
      const adjusted = svgTagNameAdjustments.get(name);
      if (adjusted !== void 0 && this.stack.includes(adjusted)) {
        return adjusted;
      }
    }
    if (!this.isInForeignContext()) {
      return name === "image" ? "img" : name;
    }
    return name;
  }
  /**
   * @param start Start index for the current parser event.
   * @param endIndex End index for the current parser event.
   * @internal
   */
  onopentagname(start, endIndex) {
    this.endIndex = endIndex;
    this.emitOpenTag(this.readTagName(start, endIndex));
  }
  emitOpenTag(name) {
    this.openTagStart = this.startIndex;
    this.tagname = name;
    if (this.htmlMode && name === "form" && this.stack.includes("form")) {
      this.tagname = "";
      return;
    }
    const impliesClose = this.htmlMode && openImpliesClose.get(name);
    if (impliesClose) {
      while (this.stack.length > 0 && impliesClose.has(this.stack[0])) {
        this.popElement(true);
      }
    }
    if (!this.isVoidElement(name)) {
      this.stack.unshift(name);
      if (this.htmlMode) {
        if (name === "svg") {
          this.foreignContext.unshift(ForeignContext.Svg);
        } else if (name === "math") {
          this.foreignContext.unshift(ForeignContext.MathML);
        } else if (htmlIntegrationElements.has(name)) {
          this.foreignContext.unshift(ForeignContext.None);
        }
      }
    }
    this.cbs.onopentagname?.(name);
    if (this.cbs.onopentag)
      this.attribs = {};
  }
  endOpenTag(isImplied) {
    this.startIndex = this.openTagStart;
    if (this.attribs) {
      this.cbs.onopentag?.(this.tagname, this.attribs, isImplied);
      this.attribs = null;
    }
    if (this.cbs.onclosetag && this.isVoidElement(this.tagname)) {
      this.cbs.onclosetag(this.tagname, true);
    }
    this.tagname = "";
  }
  /**
   * @param endIndex End index for the current parser event.
   * @internal
   */
  onopentagend(endIndex) {
    this.endIndex = endIndex;
    this.endOpenTag(false);
    this.startIndex = endIndex + 1;
  }
  /**
   * @param start Start index for the current parser event.
   * @param endIndex End index for the current parser event.
   * @internal
   */
  onclosetag(start, endIndex) {
    this.endIndex = endIndex;
    const name = this.readTagName(start, endIndex);
    if (!this.isVoidElement(name)) {
      const pos = this.stack.indexOf(name);
      if (pos !== -1) {
        for (let index2 = 0; index2 < pos; index2++) {
          this.popElement(true);
        }
        this.popElement(false);
      } else if (this.htmlMode && name === "p") {
        this.emitOpenTag("p");
        this.closeCurrentTag(true);
      }
    } else if (this.htmlMode && name === "br") {
      this.cbs.onopentagname?.("br");
      this.cbs.onopentag?.("br", {}, true);
      this.cbs.onclosetag?.("br", false);
    }
    this.startIndex = endIndex + 1;
  }
  /**
   * @param endIndex End index for the current parser event.
   * @internal
   */
  onselfclosingtag(endIndex) {
    this.endIndex = endIndex;
    if (this.recognizeSelfClosing || this.isInForeignContext()) {
      this.closeCurrentTag(false);
      this.startIndex = endIndex + 1;
    } else {
      this.onopentagend(endIndex);
    }
  }
  /**
   * Pop the top element off the stack, emit a close event, and maintain
   * the foreign context stack.
   * @param implied Whether this close is implied (not from an explicit end tag).
   */
  popElement(implied) {
    const element = this.stack.shift();
    if (this.htmlMode && (foreignContextElements.has(element) || htmlIntegrationElements.has(element))) {
      this.foreignContext.shift();
    }
    this.cbs.onclosetag?.(element, implied);
  }
  closeCurrentTag(isOpenImplied) {
    const name = this.tagname;
    this.endOpenTag(isOpenImplied);
    if (this.stack[0] === name) {
      this.popElement(!isOpenImplied);
    }
  }
  /**
   * @param start Start index for the current parser event.
   * @param endIndex End index for the current parser event.
   * @internal
   */
  onattribname(start, endIndex) {
    this.startIndex = start;
    const name = this.getSlice(start, endIndex);
    this.attribname = this.lowerCaseAttributeNames ? name.toLowerCase() : name;
  }
  /**
   * @param start Start index for the current parser event.
   * @param endIndex End index for the current parser event.
   * @internal
   */
  onattribdata(start, endIndex) {
    this.attribvalue += this.getSlice(start, endIndex);
  }
  /**
   * @param cp Current Unicode code point.
   * @internal
   */
  onattribentity(cp) {
    this.attribvalue += fromCodePoint(cp);
  }
  /**
   * @param quote Quote type used for the current attribute.
   * @param endIndex End index for the current parser event.
   * @internal
   */
  onattribend(quote, endIndex) {
    this.endIndex = endIndex;
    this.cbs.onattribute?.(this.attribname, this.attribvalue, quote === QuoteType.Double ? '"' : quote === QuoteType.Single ? "'" : quote === QuoteType.NoValue ? void 0 : null);
    if (this.attribs && !Object.hasOwn(this.attribs, this.attribname)) {
      this.attribs[this.attribname] = this.attribvalue;
    }
    this.attribvalue = "";
  }
  getInstructionName(value) {
    const index2 = value.search(reNameEnd);
    let name = index2 < 0 ? value : value.substr(0, index2);
    if (this.lowerCaseTagNames) {
      name = name.toLowerCase();
    }
    return name;
  }
  /**
   * @param start Start index for the current parser event.
   * @param endIndex End index for the current parser event.
   * @internal
   */
  ondeclaration(start, endIndex) {
    this.endIndex = endIndex;
    const value = this.getSlice(start, endIndex);
    if (this.cbs.onprocessinginstruction) {
      const name = this.htmlMode ? this.lowerCaseTagNames ? DOCUMENT_TYPE : value.slice(0, DOCUMENT_TYPE.length) : this.getInstructionName(value);
      this.cbs.onprocessinginstruction(`!${name}`, `!${value}`);
    }
    this.startIndex = endIndex + 1;
  }
  /**
   * @param start Start index for the current parser event.
   * @param endIndex End index for the current parser event.
   * @internal
   */
  onprocessinginstruction(start, endIndex) {
    this.endIndex = endIndex;
    const value = this.getSlice(start, endIndex);
    if (this.cbs.onprocessinginstruction) {
      const name = this.getInstructionName(value);
      this.cbs.onprocessinginstruction(`?${name}`, `?${value}`);
    }
    this.startIndex = endIndex + 1;
  }
  /**
   * @param start Start index for the current parser event.
   * @param endIndex End index for the current parser event.
   * @param offset Offset applied when computing parser indices.
   * @internal
   */
  oncomment(start, endIndex, offset) {
    this.endIndex = endIndex;
    this.cbs.oncomment?.(this.getSlice(start, endIndex - offset));
    this.cbs.oncommentend?.();
    this.startIndex = endIndex + 1;
  }
  /**
   * @param start Start index for the current parser event.
   * @param endIndex End index for the current parser event.
   * @param offset Offset applied when computing parser indices.
   * @internal
   */
  oncdata(start, endIndex, offset) {
    this.endIndex = endIndex;
    const value = this.getSlice(start, endIndex - offset);
    if (!this.htmlMode || this.options.recognizeCDATA) {
      this.cbs.oncdatastart?.();
      this.cbs.ontext?.(value);
      this.cbs.oncdataend?.();
    } else if (this.isInForeignContext()) {
      this.cbs.ontext?.(value);
    } else {
      this.cbs.oncomment?.(`[CDATA[${value}]]`);
      this.cbs.oncommentend?.();
    }
    this.startIndex = endIndex + 1;
  }
  /** @internal */
  onend() {
    if (this.cbs.onclosetag) {
      this.endIndex = this.startIndex;
      for (let index2 = 0; index2 < this.stack.length; index2++) {
        this.cbs.onclosetag(this.stack[index2], true);
      }
    }
    this.cbs.onend?.();
  }
  /**
   * Resets the parser to a blank state, ready to parse a new HTML document
   */
  reset() {
    this.cbs.onreset?.();
    this.tokenizer.reset();
    this.tagname = "";
    this.attribname = "";
    this.attribvalue = "";
    this.attribs = null;
    this.stack.length = 0;
    this.startIndex = 0;
    this.endIndex = 0;
    this.cbs.onparserinit?.(this);
    this.buffers.length = 0;
    this.foreignContext.length = 0;
    this.foreignContext.unshift(ForeignContext.None);
    this.bufferOffset = 0;
    this.writeIndex = 0;
    this.ended = false;
  }
  /**
   * Resets the parser, then parses a complete document and
   * pushes it to the handler.
   * @param data Document to parse.
   */
  parseComplete(data) {
    this.reset();
    this.end(data);
  }
  getSlice(start, end) {
    if (start === end) {
      return "";
    }
    while (start - this.bufferOffset >= this.buffers[0].length) {
      this.shiftBuffer();
    }
    let slice = this.buffers[0].slice(start - this.bufferOffset, end - this.bufferOffset);
    while (end - this.bufferOffset > this.buffers[0].length) {
      this.shiftBuffer();
      slice += this.buffers[0].slice(0, end - this.bufferOffset);
    }
    return slice;
  }
  shiftBuffer() {
    this.bufferOffset += this.buffers[0].length;
    this.writeIndex--;
    this.buffers.shift();
  }
  /**
   * Parses a chunk of data and calls the corresponding callbacks.
   * @param chunk Chunk to parse.
   */
  write(chunk) {
    if (this.ended) {
      this.cbs.onerror?.(new Error(".write() after done!"));
      return;
    }
    this.buffers.push(chunk);
    if (this.tokenizer.running) {
      this.tokenizer.write(chunk);
      this.writeIndex++;
    }
  }
  /**
   * Parses the end of the buffer and clears the stack, calls onend.
   * @param chunk Optional final chunk to parse.
   */
  end(chunk) {
    if (this.ended) {
      this.cbs.onerror?.(new Error(".end() after done!"));
      return;
    }
    if (chunk)
      this.write(chunk);
    this.ended = true;
    this.tokenizer.end();
  }
  /**
   * Pauses parsing. The parser won't emit events until `resume` is called.
   */
  pause() {
    this.tokenizer.pause();
  }
  /**
   * Resumes parsing after `pause` was called.
   */
  resume() {
    this.tokenizer.resume();
    while (this.tokenizer.running && this.writeIndex < this.buffers.length) {
      this.tokenizer.write(this.buffers[this.writeIndex++]);
    }
    if (this.ended)
      this.tokenizer.end();
  }
}
const VOID_ELEMENTS = /* @__PURE__ */ new Set([
  "area",
  "base",
  "br",
  "col",
  "embed",
  "hr",
  "img",
  "input",
  "link",
  "meta",
  "param",
  "source",
  "track",
  "wbr"
]);
function attribsToComarkAttrs(attribs, isInline = false) {
  const attrs = {
    $: {
      html: 1,
      block: isInline ? 0 : 1
    }
  };
  for (const key in attribs) {
    const value = attribs[key];
    if (value === "") {
      attrs[`:${key}`] = "true";
    } else {
      attrs[key] = value;
    }
  }
  return attrs;
}
function parseInlineHtmlTag(html2) {
  const trimmed = html2.trim();
  if (!trimmed.startsWith("<"))
    return null;
  const closeMatch = trimmed.match(/^<\/([a-z][a-z0-9]*)\s*>/i);
  if (closeMatch) {
    return { tag: closeMatch[1].toLowerCase(), attrs: {}, isVoid: false, isClose: true };
  }
  let info = null;
  const parser = new Parser2({
    onopentag(name, attribs) {
      info = {
        tag: name,
        attrs: attribsToComarkAttrs(attribs, true),
        isVoid: VOID_ELEMENTS.has(name),
        isClose: false
      };
    }
  }, { decodeEntities: false });
  parser.write(trimmed);
  parser.end();
  return info;
}
function htmlToNodes(html2) {
  const root = [];
  const stack = [];
  const parser = new Parser2({
    onopentag(name, attribs) {
      const attrs = attribsToComarkAttrs(attribs);
      if (VOID_ELEMENTS.has(name)) {
        const node = [name, attrs];
        if (stack.length > 0) {
          stack[stack.length - 1].children.push(node);
        } else {
          root.push(node);
        }
        return;
      }
      stack.push({ tag: name, attrs, children: [] });
    },
    ontext(text2) {
      const trimmed = text2.trim();
      if (!trimmed)
        return;
      if (stack.length > 0) {
        stack[stack.length - 1].children.push(trimmed);
      } else {
        root.push(trimmed);
      }
    },
    onclosetag(name) {
      if (VOID_ELEMENTS.has(name)) {
        return;
      }
      let idx = stack.length - 1;
      while (idx >= 0 && stack[idx].tag !== name) {
        idx--;
      }
      if (idx >= 0) {
        while (stack.length > idx) {
          const frame = stack.pop();
          const node = frame.children.length > 0 ? [frame.tag, frame.attrs, ...frame.children] : [frame.tag, frame.attrs];
          if (stack.length > 0) {
            stack[stack.length - 1].children.push(node);
          } else {
            root.push(node);
          }
        }
      }
    },
    oncomment(data) {
      const node = [null, {}, data];
      if (stack.length > 0) {
        stack[stack.length - 1].children.push(node);
      } else {
        root.push(node);
      }
    }
  }, { decodeEntities: true });
  parser.write(html2.trim());
  parser.end();
  return root;
}
const WRAPPER_TAGS = /* @__PURE__ */ new Set(["ul", "ol", "table", "blockquote", "pre"]);
const BLOCK_TAG_MAP = {
  blockquote_open: "blockquote",
  ordered_list_open: "ol",
  bullet_list_open: "ul",
  list_item_open: "li",
  paragraph_open: "p",
  table_open: "table",
  thead_open: "thead",
  tbody_open: "tbody",
  tr_open: "tr",
  th_open: "th",
  td_open: "td"
};
const INLINE_TAG_MAP = {
  strong_open: "strong",
  em_open: "em",
  s_open: "del",
  sub_open: "sub",
  sup_open: "sup"
};
function marmdownItTokensToMarkdownDocument(tokens, opts) {
  const options = { startLine: 0, preservePositions: false, headingIds: true, ...opts };
  const state = {
    headingSlugCounts: /* @__PURE__ */ new Map(),
    headingStack: [],
    headingIds: options.headingIds ?? true
  };
  const nodes = [];
  let i = 0;
  let endLine = options.startLine;
  while (i < tokens.length) {
    const token = tokens[i];
    if (token.type === "html_block") {
      const result2 = processHtmlBlockTokens(tokens, i);
      nodes.push(...result2.nodes);
      i = result2.nextIndex;
      continue;
    }
    const result = processBlockToken(tokens, i, false, state);
    if (result.node) {
      if (options.preservePositions) {
        for (let j = i; j < result.nextIndex; j++) {
          if (tokens[j].map && tokens[j].map[1]) {
            endLine = tokens[j].map[1] + options.startLine + (tokens[j].type?.endsWith("_close") ? 1 : 0);
          }
        }
        if (!result.node[1].$) {
          result.node[1].$ = {};
        }
        result.node[1].$.line = endLine;
      }
      nodes.push(result.node);
    }
    i = result.nextIndex;
  }
  return nodes;
}
function processHtmlBlockTokens(tokens, startIndex) {
  const content = typeof tokens[startIndex]?.content === "string" ? tokens[startIndex].content : "";
  return { nodes: htmlToNodes(content), nextIndex: startIndex + 1 };
}
function processAttributes(attrsArray, options = {}) {
  const { handleJSON = true, filterEmpty = false } = options;
  const attrs = {};
  if (!attrsArray || !Array.isArray(attrsArray)) {
    return attrs;
  }
  for (const attr of attrsArray) {
    if (Array.isArray(attr) && attr.length >= 2) {
      const [key] = attr;
      let value = attr[1];
      if (filterEmpty && (value === "" || value === null || value === void 0)) {
        continue;
      }
      if (handleJSON && typeof value === "string") {
        if (value.startsWith("{") && value.endsWith("}")) {
          try {
            value = JSON.parse(value);
          } catch {
          }
        } else if (value.startsWith("[") && value.endsWith("]")) {
          try {
            value = JSON.parse(value);
          } catch {
          }
        }
      }
      if (key === "class" && typeof attrs[key] === "string") {
        attrs[key] = `${attrs[key]} ${value}`;
      } else {
        attrs[key] = value;
      }
    }
  }
  return attrs;
}
const MAX_HIGHLIGHT_LINES = 1e3;
function parseCodeblockInfo(info) {
  if (!info) {
    return {};
  }
  const result = {};
  let remaining = info.trim();
  const languageMatch = remaining.match(/^([^\s[{}"'<>`]+)/);
  if (languageMatch) {
    result.language = languageMatch[1];
    remaining = remaining.slice(languageMatch[1].length).trim();
  }
  while (remaining && (remaining.startsWith("{") || remaining.startsWith("["))) {
    if (remaining.startsWith("{")) {
      const highlightsMatch = remaining.match(/^\{([^}]+)\}/);
      if (highlightsMatch) {
        const highlightsStr = highlightsMatch[1];
        remaining = remaining.slice(highlightsMatch[0].length).trim();
        const highlights = [];
        const parts = highlightsStr.split(",");
        for (const part of parts) {
          const trimmed = part.trim();
          if (trimmed.includes("-")) {
            const [start, end] = trimmed.split("-").map((s) => Number.parseInt(s.trim(), 10));
            if (!Number.isNaN(start) && !Number.isNaN(end) && end - start <= MAX_HIGHLIGHT_LINES) {
              for (let i = start; i <= end && highlights.length < MAX_HIGHLIGHT_LINES; i++) {
                highlights.push(i);
              }
            }
          } else {
            const num = Number.parseInt(trimmed, 10);
            if (!Number.isNaN(num) && highlights.length < MAX_HIGHLIGHT_LINES) {
              highlights.push(num);
            }
          }
        }
        if (highlights.length > 0) {
          result.highlights = highlights;
        }
      } else {
        break;
      }
    } else if (remaining.startsWith("[")) {
      let depth = 0;
      let i = 0;
      for (; i < remaining.length; i++) {
        if (remaining[i] === "[") {
          depth++;
        } else if (remaining[i] === "]") {
          depth--;
          if (depth === 0) {
            const filename = remaining.slice(1, i);
            result.filename = filename.replace(/\\\\/g, "");
            remaining = remaining.slice(i + 1).trim();
            break;
          }
        }
      }
      if (depth !== 0) {
        break;
      }
    }
  }
  if (remaining) {
    result.meta = remaining;
  }
  return result;
}
function extractAttributes(tokens, startIndex, skipEmptyText = true) {
  let propsIndex = startIndex;
  if (skipEmptyText) {
    while (propsIndex < tokens.length && tokens[propsIndex].type === "text" && !tokens[propsIndex].content?.trim()) {
      propsIndex++;
    }
  }
  if (propsIndex < tokens.length && tokens[propsIndex].type === "mdc_inline_props") {
    const propsToken = tokens[propsIndex];
    const attrs = processAttributes(propsToken.attrs);
    return { attrs, nextIndex: propsIndex + 1 };
  }
  return { attrs: {}, nextIndex: startIndex };
}
function processBlockToken(tokens, startIndex, insideNestedContext = false, state) {
  const token = tokens[startIndex];
  if (token.type === "hr") {
    return { node: ["hr", {}], nextIndex: startIndex + 1 };
  }
  if (token.type === "html_block") {
    const result = processHtmlBlockTokens(tokens, startIndex);
    return { node: result.nodes[0] ?? null, nextIndex: result.nextIndex };
  }
  if (token.type === "mdc_block_open") {
    const componentName2 = token.tag || "component";
    const attrs2 = processAttributes(token.attrs);
    const children = processBlockChildrenWithSlots(tokens, startIndex + 1, "mdc_block_close", state);
    if (WRAPPER_TAGS.has(componentName2) && children.nodes.length === 1 && Array.isArray(children.nodes[0]) && children.nodes[0][0] === componentName2) {
      const inner = children.nodes[0];
      const innerAttrs = inner[1];
      const innerChildren = inner.slice(2);
      return {
        node: [componentName2, { ...innerAttrs, ...attrs2 }, ...innerChildren],
        nextIndex: children.nextIndex + 1
      };
    }
    return { node: [componentName2, attrs2, ...children.nodes], nextIndex: children.nextIndex + 1 };
  }
  if (token.type === "mdc_block_shorthand") {
    let nextIndex = startIndex + 1;
    const componentName2 = token.tag || "component";
    const attrs2 = processAttributes(token.attrs, { handleJSON: false });
    const children = [];
    if (token.nesting === 1) {
      while (nextIndex < tokens.length) {
        const childToken = tokens[nextIndex];
        nextIndex++;
        if (childToken.type === "mdc_block_shorthand" && childToken.nesting === -1) {
          break;
        }
        if (childToken.type === "inline") {
          const inlineNodes = processInlineTokens(childToken.children || [], false);
          children.push(...inlineNodes);
        }
      }
    }
    return { node: [componentName2, attrs2, ...children], nextIndex };
  }
  if (token.type === "math_block") {
    return {
      node: ["math", { class: "math block", content: token.content }, token.content],
      nextIndex: startIndex + 1
    };
  }
  if (token.type === "fence" || token.type === "fenced_code_block" || token.type === "code_block") {
    const content = token.content || "";
    const info = token.info || token.params || "";
    const parsed = parseCodeblockInfo(info);
    const preAttrs = parsed;
    const codeAttrs = {};
    if (parsed.language && parsed.language.trim()) {
      preAttrs.language = parsed.language;
      codeAttrs["class"] = `language-${parsed.language}`;
    }
    const codeContentWithoutLastNewline = content.endsWith("\n") ? content.slice(0, -1) : content;
    const code2 = ["code", codeAttrs, codeContentWithoutLastNewline];
    const pre = ["pre", preAttrs, code2];
    return { node: pre, nextIndex: startIndex + 1 };
  }
  if (token.type === "heading_open") {
    const level = Number.parseInt(token.tag.replace("h", ""), 10);
    const headingTag = `h${level}`;
    const userAttrs = processAttributes(token.attrs, { handleJSON: false });
    const children = processBlockChildren(tokens, startIndex + 1, "heading_close", true, true, insideNestedContext, state);
    if (children.nodes.length > 0) {
      let attrs2;
      if (state?.headingIds) {
        const text2 = children.nodes.map((n) => textContent(n)).join("");
        const headingId = uniqueSlug(slugify(text2), level, state);
        attrs2 = { id: headingId, ...userAttrs };
      } else {
        attrs2 = userAttrs;
      }
      return {
        node: [headingTag, attrs2, ...children.nodes],
        nextIndex: children.nextIndex + 1
      };
    }
    return { node: null, nextIndex: children.nextIndex + 1 };
  }
  if (token.type === "list_item_open") {
    const attrs2 = processAttributes(token.attrs, { handleJSON: false });
    const children = processBlockChildren(tokens, startIndex + 1, "list_item_close", false, false, true, state);
    if (children.nodes.length > 0) {
      return { node: ["li", attrs2, ...children.nodes], nextIndex: children.nextIndex + 1 };
    }
    return { node: null, nextIndex: children.nextIndex + 1 };
  }
  const tagName = BLOCK_TAG_MAP[token.type];
  if (tagName) {
    const attrs2 = processAttributes(token.attrs, { handleJSON: false });
    const closeType = token.type.replace("_open", "_close");
    const isNestedContext = ["td", "th"].includes(tagName);
    const children = processBlockChildren(tokens, startIndex + 1, closeType, false, false, isNestedContext, state);
    return { node: [tagName, attrs2, ...children.nodes], nextIndex: children.nextIndex + 1 };
  }
  const componentName = token.tag || "component";
  const attrs = processAttributes(token.attrs, { handleJSON: false });
  return { node: [componentName, attrs], nextIndex: startIndex + 1 };
}
function processBlockChildrenWithSlots(tokens, startIndex, closeType, state) {
  const nodes = [];
  let i = startIndex;
  let currentSlotName = null;
  let currentSlotAttrs = {};
  let currentSlotChildren = [];
  while (i < tokens.length && tokens[i].type !== closeType) {
    const token = tokens[i];
    if (token.type === "html_block") {
      const result2 = processHtmlBlockTokens(tokens, i);
      if (currentSlotName !== null) {
        currentSlotChildren.push(...result2.nodes);
      } else {
        nodes.push(...result2.nodes);
      }
      i = result2.nextIndex;
      continue;
    }
    if (token.type === "mdc_block_slot") {
      if (token.attrs && Array.isArray(token.attrs) && token.attrs.length > 0) {
        const firstAttr = token.attrs[0];
        if (Array.isArray(firstAttr) && firstAttr.length > 0) {
          const slotKey = firstAttr[0];
          if (slotKey.startsWith("#")) {
            const slotName = slotKey.substring(1);
            const slotAttrs = processAttributes(token.attrs.slice(1));
            if (currentSlotName !== null && currentSlotChildren.length > 0) {
              nodes.push([
                "template",
                {
                  name: currentSlotName,
                  ...currentSlotAttrs
                },
                ...currentSlotChildren
              ]);
              currentSlotChildren = [];
            }
            currentSlotName = slotName;
            currentSlotAttrs = slotAttrs;
            i++;
            continue;
          }
        }
      }
      i++;
      continue;
    }
    const result = processBlockToken(tokens, i, false, state);
    i = result.nextIndex;
    if (result.node) {
      if (currentSlotName !== null) {
        currentSlotChildren.push(result.node);
      } else {
        nodes.push(result.node);
      }
    }
  }
  if (currentSlotName !== null && currentSlotChildren.length > 0) {
    nodes.push([
      "template",
      {
        name: currentSlotName,
        ...currentSlotAttrs
      },
      ...currentSlotChildren
    ]);
  }
  return { nodes, nextIndex: i };
}
function processBlockChildren(tokens, startIndex, closeType, inlineOnly, inHeading = false, insideNestedContext = false, state) {
  const nodes = [];
  let i = startIndex;
  while (i < tokens.length && tokens[i].type !== closeType) {
    const token = tokens[i];
    if (token.type === "html_block") {
      const result = processHtmlBlockTokens(tokens, i);
      nodes.push(...result.nodes);
      i = result.nextIndex;
      continue;
    }
    if (token.type === "inline") {
      const inlineNodes = processInlineTokens(token.children || [], inHeading);
      nodes.push(...inlineNodes);
      i++;
    } else if (token.type === "hardbreak" || token.type === "hard_break") {
      nodes.push(["br", {}]);
      i++;
    } else if (token.type === "softbreak") {
      nodes.push("\n");
      i++;
    } else if (inlineOnly && (token.type === "text" || token.type === "code_inline")) {
      if (token.content) {
        nodes.push(token.content);
      }
      i++;
    } else {
      const result = processBlockToken(tokens, i, insideNestedContext, state);
      i = result.nextIndex;
      if (result.node) {
        nodes.push(result.node);
      }
    }
  }
  return { nodes: mergeAdjacentTextNodes(nodes), nextIndex: i };
}
function mergeAdjacentTextNodes(nodes) {
  const merged = [];
  for (const node of nodes) {
    const lastNode = merged[merged.length - 1];
    if (typeof node === "string" && typeof lastNode === "string") {
      merged[merged.length - 1] = lastNode + node;
    } else {
      merged.push(node);
    }
  }
  return merged;
}
function slugify(text2) {
  let slug = text2.toLowerCase().trim().replace(/\s+/g, "-").replace(/[^\w-]+/g, "").replace(/-{2,}/g, "-").replace(/^-+|-+$/g, "");
  if (/^\d/.test(slug)) {
    slug = "_" + slug;
  }
  return slug;
}
function uniqueSlug(slug, level, state) {
  if (!state)
    return slug;
  while (state.headingStack.length > 0 && state.headingStack[state.headingStack.length - 1].level >= level) {
    state.headingStack.pop();
  }
  if (state.headingStack.length > 0) {
    const parent = state.headingStack[state.headingStack.length - 1];
    if (parent.level >= 2) {
      slug = parent.id + "-" + slug;
    }
  }
  state.headingStack.push({ level, id: slug });
  const count = state.headingSlugCounts.get(slug) ?? 0;
  state.headingSlugCounts.set(slug, count + 1);
  return count === 0 ? slug : `${slug}-${count}`;
}
function processInlineTokens(tokens, inHeading = false) {
  const nodes = [];
  let i = 0;
  while (i < tokens.length) {
    const token = tokens[i];
    if (token.type === "mdc_inline_props" && token.hidden) {
      i++;
      continue;
    }
    const result = processInlineToken(tokens, i, inHeading);
    i = result.nextIndex;
    if (result.node) {
      nodes.push(result.node);
    }
  }
  return mergeAdjacentTextNodes(nodes);
}
const MAX_INLINE_HTML_DEPTH = 100;
function processInlineToken(tokens, startIndex, inHeading = false, htmlDepth = 0) {
  const token = tokens[startIndex];
  if (token.type === "text") {
    return { node: token.content || null, nextIndex: startIndex + 1 };
  }
  if (token.type === "emoji") {
    return { node: token.content || null, nextIndex: startIndex + 1 };
  }
  if (token.type === "html_inline") {
    const content = token.content || "";
    const tagInfo = parseInlineHtmlTag(content);
    if (!tagInfo) {
      return { node: content || null, nextIndex: startIndex + 1 };
    }
    if (tagInfo.isClose) {
      return { node: null, nextIndex: startIndex + 1 };
    }
    if (tagInfo.isVoid) {
      return { node: [tagInfo.tag, tagInfo.attrs], nextIndex: startIndex + 1 };
    }
    if (htmlDepth >= MAX_INLINE_HTML_DEPTH) {
      return { node: content || null, nextIndex: startIndex + 1 };
    }
    const children = [];
    let j = startIndex + 1;
    while (j < tokens.length) {
      const nextToken = tokens[j];
      if (nextToken.type === "html_inline") {
        const nextInfo = parseInlineHtmlTag(nextToken.content || "");
        if (nextInfo?.isClose && nextInfo.tag === tagInfo.tag) {
          j++;
          break;
        }
      }
      const result = processInlineToken(tokens, j, inHeading, htmlDepth + 1);
      j = result.nextIndex;
      if (result.node) {
        children.push(result.node);
      }
    }
    const node = children.length > 0 ? [tagInfo.tag, tagInfo.attrs, ...children] : [tagInfo.tag, tagInfo.attrs];
    return { node, nextIndex: j };
  }
  if (token.type === "mdc_inline_span" && token.nesting === 1) {
    const attrs = {};
    let i = startIndex + 1;
    const nodes = [];
    while (i < tokens.length) {
      const childToken = tokens[i];
      if (childToken.type === "mdc_inline_span" && childToken.nesting === -1) {
        break;
      }
      if (childToken.type === "text" && !childToken.content?.trim()) {
        i++;
        continue;
      }
      const result = processInlineToken(tokens, i, inHeading, htmlDepth);
      i = result.nextIndex;
      if (result.node) {
        nodes.push(result.node);
      }
    }
    const { attrs: spanAttrs, nextIndex } = extractAttributes(tokens, i + 1);
    Object.assign(attrs, spanAttrs);
    if (nodes.length > 0 || Object.keys(attrs).length > 0) {
      return { node: ["span", attrs, ...nodes], nextIndex };
    }
    return { node: null, nextIndex };
  }
  if (token.type === "mdc_inline_span" && token.nesting === -1) {
    return { node: null, nextIndex: startIndex + 1 };
  }
  if (token.type === "code_inline") {
    const { attrs, nextIndex } = extractAttributes(tokens, startIndex + 1);
    if (token.content) {
      return { node: ["code", attrs, token.content], nextIndex };
    }
    return { node: null, nextIndex };
  }
  if (token.type === "hardbreak" || token.type === "hard_break") {
    return { node: ["br", {}], nextIndex: startIndex + 1 };
  }
  if (token.type === "softbreak") {
    return { node: "\n", nextIndex: startIndex + 1 };
  }
  if (token.type === "mdc_inline_component") {
    const componentName = token.tag || "component";
    if (token.nesting === 1) {
      const children = [];
      let i = startIndex + 1;
      while (i < tokens.length) {
        const childToken = tokens[i];
        if (childToken.type === "mdc_inline_component" && childToken.nesting === -1) {
          const { attrs, nextIndex } = extractAttributes(tokens, i + 1, false);
          return { node: [componentName, attrs, ...children], nextIndex };
        }
        const result = processInlineToken(tokens, i, inHeading, htmlDepth);
        i = result.nextIndex;
        if (result.node) {
          children.push(result.node);
        }
      }
      return { node: [componentName, {}, ...children], nextIndex: i };
    } else if (token.nesting === -1) {
      return { node: null, nextIndex: startIndex + 1 };
    } else {
      const attrs = {};
      const { attrs: componentAttrs, nextIndex: propsNextIndex } = extractAttributes(tokens, startIndex + 1, false);
      Object.assign(attrs, componentAttrs);
      const fallbackAttrs = processAttributes(token.attrs, {});
      Object.assign(attrs, fallbackAttrs);
      const nextIndex = Object.keys(componentAttrs).length > 0 ? propsNextIndex : startIndex + 1;
      return { node: [componentName, attrs], nextIndex };
    }
  }
  if (token.type === "image") {
    const attrs = processAttributes(token.attrs, { handleJSON: false, filterEmpty: true });
    if (token.content) {
      attrs.alt = token.content;
    }
    const { attrs: imageAttrs, nextIndex } = extractAttributes(tokens, startIndex + 1);
    Object.assign(attrs, imageAttrs);
    return { node: ["img", attrs], nextIndex };
  }
  if (token.type === "link_open") {
    const attrs = processAttributes(token.attrs, { handleJSON: false });
    const children = processInlineChildren(tokens, startIndex + 1, "link_close", inHeading);
    const { attrs: linkAttrs, nextIndex } = extractAttributes(tokens, children.nextIndex + 1);
    Object.assign(attrs, linkAttrs);
    if (children.nodes.length > 0) {
      return { node: ["a", attrs, ...children.nodes], nextIndex };
    }
    return { node: null, nextIndex };
  }
  if (token.type === "math_inline") {
    return {
      node: ["math", { class: "math inline", content: token.content }, token.content],
      nextIndex: startIndex + 1
    };
  }
  const tagName = INLINE_TAG_MAP[token.type];
  if (tagName) {
    const closeType = token.type.replace("_open", "_close");
    const children = processInlineChildren(tokens, startIndex + 1, closeType, inHeading);
    const { attrs, nextIndex } = extractAttributes(tokens, children.nextIndex + 1);
    if (children.nodes.length > 0) {
      return { node: [tagName, attrs, ...children.nodes], nextIndex };
    }
    return { node: null, nextIndex };
  }
  if (token.children) {
    const nestedNodes = processInlineTokens(token.children, inHeading);
    return { node: nestedNodes.length === 1 ? nestedNodes[0] : null, nextIndex: startIndex + 1 };
  }
  return { node: null, nextIndex: startIndex + 1 };
}
function processInlineChildren(tokens, startIndex, closeType, inHeading = false) {
  const nodes = [];
  let i = startIndex;
  while (i < tokens.length) {
    const token = tokens[i];
    if (token.type === closeType) {
      if (closeType === "mdc_inline_span" && token.nesting === -1) {
        break;
      } else if (closeType !== "mdc_inline_span") {
        break;
      }
    }
    if (token.type === "mdc_inline_props" && token.hidden) {
      i++;
      continue;
    }
    if (token.type === "mdc_inline_component" && inHeading) {
      const componentName = token.tag || "component";
      const attrs = {};
      const { attrs: componentAttrs, nextIndex: componentNextIndex } = extractAttributes(tokens, i + 1, false);
      Object.assign(attrs, componentAttrs);
      if (Object.keys(componentAttrs).length > 0) {
        i = componentNextIndex;
      } else {
        i++;
      }
      nodes.push([componentName, attrs]);
      continue;
    }
    const result = processInlineToken(tokens, i, inHeading);
    i = result.nextIndex;
    if (result.node) {
      nodes.push(result.node);
    }
  }
  return { nodes: mergeAdjacentTextNodes(nodes), nextIndex: i };
}
function extractReusableNodes(markdown2, lastOutput) {
  let lastValidNodeIndex = -1;
  let i = lastOutput.nodes.length - 1;
  let lastNodeIgnored = false;
  while (i >= 0) {
    const node = lastOutput.nodes[i];
    if (node[1] && node[1].$?.line) {
      if (lastNodeIgnored) {
        lastValidNodeIndex = i;
        break;
      } else {
        lastNodeIgnored = true;
      }
    }
    i--;
  }
  const lastNode = lastValidNodeIndex !== -1 ? lastOutput.nodes[lastValidNodeIndex] : null;
  if (lastNode) {
    const remainingMarkdownStartLine = lastNode[1].$?.line ?? 0;
    return {
      remainingMarkdownStartLine,
      reusedNodes: lastOutput.nodes.slice(0, lastValidNodeIndex + 1),
      remainingMarkdown: markdown2.split("\n").slice(remainingMarkdownStartLine).join("\n") || ""
    };
  }
  return {
    remainingMarkdownStartLine: 0,
    remainingMarkdown: markdown2,
    reusedNodes: []
  };
}
const noopSpan = { end: () => {
} };
const noopTracer = {
  startSpan: () => noopSpan,
  startActiveSpan: (_name, optionsOrFn, fn) => {
    const run = typeof optionsOrFn === "function" ? optionsOrFn : fn;
    return run(noopSpan);
  }
};
function withSpan(tracer, name, fn, options) {
  return tracer.startActiveSpan(name, {}, (span) => {
    try {
      const result = fn();
      if (result instanceof Promise) {
        return result.finally(() => span.end());
      }
      span.end();
      return result;
    } catch (error2) {
      span.end();
      throw error2;
    }
  });
}
function createMarkdownParser(options = {}) {
  const { autoUnwrap = true, autoClose = true, tracer = noopTracer } = options;
  const unwrapTags = resolveUnwrapTags(options.unwrap);
  const userPlugins = options.plugins ?? [];
  if (options.html !== void 0) {
    console.warn("[comark] `ParserOptions.html` is deprecated and will be removed in a future major version. Use `registerDefaultPlugins: false` and register `html()` from `comark/plugins/html` only when needed.");
  }
  const defaultPlugins = options.registerDefaultPlugins !== false ? [
    frontmatterPlugin(),
    ...options.html !== false ? [html()] : [],
    alert(),
    taskList(),
    components(),
    attributes()
  ] : [];
  const plugins = dedupePlugins(defaultPlugins, userPlugins);
  const hasPlugin = (name) => plugins.some((plugin) => plugin.name === name);
  const parser = new src_default({ linkify: options.linkify ?? true }).enable(["table", "strikethrough"]);
  for (const plugin of plugins) {
    for (const markdownItPlugin of plugin.markdownItPlugins || []) {
      parser.use(markdownItPlugin);
    }
  }
  let lastOutput = null;
  let lastInput = null;
  const parseFn = async (markdown2, opts = {}) => {
    return await withSpan(tracer, "comark:parse", async () => {
      const state = {
        options,
        tokens: [],
        markdown: markdown2,
        tree: null,
        parsedLines: 0,
        reusableNodes: [],
        frontmatterText: "",
        frontmatter: {}
      };
      const prevOutput = lastOutput;
      const isStartsWithLastInput = markdown2.startsWith(lastInput ?? "");
      if (opts.streaming && prevOutput && isStartsWithLastInput) {
        const { remainingMarkdownStartLine, reusedNodes, remainingMarkdown } = extractReusableNodes(markdown2, prevOutput);
        if (!remainingMarkdown)
          return prevOutput;
        state.parsedLines = remainingMarkdownStartLine;
        state.markdown = remainingMarkdown;
        state.reusableNodes = reusedNodes;
      }
      if (typeof autoClose === "function") {
        state.markdown = withSpan(tracer, "comark:autoclose", () => autoClose(state.markdown));
      } else if (autoClose) {
        state.markdown = withSpan(tracer, "comark:autoclose", () => autoCloseMarkdown(state.markdown, {
          frontmatter: hasPlugin("frontmatter") && opts.streaming,
          syntax: hasPlugin("components"),
          attributes: hasPlugin("components") || hasPlugin("attributes"),
          math: hasPlugin("math"),
          dropTrailingOpeners: opts.streaming === true
        }));
      }
      for (const plugin of plugins) {
        if (!plugin.pre)
          continue;
        await withSpan(tracer, `comark:pre:${plugin.name}`, () => plugin.pre(state));
      }
      try {
        state.tokens = withSpan(tracer, "comark:tokenize", () => parser.parse(state.markdown, {}));
      } catch (e) {
        if (opts.streaming && prevOutput) {
          return prevOutput;
        }
        throw e;
      }
      const nodesSpan = tracer.startSpan("comark:nodes");
      let nodes = marmdownItTokensToMarkdownDocument(state.tokens, {
        startLine: state.parsedLines,
        preservePositions: opts.streaming ?? false,
        headingIds: options.headingIds ?? true
      });
      if (autoUnwrap) {
        nodes = nodes.map((node) => applyAutoUnwrap(node));
      }
      if (unwrapTags.length > 0) {
        nodes = applyUnwrap(nodes, unwrapTags);
      }
      nodesSpan.end();
      const frontmatterData = state.frontmatter ?? {};
      const frontmatterText = state.frontmatterText ?? "";
      if (opts.streaming) {
        state.tree = {
          frontmatter: frontmatterText ? frontmatterData : prevOutput?.frontmatter ?? frontmatterData,
          meta: {},
          nodes: [...state.reusableNodes, ...nodes]
        };
        lastOutput = state.tree;
        lastInput = markdown2;
      } else {
        state.tree = {
          frontmatter: frontmatterData,
          meta: {},
          nodes
        };
        lastOutput = null;
        lastInput = null;
      }
      for (const plugin of plugins) {
        if (!plugin.post)
          continue;
        await withSpan(tracer, `comark:post:${plugin.name}`, () => plugin.post(state));
      }
      return state.tree;
    });
  };
  return parseFn;
}
function markdown(field2, options = {}) {
  const parse = createMarkdownParser(options);
  return definePlugin({
    name: `markdown:${field2}`,
    async read(record2, ctx) {
      const fields = schemaFields(ctx.collection.schema);
      if (fields && !fields.has(field2)) throw new AirspaceError(`${ctx.collection.nsid} has no field "${field2}" to parse as markdown`);
      const source = record2.value[field2];
      return { markdown: typeof source === "string" ? await parse(source) : null };
    }
  });
}
const descriptions = /* @__PURE__ */ new WeakMap();
function describe(schema, description) {
  if (description) descriptions.set(schema, description);
  return schema;
}
const fresh = (schema) => new schema.constructor();
const emitted = /* @__PURE__ */ new WeakMap();
function emitAs(schema, json) {
  emitted.set(schema, {
    ...emitted.get(schema),
    ...json
  });
  return schema;
}
function isPermissionSetSpec(value) {
  return !!value && typeof value === "object" && value.type === "permission-set" && "options" in value;
}
function buildPermissionSet(nsid, { options }, resolve = (name) => name) {
  const authority = nsid.slice(0, nsid.lastIndexOf(".") + 1);
  const under = (target) => {
    if (!target.startsWith(authority)) throw new AirspaceError(`${nsid}: "${target}" is not under "${authority}", so an \`include:\` of this set would drop it`);
    return target;
  };
  const permissions = [];
  if (options.collections?.length) permissions.push({
    type: "permission",
    resource: "repo",
    collection: options.collections.map((name) => under(resolve(name))),
    ...options.actions ? { action: [...options.actions] } : {}
  });
  if (options.rpc?.length) permissions.push({
    type: "permission",
    resource: "rpc",
    ...options.inheritAud ? { inheritAud: true } : {},
    lxm: options.rpc.map(under)
  });
  if (options.blobs?.length) permissions.push({
    type: "permission",
    resource: "blob",
    accept: [...options.blobs]
  });
  permissions.push(...options.extra ?? []);
  return {
    type: "permission-set",
    nsid,
    permissions,
    ...options.title ? { title: options.title } : {},
    ...options.titleLang ? { "title:lang": options.titleLang } : {},
    ...options.detail ? { detail: options.detail } : {},
    ...options.detailLang ? { "detail:lang": options.detailLang } : {},
    ...options.description ? { description: options.description } : {}
  };
}
function make(schema, isOptional, refs) {
  return {
    kind: "field",
    schema,
    isOptional,
    refs,
    optional: () => make(schema, true, refs),
    describe: (description) => make(describe(schema, description), isOptional, refs)
  };
}
const f = (schema, refs = []) => make(schema, false, refs);
const strongRef = /* @__PURE__ */ typedObject("com.atproto.repo.strongRef", "main", /* @__PURE__ */ object({
  uri: string({ format: "at-uri" }),
  cid: string({ format: "cid" })
}));
function formattedString(options) {
  const format2 = options.format;
  if (!format2 || STRING_FORMATS.includes(format2)) return string(options);
  const { format: _, ...rest } = options;
  return emitAs(string(rest), { format: format2 });
}
const TEXT_MAX = 1e3;
const MARKDOWN_MAX = 1e5;
const LIST_MAX = 100;
const BLOB_MAX = 5e6;
function text({ min, max = TEXT_MAX, format: format2 } = {}) {
  return formattedString({
    ...min === void 0 ? {} : { minGraphemes: min },
    ...format2 ? { format: format2 } : {},
    maxGraphemes: max,
    maxLength: max * 10
  });
}
function shapeOf(fields) {
  const shape = {};
  for (const [name, field2] of Object.entries(fields)) shape[name] = field2.isOptional ? optional(field2.schema) : field2.schema;
  return shape;
}
const refsOf = (fields) => Object.values(fields).flatMap((field2) => [...field2.refs]);
const field = {
  text: (options) => f(text(options)),
  markdown: ({ min, max = MARKDOWN_MAX } = {}) => f(describe(text({
    min,
    max
  }), "Markdown.")),
  number: ({ min, max } = {}) => f(integer({
    ...min === void 0 ? {} : { minimum: min },
    ...max === void 0 ? {} : { maximum: max }
  })),
  boolean: () => f(fresh(boolean())),
  datetime: () => f(string({ format: "datetime" })),
  url: () => f(string({ format: "uri" })),
  enum: (values) => f(/* @__PURE__ */ enumSchema(values)),
  ref: (target) => f(ref(() => strongRef), [target]),
  union: (refs) => ({
    ...f(/* @__PURE__ */ typedUnion(refs.map((get) => typedRef(get)), true)),
    open: () => f(openUnion(refs))
  }),
  list: (items, { min, max = LIST_MAX } = {}) => f(array(items.schema, {
    ...min === void 0 ? {} : { minLength: min },
    maxLength: max
  }), items.refs),
  object: (fields) => {
    const schema = /* @__PURE__ */ object(shapeOf(fields));
    return f(ref(() => schema), refsOf(fields));
  },
  blob: ({ accept, max = BLOB_MAX } = {}) => f(blob({
    ...accept ? { accept: [...accept] } : {},
    maxSize: max
  })),
  image: ({ accept = ["image/*"], max = BLOB_MAX } = {}) => f(blob({
    accept: [...accept],
    maxSize: max
  })),
  raw: (schema) => f(schema)
};
function openUnion(refs) {
  return /* @__PURE__ */ typedUnion(refs.map((get) => typedRef(get)), false);
}
const resolveKey = (key = "tid") => key === "self" ? "literal:self" : key;
function space(collections, options = {}) {
  const { key = "self", ...rest } = options;
  return {
    type: "space",
    key: resolveKey(key),
    collections,
    ...rest
  };
}
const isFriendlyKey = (value) => /^(?:tid|any|nsid|self)$|^literal:/.test(value);
function splitRecordSpec(nsid, spec) {
  const fields = {};
  let key;
  let description;
  for (const [name, value] of Object.entries(spec)) {
    if (value === void 0) continue;
    if (name === "key" && typeof value === "string") {
      if (!isFriendlyKey(value)) throw new AirspaceError(`${nsid}: "${value}" is not a record key; use 'tid', 'any', 'nsid', 'self' or 'literal:<value>'`);
      key = value;
      continue;
    }
    if (name === "description" && typeof value === "string") {
      description = value;
      continue;
    }
    fields[name] = value;
  }
  return {
    fields,
    key,
    description
  };
}
const isRecordFieldsSpec = (spec) => !!spec && typeof spec === "object" && spec.type === "record-fields";
const isSpaceSpec = (spec) => !!spec && typeof spec === "object" && spec.type === "space";
function buildModel(namespace, model) {
  const nsidOf = (name) => name.includes(".") ? name : `${namespace}.${name}`;
  const known = new Set(Object.keys(model));
  const out = {};
  for (const [name, spec] of Object.entries(model)) {
    const nsid = `${namespace}.${name}`;
    if (isPermissionSetSpec(spec)) {
      for (const collection of spec.options.collections ?? []) if (!collection.includes(".") && !known.has(collection)) throw new AirspaceError(`${nsid}: no "${collection}" in this model`);
      out[name] = buildPermissionSet(nsid, spec, nsidOf);
      continue;
    }
    if (isSpaceSpec(spec)) {
      for (const collection of spec.collections) if (!collection.includes(".") && !known.has(collection)) throw new AirspaceError(`${nsid}: no "${collection}" in this model`);
      out[name] = {
        nsid,
        key: spec.key,
        collections: spec.collections.map(nsidOf),
        ...spec.name ? { name: spec.name } : {},
        ...spec.description ? { description: spec.description } : {}
      };
      continue;
    }
    const { fields, key, description } = isRecordFieldsSpec(spec) ? spec : splitRecordSpec(nsid, spec);
    for (const target of refsOf(fields)) if (!target.includes(".") && !known.has(target)) throw new AirspaceError(`${nsid}: ref to "${target}", which is not in this model; pass a full NSID for a record elsewhere`);
    out[name] = describe(/* @__PURE__ */ record(resolveKey(key), nsid, /* @__PURE__ */ object(shapeOf(fields))), description);
  }
  return out;
}
function defineLexicons(a, b) {
  return buildModel(a, b);
}
const lexicons = defineLexicons("space.getair.notes", {
  tag: {
    name: field.text({ max: 32 })
  },
  note: {
    description: "A note. The body is markdown.",
    title: field.text({ max: 120 }),
    body: field.markdown(),
    tag: field.ref("tag").optional(),
    cover: field.image({ max: 1e6 }).optional(),
    createdAt: field.datetime().optional(),
    updatedAt: field.datetime().optional()
  },
  profile: {
    key: "self",
    displayName: field.text({ max: 64 }),
    bio: field.text().optional()
  },
  workspace: space(["note", "tag"])
});
const { note: notes, tag: tags, profile } = defineCollections(lexicons, (c) => ({
  note: {
    sort: [["createdAt", "desc"]],
    relations: { tag: belongsTo(c.tag, "tag") },
    plugins: [markdown("body")]
  }
}));
const workspace = defineSpace(lexicons.workspace, {
  collections: { notes, tags }
});
async function createNotesAirspace() {
  const service = process.env.AIRSPACE_SERVICE ?? "http://localhost:2583";
  const identifier = process.env.AIRSPACE_IDENTIFIER ?? "alice.test";
  const password = process.env.AIRSPACE_PASSWORD ?? "hunter2";
  const session = await passwordSession({
    service,
    identifier,
    password
  });
  const airspace = createAirspace({
    identity: { did: session.did, service },
    collections: { profile },
    spaces: { workspace },
    plugins: [timestamps()],
    session,
    cache: { ttl: 5e3 }
  });
  await airspace.workspace.manage.ensure();
  return airspace;
}
let pending;
function useAirspace() {
  pending ??= createNotesAirspace();
  return pending;
}
const getNotes_createServerFn_handler = createServerRpc({
  id: "bc3ee0222366ccd2612be7e43cf2343ef3d9c3cff7f73da471e095bcde8691d8",
  name: "getNotes",
  filename: "src/server/air.ts"
}, (opts) => getNotes.__executeServer(opts));
const getNotes = createServerFn({
  method: "GET",
  strict: false
}).handler(getNotes_createServerFn_handler, async () => {
  const airspace = await useAirspace();
  const me = await airspace.profile.get();
  const notes2 = await airspace.notes.list({
    with: ["tag"]
  });
  return {
    profile: me?.value ?? null,
    notes: notes2
  };
});
const getNote_createServerFn_handler = createServerRpc({
  id: "d7a5f4ccca35265f4495f103e283a4b85c9d5663e6a79c4e72c83cf6e2a373d2",
  name: "getNote",
  filename: "src/server/air.ts"
}, (opts) => getNote.__executeServer(opts));
const getNote = createServerFn({
  method: "GET",
  strict: false
}).validator((rkey) => rkey).handler(getNote_createServerFn_handler, async ({
  data: rkey
}) => {
  const airspace = await useAirspace();
  const note = await airspace.notes.get(rkey);
  if (!note) throw new Error("No such note");
  const [tag, cover] = await Promise.all([airspace.notes.resolve(note, "tag"), airspace.blobs.url(note.value.cover)]);
  return {
    note,
    tag: tag?.value.name ?? null,
    cover
  };
});
const getProfile_createServerFn_handler = createServerRpc({
  id: "1d3f14775aa741e13186ee52d5a6c9c1dc3aedb6f63ce977535ab3bfb61c6ff0",
  name: "getProfile",
  filename: "src/server/air.ts"
}, (opts) => getProfile.__executeServer(opts));
const getProfile = createServerFn({
  method: "GET",
  strict: false
}).handler(getProfile_createServerFn_handler, async () => {
  const airspace = await useAirspace();
  return (await airspace.profile.get())?.value ?? null;
});
const saveProfile_createServerFn_handler = createServerRpc({
  id: "0c83aa605d6b352175b0ae70be57537216a4801b9500473442a40ff1eed034dd",
  name: "saveProfile",
  filename: "src/server/air.ts"
}, (opts) => saveProfile.__executeServer(opts));
const saveProfile = createServerFn({
  method: "POST",
  strict: false
}).validator((body) => body).handler(saveProfile_createServerFn_handler, async ({
  data
}) => {
  const airspace = await useAirspace();
  return await airspace.profile.put({
    displayName: data.displayName,
    bio: data.bio || void 0
  });
});
const getDrafts_createServerFn_handler = createServerRpc({
  id: "d61140479c52004fdb824bfd6689653d23e1da0f082bc4b445b04da6fec91a87",
  name: "getDrafts",
  filename: "src/server/air.ts"
}, (opts) => getDrafts.__executeServer(opts));
const getDrafts = createServerFn({
  method: "GET",
  strict: false
}).handler(getDrafts_createServerFn_handler, async () => {
  const airspace = await useAirspace();
  const [drafts, live, tags2] = await Promise.all([airspace.workspace.notes.list(), airspace.workspace.notes.published(), airspace.workspace.tags.list()]);
  return {
    drafts: drafts.map((draft) => ({
      ...draft,
      published: live.includes(draft.rkey)
    })),
    tags: tags2.map((tag) => ({
      rkey: tag.rkey,
      name: tag.value.name
    }))
  };
});
const createDraft_createServerFn_handler = createServerRpc({
  id: "d5e90189475ef3ba055a89641edbe9d71875ef2e70062c913df9e69bdbbd4ee1",
  name: "createDraft",
  filename: "src/server/air.ts"
}, (opts) => createDraft.__executeServer(opts));
const createDraft = createServerFn({
  method: "POST",
  strict: false
}).validator((data) => data).handler(createDraft_createServerFn_handler, async ({
  data
}) => {
  const str = (name) => {
    const value = data.get(name);
    return typeof value === "string" ? value.trim() : void 0;
  };
  const airspace = await useAirspace();
  const newTag = str("newTag");
  const existingTag = str("tag");
  const tag = newTag ? await airspace.workspace.tags.create({
    name: newTag
  }) : existingTag ? await airspace.workspace.tags.get(existingTag) ?? null : null;
  const file = data.get("cover");
  const cover = file?.size ? (await airspace.blobs.upload(new Uint8Array(await file.arrayBuffer()), {
    mimeType: file.type || "application/octet-stream"
  })).blob : void 0;
  return await airspace.workspace.notes.create({
    title: str("title") ?? "",
    body: str("body") ?? "",
    tag: tag ? {
      uri: tag.uri,
      cid: tag.cid
    } : void 0,
    cover
  });
});
const publishDraft_createServerFn_handler = createServerRpc({
  id: "213b38372a5308f9764de551c8c31353a00a79beaf012370359ea6088334161f",
  name: "publishDraft",
  filename: "src/server/air.ts"
}, (opts) => publishDraft.__executeServer(opts));
const publishDraft = createServerFn({
  method: "POST",
  strict: false
}).validator((rkey) => rkey).handler(publishDraft_createServerFn_handler, async ({
  data: rkey
}) => {
  const airspace = await useAirspace();
  const draft = await airspace.workspace.notes.get(rkey);
  if (!draft) throw new Error("No such draft");
  const tagRkey = draft.value.tag ? parseAtUri(draft.value.tag.uri).rkey : void 0;
  if (tagRkey && !(await airspace.workspace.tags.published()).includes(tagRkey)) await airspace.workspace.tags.publish(tagRkey);
  return await airspace.workspace.notes.publish(rkey);
});
const air = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  createDraft_createServerFn_handler,
  getDrafts_createServerFn_handler,
  getNote_createServerFn_handler,
  getNotes_createServerFn_handler,
  getProfile_createServerFn_handler,
  publishDraft_createServerFn_handler,
  saveProfile_createServerFn_handler
}, Symbol.toStringTag, { value: "Module" }));
export {
  typedRef as A,
  ref as B,
  air as C,
  LexError as L,
  SpacesUnsupportedError as S,
  ValidationError as V,
  XrpcResponseError as X,
  params as a,
  boolean as b,
  payload as c,
  lexErrorDataSchema as d,
  buildAgent as e,
  xrpc as f,
  scoped as g,
  paginate as h,
  isNotFound as i,
  jsonPayload as j,
  cidFromBlob as k,
  lexMap as l,
  spaceUri as m,
  LexValidationError as n,
  optional as o,
  procedure as p,
  query as q,
  readOnly as r,
  string as s,
  typedObject as t,
  integer as u,
  object as v,
  withDefault as w,
  xrpcSafe as x,
  array as y,
  typedUnion as z
};
