import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function getCustomerSession() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;
  const cookieStore = await cookies();
  const authClient = createServerClient(url, anonKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (values) => { try { for (const { name, value, options } of values) cookieStore.set(name, value, options); } catch { /* Cookie updates are persisted by the browser auth flow. */ } },
    },
  });
  const { data: { user }, error } = await authClient.auth.getUser();
  const isGoogle = user?.app_metadata?.provider === "google" || user?.identities?.some((identity) => identity.provider === "google");
  if (error || !user?.email || !user.email_confirmed_at || !isGoogle) return null;
  return user;
}

