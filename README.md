# proxy

A browser-based web proxy you run inside a GitHub Codespace. The proxy runs on GitHub's servers, so the sites you open are fetched from there and not from your own machine. It's powered by [Rammerhead](https://github.com/binary-person/rammerhead), which rewrites pages server-side. Cookies, `localStorage`, redirects, POST forms, and WebSockets are all handled, so **logging in to sites works**.

## Quick start

1. Click **Code ▸ Codespaces ▸ Create codespace on main** on this repo.
2. Wait for the first build. It takes about a minute while it installs the proxy and builds the client files.
3. The proxy **starts automatically** when the codespace opens. The terminal prints `Open: https://<name>-8080.app.github.dev/`.
4. Open that link. VS Code may also pop it open for you, or you can use the **Ports** tab, find port 8080 ("Web Proxy"), and click the globe icon.
5. Type a URL on the Rammerhead page and press **Go**. Sign in to sites as you normally would.

If the proxy isn't running (for example after the codespace was stopped and resumed), run:

```bash
bash scripts/start.sh      # start (safe to run twice)
bash scripts/stop.sh       # stop
tail -f proxy.log          # logs
```

## How it works

```
your browser ──https──▶ Codespaces port 8080 ──▶ Rammerhead (Node) ──▶ the real website
```

- `.devcontainer/devcontainer.json` creates a Node 20 container, forwards port 8080, runs `scripts/setup.sh` once, and runs `scripts/start.sh` on every attach.
- `scripts/setup.sh` clones Rammerhead into `rammerhead/` (git-ignored), copies `config.js` into it, and runs `npm install` and `npm run build`.
- `config.js` is the only configuration. It binds to `0.0.0.0:8080` and builds the rewritten URLs from the host the browser used (`x-forwarded-host`/`x-forwarded-proto`), which is what makes it work behind the Codespaces URL.
- Rammerhead keeps a server-side session per browser, including cookies and storage. Sessions are kept for 3 days of inactivity, so you stay signed in between visits. Session data lives in `rammerhead/sessions/` inside the codespace.

## Sign-ins

Logins work because cookies are stored in the proxy session and not in your browser. Simple username/password sites and most OAuth redirects (Google, Microsoft, GitHub, etc.) work. Some caveats:

- Keep using the **same proxy session** (the Rammerhead page remembers it in your browser). A new session means a clean, signed-out browser.
- Sites with strict bot or fingerprint checks (some banking sites, Cloudflare challenges, passkeys/WebAuthn) may refuse to sign in. That's a limit of any rewriting proxy.
- Video-heavy sites and sites that use very new browser APIs can be partly broken.

## Access and security

- By default, Codespaces ports are **private**: only you, signed in to GitHub, can reach the URL. Leave it that way.
- If you make port 8080 **Public** to share it, set a password first. Add a Codespaces secret named `PROXY_PASSWORD` (GitHub ▸ Settings ▸ Codespaces ▸ Secrets), or run `PROXY_PASSWORD=yourpass bash scripts/start.sh`, and restart the proxy. Without a password, a public port is an open proxy anyone can use.
- Whatever you sign in to goes through this codespace. Only use it for accounts you're comfortable with, and don't share the URL.

## Good to know

- **Codespaces limits**: free accounts get a monthly allowance of core-hours and storage. Codespaces stop after 30 minutes idle by default, so stop yours when you're done: <https://github.com/codespaces>. Resuming it restarts the proxy.
- **Terms**: using Codespaces for general-purpose proxying or VPN-like traffic may conflict with [GitHub's Acceptable Use Policies and Codespaces terms](https://docs.github.com/en/site-policy/github-terms/github-terms-for-additional-products-and-features#codespaces). Light personal use is one thing; heavy traffic or sharing with others is another. You're responsible for how you use it.
- **Your network's rules**: if you use this at school or work, check their acceptable-use policy first.

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| Port 8080 isn't listed or the link 404s | `bash scripts/start.sh` and check `proxy.log` |
| Blank page after the first build | Reload the tab, and make sure the Ports tab shows 8080 as running |
| Logged out unexpectedly | Your session expired or was recreated. Sign in again on the same Rammerhead page |
| Site loops or won't load | Try a fresh session by opening the proxy in a new tab/incognito window |
| Rammerhead update broke something | `RH_REF=<tag-or-commit> bash scripts/setup.sh` after deleting `rammerhead/` |

## Run it locally (optional)

Needs Node 18+ and git:

```bash
bash scripts/setup.sh && bash scripts/start.sh
# open http://localhost:8080
```

## Credits

Rammerhead by [binary-person](https://github.com/binary-person/rammerhead) (MIT), built on TestCafe's [hammerhead](https://github.com/DevExpress/testcafe-hammerhead) engine. This repo is just the Codespaces packaging and config.
