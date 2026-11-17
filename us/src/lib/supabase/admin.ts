import { createSupabaseServerClient } from "@/lib/supabase/server";

/** Service-role client for server-only Supabase Auth administration. */
export function createSupabaseAdminClient() {
  return createSupabaseServerClient();
}
