import { requireChatGPTUser } from '@/app/chatgpt-auth';
import { isAdminEmail } from '@/db/queries';
import DashboardClient from './DashboardClient';
export const dynamic='force-dynamic';
export default async function DashboardPage(){const user=await requireChatGPTUser('/dashboard');return <DashboardClient displayName={user.fullName??user.email.split('@')[0]} email={user.email} isAdmin={isAdminEmail(user.email)}/>;}
