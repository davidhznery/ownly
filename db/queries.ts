import { env } from 'cloudflare:workers';

export async function ensurePropertySchema(){
  const db=env.DB;
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS properties (id TEXT PRIMARY KEY,user_id TEXT NOT NULL,name TEXT NOT NULL,location TEXT NOT NULL,strategy TEXT NOT NULL,property_type TEXT NOT NULL DEFAULT 'apartment',bedrooms INTEGER NOT NULL DEFAULT 1,services_included TEXT NOT NULL DEFAULT '{}',purchase_price REAL NOT NULL,current_value REAL NOT NULL,monthly_rent REAL NOT NULL DEFAULT 0,nightly_rate REAL NOT NULL DEFAULT 0,occupancy REAL NOT NULL DEFAULT 0,nights_available REAL NOT NULL DEFAULT 0,other_income REAL NOT NULL DEFAULT 0,operating_expenses REAL NOT NULL DEFAULT 0,expense_breakdown TEXT NOT NULL DEFAULT '[]',mortgage_payment REAL NOT NULL DEFAULT 0,loan_balance REAL NOT NULL DEFAULT 0,created_at INTEGER NOT NULL)`),
    db.prepare('CREATE INDEX IF NOT EXISTS idx_properties_user_id ON properties(user_id)'),
    db.prepare(`CREATE TABLE IF NOT EXISTS monthly_actuals (id TEXT PRIMARY KEY,user_id TEXT NOT NULL,property_id TEXT NOT NULL,month TEXT NOT NULL,entry_mode TEXT NOT NULL DEFAULT 'quick',actual_income REAL NOT NULL DEFAULT 0,actual_expenses REAL NOT NULL DEFAULT 0,expense_breakdown TEXT NOT NULL DEFAULT '[]',reservations INTEGER NOT NULL DEFAULT 0,nights_occupied INTEGER NOT NULL DEFAULT 0,platform_fees REAL NOT NULL DEFAULT 0,updated_at INTEGER NOT NULL)`),
    db.prepare('CREATE UNIQUE INDEX IF NOT EXISTS idx_monthly_actuals_user_property_month ON monthly_actuals(user_id,property_id,month)'),
    db.prepare('CREATE INDEX IF NOT EXISTS idx_monthly_actuals_property_id ON monthly_actuals(property_id)'),
    db.prepare(`CREATE TABLE IF NOT EXISTS market_comparables (id TEXT PRIMARY KEY,locality TEXT NOT NULL,property_type TEXT NOT NULL,bedrooms INTEGER NOT NULL,strategy TEXT NOT NULL,monthly_price REAL NOT NULL DEFAULT 0,nightly_rate REAL NOT NULL DEFAULT 0,occupancy REAL NOT NULL DEFAULT 0,electricity_included INTEGER NOT NULL DEFAULT 0,water_included INTEGER NOT NULL DEFAULT 0,internet_included INTEGER NOT NULL DEFAULT 0,building_fees_included INTEGER NOT NULL DEFAULT 0,batch_updated_at INTEGER NOT NULL)`),
    db.prepare('CREATE INDEX IF NOT EXISTS idx_market_match ON market_comparables(locality,property_type,bedrooms,strategy)'),
    db.prepare(`CREATE TABLE IF NOT EXISTS user_profiles (user_id TEXT PRIMARY KEY,email TEXT NOT NULL,trial_started_at INTEGER NOT NULL,plan TEXT NOT NULL DEFAULT 'trial')`),
  ]);
  const columns=await db.prepare('PRAGMA table_info(properties)').all<{name:string}>();
  const names=new Set(columns.results.map(column=>column.name));
  if(!names.has('management_type'))await db.prepare("ALTER TABLE properties ADD COLUMN management_type TEXT NOT NULL DEFAULT 'owner'").run();
  if(!names.has('lease_rent'))await db.prepare('ALTER TABLE properties ADD COLUMN lease_rent REAL NOT NULL DEFAULT 0').run();
  if(!names.has('expense_breakdown'))await db.prepare("ALTER TABLE properties ADD COLUMN expense_breakdown TEXT NOT NULL DEFAULT '[]'").run();
  if(!names.has('property_type'))await db.prepare("ALTER TABLE properties ADD COLUMN property_type TEXT NOT NULL DEFAULT 'apartment'").run();
  if(!names.has('bedrooms'))await db.prepare('ALTER TABLE properties ADD COLUMN bedrooms INTEGER NOT NULL DEFAULT 1').run();
  if(!names.has('services_included'))await db.prepare("ALTER TABLE properties ADD COLUMN services_included TEXT NOT NULL DEFAULT '{}'").run();
}

export async function ensureUserProfile(user:{userId:string;email:string}){
  await ensurePropertySchema();
  await env.DB.prepare("INSERT OR IGNORE INTO user_profiles (user_id,email,trial_started_at,plan) VALUES (?,?,?,'trial')").bind(user.userId,user.email,Date.now()).run();
  return env.DB.prepare('SELECT user_id,email,trial_started_at,plan FROM user_profiles WHERE user_id=?').bind(user.userId).first<{user_id:string;email:string;trial_started_at:number;plan:string}>();
}

export function hasMarketAccess(profile:{trial_started_at:number;plan:string}){
  return profile.plan==='market_pro'||Date.now()-profile.trial_started_at<=7*24*60*60*1000;
}

export function isAdminEmail(email:string){
  const configured=(process.env.ADMIN_EMAILS??'').split(',').map(value=>value.trim().toLowerCase()).filter(Boolean);
  return configured.includes(email.toLowerCase());
}

export function propertyDb(){return env.DB;}
