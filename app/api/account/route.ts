import { NextResponse } from 'next/server';
import { getChatGPTUser } from '@/app/chatgpt-auth';
import { ensureUserProfile,hasMarketAccess,isAdminEmail } from '@/db/queries';

export async function GET(){
  const user=await getChatGPTUser();if(!user)return NextResponse.json({error:'Unauthorized'},{status:401});
  const profile=await ensureUserProfile(user);if(!profile)return NextResponse.json({error:'Profile unavailable'},{status:500});
  const elapsed=Date.now()-profile.trial_started_at;const daysLeft=Math.max(0,7-Math.floor(elapsed/(24*60*60*1000)));
  return NextResponse.json({plan:profile.plan,trialStartedAt:profile.trial_started_at,daysLeft,marketAccess:hasMarketAccess(profile)||isAdminEmail(user.email)});
}
