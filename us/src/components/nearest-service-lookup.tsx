"use client";

import { useEffect, useMemo, useState } from "react";
import { WhatsAppLink } from "@/components/whatsapp-link";

type ServiceCentre = { id: string; name: string; address: string; city: string; state: string; postalCode: string | null; phone: string | null; latitude: number | null; longitude: number | null };
function distanceKm(centre: ServiceCentre, position: { latitude: number; longitude: number }) {
  if (centre.latitude == null || centre.longitude == null) return Number.POSITIVE_INFINITY;
  const radians = Math.PI / 180;
  const a = Math.sin(((centre.latitude-position.latitude)*radians)/2)**2 + Math.cos(position.latitude*radians)*Math.cos(centre.latitude*radians)*Math.sin(((centre.longitude-position.longitude)*radians)/2)**2;
  return 6371*2*Math.asin(Math.sqrt(a));
}

export function NearestServiceLookup() {
  const [query, setQuery] = useState("");
  const [centres, setCentres] = useState<ServiceCentre[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [userPosition, setUserPosition] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locationMessage, setLocationMessage] = useState("");
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    let active = true;
    fetch("/api/service-centres").then((response) => {
      if (!response.ok) throw new Error("Could not load service centres");
      return response.json() as Promise<{ data: ServiceCentre[] }>;
    }).then(({ data }) => {
      if (!active) return;
      setCentres(data);
      setSelectedId(data[0]?.id ?? null);
      setStatus("ready");
    }).catch(() => { if (active) setStatus("error"); });
    return () => { active = false; };
  }, []);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    const matching = !normalized ? centres : centres.filter((centre) => [centre.name, centre.address, centre.city, centre.state, centre.postalCode].filter(Boolean).join(" ").toLocaleLowerCase().includes(normalized));
    if (!userPosition) return matching;
    return [...matching].sort((a,b)=>distanceKm(a,userPosition)-distanceKm(b,userPosition));
  }, [centres, query, userPosition]);
  const selected = filtered.find((centre) => centre.id === selectedId) ?? filtered[0] ?? null;
  const mapUrl = selected?.latitude !== null && selected?.latitude !== undefined && selected?.longitude !== null && selected?.longitude !== undefined
    ? `https://www.openstreetmap.org/export/embed.html?bbox=${selected.longitude - 0.025}%2C${selected.latitude - 0.018}%2C${selected.longitude + 0.025}%2C${selected.latitude + 0.018}&layer=mapnik&marker=${selected.latitude}%2C${selected.longitude}`
    : null;
  const message = query.trim() ? `Hi REPHON 24X7, please help me find a service centre near ${query.trim()}.` : "Hi REPHON 24X7, please share nearby service centre details.";
  const useMyLocation = () => {
    if (!navigator.geolocation) { setLocationMessage("Location access is not available in this browser."); return; }
    setLocationMessage("Finding locations near you…");
    navigator.geolocation.getCurrentPosition((position)=>{const current={latitude:position.coords.latitude,longitude:position.coords.longitude};setUserPosition(current);const nearest=centres.filter((item)=>item.latitude!=null&&item.longitude!=null).sort((a,b)=>distanceKm(a,current)-distanceKm(b,current))[0];if(nearest)setSelectedId(nearest.id);setLocationMessage("Showing locations ordered by distance. Your coordinates stay in this browser.");},()=>setLocationMessage("Location permission was not granted. Search by city or PIN code instead."),{enableHighAccuracy:false,timeout:10000,maximumAge:60000});
  };

  return <main className="brand-page nearest-page">
    <section className="nearest-heading"><p className="eyebrow">IN-PERSON SUPPORT</p><h1>Find a service<br /><span>near you.</span></h1><p>Browse service locations, check the address, and contact a store directly.</p></section>
    <section className="centre-finder" aria-label="Nearby service centres">
      <div className="centre-map">
        {mapUrl ? <iframe title={selected ? `Map showing ${selected.name}` : "Service centre map"} src={mapUrl} loading="lazy" referrerPolicy="no-referrer" /> : <div className="centre-map-empty"><span className="centre-map-pin">⌖</span><strong>{status === "loading" ? "Loading locations" : "Service locations"}</strong><p>{status === "loading" ? "Finding current service centres…" : "A map will appear when a location with coordinates is available."}</p></div>}
        {selected && <a className="map-open-link" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${selected.address}, ${selected.city}, ${selected.state}`)}`} target="_blank" rel="noreferrer">Open map ↗</a>}
      </div>
      <div className="centre-directory">
        <label className="centre-search"><span aria-hidden="true">⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search area, city or PIN code" aria-label="Search service centres" /></label>
        <div className="centre-directory-heading"><div><p className="eyebrow">REPHON 24X7 LOCATIONS</p><h2>{filtered.length} {filtered.length === 1 ? "service centre" : "service centres"}</h2></div><button type="button" className="centre-locate" onClick={useMyLocation}>Use my location</button></div>
        {locationMessage&&<p className="centre-location-note" role="status">{locationMessage}</p>}
        <div className="centre-list" aria-live="polite">
          {status === "loading" && <div className="centre-empty"><strong>Loading service centres</strong><p>One moment while we load the current directory.</p></div>}
          {status === "error" && <div className="centre-empty"><strong>Locations couldn’t load</strong><p>Please contact our team and we’ll help you find the right service point.</p></div>}
          {status === "ready" && filtered.length === 0 && <div className="centre-empty"><strong>{centres.length ? "No matching locations" : "Location details are being added"}</strong><p>{centres.length ? "Try a different area, city, or PIN code." : "Contact the team for current store addresses and availability."}</p><WhatsAppLink className="centre-contact" label="Ask on WhatsApp" message={message} /></div>}
          {filtered.map((centre) => <article className={`centre-card${selected?.id === centre.id ? " is-selected" : ""}`} key={centre.id}>
            <button className="centre-select" type="button" onClick={() => setSelectedId(centre.id)} aria-pressed={selected?.id === centre.id}><span className="centre-card-pin" aria-hidden="true">⌖</span><span><strong>{centre.name}</strong><small>{centre.city}{centre.postalCode ? ` · ${centre.postalCode}` : ""}</small>{userPosition&&Number.isFinite(distanceKm(centre,userPosition))&&<small>{distanceKm(centre,userPosition).toFixed(1)} km away</small>}</span><span className="centre-chevron" aria-hidden="true">⌄</span></button>
            {selected?.id === centre.id && <div className="centre-details"><p>{centre.address}<br />{centre.city}, {centre.state}{centre.postalCode ? ` ${centre.postalCode}` : ""}</p><div>{centre.phone ? <a className="centre-phone" href={`tel:${centre.phone.replace(/[^+\d]/g, "")}`}>Call {centre.phone}</a> : <span className="centre-phone-unavailable">Phone number not listed</span>}<a className="centre-directions" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${centre.address}, ${centre.city}, ${centre.state}`)}`} target="_blank" rel="noreferrer">Directions</a></div></div>}
          </article>)}
        </div>
      </div>
    </section>
    <section className="nearest-bottom-note"><div><p className="eyebrow">NEED HELP CHOOSING?</p><h2>We’ll help you find the right location.</h2></div><WhatsAppLink label="Contact our team" message={message} /></section>
  </main>;
}
