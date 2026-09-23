export const areas = ["St. Paul's Bay", 'Sliema', "St. Julian's", 'Valletta'] as const;
export type Query = {area:string; checkin:string; checkout:string; adults:number; bedrooms:number; pages:number};
export type Quote = {listingId:string; name:string; url:string; locality:string; propertyType:string; bedrooms:number; adults:number; checkin:string; checkout:string; nights:number; totalCents:number; observedAt:string};
export function validDate(s:unknown):s is string {return typeof s==='string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && Number.isFinite(Date.parse(s)) && new Date(s).toISOString().slice(0,10)===s;}
export function validateQuery(input:unknown):Query {
  const q=input as Query;
  if(!q || !areas.includes(q.area as typeof areas[number]) || !validDate(q.checkin) || !validDate(q.checkout)) throw Error('Choose a supported area and valid dates.');
  const nights=(Date.parse(q.checkout)-Date.parse(q.checkin))/86400000;
  if(nights<1||nights>90) throw Error('Choose a stay between 1 and 90 nights.');
  for(const [key,max] of [['adults',16],['bedrooms',10],['pages',5]] as const) if(!Number.isInteger(q[key])||q[key]<1||q[key]>max) throw Error(`Invalid ${key}.`);
  return {area:q.area,checkin:q.checkin,checkout:q.checkout,adults:q.adults,bedrooms:q.bedrooms,pages:q.pages};
}
export function locality(value:string){
  const key=value.toLowerCase().replaceAll('ħ','h').normalize('NFD').replace(/[^a-z0-9]/g,'');
  if(['sanpawlilbahar','stpaulsbay','saintpaulsbay'].includes(key))return "St. Paul's Bay";
  if(['stjulians','saintjulians','sangiljan'].includes(key))return "St. Julian's";
  return value.trim();
}
export function normalizeCapture(input:unknown):{quotes:Quote[]; rejected:number} {
  const c=input as Record<string,unknown>;
  if(!c || c.provider!=='airbnb'||c.schema_version!==1||c.currency!=='EUR'||c.locale!=='en-US'||!Array.isArray(c.cards)||c.cards.length>100)throw Error('Unsupported capture. Use the Airbnb collector JSON format (EUR, en-US).');
  const q=c.query as Query;
  if(!q||!validDate(q.checkin)||!validDate(q.checkout)||!Number.isInteger(q.adults)||q.adults<1||q.adults>16||!Number.isInteger(q.bedrooms)||q.bedrooms<1||q.bedrooms>10)throw Error('Invalid capture query.');
  const nights=(Date.parse(q.checkout)-Date.parse(q.checkin))/86400000;
  const observedAt=String(c.observed_at);
  if(nights<1||nights>90||!Number.isFinite(Date.parse(observedAt))||Date.parse(observedAt)>Date.now()+300000)throw Error('Invalid capture dates.');
  const quotes:Quote[]=[];let rejected=0;
  for(const card of c.cards){
    const r=card as Record<string,unknown>;
    const id=typeof r?.listing_id==='string'?r.listing_id:'';
    let url:URL;try{url=new URL(String(r.url));}catch{rejected++;continue;}
    const amounts=[...String(r.price_text??'').matchAll(/€\s*([\d,]+(?:\.\d{1,2})?)\s*total\b/gi)].map(m=>Math.round(Number(m[1].replaceAll(',',''))*100));
    const totals=[...new Set(amounts)];
    const title=String(r.title??'');const parts=title.split(' in ');const area=parts.slice(1).join(' in ');
    if(!/^\d{1,25}$/.test(id)||url.protocol!=='https:'||!['www.airbnb.com','www.airbnb.com.mt'].includes(url.hostname)||url.pathname!==`/rooms/${id}`||r.checkin!==q.checkin||r.checkout!==q.checkout||Number(r.adults)!==q.adults||r.bedrooms!==q.bedrooms||totals.length!==1||totals[0]<=0||totals[0]>100000000||!area){rejected++;continue;}
    quotes.push({listingId:id,name:String(r.name??title).slice(0,250),url:url.origin+url.pathname,locality:locality(area),propertyType:parts[0].slice(0,100),bedrooms:q.bedrooms,adults:q.adults,checkin:q.checkin,checkout:q.checkout,nights,totalCents:totals[0],observedAt:new Date(observedAt).toISOString()});
  }
  return {quotes,rejected};
}
