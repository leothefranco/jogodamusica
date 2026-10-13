CREATE INDEX "source_availability_revision_idx" ON "source_availability_observations" USING btree ("song_id","region","revision");--> statement-breakpoint
CREATE INDEX "theme_songs_source_theme_idx" ON "theme_songs" USING btree ("song_id","theme_id");--> statement-breakpoint
ALTER TABLE "catalog_invalidation_outbox" ADD CONSTRAINT "catalog_invalidation_shape_check" CHECK ((
      "catalog_invalidation_outbox"."payload"->'schemaVersion' = '1'::jsonb
      and "catalog_invalidation_outbox"."payload"->'type' = '"source_health_changed"'::jsonb
      and "catalog_invalidation_outbox"."payload"->'cause' = '"health_change"'::jsonb
      and "catalog_invalidation_outbox"."payload"->'ruleVersion' = to_jsonb("catalog_invalidation_outbox"."rule_version")
      and "catalog_invalidation_outbox"."payload"->'source'->'revision' = to_jsonb("catalog_invalidation_outbox"."revision")
      and "catalog_invalidation_outbox"."payload"->'source'->'policyVersion' = to_jsonb("catalog_invalidation_outbox"."policy_version")
      and jsonb_typeof("catalog_invalidation_outbox"."payload"->'source'->'keyHash') = 'string'
      and jsonb_typeof("catalog_invalidation_outbox"."payload"->'source'->'region') = 'string'
      and jsonb_typeof("catalog_invalidation_outbox"."payload"->'theme'->'id') = 'string'
      and jsonb_typeof("catalog_invalidation_outbox"."payload"->'theme'->'slug') = 'string'
      and "catalog_invalidation_outbox"."payload"->'transition'->>'fromVisibility' in ('visible', 'hidden')
      and "catalog_invalidation_outbox"."payload"->'transition'->>'toVisibility' in ('visible', 'hidden')
      and "catalog_invalidation_outbox"."payload"->'transition'->>'fromOperationalState' in ('editorial_draft','healthy','degraded','suspended_pending_verification','suspended_insufficient_healthy_entries')
      and "catalog_invalidation_outbox"."payload"->'transition'->>'toOperationalState' in ('editorial_draft','healthy','degraded','suspended_pending_verification','suspended_insufficient_healthy_entries')
      and ("catalog_invalidation_outbox"."payload"->'transition'->>'fromOperationalState' = 'editorial_draft') = ("catalog_invalidation_outbox"."payload"->'transition'->>'toOperationalState' = 'editorial_draft')
      and "catalog_invalidation_outbox"."payload"->'transition'->'lostPrimaryModes' in ('[]'::jsonb,'[32]'::jsonb,'[64]'::jsonb,'[32,64]'::jsonb,'[64,32]'::jsonb)
      and "catalog_invalidation_outbox"."payload"->'transition'->'recoveredPrimaryModes' in ('[]'::jsonb,'[32]'::jsonb,'[64]'::jsonb,'[32,64]'::jsonb,'[64,32]'::jsonb)
      and not (("catalog_invalidation_outbox"."payload"->'transition'->'lostPrimaryModes' @> '[32]'::jsonb and "catalog_invalidation_outbox"."payload"->'transition'->'recoveredPrimaryModes' @> '[32]'::jsonb) or ("catalog_invalidation_outbox"."payload"->'transition'->'lostPrimaryModes' @> '[64]'::jsonb and "catalog_invalidation_outbox"."payload"->'transition'->'recoveredPrimaryModes' @> '[64]'::jsonb))
    ) is true);