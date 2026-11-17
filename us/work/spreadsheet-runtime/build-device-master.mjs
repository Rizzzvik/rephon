import ExcelJS from 'exceljs';
import fs from 'node:fs/promises';
import JSZip from 'jszip';

const inputPath = 'work/master-workbooks-audit/DEVICE_MASTER.xlsx';
const outputPath = 'outputs/DEVICE_MASTER_CURRENT_INDIA.xlsx';
const sourceBuffer = await fs.readFile(inputPath);
const zip = await JSZip.loadAsync(sourceBuffer);
let changed = false;
for (const [path, file] of Object.entries(zip.files)) {
  if (file.dir) continue;
  const cm = path.match(/^xl\/comments\/comment(\d+)\.xml$/);
  const vml = path.match(/^xl\/drawings\/commentsDrawing(\d+)\.vml$/);
  if (cm) { zip.file(`xl/comments${cm[1]}.xml`, await file.async('nodebuffer')); changed = true; }
  if (vml) { zip.file(`xl/drawings/vmlDrawing${vml[1]}.vml`, await file.async('nodebuffer')); changed = true; }
  if (path.startsWith('xl/worksheets/_rels/') && path.endsWith('.rels')) {
    const xml = await file.async('string');
    const normalized = xml.replace(/Target="\/xl\/comments\/comment(\d+)\.xml"/g, 'Target="../comments$1.xml"').replace(/Target="\/xl\/drawings\/commentsDrawing(\d+)\.vml"/g, 'Target="../drawings/vmlDrawing$1.vml"').replace(/Target="\/xl\/tables\/(table\d+\.xml)"/g, 'Target="../tables/$1"');
    if (xml !== normalized) { zip.file(path, normalized); changed = true; }
  }
}
const normalizedBytes = changed ? await zip.generateAsync({type:'uint8array'}) : new Uint8Array(sourceBuffer);
const wb = new ExcelJS.Workbook();
await wb.xlsx.load(Buffer.from(normalizedBytes));

