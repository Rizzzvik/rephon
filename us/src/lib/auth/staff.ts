import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type StaffRole = "admin" | "super_admin" | "sales_admin" | "repair_admin" | "catalogue_manager" | "inventory_manager" | "location_manager" | "support_agent" | "inspector";

export async function requireStaff(allowed: StaffRole[] = ["admin"], permission?: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) throw new Error("Staff authentication is not configured");
  const cookieStore = await cookies();
  const authClient = createServerClient(url, anonKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (values) => { try { for (const { name, value, options } of values) cookieStore.set(name, value, options); } catch { /* Server component renders cannot persist refreshed cookies. */ } },
    },
  });
  const { data: { user }, error } = await authClient.auth.getUser();
  if (error || !user) throw new Error("Authentication required");
  const { data: role, error: roleError } = await createSupabaseServerClient().from("staff_roles").select("role").eq("user_id", user.id).maybeSingle();
  if (roleError) throw new Error("Staff access could not be verified");
  if (!role) throw new Error("Staff role is not authorised for this action");
  const staffRole = role.role as StaffRole;
  const privileged = staffRole === "admin" || staffRole === "super_admin";
  if (permission && !privileged) {
    const { data: grant, error: permissionError } = await createSupabaseServerClient().from("admin_permissions").select("granted").eq("role", staffRole).eq("permission", permission).maybeSingle();
    if (permissionError) throw new Error("Staff permission could not be verified");
    if (!grant?.granted) throw new Error("Staff role is not authorised for this action");
  } else if (!privileged && !allowed.includes(staffRole)) throw new Error("Staff role is not authorised for this action");
  return { user, role: staffRole };
}
