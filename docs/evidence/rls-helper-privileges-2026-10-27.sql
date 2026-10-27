-- Bounded production maintenance performed and verified on 2026-10-27 UTC.
-- This is a retained operational statement, not a migration-history claim.
-- Event-trigger handler; keep its postgres owner and ensure_rls trigger.
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable()
  FROM PUBLIC, anon, authenticated, service_role;

-- Verify owner-only ACL and still-enabled trigger:
SELECT p.proacl,
       has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_execute,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated_execute,
       has_function_privilege('service_role', p.oid, 'EXECUTE') AS service_role_execute,
       has_function_privilege('postgres', p.oid, 'EXECUTE') AS postgres_execute,
       EXISTS (SELECT 1 FROM pg_event_trigger t
               WHERE t.evtfoid = p.oid AND t.evtname = 'ensure_rls'
                 AND t.evtenabled = 'O') AS trigger_enabled
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.proname = 'rls_auto_enable';

-- The live verification also created a uniquely named public probe table,
-- asserted relrowsecurity=true, rolled its transaction back, and separately
-- confirmed to_regclass(probe_name) IS NULL. No probe table was left behind.
