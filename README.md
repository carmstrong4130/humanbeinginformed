# Be Informed — humanbeinginformed.com

A static, fact-only site showing **what laws are being voted on at the state level, who is voting on
them, and when** — with every bill, legislator, committee and meeting linking back to its official
government source. No commentary, no analysis, no endorsements.

The homepage is a US map. Hovering a state highlights it: gray if it is not covered yet, green if it
is. At launch, **Utah** is the only clickable state.

Live: <https://www.humanbeinginformed.com> · Built to the spec in [PLAN.md](PLAN.md).

---

## Stack

| Piece | Choice |
|---|---|
| App | Vite 5 + React 18 + TypeScript (plain SPA — no Next.js, no TanStack Start, no monorepo) |
| Styling | Tailwind CSS **v3** |
| Routing | react-router-dom v6 — two routes, `/` and `/:stateSlug` |
| Map | Hand-rolled inline SVG from the CC0 Wikimedia base map — no map library |
| Data | Official Utah Legislature JSON API, snapshotted into the repo by a Node script |
| Refresh | GitHub Actions cron, committing JSON back to `main` |
| Hosting | Vercel — every push to `main` auto-deploys |

The layout deliberately stays Lovable-compatible: one `package.json` at the repo root, a working
`npm run dev`, Vite + Tailwind, all code on `main`, `@` → `./src` alias. `clsx` / `tailwind-merge` /
`tailwindcss-animate` and `src/lib/utils.ts` (`cn()`) are present so shadcn/ui components drop in
without setup; no shadcn components are currently used, since the design needs almost none.

---

## Running it

```bash
npm install
npm run dev
```

Dev server: <http://localhost:8080>. Other scripts:

| Command | What it does |
|---|---|
| `npm run build` | Typechecks, then builds to `dist/` |
| `npm run typecheck` | Types only |
| `npm run data:roster` | Fetches legislators, committees and portraits |
| `npm run data:calendars` | Fetches bills, floor calendars and committee agendas |
| `npx tsx scripts/fetch-utah.ts --mode=roster --force-photos` | Re-downloads every portrait |

---

## How the data works

### Source

Utah publishes a semi-documented JSON API — **no HTML scraping is involved**. Docs:
<https://le.utah.gov/data/developer.htm> (note that `https://le.utah.gov/data/` with no page name
returns "Request Rejected"). Endpoints live at `https://glen.le.utah.gov/` with the API token as the
**last path segment**.

| Purpose | Endpoint |
|---|---|
| All legislators (public, no token) | `https://le.utah.gov/data/legislators.json` |
| Committees + membership | `https://glen.le.utah.gov/committees/<TOKEN>` |
| Scheduled meetings, incl. floor times | `https://glen.le.utah.gov/legcal/<TOKEN>` |
| Agenda calendar / one meeting's agenda | `https://glen.le.utah.gov/agencal/<TOKEN>` · `.../agencal/<mtgID>/<TOKEN>` |
| Floor reading calendars | `https://glen.le.utah.gov/calendars/<TOKEN>` |
| Session bill list (change detection) | `https://glen.le.utah.gov/bills/<SESS>/billlist/<TOKEN>` |
| Bill detail | `https://glen.le.utah.gov/bills/<SESS>/<BILLNUM>/<TOKEN>` |

### ⚠️ The API token

The site currently ships on the Legislature's public **demo token `5678`**, which is what their own
documentation page embeds. There is no self-serve signup.

**A real token should be requested** by phoning the Legislature at **801-538-1035** or
**801-538-1408**. Once you have one, add it as the `UTAH_LEG_TOKEN` GitHub Actions secret — the
fetcher reads `process.env.UTAH_LEG_TOKEN` and falls back to `5678` only when that is unset.

### Rate limits — please respect these

Quoted from the Legislature's developer page:

- legislators — "no more than once a day"
- committees and the meeting calendar — "no more than three times a day"
- reading calendar and bills — "no more than once an hour"
- "cache your own version when possible"
- "Applications found abusing the system may have to be blocked"
- the data is "experimental… may alter or remove at any time"

The two workflow schedules (roster daily, calendars every 3 h) sit well inside all of that, every
request is sequential with a ~1 s gap, and each one carries a
`User-Agent: humanbeinginformed.com data fetcher (contact: …)` header. `le.utah.gov/robots.txt` also
disallows `/asp/` — the fetcher never touches it.

### What gets written

`npm run data:*` writes normalized snapshots into `src/data/utah/`:

| File | Contents |
|---|---|
| `legislators.json` | id, name, chamber, party, district, official bio URL, local portrait path |
| `committees.json` | id, name, chamber, member ids, official committee page |
| `bills.json` | Only bills that appear on an upcoming calendar or agenda |
| `vote-events.json` | The backbone: one entry per upcoming vote — what, when, where, who |
| `meta.json` | Session info, counts, `lastUpdated` |

Portraits land in `public/legislators/<LegID>.jpg` and are committed. They are only downloaded when
missing, so the daily job normally makes zero image requests. 103 of the 104 sitting members have
one; anyone missing renders as initials in a gray circle.

These JSON files are **imported at build time** — the site does no runtime fetching, so there are no
loading states and no CORS surface. Fresh data reaches the site by being committed, which triggers a
Vercel rebuild. Every snapshot is versioned in git history for free, which also makes the history a
usable time series later — don't squash the data commits.

### What counts as "being voted on"

Two event types, both labelled on the page:

1. **Floor vote** — a bill appears on a House or Senate reading calendar. Everyone in that chamber
   votes; the time comes from the chamber's floor session. Reading calendars are ordered lists, so
   there is no bill-by-bill timing to show.
2. **Committee vote** — a bill appears on a committee agenda (the API's `upcomming` flag — that
   misspelling is literal in their data). That committee's members vote.

