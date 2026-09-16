import { L as LexError, p as procedure, j as jsonPayload, a as params, o as optional, l as lexMap, s as string, b as boolean, c as payload, q as query, d as lexErrorDataSchema, e as buildAgent, x as xrpcSafe, f as xrpc } from "./air-DeKDbXdL.js";
import "../server.js";
import "node:async_hooks";
import "node:stream";
import "node:stream/web";
import "util";
import "crypto";
import "async_hooks";
import "stream";
import "./index-DhNZQhvL.js";
class LexAuthFactorError extends LexError {
  /**
   * Creates a new LexAuthFactorError.
   *
   * @param cause - The underlying XRPC failure response from the server
   */
  constructor(cause) {
    super(cause.error, cause.message ?? "Auth factor token required", { cause });
    this.cause = cause;
    this.name = "LexAuthFactorError";
  }
}
const $nsid$4 = "com.atproto.server.createAccount";
const $params$4 = /* @__PURE__ */ params();
const $input$3 = /* @__PURE__ */ jsonPayload({
  email: /* @__PURE__ */ optional(/* @__PURE__ */ string()),
  handle: /* @__PURE__ */ string({ format: "handle" }),
  did: /* @__PURE__ */ optional(/* @__PURE__ */ string({ format: "did" })),
  inviteCode: /* @__PURE__ */ optional(/* @__PURE__ */ string()),
  verificationCode: /* @__PURE__ */ optional(/* @__PURE__ */ string()),
  verificationPhone: /* @__PURE__ */ optional(/* @__PURE__ */ string()),
  password: /* @__PURE__ */ optional(/* @__PURE__ */ string()),
  recoveryKey: /* @__PURE__ */ optional(/* @__PURE__ */ string()),
  plcOp: /* @__PURE__ */ optional(/* @__PURE__ */ lexMap())
});
const $output$4 = /* @__PURE__ */ jsonPayload({
  accessJwt: /* @__PURE__ */ string(),
  refreshJwt: /* @__PURE__ */ string(),
  handle: /* @__PURE__ */ string({ format: "handle" }),
  did: /* @__PURE__ */ string({ format: "did" }),
  didDoc: /* @__PURE__ */ optional(/* @__PURE__ */ lexMap())
});
const main$4 = /* @__PURE__ */ procedure($nsid$4, $params$4, $input$3, $output$4, [
  "InvalidHandle",
  "InvalidPassword",
  "InvalidInviteCode",
  "HandleNotAvailable",
  "UnsupportedDomain",
  "UnresolvableDid",
  "IncompatibleDidDoc"
]);
const $nsid$3 = "com.atproto.server.createSession";
const $params$3 = /* @__PURE__ */ params();
const $input$2 = /* @__PURE__ */ jsonPayload({
  identifier: /* @__PURE__ */ string(),
  password: /* @__PURE__ */ string(),
  authFactorToken: /* @__PURE__ */ optional(/* @__PURE__ */ string()),
  allowTakendown: /* @__PURE__ */ optional(/* @__PURE__ */ boolean())
});
const $output$3 = /* @__PURE__ */ jsonPayload({
  accessJwt: /* @__PURE__ */ string(),
  refreshJwt: /* @__PURE__ */ string(),
  handle: /* @__PURE__ */ string({ format: "handle" }),
  did: /* @__PURE__ */ string({ format: "did" }),
  didDoc: /* @__PURE__ */ optional(/* @__PURE__ */ lexMap()),
  email: /* @__PURE__ */ optional(/* @__PURE__ */ string()),
  emailConfirmed: /* @__PURE__ */ optional(/* @__PURE__ */ boolean()),
  emailAuthFactor: /* @__PURE__ */ optional(/* @__PURE__ */ boolean()),
  active: /* @__PURE__ */ optional(/* @__PURE__ */ boolean()),
  status: /* @__PURE__ */ optional(
    /* @__PURE__ */ string()
  )
});
const main$3 = /* @__PURE__ */ procedure($nsid$3, $params$3, $input$2, $output$3, [
  "AccountTakedown",
  "AuthFactorTokenRequired"
]);
const $nsid$2 = "com.atproto.server.deleteSession";
const $params$2 = /* @__PURE__ */ params();
const $input$1 = /* @__PURE__ */ payload();
const $output$2 = /* @__PURE__ */ payload();
const main$2 = /* @__PURE__ */ procedure($nsid$2, $params$2, $input$1, $output$2, [
  "InvalidToken",
  "ExpiredToken"
]);
const $nsid$1 = "com.atproto.server.getSession";
const $params$1 = /* @__PURE__ */ params();
const $output$1 = /* @__PURE__ */ jsonPayload({
  handle: /* @__PURE__ */ string({ format: "handle" }),
  did: /* @__PURE__ */ string({ format: "did" }),
  didDoc: /* @__PURE__ */ optional(/* @__PURE__ */ lexMap()),
  email: /* @__PURE__ */ optional(/* @__PURE__ */ string()),
  emailConfirmed: /* @__PURE__ */ optional(/* @__PURE__ */ boolean()),
  emailAuthFactor: /* @__PURE__ */ optional(/* @__PURE__ */ boolean()),
  active: /* @__PURE__ */ optional(/* @__PURE__ */ boolean()),
  status: /* @__PURE__ */ optional(
    /* @__PURE__ */ string()
  )
});
const main$1 = /* @__PURE__ */ query($nsid$1, $params$1, $output$1);
const $nsid = "com.atproto.server.refreshSession";
const $params = /* @__PURE__ */ params();
const $input = /* @__PURE__ */ payload();
const $output = /* @__PURE__ */ jsonPayload({
  accessJwt: /* @__PURE__ */ string(),
  refreshJwt: /* @__PURE__ */ string(),
  handle: /* @__PURE__ */ string({ format: "handle" }),
  did: /* @__PURE__ */ string({ format: "did" }),
  didDoc: /* @__PURE__ */ optional(/* @__PURE__ */ lexMap()),
  email: /* @__PURE__ */ optional(/* @__PURE__ */ string()),
  emailConfirmed: /* @__PURE__ */ optional(/* @__PURE__ */ boolean()),
  emailAuthFactor: /* @__PURE__ */ optional(/* @__PURE__ */ boolean()),
  active: /* @__PURE__ */ optional(/* @__PURE__ */ boolean()),
  status: /* @__PURE__ */ optional(
    /* @__PURE__ */ string()
  )
});
const main = /* @__PURE__ */ procedure($nsid, $params, $input, $output, [
  "AccountTakedown",
  "InvalidToken",
  "ExpiredToken"
]);
async function extractXrpcErrorCode(response) {
  const json = await peekJson(response, 10 * 1024);
  if (json === void 0)
    return null;
  if (!lexErrorDataSchema.matches(json))
    return null;
  return json.error;
}
async function peekJson(response, maxSize = Infinity) {
  const type = extractType(response);
  if (type !== "application/json")
    return void 0;
  const length = extractLength(response);
  if (length != null && length > maxSize)
    return void 0;
  try {
    return await response.clone().json();
  } catch {
    return void 0;
  }
}
function extractLength({ headers }) {
  return headers.get("Content-Length") ? Number(headers.get("Content-Length")) : void 0;
}
function extractType({ headers }) {
  return headers.get("Content-Type")?.split(";")[0]?.trim().toLowerCase();
}
function extractPdsEndpoint(didDoc) {
  const pdsService = ifArray(didDoc?.service)?.find((service) => ifString(service?.id)?.endsWith("#atproto_pds"));
  const pdsEndpoint = ifString(pdsService?.serviceEndpoint);
  return pdsEndpoint && canParseUrl(pdsEndpoint) ? pdsEndpoint : null;
}
const canParseUrl = URL.canParse ?? ((url) => {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
});
const ifString = (v) => typeof v === "string" ? v : void 0;
const ifArray = (v) => Array.isArray(v) ? v : void 0;
class PasswordSession {
  /**
   * Internal {@link Agent} used for session management towards the
   * authentication service only.
   */
  #serviceAgent;
  #sessionData;
  #sessionPromise;
  constructor(sessionData, options = {}) {
    this.options = options;
    this.#serviceAgent = buildAgent({
      service: sessionData.service,
      fetch: options.fetch
    });
    this.#sessionData = sessionData;
    this.#sessionPromise = Promise.resolve(this.#sessionData);
  }
  /**
   * The DID (Decentralized Identifier) of the authenticated account.
   *
   * @throws {Error} If the session has been destroyed (logged out).
   */
  get did() {
    return this.session.did;
  }
  /**
   * The handle (username) of the authenticated account.
   *
   * @throws {Error} If the session has been destroyed (logged out).
   */
  get handle() {
    return this.session.handle;
  }
  /**
   * The current session data containing authentication credentials.
   *
   * @throws {Error} If the session has been destroyed (logged out).
   */
  get session() {
    if (this.#sessionData)
      return this.#sessionData;
    throw new Error("Logged out");
  }
  /**
   * Whether this session has been destroyed (logged out).
   *
   * Once destroyed, this session instance can no longer be used for
   * authenticated requests. Create a new session via {@link PasswordSession.login}
   * or {@link PasswordSession.resume}.
   */
  get destroyed() {
    return this.#sessionData === null;
  }
  /**
   * Handles authenticated fetch requests to the user's PDS.
   *
   * This method implements the {@link Agent} interface and is called by
   * AT Protocol clients to make authenticated requests. It automatically:
   * - Adds the access token to request headers
   * - Detects expired tokens and triggers refresh
   * - Retries requests after successful token refresh
   *
   * @param path - The request path (will be resolved against the PDS URL)
   * @param init - Standard fetch RequestInit options (headers, body, etc.)
   * @returns The fetch Response from the PDS
   * @throws {TypeError} If an 'authorization' header is already set in init
   */
  async fetchHandler(path, init) {
    const headers = new Headers(init.headers);
    if (headers.has("authorization")) {
      throw new TypeError("Unexpected 'authorization' header set");
    }
    const sessionPromise = this.#sessionPromise;
    const sessionData = await sessionPromise;
    const fetch = this.options.fetch ?? globalThis.fetch;
    headers.set("authorization", `Bearer ${sessionData.accessJwt}`);
    const initialRes = await fetch(fetchUrl(sessionData, path), {
      ...init,
      headers
    });
    const refreshNeeded = initialRes.status === 401 || initialRes.status === 400 && await extractXrpcErrorCode(initialRes) === "ExpiredToken";
    if (!refreshNeeded) {
      return initialRes;
    }
    const newSessionPromise = this.#sessionPromise === sessionPromise ? this.refresh() : this.#sessionPromise;
    const newSessionData = await newSessionPromise.catch((_err) => null);
    if (!newSessionData) {
      return initialRes;
    }
    if (newSessionData.accessJwt === sessionData.accessJwt) {
      return initialRes;
    }
    if (init?.signal?.aborted) {
      return initialRes;
    }
    if (ReadableStream && init?.body instanceof ReadableStream) {
      return initialRes;
    }
    if (!initialRes.bodyUsed) {
      await initialRes.body?.cancel();
    }
    headers.set("authorization", `Bearer ${newSessionData.accessJwt}`);
    return fetch(fetchUrl(newSessionData, path), { ...init, headers });
  }
  /**
   * Refreshes the session by obtaining new access and refresh tokens.
   *
   * This method is automatically called by {@link fetchHandler} when the access
   * token expires. You can also call it manually to proactively refresh tokens.
   *
   * On success, the {@link PasswordSessionOptions.onUpdated} callback is invoked
   * with the new session data. On expected failures (invalid session), the
   * {@link PasswordSessionOptions.onDeleted} callback is invoked. On unexpected
   * failures (network issues), the {@link PasswordSessionOptions.onUpdateFailure}
   * callback is invoked and the existing session data is preserved.
   *
   * @returns The refreshed session data
   * @throws {RefreshFailure} If the session is no longer valid (triggers onDeleted)
   */
  async refresh() {
    this.#sessionPromise = this.#sessionPromise.then(async (sessionData) => {
      const response = await xrpcSafe(this.#serviceAgent, main, { headers: { Authorization: `Bearer ${sessionData.refreshJwt}` } });
      if (!response.success && response.matchesSchemaErrors()) {
        await this.options.onDeleted?.call(this, sessionData);
        this.#sessionData = null;
        throw response;
      }
      if (!response.success) {
        await this.options.onUpdateFailure?.call(this, sessionData, response);
        return sessionData;
      }
      const data = response.body;
      if (data.emailConfirmed == null || data.didDoc == null) {
        const extraData = await xrpcSafe(this.#serviceAgent, main$1, { headers: { Authorization: `Bearer ${data.accessJwt}` } });
        if (extraData.success && extraData.body.did === data.did) {
          Object.assign(data, extraData.body);
        }
      }
      const newSession = {
        ...data,
        service: sessionData.service
      };
      await this.options.onUpdated?.call(this, newSession);
      return this.#sessionData = newSession;
    });
    return this.#sessionPromise;
  }
  /**
   * Logs out by deleting the session on the server.
   *
   * This method invalidates both the access and refresh tokens on the server,
   * preventing any further use of this session. After successful logout, the
   * session is marked as destroyed and the {@link PasswordSessionOptions.onDeleted}
   * callback is invoked.
   *
   * If the logout request fails due to network issues or server unavailability,
   * the {@link PasswordSessionOptions.onDeleteFailure} callback is invoked and
   * the session remains active locally. In this case, you should retry the
   * logout later to ensure the session is properly invalidated on the server.
   *
   * @throws {DeleteFailure} If the logout request fails due to unexpected errors
   */
  async logout() {
    let reason = null;
    this.#sessionPromise = this.#sessionPromise.then(async (sessionData) => {
      const result = await xrpcSafe(this.#serviceAgent, main$2, { headers: { Authorization: `Bearer ${sessionData.refreshJwt}` } });
      if (result.success || result.matchesSchemaErrors()) {
        await this.options.onDeleted?.call(this, sessionData);
        this.#sessionData = null;
        throw new Error("Logged out");
      } else {
        reason = result;
        await this.options.onDeleteFailure?.call(this, sessionData, result);
        return sessionData;
      }
    });
    return this.#sessionPromise.then((_session) => {
      throw reason;
    }, (_err) => {
    });
  }
  async [Symbol.asyncDispose]() {
    await this.logout();
  }
  /**
   * Creates a new account and returns an authenticated session.
   *
   * This static method registers a new account on the specified service and
   * automatically creates an authenticated session for it.
   *
   * @param body - Account creation parameters (handle, email, password, etc.)
   * @param options - Session options including the service URL
   * @returns A new PasswordSession for the created account
   * @throws If account creation fails (e.g., handle taken, invalid invite code)
   *
   * @example
   * ```ts
   * const session = await PasswordSession.createAccount(
   *   {
   *     handle: 'alice.bsky.social',
   *     email: 'alice@example.com',
   *     password: 'secure-password',
   *   },
   *   {
   *     service: 'https://bsky.social',
   *     onUpdated: (data) => saveToStorage(data),
   *   }
   * )
   * ```
   */
  static async createAccount(body, { service, headers, ...options }) {
    const response = await xrpc(buildAgent({ service, headers, fetch: options.fetch }), main$4, { body });
    const data = {
      ...response.body,
      service: String(service)
    };
    const agent = new PasswordSession(data, options);
    await options.onUpdated?.call(agent, data);
    return agent;
  }
  /**
   * Creates a new authenticated session using password credentials.
   *
   * This static method authenticates with the specified service and returns
   * a new PasswordSession instance that can be used for authenticated requests.
   *
   * **Security Warning:** It is strongly recommended to use app passwords instead
   * of main account credentials. App passwords can be created in your account
   * settings and provide limited access that can be revoked independently. For
   * browser-based applications, use OAuth-based authentication instead.
   *
   * @param options - Login options including service URL, identifier, and password
   * @param options.service - The AT Protocol service URL (e.g., 'https://bsky.social')
   * @param options.identifier - The user's handle or DID
   * @param options.password - The user's password or app password
   * @param options.allowTakendown - If true, allow login to takendown accounts
   * @param options.authFactorToken - 2FA token if required by the server
   * @returns A new authenticated PasswordSession
   * @throws {LexAuthFactorError} If the server requires a 2FA token
   * @throws If authentication fails (invalid credentials, etc.)
   *
   * **Basic login with app password in script**
   * @example
   * ```ts
   * // .env
   * // APP_PASSWORD_CREDENTIALS="https://<handle>:<app-password>@<pds-hosting-provider>"
   *
   * // Make sure to dispose (or logout) the session when done to avoid leaking
   * // resources and leaving orphaned sessions on the server
   * await using session = await PasswordSession.login(process.env.APP_PASSWORD_CREDENTIALS)
   *
   * // Use session to make authenticated requests
   * ```
   *
   * **Basic login with user password (not recommended!!!)**
   * @example
   * ```ts
   * const session = await PasswordSession.login({
   *   service: 'https://bsky.social',
   *   identifier: 'alice.bsky.social',
   *   password: 'xxxx',
   *   onUpdated: (data) => saveToStorage(data),
   *   onDeleted: (data) => clearStorage(data.did),
   * })
   *
   * // Next time, use resume with the persisted session data to avoid storing
   * // user credentials.
   * ```
   *
   * **Handling 2FA requirement**
   * @example
   * ```ts
   * try {
   *   const session = await PasswordSession.login({
   *     service: 'https://bsky.social',
   *     identifier: 'alice.bsky.social',
   *     password: 'xxxx',
   *   })
   * } catch (err) {
   *   if (err instanceof LexAuthFactorError) {
   *     const token = await promptUser('Enter 2FA code:')
   *     const session = await PasswordSession.login({
   *       service: 'https://bsky.social',
   *       identifier: 'alice.bsky.social',
   *       password: 'xxxx',
   *       authFactorToken: token,
   *     })
   *   }
   * }
   * ```
   */
  static async login(input) {
    const { service, identifier, password, allowTakendown, authFactorToken, ...options } = typeof input === "string" || input instanceof URL ? parseLoginUrl(input) : input;
    const xrpcAgent = buildAgent({
      service,
      fetch: options.fetch
    });
    const response = await xrpcSafe(xrpcAgent, main$3, { body: { identifier, password, allowTakendown, authFactorToken } });
    if (!response.success) {
      if (response.error === "AuthFactorTokenRequired") {
        throw new LexAuthFactorError(response);
      }
      throw response.reason;
    }
    const data = {
      ...response.body,
      service: String(service)
    };
    const agent = new PasswordSession(data, options);
    await options.onUpdated?.call(agent, data);
    return agent;
  }
  /**
   * Resume an existing session, ensuring it is still valid by refreshing it.
   * Any error thrown here indicates that the session is definitely no longer
   * valid. Network errors will be propagated through the
   * {@link PasswordSessionOptions.onUpdateFailure} hook, and not re-thrown
   * here. This means that a resolved promise does not necessarily indicate a
   * valid session, only that it's refresh did not definitively fail.
   *
   * This is the same as calling {@link PasswordSession.refresh} after
   * constructing the {@link PasswordSession} manually.
   *
   * @throws If, and only if, the session is definitely no longer valid.
   */
  static async resume(data, options) {
    const agent = new PasswordSession(data, options);
    await agent.refresh();
    return agent;
  }
  /**
   * Delete a session without having to {@link resume resume()} it first, or
   * provide hooks.
   *
   * @throws In case of unexpected error (network issue, server down, etc)
   * meaning that the session may still be valid.
   */
  static async delete(data, options) {
    const agent = new PasswordSession(data, options);
    await agent.logout();
  }
}
function fetchUrl(sessionData, path) {
  const pdsUrl = extractPdsEndpoint(sessionData.didDoc);
  return new URL(path, pdsUrl ?? sessionData.service);
}
function parseLoginUrl(input) {
  const url = typeof input === "string" ? new URL(input) : input;
  if (url.pathname !== "/") {
    throw new TypeError("Invalid login URL: unexpected pathname");
  }
  if (url.hash) {
    throw new TypeError("Invalid login URL: unexpected hash");
  }
  if (url.search) {
    throw new TypeError("Invalid login URL: unexpected search parameters");
  }
  if (!url.username || !url.password) {
    throw new TypeError("Invalid login URL: missing identifier or password");
  }
  return {
    service: url.origin,
    identifier: url.username,
    password: url.password
  };
}
export {
  LexAuthFactorError,
  PasswordSession,
  extractPdsEndpoint
};
