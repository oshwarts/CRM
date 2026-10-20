# Brief for a per-screen QA agent

You own the QA of **one screen** of AMI JR CRM (a Hebrew / RTL web app for a medical-device sales team: doctors, hospitals, meetings, tasks,
MAKO scans, equipment, projects, agent management, learning; React + Vite + TypeScript + Tailwind + TanStack Query + Supabase; deployed on Vercel).
The manager (the session that started you) will not accept anything below **100/100 by the rubric** — and "100" means the screen is a genuinely
excellent product for the user: a sales agent on an iPhone in a hospital corridor with bad reception, and a manager at a desk.

## Read first (in this order, quickly)
1. `src/qa/README.md` — the QA harness (fake user, seeded data, fake network, `__qa.smoke`, recorded requests).
2. `src/qa/RUBRIC.md` — the 28 lines you are scored on and the report format.
3. Your screen's files (listed in your prompt) and the hooks they use (`src/lib/api.ts`, `src/lib/*Api.ts`, `src/lib/utils.ts`, `src/lib/types.ts`).

## How to work
* Dev server is already running (the URL is in your prompt). **Do not start/stop servers, do not run `npm run build` / `vite build` into `dist`.**
* Browser: load the tools with ToolSearch (`select:mcp__Claude_Browser__tabs_create,mcp__Claude_Browser__navigate,mcp__Claude_Browser__javascript_tool,mcp__Claude_Browser__computer,mcp__Claude_Browser__read_page,mcp__Claude_Browser__find,mcp__Claude_Browser__resize_window,mcp__Claude_Browser__read_console_messages,mcp__Claude_Browser__get_page_text`).
  **Open your own tab with `tabs_create` and always pass your `tabId`; close it when you finish.** Other agents are using other tabs at the same time. Set the viewport per tab
  (`resize_window` 390×844 / 768×1024 / 1280×800; `colorScheme: dark|light`). Screenshots of a background tab can time out — then use `read_page`, `get_page_text`, `javascript_tool` (and `tabs_select` briefly if you must look).
* The harness page is `/qa.html?path=<your path>&role=admin|agent|developer[&empty=1][&offline=1][&slow=1]`. In the page: `await __qa.smoke([...paths])` for objective measurements.
* **Seed your screen's data** in `src/qa/pages/<yourscreen>.seed.ts` (see README) — an unseeded screen only shows its error/empty state. Seed rich data: normal, boundary and awkward values.
  Find the query keys and shapes in the hooks. Keep the seed file small, typed enough to compile (`as never` is fine), and in the repo (it is part of the deliverable).
* Test **every state, every control, three roles, phone/desktop, light/dark**. Run `__qa.smoke`. Read the recorded requests after each save. Try to break it: empty strings, very long text, double clicks, Escape, back button, offline.
* For pure logic write a vitest test in `src/__tests__/<name>.test.ts` (plain Node environment, no DOM) and run `npx vitest run`.
* Database facts: Supabase MCP (`mcp__328eccd4-…__execute_sql`, project `ajgmbytiuidjeiaklxdc`) is **read-only for you**: any experiment goes inside `begin; … rollback;`. Check the RLS policies (`pg_policies`) of the tables your screen writes.
  **Never** change data, run migrations, deploy functions, or push. If a fix needs a migration, put it in NEED-FROM-MANAGER with the exact SQL.
* Never type real credentials anywhere. No external services. The harness has no real data — nothing you do touches production.

## Editing rules (several agents edit this repo at the same time!)
* Fix what you find — do not only report. Match the surrounding code style, comment density and Hebrew wording (short, plain Hebrew for the UI).
* **Your files** = the ones in your prompt: edit freely (small, surgical `Edit`s — never rewrite a whole file with `Write` unless it is yours alone and you just re-read it).
* **Shared files** (`src/components/ui.tsx`, `Layout.tsx`, `src/lib/api.ts`, `types.ts`, `utils.ts`, `database.types.ts`, `index.css`, `theme.css`, other screens' components): only surgical `Edit`s of the exact lines you need, re-read the region right before editing, and list each one in your report under FIXED with `[shared]`. Never reformat or reorder them. For a larger change to a shared file → NEED-FROM-MANAGER.
* Do not touch another screen's page file. If you find a defect there, put it under NEED-FROM-MANAGER (screen, file:line, repro).
* **Do not run git commands that change anything** (no commit, add, checkout, stash, reset). The manager commits.
* Other agents' half-finished edits can make `tsc`/the page temporarily fail: re-run once before blaming yourself; judge only your own files (`npx tsc --noEmit 2>&1 | grep -E "<your files>"`, `npx eslint <your files>`).
* Do not bump the version string and do not create migrations (the manager does).

## What "done" looks like
Every applicable rubric line PASS with evidence, zero open defects, `tsc`/`eslint`/`vitest` clean for your files, your seed file committed to the working tree,
and a report in the format of `RUBRIC.md` (< 400 words). If you cannot reach 100, say precisely why and what is needed. Be honest — the manager re-runs your screen.
