import type { ReactNode } from 'react'
import { Link } from '@tanstack/react-router'
import { useAccount } from '../queries.ts'

/**
 * Port of the upstream airspace docs app `DemoShell.vue`: a sticky sidebar with
 * the demo account and section nav, next to the page content. This port has no
 * sandbox-account flow, so the account is the fixed service account the web app
 * writes through.
 */
export function DemoShell({ children }: { children: ReactNode }) {
  const { data: account } = useAccount()
  if (!account)
    return null
  const name = account.handle.split('.')[0]
  const domain = account.handle.slice(account.handle.indexOf('.'))
  const repoUrl = `https://pdsls.dev/at://${account.did}`

  return (
    <div className="demo">
      <aside className="side">
        <div className="who">
          <span className="avatar" aria-hidden="true">{name.charAt(0)}</span>
          <span className="handle">
            <strong>{name}</strong>
            <small>{domain}</small>
          </span>
        </div>

        <nav className="side-nav" aria-label="Demo">
          <Link to="/" activeOptions={{ exact: true }} activeProps={{ className: 'router-link-exact-active' }}>
            <span aria-hidden="true">◇</span>
            Notes
          </Link>
          <Link to="/drafts" activeOptions={{ exact: true }} activeProps={{ className: 'router-link-exact-active' }}>
            <span aria-hidden="true">◐</span>
            Drafts
          </Link>
          <Link to="/profile" activeOptions={{ exact: true }} activeProps={{ className: 'router-link-exact-active' }}>
            <span aria-hidden="true">○</span>
            Profile
          </Link>
          <a href={repoUrl} target="_blank" rel="noopener">
            <span aria-hidden="true">↗</span>
            Public repo on pdsls
          </a>
        </nav>

        <p className="hint">
          This demo writes through a service account on our demo PDS. Everything it
          publishes is in the account's public repo, and its workspace space holds the drafts.
        </p>
      </aside>

      <section className="page">
        {children}
      </section>
    </div>
  )
}
