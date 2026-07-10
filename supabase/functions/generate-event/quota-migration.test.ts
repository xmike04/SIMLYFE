import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  `${process.cwd()}/supabase/migrations/20260710000000_secure_generate_event_rate_limits.sql`,
  "utf8",
);

describe("generate-event quota migration", () => {
  it("locks the project singleton before the per-user row", () => {
    const projectLock = migration.indexOf("from private.generate_event_project_quota\n  where singleton = true\n  for update");
    const userLock = migration.indexOf("from private.generate_event_rate_limits\n  where user_key = p_user_key\n  for update");
    expect(projectLock).toBeGreaterThan(-1);
    expect(userLock).toBeGreaterThan(projectLock);
  });

  it("coordinates indexed stale-user pruning at most daily", () => {
    expect(migration).toContain("generate_event_rate_limits_updated_at_idx");
    expect(migration).toContain("if v_last_pruned_at <= v_now - interval '1 day'");
    expect(migration).toContain("where updated_at < v_now - interval '7 days'");
  });

  it("keeps the quota RPC private to the service role", () => {
    expect(migration).toContain("remaining_project_day integer");
    expect(migration).toContain("revoke all on function public.consume_generate_event_quota(text, integer) from public");
    expect(migration).toContain("grant execute on function public.consume_generate_event_quota(text, integer) to service_role");
  });
});