**Out of session, the page shows a placeholder, not interim meetings.** The 2026 General Session ran
Jan 20 – Mar 6, 2026. Utah's General Session is 45 days from the third Tuesday of January, so the
2027 session convenes **January 19, 2027**. Between sessions `/calendars/` returns `{"calendars":[]}`
— which the fetcher treats as a normal result, not an error — and the Utah page renders the
next-session notice. The interim and confirmation committee meetings that `/legcal/` does carry
year-round are deliberately **not** shown; the site is about laws being voted on.

Special sessions (`2026S1`, `2026S2`, …) are probed automatically and do produce vote events
mid-year. A session id that does not exist answers with the plain text `Invalid request` rather than
a 404, which the fetcher handles.

### Refresh cadence

| Workflow | Schedule | Roughly |
|---|---|---|
| `.github/workflows/refresh-calendars.yml` | `17 */3 * * *` (every 3 h) | 480 min/month |
| `.github/workflows/refresh-roster.yml` | `43 9 * * *` (daily) | 60 min/month |

Total ≈ 540 of the 2,000 free Linux minutes for private repos. Both run on `ubuntu-latest`
(Windows runners bill at 2×) and both accept manual `workflow_dispatch` runs.

**Optional:** during the January–March session you can bump calendars to hourly by changing that
cron to `"17 * * * *"` — about 1,440 min/month, still under the cap and still within the API's
"once an hour" guidance. It is a deliberate one-line change, not the default.

GitHub's scheduler is best-effort: runs are often 5–30 minutes late and are occasionally skipped.
GitHub also disables scheduled workflows after 60 days of repository inactivity — the roster job
guards against that by committing a `.github/keepalive` timestamp if nothing else has been committed
for 40 days.

Commits made with the default `GITHUB_TOKEN` do not trigger other Actions workflows, but **Vercel
deploys them anyway** because it watches pushes through its own GitHub App. That is exactly why
hosting is on Vercel rather than Lovable.

---

## Deployment

- Push to `main` → Vercel builds `npm run build` → serves `dist/`.
- `vercel.json` rewrites all paths to `index.html` so a direct hit on `/utah` resolves.
- Data commits reach the live site about 2–3 minutes after the cron job runs.

---

## Remaining manual steps

These need account access and have to be done by hand.

- [ ] **1. Push to GitHub.** The repo is initialized with remote
      `https://github.com/carmstrong4130/humanbeinginformed.git` and everything is committed on
      `main`, but nothing has been pushed yet:
      ```bash
      git push -u origin main
      ```
- [ ] **2. Add the API token secret** (optional until you have one). Repo → Settings → Secrets and
      variables → Actions → New repository secret → `UTAH_LEG_TOKEN`. Until then both workflows run
      on the demo token. Get a real one by phone: 801-538-1035 / 801-538-1408.
- [ ] **3. Trigger both workflows once** from the Actions tab (`Run workflow`) and confirm they go
      green. Out of session, `refresh-calendars` should report zero vote events — that is correct.
- [ ] **4. Create the Vercel project.** In the existing `the-bird-atlas` scope, import the
      `humanbeinginformed` GitHub repo. Framework auto-detects as Vite; output directory `dist`.
      Confirm the `*.vercel.app` deploy succeeds.
- [ ] **5. Point the domain** (DNS is at GoDaddy). In Vercel add both `www.humanbeinginformed.com`
      and the apex `humanbeinginformed.com`, setting the apex to redirect to `www`. Then in GoDaddy:
      - delete GoDaddy's default "Parked" A record and any conflicting `www` record first
      - CNAME `www` → `cname.vercel-dns.com`
      - A `@` → `76.76.21.21` (GoDaddy has no ALIAS/ANAME at the apex, so an A record is the way)

      Then wait for propagation and Vercel's SSL issuance.
- [ ] **6. Lovable (only when front-end iteration begins).** Create a throwaway Lovable project →
      connect GitHub, which makes Lovable create its own repo → clone that repo → replace its
      contents with this code, keeping its `.git` → force-push. Lovable's two-way sync then picks
      the code up, and **that** repo becomes canonical: re-point the Vercel project's Git connection
      to it and archive this one. Worth re-checking first that Lovable still supports the classic
      Vite stack — their newer projects are moving to TanStack Start.

---

## Adding another state

The app is already state-generic. For a new state you need to:

1. Flip `enabled: true` for its code in [`src/config/states.ts`](src/config/states.ts).
2. Write `scripts/fetch-<state>.ts` producing the same five files under `src/data/<slug>/`, matching
   the types in [`src/lib/types.ts`](src/lib/types.ts).
3. Register it in [`src/data/index.ts`](src/data/index.ts) and add a workflow.

Most states have no equivalent of Utah's API. [LegiScan](https://api.legiscan.com/) (free 30,000
queries/month, attribution required) is the best general fallback for bills and roll calls, though
not for real-time reading calendars; [OpenStates/Plural](https://v3.openstates.org/) (~500 req/day)
covers bills, people and committees more broadly. Both are documented in PLAN.md §4.6 as resilience
options if the Utah API — which the state calls experimental — ever changes shape.

---

## Attribution

Legislative data comes from the **Utah State Legislature** (<https://le.utah.gov>), credited in the
site footer on every state page. The base map is Wikimedia Commons'
[`Blank_US_Map_(states_only).svg`](https://commons.wikimedia.org/wiki/File:Blank_US_Map_(states_only).svg),
released under **CC0 1.0** (public domain) — no attribution obligation, but noted here anyway.

There are no monetization plans. If that ever changes, revisit le.utah.gov's terms, which ask for
attribution on commercial use, and re-check portrait usage.
