"use client";

import { useRef, useState } from "react";
import { CustomerAuthGate } from "@/components/customer-auth";

export function DoorstepRequestForm() {
  const [values, setValues] = useState({ fullName: "", mobile: "", address: "", city: "", pinCode: "", preferredDate: "", timeSlot: "", additionalDetails: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [requestCode, setRequestCode] = useState("");
  const idempotencyKey = useRef(crypto.randomUUID());
  const set = (key: keyof typeof values, value: string) => setValues((current) => ({ ...current, [key]: value }));
  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const response = await fetch("/api/v1/doorstep/requests", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...values, idempotencyKey: idempotencyKey.current }) });
      const result = await response.json() as { data?: { requestCode?: string }; error?: string };
      if (!response.ok || !result.data?.requestCode) throw new Error(result.error || "Your request could not be saved.");
      setRequestCode(result.data.requestCode);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Your request could not be saved."); }
    finally { setBusy(false); }
  };
  if (requestCode) return <CustomerAuthGate><section className="doorstep-form-card doorstep-form-success"><span aria-hidden="true">✓</span><p className="eyebrow">Request received</p><h2>We’ll check your area.</h2><p>Your request ID is <strong>{requestCode}</strong>. The visit is requested, not confirmed. Our team will check coverage and contact you.</p></section></CustomerAuthGate>;
  return <CustomerAuthGate><section className="doorstep-form-card" id="request-doorstep">
    <div><p className="eyebrow">REQUEST A VISIT</p><h2>Let’s check doorstep availability.</h2><p>Share your area and a preferred time window. Our team will confirm coverage before scheduling a visit.</p></div>
    <form onSubmit={submit}>
      <label>Your name<input required minLength={2} maxLength={120} autoComplete="name" value={values.fullName} onChange={(e)=>set("fullName",e.target.value)} /></label>
      <label>Mobile number<div className="doorstep-mobile-input"><span>+91</span><input required type="tel" inputMode="numeric" autoComplete="tel-national" maxLength={10} pattern="[0-9]{10}" value={values.mobile} onChange={(e)=>set("mobile",e.target.value.replace(/\D/g,"").slice(0,10))} /></div></label>
      <label className="doorstep-form-wide">Address<input required minLength={6} maxLength={500} autoComplete="street-address" value={values.address} onChange={(e)=>set("address",e.target.value)} /></label>
      <label>City<input required maxLength={120} autoComplete="address-level2" value={values.city} onChange={(e)=>set("city",e.target.value)} /></label>
      <label>PIN code<input required inputMode="numeric" maxLength={6} pattern="[0-9]{6}" autoComplete="postal-code" value={values.pinCode} onChange={(e)=>set("pinCode",e.target.value.replace(/\D/g,"").slice(0,6))} /></label>
      <label>Preferred date<input required type="date" min={new Date().toISOString().slice(0,10)} value={values.preferredDate} onChange={(e)=>set("preferredDate",e.target.value)} /></label>
      <label>Preferred time<select required value={values.timeSlot} onChange={(e)=>set("timeSlot",e.target.value)}><option value="">Choose a window</option><option value="morning">Morning · 9 AM–12 PM</option><option value="afternoon">Afternoon · 12–4 PM</option><option value="evening">Evening · 4–7 PM</option></select></label>
      <label className="doorstep-form-wide">What should our team know? <small>Optional</small><textarea rows={3} maxLength={2000} value={values.additionalDetails} onChange={(e)=>set("additionalDetails",e.target.value)} /></label>
      {error&&<p className="doorstep-form-error" role="alert">{error}</p>}
      <button className="glow-button doorstep-submit" type="submit" disabled={busy}>{busy?"Submitting…":"Request a visit"}</button>
    </form>
    <small className="doorstep-form-privacy">We’ll use your details to check coverage and coordinate this service request.</small>
  </section></CustomerAuthGate>;
}
