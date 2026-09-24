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
  byEmail(email){return read().find(account=>account.email===email.toLowerCase())||null;},
  create(email,passwordHash,plan){const accounts=read(),existing=accounts.find(a=>a.email===email.toLowerCase());if(existing){if(existing.status!=='pending')throw Error('An account with this email already exists. Sign in or contact support.');existing.passwordHash=passwordHash;existing.plan=plan;write(accounts);return existing;}const account={id:randomUUID(),email:email.toLowerCase(),passwordHash,plan,status:'pending',createdAt:Date.now(),stripeCustomerId:null,stripeSubscriptionId:null};accounts.push(account);write(accounts);return account;},
  update(id,changes){const accounts=read(),index=accounts.findIndex(account=>account.id===id);if(index<0)return null;accounts[index]={...accounts[index],...changes};write(accounts);return accounts[index];},
  bySubscription(subscriptionId){return read().find(a=>a.stripeSubscriptionId===subscriptionId)||null;},
  byCustomer(customerId){return read().find(a=>a.stripeCustomerId===customerId)||null;},
  verify(account,password){if(!account?.passwordHash)return false;const [salt,stored]=account.passwordHash.split(':');if(!salt||!stored)return false;const actual=scryptSync(password,salt,64),expected=Buffer.from(stored,'hex');return actual.length===expected.length&&timingSafeEqual(actual,expected);},
  hash(password){const salt=randomUUID(),digest=scryptSync(password,salt,64);return `${salt}:${digest.toString('hex')}`;}
 };
}

const plans={individual:{name:'Ownly Individual',amount:900,limit:3},portfolio:{name:'Ownly Portfolio',amount:2500,limit:15}};
export function getPlan(id){return plans[id]||null;}
export function accountHeaders(account){return {'oai-authenticated-user-id':account.id,'oai-authenticated-user-email':account.email,'oai-authenticated-user-full-name':account.email.split('@')[0],'x-ownly-plan':account.plan};}

export function createStripeClient(key){return key?new StripeClient(key,{apiVersion:'2026-08-26.dahlia'}):null;}

export async function createCheckout(stripe,{account,planId,priceIds,origin}){
 const plan=getPlan(planId),price=priceIds[planId];if(!stripe||!plan||!price)throw Error('The selected Stripe monthly price is not configured.');
 const alphabet='abcdefghijklmnopqrstuvwxyz',suffix=Array.from(randomBytes(8),byte=>alphabet[byte%alphabet.length]).join('');
 return stripe.checkout.sessions.create({
  mode:'subscription',customer_email:account.email,client_reference_id:account.id,
  success_url:`${origin}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
  cancel_url:`${origin}/billing/cancel`,payment_method_collection:'always',
  line_items:[{price,quantity:1}],
  subscription_data:{trial_period_days:7,trial_settings:{end_behavior:{missing_payment_method:'cancel'}},metadata:{account_id:account.id,plan:planId}},
  metadata:{account_id:account.id,plan:planId},integration_identifier:`ownly-subscriptions-${suffix}`
 });
}

export function verifyStripeSignature(stripe,payload,header,secret){
 try{return Boolean(stripe&&stripe.webhooks.constructEvent(payload,header,secret));}catch{return false;}
}
