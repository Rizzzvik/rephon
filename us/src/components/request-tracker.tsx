"use client";

import { useState } from "react";
import { CustomerAuthGate } from "@/components/customer-auth";

type Tracking = { requestCode: string; type: string; status: string; submittedAt: string; timeline: Array<{ previous_status: string | null; new_status: string; created_at: string }> };

export function RequestTracker() {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<Tracking | null>(null);
  const track = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setBusy(true); setError(""); setResult(null);
    try {
      const response = await fetch(`/api/v1/customer/requests?code=${encodeURIComponent(code)}`, { cache: "no-store" });
      const body = await response.json() as { data?: Tracking; error?: string };
      if (!response.ok || !body.data) throw new Error(body.error || "Request not found.");
      setResult(body.data);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Request tracking is unavailable."); }
    finally { setBusy(false); }
  };
  return <CustomerAuthGate><main className="request-tracker-page"><section className="request-tracker-card"><p className="eyebrow">REQUEST UPDATES</p><h1>Track your request.</h1><p>Sign in with the Google account used for your request, then enter its six-digit ID to view updates.</p><form onSubmit={track}><label>Six-digit request ID<input required inputMode="numeric" maxLength={6} pattern="[0-9]{6}" value={code} onChange={(e)=>setCode(e.target.value.replace(/\D/g,"").slice(0,6))}/></label>{error&&<p className="doorstep-form-error" role="alert">{error}</p>}<button className="glow-button" type="submit" disabled={busy||code.length!==6}>{busy?"Checking…":"Track request"}</button></form>{result&&<section className="request-tracker-result"><div><small>Request ID</small><strong>{result.requestCode}</strong></div><div><small>Request type</small><strong>{result.type}</strong></div><div><small>Current status</small><strong>{result.status.replaceAll("_"," ")}</strong></div><div><small>Submitted</small><strong>{new Date(result.submittedAt).toLocaleDateString("en-IN")}</strong></div><h2>Status timeline</h2><ol>{result.timeline.map((item,index)=><li key={`${item.new_status}-${item.created_at}`}><span aria-hidden="true"/><div><strong>{item.new_status.replaceAll("_"," ")}</strong><small>{new Date(item.created_at).toLocaleString("en-IN")}</small></div>{index===result.timeline.length-1&&<em>Latest</em>}</li>)}</ol></section>}</section></main></CustomerAuthGate>;
}
