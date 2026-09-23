import { NextResponse } from 'next/server';
import { getChatGPTUser } from '@/app/chatgpt-auth';
import { ensurePropertySchema,propertyDb } from '@/db/queries';

type Body=Record<string,unknown>;
async function ownsProperty(userId:string,propertyId:string){return propertyDb().prepare('SELECT id FROM properties WHERE id=? AND user_id=?').bind(propertyId,userId).first();}

export async function GET(request:Request){
  const user=await getChatGPTUser();if(!user)return NextResponse.json({error:'Unauthorized'},{status:401});await ensurePropertySchema();
  const propertyId=new URL(request.url).searchParams.get('propertyId');
  const query=propertyId?'SELECT * FROM monthly_actuals WHERE user_id=? AND property_id=? ORDER BY month DESC LIMIT 12':'SELECT * FROM monthly_actuals WHERE user_id=? ORDER BY month DESC LIMIT 120';
  const result=propertyId?await propertyDb().prepare(query).bind(user.userId,propertyId).all():await propertyDb().prepare(query).bind(user.userId).all();
  return NextResponse.json(result.results);
}

export async function POST(request:Request){
  const user=await getChatGPTUser();if(!user)return NextResponse.json({error:'Unauthorized'},{status:401});const body=await request.json() as Body;await ensurePropertySchema();
  const propertyId=String(body.propertyId??''),month=String(body.month??'');if(!propertyId||!/^\d{4}-\d{2}$/.test(month))return NextResponse.json({error:'Valid property and month are required'},{status:400});
  if(!await ownsProperty(user.userId,propertyId))return NextResponse.json({error:'Property not found'},{status:404});
  const existing=await propertyDb().prepare('SELECT id FROM monthly_actuals WHERE user_id=? AND property_id=? AND month=?').bind(user.userId,propertyId,month).first<{id:string}>();const id=existing?.id??crypto.randomUUID();
  await propertyDb().prepare(`INSERT INTO monthly_actuals (id,user_id,property_id,month,entry_mode,actual_income,actual_expenses,expense_breakdown,reservations,nights_occupied,platform_fees,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(user_id,property_id,month) DO UPDATE SET entry_mode=excluded.entry_mode,actual_income=excluded.actual_income,actual_expenses=excluded.actual_expenses,expense_breakdown=excluded.expense_breakdown,reservations=excluded.reservations,nights_occupied=excluded.nights_occupied,platform_fees=excluded.platform_fees,updated_at=excluded.updated_at`).bind(id,user.userId,propertyId,month,String(body.entryMode??'quick'),Number(body.actualIncome)||0,Number(body.actualExpenses)||0,JSON.stringify(body.expenseBreakdown??[]),Number(body.reservations)||0,Number(body.nightsOccupied)||0,Number(body.platformFees)||0,Date.now()).run();
  return NextResponse.json({id});
}

export async function DELETE(request:Request){
  const user=await getChatGPTUser();if(!user)return NextResponse.json({error:'Unauthorized'},{status:401});const id=new URL(request.url).searchParams.get('id');if(!id)return NextResponse.json({error:'Record id is required'},{status:400});await ensurePropertySchema();
  await propertyDb().prepare('DELETE FROM monthly_actuals WHERE id=? AND user_id=?').bind(id,user.userId).run();return NextResponse.json({ok:true});
}
