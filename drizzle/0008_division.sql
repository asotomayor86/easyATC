ALTER TABLE "flights" ADD COLUMN "parent_id" uuid;--> statement-breakpoint
ALTER TABLE "flights" ADD COLUMN "created_by" text;--> statement-breakpoint
ALTER TABLE "flights" ADD COLUMN "created_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "flights" ADD COLUMN "merged_from" text;--> statement-breakpoint
ALTER TABLE "flights" ADD COLUMN "merged_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "flights_base" jsonb DEFAULT '[]'::jsonb NOT NULL;