# QA rubric — one screen, 100 points

A score is **earned by evidence**, never claimed. Every line below needs a verdict `PASS` / `FAIL` / `N/A` (N/A needs a one-line reason that the
manager can check) and, for PASS, what you did to prove it. **100 = every applicable line PASS and no known defect left**, including the polish
a demanding user would notice. "I read the code and it looks fine" is not evidence for anything that can be run.

## A. Renders and states (20)
1. (4) Seeded data renders correctly; every number / date / label on the screen matches the seed (check at least 5 values by hand).
2. (4) Empty state (`?empty=1`): a useful message and the right action, no `undefined`, `NaN`, `Invalid Date`, `[object Object]`, no crash.
3. (3) Loading state (`?slow=1`): spinner / skeleton, no layout jump, no flash of the empty state.
4. (3) Error state: a failed read with cached data keeps showing the data; a failed read with no data shows the error state (not a blank page).
5. (3) Long and awkward content: 80-character names, Hebrew+English mixed, numbers with signs (`+2.5`), emoji — nothing overflows or overlaps, RTL/LTR mixed text reads correctly.
6. (3) **Zero** console errors/warnings from the app (React key warnings, act warnings, unhandled rejections) through all the steps below.

## B. Phone, desktop, themes (15)
7. (5) 390×844 phone: no horizontal scroll, nothing clipped under the bottom tab bar / sticky headers, tap targets ≥ 40 px, the first useful content visible without scrolling past three screens of chrome.
8. (3) 768 and 1280 widths: sensible layout, no giant empty areas, tables scroll inside their card.
9. (3) Dark mode: every text / icon / border readable, no white boxes, charts and chips legible.
10. (2) Large text (`ami.size=large`) and compact: nothing breaks.
11. (2) Keyboard on a phone: inputs use the right `inputMode` / `type` / `autoComplete`, the focused field is not hidden by the sticky save bar.

## C. Interactions and forms (20)
12. (6) **Every** button, link, tab, chip, select, toggle on the screen was clicked and does what its label says (list them).
13. (4) Forms: required-field validation with a clear Hebrew message at the field, no silent failure, Enter / Escape behave, a second click on Save does not double-submit.
14. (5) The payload of every save/delete is correct — read it from `__qa.requests` (right table, right columns, ids, nulls vs empty strings, dates as `yyyy-mm-dd`, no field forgotten, no extra field).
15. (3) Navigation: back button / links go where they should, deep link to an item works, unknown id shows a "not found", the page title is right.
16. (2) Destructive actions ask first and say what will be lost.

## D. Roles and permissions (10)
17. (5) `role=agent`, `role=admin`, `role=developer`: each sees exactly what they should (admin-only controls hidden for agents, nothing agent-only hidden from admins). Cross-check against the RLS policies in the database (`pg_policies`) — the UI must not offer what the database refuses, and must not hide what the database allows.
18. (3) A write refused by the server (`__qa.failWrites('permission denied')`) gives a clear message and leaves the screen consistent (no phantom row).
19. (2) No patient data / sensitive data appears where it should not (lists, search, exports, copied text).

## E. Data correctness (15)
20. (8) Every computation on the screen is verified with real numbers: counts, sums, percentages, "days ago / in N days", overdue logic, sort order, filter combinations (including clearing all filters), pagination. Write a unit test (`src/__tests__/*.test.ts`, vitest, plain Node) for any non-trivial pure logic and run `npm test`.
21. (4) Dates and time zones: the local day, not UTC (`todayISO()` from `lib/utils`; never `toISOString().slice(0,10)`); weeks start on Sunday; a date-only string is never passed to `new Date()` without care.
22. (3) Hebrew handling: search ignores niqqud/prefix letters as the rest of the app does (`normalizeHe`), sort uses the `he` locale.

## F. Offline and resilience (5)
23. (3) Offline (`?offline=1` / `__qa.setOnline(false)`): the screen still shows data, writes that the outbox supports queue and show the pending mark, the others fail with the offline message — nothing hangs.
24. (2) Double-tap / rapid clicks, a slow network (`slow=1`) and a refresh in the middle of a form do not corrupt anything.

## G. Accessibility (5)
25. (5) Every control has an accessible name, labels are tied to fields, focus is visible and its order is logical, dialogs trap focus and close on Escape, headings are in order, contrast is sufficient (check the amber/red/grey text), `aria-pressed` / `aria-expanded` where it applies.

## H. Code and security (5)
26. (2) `npx tsc --noEmit`, `npx eslint <your files>` (0 errors, no new warnings) and `npm test` pass for your files.
27. (2) No XSS (`dangerouslySetInnerHTML`, `href` from user text without a scheme check), no secret/credential/PII logged, no unhandled promise, no leak (listeners/timers cleaned).
28. (1) Dead code, duplicated logic and misleading comments in your files are cleaned up.

---

## Report format (keep it under 400 words)
```
SCREEN: <name>   SCORE: <n>/100
A 1..6 : PASS/FAIL ... (one line each, with the evidence in a few words)
...
FIXED: <file:line — what was wrong — what you changed>   (every fix)
OPEN: <anything not at 100, with the exact reason and what is needed>
NEED-FROM-MANAGER: <schema/migration/shared-file/other-screen changes you could not make>
```
Be honest: the manager re-checks claims by running the screen. A FAIL you fixed is a PASS only if you re-ran the proof after the fix.
