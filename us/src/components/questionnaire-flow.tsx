"use client";

import { ChangeEvent, useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { BODY_CONDITIONS, SCREEN_CONDITIONS } from "@/lib/questionnaires/condition-options";
import { whatsAppHref } from "@/components/whatsapp-link";
import { CustomerAuthGate } from "@/components/customer-auth";

type Journey = "buy" | "sell" | "repair";
type FilePreview = { id: string; name: string; type: string; url: string; file: File };
type ChoiceAnswer = { id: string; label: string };
type Answer = string | ChoiceAnswer | ChoiceAnswer[] | FilePreview[] | undefined;
type Field = {
  id: string;
  label: string;
  type: "single" | "multi" | "search" | "text" | "tel" | "textarea" | "file";
  options?: string[];
  required?: boolean;
  hint?: string;
  placeholder?: string;
  when?: [string, string];
  accept?: string;
  visual?: "screen" | "body";
};
type Screen = { id: string; group: string; title: string; description?: string; fields: Field[]; special?: "review" };
type CatalogueBrand = { id: string; slug: string; name: string; brand_code?: string };
type CatalogueModel = { id: string; brand_id: string; model_code: string | null; name: string; slug: string; release_year: number | null; launch_date?: string | null; device_type: string };
type CatalogueVariant = { id: string; model_id: string; device_code: string | null; variant_code: string | null; ram_gb: number | null; storage_gb: number; color: string; region: string | null };
type DeviceDetail = { deviceCode?: string; ramGb?: number | null; storageGb?: number; colour?: string; model: { id: string; modelCode?: string; name: string; releaseYear: number | null; launchDate?: string | null; brand: { name: string; brand_code?: string } }; primaryImage?: { url: string; alt_text: string } | null; images?: Array<{ url: string; alt_text: string }>; specifications: Array<{ key: string; name: string; values: Array<{ key: string; label: string; value: string }> }> };
type ModelDetail = { id: string; name: string; releaseYear: number | null; launchDate?: string | null; brand: { name: string; brand_code?: string }; specifications: DeviceDetail["specifications"]; images?: Array<{ url?: string; image_url?: string; alt_text: string }> };
type PricePreview = { amountInr: number | null; quoteRequired: boolean; reason?: string; note?: string; kind?: string; referencePrices?: Array<{label:string;amountInr:number}> };

const buyConditions = ["Like new", "Very good"];
const issueChoices = ["Display / Screen", "Battery", "Charging", "Camera", "Speaker / Microphone", "Motherboard", "Back Panel / Body", "Buttons", "Network / SIM", "Software", "Water Damage", "Other"];
const symptomChoices: Record<string, string[]> = {
  "Display / Screen": ["Minor display issue", "Cracked glass", "Lines or black spots", "Touch not working", "Screen completely black"],
  Battery: ["Drains quickly", "Phone switches off unexpectedly", "Heats up", "Battery swollen", "Not charging"],
  Charging: ["Not charging", "Slow charging", "Intermittent charging", "Charging port damaged"],
  Camera: ["Front camera issue", "Rear camera issue", "Blurry images", "Camera not opening", "Camera lens damaged"],
  "Speaker / Microphone": ["Speaker not working", "Microphone not working", "Earpiece issue", "Distorted sound"],
  Motherboard: ["Phone does not switch on", "Stuck on logo", "Restarts repeatedly", "Suspected motherboard problem", "Not sure"],
  "Back Panel / Body": ["Cracked back panel", "Damaged frame", "Broken buttons", "Other body damage"],
  Buttons: ["Power button", "Volume button", "Other button"],
  "Network / SIM": ["SIM not detected", "No network signal", "Network disconnects", "Mobile data issue"],
  Software: ["Stuck on boot logo", "Frequent restarting", "Slow performance", "Software update issue", "Applications crashing"],
  "Water Damage": ["Recently exposed to water", "Previously exposed to water", "Not working after exposure", "Not sure"],
};
const functionOptions = ["F1 · Fully functional", "F2 · Minor issues", "F3 · Major issues", "F4 · Not functional", "F5 · Not sure"];
const batteryOptions = ["BAT1 · Excellent", "BAT2 · Good", "BAT3 · Poor", "BAT4 · Swollen", "BAT5 · Unknown"];

const deviceFields = (useColour = false, journey: Journey = "buy"): Field[] => [
  { id: "brand", label: journey === "buy" ? "Which brand do you want?" : "Which brand is your phone?", type: "search", options: [], required: true, placeholder: "Search brands" },
  { id: "model", label: "Which model?", type: "search", options: [], required: true, placeholder: "Search models" },
  { id: "variant", label: "RAM and storage", type: "search", options: [], placeholder: "Search variants" },
  ...(useColour ? [{ id: "colour", label: "Preferred colour", type: "single" as const, options: ["No preference"] }] : []),
];

const contactFields = (service: "buy" | "sell" | "repair"): Field[] => [
  ...(service !== "buy" ? [{
    id: "servicePreference",
    label: service === "sell" ? "How would you like to sell your phone?" : "How would you like to get your phone repaired?",
    type: "single" as const,
    options: service === "sell" ? ["Home pickup", "Store visit", "Contact me first"] : ["Home pickup", "Visit the store", "Drop off at a service partner", "Contact me first"],
    required: true,
  }] : []),
  { id: "fullName", label: "Your name", type: "text", required: true, placeholder: "Name" },
  { id: "mobile", label: "Mobile number", type: "tel", required: true, placeholder: "10-digit mobile number" },
  { id: "pinCode", label: "PIN code", type: "text", required: true, placeholder: "6-digit PIN code" },
  { id: "address", label: "Pickup address", type: "text", required: true, when: ["servicePreference", "Home pickup"], placeholder: "Street and area" },
  ...(service === "repair" ? [{ id: "appointmentDate", label: "Preferred appointment date (optional)", type: "text" as const, placeholder: "DD / MM / YYYY" }] : []),
];

function makeScreens(journey: Journey, selectedIssues: string[] = []): Screen[] {
  if (journey === "buy") return [
    ...deviceFields(true, "buy").map((field) => ({ id: field.id, group: "Phone", title: field.label, description: field.hint, fields: [field] })),
    ...[
      { id: "condition", label: "What condition do you prefer?", type: "single" as const, options: buyConditions, required: true },
      { id: "batteryHealth", label: "What battery health do you prefer?", type: "single" as const, options: ["95% and above", "90% and above", "85% and above", "80% and above", "No preference"], required: true },
      { id: "warranty", label: "Do you require a warranty?", type: "single" as const, options: ["Yes", "Preferred", "No preference"], required: true },
      { id: "priorities", label: "What matters most to you?", type: "multi" as const, options: ["Camera", "Battery", "Performance", "Display", "Gaming", "Storage"], hint: "Choose up to two." },
    ].map((field) => ({ id: field.id, group: "Preferences", title: field.label, description: field.hint, fields: [field] })),
    { id: "additional", group: "Additional Details", title: "Anything else about the phone you want?", description: "Optional. Add a detail that the choices did not cover.", fields: [{ id: "additionalDetails", label: "Additional Details", type: "textarea", placeholder: "Any specific requirements..." }] },
    { id: "contact", group: "Contact", title: "Where can we reach you?", fields: contactFields("buy") },
    { id: "review", group: "Review", title: "Review your preferences", fields: [], special: "review" },
  ];

  if (journey === "sell") return [
    ...deviceFields(false, "sell").filter((field) => field.id !== "colour").map((field) => ({ id: field.id, group: "Phone", title: field.label, fields: [field] })),
    { id: "age", group: "Phone", title: "How old is the phone?", fields: [{ id: "age", label: "Phone age", type: "single", options: ["Under 6 months", "6–12 months", "1–2 years", "2–3 years", "Above 3 years", "Not sure"], required: true }] },
    { id: "screen", group: "Condition", title: "How is your phone’s screen?", description: "Select the closest match.", fields: [{ id: "screenCode", label: "Screen condition", type: "single", options: SCREEN_CONDITIONS.map((item) => item.code + " · " + item.label), required: true, visual: "screen" }] },
    { id: "body", group: "Condition", title: "How is your phone’s body?", fields: [{ id: "bodyCode", label: "Body condition", type: "single", options: BODY_CONDITIONS.map((item) => item.code + " · " + item.label), required: true, visual: "body" }] },
    { id: "function", group: "Function", title: "Is your phone fully functional?", fields: [{ id: "functional", label: "Functionality", type: "single", options: functionOptions, required: true }] },
    { id: "battery", group: "Function", title: "How is the battery?", fields: [{ id: "batteryStatus", label: "Battery condition", type: "single", options: batteryOptions, required: true }] },
    { id: "issues", group: "Function", title: "Has your phone had any of these issues?", description: "Select any that apply.", fields: [{ id: "otherIssues", label: "Other issues", type: "multi", options: ["Camera problem", "Speaker or microphone problem", "Charging problem", "Network or SIM problem", "Fingerprint or Face ID problem", "Heating or performance issue", "No other problems", "Not sure"] }] },
    { id: "repairHistory", group: "History", title: "Has your phone ever been repaired?", fields: [{ id: "repairHistory", label: "Repair history", type: "single", options: ["Never repaired", "Screen replaced", "Battery replaced", "Other parts replaced", "Multiple repairs", "Not sure"] }] },
    { id: "water", group: "History", title: "Has your phone experienced water damage?", fields: [{ id: "waterExposure", label: "Water damage", type: "single", options: ["Yes", "No", "Not sure"] }] },
    { id: "billBox", group: "History", title: "Do you have the original bill and box?", fields: [{ id: "billBox", label: "Bill and box", type: "single", options: ["Both available", "Only bill", "Only box", "Neither available"] }] },
    { id: "additional", group: "Additional Details", title: "Anything else about your device?", description: "Optional. You can also add photos of the front, back or damaged areas.", fields: [{ id: "additionalDetails", label: "Additional Details", type: "textarea", placeholder: "Mention any damage or detail we have not asked about..." }, { id: "photos", label: "Optional photos", type: "file", accept: "image/jpeg,image/png,image/webp,image/heic", hint: "Photos are securely attached to your request." }] },
    { id: "contact", group: "Contact", title: "How should we contact you?", fields: contactFields("sell") },
    { id: "review", group: "Review", title: "Review your device details", fields: [], special: "review" },
  ];

  const selected = selectedIssues;
  return [
    ...deviceFields(false, "repair").filter((field) => field.id !== "colour").map((field) => ({ id: field.id, group: "Device", title: field.label, fields: [field] })),
    { id: "powersOn", group: "Device", title: "Does your phone switch on?", fields: [{ id: "powersOn", label: "Phone power", type: "single", options: ["Yes", "No", "Sometimes"], required: true }] },
    { id: "repairIssues", group: "Problem", title: "What problem are you facing?", description: "Choose all that apply.", fields: [{ id: "issues", label: "Repair issues", type: "multi", options: issueChoices, required: true }] },
    ...selected.filter((issue) => issue !== "Other").map((issue) => ({ id: "symptom-" + issue, group: "Symptoms", title: "What happens with " + issue.toLowerCase() + "?", fields: [{ id: "symptoms-" + issue, label: issue + " symptoms", type: "multi" as const, options: symptomChoices[issue] || [] }] })),
    { id: "additional", group: "Additional Details", title: "Anything else about the problem?", description: "Optional. Include when it started or a detail that may help the technician.", fields: [{ id: "additionalDetails", label: "Additional Details", type: "textarea", placeholder: "Anything else the technician should know..." }, { id: "media", label: "Optional photos or video", type: "file", accept: "image/jpeg,image/png,image/webp,image/heic,video/mp4,video/quicktime", hint: "Media is securely attached to your request." }] },
    { id: "contact", group: "Contact", title: "Choose how to get your phone repaired", fields: contactFields("repair") },
    { id: "review", group: "Review", title: "Review your repair request", fields: [], special: "review" },
  ];
}

const hi: Record<string, string> = {
  "Which brand do you want?": "आप कौन-सा ब्रांड चाहते हैं?", "Which model?": "कौन-सा मॉडल चाहिए?", "RAM and storage": "रैम और स्टोरेज", "Preferred colour": "पसंदीदा रंग",
  "What is your budget?": "आपका बजट क्या है?", "What condition do you prefer?": "आपको कौन-सी स्थिति पसंद है?", "What battery health do you prefer?": "आप बैटरी की कितनी सेहत चाहते हैं?", "Do you require a warranty?": "क्या आपको वारंटी चाहिए?", "What matters most to you?": "आपके लिए सबसे ज़रूरी क्या है?",
  "Anything else about the phone you want?": "आपके पसंदीदा फ़ोन के बारे में कुछ और?", "Where can we reach you?": "हम आपसे कहाँ संपर्क कर सकते हैं?", "Review your preferences": "अपनी पसंद की जाँच करें",
  "How old is the phone?": "फ़ोन कितना पुराना है?", "How is your phone’s screen?": "आपके फ़ोन की स्क्रीन कैसी है?", "How is your phone’s body?": "फ़ोन की बाहरी स्थिति कैसी है?", "Is your phone fully functional?": "क्या आपका फ़ोन पूरी तरह काम करता है?", "How is the battery?": "बैटरी कैसी है?", "Has your phone had any of these issues?": "क्या फ़ोन में इनमें से कोई समस्या आई है?", "Has your phone ever been repaired?": "क्या फ़ोन की कभी मरम्मत हुई है?", "Has your phone experienced water damage?": "क्या फ़ोन को पानी से नुकसान हुआ है?", "Do you have the original bill and box?": "क्या आपके पास असली बिल और बॉक्स है?", "Anything else about your device?": "आपके डिवाइस के बारे में कुछ और?", "How should we contact you?": "हम आपसे कैसे संपर्क करें?", "Review your device details": "अपने डिवाइस की जानकारी जाँचें",
  "Does your phone switch on?": "क्या आपका फ़ोन चालू होता है?", "What problem are you facing?": "आपको क्या समस्या आ रही है?", "Anything else about the problem?": "समस्या के बारे में कुछ और?", "Choose how to get your phone repaired": "आप फ़ोन की मरम्मत कैसे करवाना चाहेंगे?", "Review your repair request": "मरम्मत अनुरोध की जाँच करें",
  "Apple": "ऐप्पल", "Samsung": "सैमसंग", "OnePlus": "वनप्लस", "Xiaomi": "शाओमी", "Redmi": "रेडमी", "POCO": "पोको", "Vivo": "वीवो", "OPPO": "ओप्पो", "Realme": "रियलमी", "Motorola": "मोटोरोला", "Google": "गूगल", "Nothing": "नथिंग", "iQOO": "आईक्यू", "Other / not listed": "अन्य / सूची में नहीं",
  "Like new": "नए जैसा", "Very good": "बहुत अच्छी स्थिति", "No preference": "कोई पसंद नहीं", "Yes": "हाँ", "No": "नहीं", "Not sure": "पता नहीं", "Preferred": "पसंदीदा",
  "Perfect": "बिल्कुल सही", "Minor Scratches": "हल्की खरोंचें", "Noticeable Scratches": "दिखने वाली खरोंचें", "Cracked Glass": "काँच टूटा हुआ", "Display Defects": "स्क्रीन में लाइन या धब्बे", "Touchscreen issue": "टचस्क्रीन में समस्या", "Display not working": "स्क्रीन काम नहीं कर रही", "Unknown": "पता नहीं",
  "Like New": "नए जैसा", "Minor Wear": "हल्का इस्तेमाल", "Noticeable Wear": "दिखने वाला इस्तेमाल", "Dents": "डेंट या कोने टूटे हुए", "Back Panel Damage": "पीछे का पैनल टूटा", "Frame Damage": "फ्रेम मुड़ा या टूटा", "Severe Damage": "ज़्यादा नुकसान",
  "Fully functional": "पूरी तरह काम करता है", "Minor issues": "छोटी समस्याएँ", "Major issues": "बड़ी समस्याएँ", "Not functional": "काम नहीं करता", "Excellent": "बहुत अच्छी", "Good": "अच्छी", "Poor": "कमज़ोर", "Swollen": "बैटरी फूल गई है", "Battery not charging": "बैटरी चार्ज नहीं होती",
  "Home pickup": "घर से पिकअप", "Store visit": "स्टोर पर आएँ", "Visit the store": "स्टोर पर आएँ", "Contact me first": "पहले मुझसे संपर्क करें", "Drop off at a service partner": "सर्विस पार्टनर के यहाँ जमा करें",
  "Back": "वापस", "Continue": "आगे", "Review": "जाँच", "Listen": "सुनें", "English": "अंग्रेज़ी", "Hindi": "हिन्दी",
};

Object.assign(hi, {
  "Which brand is your phone?": "आपके फ़ोन का ब्रांड क्या है?", "Question": "प्रश्न", "Buy a phone": "फ़ोन खरीदें", "Sell your phone": "फ़ोन बेचें", "Repair a phone": "फ़ोन की मरम्मत",
  "Camera": "कैमरा", "Battery": "बैटरी", "Performance": "परफ़ॉर्मेंस", "Display": "डिस्प्ले", "Gaming": "गेमिंग", "Storage": "स्टोरेज", "Battery life": "बैटरी लाइफ़",
  "Under 6 months": "6 महीने से कम", "6–12 months": "6–12 महीने", "1–2 years": "1–2 साल", "2–3 years": "2–3 साल", "Above 3 years": "3 साल से अधिक", "Minor scratches": "हल्की खरोंचें", "Noticeable scratches": "दिखने वाली खरोंचें", "Cracked glass": "काँच टूटा हुआ", "Lines, spots or display defects": "लाइन, धब्बे या डिस्प्ले की समस्या", "Touchscreen not working": "टचस्क्रीन काम नहीं करती", "Display completely not working": "डिस्प्ले बिल्कुल काम नहीं करता", "Dents or damaged corners": "डेंट या कोने टूटे हुए", "Bent frame or severe damage": "फ्रेम मुड़ा या ज़्यादा नुकसान",
  "F1 · Fully functional": "F1 · पूरी तरह काम करता है", "F2 · Minor issues": "F2 · छोटी समस्याएँ", "F3 · Major issues": "F3 · बड़ी समस्याएँ", "F4 · Not functional": "F4 · काम नहीं करता", "F5 · Not sure": "F5 · पता नहीं", "BAT1 · Excellent": "BAT1 · बहुत अच्छी", "BAT2 · Good": "BAT2 · अच्छी", "BAT3 · Poor": "BAT3 · कमज़ोर", "BAT4 · Swollen": "BAT4 · बैटरी फूल गई है", "BAT5 · Unknown": "BAT5 · पता नहीं",
  "Display / Screen": "डिस्प्ले / स्क्रीन", "Charging": "चार्जिंग", "Speaker / Microphone": "स्पीकर / माइक्रोफ़ोन", "Motherboard": "मदरबोर्ड", "Back Panel / Body": "पीछे का पैनल / बॉडी", "Buttons": "बटन", "Network / SIM": "नेटवर्क / सिम", "Software": "सॉफ़्टवेयर", "Water Damage": "पानी से नुकसान", "Other": "अन्य",
  "Minor display issue": "डिस्प्ले की छोटी समस्या", "Lines or black spots": "लाइन या काले धब्बे", "Touch not working": "टच काम नहीं करता", "Screen completely black": "स्क्रीन पूरी काली है", "Drains quickly": "बैटरी जल्दी खत्म होती है", "Phone switches off unexpectedly": "फ़ोन अचानक बंद होता है", "Heats up": "फ़ोन गर्म होता है", "Battery swollen": "बैटरी फूल गई है", "Not charging": "चार्ज नहीं होता", "Slow charging": "धीमी चार्जिंग", "Intermittent charging": "कभी चार्ज, कभी नहीं", "Charging port damaged": "चार्जिंग पोर्ट खराब है", "Front camera issue": "फ़्रंट कैमरा समस्या", "Rear camera issue": "रियर कैमरा समस्या", "Blurry images": "धुंधली तस्वीरें", "Camera not opening": "कैमरा खुलता नहीं", "Camera lens damaged": "कैमरा लेंस खराब है", "Phone does not switch on": "फ़ोन चालू नहीं होता", "Stuck on logo": "लोगो पर अटकता है", "Restarts repeatedly": "बार-बार रीस्टार्ट होता है", "Suspected motherboard problem": "मदरबोर्ड की समस्या हो सकती है",
  "Home pickup": "घर से पिकअप", "Store visit": "स्टोर पर आएँ", "Visit the store": "स्टोर पर आएँ", "Contact me first": "पहले मुझसे संपर्क करें", "Drop off at a service partner": "सर्विस पार्टनर के यहाँ जमा करें",
  "Find a renewed phone that suits you.": "अपने लिए सही रिन्यूड फ़ोन चुनें।", "Tell us about your phone in a few quick choices.": "कुछ आसान विकल्प चुनकर अपने फ़ोन के बारे में बताएँ।", "Tell us what is wrong and how you would like service.": "समस्या बताएँ और सेवा का तरीका चुनें।", "Choose an answer before continuing.": "आगे बढ़ने से पहले एक विकल्प चुनें।", "Choose up to two priorities.": "दो तक प्राथमिकताएँ चुनें।", "Enter a 10-digit mobile number.": "10 अंकों का मोबाइल नंबर डालें।", "Enter a 6-digit PIN code.": "6 अंकों का पिन कोड डालें।", "Your name": "आपका नाम", "Mobile number": "मोबाइल नंबर", "PIN code": "पिन कोड", "Pickup address": "पिकअप का पता", "Add photos": "तस्वीरें जोड़ें", "Remove": "हटाएँ",
});

function slug(value: string) { return value.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); }
function optionId(fieldId: string, label: string) {
  const code = label.match(/^(S\d|B\d|BAT\d|F\d)/)?.[0];
  return code ? fieldId + ":" + code.toLowerCase() : fieldId + ":" + slug(label);
}
function isChoice(value: Answer): value is ChoiceAnswer { return !!value && typeof value === "object" && !Array.isArray(value) && "id" in value && "label" in value; }
function choiceLabel(value: Answer) {
  if (isChoice(value)) return value.label;
  if (Array.isArray(value)) return (value as ChoiceAnswer[]).map((item) => item.label).join(", ");
  return typeof value === "string" ? value : "";
}
function translate(value: string, language: "en" | "hi") { return language === "hi" ? hi[value] || value : value; }

