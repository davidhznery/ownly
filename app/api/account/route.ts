import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { getChatGPTUser } from '@/app/chatgpt-auth';
import { ensureUserProfile,hasMarketAccess,isAdminEmail } from '@/db/queries';

export async function GET(){
  const user=await getChatGPTUser();if(!user)return NextResponse.json({error:'Unauthorized'},{status:401});
  const profile=await ensureUserProfile(user);if(!profile)return NextResponse.json({error:'Profile unavailable'},{status:500});
  const elapsed=Date.now()-profile.trial_started_at;const daysLeft=Math.max(0,7-Math.floor(elapsed/(24*60*60*1000)));
  const requestHeaders=await headers(),billingPlan=requestHeaders.get('x-ownly-plan');
  const billingStatus=requestHeaders.get('x-ownly-status'),trialEndsAt=Number(requestHeaders.get('x-ownly-trial-end'))||null;
  const remaining=billingStatus?(billingStatus==='trialing'&&trialEndsAt?Math.max(0,Math.ceil((trialEndsAt-Date.now())/86400000)):0):daysLeft;
  return NextResponse.json({plan:billingPlan==='portfolio'?'portfolio':billingPlan==='individual'?'individual':profile.plan,status:billingStatus,trialEndsAt,trialStartedAt:profile.trial_started_at,daysLeft:remaining,marketAccess:billingPlan==='portfolio'||(!billingPlan&&hasMarketAccess(profile))||isAdminEmail(user.email)});
}
