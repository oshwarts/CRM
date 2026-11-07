Edge function `voice-add-task` (deployed to the project; source kept in the Supabase dashboard / deploy history, and in this file next to it).
Hands-free task creation: a Siri Shortcut (or an Android routine) posts `{ "text": "..." }` with a personal access
token as `Authorization: Bearer <token>`. No Supabase session — only a SHA-256 hash of the token is stored
(`public.personal_access_tokens`), so a leaked token can only create tasks for its one owner.
No human caller and no secrets of its own — `verify_jwt` is off, and it uses the project's own service role key
(already available to every edge function) to look up the token hash and insert the task.

Parses the dictated text the same way the app's "quick add" does (due date, urgency, doctor, hospital) via
`taskParse.ts` — a hand-copied snapshot of `src/lib/taskParse.ts` (edge functions can only import files in their
own folder). If the client-side parser changes, re-copy it here and redeploy.
