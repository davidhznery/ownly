import {getPlan,createCheckout,verifyStripeSignature} from './accounts.mjs';

const escapeHtml=value=>String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');
function page(res,status,title,message){res.writeHead(status,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});res.end('<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+title+' · Ownly Malta</title><style>body{font:16px system-ui;background:#f2f6f3;color:#142c25;min-height:100vh;display:grid;place-items:center;margin:0;padding:24px}.card{max-width:460px;background:white;border:1px solid #dce8df;border-radius:20px;padding:36px}.brand{color:#176c4a;font-size:28px;font-weight:800}p{line-height:1.6;color:#52685d}a{color:#176c4a}</style><main class="card"><div class="brand">Ownly Malta</div><h1>'+title+'</h1><p>'+message+'</p><p><a href="/#pricing">Back to plans</a> · <a href="/login">Sign in</a></p></main></html>');}
async function readForm(req,limit){let input='';for await(const chunk of req){input+=chunk;if(input.length>limit)throw Error('Request is too large.');}return new URLSearchParams(input);}
export function registerPage(selected,available=true){
 if(!available)return '<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Registration opening soon · Ownly Malta</title><style>body{font:16px system-ui;background:#f2f6f3;color:#142c25;min-height:100vh;display:grid;place-items:center;margin:0;padding:24px}.card{max-width:460px;background:white;border:1px solid #dce8df;border-radius:20px;padding:36px}.brand{color:#176c4a;font-size:28px;font-weight:800}p{line-height:1.6;color:#52685d}a{color:#176c4a}</style><main class="card"><div class="brand">Ownly Malta</div><h1>Registration opening soon</h1><p>We are finishing the secure Stripe setup. No card has been requested or saved. Please check back shortly.</p><p><a href="/#pricing">Back to plans</a> · <a href="/login">Sign in</a></p></main></html>';
 return '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Start your free trial · Ownly Malta</title><style>*,*:before,*:after{box-sizing:border-box}body{min-height:100vh;margin:0;display:grid;place-items:center;padding:24px;background:#f2f6f3;color:#142c25;font:16px system-ui,sans-serif}.card{width:min(100%,460px);background:white;border:1px solid #dce8df;border-radius:22px;padding:36px;box-shadow:0 25px 65px #1b493019}.brand{font-size:28px;font-weight:800;color:#176c4a}h1{font-size:25px;margin:24px 0 8px}p{color:#52685d;line-height:1.5}label{display:block;margin:18px 0 6px;font-size:14px;font-weight:700}input,select{width:100%;padding:13px;border:1px solid #bccfc2;border-radius:10px;font:inherit}button{width:100%;margin-top:24px;padding:14px;border:0;border-radius:10px;background:#166b49;color:white;font:inherit;font-weight:700;cursor:pointer}.note{font-size:13px}</style></head><body><main class="card"><div class="brand">Ownly Malta</div><h1>Start your 7-day free trial</h1><p>Choose a plan and add your card securely through Stripe. You will not be charged during the trial. Cancel before day seven to avoid the first monthly payment.</p><form method="post" action="/checkout"><label for="plan">Plan</label><select id="plan" name="plan" required><option value="individual"'+(selected==='individual'?' selected':'')+'>Individual — €9/month</option><option value="portfolio"'+(selected==='portfolio'?' selected':'')+'>Portfolio — €25/month</option></select><label for="email">Email</label><input id="email" name="email" type="email" autocomplete="email" required><label for="password">Create a password</label><input id="password" name="password" type="password" minlength="12" autocomplete="new-password" required><button type="submit">Continue to secure checkout</button></form><p class="note">Card details are entered on Stripe. By continuing, you agree to the <a href="/terms">Terms</a> and <a href="/privacy">Privacy Policy</a>.</p><p><a href="/">Back to Ownly Malta</a> · <a href="/login">Already have an account?</a></p></main></body></html>';
}

export async function handleBilling(req,res,url,{origin,stripe,stripeReady,webhookSecret,priceIds,accounts,getSession,signedSession,sessionCookie,json}){
 if(req.method==='GET'&&url.pathname==='/register'){
  const selected=getPlan(url.searchParams.get('plan'))?url.searchParams.get('plan'):'individual';
  res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'"});res.end(registerPage(selected,stripeReady));return true;
 }
 if(req.method==='POST'&&url.pathname==='/checkout'){
  if(req.headers.origin&&req.headers.origin!==origin){json(403,{error:'Invalid origin'});return true;}
  if(!stripeReady){page(res,503,'Stripe setup needed','Complete the secure Stripe configuration before opening subscriptions.');return true;}
  try{const input=await readForm(req,4096),email=String(input.get('email')||'').trim().toLowerCase(),password=String(input.get('password')||''),planId=String(input.get('plan')||'');
   if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||password.length<12||!getPlan(planId)){page(res,400,'Check your details','Enter a valid email, a password with at least 12 characters, and choose a plan.');return true;}
   const account=accounts.create(email,accounts.hash(password),planId),checkout=await createCheckout(stripe,{account,planId,priceIds,origin});accounts.update(account.id,{stripeCheckoutSessionId:checkout.id});res.writeHead(303,{'Location':checkout.url,'Cache-Control':'no-store'});res.end();
  }catch(error){page(res,400,'We could not start checkout',escapeHtml(error.message));}return true;
 }
 if(req.method==='GET'&&url.pathname==='/billing/success'){
  if(!stripe||!url.searchParams.get('session_id')){page(res,400,'Checkout not found','Open the checkout link from Ownly and try again.');return true;}
  try{const checkout=await stripe.checkout.sessions.retrieve(url.searchParams.get('session_id'),{expand:['subscription']}),account=accounts.byId(checkout.client_reference_id||checkout.metadata?.account_id),subscription=typeof checkout.subscription==='object'?checkout.subscription:null;
   if(!account||account.stripeCheckoutSessionId!==checkout.id||checkout.mode!=='subscription'||!subscription||!['trialing','active'].includes(subscription.status)){page(res,403,'Subscription not active','Complete card setup in Stripe Checkout before signing in.');return true;}
   accounts.update(account.id,{status:subscription.status,stripeCustomerId:typeof checkout.customer==='string'?checkout.customer:checkout.customer?.id,stripeSubscriptionId:subscription.id});res.writeHead(303,{'Location':'/dashboard','Set-Cookie':sessionCookie(signedSession(account.id),origin),'Cache-Control':'no-store'});res.end();
  }catch(error){page(res,400,'Could not confirm your subscription',escapeHtml(error.message));}return true;
 }
 if(req.method==='GET'&&url.pathname==='/billing/cancel'){page(res,200,'Checkout cancelled','No subscription was started. You can choose a plan whenever you are ready. <a href="/#pricing">Back to plans</a>');return true;}
 if(req.method==='POST'&&url.pathname==='/stripe/webhook'){
  if(!webhookSecret||!stripe){json(503,{error:'Stripe webhook is not configured'});return true;}
  const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>1000000){json(413,{error:'Webhook too large'});return true;}chunks.push(chunk);}const raw=Buffer.concat(chunks),signature=req.headers['stripe-signature'];
  if(!verifyStripeSignature(stripe,raw,signature,webhookSecret)){json(400,{error:'Invalid Stripe signature'});return true;}
  const event=stripe.webhooks.constructEvent(raw,signature,webhookSecret),object=event.data?.object||{},customerId=typeof object.customer==='string'?object.customer:object.customer?.id;
  let account=null;
  if(event.type.startsWith('customer.subscription.'))account=accounts.bySubscription(object.id)||accounts.byCustomer(customerId)||accounts.byId(object.metadata?.account_id);
  else if(event.type==='checkout.session.completed'||event.type==='checkout.session.async_payment_succeeded')account=accounts.byId(object.client_reference_id)||accounts.byId(object.metadata?.account_id);
  else if(event.type.startsWith('invoice.'))account=accounts.bySubscription(typeof object.subscription==='string'?object.subscription:object.subscription?.id)||accounts.byCustomer(customerId);
  if(account&&['checkout.session.completed','checkout.session.async_payment_succeeded'].includes(event.type)){
   if(event.type==='checkout.session.async_payment_succeeded'&&object.payment_status!=='paid'){json(200,{received:true});return true;}
   const checkout=await stripe.checkout.sessions.retrieve(object.id,{expand:['subscription']}),subscription=typeof checkout.subscription==='object'?checkout.subscription:null;
   if(checkout.mode==='subscription'&&subscription&&['trialing','active'].includes(subscription.status))accounts.update(account.id,{stripeCustomerId:customerId,stripeSubscriptionId:subscription.id,status:subscription.status});
  }else if(account&&event.type.startsWith('customer.subscription.'))accounts.update(account.id,{stripeSubscriptionId:object.id,stripeCustomerId:customerId,status:object.status,plan:object.metadata?.plan||account.plan});
  else if(account&&event.type==='invoice.paid')accounts.update(account.id,{status:'active'});
  else if(account&&event.type==='invoice.payment_failed')accounts.update(account.id,{status:'past_due'});
  json(200,{received:true});return true;
 }
 if(req.method==='GET'&&url.pathname==='/billing/portal'){
  const session=getSession(req.headers.cookie);if(!session||session.owner){res.writeHead(303,{Location:'/login?next=%2Fdashboard'});res.end();return true;}
  if(!stripe||!session.stripeCustomerId){page(res,503,'Billing portal unavailable','Contact support to manage your subscription.');return true;}
  try{const portal=await stripe.billingPortal.sessions.create({customer:session.stripeCustomerId,return_url:origin+'/dashboard'});res.writeHead(303,{Location:portal.url,'Cache-Control':'no-store'});res.end();}catch(error){page(res,400,'Could not open billing portal',escapeHtml(error.message));}return true;
 }
 return false;
}
