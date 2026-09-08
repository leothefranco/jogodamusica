CREATE TYPE "public"."theme_editorial_state" AS ENUM('draft', 'published');--> statement-breakpoint
ALTER TABLE "themes" ADD COLUMN "editorial_state" "theme_editorial_state";--> statement-breakpoint
UPDATE "themes" SET "editorial_state" = CASE WHEN "is_active" THEN 'published'::"theme_editorial_state" ELSE 'draft'::"theme_editorial_state" END;--> statement-breakpoint
ALTER TABLE "themes" ALTER COLUMN "editorial_state" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "themes" ADD CONSTRAINT "themes_editorial_state_check" CHECK ("themes"."is_active" = ("themes"."editorial_state" = 'published'));--> statement-breakpoint
-- A legacy insert omits editorial_state. Explicit pairs must be coherent.
-- On update, synchronize the field not changed by the caller; the CHECK rejects conflicts.
CREATE FUNCTION "public"."sync_theme_editorial_state"() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = pg_catalog AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.editorial_state IS NULL THEN
      NEW.editorial_state := CASE WHEN NEW.is_active THEN 'published' ELSE 'draft' END;
    END IF;
  ELSIF NEW.is_active IS DISTINCT FROM OLD.is_active
    AND NEW.editorial_state IS NOT DISTINCT FROM OLD.editorial_state THEN
    NEW.editorial_state := CASE WHEN NEW.is_active THEN 'published' ELSE 'draft' END;
  ELSIF NEW.editorial_state IS DISTINCT FROM OLD.editorial_state
    AND NEW.is_active IS NOT DISTINCT FROM OLD.is_active THEN
    NEW.is_active := NEW.editorial_state = 'published';
  END IF;
  RETURN NEW;
END;
$$;--> statement-breakpoint
REVOKE ALL ON FUNCTION "public"."sync_theme_editorial_state"() FROM PUBLIC, anon, authenticated;--> statement-breakpoint
CREATE TRIGGER "themes_sync_editorial_state"
BEFORE INSERT OR UPDATE OF "is_active", "editorial_state" ON "public"."themes"
FOR EACH ROW EXECUTE FUNCTION "public"."sync_theme_editorial_state"();
