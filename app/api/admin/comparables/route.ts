import { NextResponse } from 'next/server';
import { getChatGPTUser } from '@/app/chatgpt-auth';
import { ensurePropertySchema,isAdminEmail,propertyDb } from '@/db/queries';

type Row=Record<string,unknown>;
const bool=(value:unknown)=>['yes','true','1','y','included'].includes(String(value??'').trim().toLowerCase())?1:0;
const text=(row:Row,...keys:string[])=>{for(const key of keys){if(row[key]!=null)return String(row[key]).trim()}return''};
const num=(row:Row,...keys:string[])=>Number(text(row,...keys))||0;

export async function GET(){
  const user=await getChatGPTUser();if(!user||!isAdminEmail(user.email))return NextResponse.json({error:'Forbidden'},{status:403});await ensurePropertySchema();
  const summary=await propertyDb().prepare('SELECT COUNT(*) as count,MAX(batch_updated_at) as updated_at FROM market_comparables').first();return NextResponse.json(summary);
}

export async function POST(request:Request){
  const user=await getChatGPTUser();if(!user||!isAdminEmail(user.email))return NextResponse.json({error:'Forbidden'},{status:403});await ensurePropertySchema();
  const body=await request.json() as {rows?:Row[]};const rows=body.rows??[];if(!rows.length||rows.length>5000)return NextResponse.json({error:'Upload between 1 and 5,000 rows'},{status:400});const now=Date.now();
  const normalized=rows.map(row=>({locality:text(row,'locality','location'),propertyType:text(row,'property_type','property type','propertyType').toLowerCase(),bedrooms:num(row,'bedrooms'),strategy:text(row,'strategy','rental_strategy').toLowerCase(),monthlyPrice:num(row,'monthly_price','monthly price','monthlyPrice'),nightlyRate:num(row,'nightly_rate','nightly rate','nightlyRate'),occupancy:num(row,'occupancy','occupancy_rate'),electricity:bool(text(row,'electricity_included','electricity included')),water:bool(text(row,'water_included','water included')),internet:bool(text(row,'internet_included','internet included')),buildingFees:bool(text(row,'building_fees_included','building fees included','condominium fees included'))})).filter(row=>row.locality&&row.propertyType&&row.bedrooms>0&&['long-term','short-term'].includes(row.strategy));
  if(!normalized.length)return NextResponse.json({error:'No valid rows. Check the template columns.'},{status:400});await propertyDb().prepare('DELETE FROM market_comparables').run();
  for(let start=0;start<normalized.length;start+=75){const chunk=normalized.slice(start,start+75);await propertyDb().batch(chunk.map(row=>propertyDb().prepare('INSERT INTO market_comparables (id,locality,property_type,bedrooms,strategy,monthly_price,nightly_rate,occupancy,electricity_included,water_included,internet_included,building_fees_included,batch_updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(crypto.randomUUID(),row.locality,row.propertyType,row.bedrooms,row.strategy,row.monthlyPrice,row.nightlyRate,row.occupancy,row.electricity,row.water,row.internet,row.buildingFees,now)));}
  await propertyDb().prepare('PRAGMA optimize').run();return NextResponse.json({imported:normalized.length,updatedAt:now});
}
