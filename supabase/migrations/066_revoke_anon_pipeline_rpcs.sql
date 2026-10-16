-- The two stage-management functions check is_admin() inside, so a visitor who is not signed in could never change anything,
-- but they were still callable without signing in (a default of CREATE FUNCTION). Only signed-in users may call them.
revoke all on function public.delete_pipeline_stage(uuid, text) from public, anon;
revoke all on function public.rename_pipeline_stage(uuid, text) from public, anon;
grant execute on function public.delete_pipeline_stage(uuid, text) to authenticated;
grant execute on function public.rename_pipeline_stage(uuid, text) to authenticated;
