import {NextResponse} from 'next/server';
import {getChatGPTUser} from '@/app/chatgpt-auth';
import {isAdminEmail,propertyDb} from '@/db/queries';
import {normalizeCapture,validateQuery} from '@/lib/airbnb/normalize';
import {normalizeRows} from '@/lib/airbnb/import';
import page1 from '@/lib/airbnb/airbnb-live-2026-09-18-page1.json';
import page2 from '@/lib/airbnb/airbnb-live-2026-09-18-page2.json';
import page3 from '@/lib/airbnb/airbnb-live-2026-09-18-page3.json';
import page4 from '@/lib/airbnb/airbnb-live-2026-09-18-page4.json';
import page5 from '@/lib/airbnb/airbnb-live-2026-09-18-page5.json';

const configured=()=>Boolean(process.env.MARKET_COLLECTOR_URL&&process.env.MARKET_COLLECTOR_TOKEN);
export async function GET(request:Request){
 const user=await getChatGPTUser();if(!user||!isAdminEmail(user.email))return NextResponse.json({error:'Forbidden'},{status:403});
 try{
 if(new URL(request.url).searchParams.get('review')==='1'){
  const result=await propertyDb().prepare("SELECT id,name,url,locality,total_cents,nights,provider,review_reason FROM airbnb_observations WHERE review_reason<>'' ORDER BY observed_at DESC LIMIT 1000").all();
  return NextResponse.json({rows:result.results},{headers:{'Cache-Control':'no-store'}});
 }
 if(new URL(request.url).searchParams.get('coverage')==='1'){
  const result=await propertyDb().prepare("SELECT locality, COUNT(DISTINCT provider||'|'||listing_id) AS listings, SUM(CASE WHEN review_reason<>'' THEN 1 ELSE 0 END) AS pendingReview, MAX(observed_at) AS lastObserved FROM airbnb_observations GROUP BY locality ORDER BY locality").all();
  return NextResponse.json({localities:result.results},{headers:{'Cache-Control':'no-store'}});
 }
 const params=Object.fromEntries(new URL(request.url).searchParams);
 const q=validateQuery({...params,adults:Number(params.adults),bedrooms:Number(params.bedrooms),pages:1});
 const results=await propertyDb().prepare(`SELECT * FROM (SELECT *,ROW_NUMBER() OVER (PARTITION BY provider,listing_id,checkin,checkout,adults ORDER BY observed_at DESC,id DESC) AS rank FROM airbnb_observations WHERE locality=? AND bedrooms=? AND adults=? AND checkin=? AND checkout=?) WHERE rank=1 ORDER BY total_cents ASC LIMIT 500`).bind(q.area,q.bedrooms,q.adults,q.checkin,q.checkout).all();
 const count=await propertyDb().prepare('SELECT COUNT(*) AS count FROM airbnb_observations').first();
 return NextResponse.json({rows:results.results,totalStored:count?.count??0,collectorConnected:configured()},{headers:{'Cache-Control':'no-store'}});
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Search failed'},{status:400});}
}
export async function POST(request:Request){
 const user=await getChatGPTUser();if(!user||!isAdminEmail(user.email))return NextResponse.json({error:'Forbidden'},{status:403});
 if(request.headers.get('origin')&&request.headers.get('origin')!==new URL(request.url).origin)return NextResponse.json({error:'Invalid origin'},{status:403});
 try{
 const raw=await request.text();if(raw.length>2000000)return NextResponse.json({error:'Maximum import size is 2 MB.'},{status:413});
 const body=JSON.parse(raw);let captures:unknown[]=[];let warnings:string[]=[];
 if(body.currency&&body.currency!=='EUR')throw Error('Only EUR prices are supported.');
 if(body.provider==='booking'&&body.schema_version!==1)throw Error('Unsupported Booking schema version.');
 const direct=body.action==='import-rows'||body.action==='preview-rows'?normalizeRows(body.rows,body.provider??'airbnb'):null;
 const reviewRows=direct?.filter(q=>q.reviewReason).map(q=>({listingId:q.listingId,name:q.name,reason:q.reviewReason}))??[];
 if(body.action==='preview-rows')return NextResponse.json({accepted:direct!.length,pendingReview:reviewRows.length,reviewRows,localities:[...new Set(direct!.map(q=>q.locality))]});
 if(direct){/* Validated rows use the collector's existing storage and duplicate key. */}
 else if(body.action==='sample')captures=[page1,page2,page3,page4,page5];
 else if(body.action==='collect'){
  const q=validateQuery(body.query);
  if(q.checkin<new Date().toISOString().slice(0,10))throw Error('Live searches require current or future dates.');
  if(!configured())return NextResponse.json({error:'Live collector is not connected. Import a capture or load the verified dataset.'},{status:503});
  const endpoint=new URL(process.env.MARKET_COLLECTOR_URL!);if(endpoint.protocol!=='https:')throw Error('Collector requires HTTPS.');
  const response=await fetch(new URL('/collect',endpoint),{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${process.env.MARKET_COLLECTOR_TOKEN}`},body:JSON.stringify(q),signal:AbortSignal.timeout(150000),redirect:'error'});
  if(!response.ok)throw Error(`Collector returned ${response.status}. No data imported.`);
  const result=await response.json() as {captures:unknown[];errors?:string[]};captures=result.captures;warnings=(result.errors??[]).map(x=>String(x).slice(0,350));
  if(!Array.isArray(captures)||!captures.length)throw Error(warnings.join(' ')||'Collector returned no captures.');
  for(const capture of captures){const cq=(capture as {query?:Record<string,unknown>}).query;if(!cq||cq.checkin!==q.checkin||cq.checkout!==q.checkout||cq.adults!==q.adults||cq.bedrooms!==q.bedrooms)throw Error('Collector returned a different search. Nothing imported.');}
 }else if(body.action==='import')captures=Array.isArray(body.captures)?body.captures:[body.capture];
 else throw Error('Unknown action.');
 if(!direct&&(!captures.length||captures.length>20))throw Error('Import 1 to 20 capture pages.');
 const parsed=captures.map(normalizeCapture);const quotes=direct??parsed.flatMap(c=>c.quotes);let inserted=0;
 // Idempotent per observation. Listing IDs stay strings to preserve all digits.
 const statements=await Promise.all(quotes.map(async q=>{
 const key=[q.listingId,q.checkin,q.checkout,q.adults,q.observedAt];if(q.provider==='booking')key.unshift('booking');
 const bytes=new TextEncoder().encode(key.join('|'));
 const id=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');
 return propertyDb().prepare('INSERT OR IGNORE INTO airbnb_observations (id,listing_id,name,url,locality,property_type,bedrooms,adults,checkin,checkout,nights,total_cents,observed_at,imported_by,provider,source_details,review_reason) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(id,q.listingId,q.name,q.url,q.locality,q.propertyType,q.bedrooms,q.adults,q.checkin,q.checkout,q.nights,q.totalCents,q.observedAt,user.userId,q.provider??'airbnb',JSON.stringify(q.sourceDetails??{}),q.reviewReason??'');
 }));
 const localityCounts:Record<string,number>={};
 const unique=new Set<string>();for(const q of quotes){const key=[q.locality,q.listingId,q.checkin,q.checkout,q.adults].join('|');if(!unique.has(key)){unique.add(key);localityCounts[q.locality]=(localityCounts[q.locality]??0)+1;}}
 if(!statements.length)return NextResponse.json({inserted:0,accepted:0,rejected:parsed.reduce((s,p)=>s+p.rejected,0),warnings,localityCounts});
 // D1 batch executes transactionally: a failed statement rolls back the import.
 const results=await propertyDb().batch(statements);for(const r of results)inserted+=r.meta.changes??0;
 return NextResponse.json({inserted,accepted:quotes.length,rejected:parsed.reduce((s,p)=>s+p.rejected,0),warnings,localityCounts,pendingReview:reviewRows.length,reviewRows});
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Import failed'},{status:400});}
}
