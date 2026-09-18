import type { ReactNode } from "react";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { Link, useRouter } from "@tanstack/react-router";
import { useState } from "react";

import { resetNotes, signOut, startSession } from "../server/air.ts";
import { optionalAccountQuery } from "../queries.ts";

type Task = "start" | "reset" | "signOut" | null;

const steps = ["asking the PDS for an account", "signing in", "writing a profile and two tags"];

/**
 * Port of the upstream airspace docs app `DemoShell.vue`: a sticky sidebar with
 * the sandbox account and section nav, next to the page content. Visitors get a
 * throwaway account on the demo PDS, kept in an encrypted cookie.
 */
export function DemoShell({ children }: { children: ReactNode }) {
  const { data: account } = useSuspenseQuery(optionalAccountQuery());
  const queryClient = useQueryClient();
  const router = useRouter();
  const [task, setTask] = useState<Task>(null);
  const [step, setStep] = useState(0);
  const [error, setError] = useState("");

  const name = account ? account.handle.split(".")[0] : "";
  const domain = account ? account.handle.slice(account.handle.indexOf(".")) : "";
  const repoUrl = account ? `https://pdsls.dev/at://${account.did}` : "";
  const busy = task !== null;

  async function run(next: Exclude<Task, null>, action: () => Promise<unknown>) {
    setTask(next);
    setError("");
    setStep(0);
    let passed = 0;
    const ticker =
      next === "start"
        ? setInterval(() => setStep(Math.min(++passed, steps.length - 1)), 1500)
        : undefined;
    try {
      await action();
      await queryClient.invalidateQueries({ queryKey: ["account"] });
      await router.invalidate();
      await Promise.all(
        ["notes", "drafts", "profile"].map((queryKey) =>
          queryClient.invalidateQueries({ queryKey: [queryKey] }),
        ),
      );
    } catch (cause) {
      setError((cause as Error).message ?? "something went wrong");
    } finally {
      clearInterval(ticker);
      setTask(null);
    }
  }

  return (
    <div className="demo">
      <aside className="side">
        <div className="who">
          {account ? (
            <>
              <span className="avatar" aria-hidden="true">
                {name.charAt(5)}
              </span>
              <span className="handle">
                <strong>{name}</strong>
                <small>{domain}</small>
              </span>
            </>
          ) : (
            <>
              <span className="avatar empty" aria-hidden="true" />
              <span className="handle">
                <strong>no account</strong>
                <small>sandbox</small>
              </span>
            </>
          )}
        </div>

        {account ? (
          <nav className="side-nav" aria-label="Demo">
            <Link
              to="/"
              activeOptions={{ exact: true }}
              activeProps={{ className: "router-link-exact-active" }}
            >
              <span aria-hidden="true">◇</span>
              Notes
            </Link>
            <Link
              to="/drafts"
              activeOptions={{ exact: true }}
              activeProps={{ className: "router-link-exact-active" }}
            >
              <span aria-hidden="true">◐</span>
              Drafts
            </Link>
            <Link
              to="/profile"
              activeOptions={{ exact: true }}
              activeProps={{ className: "router-link-exact-active" }}
            >
              <span aria-hidden="true">○</span>
              Profile
            </Link>
            <a href={repoUrl} target="_blank" rel="noopener">
              <span aria-hidden="true">↗</span>
              Public repo on pdsls
            </a>
          </nav>
        ) : null}

        <div className="side-actions">
          {account ? (
            <>
              <button disabled={busy} onClick={() => void run("reset", () => resetNotes())}>
                {task === "reset" ? "Resetting…" : "Reset notes"}
              </button>
              <button disabled={busy} onClick={() => void run("signOut", () => signOut())}>
                {task === "signOut" ? "Signing out…" : "Sign out"}
              </button>
            </>
          ) : (
            <>
              <button
                className="primary"
                disabled={busy}
                onClick={() => void run("start", () => startSession())}
              >
                {task === "start" ? "Creating…" : "Try it"}
              </button>
              <p className="hint">
                Makes a throwaway account on our demo PDS and keeps its credentials in an encrypted
                cookie. Your own account isn't touched.
              </p>
            </>
          )}
        </div>

        {task === "start" ? (
          <div className="progress" role="status" aria-live="polite">
            <div className="bar" aria-hidden="true">
              <span style={{ width: `${((step + 1) / (steps.length + 1)) * 100}%` }} />
            </div>
            <p>{steps[step]}…</p>
          </div>
        ) : null}

        {error ? (
          <p className="error" role="alert">
            {error}
            <button className="link" disabled={busy} onClick={() => setError("")}>
              dismiss
            </button>
          </p>
        ) : null}
      </aside>

      <section className="page">{children}</section>
    </div>
  );
}
