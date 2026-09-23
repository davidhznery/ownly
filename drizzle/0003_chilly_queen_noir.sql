CREATE TABLE `airbnb_observations` (
	`id` text PRIMARY KEY NOT NULL,
	`listing_id` text NOT NULL,
	`name` text NOT NULL,
	`url` text NOT NULL,
	`locality` text NOT NULL,
	`property_type` text NOT NULL,
	`bedrooms` integer NOT NULL,
	`adults` integer NOT NULL,
	`checkin` text NOT NULL,
	`checkout` text NOT NULL,
	`nights` integer NOT NULL,
	`total_cents` integer NOT NULL,
	`observed_at` text NOT NULL,
	`imported_by` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_airbnb_search` ON `airbnb_observations` (`locality`,`bedrooms`,`adults`,`checkin`,`checkout`);