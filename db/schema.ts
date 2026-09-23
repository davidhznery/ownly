import { index,integer,real,sqliteTable,text,uniqueIndex } from 'drizzle-orm/sqlite-core';

export const properties=sqliteTable('properties',{
  id:text('id').primaryKey(),userId:text('user_id').notNull(),name:text('name').notNull(),location:text('location').notNull(),strategy:text('strategy').notNull(),
  managementType:text('management_type').notNull().default('owner'),leaseRent:real('lease_rent').notNull().default(0),
  propertyType:text('property_type').notNull().default('apartment'),bedrooms:integer('bedrooms').notNull().default(1),servicesIncluded:text('services_included').notNull().default('{}'),
  purchasePrice:real('purchase_price').notNull(),currentValue:real('current_value').notNull(),monthlyRent:real('monthly_rent').notNull().default(0),nightlyRate:real('nightly_rate').notNull().default(0),occupancy:real('occupancy').notNull().default(0),nightsAvailable:real('nights_available').notNull().default(0),otherIncome:real('other_income').notNull().default(0),operatingExpenses:real('operating_expenses').notNull().default(0),expenseBreakdown:text('expense_breakdown').notNull().default('[]'),mortgagePayment:real('mortgage_payment').notNull().default(0),loanBalance:real('loan_balance').notNull().default(0),createdAt:integer('created_at').notNull()
},table=>[index('idx_properties_user_id').on(table.userId)]);

export const monthlyActuals=sqliteTable('monthly_actuals',{
  id:text('id').primaryKey(),userId:text('user_id').notNull(),propertyId:text('property_id').notNull(),month:text('month').notNull(),entryMode:text('entry_mode').notNull().default('quick'),
  actualIncome:real('actual_income').notNull().default(0),actualExpenses:real('actual_expenses').notNull().default(0),expenseBreakdown:text('expense_breakdown').notNull().default('[]'),
  reservations:integer('reservations').notNull().default(0),nightsOccupied:integer('nights_occupied').notNull().default(0),platformFees:real('platform_fees').notNull().default(0),updatedAt:integer('updated_at').notNull()
},table=>[uniqueIndex('idx_monthly_actuals_user_property_month').on(table.userId,table.propertyId,table.month),index('idx_monthly_actuals_property_id').on(table.propertyId)]);

export const marketComparables=sqliteTable('market_comparables',{
  id:text('id').primaryKey(),locality:text('locality').notNull(),propertyType:text('property_type').notNull(),bedrooms:integer('bedrooms').notNull(),strategy:text('strategy').notNull(),
  monthlyPrice:real('monthly_price').notNull().default(0),nightlyRate:real('nightly_rate').notNull().default(0),occupancy:real('occupancy').notNull().default(0),
  electricityIncluded:integer('electricity_included',{mode:'boolean'}).notNull().default(false),waterIncluded:integer('water_included',{mode:'boolean'}).notNull().default(false),internetIncluded:integer('internet_included',{mode:'boolean'}).notNull().default(false),buildingFeesIncluded:integer('building_fees_included',{mode:'boolean'}).notNull().default(false),batchUpdatedAt:integer('batch_updated_at').notNull()
},table=>[index('idx_market_match').on(table.locality,table.propertyType,table.bedrooms,table.strategy)]);

export const userProfiles=sqliteTable('user_profiles',{
  userId:text('user_id').primaryKey(),email:text('email').notNull(),trialStartedAt:integer('trial_started_at').notNull(),plan:text('plan').notNull().default('trial')
});

export const airbnbObservations=sqliteTable('airbnb_observations',{
 id:text('id').primaryKey(),listingId:text('listing_id').notNull(),name:text('name').notNull(),url:text('url').notNull(),locality:text('locality').notNull(),propertyType:text('property_type').notNull(),bedrooms:integer('bedrooms').notNull(),adults:integer('adults').notNull(),checkin:text('checkin').notNull(),checkout:text('checkout').notNull(),nights:integer('nights').notNull(),totalCents:integer('total_cents').notNull(),observedAt:text('observed_at').notNull(),importedBy:text('imported_by').notNull()
},table=>[index('idx_airbnb_search').on(table.locality,table.bedrooms,table.adults,table.checkin,table.checkout)]);