// Explicit current India listings/configurations verified from manufacturer pages on 2026-11-08.
// Config array values are [RAM GB or null, storage GB]. Colors are deliberately not split into separate codes.
const catalog = [
 {b:'14',brand:'Apple',m:'iPhone Duo',src:'https://www.apple.com/in/iphone-duo/specs/',configs:[[null,256],[null,512],[null,1024],[null,2048]]},
 {b:'14',brand:'Apple',m:'iPhone 18 Pro',src:'https://www.apple.com/in/iphone-18-pro/specs/',configs:[[null,256],[null,512],[null,1024],[null,2048]]},
 {b:'14',brand:'Apple',m:'iPhone 18 Pro Max',src:'https://www.apple.com/in/iphone-18-pro/specs/',configs:[[null,256],[null,512],[null,1024],[null,2048]]},
 {b:'14',brand:'Apple',m:'iPhone Air',src:'https://www.apple.com/in/iphone-air/specs/',configs:[[null,256],[null,512],[null,1024]]},
 {b:'14',brand:'Apple',m:'iPhone 17',src:'https://www.apple.com/in/iphone-17/specs/',configs:[[null,256],[null,512]]},
 {b:'14',brand:'Apple',m:'iPhone 17e',src:'https://www.apple.com/in/iphone-17e/specs/',configs:[[null,256],[null,512]]},
 {b:'14',brand:'Apple',m:'iPhone 16',src:'https://www.apple.com/in/iphone-16/specs/',configs:[[null,128]]},
 {b:'21',brand:'Google',m:'Pixel 11',src:'https://store.google.com/in/product/pixel_11_specs?hl=en-IN',configs:[[12,256],[12,512]]},
 {b:'21',brand:'Google',m:'Pixel 11 Pro',src:'https://store.google.com/in/product/pixel_11_pro_specs?hl=en-IN',configs:[[12,256],[16,512]]},
 {b:'21',brand:'Google',m:'Pixel 11 Pro XL',src:'https://store.google.com/in/product/pixel_11_pro_specs?hl=en-IN',configs:[[12,256],[16,512]]},
 {b:'21',brand:'Google',m:'Pixel 11 Pro Fold',src:'https://store.google.com/in/category/phones?hl=en-IN',configs:[[16,512]]},
 {b:'15',brand:'Samsung',m:'Galaxy S26 Ultra',src:'https://news.samsung.com/in/samsung-india-launches-its-most-advanced-ai-phone-the-galaxy-s26-series-pre-order-now-for-exciting-offers',configs:[[12,256],[12,512],[16,1024]]},
 {b:'15',brand:'Samsung',m:'Galaxy S26+',src:'https://news.samsung.com/in/samsung-india-launches-its-most-advanced-ai-phone-the-galaxy-s26-series-pre-order-now-for-exciting-offers',configs:[[12,256],[12,512]]},
 {b:'15',brand:'Samsung',m:'Galaxy S26',src:'https://news.samsung.com/in/samsung-india-launches-its-most-advanced-ai-phone-the-galaxy-s26-series-pre-order-now-for-exciting-offers',configs:[[12,256],[12,512]]},
 {b:'15',brand:'Samsung',m:'Galaxy Z Fold8',src:'https://www.samsung.com/in/smartphones/galaxy-z-fold8/buy/',configs:[[12,256],[12,512],[16,1024]]},
 {b:'15',brand:'Samsung',m:'Galaxy A27 5G',src:'https://news.samsung.com/in/samsung-galaxy-a27-5g-launches-in-india-at-inr-28999-with-cashback-and-zero-down-payment-emi-schemes',configs:[[6,128],[8,128],[8,256]]},
 {b:'16',brand:'OnePlus',m:'OnePlus 15',src:'https://www.oneplus.in/oneplus-15',configs:[[12,256],[16,512]]},
 {b:'16',brand:'OnePlus',m:'OnePlus 15R',src:'https://www.oneplus.in/oneplus-15r',configs:[[12,256],[12,512],[16,512]]},
 {b:'16',brand:'OnePlus',m:'OnePlus 13s',src:'https://www.oneplus.in/13s',configs:[[12,256],[12,512]]},
 {b:'16',brand:'OnePlus',m:'OnePlus N6 Lite 4G',src:'https://www.oneplus.in/n6-lite',configs:[[4,128]]},
 {b:'16',brand:'OnePlus',m:'OnePlus N6',src:'https://www.oneplus.in/n6',configs:[[4,128],[6,128]]},
 {b:'16',brand:'OnePlus',m:'OnePlus N6x',src:'https://www.oneplus.in/n6x',configs:[[4,64],[4,128]]},
 {b:'16',brand:'OnePlus',m:'OnePlus Nord 6',src:'https://www.oneplus.in/oneplus-nord-6',configs:[[8,256],[12,256]]},
 {b:'16',brand:'OnePlus',m:'OnePlus Nord CE6',src:'https://www.oneplus.in/oneplus-nord-ce6',configs:[[8,128],[8,256]]},
 {b:'16',brand:'OnePlus',m:'OnePlus Nord CE6 Lite',src:'https://www.oneplus.in/oneplus-nord-ce6-lite',configs:[[6,128],[8,128],[8,256]]},
 {b:'20',brand:'Motorola',m:'motorola edge 70 fusion',src:'https://www.motorola.in/smartphones',configs:[[8,128],[8,256],[12,256],[12,512]]},
 {b:'20',brand:'Motorola',m:'motorola edge 60 fusion',src:'https://www.motorola.in/smartphones',configs:[[8,128],[8,256],[12,256]]},
 {b:'20',brand:'Motorola',m:'moto g37 power',src:'https://www.motorola.in/smartphones',configs:[[4,64],[4,128],[8,128]]},
 {b:'20',brand:'Motorola',m:'moto g37',src:'https://www.motorola.in/smartphones',configs:[[4,64]]},
 {b:'20',brand:'Motorola',m:'motorola edge 70 pro',src:'https://www.motorola.in/smartphones',configs:[[8,256],[12,256]]},
 {b:'20',brand:'Motorola',m:'moto g06 power',src:'https://www.motorola.in/smartphones',configs:[[4,64]]},
 {b:'20',brand:'Motorola',m:'motorola signature',src:'https://www.motorola.in/smartphones',configs:[[12,256]]},
 {b:'20',brand:'Motorola',m:'motorola edge 70 pro plus',src:'https://www.motorola.in/smartphones',configs:[[12,256]]},
 {b:'20',brand:'Motorola',m:'moto g max',src:'https://www.motorola.in/smartphones',configs:[[4,128],[6,128]]},
 {b:'20',brand:'Motorola',m:'moto g77 power',src:'https://www.motorola.in/smartphones',configs:[[4,128],[8,128]]},
 {b:'23',brand:'Realme',m:'realme 16 Pro+ 5G',src:'https://www.realme.com/in/realme-16-pro-plus-5g/specs',configs:[[8,128],[8,256],[12,256]]},
 {b:'29',brand:'Infinix',m:'GT 50 Pro',src:'https://infinixmobiles.in/products/gt-50-pro',configs:[[12,256],[12,512]]},
 {b:'29',brand:'Infinix',m:'Hot 70 Pro',src:'https://infinixmobiles.in/products/hot-70-pro',configs:[[6,128],[8,128]]},
 {b:'30',brand:'iQOO',m:'iQOO Z11x 5G',src:'https://shop.iqoo.com/in/products/phone',configs:[[8,128]]},
 {b:'30',brand:'iQOO',m:'iQOO Z11xa 5G',src:'https://shop.iqoo.com/in/products/phone',configs:[[8,128]]},
 {b:'30',brand:'iQOO',m:'iQOO Z11 5G',src:'https://shop.iqoo.com/in/products/phone',configs:[[8,128],[8,256]]},
 {b:'30',brand:'iQOO',m:'iQOO Neo 10',src:'https://shop.iqoo.com/in/products/phone',configs:[[12,256]]},
 {b:'30',brand:'iQOO',m:'iQOO 15R',src:'https://shop.iqoo.com/in/products/phone',configs:[[12,256],[12,512]]},
 {b:'30',brand:'iQOO',m:'iQOO Z11 Lite 44W 5G',src:'https://shop.iqoo.com/in/products/phone',configs:[[4,128],[6,128],[6,256]]},
 {b:'30',brand:'iQOO',m:'iQOO Z10 Lite 5G',src:'https://shop.iqoo.com/in/products/phone',configs:[[4,128]]},
 {b:'30',brand:'iQOO',m:'iQOO 15',src:'https://shop.iqoo.com/in/products/phone',configs:[[12,256]]},
 {b:'27',brand:'Honor',m:'HONOR X7c 5G',src:'https://www.honor.com/in/phones/honor-x7c-5g/spec/',configs:[[8,256]]},
 {b:'27',brand:'Honor',m:'HONOR X9b',src:'https://www.honor.com/in/phones/honor-x9b/',configs:[[12,256]]},
 {b:'26',brand:'ASUS',m:'ROG Phone 8 Pro',src:'https://www.asus.com/in/mobile-handhelds/phones/rog-phone/filter?Series=ROG-Phone',configs:[[16,512]]},
 {b:'26',brand:'ASUS',m:'ROG Phone 8 Pro Edition',src:'https://www.asus.com/in/mobile-handhelds/phones/rog-phone/filter?Series=ROG-Phone',configs:[[24,1024]]},
 {b:'24',brand:'Redmi',m:'REDMI Note 17 Pro Max 5G',src:'https://www.mi.com/in/product-list/',configs:[[8,256],[12,256]]},
 {b:'24',brand:'Redmi',m:'REDMI Note 17 Pro 5G',src:'https://www.mi.com/in/product-list/',configs:[[8,128],[8,256]]},
 {b:'24',brand:'Redmi',m:'REDMI Note 17 5G',src:'https://www.mi.com/in/product-list/',configs:[[6,128],[8,128]]},
 {b:'24',brand:'Redmi',m:'Redmi Note 15 Pro+ 5G',src:'https://www.mi.com/in/product-list/',configs:[[8,256],[12,256],[12,512]]},
 {b:'24',brand:'Redmi',m:'Redmi Note 15 Pro 5G',src:'https://www.mi.com/in/product-list/',configs:[[8,128],[8,256]]},
 {b:'24',brand:'Redmi',m:'Redmi Note 15 5G',src:'https://www.mi.com/in/product/redmi-note-15-5g/specs/',configs:[[8,128],[8,256]]},
 {b:'24',brand:'Redmi',m:'Redmi 15 5G',src:'https://www.mi.com/in/product/redmi-15-5g/specs/',configs:[[6,128],[8,256]]},
 {b:'24',brand:'Redmi',m:'Redmi A7 Pro 5G',src:'https://www.mi.com/in/product/redmi-a7-pro-5g/specs/',configs:[[4,64],[4,128],[6,128]]},
 {b:'17',brand:'Xiaomi',m:'Xiaomi 17',src:'https://www.mi.com/in/store/',configs:[[12,256],[12,512]]},
 {b:'17',brand:'Xiaomi',m:'Xiaomi 17 Ultra',src:'https://www.mi.com/in/product/xiaomi-17-ultra/specs/',configs:[[16,512]]},
 {b:'19',brand:'OPPO',m:'OPPO Reno16 5G',src:'https://www.oppo.com/in/smartphones/series-reno/reno16/specs/',configs:[[8,128]]},
 {b:'18',brand:'Vivo',m:'vivo X300 FE',src:'https://www.vivo.com/in/products/param/x300-fe?id=830',configs:[[8,256],[12,512]]},
 {b:'22',brand:'Nothing',m:'Phone (4a)',src:'https://in.nothing.tech/products/phone-4a',configs:[[8,128],[12,256]]},
 {b:'22',brand:'Nothing',m:'Phone (4a) Pro',src:'https://in.nothing.tech/products/phone-4a-pro',configs:[[8,128],[12,256]]},
 {b:'22',brand:'Nothing',m:'Phone (4b)',src:'https://in.nothing.tech/products/phone-4b',configs:[[8,128]]},
 {b:'22',brand:'Nothing',m:'Phone (3)',src:'https://in.nothing.tech/products/phone-3',configs:[[12,256]]},
 {b:'22',brand:'Nothing',m:'Phone (3a)',src:'https://in.nothing.tech/products/phone-3a',configs:[[8,128]]},
 {b:'22',brand:'Nothing',m:'Phone (3a) Pro',src:'https://in.nothing.tech/products/phone-3a-pro',configs:[[8,128]]},
 {b:'22',brand:'Nothing',m:'Phone (3a) Lite',src:'https://in.nothing.tech/products/phone-3a-lite',configs:[[8,128]]},
 {b:'22',brand:'Nothing',m:'CMF Phone 2 Pro',src:'https://in.nothing.tech/products/cmf-phone-2-pro',configs:[[8,128]]},
 {b:'22',brand:'Nothing',m:'CMF Phone 1',src:'https://in.nothing.tech/products/cmf-phone-1',configs:[[8,128]]},
];

