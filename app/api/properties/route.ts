import { NextResponse } from 'next/server';
import { getChatGPTUser } from '@/app/chatgpt-auth';
import { ensurePropertySchema,propertyDb } from '@/db/queries';
import { canonicalLocality } from '@/lib/localities';

type Body=Record<string,unknown>;
const string=(body:Body,key:string)=>String(body[key]??'');
const number=(body:Body,key:string)=>Number(body[key])||0;
function validateManagement(body:Body){
  if(body.managementType!==undefined&&!['owner','sublet'].includes(String(body.managementType)))return 'Choose owner or sublet';
  if(body.leaseRent!==undefined&&(!Number.isFinite(Number(body.leaseRent))||Number(body.leaseRent)<0))return 'Monthly rent paid must be zero or more';
  if(body.managementType==='sublet'){body.purchasePrice=0;body.currentValue=0;body.mortgagePayment=0;body.loanBalance=0;}else{body.leaseRent=0;}
  return null;
}

export async function GET(){
  const user=await getChatGPTUser();if(!user)return NextResponse.json({error:'Unauthorized'},{status:401});
  await ensurePropertySchema();
  const result=await propertyDb().prepare('SELECT * FROM properties WHERE user_id=? ORDER BY created_at DESC').bind(user.userId).all();
  return NextResponse.json(result.results);
}

export async function POST(request:Request){
  const user=await getChatGPTUser();if(!user)return NextResponse.json({error:'Unauthorized'},{status:401});
  const body=await request.json() as Body;const error=validateManagement(body);if(error)return NextResponse.json({error},{status:400});const location=canonicalLocality(string(body,'location'));if(!location)return NextResponse.json({error:'Choose a locality from the list'},{status:400});await ensurePropertySchema();const id=crypto.randomUUID();
  await propertyDb().prepare(`INSERT INTO properties (id,user_id,name,location,strategy,property_type,bedrooms,services_included,purchase_price,current_value,monthly_rent,nightly_rate,occupancy,nights_available,other_income,operating_expenses,expense_breakdown,mortgage_payment,loan_balance,management_type,lease_rent,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(id,user.userId,string(body,'name'),location,string(body,'strategy'),string(body,'propertyType')||'apartment',number(body,'bedrooms')||1,JSON.stringify(body.servicesIncluded??{}),number(body,'purchasePrice'),number(body,'currentValue'),number(body,'monthlyRent'),number(body,'nightlyRate'),number(body,'occupancy'),number(body,'nightsAvailable'),number(body,'otherIncome'),number(body,'operatingExpenses'),JSON.stringify(body.expenseBreakdown??[]),number(body,'mortgagePayment'),number(body,'loanBalance'),string(body,'managementType')||'owner',number(body,'leaseRent'),Date.now()).run();
  return NextResponse.json({id},{status:201});
}

export async function PUT(request:Request){
  const user=await getChatGPTUser();if(!user)return NextResponse.json({error:'Unauthorized'},{status:401});
  const body=await request.json() as Body;const error=validateManagement(body);if(error)return NextResponse.json({error},{status:400});const id=string(body,'id');if(!id)return NextResponse.json({error:'Property id is required'},{status:400});const location=canonicalLocality(string(body,'location'));if(!location)return NextResponse.json({error:'Choose a locality from the list'},{status:400});await ensurePropertySchema();
  const result=await propertyDb().prepare(`UPDATE properties SET name=?,location=?,strategy=?,property_type=?,bedrooms=?,services_included=?,purchase_price=?,current_value=?,monthly_rent=?,nightly_rate=?,occupancy=?,nights_available=?,other_income=?,operating_expenses=?,expense_breakdown=?,mortgage_payment=?,loan_balance=?,management_type=?,lease_rent=? WHERE id=? AND user_id=?`).bind(string(body,'name'),location,string(body,'strategy'),string(body,'propertyType')||'apartment',number(body,'bedrooms')||1,JSON.stringify(body.servicesIncluded??{}),number(body,'purchasePrice'),number(body,'currentValue'),number(body,'monthlyRent'),number(body,'nightlyRate'),number(body,'occupancy'),number(body,'nightsAvailable'),number(body,'otherIncome'),number(body,'operatingExpenses'),JSON.stringify(body.expenseBreakdown??[]),number(body,'mortgagePayment'),number(body,'loanBalance'),string(body,'managementType')||'owner',number(body,'leaseRent'),id,user.userId).run();
  if(!result.meta.changes)return NextResponse.json({error:'Property not found'},{status:404});return NextResponse.json({id});
}

export async function DELETE(request:Request){
  const user=await getChatGPTUser();if(!user)return NextResponse.json({error:'Unauthorized'},{status:401});
  const id=new URL(request.url).searchParams.get('id');if(!id)return NextResponse.json({error:'Property id is required'},{status:400});await ensurePropertySchema();
  const owns=await propertyDb().prepare('SELECT id FROM properties WHERE id=? AND user_id=?').bind(id,user.userId).first();if(!owns)return NextResponse.json({error:'Property not found'},{status:404});
  await propertyDb().batch([propertyDb().prepare('DELETE FROM monthly_actuals WHERE property_id=? AND user_id=?').bind(id,user.userId),propertyDb().prepare('DELETE FROM properties WHERE id=? AND user_id=?').bind(id,user.userId)]);
  return NextResponse.json({ok:true});
}
