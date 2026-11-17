"use client";

import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import { aboutContentDefaults, type AboutContent } from "@/lib/content/about";

type AboutContentResponse = { data?: Partial<AboutContent> };

export function AdminAboutContent() {
  const [value, setValue] = useState<AboutContent>({ ...aboutContentDefaults });
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    void fetch("/api/v1/admin/content/about", { cache: "no-store" })
      .then(async (response) => {
        const result = await response.json() as AboutContentResponse;
        if (active && response.ok && result.data) {
          setValue({ ...aboutContentDefaults, ...result.data });
        } else if (active && !response.ok) {
          setMessage("Could not load the current page copy.");
        }
      })
      .catch(() => { if (active) setMessage("Could not load the current page copy."); });
    return () => { active = false; };
  }, []);

  function field(key: keyof AboutContent, label: string, multiline = false) {
    const common = {
      maxLength: 1200,
      value: value[key],
      onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setValue((current) => ({ ...current, [key]: event.target.value })),
    };
    return <label className="admin-content-field" key={key}>{label}{multiline
      ? <textarea {...common} rows={3} />
      : <input {...common} />}</label>;
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch("/api/v1/admin/content/about", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(value),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "Save failed.");
      setMessage("About page content saved.");
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  return <section className="admin-section">
    <header className="admin-page-heading"><div><span className="admin-eyebrow">WEBSITE CONTENT</span><h1>About page</h1><p>Edit the REPHON 24X7 story and service principles. Copy is shared with the customer-facing page.</p></div></header>
    <form className="admin-content-form" onSubmit={save}>
      {field("lede", "Hero lead")}
      {field("description", "Hero description", true)}
      {field("philosophy", "Philosophy statement")}
      {field("introHeading", "Introduction heading")}
      {field("introParagraph1", "Introduction paragraph one", true)}
      {field("introParagraph2", "Introduction paragraph two", true)}
      {field("promiseHeading", "Promise heading")}
      <fieldset><legend>How we work</legend>{field("promise1", "Principle one", true)}{field("promise2", "Principle two", true)}{field("promise3", "Principle three", true)}</fieldset>
      <div className="admin-form-actions"><button className="admin-button admin-button-primary" disabled={saving}>{saving ? "Saving…" : "Save page content"}</button></div>
      {message && <p role="status" className="admin-feedback">{message}</p>}
    </form>
  </section>;
}
