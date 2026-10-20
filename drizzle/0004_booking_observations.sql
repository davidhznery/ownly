ALTER TABLE airbnb_observations ADD COLUMN provider TEXT NOT NULL DEFAULT 'airbnb';
--> statement-breakpoint
ALTER TABLE airbnb_observations ADD COLUMN source_details TEXT NOT NULL DEFAULT '{}';
--> statement-breakpoint
ALTER TABLE airbnb_observations ADD COLUMN review_reason TEXT NOT NULL DEFAULT '';
--> statement-breakpoint
CREATE INDEX idx_observations_provider ON airbnb_observations(provider,locality);
