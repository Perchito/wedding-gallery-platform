-- The security advisor flagged handle_new_user() as callable directly via
-- RPC (/rest/v1/rpc/handle_new_user) by anon/authenticated since it's
-- SECURITY DEFINER. It only needs to run as the auth.users insert trigger,
-- so revoke direct execute access from public-facing roles.
revoke execute on function public.handle_new_user() from anon, authenticated, public;
