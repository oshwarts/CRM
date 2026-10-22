# QA harness

The real app (`<App/>`) in a browser tab with a **fake signed-in user, seeded data and a fake network**. It is served by the dev
server only (`/qa.html`) and is not part of the production build.

```
http://localhost:<port>/qa.html?path=/doctors&role=admin
```

| parameter | meaning |
|---|---|
| `path=/x` | the screen to open (the app uses an in-memory router, so use the in-app links to navigate afterwards) |
| `role=admin` (default) / `agent` / `developer` | who is "signed in" (manager / sales agent / the developer account) |
| `empty=1` | every seeded **list** is empty — the "new system" state |
| `offline=1` | `navigator.onLine` is false from the start |
| `slow=1` | every network call takes 0.9 s (loading states) |

Theme / size are the normal app settings: `localStorage.setItem('ami.theme','dark'|'light')`, `localStorage.setItem('ami.size','compact'|'large')`, then reload.

## The fake network (`window.__qa`)
* **Reads of the database fail** like a dropped connection, so the **seeded data stays** on the screen. A query that nobody seeded shows its error / empty state — seed it.
* **Writes are recorded and answered with success.** `__qa.requests` is the list of `{method, path, body, headers}`: assert the payload.
  `__qa.requests.filter(r => r.method === 'POST' && r.path.includes('/meeting_tasks'))`
* Answer a call yourself: `__qa.handlers['POST /rest/v1/rpc/learn_submit_attempt'] = () => [{ o_score: 8, o_total: 10 }]`;
  an answered read: `__qa.handlers['GET /rest/v1/doctors'] = () => [...]`.
* `__qa.failWrites('some message')` makes every write fail (error paths); `__qa.failWrites(null)` heals. `__qa.setOnline(false|true)` goes offline/online
  with the window events (outbox, banner). `__qa.reset()` clears the recorded requests.
* **Loading / error states with no data:** `__qa.hangReads(true)` then `await __qa.resetQuery(['meetings'])` → the screen's LOADING state; `hangReads(false)` + `resetQuery` → the ERROR state (the failing network, no cached data).
* Storage (`/storage/v1`), functions (`/functions/v1`) and rpc answer success with empty bodies.

## Data
Base data: `src/qa/seed.ts` (hospitals h1-h3, doctors d1-d4, tasks, meetings, scans, agents u-me / u-agent …) and its factories (`mkDoctor`, `mkTask`, `mkMeeting`, `mkScan`, `mkHospital`, `d(n)` for dates).
**A page adds its own data in `src/qa/pages/<page>.seed.ts`** (loaded automatically) with `seed(['query-key', …], value)`. Find the query keys and the shape the page
expects in `src/lib/*.ts` (`useQuery({ queryKey: [...] })` and the `select(...)` string). In `?empty=1` a seeded **list** becomes `[]`.

## Not possible here
Real sign-in / password flows, real Supabase data, e-mail, OCR. For database behaviour (RLS, functions) use the Supabase MCP `execute_sql`
on project `ajgmbytiuidjeiaklxdc` **inside `begin; … rollback;`** only (never leave data changed).

See `RUBRIC.md` for how a page is scored.

## Shell extras
* Every tab has its own IndexedDB / BroadcastChannel (`isolate.ts`): the outbox of one tab never shows in another. A reload of the same tab keeps it.
* The outbox drains in the harness (the fake account is signed in). Reads the executors need: `__qa.handlers['GET /rest/v1/meeting_tasks'] = () => [...]`.
* `?shell=1` adds the shell data (`pages/shell.seed.ts`): waiting sign-ups, test users, contacts, a customised menu layout. `&as=test|real` (role=developer) = acting as another user.
