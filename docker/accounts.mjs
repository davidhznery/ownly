import fs from 'node:fs';
import path from 'node:path';
import {randomBytes,randomUUID,scryptSync,timingSafeEqual} from 'node:crypto';
import StripeClient from 'stripe';

export function createAccountStore(dataDir){
 const file=path.join(dataDir,'accounts.json');
 const read=()=>{try{return JSON.parse(fs.readFileSync(file,'utf8'));}catch(error){if(error.code==='ENOENT')return [];throw error;}};
 const write=accounts=>{const temporary=file+'.tmp';fs.writeFileSync(temporary,JSON.stringify(accounts),'utf8');fs.renameSync(temporary,file);};
 return {
  all:read,
  byId(id){return read().find(account=>account.id===id)||null;},
  byEmail(email){return read().find(account=>account.email===String(email||'').trim().toLowerCase())||null;},
  byGoogleId(id){return id?read().find(account=>account.googleId===id)||null:null;},
  create(email,passwordHash,plan,{googleId=null,name=null}={}){
   const accounts=read(),normalized=email.trim().toLowerCase();
   // A retry must never replace the password of an existing, unpaid account.
   if(accounts.some(a=>a.email===normalized||(googleId&&a.googleId===googleId)))throw Error('ACCOUNT_EXISTS');
   const account={id:randomUUID(),email:normalized,passwordHash,googleId,name,plan,status:'pending',createdAt:Date.now(),stripeCustomerId:null,stripeSubscriptionId:null,trialStartedAt:null,trialEndsAt:null};
   accounts.push(account);write(accounts);return account;
  },
  linkGoogle(id,googleId){const accounts=read(),account=accounts.find(a=>a.id===id);if(!account||accounts.some(a=>a.id!==id&&a.googleId===googleId))throw Error('GOOGLE_ALREADY_LINKED');if(account.googleId&&account.googleId!==googleId)throw Error('GOOGLE_ALREADY_LINKED');account.googleId=googleId;write(accounts);return account;},
  requestPasswordReset(id,tokenHash,expiresAt,requestedAt){const accounts=read(),account=accounts.find(a=>a.id===id);if(!account)return null;account.resetTokenHash=tokenHash;account.resetExpiresAt=expiresAt;account.resetRequestedAt=requestedAt;write(accounts);return account;},
  clearPasswordReset(id,tokenHash){const accounts=read(),account=accounts.find(a=>a.id===id);if(!account||account.resetTokenHash!==tokenHash)return;account.resetTokenHash=null;account.resetExpiresAt=null;account.resetRequestedAt=null;write(accounts);},
  byResetToken(tokenHash,now=Date.now()){return read().find(account=>account.resetTokenHash===tokenHash&&account.resetExpiresAt>now)||null;},
  consumePasswordReset(tokenHash,passwordHash,now=Date.now()){const accounts=read(),account=accounts.find(a=>a.resetTokenHash===tokenHash&&a.resetExpiresAt>now);if(!account)return null;account.passwordHash=passwordHash;account.passwordChangedAt=now;account.resetTokenHash=null;account.resetExpiresAt=null;write(accounts);return account;},
  update(id,changes){const accounts=read(),index=accounts.findIndex(account=>account.id===id);if(index<0)return null;accounts[index]={...accounts[index],...changes};write(accounts);return accounts[index];},
  bySubscription(subscriptionId){return subscriptionId?read().find(a=>a.stripeSubscriptionId===subscriptionId)||null:null;},
  byCustomer(customerId){return customerId?read().find(a=>a.stripeCustomerId===customerId)||null:null;},
  verify(account,password){if(!account?.passwordHash)return false;const [salt,stored]=account.passwordHash.split(':');if(!salt||!stored)return false;const actual=scryptSync(password,salt,64),expected=Buffer.from(stored,'hex');return actual.length===expected.length&&timingSafeEqual(actual,expected);},
  hash(password){const salt=randomUUID(),digest=scryptSync(password,salt,64);return `${salt}:${digest.toString('hex')}`;}
 };
}

const plans={individual:{name:'Ownly Individual',amount:900,limit:3},portfolio:{name:'Ownly Portfolio',amount:2500,limit:15}};
export function getPlan(id){return Object.hasOwn(plans,id)?plans[id]:null;}
export function hasProductAccess(account,now=Date.now()){
 return Boolean(account&&(account.owner||account.status==='active'||(account.status==='trialing'&&(!account.trialEndsAt||account.trialEndsAt>now))));
}
export function accountHeaders(account){return {'oai-authenticated-user-id':account.id,'oai-authenticated-user-email':account.email,'oai-authenticated-user-full-name':encodeURIComponent(account.name||account.email.split('@')[0]),'oai-authenticated-user-full-name-encoding':'percent-encoded-utf-8','x-ownly-plan':account.plan,'x-ownly-status':account.status,'x-ownly-trial-end':String(account.trialEndsAt||0)};}

export function createStripeClient(key){return key?new StripeClient(key,{apiVersion:'2026-08-26.dahlia'}):null;}

export async function createCheckout(stripe,{account,planId,priceIds,origin,idempotencyKey}){
 const plan=getPlan(planId),price=priceIds[planId];if(!stripe||!plan||!price)throw Error('The selected Stripe monthly price is not configured.');
 const alphabet='abcdefghijklmnopqrstuvwxyz',suffix=Array.from(randomBytes(8),byte=>alphabet[byte%alphabet.length]).join('');
 return stripe.checkout.sessions.create({
  mode:'subscription',...(account.stripeCustomerId?{customer:account.stripeCustomerId}:{customer_email:account.email}),client_reference_id:account.id,
  success_url:`${origin}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
  cancel_url:`${origin}/billing/cancel`,payment_method_collection:'always',
  line_items:[{price,quantity:1}],
  subscription_data:{...(!account.trialStartedAt&&!account.stripeSubscriptionId?{trial_period_days:7,trial_settings:{end_behavior:{missing_payment_method:'cancel'}}}:{}),metadata:{account_id:account.id,plan:planId}},
  metadata:{account_id:account.id,plan:planId},integration_identifier:`ownly-subscriptions-${suffix}`
 },{idempotencyKey});
}

export function verifyStripeSignature(stripe,payload,header,secret){
 try{return Boolean(stripe&&stripe.webhooks.constructEvent(payload,header,secret));}catch{return false;}
}
