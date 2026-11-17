"use client";

import { useState } from "react";
import { createBrowserClient } from "@supabase/ssr";

export function AdminLogin() {
  const [email,setEmail]=useState(""); const [password,setPassword]=useState(""); const [error,setError]=useState(""); const [busy,setBusy]=useState(false);
  const submit=async(event:React.FormEvent<HTMLFormElement>)=>{
    event.preventDefault();setBusy(true);setError("");
    try {
      const url=process.env.NEXT_PUBLIC_SUPABASE_URL; const key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      if(!url||!key)throw new Error("Staff login has not been configured for this deployment.");
      const client=createBrowserClient(url,key); const {error:authError}=await client.auth.signInWithPassword({email,password});
      if(authError)throw authError; const next=new URLSearchParams(window.location.search).get("next")||"/admin/imports"; window.location.assign(next.startsWith("/")&&!next.startsWith("//")?next:"/admin/imports");
    } catch(cause){setError(cause instanceof Error?cause.message:"Unable to sign in.");} finally{setBusy(false);}
  };
  return <main className="admin-login-page"><form className="admin-login-card" onSubmit={submit}><p className="eyebrow">REPHON 24X7 STAFF</p><h1>Sign in</h1><p>Use your Supabase staff account to access controlled business data.</p><label>Email<input type="email" autoComplete="username" required value={email} onChange={(event)=>setEmail(event.target.value)} /></label><label>Password<input type="password" autoComplete="current-password" required value={password} onChange={(event)=>setPassword(event.target.value)} /></label>{error&&<p className="admin-error" role="alert">{error}</p>}<button className="glow-button" disabled={busy}>{busy?"Signing in…":"Continue"}</button></form></main>;
}
