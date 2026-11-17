"use client";

import Image from "next/image";
import { useEffect,useState } from "react";
import { WhatsAppLink } from "@/components/whatsapp-link";

type InventoryItem={id:string;device_code:string;condition_grade:string;battery_health_pct:number|null;stock_quantity:number;selling_price_inr:number|null;quoteRequired:boolean;warranty_days:number|null;city:string|null;device:{storage_gb:number;color:string;model:{name:string;brand:{name:string}}};primaryImage:{image_url:string;alt_text:string}|null};
const inr=new Intl.NumberFormat("en-IN",{style:"currency",currency:"INR",maximumFractionDigits:0});

export function HotDeals() {
  const [items,setItems]=useState<InventoryItem[]>([]);const [loading,setLoading]=useState(true);const [failed,setFailed]=useState(false);
  useEffect(()=>{let active=true;fetch("/api/v1/inventory?limit=12",{cache:"no-store"}).then(async(response)=>{if(!response.ok)throw new Error("Inventory unavailable");const body=await response.json() as {data:InventoryItem[]};if(active)setItems(body.data);}).catch(()=>{if(active)setFailed(true);}).finally(()=>{if(active)setLoading(false);});return()=>{active=false;};},[]);
  return <section className="hot-deals" aria-labelledby="hot-deals-title">
    <div className="hot-deals-heading"><div><p className="eyebrow">LIVE AVAILABILITY</p><h2 id="hot-deals-title">Hot deals</h2><p>Only available, currently listed renewed devices appear here.</p></div><a className="text-link" href="/catalogue">Browse catalogue</a></div>
    {loading?<div className="inventory-empty"><span className="inventory-empty-mark" aria-hidden="true">⌕</span><p>Checking current availability…</p></div>:items.length?<div className="deal-rail" aria-label="Available refurbished phones">{items.map((item)=><a className="deal-card live-deal-card" href={`/buy?device=${item.device_code}`} key={item.id}>
      <div className="deal-photo-frame">{item.primaryImage?<Image src={item.primaryImage.image_url} alt={item.primaryImage.alt_text} fill sizes="(max-width:680px) 78vw, 260px" unoptimized />:<div className="product-photo-fallback"><span aria-hidden="true">▯</span><small>Image unavailable</small></div>}</div>
      <div className="deal-card-copy"><span className="deal-brand">{item.device.model.brand.name} · RENEWED</span><h4>{item.device.model.name}</h4><p>{item.device.storage_gb} GB · {item.device.color} · Grade {item.condition_grade}</p><p className="live-deal-price">{item.selling_price_inr===null?"Price on request":inr.format(item.selling_price_inr)}</p><small>{item.stock_quantity} available{item.warranty_days?` · ${item.warranty_days}-day warranty`:""}</small></div>
    </a>)}</div>:<div className="inventory-empty"><span className="inventory-empty-mark" aria-hidden="true">⌕</span><h3>{failed?"Availability is temporarily unavailable":"No renewed phones are listed right now."}</h3><p>{failed?"Please check again shortly or ask our team for help.":"Current stock will appear here after it has been added and verified."}</p><WhatsAppLink label="Ask about availability" message="Hi REPHON 24X7, can you help me check which renewed phones are currently available?" /></div>}
  </section>;
}