const byBrand = new Map();
for (const entry of catalog) { if (!byBrand.has(entry.b)) byBrand.set(entry.b, []); byBrand.get(entry.b).push(entry); }
const modelRows = [];
const variantRows = [];
for (const [brandCode, items] of [...byBrand.entries()].sort((a,b)=>a[0].localeCompare(b[0]))) {
  items.forEach((entry, idx) => {
    const modelCode = String(idx + 1).padStart(3,'0');
    const slug = entry.m.toLowerCase().replace(/\+/g,' plus ').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
    const reference = `${entry.src} | Verified 2026-11-08`;
    modelRows.push([brandCode, modelCode, entry.brand, entry.m, slug, null, 'smartphone', '{}', 1, reference, 'verified', 'Current manufacturer India product listing. Model code allocated in this workbook; keep permanently once imported.']);
    entry.configs.forEach(([ram, storage], variantIdx) => {
      const variantCode = String(variantIdx + 1).padStart(2,'0');
      variantRows.push(['', brandCode, modelCode, variantCode, entry.brand, entry.m, ram, storage, 'Unspecified', 'IN', null, 1, 0, 0, 0, 'RAM/storage option verified on the linked official India listing. Color-specific SKUs are not separated here; update color and service eligibility from your local SKU/pricing data.']);
    });
  });
}
if (modelRows.length > 999 || variantRows.length > 2000) throw new Error('Code or template allocation limit exceeded.');
const modelSheet = wb.getWorksheet('PHONE_MODELS');
const variantSheet = wb.getWorksheet('DEVICE_VARIANTS');
for (let i=0; i<modelRows.length; i++) modelSheet.getRow(i+2).values = [...modelRows[i]];
// Keep the existing device_code formula in column A; write inputs to columns B:P.
for (let i=0; i<variantRows.length; i++) {
  const row=variantSheet.getRow(i+2);
  for (let col=1; col<16; col++) row.getCell(col+1).value=variantRows[i][col];
}
wb.calcProperties.fullCalcOnLoad = true;
await wb.xlsx.writeFile(outputPath);console.log(JSON.stringify({outputPath, models:modelRows.length, variants:variantRows.length, brands:byBrand.size}));




