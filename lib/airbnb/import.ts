import {areas,locality,validDate,type Quote} from './normalize';

export function normalizeRows(input:unknown,provider:unknown='airbnb'):Quote[]{
 if(provider!=='airbnb'&&provider!=='booking')throw Error('Supported providers: airbnb or booking.');
 if(!Array.isArray(input)||!input.length||input.length>1000)throw Error('Import between 1 and 1,000 observations.');
 return input.map((value,index)=>{
  const fail=(message:string):never=>{throw Error(`Row ${index+1}: ${message}`);};
  if(!value||typeof value!=='object')return fail('Expected an observation object.');
  const r=value as Record<string,unknown>;
  let listingId=typeof r.listing_id==='string'?r.listing_id:'';
  if(provider==='airbnb'&&!/^\d{1,25}$/.test(listingId))return fail('listing_id must be a string containing the Airbnb listing ID.');
  let url:URL;try{url=new URL(String(r.url));}catch{return fail('Invalid listing URL.');}
  if(url.username||url.password||url.port)return fail('Use a canonical listing URL.');
  if(provider==='airbnb'&&(url.protocol!=='https:'||!['www.airbnb.com','www.airbnb.com.mt'].includes(url.hostname)||url.pathname!==`/rooms/${listingId}`))return fail('URL must match the Airbnb listing ID.');
  if(provider==='booking'){
   const canonical=(path:string)=>path.replace(/\.[a-z]{2}(?:-[a-z]{2})?\.html$/i,'.html');
   if(url.protocol!=='https:'||!['www.booking.com','booking.com'].includes(url.hostname)||!/^\/hotel\/mt\/[a-z0-9_-]+(?:\.[a-z]{2}(?:-[a-z]{2})?)?\.html$/i.test(url.pathname)||canonical(listingId)!==canonical(url.pathname))return fail('URL and listing_id must identify the same Booking Malta property.');
   listingId=canonical(listingId);
  }
  const name=typeof r.name==='string'?r.name.trim():'';
  if(!name||name.length>250)return fail('name is required (maximum 250 characters).');
  const area=locality(String(r.locality??''));
  if(!areas.includes(area))return fail('Use a supported locality from the template.');
  const propertyType=String(r.property_type??'').trim().toLowerCase();
  if(!['apartment','condo','condominium','rental unit','house','home','villa','room'].includes(propertyType))return fail('Unsupported property_type.');
  const bedrooms=Number(r.bedrooms),adults=Number(r.adults),totalCents=Number(r.total_cents);
  if(!Number.isInteger(bedrooms)||bedrooms<1||bedrooms>10)return fail('bedrooms must be between 1 and 10.');
  if(!Number.isInteger(adults)||adults<1||adults>16)return fail('adults must be between 1 and 16.');
  if(!Number.isSafeInteger(totalCents)||totalCents<=0||totalCents>100000000)return fail('total_cents must be a positive whole amount in EUR cents.');
  if(!validDate(r.checkin)||!validDate(r.checkout))return fail('Use YYYY-MM-DD stay dates.');
  const nights=(Date.parse(r.checkout)-Date.parse(r.checkin))/86400000;
  if(nights<1||nights>90)return fail('Stay must be between 1 and 90 nights.');
  if(typeof r.observed_at!=='string'||!/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(r.observed_at)||!Number.isFinite(Date.parse(r.observed_at))||Date.parse(r.observed_at)>Date.now()+300000)return fail('observed_at must be a valid timestamp with timezone, no later than now.');
  let sourceDetails:Record<string,unknown>={},reviewReason='';
  if(provider==='booking'){
   for(const field of ['unit_name','address','rate_conditions'])if(typeof r[field]!=='string'||!String(r[field]).trim()||String(r[field]).length>4000)return fail(`${field} is required (maximum 4,000 characters).`);
   if(r.units!==1)return fail('Booking observations must quote one complete unit.');
   if(r.taxes_included!==null&&typeof r.taxes_included!=='boolean')return fail('taxes_included must be true, false or null.');
   if(r.additional_charges_text!==null&&(typeof r.additional_charges_text!=='string'||r.additional_charges_text.length>4000))return fail('Invalid additional_charges_text.');
   sourceDetails={unit_name:r.unit_name,address:r.address,units:1,taxes_included:r.taxes_included,additional_charges_text:r.additional_charges_text,rate_conditions:r.rate_conditions};
   const issues:string[]=[];
   if(totalCents/100/nights>1000)issues.push('Unusually high price above EUR 1,000/night; verify before using in averages.');
   const postalAreas:Record<string,string>={FNT:'Fontana (Gozo)',RBT:'Rabat (Malta)',VLT:'Valletta',ATD:'Attard'};
   const postal=String(r.address).match(/\b(FNT|RBT|VLT|ATD)\s*\d{4}\b/i)?.[1].toUpperCase();
   if(postal&&postalAreas[postal]!==area)issues.push(`Address postal code suggests ${postalAreas[postal]}; imported locality is ${area}.`);
   if(/single room/i.test(String(r.unit_name)))issues.push('Unit label says Single Room; confirm a complete two-bedroom apartment.');
   reviewReason=issues.join(' ');
  }
  return {listingId,name,url:url.origin+url.pathname,locality:area,propertyType,bedrooms,adults,checkin:r.checkin,checkout:r.checkout,nights,totalCents,observedAt:new Date(r.observed_at).toISOString(),provider,sourceDetails,reviewReason};
 });
}
