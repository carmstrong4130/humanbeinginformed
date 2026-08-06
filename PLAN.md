# PLAN.md — Be Informed (humanbeinginformed.com)

> **Audience:** This plan is written for an autonomous Opus build session with **no access to the planning conversation**. Everything needed is in this document. Research findings below were verified live on **August 5, 2026**.
>
> **Working folder:** `C:\Users\nwtbm\OneDrive\Desktop\Projects\HBI` (Windows 11).
> **GitHub repo (private, currently empty):** `https://github.com/carmstrong4130/humanbeinginformed`
> **Production URL:** `https://www.humanbeinginformed.com`

---

## 1. Summary

**Be Informed** is a static, fact-only website that shows what laws are being voted on at the state level, who is voting on them, and when — with every bill and legislator linking back to its official government source. The homepage is a minimal, Apple-clean page (light-gray background, white US map) where hovering a state highlights it gray (inactive) or green (clickable); at launch only **Utah** is clickable, leading to `/utah`. The Utah page lists bills on upcoming floor calendars and committee agendas, the legislators voting on them (with party and official bio links), and vote timing. Data comes from the **official Utah Legislature JSON API** (no HTML scraping needed), refreshed by a **GitHub Actions cron job** that commits JSON snapshots into the repo; every commit auto-deploys via **Vercel** to the custom domain. The stack is Lovable-compatible (Vite + React + TypeScript + Tailwind) so the front-end can later be iterated in Lovable.

---

## 2. Tech stack (with reasons)

