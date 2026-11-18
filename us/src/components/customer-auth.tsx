"use client";

import { useEffect, useState } from "react";
import type { AuthChangeEvent, Session } from "@supabase/supabase-js";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

type SupabaseSessionResult = { data: { session: Session | null } };

function googleSignIn(nextPath: string) {
  const client = createSupabaseBrowserClient();
  const next = nextPath.startsWith("/") && !nextPath.startsWith("//") ? nextPath : "/";
  return client.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`, queryParams: { prompt: "select_account" } },
  });
}

function isGoogleUser(user: { app_metadata?: Record<string, unknown>; identities?: Array<{ provider: string }> | null } | null | undefined) {
  return Boolean(user && (user.app_metadata?.provider === "google" || user.identities?.some((identity) => identity.provider === "google")));
}

export function CustomerAuthButton() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    let client: ReturnType<typeof createSupabaseBrowserClient>;
    try {
      client = createSupabaseBrowserClient();
    } catch {
      setError("Google sign-in is temporarily unavailable.");
      return;
    }
    void client.auth.getSession().then(({ data }: SupabaseSessionResult) => setEmail(isGoogleUser(data.session?.user) ? data.session?.user.email ?? "" : ""));
    const { data: listener } = client.auth.onAuthStateChange((_event: AuthChangeEvent, session: Session | null) => setEmail(isGoogleUser(session?.user) ? session?.user.email ?? "" : ""));
    return () => listener.subscription.unsubscribe();
  }, []);
  const start = async () => {
    setBusy(true); setError("");
    try {
      const { error: authError } = await googleSignIn(`${window.location.pathname}${window.location.search}`);
      if (authError) throw authError;
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Google sign-in could not start."); setBusy(false); }
  };
  const signOut = async () => { setBusy(true); await createSupabaseBrowserClient().auth.signOut(); setEmail(""); setBusy(false); };
  return <div className="customer-auth-control">
    {email ? <><span className="customer-auth-email" title={email}>{email}</span><button type="button" className="nav-quick-link customer-auth-button" disabled={busy} onClick={() => void signOut()}>{busy ? "Please wait…" : "Sign out"}</button></> : <button type="button" className="nav-quick-link customer-auth-button" disabled={busy} onClick={() => void start()}>{busy ? "Opening Google…" : "Sign in"}</button>}
    {error && <span className="customer-auth-error" role="alert">{error}</span>}
  </div>;
}

export function CustomerAuthGate({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    let client: ReturnType<typeof createSupabaseBrowserClient>;
    try {
      client = createSupabaseBrowserClient();
    } catch {
      setError("Google sign-in is temporarily unavailable. Please try again later.");
      setReady(true);
      return;
    }
    void client.auth.getSession().then(({ data }: SupabaseSessionResult) => { setSignedIn(isGoogleUser(data.session?.user)); setReady(true); });
    const { data: listener } = client.auth.onAuthStateChange((_event: AuthChangeEvent, session: Session | null) => { setSignedIn(isGoogleUser(session?.user)); setReady(true); });
    return () => listener.subscription.unsubscribe();
  }, []);
  const start = async () => {
    setBusy(true); setError("");
    try {
      const path = `${window.location.pathname}${window.location.search}`;
      const { error: authError } = await googleSignIn(path);
      if (authError) throw authError;
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Google sign-in could not start."); setBusy(false); }
  };
  if (!ready) return <main className="customer-auth-gate"><section><p className="eyebrow">SECURE CUSTOMER ACCESS</p><h1>Checking your sign-in…</h1></section></main>;
  if (signedIn) return <>{children}</>;
  return <main className="customer-auth-gate"><section><p className="eyebrow">SECURE CUSTOMER ACCESS</p><h1>Sign in to continue.</h1><p>Use your Google account before submitting a request. Your contact details stay attached to your account so you can follow up with our team.</p><button className="glow-button" type="button" disabled={busy} onClick={() => void start()}>{busy ? "Opening Google…" : "Continue with Google"}</button>{error && <p className="customer-auth-error" role="alert">{error}</p>}</section></main>;
}