export function QuestionnaireFlow({ journey }: { journey: Journey }) {
  const [data, setData] = useState<Record<string, Answer>>({});
  const [step, setStep] = useState(0);
  const [language, setLanguage] = useState<"en" | "hi">("en");
  const [speechMessage, setSpeechMessage] = useState("");
  const [error, setError] = useState("");
  const [reference, setReference] = useState("");
  const [submissionQuote, setSubmissionQuote] = useState<{indicativeOfferInr:number|null;quoteRequired:boolean;repairPrices:Array<{issueCode:string;priceInr:number;warrantyDays:number|null}>}|null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [uploadNotice, setUploadNotice] = useState("");
  const idempotencyKey = useRef<string | null>(null);
  const [catalogueBrands, setCatalogueBrands] = useState<CatalogueBrand[]>([]);
  const [catalogueModels, setCatalogueModels] = useState<CatalogueModel[]>([]);
  const [catalogueVariants, setCatalogueVariants] = useState<CatalogueVariant[]>([]);
  const [catalogueLoaded, setCatalogueLoaded] = useState(false);
  const [catalogueLoading, setCatalogueLoading] = useState(false);
  const [modelSearch, setModelSearch] = useState("");
  const [deviceDetail, setDeviceDetail] = useState<DeviceDetail | null>(null);
  const [deviceDetailLoading, setDeviceDetailLoading] = useState(false);
  const [showAllSpecs, setShowAllSpecs] = useState(false);
  const [pricePreview, setPricePreview] = useState<PricePreview | null>(null);
  const [pricePreviewLoading, setPricePreviewLoading] = useState(false);
  const selectedIssues = Array.isArray(data.issues) ? (data.issues as ChoiceAnswer[]).map((item) => item.label) : [];
  const screens = makeScreens(journey, selectedIssues);
  const current = screens[Math.min(step, screens.length - 1)];
  const currentFields = current.fields.filter((field) => !field.when || choiceLabel(data[field.when[0]]) === field.when[1]);
  useEffect(() => {
    if(current.special!=="review")return;
    const controller=new AbortController();setPricePreview(null);setPricePreviewLoading(true);
    const answers=Object.fromEntries(Object.entries(data).filter(([key])=>["model","variant","condition","screenCode","bodyCode","functional","batteryStatus","issues","city"].includes(key)));
    void fetch("/api/v1/pricing/preview",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({journey,answers}),signal:controller.signal}).then(async(response)=>{const result=await response.json() as {data?:PricePreview};if(!response.ok)throw new Error("Price preview unavailable");setPricePreview(result.data??{quoteRequired:true,amountInr:null});}).catch((error:unknown)=>{if(!(error instanceof DOMException&&error.name==="AbortError"))setPricePreview({quoteRequired:true,amountInr:null,reason:"We’ll confirm the price with you."});}).finally(()=>{if(!controller.signal.aborted)setPricePreviewLoading(false);});
    return()=>controller.abort();
  },[current.special,journey,data]);
  const selectedBrand = choiceLabel(data.brand);
  const modelName = choiceLabel(data.model);
  const selectedBrandId = isChoice(data.brand) ? data.brand.id : "";
  const selectedModelId = isChoice(data.model) ? data.model.id : "";
  const matchingRows = catalogueVariants;
  const brandOptions = [...catalogueBrands, { id: "other", slug: "other", name: "Other / not listed" }];
  const modelChoiceLabel = (model: CatalogueModel) => `${model.name}${model.model_code ? ` · ${model.model_code}` : ""}`;
  const modelChoices = catalogueModels.map(modelChoiceLabel);
  const setValue = (field: string, value: Answer) => setData((previous) => ({ ...previous, [field]: value }));

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/v1/brands", { cache: "no-store" }).then(async (response) => {
      if (!response.ok) throw new Error("Device brands unavailable.");
      const body = await response.json() as { data?: CatalogueBrand[] };
      if (!cancelled) setCatalogueBrands(body.data ?? []);
    }).catch(() => {
      if (!cancelled) setCatalogueBrands([]);
    }).finally(() => { if (!cancelled) setCatalogueLoaded(true); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!selectedBrandId || !/^[0-9a-f-]{36}$/i.test(selectedBrandId)) {
      setCatalogueModels([]); setCatalogueVariants([]); setDeviceDetail(null); return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setCatalogueLoading(true);
      const params = new URLSearchParams({ service: journey, limit: "50" });
      if (modelSearch.trim()) params.set("q", modelSearch.trim());
      void fetch(`/api/v1/brands/${selectedBrandId}/models?${params}`, { cache: "no-store", signal: controller.signal }).then(async (response) => {
        if (!response.ok) throw new Error("Models unavailable.");
        const body = await response.json() as { data?: CatalogueModel[] };
        setCatalogueModels(body.data ?? []);
      }).catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === "AbortError")) setCatalogueModels([]);
      }).finally(() => setCatalogueLoading(false));
    }, 180);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [selectedBrandId, modelSearch, journey]);

  useEffect(() => {
    if (!selectedModelId || !/^[0-9a-f-]{36}$/i.test(selectedModelId)) { setCatalogueVariants([]); return; }
    const controller = new AbortController();
    void fetch(`/api/v1/models/${selectedModelId}/variants?service=${journey}`, { cache: "no-store", signal: controller.signal }).then(async (response) => {
      if (!response.ok) throw new Error("Device variants unavailable.");
      const body = await response.json() as { data?: CatalogueVariant[] };
      setCatalogueVariants(body.data ?? []);
    }).catch((error: unknown) => {
      if (!(error instanceof DOMException && error.name === "AbortError")) setCatalogueVariants([]);
    });
    return () => controller.abort();
  }, [selectedModelId, journey]);

  useEffect(() => {
    const selected = isChoice(data.variant) ? data.variant : null;
    const code = selected && /^\d{7}$/.test(selected.id) ? selected.id : "";
    const modelId = selectedModelId;
    if (!code && !modelId) { setDeviceDetail(null); return; }
    const controller = new AbortController();
    setDeviceDetailLoading(true);
    const url = code ? `/api/v1/devices/${code}` : `/api/v1/models/${modelId}/specifications`;
    void fetch(url, { cache: "no-store", signal: controller.signal }).then(async (response) => {
      if (!response.ok) throw new Error("Device details unavailable.");
      const body = await response.json() as { data?: DeviceDetail | ModelDetail };
      const detail = body.data;
      if (!detail) { setDeviceDetail(null); return; }
      const normalized: DeviceDetail = "model" in detail ? detail : {
        model: { id: detail.id, name: detail.name, releaseYear: detail.releaseYear ?? null, launchDate: detail.launchDate, brand: detail.brand },
        primaryImage: detail.images?.[0] ? { url: detail.images[0].url || detail.images[0].image_url || "", alt_text: detail.images[0].alt_text } : null,
        images: detail.images?.map((image) => ({ url: image.url || image.image_url || "", alt_text: image.alt_text })) ?? [],
        specifications: detail.specifications,
      };
      setDeviceDetail(normalized);
    }).catch((error: unknown) => {
      if (!(error instanceof DOMException && error.name === "AbortError")) setDeviceDetail(null);
    }).finally(() => setDeviceDetailLoading(false));
    return () => controller.abort();
  }, [selectedModelId, data.variant]);
  const setChoice = (field: Field, label: string) => {
    const id = field.id === "brand" ? catalogueBrands.find((brand) => brand.name === label)?.id ?? optionId(field.id, label)
      : field.id === "model" ? catalogueModels.find((model) => modelChoiceLabel(model) === label)?.id ?? optionId(field.id, label)
      : field.id === "variant" ? catalogueVariants.find((variant) => `${variant.ram_gb ? `${variant.ram_gb} GB RAM · ` : ""}${variant.storage_gb} GB · ${variant.color}` === label)?.device_code ?? (label === "Not sure" ? "unknown" : optionId(field.id, label))
      : optionId(field.id, label);
    setData((previous) => {
      const existing = previous[field.id];
      const unchanged = isChoice(existing) && existing.id === id;
      const next: Record<string, Answer> = { ...previous, [field.id]: { id, label } };
      if (!unchanged && field.id === "brand") { delete next.model; delete next.variant; delete next.colour; }
      if (!unchanged && field.id === "model") { delete next.variant; delete next.colour; }
      return next;
    });
  };
  const toggleChoice = (field: Field, label: string) => {
    const old = Array.isArray(data[field.id]) ? data[field.id] as ChoiceAnswer[] : [];
    const id = optionId(field.id, label);
    if (field.id === "priorities" && !old.some((item) => item.id === id) && old.length >= 2) {
      setError("Choose up to two priorities.");
      return;
    }
    if (field.id === "issues") {
      const currentlySelected = old.some((item) => item.id === id);
      setData((previous) => {
        const updated = currentlySelected ? old.filter((item) => item.id !== id) : [...old, { id, label }];
        const next: Record<string, Answer> = { ...previous, issues: updated };
        if (currentlySelected) {
          const clone = { ...next };
          Object.keys(clone).filter((key) => key.startsWith("symptoms-" + label + ":")).forEach((key) => delete clone[key]);
          return clone;
        }
        return next;
      });
    } else {
      setValue(field.id, old.some((item) => item.id === id) ? old.filter((item) => item.id !== id) : [...old, { id, label }]);
    }
    setError("");
  };
  const optionsFor = (field: Field) => {
    if (field.id === "brand") return brandOptions.map((brand) => brand.name);
    if (field.id === "model") return [...modelChoices,"Other / not listed"];
    if (field.id === "variant" && matchingRows.length) return ["Not sure", ...new Set(matchingRows.map((row) => `${row.ram_gb ? `${row.ram_gb} GB RAM · ` : ""}${row.storage_gb} GB · ${row.color}`))];
    if (field.id === "colour" && matchingRows.length) return [...new Set(matchingRows.map((row) => row.color)), "No preference"];
    if (field.id === "colour") return ["No preference"];
    if (field.id === "variant") return ["Not sure"];
    if (field.id === "servicePreference" && journey === "sell" && choiceLabel(data.batteryStatus).startsWith("BAT4")) return ["Store visit", "Contact me first"];
    return field.options || [];
  };
  const requiredComplete = currentFields.filter((field) => field.required).every((field) => {
    const answer = data[field.id];
    if (field.type === "multi") return Array.isArray(answer) && answer.length > 0;
    if (field.type === "search") return isChoice(answer) && optionsFor(field).includes(answer.label) || field.id === "model" && typeof answer === "string" && answer.trim().length > 0;
    if (field.type === "single") return isChoice(answer) && optionsFor(field).includes(answer.label);
    return typeof answer === "string" ? answer.trim().length > 0 : isChoice(answer);
  });
  const next = async () => {
    setError("");
    if (!requiredComplete) { setError("Choose an answer before continuing."); return; }
    if (current.id === "contact") {
      if (!/^[0-9]{10}$/.test(choiceLabel(data.mobile))) { setError("Enter a 10-digit mobile number."); return; }
      if (!/^[0-9]{6}$/.test(choiceLabel(data.pinCode))) { setError("Enter a 6-digit PIN code."); return; }
    }
    if (step < screens.length - 1) {
      setStep((value) => value + 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };
  const speak = () => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) { setSpeechMessage("Speech playback is not available in this browser."); return; }
    window.speechSynthesis.cancel();
    const question = translate(current.title, language);
    const choices = currentFields.flatMap((field) => optionsFor(field).map((item) => translate(item.replace(/^(S|B|BAT|F)\d+ · /, ""), language)));
    const details = [question, current.description ? translate(current.description, language) : "", ...choices].filter(Boolean).join(". ");
    const utterance = new SpeechSynthesisUtterance(details);
    utterance.lang = language === "hi" ? "hi-IN" : "en-IN";
    utterance.onstart = () => setSpeechMessage(language === "hi" ? "हिन्दी में पढ़ा जा रहा है" : "Reading in English");
    utterance.onend = () => setSpeechMessage("");
    utterance.onerror = () => setSpeechMessage(language === "hi" ? "आवाज़ उपलब्ध नहीं है" : "Voice playback could not start.");
    window.speechSynthesis.speak(utterance);
  };
  const submit = async () => {
    if (submitting) return;
    setSubmitting(true); setError(""); setUploadNotice("");
    if (!idempotencyKey.current) idempotencyKey.current = crypto.randomUUID();
    try {
      const answerData = Object.fromEntries(Object.entries(data).filter(([key]) => !["photos","media"].includes(key)));
      const uploads = ["photos","media"].flatMap((key) => Array.isArray(data[key]) ? (data[key] as FilePreview[]).map((file) => file.file) : []);
      const form = new FormData();
      form.set("submission", JSON.stringify({ answers: answerData, idempotencyKey: idempotencyKey.current }));
      uploads.forEach((file) => form.append("files", file, file.name));
      const response = await fetch(`/api/v1/${journey}/requests`, { method: "POST", body: form });
      const result = await response.json() as { data?: { reference: string; requestCode?: string; uploads?: { failed: number };indicativeOfferInr?:number|null;quoteRequired?:boolean;repairPrices?:Array<{issueCode:string;priceInr:number;warrantyDays:number|null}> }; error?: string };
      if (!response.ok || !result.data?.requestCode) throw new Error(result.error || "Unable to save your request. Please try again.");
      if (result.data.uploads?.failed) setUploadNotice("Your request was saved, but some attachments could not be uploaded. Contact our team to share them.");
      setReference(result.data.requestCode);
      setSubmissionQuote({indicativeOfferInr:result.data.indicativeOfferInr??null,quoteRequired:result.data.quoteRequired??true,repairPrices:result.data.repairPrices??[]});
      window.speechSynthesis?.cancel();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to save your request. Please try again.");
    } finally { setSubmitting(false); }
  };
  const updateFiles = (field: Field, event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []).map((file) => ({ id: crypto.randomUUID(), name: file.name, type: file.type, url: URL.createObjectURL(file), file }));
    const previous = Array.isArray(data[field.id]) ? data[field.id] as FilePreview[] : [];
    setValue(field.id, [...previous, ...files]);
    event.target.value = "";
  };
  useEffect(() => () => { if (typeof window !== "undefined") window.speechSynthesis?.cancel(); }, []);

  if (reference) {
    const deviceSummary = [choiceLabel(data.brand), choiceLabel(data.model), choiceLabel(data.variant)].filter(Boolean).join(" ");
    const contactMessage = `Hi REPHON 24X7, I would like help with a ${journey} request${deviceSummary ? ` for ${deviceSummary}` : ""}.`;
    return <CustomerAuthGate><main className="questionnaire-page"><section className="flow-success"><span aria-hidden="true">✓</span><p className="eyebrow">Request received</p><h1>Your details are ready.</h1><p>Request ID <strong>{reference}</strong></p><p>Our team will review your details and confirm availability, valuation, pricing, or booking next steps with you.</p>{journey==="sell"&&submissionQuote?.indicativeOfferInr!==null&&submissionQuote?.indicativeOfferInr!==undefined&&<p className="flow-quote-note">Preliminary indicative offer: ₹{new Intl.NumberFormat("en-IN").format(submissionQuote.indicativeOfferInr)}. This is subject to an in-person inspection; it is not a final offer.</p>}{journey==="sell"&&(submissionQuote?.quoteRequired??true)&&<p className="flow-quote-note">We’ll review your device manually. Any final offer is confirmed only after inspection.</p>}{journey==="repair"&&submissionQuote?.repairPrices.map((price)=><p className="flow-quote-note" key={price.issueCode}>Verified repair price: ₹{new Intl.NumberFormat("en-IN").format(price.priceInr)}{price.warrantyDays?` · ${price.warrantyDays}-day warranty`:""} (subject to device inspection)</p>)}{journey==="repair"&&submissionQuote?.quoteRequired&&<p className="flow-quote-note">Some repair details need a manual quote. Our team will confirm them with you.</p>}{uploadNotice&&<p className="flow-quote-note">{uploadNotice}</p>}{journey === "sell" && choiceLabel(data.batteryStatus).startsWith("BAT4") && <p className="battery-safety-note">Manual inspection is required. Keep the phone powered off and do not charge it.</p>}<a className="hero-cta" href={whatsAppHref(contactMessage)} target="_blank" rel="noreferrer">Continue on WhatsApp</a><Link className="flow-home-link" href="/">Back to home</Link></section></main></CustomerAuthGate>;
  }

  const pageTitle = journey === "buy" ? "Buy a phone" : journey === "sell" ? "Sell your phone" : "Repair a phone";
  const percent = Math.round(((step + 1) / screens.length) * 100);
  const isReview = current.special === "review";
  const isRequiredComplete = isReview || requiredComplete;
  const stepSummary = Object.entries(data).filter(([key, value]) => value !== "" && value != null && !(Array.isArray(value) && !value.length) && !["photos", "media"].includes(key));
  const localized = (value: string) => translate(value, language);

  return <CustomerAuthGate><main className="questionnaire-page">
    <header className="questionnaire-heading"><h1>{pageTitle}</h1><p>{journey === "buy" ? "Find a renewed phone that suits you." : journey === "sell" ? "Tell us about your phone in a few quick choices." : "Tell us what is wrong and how you would like service."}</p></header>
    <section className="questionnaire-progress" aria-label="Questionnaire progress">
      <div className="progress-meta"><span>{localized(current.group)} <small>· {language === "hi" ? "चरण" : "Step"} {step + 1} {language === "hi" ? "में से" : "of"} {screens.length}</small></span><strong>{percent}%</strong></div>
      <div className="progress-rail"><i style={{ width: percent + "%" }} /></div>
    </section>
    <section className="voice-tools" aria-label="Voice guide">
      <span>{language === "hi" ? "आवाज़ गाइड" : "Voice guide"}</span>
      <div className="voice-language" role="group" aria-label="Voice language">
        <button type="button" aria-pressed={language === "en"} onClick={() => { window.speechSynthesis?.cancel(); setSpeechMessage(""); setLanguage("en"); }}>English</button>
        <button type="button" aria-pressed={language === "hi"} onClick={() => { window.speechSynthesis?.cancel(); setSpeechMessage(""); setLanguage("hi"); }}>हिन्दी</button>
      </div>
      <button type="button" className="voice-play" aria-label={language === "hi" ? "वर्तमान प्रश्न हिन्दी में सुनें" : "Listen to this question in English"} onClick={speak}><span aria-hidden="true">◖))</span> {language === "hi" ? "सुनें" : "Listen"}</button>
      <span className="voice-status" role="status" aria-live="polite">{speechMessage}</span>
    </section>
    <div className="questionnaire-layout">
      <section className="questionnaire-card" aria-labelledby="active-question">
        <div className="questionnaire-step-title"><h2 id="active-question">{localized(current.title)}</h2>{current.description && <p>{localized(current.description)}</p>}</div>
        {current.special === "review" && <>
          <dl className="questionnaire-review">{stepSummary.map(([key, value]) => <div key={key}><dt>{key.replace(/([A-Z])/g, " $1").replace(/^./, (letter) => letter.toUpperCase())}</dt><dd>{choiceLabel(value as Answer)}</dd></div>)}</dl>
          <section className="questionnaire-price-preview" aria-live="polite">
            <span>Price preview</span>
            {pricePreviewLoading ? <strong>Checking catalogue prices…</strong> : pricePreview?.amountInr !== null && pricePreview?.amountInr !== undefined ? <>
              <strong>{pricePreview.quoteRequired ? "Reference " : ""}₹{new Intl.NumberFormat("en-IN").format(pricePreview.amountInr)}</strong>
              <p>{pricePreview.reason || pricePreview.note}</p>
            </> : <><strong>Quote required</strong><p>{pricePreview?.reason || "We’ll confirm the price with you."}</p></>}
            {pricePreview?.referencePrices?.length ? <ul className="questionnaire-reference-prices">{pricePreview.referencePrices.map((reference) => <li key={reference.label}><span>{reference.label}</span><strong>₹{new Intl.NumberFormat("en-IN").format(reference.amountInr)}</strong></li>)}</ul> : null}
          </section>
          <p className="flow-quote-note">{journey === "buy" ? "Availability is confirmed before purchase." : journey === "sell" ? "We’ll confirm the device condition and final valuation after inspection." : "A technician may confirm the final repair scope after inspection."}</p>
        </>}
        {currentFields.map((field) => {
          const choices = optionsFor(field);
          const selected = data[field.id];
          const selectedIds = Array.isArray(selected) ? (selected as ChoiceAnswer[]).map((item) => item.id) : [];
          const selectedId = isChoice(selected) ? selected.id : "";
          return <div className="questionnaire-field" key={field.id}>
            {(field.type === "text" || field.type === "tel" || field.type === "textarea" || field.type === "search") && <label className="field-label" htmlFor={field.id}>{localized(field.label)}{field.required && <em>{language === "hi" ? "ज़रूरी" : "Required"}</em>}</label>}
            {field.hint && <small className="field-hint">{localized(field.hint)}</small>}
            {field.type === "single" || field.type === "multi" ? <div role="group" aria-label={localized(field.label)} className={"questionnaire-options " + (field.type === "multi" ? "multi-options" : "")}>{choices.map((label) => {
              const id = optionId(field.id, label);
              const chosen = field.type === "multi" ? selectedIds.includes(id) : selectedId === id;
              const condition = field.visual === "screen" ? SCREEN_CONDITIONS.find((item) => label.startsWith(item.code)) : field.visual === "body" ? BODY_CONDITIONS.find((item) => label.startsWith(item.code)) : undefined;
              const visibleLabel = label.replace(/^(S|B|BAT|F)\d+ · /, "");
              return <button key={id} type="button" aria-pressed={chosen} className={"questionnaire-option " + (condition ? "condition-option " : "") + (chosen ? "selected" : "")} onClick={() => field.type === "multi" ? toggleChoice(field, label) : setChoice(field, label)}>
                {condition && <span className="condition-illustration" data-code={condition.code}>{condition.code}</span>}
                <span>{localized(visibleLabel)}{condition && <small>{localized(condition.description)}</small>}</span>{chosen && <b aria-hidden="true">✓</b>}
              </button>;
            })}</div> : null}
            {field.type === "search" && <>
              {field.id === "model" && selectedBrandId && selectedBrand !== "Other / not listed" && <input className="catalogue-model-search" type="search" value={modelSearch} placeholder="Search models" aria-label="Search phone models" onChange={(event) => setModelSearch(event.target.value)} />}
              {!(field.id === "model" && (selectedBrand === "Other / not listed" || typeof selected === "string" || (isChoice(selected) && selected.label === "Other / not listed"))) && <select id={field.id} className="catalogue-select" value={isChoice(selected) ? selected.label : ""} disabled={field.id === "model" && !choices.length} onChange={(event) => { if (event.target.value) setChoice(field, event.target.value); }}>
                <option value="">{field.id === "brand" ? "Choose a brand" : field.id === "model" ? choices.length ? "Choose a model" : "Select a brand first" : field.id === "variant" ? "Choose RAM and storage" : "Choose an option"}</option>
                {choices.map((choice) => <option key={optionId(field.id, choice)} value={choice}>{choice}</option>)}
              </select>}
            {field.id === "model" && (selectedBrand === "Other / not listed" || typeof selected === "string" || (isChoice(selected) && selected.label === "Other / not listed")) && <input id={field.id} aria-label={localized(field.label)} type="text" value={typeof selected === "string" ? selected : ""} placeholder="Enter your phone model" onChange={(event) => setValue(field.id, event.target.value)} />}
              {field.id === "brand" && <small className="catalogue-source-note">{catalogueBrands.length ? "Brand choices come from the shared catalogue data." : catalogueLoaded ? "No brand records are available yet. Choose ‘Other / not listed’ and our team can confirm your device." : "Loading device catalogue…"}</small>}
              {field.id === "model" && catalogueLoading && <small className="catalogue-source-note">Loading models…</small>}
            </>}
            {field.type === "text" || field.type === "tel" ? <input id={field.id} type={field.type} inputMode={field.id === "pinCode" || field.id === "mobile" ? "numeric" : undefined} maxLength={field.id === "mobile" ? 10 : field.id === "pinCode" ? 6 : undefined} value={typeof selected === "string" ? selected : ""} placeholder={field.placeholder} onChange={(event) => setValue(field.id, event.target.value)} /> : null}
            {field.type === "textarea" && <textarea id={field.id} rows={3} value={typeof selected === "string" ? selected : ""} placeholder={field.placeholder} onChange={(event) => setValue(field.id, event.target.value)} />}
            {field.type === "file" && <><label className="file-drop" htmlFor={field.id}><span>＋</span><strong>{localized("Add photos")}</strong><small>{localized(field.hint || "")}</small></label><input className="file-input" id={field.id} type="file" accept={field.accept} multiple onChange={(event) => updateFiles(field, event)} /><div className="file-previews">{(Array.isArray(selected) ? selected as FilePreview[] : []).map((file) => <div key={file.id}>{file.type.startsWith("video/") ? <video src={file.url} controls /> : <Image src={file.url} alt={file.name} width={92} height={68} unoptimized />}<span>{file.name}</span><button type="button" onClick={() => { URL.revokeObjectURL(file.url); setValue(field.id, (Array.isArray(data[field.id]) ? data[field.id] as FilePreview[] : []).filter((item) => item.id !== file.id)); }}>{localized("Remove")}</button></div>)}</div></>}
          </div>;
        })}
        {journey === "sell" && current.id === "battery" && choiceLabel(data.batteryStatus).startsWith("BAT4") && <p className="battery-safety-note" role="status"><strong>{language === "hi" ? "सुरक्षा:" : "Safety:"}</strong> {language === "hi" ? "फूली हुई बैटरी की जाँच ज़रूरी है। फ़ोन बंद रखें और चार्ज न करें।" : "A swollen battery needs manual inspection. Keep the phone powered off and do not charge it."}</p>}
        {error && <p className="questionnaire-error" role="alert">{localized(error)}</p>}
        <div className="questionnaire-actions"><button className="questionnaire-back" type="button" disabled={step === 0||submitting} onClick={() => { setError(""); setStep((value) => Math.max(0, value - 1)); window.speechSynthesis?.cancel(); }}>{localized("Back")}</button>{isReview ? <button className="hero-cta questionnaire-next" type="button" disabled={submitting} onClick={submit}>{submitting?(language === "hi"?"भेजा जा रहा है…":"Submitting…"):(language === "hi" ? "अनुरोध भेजें" : "Submit request")}</button> : <button className="hero-cta questionnaire-next" type="button" disabled={!isRequiredComplete} onClick={() => void next()}>{localized("Continue")}</button>}</div>
      </section>
      <aside className="device-spec-panel" aria-label="Selected device details">
        <div className="device-spec-visual">
          {deviceDetail?.primaryImage?.url ? <Image src={deviceDetail.primaryImage.url} alt={deviceDetail.primaryImage.alt_text || deviceDetail.model.name} width={420} height={300} unoptimized /> : <div className="device-spec-placeholder"><span aria-hidden="true">{journey === "buy" ? "↗" : journey === "sell" ? "⌕" : "＋"}</span><small>{deviceDetailLoading ? "Loading device details" : "Verified device details"}</small></div>}
        </div>
        <div className="device-spec-content">
          <p className="eyebrow">{deviceDetail?.model.brand.name || selectedBrand || "Device catalogue"}</p>
          <h3>{deviceDetail?.model.name || modelName || "Choose a device"}</h3>
          <p className="device-spec-variant">{deviceDetail?.ramGb ? `${deviceDetail.ramGb} GB RAM · ` : ""}{deviceDetail?.storageGb ? `${deviceDetail.storageGb} GB · ` : ""}{deviceDetail?.colour || "Select a model and variant to see details"}</p>
          {deviceDetail && <div className="device-spec-list">{deviceDetail.specifications.slice(0, showAllSpecs ? undefined : 3).map((category) => <section key={category.key}><h4>{category.name}</h4>{category.values.map((item) => <p key={item.key}><span>{item.label}</span><strong>{item.value}</strong></p>)}</section>)}</div>}
          {deviceDetail && deviceDetail.specifications.length > 3 && <button type="button" className="device-spec-toggle" onClick={() => setShowAllSpecs((value) => !value)}>{showAllSpecs ? "Show less" : "View all specifications"}</button>}
          {!deviceDetail && <p className="device-spec-note">Specifications and product images appear here when verified catalogue data is available.</p>}
        </div>
      </aside>
    </div>
  </main></CustomerAuthGate>;
}

