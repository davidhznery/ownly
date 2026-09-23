import {requireChatGPTUser} from '@/app/chatgpt-auth';
import {isAdminEmail} from '@/db/queries';
import AirbnbClient from './AirbnbClient';
export const dynamic='force-dynamic';
export default async function Page(){const user=await requireChatGPTUser('/admin/airbnb');if(!isAdminEmail(user.email))return <main className="admin-page"><h1>Admin access required</h1><a href="/dashboard">Back to dashboard</a></main>;return <AirbnbClient/>;}
