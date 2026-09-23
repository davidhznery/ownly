CREATE TABLE `properties` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`location` text NOT NULL,
	`strategy` text NOT NULL,
	`purchase_price` real NOT NULL,
	`current_value` real NOT NULL,
	`monthly_rent` real DEFAULT 0 NOT NULL,
	`nightly_rate` real DEFAULT 0 NOT NULL,
	`occupancy` real DEFAULT 0 NOT NULL,
	`nights_available` real DEFAULT 0 NOT NULL,
	`other_income` real DEFAULT 0 NOT NULL,
	`operating_expenses` real DEFAULT 0 NOT NULL,
	`mortgage_payment` real DEFAULT 0 NOT NULL,
	`loan_balance` real DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_properties_user_id` ON `properties` (`user_id`);