| Choice | What | Why |
|---|---|---|
| **Vite + React 18 + TypeScript** | App framework | Lovable's classic native stack. NOTE: Lovable has been migrating *new* projects to TanStack Start w/ SSR (Enterprise default since ~Jun 2026); the plain Vite SPA remains supported and is what Lovable's two-way GitHub sync handles best for existing code. Build a **plain Vite SPA** — do not use TanStack Start, Next.js, or a monorepo. |
| **Tailwind CSS (v3)** | Styling | Lovable-native; the AI editor edits Tailwind classes reliably. v3 chosen because Lovable's classic scaffold uses it (v4 also accepted by Lovable — see §7 Q3). |
| **shadcn/ui** | Component primitives | Part of Lovable's usual scaffold (third-party confirmed). Install it, but use it sparingly — this design needs very few components. |
| **react-router-dom (v6)** | Routing | Lovable's classic scaffold uses React Router. Two routes only: `/` and `/:stateSlug`. |
| **Hand-rolled SVG US map** (no map library) | Clickable map | Built from Wikimedia Commons **`Blank_US_Map_(states_only).svg`**, which is **CC0/public domain** (verify it's the "(states only)" variant — other variants on Commons are CC-BY-SA). Each state `<path>` already has `id` = two-letter abbreviation. Zero dependencies, zero license obligations, full TypeScript, and pure JSX/Tailwind — the most Lovable-editable option. Rejected: `react-simple-maps` (unmaintained since Jul 2023), `react-usa-map` (CC-BY-SA map data, stale), `@svg-maps/usa` (**NonCommercial** license — disqualifying). |
| **Node 20 + TypeScript script via `tsx`** | Data fetcher | One dependency-light script (`native fetch`) run by GitHub Actions; also runnable locally on Windows for seeding/testing. |
| **GitHub Actions (cron, `ubuntu-latest`)** | Data refresh | Free tier for private repos = 2,000 Linux min/month; this pipeline uses well under that. Windows runners bill 2×, so the workflow must specify `ubuntu-latest`. |
| **Vercel** | Hosting + custom domain | Deploys on **every** push to `main` via its GitHub App — including commits made by the Actions bot with the default `GITHUB_TOKEN` (Actions-triggered workflows would NOT re-trigger other workflows, but Vercel watches pushes independently, so data commits deploy automatically). Also deploys Lovable's synced commits. Free Hobby tier suffices. Rejected: Lovable's built-in hosting (manual Publish step; wouldn't auto-deploy data commits; couples uptime to a Lovable subscription). |

**Lovable compatibility constraints to honor throughout:** single `package.json` at repo root (no workspaces/monorepo), working `npm run dev` script, Vite-based React+TS, Tailwind, no files over 10 MB, all app code on branch `main` (Lovable syncs one branch only).

---

## 3. Architecture

### 3.1 Repo / folder structure

```
humanbeinginformed/
├── index.html
├── package.json
├── vite.config.ts              # includes @ → ./src alias (Lovable convention)
├── tailwind.config.ts
├── postcss.config.js
├── tsconfig.json
├── .github/
│   └── workflows/
│       ├── refresh-calendars.yml    # bills/calendars/meetings — every 3 h
│       └── refresh-roster.yml       # legislators/committees — daily
├── scripts/
│   └── fetch-utah.ts           # the data fetcher (both modes, via CLI flag)
├── public/
│   ├── favicon.svg
│   └── legislators/            # official portraits, downloaded by the roster fetch (<LegID>.jpg)
└── src/
    ├── main.tsx
    ├── App.tsx                 # router setup
    ├── index.css               # Tailwind directives + base styles
    ├── pages/
    │   ├── Home.tsx
    │   ├── StatePage.tsx       # generic; renders by :stateSlug
    │   └── NotFound.tsx
    ├── components/
    │   ├── USMap.tsx           # the SVG map component
    │   ├── VoteEventCard.tsx   # one bill + when + who block
    │   ├── LegislatorList.tsx  # collapsible list of voters w/ party + bio links
    │   ├── PartyTag.tsx        # small (R)/(D)/other label
    │   ├── SourceLink.tsx      # standardized outbound "official source ↗" link
    │   └── SiteFooter.tsx      # attribution + last-updated
    ├── config/
    │   └── states.ts           # per-state enable/disable + slug config
    ├── lib/
    │   └── types.ts            # shared TypeScript types for the data files
    └── data/
        └── utah/
            ├── meta.json        # session info + lastUpdated timestamps
            ├── legislators.json
            ├── committees.json
            ├── bills.json
            └── vote-events.json # the page's backbone: what/who/when
```

### 3.2 Pages & components

**`/` (Home.tsx)**
- Centered column: `Be Informed` (header), `what's being voted on, when, y whom?` (subheader — keep the "y" exactly as written; it is intentional).
- Below: `<USMap />` filling most of the viewport width (max-width ~900 px).
- Page background: light gray (`#F5F5F7` — Apple's gray; define as Tailwind color `page`). States: **white fill** (`#FFFFFF`) with a light gray stroke (`#D2D2D7`).
- Hover: non-clickable state → fill `#E8E8ED` (gray); clickable state → fill green (`#34C759`-family; pick `#2FB05C` or Tailwind `green-500`, cursor-pointer). Transition ~150 ms.
- Click on enabled state → `navigate('/utah')` (route from `states.ts`).

**`USMap.tsx` + `config/states.ts`**
- Download `Blank_US_Map_(states_only).svg` from Wikimedia Commons (CC0). Inline its `<path>` elements into JSX. Each path's `id` is the state's two-letter code — key off that.
- `states.ts`:
  ```ts
  export const STATES: Record<string, { name: string; slug: string; enabled: boolean }> = {
    UT: { name: "Utah", slug: "utah", enabled: true },
    // all other 49 + DC: enabled: false
  };
  ```
- Component maps over paths, applies classes/handlers from config. Add `aria-label`, `role="link"` and keyboard focusability for enabled states. Tooltip (simple `<title>` element) showing state name.

**`/utah` (StatePage.tsx, route `/:stateSlug`)**
- Resolve slug via `states.ts`; unknown or disabled slug → NotFound.
- Header: "Utah", link back home, a line stating the session context from `meta.json` (e.g., "2027 General Session — live floor calendars").
- Body: list of **vote events** from `vote-events.json`, grouped by date, soonest first:
  - **What:** bill number + short title → `SourceLink` to the official bill page.
  - **When:** date/time + place (floor calendar name, or committee meeting time/room).
  - **Who:** `LegislatorList` — for a committee event, the committee's members; for a floor calendar event, all members of that chamber. Each legislator: small round portrait thumbnail (from `/legislators/<LegID>.jpg`, locally hosted — see §4.4), name, `PartyTag`, link to official bio. Collapsed by default beyond ~8 names ("Show all 75 →") to keep the page clean. **[DECIDED: full collapsed list, with photos.]**
- **Out-of-session state (what renders today): a placeholder, not interim meetings.** When there are no upcoming floor-calendar or committee-agenda vote events, show a calm, factual placeholder: "The Utah Legislature is not currently in session. The 2027 General Session convenes January 19, 2027." with a link to le.utah.gov. **[DECIDED: placeholder only — do not display interim/confirmation committee meetings.]**
- Footer (`SiteFooter`): "Data from the Utah State Legislature — le.utah.gov" + `lastUpdated` from `meta.json`. (Attribution is effectively required by le.utah.gov's terms for any commercial use; include it unconditionally.)

**Design system (Apple-clean):**
- Font stack: `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif` (system fonts — no webfont download; fastest and most native-feeling).
- Colors: page `#F5F5F7`; text near-black `#1D1D1F`; secondary text `#6E6E73`; accent green only for interactive/clickable affordances; party tags muted (e.g., subtle red/blue/gray text, never loud fills — the site must not look partisan).
- Generous spacing (Tailwind `space-y-*`, wide margins), minimal borders, no cards-with-shadows clutter; hairline dividers (`#D2D2D7`).

### 3.3 Data flow

```
GitHub Actions cron ──▶ scripts/fetch-utah.ts ──▶ writes src/data/utah/*.json
        │                                              │ (commit only if changed)
        └── push to main ◀─────────────────────────────┘
                 │
                 ├──▶ Vercel GitHub App auto-builds & deploys (static)
                 └──▶ Lovable two-way sync pulls the commit (harmless)
```

- Data is **imported at build time** (`import billsData from "@/data/utah/bills.json"`) — typed via `lib/types.ts`, no runtime fetch, no CORS concerns, no loading states. The site is fully static; freshness comes from rebuilds on data commits.
- Every data snapshot is versioned in git history for free.

---

## 4. Data sourcing (Utah)

### 4.1 Key finding: no scraping needed — Utah has an official JSON API

The Utah Legislature publishes a semi-documented developer API. **Documentation:** `https://le.utah.gov/data/developer.htm` (note: `https://le.utah.gov/data/` without the page name returns "Request Rejected"). The API is hosted at **`https://glen.le.utah.gov/`** with a token as the **last path segment**.

**Token:** The docs' example page (`https://glen.le.utah.gov/`) embeds the demo token `5678`, which works live. There is no self-serve signup; production tokens come from contacting the Legislature (developer.htm lists phones 801-538-1035 / 801-538-1408). **Build with the token read from env var `UTAH_LEG_TOKEN` (GitHub Actions secret), defaulting to `5678` for local dev — and flag prominently in the README that a real token should be requested.** (See §7 Q2.)

**Endpoints used by this build (all verified live Aug 5 2026):**

| Purpose | Endpoint |
|---|---|
| All legislators (public, **no token**) | `https://le.utah.gov/data/legislators.json` |
| All committees + membership | `https://glen.le.utah.gov/committees/<TOKEN>` |
| All scheduled meetings (committee + floor time) | `https://glen.le.utah.gov/legcal/<TOKEN>` |
| Today's agendas (per meeting: `agencal/<mtgID>/<TOKEN>`) | `https://glen.le.utah.gov/agencal/<TOKEN>` |
| All reading (floor) calendars | `https://glen.le.utah.gov/calendars/<TOKEN>` |
| Session bill list (change-detection via timestamps) | `https://glen.le.utah.gov/bills/2026GS/billlist/<TOKEN>` |
| Bill detail | `https://glen.le.utah.gov/bills/<SESS>/<BILLNUM>/<TOKEN>` e.g. `.../bills/2026GS/HB0060/5678` |

**Response shapes (verified):**
- `billlist`: array of `{ number: "HB0001", trackingID, updatetime, lastActionTime }` — poll cheaply, fetch detail only for changed bills.
- Bill detail top-level keys: `year, sessionID, billNumber, billNumberShort, shortTitle, primeSponsor, primeSponsorName, primeSponsorHouse, floorSponsor, floorSponsorName, generalProvisions, highlightedProvisions, lastAction, lastActionOwner, lastActionDate, trackingID, actionHistoryList, agendaList, recommendingCommitteeList, billVersionList, floorDebateList`.
  - `actionHistoryList[]`: `{ description, owner, actionDate, actionClass, voteID, voiceVote, voteHouse, voteStr }` — e.g. `"House/ passed 3rd reading", voteID: "155", voteStr: "54-17-4"`.
  - `agendaList[]`: `{ mtgID, committeeID, mtgDate, mtgPlace, committeeName, upcomming, agendaURL, minutesURL }` — **the `upcomming` flag (note the misspelling — it is literal in the API) gives future committee hearings per bill.**
- `legcal`: `{ items: [{ committee, link, mtgTime: "2026-08-07T8:30:00.000Z", mtgPlace, mtgID }] }` — includes pre-built official committee links; live interim/confirmation meetings confirmed present in Aug 2026.
- `calendars`: `{ calendars: [...] }` with bills in floor order per reading calendar; **currently returns `{"calendars":[]}` because the Legislature is out of session** — the fetch script must treat empty as normal, not an error.
- `legislators.json` per-legislator fields: `fullName, formatName, id, image, house ("H"/"S"), party, district, serviceStart, profession, counties, email, address, committees[], legislation, demographic, FinanceReport[]` — everything needed, including party. Note the roster currently includes a "Forward" party member, so party handling must not assume R/D only.

**Official rate guidance (quoted from developer.htm):** legislators "no more than once a day"; committees and meeting calendar "no more than three times a day"; reading calendar and bills "no more than once an hour"; "cache your own version when possible"; "Applications found abusing the system may have to be blocked"; data is "experimental… may alter or remove at any time." → Wrap everything behind our own JSON layer (which this architecture does) and stay well inside those rates.

### 4.2 Outbound link construction (every item links to its root source)

| Entity | Official URL pattern (verified) |
|---|---|
| Bill page | `https://le.utah.gov/~<year>/bills/static/<BILLNUM>.html` (bill numbers zero-padded to 4: `HB0001`) |
| Floor vote roll call | `https://le.utah.gov/DynaBill/svotes.jsp?sessionid=<SESS>&voteid=<voteID>&house=<H\|S>` |
| Committee vote | `https://le.utah.gov/mtgvotes.jsp?voteid=<id>` |
| Committee page | comes pre-built in the `legcal` feed (`committee.jsp?year=…&com=…`) |
| House member bio | `https://house.utleg.gov/rep/<LegID>/` (LegID = `id` from legislators.json) |
| Senate member bio | `https://senate.utah.gov/sen/<LegID>/` |
| Session bill index | `https://le.utah.gov/billlist.jsp?session=<SESS>` |

### 4.3 What counts as "being voted on" (definition to implement)

Two event types, both shown and clearly labeled:
1. **Floor vote (upcoming):** a bill appears on a Senate/House reading calendar (`/calendars/`) → "who votes" = every member of that chamber. Time = the chamber's floor time from `/legcal/` (calendars are ordered lists; exact bill-by-bill timing doesn't exist — display "on the House 3rd Reading Calendar for the floor session of <date/time>").
2. **Committee vote (upcoming):** a bill appears on a committee agenda (`agendaList` with `upcomming` true, or via `/agencal/`) → "who votes" = that committee's members from `/committees/`. Time/place = from the agenda/meeting entry.

**Out-of-session behavior (the state of the world right now): [DECIDED — placeholder].** The 2026 General Session ran Jan 20 – Mar 6, 2026 (sine die). Utah's General Session is 45 days from the third Tuesday of January; the 2027 session begins Tuesday, **Jan 19, 2027**. Between sessions, `/calendars/` is empty. `/legcal/` does carry interim committee and confirmation meetings (verified live for Aug 2026), but **the user decided not to display these** — out of session, `vote-events.json` stays empty and the Utah page renders the "next session begins Jan 19, 2027" placeholder (§3.2). The fetcher still calls `/legcal/` (needed for floor times in-session) but derives vote events only from reading calendars and bill `agendaList` entries tied to a general/special session. Special sessions are named `<year>S<n>` (e.g. `2026S1`); the fetch script probes for them (approved heuristic, §7), and a special session's calendars/agendas DO produce vote events even mid-year.

### 4.4 Fetcher design (`scripts/fetch-utah.ts`)

- Plain Node 20 + `tsx`, native `fetch`, no scraping libraries. CLI: `npx tsx scripts/fetch-utah.ts --mode=calendars|roster`.
- **`--mode=roster` (daily):** fetch `legislators.json` (public) + `/committees/` → write `legislators.json` (normalized: `{ id, name, chamber, party, district, bioUrl (constructed per §4.2), imageUrl: "/legislators/<id>.jpg" }`) and `committees.json` (`{ id, name, chamber?, members: [legislatorId], officialUrl }`). **Portraits [DECIDED: photos wanted]:** download each legislator's official portrait from `https://le.utah.gov/images/legislator/<ID>.jpg` into `public/legislators/<ID>.jpg` — only when the local file is missing (plus a `--force-photos` flag for manual refresh). Hosting copies locally avoids hotlinking state servers on every page view; ~104 small JPEGs ≈ a few MB, committed once and rarely changing. Use a broken-image fallback (initials in a gray circle) in `LegislatorList` for any missing file.
- **`--mode=calendars` (every 3 h):** fetch `/calendars/`, `/legcal/`, `/agencal/`; determine current session id (see §7 Q5); fetch `billlist` for it; fetch bill detail **only** for bills that (a) appear on a calendar/agenda and (b) have a newer `updatetime` than our stored copy → write `bills.json` and derive `vote-events.json`:
  ```ts
  type VoteEvent = {
    kind: "floor" | "committee";
    billNumber: string;        // "HB0060"
    billTitle: string;
    billUrl: string;           // official static bill page
    session: string;           // "2026GS"
    when: string | null;       // ISO datetime; null if only calendar-ordered
    whereLabel: string;        // "House 3rd Reading Calendar" | "110 Senate Building"
    body: { type: "chamber" | "committee"; id: string; name: string; officialUrl: string };
    voterIds: string[];        // legislator ids
    sourceUrl: string;         // calendar/agenda official link
  };
  ```
- Always update `meta.json`: `{ lastUpdated, session: { id, label, convenes, adjourned? }, counts }`.
- **Politeness:** sequential requests, ~1 s delay between calls, `User-Agent: humanbeinginformed.com data fetcher (contact: <email>)`. Exit non-zero on hard failure so the workflow shows red; treat empty calendars as success.
- **robots.txt note:** `le.utah.gov/robots.txt` disallows `/asp/` (so never fetch `roster.asp` — we don't need it) and sets `Crawl-delay: 10` for crawlers; the JSON endpoints we use are the officially sanctioned access path.

### 4.5 Refresh workflows

- **`refresh-calendars.yml`:** `schedule: cron: "17 */3 * * *"` (every 3 h at :17 — off-peak minute; GitHub cron is best-effort and often 5–30 min late, occasionally skipped: fine for this data) + `workflow_dispatch`. Steps: checkout → setup-node 20 → `npm ci` → run fetcher `--mode=calendars` → commit `src/data/utah` if changed (`git diff --quiet || git commit … && git push`) using default `GITHUB_TOKEN` with `permissions: contents: write`. ~8 runs/day × ~2 min ≈ 480 min/month.
- **`refresh-roster.yml`:** `cron: "43 9 * * *"` (daily) + `workflow_dispatch`, `--mode=roster`. ≈ 60 min/month. Total ≈ 540 of the 2,000 free minutes.
- **60-day auto-disable caveat:** GitHub disables schedules after 60 days without repo activity; the workflow's own *data commits* reset the timer, but during long quiet periods (nothing changes → no commits) it could lapse. Mitigation: the roster workflow's last step touches a `.github/keepalive` timestamp file OR use `gh-action-keepalive` (`https://github.com/efrecon/gh-action-keepalive`). Include this.
- **Why this composes:** commits made with `GITHUB_TOKEN` don't trigger *other Actions workflows* (recursion guard), but **Vercel deploys via its own GitHub App and deploys these pushes anyway** — this is precisely why Vercel (not Lovable hosting, not an Actions-based deploy) is the hosting choice.
- **[DECIDED: every 3 hours is the cadence, year-round.]** No seasonal switch required. Note in the README that bumping to hourly during the January–March session (`"17 * * * *"`, ≈ 1,440 min/month — still under cap and within the API's "once an hour" guidance) is an optional one-line change if fresher in-session data is ever wanted.

### 4.6 Fallback sources (do not build now — documented for resilience)

The official API is explicitly "experimental… may change without warning." If it breaks:
- **LegiScan** (`https://api.legiscan.com/`, free 30,000 queries/month, register at `https://legiscan.com/legiscan-register`): bills, change hashes, roll calls with per-legislator votes, weekly UT bulk datasets. Best fallback for bills + votes; not a source for real-time reading calendars. Attribution required.
- **OpenStates/Plural** (`https://v3.openstates.org/`, key from `https://open.pluralpolicy.com/accounts/profile/`, free tier ≈ 500 req/day — semi-official figure): bills/people/committees for UT; `/events` coverage for UT unverified. Tertiary/bulk-backfill only.

---

## 5. Build steps (ordered — execute one by one)

> Steps marked **[USER]** require account access Opus doesn't have (Vercel login, DNS, Lovable). Do everything else; finish by writing a `README.md` "Remaining manual steps" checklist for the user.

1. **Init repo.** In `C:\Users\nwtbm\OneDrive\Desktop\Projects\HBI`: `git init -b main`, add remote `https://github.com/carmstrong4130/humanbeinginformed.git`. Move/keep `PLAN.md`, `PLANNING-PROMPT.md`, `Write me the Prompt.txt` (add the latter two to `.gitignore` or a `docs/` folder — user's call; default: commit PLAN.md, gitignore the other two).
2. **Scaffold Vite app** in the repo root (not a subfolder): `npm create vite@latest . -- --template react-ts`, then install Tailwind v3 + PostCSS + autoprefixer, configure `tailwind.config.ts` (content globs, custom colors `page: "#F5F5F7"`, `ink: "#1D1D1F"`, `inksec: "#6E6E73"`, `hairline: "#D2D2D7"`, `stategreen: "#2FB05C"`, `stategray: "#E8E8ED"`), add `@` → `./src` alias in `vite.config.ts` and `tsconfig`. Install `react-router-dom`. Optionally init shadcn/ui (keep unused components out).
3. **Types first:** write `src/lib/types.ts` with `Legislator`, `Committee`, `Bill`, `VoteEvent`, `StateMeta` matching §4.4.
4. **Fetcher:** write `scripts/fetch-utah.ts` per §4.4 (+ `tsx` as devDependency; npm scripts `data:roster`, `data:calendars`). Read token from `process.env.UTAH_LEG_TOKEN ?? "5678"`.
5. **Seed data:** run both modes locally once; commit the generated `src/data/utah/*.json` and the downloaded portraits in `public/legislators/`. Expect real legislators and committees, but an **empty `vote-events.json`** (out of session, and interim meetings are deliberately excluded) — the Utah page must render the next-session placeholder from this seed state.
6. **Map asset:** download `Blank_US_Map_(states_only).svg` from Wikimedia Commons (confirm CC0 on its file page), convert to `USMap.tsx` (paths inlined, keyed by state `id`), write `src/config/states.ts` with all 50 states + DC, only `UT` enabled.
7. **Home page** per §3.2: header, subheader (exact text `what's being voted on, when, y whom?`), map, hover/click behavior, keyboard accessibility.
8. **State page** per §3.2: routing on `/:stateSlug`, event grouping by date, `VoteEventCard`, `LegislatorList` (collapsed >8, with portrait thumbnails + initials fallback), `PartyTag` (handle parties beyond R/D — currently a "Forward" member exists), `SourceLink` on every bill/legislator/committee/meeting, out-of-session placeholder ("The Utah Legislature is not currently in session. The 2027 General Session convenes January 19, 2027.") driven by `meta.json`, `SiteFooter` with le.utah.gov attribution + lastUpdated.
9. **404 page**, favicon (simple green square or map glyph), `<title>`/meta description per page, `robots.txt` allowing all.
10. **Workflows:** write both YAML files per §4.5 (`permissions: contents: write`, `ubuntu-latest`, off-peak minutes, keepalive step, `workflow_dispatch` for manual runs).
11. **README.md:** project overview, how to run dev/fetcher, data source docs + rate-limit rules (§4.1), token instructions, seasonal cron note, and the **manual steps checklist** (steps 13–16 below).
12. **Verify build:** `npm run build` clean; `npm run dev` renders home + `/utah` with the seeded data. Push everything to `main`.
13. **[USER] GitHub secret:** add `UTAH_LEG_TOKEN` once obtained (user will phone the Legislature later; workflows fall back to `5678` until then). Manually trigger both workflows once via `workflow_dispatch` and confirm green.
14. **[USER] Vercel:** the user already has a Vercel account (existing team/scope: `https://vercel.com/the-bird-atlas`, home of an old project). Create a **new project** there by importing the `humanbeinginformed` GitHub repo (framework auto-detect: Vite; output `dist`). Confirm a deploy succeeds on `*.vercel.app`.
15. **[USER] Domain (DNS is at GoDaddy):** in Vercel, add `www.humanbeinginformed.com` and apex `humanbeinginformed.com` (set apex to redirect to `www`). In GoDaddy's DNS manager for the domain: CNAME record `www` → `cname.vercel-dns.com`; A record `@` → `76.76.21.21` (GoDaddy doesn't support ALIAS/ANAME at apex, so the A record is the way; delete GoDaddy's default "Parked" A record and any conflicting `www` CNAME first). Wait for propagation + Vercel SSL issuance.
16. **[USER] Lovable connection (when front-end iteration begins) — [DECIDED: force-push workaround]:** create a throwaway Lovable project → connect GitHub (Lovable creates a new repo) → clone that repo → replace its contents with this code, preserving its `.git` → force-push → Lovable's two-way sync pulls the code in. The Lovable-created repo then becomes canonical: re-point the Vercel project's Git connection to it (and archive the old repo). Keep the code Lovable-compatible at all times (single root `package.json`, Vite, Tailwind, `main` branch).

**SPA routing note for Vercel:** direct hits on `/utah` need a rewrite to `index.html`. Add `vercel.json`:
```json
{ "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }] }
```

---

## 6. Deployment

- **Host:** Vercel — user's existing account (team/scope `https://vercel.com/the-bird-atlas`); create a new project there importing the GitHub repo via the Vercel GitHub App. Every push to `main` — human commits, Lovable-synced commits, and Actions data commits — triggers an automatic production build/deploy. PRs get preview URLs.
- **Build:** `npm run build`, output `dist/`, no server/runtime. `vercel.json` rewrite for SPA routes (above).
- **Domain (registered at GoDaddy; user has DNS access):** `www.humanbeinginformed.com` as primary — GoDaddy CNAME `www` → `cname.vercel-dns.com`; apex 301 → www via A record `@` → `76.76.21.21` (remove GoDaddy's default parked A record / conflicting records first). Automatic SSL from Vercel after propagation.
- **Data freshness path:** Actions cron → JSON commit → Vercel rebuild → live in ~2–3 min after each data change; site shows `lastUpdated` from `meta.json` in the footer.
- **Alternative (documented, not chosen):** Lovable built-in hosting with custom domain (paid plan; A record apex → `185.158.133.1`, `_lovable` TXT verify, manual www entry, remove AAAA records). Rejected because deploys require clicking Publish in Lovable and data commits would not auto-publish.

---

## 7. Decisions & remaining open items

**All 12 planning questions were answered by the user on Aug 5, 2026.** Opus: treat these as settled — do not re-ask.

| # | Question | **Decision** |
|---|---|---|
| 1 | Lovable adoption path | **Force-push workaround** (create throwaway Lovable project → connect GitHub → replace new repo's contents with this code → force-push; Lovable-created repo becomes canonical, re-point Vercel). Build locally into the existing `humanbeinginformed` repo now; the switch happens later, when Lovable iteration begins (step 16). |
| 2 | API token | **Ship on demo token `5678`** via `UTAH_LEG_TOKEN` env var with fallback; user will phone the Legislature later for a real token. |
| 3 | Tailwind version | **v3 default; Opus may use v4 if the scaffold fights it** (note the choice in README). |
| 4 | Refresh cadence | **Every 3 hours, year-round.** Optional hourly in-session bump documented in README only. |
| 5 | Session-id detection | **Approved heuristic:** candidate ids from current date (year+`GS`, prior-year `GS` before late January) + probe `<year>S1`/`S2` via `billlist` (empty/404 = no such session); use the latest non-empty. |
| 6 | Floor-vote "who" | **Full chamber list, collapsed** behind "Show all 75 →". |
| 7 | Out-of-session content | **Placeholder only** — "next session begins Jan 19, 2027" message; do NOT show interim/confirmation meetings. |
| 8 | Commercial status | **No monetization plans.** Non-commercial; keep the attribution footer anyway. |
| 9 | DNS | **GoDaddy; user has DNS access.** Records per §6. |
| 10 | Vercel | **Yes — existing account/scope `vercel.com/the-bird-atlas`** (has an old project); create a **new project** there for this repo. |
| 11 | Bill scope | **Upcoming vote events only** (floor calendars + committee agendas), not all filed bills. |
| 12 | Photos | **Yes, photos wanted.** Portraits downloaded to `public/legislators/` by the roster fetch and served locally (§4.4), with initials fallback. |

**Remaining open items (non-blocking, for the user later):**
- Obtain a real API token by phone (801-538-1035 / 801-538-1408) and add it as the `UTAH_LEG_TOKEN` GitHub secret.
- When starting Lovable iteration: verify Lovable still supports the classic Vite stack for the force-push workaround (its docs show new projects migrating to TanStack Start), and execute the repo switch in step 16.
- If monetization ever appears, revisit le.utah.gov's terms (attribution for commercial use) — and portrait usage.

---

## 8. Future iterations (do NOT build now — but don't design against them)

- **More states:** the architecture is already state-generic (`states.ts` config, `/:stateSlug` route, per-state data folder `src/data/<state>/`, per-state fetch script). Adding a state = enable in config + write its fetcher (OpenStates/LegiScan may make other states easier than bespoke APIs).
- **More granular levels (county, township, town, city):** keep the `VoteEvent.body` concept generic (`chamber | committee` today; could grow `council`, `commission`). Don't hardcode "state" into type names or URLs beyond the existing slug pattern.
- **AI summaries of laws & who benefits:** bill detail JSON already includes `generalProvisions`/`highlightedProvisions` text — store raw text in `bills.json` now? No — keep files small; but keep `trackingID`/session/billNumber so texts can be re-fetched later.
- **Voting histories:** `actionHistoryList` carries `voteID`s; the floor-vote URL pattern (§4.2) resolves per-legislator roll calls. LegiScan's roll-call API is the structured path when this is built.
- **Summaries and dashboards:** the versioned JSON snapshots in git history are already a time-series; don't squash data commits.

---

*Research provenance: all le.utah.gov / glen.le.utah.gov endpoints, response shapes, rate-limit quotes, robots.txt rules, terms language, and URL patterns in §4 were fetched and verified live on Aug 5, 2026. Lovable capabilities cite docs.lovable.dev (FAQ, GitHub integration, custom-domain pages, changelog) as of the same date. Map licensing verified on Wikimedia Commons (`Blank_US_Map_(states_only).svg`, CC0). GitHub Actions limits: 2,000 Linux min/mo free for private repos; scheduled workflows are best-effort and auto-disable after 60 days of repo inactivity.*
