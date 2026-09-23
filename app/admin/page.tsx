import { requireChatGPTUser } from '@/app/chatgpt-auth';
import { isAdminEmail } from '@/db/queries';
import AdminClient from './AdminClient';
import Brand from '@/app/components/Brand';
export const dynamic='force-dynamic';
export default async function AdminPage(){const user=await requireChatGPTUser('/admin');if(!isAdminEmail(user.email))return <main className="legal"><Brand href="/dashboard"/><h1>Administrator access only</h1><p>This area is reserved for approved Ownly administrators.</p><a className="button" href="/dashboard">Return to dashboard</a></main>;return <AdminClient/>;}
