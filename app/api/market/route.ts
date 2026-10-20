import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { getChatGPTUser } from '@/app/chatgpt-auth';
import { ensurePropertySchema,ensureUserProfile,hasMarketAccess,isAdminEmail,propertyDb } from '@/db/queries';
import { canonicalLocality } from '@/lib/localities';
import {listingQuery} from '@/lib/market-listings.mjs';

type Comparable={locality:string;property_type:string;bedrooms:number;strategy:string;monthly_price:number;nightly_rate:number;occupancy:number;electricity_included:number;water_included:number;internet_included:number;building_fees_included:number;batch_updated_at:number};
type Listing={provider:string;source_details:string;listing_id:string;name:string;url:string;property_type:string;bedrooms:number;adults:number;checkin:string;checkout:string;nights:number;total_cents:number;observed_at:string};

export async function GET(request:Request){
  const user=await getChatGPTUser();if(!user)return NextResponse.json({error:'Unauthorized'},{status:401});
  const profile=await ensureUserProfile(user),billingPlan=(await headers()).get('x-ownly-plan');if(!profile||(!hasMarketAccess(profile)&&billingPlan!=='portfolio'&&!isAdminEmail(user.email)))return NextResponse.json({error:'Market insights are included in Portfolio.',locked:true},{status:403});
  const url=new URL(request.url),propertyId=url.searchParams.get('propertyId');await ensurePropertySchema();
  if(url.searchParams.get('coverage')==='1'){
    const bedrooms=Number(url.searchParams.get('bedrooms')??2),adults=Number(url.searchParams.get('adults')??4),type=url.searchParams.get('propertyType')??'apartment',month=url.searchParams.get('month')??'',start=url.searchParams.get('start')??'',end=url.searchParams.get('end')??'';
    if(!Number.isInteger(bedrooms)||bedrooms<1||bedrooms>20||!Number.isInteger(adults)||adults<1||adults>16) return NextResponse.json({error:'Invalid bedrooms or guests'},{status:400});
    let query;try{query=listingQuery({locality:'',bedrooms,propertyType:type,adults,month,start,end});}catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Invalid period'},{status:400});}
    // Use the same filters and latest-observation selection as the price snapshot, across all localities.
    const sql=query.sql.replace('locality=? AND ','').replace('PARTITION BY provider,listing_id ORDER','PARTITION BY locality,provider,listing_id ORDER').replace('SELECT listing_id,name,url,','SELECT locality,listing_id,name,url,').replace(' ORDER BY observed_at DESC,total_cents ASC LIMIT 500','');
    const result=await propertyDb().prepare(`SELECT locality,COUNT(*) AS listings,AVG(total_cents/100.0/nights) AS averageNightly,MIN(total_cents/100.0/nights) AS minNightly,MAX(total_cents/100.0/nights) AS maxNightly,MAX(observed_at) AS lastObserved FROM (${sql}) GROUP BY locality ORDER BY locality`).bind(...query.args.slice(1)).all();
    return NextResponse.json({localities:result.results},{headers:{'Cache-Control':'no-store'}});
  }
  const property=propertyId?await propertyDb().prepare('SELECT location,property_type,bedrooms,strategy FROM properties WHERE id=? AND user_id=?').bind(propertyId,user.userId).first<{location:string;property_type:string;bedrooms:number;strategy:string}>():null;
  if(propertyId&&!property)return NextResponse.json({error:'Property not found'},{status:404});
  const propertyLocality=property?canonicalLocality(property.location)??property.location.split(',')[0].trim():'';
  const requested=url.searchParams.get('locality');
  const locality=requested?canonicalLocality(requested):propertyLocality;
  if(!locality)return NextResponse.json({error:'Choose a valid locality'},{status:400});
  const strategy=property?.strategy??'short-term',propertyType=property?.property_type??'apartment',bedrooms=property?.bedrooms??2;
  const requestedBedrooms=Number(url.searchParams.get('bedrooms'));
  const listingBedrooms=Number.isInteger(requestedBedrooms)&&requestedBedrooms>0&&requestedBedrooms<=20?requestedBedrooms:bedrooms;
  const requestedPropertyType=(url.searchParams.get('propertyType')??'apartment').toLowerCase();
  const listingPropertyType=['apartment','house','villa','room'].includes(requestedPropertyType)?requestedPropertyType:'apartment';
  const requestedMonth=url.searchParams.get('month')??'';
  const listingMonth=/^\d{4}-(0[1-9]|1[0-2])$/.test(requestedMonth)?requestedMonth:'';
  const adults=Number(url.searchParams.get('adults')??4);
  if(!Number.isInteger(adults)||adults<1||adults>16)return NextResponse.json({error:'Choose 1 to 16 guests'},{status:400});
  let listingSearch;
  try{listingSearch=listingQuery({locality,bedrooms:listingBedrooms,propertyType:listingPropertyType,adults,month:listingMonth,start:url.searchParams.get('start')??'',end:url.searchParams.get('end')??''});}
  catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Invalid period'},{status:400});}

  // Only exact matches in the property's own locality support its benchmark.
  const exact=property&&locality===propertyLocality?await propertyDb().prepare('SELECT * FROM market_comparables WHERE lower(locality)=lower(?) AND lower(property_type)=lower(?) AND bedrooms=? AND strategy=?').bind(locality,propertyType,bedrooms,strategy).all<Comparable>():{results:[]};
  const [nearby,listingResult,manualTotal]=await Promise.all([
    propertyDb().prepare('SELECT locality,property_type,bedrooms,strategy,monthly_price,nightly_rate,batch_updated_at FROM market_comparables WHERE lower(locality)=lower(?) AND strategy=? ORDER BY CASE WHEN lower(property_type)=lower(?) THEN 0 ELSE 1 END,abs(bedrooms-?),batch_updated_at DESC LIMIT 10').bind(locality,strategy,propertyType,bedrooms).all<Comparable>(),
    propertyDb().prepare(listingSearch.sql).bind(...listingSearch.args).all<Listing>(),
    propertyDb().prepare('SELECT COUNT(*) AS total FROM market_comparables WHERE lower(locality)=lower(?) AND strategy=?').bind(locality,strategy).first<{total:number}>()
  ]);
  const rows=exact.results;
  const listingRows=listingResult.results;
  const nightlyPrices=listingRows.map(row=>Number(row.total_cents)/100/Number(row.nights)).filter(value=>Number.isFinite(value)&&value>0).sort((a,b)=>a-b);
  const listingAverage=nightlyPrices.length?nightlyPrices.reduce((sum,value)=>sum+value,0)/nightlyPrices.length:0;
  const middle=Math.floor(nightlyPrices.length/2);
  const listingMedian=nightlyPrices.length?(nightlyPrices.length%2?nightlyPrices[middle]:(nightlyPrices[middle-1]+nightlyPrices[middle])/2):0;
  const observed=listingRows.map(row=>row.observed_at).sort();
  const listingSummary={count:nightlyPrices.length,averageNightly:listingAverage,medianNightly:listingMedian,minNightly:nightlyPrices[0]??0,maxNightly:nightlyPrices.at(-1)??0,bedrooms:listingBedrooms,propertyType:listingPropertyType,adults,month:listingMonth,period:listingSearch.period,lastUpdated:observed.at(-1)??null,oldestObservation:observed[0]??null,stale:observed.some(date=>Date.now()-Date.parse(date)>7*86400000),indicative:true};
  const base={count:rows.length,locality,propertyLocality,propertyType,bedrooms,strategy,localityComparables:nearby.results,manualCount:manualTotal?.total??0,listings:listingRows.slice(0,10),listingCount:listingRows.length,listingSummary};
  if(!rows.length)return NextResponse.json(base,{headers:{'Cache-Control':'no-store'}});
  const values=rows.map(row=>strategy==='short-term'?Number(row.nightly_rate):Number(row.monthly_price));const average=values.reduce((a,b)=>a+b,0)/values.length;const avgOccupancy=rows.reduce((sum,row)=>sum+Number(row.occupancy),0)/rows.length;
  const serviceRate=(key:keyof Comparable)=>Math.round(rows.reduce((sum,row)=>sum+Number(row[key]),0)/rows.length*100);
  return NextResponse.json({...base,average,min:Math.min(...values),max:Math.max(...values),avgOccupancy,estimatedMonthly:strategy==='short-term'?average*30*(avgOccupancy/100):average,services:{electricity:serviceRate('electricity_included'),water:serviceRate('water_included'),internet:serviceRate('internet_included'),buildingFees:serviceRate('building_fees_included')},updatedAt:Math.max(...rows.map(row=>Number(row.batch_updated_at)))},{headers:{'Cache-Control':'no-store'}});
}
