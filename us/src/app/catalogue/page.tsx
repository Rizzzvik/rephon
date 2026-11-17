"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { WhatsAppLink } from "@/components/whatsapp-link";

type Category={key:string;label:string;title:string;description:string;dataType:"smartphone"|"tablet"|"laptop";hint:string};
const categories:Category[]=[
  {key:"phone",label:"Phone",title:"Find a phone that fits.",description:"Browse verified devices with live stock and confirmed details.",dataType:"smartphone",hint:"Verified phone listings"},
  {key:"tablet",label:"Tablet",title:"Room for bigger ideas.",description:"Browse verified tablets when current stock is available.",dataType:"tablet",hint:"Verified tablet listings"},
  {key:"laptop",label:"Laptop",title:"Ready for what’s next.",description:"Browse verified laptop listings when they are added to the catalogue.",dataType:"laptop",hint:"Verified laptop listings"},
];
type Item={id:string;device_code:string;condition_grade:string;battery_health_pct:number|null;stock_quantity:number;selling_price_inr:number;warranty_days:number|null;device:{storage_gb:number;color:string;model:{name:string;brand:{name:string}}};primaryImage:{image_url:string;alt_text:string}|null};
const inr=new Intl.NumberFormat("en-IN",{style:"currency",currency:"INR",maximumFractionDigits:0});

export default function CataloguePage(){
  const railRef=useRef<HTMLDivElement>(null);const resultRef=useRef<HTMLElement>(null);const[active,setActive]=useState(0);const[showSelection,setShowSelection]=useState(false);const[items,setItems]=useState<Item[]>([]);const[loading,setLoading]=useState(false);const[failed,setFailed]=useState(false);
  const moveTo=(index:number)=>{const next=Math.max(0,Math.min(categories.length-1,index));setActive(next);railRef.current?.scrollTo({left:next*(railRef.current.clientWidth||1),behavior:"smooth"});};
  useEffect(()=>{const key=window.location.hash.slice(1);const index=categories.findIndex((item)=>item.key===key);if(index>=0)requestAnimationFrame(()=>moveTo(index));},[]);
  useEffect(()=>{if(!showSelection)return;let current=true;setLoading(true);setFailed(false);fetch(`/api/v1/inventory?category=${categories[active].dataType}&limit=24`,{cache:"no-store"}).then(async(response)=>{if(!response.ok)throw new Error("Listings unavailable");const body=await response.json() as {data:Item[]};if(current)setItems(body.data);}).catch(()=>{if(current){setItems([]);setFailed(true);}}).finally(()=>{if(current)setLoading(false);});return()=>{current=false;};},[active,showSelection]);
  const category=categories[active];
  return <main><section className="catalogue-hero">
    <p className="eyebrow">VERIFIED LISTINGS · LIVE AVAILABILITY</p><h1>What are you<br/><span>looking for?</span></h1><p className="hero-copy">Choose a category to see current verified stock.</p>
    <div className="category-picker"><button className="picker-arrow" type="button" aria-label="Previous category" onClick={()=>moveTo(active-1)}>‹</button><div className="picker-window" ref={railRef} onScroll={(event)=>{const width=event.currentTarget.clientWidth;if(width)setActive(Math.round(event.currentTarget.scrollLeft/width));}}>{categories.map((item,index)=><article className="picker-slide" key={item.key}><div className="catalogue-category-art"><span>{String(index+1).padStart(2,"0")}</span><small>REPHON 24X7 · {item.label.toUpperCase()}</small></div><div><small>{item.hint}</small><h2>{item.label}</h2><p>{item.title} {item.description}</p></div></article>)}</div><button className="picker-arrow" type="button" aria-label="Next category" onClick={()=>moveTo(active+1)}>›</button></div>
    <div className="picker-dots" aria-label={`Category ${active+1} of 3`}>{categories.map((item,index)=><button key={item.key} type="button" aria-label={`Choose ${item.label}`} className={index===active?"active":""} onClick={()=>moveTo(index)}/>)}</div><button className="hero-cta" type="button" onClick={()=>{setShowSelection(true);requestAnimationFrame(()=>resultRef.current?.scrollIntoView({behavior:"smooth",block:"center"}));}}>Browse {category.label}</button><div className="catalogue-actions"><WhatsAppLink/></div><p className="swipe-hint">Swipe or use the controls to explore categories.</p>
  </section>
  {showSelection&&<section className="selection-result" ref={resultRef}><div className="selection-result-heading"><div><p className="eyebrow">{category.label.toUpperCase()} LISTINGS</p><h2>{failed?"Listings are temporarily unavailable":loading?"Checking current stock":items.length?`Available ${category.label.toLowerCase()}s`:`No verified ${category.label.toLowerCase()} listings yet`}</h2></div>{!loading&&!failed&&items.length>0&&<span>{items.length} available</span>}</div>
    {items.length>0&&!loading&&!failed?<div className="live-inventory-grid">{items.map((item)=><article className="live-inventory-card" key={item.id}><div className="live-inventory-image">{item.primaryImage?<Image src={item.primaryImage.image_url} alt={item.primaryImage.alt_text} fill sizes="(max-width:700px) 85vw, 280px" unoptimized/>:<div className="product-photo-fallback"><span aria-hidden="true">▯</span><small>Image unavailable</small></div>}</div><div className="live-inventory-copy"><span className="deal-brand">{item.device.model.brand.name} · RENEWED</span><h3>{item.device.model.name}</h3><p>{item.device.storage_gb} GB · {item.device.color} · Grade {item.condition_grade}</p>{item.battery_health_pct!==null&&<small>Battery health {item.battery_health_pct}%</small>}<strong>{inr.format(item.selling_price_inr)}</strong><a href="/buy" className="text-link">Enquire about this device</a></div></article>)}</div>:<div className="catalogue-empty"><p>{failed?"Please check back shortly, or ask our team to confirm availability.":loading?"Loading current, verified listings…":"This category has no active inventory at the moment. New listings will appear here once they are verified."}</p><WhatsAppLink label="Ask our team"/></div>}
  </section>}
  </main>;
}
