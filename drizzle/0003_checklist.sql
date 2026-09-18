ALTER TABLE "steps" ADD COLUMN "checklist" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "steps" ADD COLUMN "counts" boolean DEFAULT true NOT NULL;