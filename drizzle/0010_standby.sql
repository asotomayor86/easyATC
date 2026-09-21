ALTER TABLE "flights" ADD COLUMN "standby_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "flights" ADD COLUMN "standby_by" text;