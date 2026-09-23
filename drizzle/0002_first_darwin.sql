CREATE TABLE `market_comparables` (
	`id` text PRIMARY KEY NOT NULL,
	`locality` text NOT NULL,
	`property_type` text NOT NULL,
	`bedrooms` integer NOT NULL,
	`strategy` text NOT NULL,
	`monthly_price` real DEFAULT 0 NOT NULL,
	`nightly_rate` real DEFAULT 0 NOT NULL,
	`occupancy` real DEFAULT 0 NOT NULL,
	`electricity_included` integer DEFAULT false NOT NULL,
	`water_included` integer DEFAULT false NOT NULL,
	`internet_included` integer DEFAULT false NOT NULL,
	`building_fees_included` integer DEFAULT false NOT NULL,
	`batch_updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_market_match` ON `market_comparables` (`locality`,`property_type`,`bedrooms`,`strategy`);--> statement-breakpoint
CREATE TABLE `monthly_actuals` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`property_id` text NOT NULL,
	`month` text NOT NULL,
	`entry_mode` text DEFAULT 'quick' NOT NULL,
	`actual_income` real DEFAULT 0 NOT NULL,
	`actual_expenses` real DEFAULT 0 NOT NULL,
	`expense_breakdown` text DEFAULT '[]' NOT NULL,
	`reservations` integer DEFAULT 0 NOT NULL,
	`nights_occupied` integer DEFAULT 0 NOT NULL,
	`platform_fees` real DEFAULT 0 NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_monthly_actuals_user_property_month` ON `monthly_actuals` (`user_id`,`property_id`,`month`);--> statement-breakpoint
CREATE INDEX `idx_monthly_actuals_property_id` ON `monthly_actuals` (`property_id`);--> statement-breakpoint
CREATE TABLE `user_profiles` (
	`user_id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`trial_started_at` integer NOT NULL,
	`plan` text DEFAULT 'trial' NOT NULL
);
--> statement-breakpoint
ALTER TABLE `properties` ADD `property_type` text DEFAULT 'apartment' NOT NULL;--> statement-breakpoint
ALTER TABLE `properties` ADD `bedrooms` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `properties` ADD `services_included` text DEFAULT '{}' NOT NULL;