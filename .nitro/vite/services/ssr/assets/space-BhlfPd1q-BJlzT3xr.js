import { g as scoped, h as paginate, i as isNotFound, k as cidFromBlob, m as spaceUri, X as XrpcResponseError, S as SpacesUnsupportedError, r as readOnly, n as LexValidationError, V as ValidationError, t as typedObject, q as query, a as params, o as optional, s as string, w as withDefault, u as integer, j as jsonPayload, v as object, y as array, p as procedure, c as payload, b as boolean, l as lexMap, z as typedUnion, A as typedRef, B as ref } from "./air-DeKDbXdL.js";
import "../server.js";
import "node:async_hooks";
import "node:stream";
import "node:stream/web";
import "util";
import "crypto";
import "async_hooks";
import "stream";
import "./index-DhNZQhvL.js";
var __defProp = Object.defineProperty;
var __exportAll = (all, no_symbols) => {
  let target = {};
  for (var name in all) __defProp(target, name, {
    get: all[name],
    enumerable: true
  });
  __defProp(target, Symbol.toStringTag, { value: "Module" });
  return target;
};
const $nsid$14 = "com.atproto.simplespace.defs";
const publicPolicy = /* @__PURE__ */ typedObject($nsid$14, "publicPolicy", /* @__PURE__ */ object({}));
const memberListPolicy = /* @__PURE__ */ typedObject($nsid$14, "memberListPolicy", /* @__PURE__ */ object({}));
const managingAppPolicy = /* @__PURE__ */ typedObject($nsid$14, "managingAppPolicy", /* @__PURE__ */ object({ "managingApp": /* @__PURE__ */ string() }));
const open = /* @__PURE__ */ typedObject($nsid$14, "open", /* @__PURE__ */ object({}));
const allowList = /* @__PURE__ */ typedObject($nsid$14, "allowList", /* @__PURE__ */ object({ "allowed": /* @__PURE__ */ array(/* @__PURE__ */ string()) }));
const $nsid$13 = "com.atproto.simplespace.createSpace";
const $params$13 = /* @__PURE__ */ params();
const $input$8 = /* @__PURE__ */ jsonPayload({
  "type": /* @__PURE__ */ string({ "format": "nsid" }),
  "skey": /* @__PURE__ */ optional(/* @__PURE__ */ string({ "format": "record-key" })),
  "readPolicy": /* @__PURE__ */ typedUnion([
    /* @__PURE__ */ typedRef((() => publicPolicy)),
    /* @__PURE__ */ typedRef((() => memberListPolicy)),
    /* @__PURE__ */ typedRef((() => managingAppPolicy))
  ], false),
  "writePolicy": /* @__PURE__ */ typedUnion([
    /* @__PURE__ */ typedRef((() => publicPolicy)),
    /* @__PURE__ */ typedRef((() => memberListPolicy)),
    /* @__PURE__ */ typedRef((() => managingAppPolicy))
  ], false),
  "appAccess": /* @__PURE__ */ typedUnion([/* @__PURE__ */ typedRef((() => open)), /* @__PURE__ */ typedRef((() => allowList))], false)
});
const $output$13 = /* @__PURE__ */ jsonPayload({ "uri": /* @__PURE__ */ string({ "format": "uri" }) });
const main$13 = /* @__PURE__ */ procedure($nsid$13, $params$13, $input$8, $output$13, [
  "SpaceAlreadyExists",
  "UnsupportedPolicy",
  "UnsupportedAppAccess"
]);
const $lxm$13 = $nsid$13;
var createSpace_exports = /* @__PURE__ */ __exportAll({
  $input: () => $input$8,
  $lxm: () => $lxm$13,
  $nsid: () => $nsid$13,
  $output: () => $output$13,
  $params: () => $params$13,
  default: () => main$13,
  main: () => main$13
});
const $nsid$12 = "com.atproto.simplespace.deleteSpace";
const $params$12 = /* @__PURE__ */ params();
const $input$7 = /* @__PURE__ */ jsonPayload({ "space": /* @__PURE__ */ string({ "format": "uri" }) });
const $output$12 = /* @__PURE__ */ payload();
const main$12 = /* @__PURE__ */ procedure($nsid$12, $params$12, $input$7, $output$12, ["SpaceNotFound", "NotSpaceOwner"]);
const $lxm$12 = $nsid$12;
var deleteSpace_exports = /* @__PURE__ */ __exportAll({
  $input: () => $input$7,
  $lxm: () => $lxm$12,
  $nsid: () => $nsid$12,
  $output: () => $output$12,
  $params: () => $params$12,
  default: () => main$12,
  main: () => main$12
});
const $nsid$11 = "com.atproto.simplespace.getSpace";
const $params$11 = /* @__PURE__ */ params({ "space": /* @__PURE__ */ string({ "format": "uri" }) });
const $output$11 = /* @__PURE__ */ jsonPayload({
  "uri": /* @__PURE__ */ string({ "format": "uri" }),
  "readPolicy": /* @__PURE__ */ typedUnion([
    /* @__PURE__ */ typedRef((() => publicPolicy)),
    /* @__PURE__ */ typedRef((() => memberListPolicy)),
    /* @__PURE__ */ typedRef((() => managingAppPolicy))
  ], false),
  "writePolicy": /* @__PURE__ */ typedUnion([
    /* @__PURE__ */ typedRef((() => publicPolicy)),
    /* @__PURE__ */ typedRef((() => memberListPolicy)),
    /* @__PURE__ */ typedRef((() => managingAppPolicy))
  ], false),
  "appAccess": /* @__PURE__ */ typedUnion([/* @__PURE__ */ typedRef((() => open)), /* @__PURE__ */ typedRef((() => allowList))], false)
});
const main$11 = /* @__PURE__ */ query($nsid$11, $params$11, $output$11, ["SpaceNotFound"]);
const $lxm$11 = $nsid$11;
var getSpace_exports = /* @__PURE__ */ __exportAll({
  $lxm: () => $lxm$11,
  $nsid: () => $nsid$11,
  $output: () => $output$11,
  $params: () => $params$11,
  default: () => main$11,
  main: () => main$11
});
const $nsid$10 = "com.atproto.simplespace.listMembers";
const $params$10 = /* @__PURE__ */ params({
  "space": /* @__PURE__ */ string({ "format": "uri" }),
  "limit": /* @__PURE__ */ optional(/* @__PURE__ */ withDefault(/* @__PURE__ */ integer({
    "minimum": 1,
    "maximum": 1e3
  }), 100)),
  "cursor": /* @__PURE__ */ optional(/* @__PURE__ */ string())
});
const $output$10 = /* @__PURE__ */ jsonPayload({
  "cursor": /* @__PURE__ */ optional(/* @__PURE__ */ string()),
  "members": /* @__PURE__ */ array(/* @__PURE__ */ ref((() => member)))
});
const main$10 = /* @__PURE__ */ query($nsid$10, $params$10, $output$10, ["SpaceNotFound"]);
const $lxm$10 = $nsid$10;
const member = /* @__PURE__ */ typedObject($nsid$10, "member", /* @__PURE__ */ object({
  "did": /* @__PURE__ */ string({ "format": "did" }),
  "read": /* @__PURE__ */ boolean(),
  "write": /* @__PURE__ */ boolean()
}));
var listMembers_exports = /* @__PURE__ */ __exportAll({
  $lxm: () => $lxm$10,
  $nsid: () => $nsid$10,
  $output: () => $output$10,
  $params: () => $params$10,
  default: () => main$10,
  main: () => main$10,
  member: () => member
});
const $nsid$9 = "com.atproto.simplespace.putMember";
const $params$9 = /* @__PURE__ */ params();
const $input$6 = /* @__PURE__ */ jsonPayload({
  "space": /* @__PURE__ */ string({ "format": "uri" }),
  "did": /* @__PURE__ */ string({ "format": "did" }),
  "read": /* @__PURE__ */ boolean(),
  "write": /* @__PURE__ */ boolean()
});
const $output$9 = /* @__PURE__ */ payload();
const main$9 = /* @__PURE__ */ procedure($nsid$9, $params$9, $input$6, $output$9, ["SpaceNotFound", "NotSpaceOwner"]);
const $lxm$9 = $nsid$9;
var putMember_exports = /* @__PURE__ */ __exportAll({
  $input: () => $input$6,
  $lxm: () => $lxm$9,
  $nsid: () => $nsid$9,
  $output: () => $output$9,
  $params: () => $params$9,
  default: () => main$9,
  main: () => main$9
});
const $nsid$8 = "com.atproto.simplespace.removeMember";
const $params$8 = /* @__PURE__ */ params();
const $input$5 = /* @__PURE__ */ jsonPayload({
  "space": /* @__PURE__ */ string({ "format": "uri" }),
  "did": /* @__PURE__ */ string({ "format": "did" })
});
const $output$8 = /* @__PURE__ */ payload();
const main$8 = /* @__PURE__ */ procedure($nsid$8, $params$8, $input$5, $output$8, ["SpaceNotFound", "NotSpaceOwner"]);
const $lxm$8 = $nsid$8;
var removeMember_exports = /* @__PURE__ */ __exportAll({
  $input: () => $input$5,
  $lxm: () => $lxm$8,
  $nsid: () => $nsid$8,
  $output: () => $output$8,
  $params: () => $params$8,
  default: () => main$8,
  main: () => main$8
});
const $nsid$7 = "com.atproto.simplespace.updateSpace";
const $params$7 = /* @__PURE__ */ params();
const $input$4 = /* @__PURE__ */ jsonPayload({
  "space": /* @__PURE__ */ string({ "format": "uri" }),
  "readPolicy": /* @__PURE__ */ optional(/* @__PURE__ */ typedUnion([
    /* @__PURE__ */ typedRef((() => publicPolicy)),
    /* @__PURE__ */ typedRef((() => memberListPolicy)),
    /* @__PURE__ */ typedRef((() => managingAppPolicy))
  ], false)),
  "writePolicy": /* @__PURE__ */ optional(/* @__PURE__ */ typedUnion([
    /* @__PURE__ */ typedRef((() => publicPolicy)),
    /* @__PURE__ */ typedRef((() => memberListPolicy)),
    /* @__PURE__ */ typedRef((() => managingAppPolicy))
  ], false)),
  "appAccess": /* @__PURE__ */ optional(/* @__PURE__ */ typedUnion([/* @__PURE__ */ typedRef((() => open)), /* @__PURE__ */ typedRef((() => allowList))], false))
});
const $output$7 = /* @__PURE__ */ payload();
const main$7 = /* @__PURE__ */ procedure($nsid$7, $params$7, $input$4, $output$7, [
  "SpaceNotFound",
  "NotSpaceOwner",
  "UnsupportedPolicy",
  "UnsupportedAppAccess"
]);
const $lxm$7 = $nsid$7;
var updateSpace_exports = /* @__PURE__ */ __exportAll({
  $input: () => $input$4,
  $lxm: () => $lxm$7,
  $nsid: () => $nsid$7,
  $output: () => $output$7,
  $params: () => $params$7,
  default: () => main$7,
  main: () => main$7
});
const $nsid$6 = "com.atproto.space.applyWrites";
const $params$6 = /* @__PURE__ */ params();
const $input$3 = /* @__PURE__ */ jsonPayload({
  "space": /* @__PURE__ */ string({ "format": "uri" }),
  "repo": /* @__PURE__ */ string({ "format": "did" }),
  "validate": /* @__PURE__ */ optional(/* @__PURE__ */ boolean()),
  "writes": /* @__PURE__ */ array(/* @__PURE__ */ typedUnion([
    /* @__PURE__ */ typedRef((() => create)),
    /* @__PURE__ */ typedRef((() => update)),
    /* @__PURE__ */ typedRef((() => delete$0))
  ], true))
});
const $output$6 = /* @__PURE__ */ jsonPayload({ "results": /* @__PURE__ */ optional(/* @__PURE__ */ array(/* @__PURE__ */ typedUnion([
  /* @__PURE__ */ typedRef((() => createResult)),
  /* @__PURE__ */ typedRef((() => updateResult)),
  /* @__PURE__ */ typedRef((() => deleteResult))
], true))) });
const main$6 = /* @__PURE__ */ procedure($nsid$6, $params$6, $input$3, $output$6, [
  "SpaceNotFound",
  "RecordNotFound",
  "RecordAlreadyExists"
]);
const $lxm$6 = $nsid$6;
const create = /* @__PURE__ */ typedObject($nsid$6, "create", /* @__PURE__ */ object({
  "collection": /* @__PURE__ */ string({ "format": "nsid" }),
  "rkey": /* @__PURE__ */ optional(/* @__PURE__ */ string({
    "format": "record-key",
    "maxLength": 512
  })),
  "value": /* @__PURE__ */ lexMap()
}));
const update = /* @__PURE__ */ typedObject($nsid$6, "update", /* @__PURE__ */ object({
  "collection": /* @__PURE__ */ string({ "format": "nsid" }),
  "rkey": /* @__PURE__ */ string({ "format": "record-key" }),
  "value": /* @__PURE__ */ lexMap()
}));
const delete$0 = /* @__PURE__ */ typedObject($nsid$6, "delete", /* @__PURE__ */ object({
  "collection": /* @__PURE__ */ string({ "format": "nsid" }),
  "rkey": /* @__PURE__ */ string({ "format": "record-key" })
}));
const createResult = /* @__PURE__ */ typedObject($nsid$6, "createResult", /* @__PURE__ */ object({
  "uri": /* @__PURE__ */ string({ "format": "uri" }),
  "cid": /* @__PURE__ */ string({ "format": "cid" }),
  "validationStatus": /* @__PURE__ */ optional(/* @__PURE__ */ string())
}));
const updateResult = /* @__PURE__ */ typedObject($nsid$6, "updateResult", /* @__PURE__ */ object({
  "uri": /* @__PURE__ */ string({ "format": "uri" }),
  "cid": /* @__PURE__ */ string({ "format": "cid" }),
  "validationStatus": /* @__PURE__ */ optional(/* @__PURE__ */ string())
}));
const deleteResult = /* @__PURE__ */ typedObject($nsid$6, "deleteResult", /* @__PURE__ */ object({}));
var applyWrites_exports = /* @__PURE__ */ __exportAll({
  $input: () => $input$3,
  $lxm: () => $lxm$6,
  $nsid: () => $nsid$6,
  $output: () => $output$6,
  $params: () => $params$6,
  create: () => create,
  createResult: () => createResult,
  default: () => main$6,
  delete: () => delete$0,
  deleteResult: () => deleteResult,
  main: () => main$6,
  update: () => update,
  updateResult: () => updateResult
});
const $nsid$5 = "com.atproto.space.createRecord";
const $params$5 = /* @__PURE__ */ params();
const $input$2 = /* @__PURE__ */ jsonPayload({
  "space": /* @__PURE__ */ string({ "format": "uri" }),
  "repo": /* @__PURE__ */ string({ "format": "did" }),
  "collection": /* @__PURE__ */ string({ "format": "nsid" }),
  "rkey": /* @__PURE__ */ optional(/* @__PURE__ */ string({
    "format": "record-key",
    "maxLength": 512
  })),
  "validate": /* @__PURE__ */ optional(/* @__PURE__ */ boolean()),
  "record": /* @__PURE__ */ lexMap()
});
const $output$5 = /* @__PURE__ */ jsonPayload({
  "uri": /* @__PURE__ */ string({ "format": "uri" }),
  "cid": /* @__PURE__ */ string({ "format": "cid" }),
  "validationStatus": /* @__PURE__ */ optional(/* @__PURE__ */ string())
});
const main$5 = /* @__PURE__ */ procedure($nsid$5, $params$5, $input$2, $output$5, ["SpaceNotFound", "RecordAlreadyExists"]);
const $lxm$5 = $nsid$5;
var createRecord_exports = /* @__PURE__ */ __exportAll({
  $input: () => $input$2,
  $lxm: () => $lxm$5,
  $nsid: () => $nsid$5,
  $output: () => $output$5,
  $params: () => $params$5,
  default: () => main$5,
  main: () => main$5
});
const $nsid$4 = "com.atproto.space.deleteRecord";
const $params$4 = /* @__PURE__ */ params();
const $input$1 = /* @__PURE__ */ jsonPayload({
  "space": /* @__PURE__ */ string({ "format": "uri" }),
  "repo": /* @__PURE__ */ string({ "format": "did" }),
  "collection": /* @__PURE__ */ string({ "format": "nsid" }),
  "rkey": /* @__PURE__ */ string({ "format": "record-key" })
});
const $output$4 = /* @__PURE__ */ jsonPayload({});
const main$4 = /* @__PURE__ */ procedure($nsid$4, $params$4, $input$1, $output$4, ["SpaceNotFound"]);
const $lxm$4 = $nsid$4;
var deleteRecord_exports = /* @__PURE__ */ __exportAll({
  $input: () => $input$1,
  $lxm: () => $lxm$4,
  $nsid: () => $nsid$4,
  $output: () => $output$4,
  $params: () => $params$4,
  default: () => main$4,
  main: () => main$4
});
const $nsid$3 = "com.atproto.space.getRecord";
const $params$3 = /* @__PURE__ */ params({
  "space": /* @__PURE__ */ string({ "format": "uri" }),
  "repo": /* @__PURE__ */ string({ "format": "did" }),
  "collection": /* @__PURE__ */ string({ "format": "nsid" }),
  "rkey": /* @__PURE__ */ string({ "format": "record-key" })
});
const $output$3 = /* @__PURE__ */ jsonPayload({
  "uri": /* @__PURE__ */ string({ "format": "uri" }),
  "cid": /* @__PURE__ */ string({ "format": "cid" }),
  "value": /* @__PURE__ */ lexMap()
});
const main$3 = /* @__PURE__ */ query($nsid$3, $params$3, $output$3, [
  "RecordNotFound",
  "SpaceNotFound",
  "RepoNotFound",
  "RepoTakendown",
  "RepoSuspended",
  "RepoDeactivated"
]);
const $lxm$3 = $nsid$3;
var getRecord_exports = /* @__PURE__ */ __exportAll({
  $lxm: () => $lxm$3,
  $nsid: () => $nsid$3,
  $output: () => $output$3,
  $params: () => $params$3,
  default: () => main$3,
  main: () => main$3
});
const $nsid$2 = "com.atproto.space.listRecords";
const $params$2 = /* @__PURE__ */ params({
  "space": /* @__PURE__ */ string({ "format": "uri" }),
  "repo": /* @__PURE__ */ string({ "format": "did" }),
  "collection": /* @__PURE__ */ optional(/* @__PURE__ */ string({ "format": "nsid" })),
  "limit": /* @__PURE__ */ optional(/* @__PURE__ */ withDefault(/* @__PURE__ */ integer({
    "minimum": 1,
    "maximum": 1e3
  }), 50)),
  "cursor": /* @__PURE__ */ optional(/* @__PURE__ */ string()),
  "reverse": /* @__PURE__ */ optional(/* @__PURE__ */ boolean()),
  "excludeValues": /* @__PURE__ */ optional(/* @__PURE__ */ withDefault(/* @__PURE__ */ boolean(), false))
});
const $output$2 = /* @__PURE__ */ jsonPayload({
  "cursor": /* @__PURE__ */ optional(/* @__PURE__ */ string()),
  "records": /* @__PURE__ */ array(/* @__PURE__ */ ref((() => record$0)))
});
const main$2 = /* @__PURE__ */ query($nsid$2, $params$2, $output$2, [
  "SpaceNotFound",
  "RepoNotFound",
  "RepoTakendown",
  "RepoSuspended",
  "RepoDeactivated"
]);
const $lxm$2 = $nsid$2;
const record$0 = /* @__PURE__ */ typedObject($nsid$2, "record", /* @__PURE__ */ object({
  "collection": /* @__PURE__ */ string({ "format": "nsid" }),
  "rkey": /* @__PURE__ */ string({ "format": "record-key" }),
  "cid": /* @__PURE__ */ string({ "format": "cid" }),
  "value": /* @__PURE__ */ optional(/* @__PURE__ */ lexMap())
}));
var listRecords_exports = /* @__PURE__ */ __exportAll({
  $lxm: () => $lxm$2,
  $nsid: () => $nsid$2,
  $output: () => $output$2,
  $params: () => $params$2,
  default: () => main$2,
  main: () => main$2,
  record: () => record$0
});
const $nsid$1 = "com.atproto.space.listSpaces";
const $params$1 = /* @__PURE__ */ params({
  "type": /* @__PURE__ */ optional(/* @__PURE__ */ string({ "format": "nsid" })),
  "did": /* @__PURE__ */ optional(/* @__PURE__ */ string({ "format": "did" })),
  "limit": /* @__PURE__ */ optional(/* @__PURE__ */ withDefault(/* @__PURE__ */ integer({
    "minimum": 1,
    "maximum": 100
  }), 50)),
  "cursor": /* @__PURE__ */ optional(/* @__PURE__ */ string())
});
const $output$1 = /* @__PURE__ */ jsonPayload({
  "cursor": /* @__PURE__ */ optional(/* @__PURE__ */ string()),
  "spaces": /* @__PURE__ */ array(/* @__PURE__ */ ref((() => spaceView)))
});
const main$1 = /* @__PURE__ */ query($nsid$1, $params$1, $output$1);
const $lxm$1 = $nsid$1;
const spaceView = /* @__PURE__ */ typedObject($nsid$1, "spaceView", /* @__PURE__ */ object({ "uri": /* @__PURE__ */ string({ "format": "uri" }) }));
var listSpaces_exports = /* @__PURE__ */ __exportAll({
  $lxm: () => $lxm$1,
  $nsid: () => $nsid$1,
  $output: () => $output$1,
  $params: () => $params$1,
  default: () => main$1,
  main: () => main$1,
  spaceView: () => spaceView
});
const $nsid = "com.atproto.space.putRecord";
const $params = /* @__PURE__ */ params();
const $input = /* @__PURE__ */ jsonPayload({
  "space": /* @__PURE__ */ string({ "format": "uri" }),
  "repo": /* @__PURE__ */ string({ "format": "did" }),
  "collection": /* @__PURE__ */ string({ "format": "nsid" }),
  "rkey": /* @__PURE__ */ string({
    "format": "record-key",
    "maxLength": 512
  }),
  "validate": /* @__PURE__ */ optional(/* @__PURE__ */ boolean()),
  "record": /* @__PURE__ */ lexMap()
});
const $output = /* @__PURE__ */ jsonPayload({
  "uri": /* @__PURE__ */ string({ "format": "uri" }),
  "cid": /* @__PURE__ */ string({ "format": "cid" }),
  "validationStatus": /* @__PURE__ */ optional(/* @__PURE__ */ string())
});
const main = /* @__PURE__ */ procedure($nsid, $params, $input, $output, ["SpaceNotFound"]);
const $lxm = $nsid;
var putRecord_exports = /* @__PURE__ */ __exportAll({
  $input: () => $input,
  $lxm: () => $lxm,
  $nsid: () => $nsid,
  $output: () => $output,
  $params: () => $params,
  default: () => main,
  main: () => main
});
const SPACE_ANSWERS = /* @__PURE__ */ new Set(["SpaceNotFound", "InvalidRequest"]);
async function probeSpaces(client, space) {
  try {
    await client.call(getSpace_exports, { space });
    return true;
  } catch (err) {
    if (err instanceof XrpcResponseError) return SPACE_ANSWERS.has(err.error);
    throw err;
  }
}
function guardSpaces(client, service, supported) {
  return new Proxy(client, { get(target, property, receiver) {
    const value = Reflect.get(target, property, receiver);
    if (property !== "call" || typeof value !== "function") return value;
    return async (...args) => {
      try {
        return await value.apply(target, args);
      } catch (err) {
        const auth = err instanceof XrpcResponseError && (err.status === 401 || err.status === 403);
        if (err instanceof XrpcResponseError && !auth && !await supported()) throw new SpacesUnsupportedError(service, { cause: err });
        throw err;
      }
    };
  } });
}
function createSpaceBackend({ space, repo, service, client }) {
  const require2 = () => {
    if (!client) throw readOnly("use spaces");
    return client;
  };
  const parse = (schema, raw) => {
    try {
      return {
        uri: raw.uri,
        cid: raw.cid,
        value: schema.parse(raw.value)
      };
    } catch (err) {
      if (err instanceof LexValidationError) throw new ValidationError(`${schema.$type}/${raw.uri.slice(raw.uri.lastIndexOf("/") + 1)}`, err);
      throw err;
    }
  };
  const page = async (schema, { limit, cursor, reverse, unvalidated } = {}) => {
    const res = await scoped(() => require2().call(listRecords_exports, {
      space,
      repo,
      collection: schema.$type,
      limit: limit ?? 100,
      cursor,
      reverse
    }));
    return {
      records: res.records.filter((r) => r.value).map((r) => {
        const raw = {
          uri: `${space}/${repo}/${r.collection}/${r.rkey}`,
          cid: r.cid,
          value: r.value
        };
        return unvalidated ? raw : parse(schema, raw);
      }),
      cursor: res.cursor
    };
  };
  return {
    repo,
    location: `${space}/${repo}`,
    blobUrl: (blob) => {
      const cid = cidFromBlob(blob);
      if (!cid) return null;
      return `${service.replace(/\/$/, "")}/xrpc/com.atproto.space.getBlob?space=${encodeURIComponent(space)}&repo=${encodeURIComponent(repo)}&cid=${encodeURIComponent(cid)}`;
    },
    async get(schema, rkey) {
      try {
        const res = await scoped(() => require2().call(getRecord_exports, {
          space,
          repo,
          collection: schema.$type,
          rkey
        }));
        return parse(schema, res);
      } catch (err) {
        if (isNotFound(err)) return null;
        throw err;
      }
    },
    page,
    list: (schema, { limit, unvalidated } = {}) => paginate(page, schema, limit, unvalidated),
    async create(schema, record, rkey) {
      return await scoped(() => require2().call(createRecord_exports, {
        space,
        repo,
        collection: schema.$type,
        rkey,
        record
      }));
    },
    async put(schema, rkey, record) {
      return await scoped(() => require2().call(putRecord_exports, {
        space,
        repo,
        collection: schema.$type,
        rkey,
        record
      }));
    },
    async delete(schema, rkey) {
      await scoped(() => require2().call(deleteRecord_exports, {
        space,
        repo,
        collection: schema.$type,
        rkey
      }));
    },
    async batch(writes) {
      return ((await scoped(() => require2().call(applyWrites_exports, {
        space,
        repo,
        writes: writes.map(({ operation, schema, rkey, value }) => {
          const op = {
            collection: schema.$type,
            rkey,
            value
          };
          return operation === "create" ? create.build(op) : operation === "put" ? update.build(op) : delete$0.build(op);
        })
      }))).results ?? []).map((result) => "uri" in result ? {
        uri: result.uri,
        cid: result.cid
      } : void 0);
    }
  };
}
function policyToLex(policy) {
  return policy === "public" ? publicPolicy.build({}) : policy === "member-list" ? memberListPolicy.build({}) : managingAppPolicy.build({ managingApp: policy.managingApp });
}
function appAccessToLex(access) {
  return access === "open" ? open.build({}) : allowList.build({ allowed: [...access.allowed] });
}
function policyFromLex(value) {
  if (publicPolicy.isTypeOf(value)) return "public";
  if (managingAppPolicy.isTypeOf(value)) return { managingApp: value.managingApp };
  return "member-list";
}
function appAccessFromLex(value) {
  if (allowList.isTypeOf(value)) return { allowed: value.allowed };
  return "open";
}
function createSpaceManager(space, authority, client) {
  const uri = spaceUri(authority, space.type, space.skey);
  const require2 = () => {
    if (!client) throw readOnly("manage spaces");
    return client;
  };
  async function info() {
    try {
      const res = await require2().call(getSpace_exports, { space: uri });
      return {
        uri: res.uri,
        read: policyFromLex(res.readPolicy),
        write: policyFromLex(res.writePolicy),
        appAccess: appAccessFromLex(res.appAccess)
      };
    } catch (err) {
      if (err instanceof XrpcResponseError && err.error === "SpaceNotFound") return null;
      throw err;
    }
  }
  async function exists() {
    let cursor;
    do {
      const res = await require2().call(listSpaces_exports, {
        type: space.type,
        did: authority,
        limit: 100,
        cursor
      });
      if (res.spaces.some((view) => view.uri === uri)) return true;
      cursor = res.cursor;
    } while (cursor);
    return false;
  }
  return {
    exists,
    info,
    async ensure(options = {}) {
      const existing = await info();
      if (existing) return existing;
      const read = options.read ?? "member-list";
      const write = options.write ?? "member-list";
      const appAccess = options.appAccess ?? "open";
      return {
        uri: (await require2().call(createSpace_exports, {
          type: space.type,
          skey: space.skey,
          readPolicy: policyToLex(read),
          writePolicy: policyToLex(write),
          appAccess: appAccessToLex(appAccess)
        })).uri,
        read,
        write,
        appAccess
      };
    },
    async update(options) {
      await require2().call(updateSpace_exports, {
        space: uri,
        readPolicy: options.read ? policyToLex(options.read) : void 0,
        writePolicy: options.write ? policyToLex(options.write) : void 0,
        appAccess: options.appAccess ? appAccessToLex(options.appAccess) : void 0
      });
    },
    async delete() {
      await require2().call(deleteSpace_exports, { space: uri });
    },
    members: {
      async list() {
        const out = [];
        let cursor;
        do {
          const res = await require2().call(listMembers_exports, {
            space: uri,
            limit: 100,
            cursor
          });
          out.push(...res.members.map((m) => ({
            did: m.did,
            read: m.read,
            write: m.write
          })));
          cursor = res.cursor;
        } while (cursor);
        return out;
      },
      async add(did, access = {}) {
        await require2().call(putMember_exports, {
          space: uri,
          did,
          read: access.read ?? true,
          write: access.write ?? true
        });
      },
      async remove(did) {
        await require2().call(removeMember_exports, {
          space: uri,
          did
        });
      }
    }
  };
}
export {
  createSpaceBackend,
  createSpaceManager,
  guardSpaces,
  probeSpaces
};
