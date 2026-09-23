import {NextResponse} from 'next/server';
import {getChatGPTUser} from '@/app/chatgpt-auth';
import {isAdminEmail} from '@/db/queries';
export async function GET(){const user=await getChatGPTUser();if(!user||!isAdminEmail(user.email))return NextResponse.json({error:'Forbidden'},{status:403});return NextResponse.json({available:false,searches:[],runs:[]});}
export async function POST(){const user=await getChatGPTUser();if(!user||!isAdminEmail(user.email))return NextResponse.json({error:'Forbidden'},{status:403});return NextResponse.json({error:'Run the Docker installation to use automatic searches.'},{status:503});}
