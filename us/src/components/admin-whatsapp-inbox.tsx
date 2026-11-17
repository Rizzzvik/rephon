"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Message = { id: string; direction: string; message_type: string; message_text: string | null; delivery_status: string; created_at: string };
type Contact = { phone_e164: string; display_name: string | null; customer_id: string | null };
type Conversation = { id: string; conversation_key: string; status: string; last_message_at: string | null; service_request_id: string | null; contact: Contact | Contact[]; messages: Message[] };

export function AdminWhatsAppInbox() {
  const [rows, setRows] = useState<Conversation[]>([]);
  const [selected, setSelected] = useState("");
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/v1/admin/whatsapp", { cache: "no-store" });
      const body = await response.json() as { data?: Conversation[]; error?: string };
      if (!response.ok) throw new Error(body.error || "Could not load conversations.");
      setRows(body.data ?? []);
      if (!selected && body.data?.[0]) setSelected(body.data[0].id);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not load conversations."); }
    finally { setLoading(false); }
  }, [selected]);

  useEffect(() => { void load(); const timer = setInterval(() => void load(), 15000); return () => clearInterval(timer); }, [load]);
  useEffect(() => { bottom.current?.scrollIntoView({ behavior: "smooth" }); }, [selected, rows]);
  const active = rows.find((row) => row.id === selected);
  const contact = active ? Array.isArray(active.contact) ? active.contact[0] : active.contact : null;

  async function send(event: React.FormEvent) {
    event.preventDefault(); if (!active || !text.trim()) return;
    setSending(true); setError("");
    try {
      const response = await fetch("/api/v1/admin/whatsapp", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ conversationId: active.id, text }) });
      const body = await response.json() as { error?: string };
      if (!response.ok) throw new Error(body.error || "Message could not be sent.");
      setText(""); await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Message could not be sent."); }
    finally { setSending(false); }
  }

  return <section className="admin-section">
    <header className="admin-page-heading"><div><span className="admin-eyebrow">CUSTOMER CONVERSATIONS</span><h1>WhatsApp inbox</h1><p>Incoming messages and service requests share the same operations workspace.</p></div></header>
    {error && <p className="admin-alert" role="alert">{error}</p>}
    <div className="admin-inbox">
      {loading ? <p className="admin-empty">Loading conversations…</p> : <aside className="admin-inbox-list">{rows.map((row) => {
        const person = Array.isArray(row.contact) ? row.contact[0] : row.contact;
        const last = row.messages.at(-1);
        return <button key={row.id} className={selected === row.id ? "active" : ""} onClick={() => setSelected(row.id)}><strong>{person?.display_name || person?.phone_e164 || "WhatsApp contact"}</strong><small>{person?.phone_e164} · {row.status.replaceAll("_", " ")}</small><span>{last?.message_text || "No text preview"}</span><time>{row.last_message_at ? new Date(row.last_message_at).toLocaleString("en-IN") : ""}</time></button>;
      })}{rows.length === 0 && <p className="admin-empty">No WhatsApp conversations yet. Incoming chats appear here after the Meta webhook is configured.</p>}</aside>}
      {active && <div className="admin-chat"><header><div><strong>{contact?.display_name || "WhatsApp customer"}</strong><small>{contact?.phone_e164}{active.service_request_id ? " · linked request" : ""}</small></div><span className={`admin-status ${active.status === "handoff" ? "pending" : "active"}`}>{active.status.replaceAll("_", " ")}</span></header>
        <div className="admin-chat-messages">{active.messages.map((message) => <article key={message.id} className={message.direction}><p>{message.message_text || `[${message.message_type} message]`}</p><small>{new Date(message.created_at).toLocaleString("en-IN")} · {message.delivery_status}</small></article>)}<div ref={bottom} /></div>
        <form onSubmit={send}><textarea rows={2} maxLength={4000} value={text} onChange={(event) => setText(event.target.value)} placeholder="Reply to this customer…" /><button className="admin-button admin-button-primary" disabled={sending || !text.trim()}>{sending ? "Sending…" : "Send reply"}</button></form>
        <p>Free-form replies are available during the active customer service window. Outside it, use an approved template configured in Meta.</p>
      </div>}
    </div>
  </section>;
}
