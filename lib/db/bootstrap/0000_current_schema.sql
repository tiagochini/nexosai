CREATE TYPE "public"."locale" AS ENUM('pt-BR', 'en-US', 'en-AU', 'es-LA');
CREATE TYPE "public"."plan_slug" AS ENUM('solo', 'agency');
CREATE TYPE "public"."workspace_status" AS ENUM('active', 'suspended', 'cancelled');
CREATE TYPE "public"."credit_action" AS ENUM('strategy_generation', 'copy_generation', 'creative_brief', 'timeline_generation', 'video_concept', 'video_script', 'video_storyboard', 'video_low_res', 'video_high_res', 'video_avatar', 'video_voice_clone', 'video_hybrid', 'daily_video_short', 'daily_video_long', 'daily_video_story', 'landing_page_generation', 'campaign_execution', 'ad_creation', 'remarketing_setup', 'nurturing_message', 'analytics_report', 'monthly_reset', 'purchase', 'admin_grant', 'referral_bonus');
CREATE TYPE "public"."credit_transaction_type" AS ENUM('debit', 'credit');
CREATE TYPE "public"."campaign_phase" AS ENUM('capture', 'warmup', 'authority', 'desire', 'offer_reveal', 'scarcity', 'cart_open', 'cart_close', 'remarketing', 'proof', 'next_prep');
CREATE TYPE "public"."campaign_status" AS ENUM('intake', 'analyzing', 'strategy_ready', 'generating', 'compliance_review', 'awaiting_approval', 'approved', 'executing', 'live', 'paused', 'completed', 'cancelled');
CREATE TYPE "public"."campaign_track" AS ENUM('six_digits', 'eight_digits', 'ten_digits', 'not_applicable');
CREATE TYPE "public"."campaign_type" AS ENUM('launch', 'perpetual_launch', 'flash_sale', 'live_sale', 'continuous_sales', 'subscription_growth', 'authority', 'audience_growth', 'branding', 'creator_monetization', 'upsell', 'remarketing', 'affiliate', 'scale', 'regional_dominance', 'semente_launch');
CREATE TYPE "public"."agent_status" AS ENUM('pending', 'running', 'waiting_approval', 'approved', 'rejected', 'completed', 'failed', 'skipped');
CREATE TYPE "public"."agent_type" AS ENUM('command', 'strategy', 'offer', 'copywriter', 'creative_director', 'video', 'video_strategy', 'media_buyer', 'targeting', 'landing_page', 'analytics', 'optimization', 'creator_growth', 'product_builder', 'compliance', 'affiliate_campaign', 'launch_manager', 'perpetual_launch_manager', 'ad_copy', 'social_media', 'stories_sequence', 'media_brief', 'vsl_script', 'cpl_script', 'webinar_script', 'live_script', 'financial_projector', 'launch_sequence_builder', 'continuous_sales_manager', 'whatsapp_response', 'execution_governor', 'buyer_onboarding', 'semente_launch', 'product_validator', 'sales_warmer', 'sales_desire', 'sales_closer', 'sales_objection', 'sales_consultant', 'scene_director', 'art_direction', 'wardrobe_appearance', 'performance_voice', 'sound_design', 'editor', 'color_continuity', 'av_qc', 'business_intelligence', 'market_intel', 'email_architect', 'pricing_psychologist', 'organic_traffic', 'ab_test_designer', 'hook_factory', 'content_calendar', 'domino', 'upsell_architect', 'scarcity_engineer', 'objection_killer', 'reengagement', 'crisis_response', 'testimonial_curator', 'video_hook', 'campaign_emotional_arc', 'launch_debriefing', 'memory_compression', 'context_refinement', 'output_judge', 'identity_architect', 'mental_frequency_coach', 'obstinacy_trainer', 'ethics_autocorrect', 'emotional_coherence_checker', 'strategic_core', 'strategic_doctrine', 'ad_critic', 'dynamic_avatar_state', 'geographic_targeting', 'ux_simplification', 'campaign_memory', 'item_copy_generator', 'presence_planner', 'bio_optimizer', 'market_validator', 'offer_price_validator', 'brand_validator', 'profile_builder', 'traffic_intelligence', 'creative_concept', 'prelaunch_warming', 'conflict_detector', 'strategic_core_validation');
CREATE TYPE "public"."asset_status" AS ENUM('draft', 'concept_pending_approval', 'concept_approved', 'generating', 'preview_ready', 'approved', 'rejected', 'published', 'archived');
CREATE TYPE "public"."asset_type" AS ENUM('copy', 'post', 'carousel', 'email', 'whatsapp_message', 'telegram_message', 'ad_copy', 'video_concept', 'video_low_res', 'video_high_res', 'creative_brief', 'landing_page', 'sales_page', 'capture_page', 'funnel', 'timeline', 'strategy_doc', 'offer_doc', 'targeting_doc', 'script', 'ad_set');
CREATE TYPE "public"."checkpoint_status" AS ENUM('pending', 'approved', 'rejected', 'revision_requested');
CREATE TYPE "public"."checkpoint_type" AS ENUM('strategy_approval', 'timeline_approval', 'creative_concept_approval', 'video_concept_approval', 'video_preview_approval', 'landing_page_approval', 'ad_set_approval', 'targeting_approval', 'offer_approval', 'execution_approval', 'budget_approval');
CREATE TYPE "public"."integration_provider" AS ENUM('whatsapp_business', 'telegram', 'rd_station', 'activecampaign', 'mailchimp', 'resend', 'meta_ads', 'instagram', 'facebook', 'tiktok_ads', 'google_ads', 'linkedin_ads', 'stripe', 'paypal', 'mercado_pago', 'pagarme', 'asaas', 'hotmart', 'eduzz', 'kiwify', 'hubspot', 'crypto_native', 'custom_webhook', 'heygen', 'runway_ml', 'kling_fal', 'elevenlabs');
CREATE TYPE "public"."integration_status" AS ENUM('connected', 'disconnected', 'expired', 'error', 'pending_approval');
CREATE TYPE "public"."domain_lifecycle_status" AS ENUM('quote_ready', 'awaiting_supplier_payment', 'payment_confirmed', 'provisioning', 'dns_configuring', 'ssl_pending', 'active', 'payment_expired', 'pending_payment', 'registration_pending', 'renewal_due', 'renewal_pending', 'expired', 'failed', 'capability_blocked');
CREATE TYPE "public"."domain_operation_status" AS ENUM('pending', 'succeeded', 'failed', 'capability_blocked');
CREATE TYPE "public"."domain_operation_type" AS ENUM('availability', 'register', 'renew', 'dns_upsert', 'dns_delete');
CREATE TYPE "public"."domain_ssl_status" AS ENUM('pending', 'active', 'failed', 'expired');
CREATE TYPE "public"."domain_type" AS ENUM('nexos_subdomain', 'custom', 'resold');
CREATE TYPE "public"."landing_deployment_status" AS ENUM('pending', 'deploying', 'deployed', 'failed', 'capability_blocked', 'rolled_back');
CREATE TYPE "public"."landing_revision_status" AS ENUM('generated', 'validated', 'published', 'superseded');
CREATE TYPE "public"."page_status" AS ENUM('draft', 'preview', 'published', 'archived');
CREATE TYPE "public"."page_type" AS ENUM('landing', 'sales', 'capture', 'thankyou', 'funnel_step', 'pwa');
CREATE TYPE "public"."ai_provider" AS ENUM('anthropic', 'openai', 'gemini');
CREATE TYPE "public"."content_status" AS ENUM('generating', 'draft', 'pending_approval', 'budget_proposed', 'approved', 'rejected', 'revision_requested', 'archived');
CREATE TYPE "public"."content_type" AS ENUM('email_sequence', 'sales_page', 'whatsapp_broadcast', 'whatsapp_group_message', 'telegram_message', 'social_post', 'ad_copy', 'vsl_script', 'media_brief', 'content_calendar', 'prelaunch_warming', 'cart_open_announcement', 'cart_close_urgency', 'remarketing_sequence', 'cpl_script', 'webinar_script', 'live_script', 'stories_sequence', 'landing_page_structure', 'creative_direction', 'targeting_config', 'media_buying_plan', 'video_strategy', 'creator_growth_plan', 'seo_organic_plan', 'compliance_report', 'optimization_report');
CREATE TYPE "public"."media_concept_status" AS ENUM('pending_concept', 'concept_approved', 'concept_rejected', 'in_production', 'produced');
CREATE TYPE "public"."mental_trigger" AS ENUM('authority', 'social_proof', 'reciprocity', 'community', 'scarcity', 'urgency', 'anticipation', 'event', 'transformation', 'fear_of_loss', 'curiosity', 'contrast');
CREATE TYPE "public"."alert_severity" AS ENUM('info', 'warning', 'critical');
CREATE TYPE "public"."alert_type" AS ENUM('kpi_breach', 'budget_exhausted', 'low_health', 'optimization_triggered', 'phase_behind', 'revenue_gap', 'email_engagement_drop', 'cpl_spike', 'roas_drop', 'custom');
CREATE TYPE "public"."memory_type" AS ENUM('approved_copy', 'approved_strategy', 'approved_offer', 'approved_creative', 'approved_ads', 'approved_landing_page', 'approved_vsl', 'approved_social', 'rejection_feedback', 'performance_insight', 'public_launch_reference');
CREATE TYPE "public"."social_platform" AS ENUM('instagram', 'facebook_page', 'tiktok', 'whatsapp_business', 'youtube', 'linkedin');
CREATE TYPE "public"."social_post_status" AS ENUM('draft', 'scheduled', 'publishing', 'published', 'failed', 'cancelled');
CREATE TYPE "public"."social_post_type" AS ENUM('feed_image', 'feed_video', 'reel', 'story', 'carousel', 'text', 'whatsapp_message');
CREATE TYPE "public"."social_publish_attempt_state" AS ENUM('executing', 'ambiguous', 'retryable', 'confirmed', 'terminal', 'manual_recovery');
CREATE TYPE "public"."payment_currency" AS ENUM('BRL', 'USD', 'USDT', 'BTC', 'ETH');
CREATE TYPE "public"."payment_method" AS ENUM('pix', 'boleto', 'bank_transfer', 'crypto_usdt', 'crypto_btc', 'crypto_eth', 'credit_card', 'manual');
CREATE TYPE "public"."payment_status" AS ENUM('pending', 'processing', 'paid', 'failed', 'refunded', 'cancelled', 'expired');
CREATE TYPE "public"."revenue_event_status" AS ENUM('pending', 'confirmed', 'refunded', 'cancelled');
CREATE TYPE "public"."revenue_event_type" AS ENUM('sale', 'refund', 'chargeback', 'subscription_renewal', 'subscription_cancel', 'abandoned_cart', 'lead', 'upsell', 'order_bump');
CREATE TYPE "public"."revenue_platform" AS ENUM('hotmart', 'kiwify', 'eduzz', 'monetizze', 'stripe', 'pagarme', 'asaas', 'custom');
CREATE TYPE "public"."agency_client_status" AS ENUM('pending', 'active', 'suspended', 'revoked');
CREATE TYPE "public"."compliance_platform" AS ENUM('meta_ads', 'google_ads', 'tiktok', 'conar', 'cvm', 'anvisa', 'generic');
CREATE TYPE "public"."compliance_severity" AS ENUM('none', 'low', 'medium', 'high', 'critical');
CREATE TYPE "public"."compliance_status" AS ENUM('pending', 'passed', 'warning', 'failed', 'overridden');
CREATE TYPE "public"."review_action" AS ENUM('approved', 'rejected', 'modified');
CREATE TYPE "public"."launch_model" AS ENUM('plf', 'formula_de_lancamento', 'semente', 'afiliado', 'perpetual', 'custom');
CREATE TYPE "public"."launch_phase" AS ENUM('pre_capture', 'capture', 'plc1', 'plc2', 'plc3', 'cart_open', 'cart_middle', 'cart_close', 'post_purchase', 'post_launch', 'evergreen');
CREATE TYPE "public"."launch_sequence_item_status" AS ENUM('pending', 'content_generating', 'content_ready', 'scheduled', 'dispatched', 'skipped', 'failed');
CREATE TYPE "public"."launch_sequence_status" AS ENUM('draft', 'scheduled', 'active', 'paused', 'completed', 'cancelled');
CREATE TYPE "public"."vsl_format" AS ENUM('vsl', 'webinar', 'masterclass', 'challenge_day', 'long_form_video');
CREATE TYPE "public"."vsl_status" AS ENUM('draft', 'generating', 'generated', 'pending_approval', 'approved', 'rejected', 'archived');
CREATE TYPE "public"."email_dispatch_status" AS ENUM('draft', 'scheduled', 'sending', 'sent', 'partial', 'failed', 'cancelled');
CREATE TYPE "public"."email_provider" AS ENUM('rd_station', 'activecampaign', 'mailchimp', 'sendgrid', 'brevo', 'custom_smtp');
CREATE TYPE "public"."whatsapp_dispatch_status" AS ENUM('queued', 'sending', 'ambiguous', 'sent', 'delivered', 'read', 'failed', 'cancelled');
CREATE TYPE "public"."whatsapp_dispatch_type" AS ENUM('broadcast', 'individual', 'group', 'template');
CREATE TYPE "public"."contact_segment" AS ENUM('hot', 'warm', 'cold', 'converted', 'unsubscribed');
CREATE TYPE "public"."engagement_event_type" AS ENUM('delivered', 'open', 'click', 'convert', 'reply', 'unsubscribe', 'bounced');
CREATE TYPE "public"."journey_stage" AS ENUM('awareness', 'consideration', 'qualification', 'objection_handling', 'closing', 'converted');
CREATE TYPE "public"."first_touch_attempt_state" AS ENUM('executing', 'retryable', 'ambiguous', 'confirmed', 'terminal');
CREATE TYPE "public"."comment_action" AS ENUM('pending', 'replied', 'deleted', 'hidden', 'liked', 'ignored', 'error');
CREATE TYPE "public"."comment_classification" AS ENUM('hostile', 'spam', 'question', 'compliment', 'objection', 'neutral');
CREATE TYPE "public"."comment_platform" AS ENUM('instagram', 'facebook_page', 'tiktok');
CREATE TYPE "public"."creative_format" AS ENUM('feed_square', 'feed_portrait', 'stories', 'banner', 'carousel_slide');
CREATE TYPE "public"."creative_platform" AS ENUM('instagram', 'facebook', 'google', 'tiktok', 'universal');
CREATE TYPE "public"."creative_status" AS ENUM('concept_pending', 'concept_ready', 'preview_generating', 'preview_ready', 'final_generating', 'approved', 'rejected');
CREATE TYPE "public"."agent_approval_status" AS ENUM('not_required', 'pending', 'approved', 'rejected');
CREATE TYPE "public"."agent_execution_status" AS ENUM('started', 'completed', 'failed', 'skipped', 'dry_run');
CREATE TYPE "public"."group_platform" AS ENUM('whatsapp', 'telegram', 'facebook');
CREATE TYPE "public"."group_status" AS ENUM('active', 'inactive', 'archived', 'capability_blocked', 'sync_failed');
CREATE TYPE "public"."video_format" AS ENUM('vsl', 'cpl', 'live_promo', 'stories', 'reels', 'youtube', 'webinar_promo', 'testimonial', 'product_demo');
CREATE TYPE "public"."video_project_retention_policy" AS ENUM('archive', 'ephemeral');
CREATE TYPE "public"."video_project_status" AS ENUM('intake', 'script_generating', 'script_ready', 'script_approved', 'storyboard_generating', 'storyboard_ready', 'storyboard_approved', 'preview_generating', 'preview_ready', 'preview_approved', 'awaiting_clone', 'final_generating', 'completed', 'failed');
CREATE TYPE "public"."correction_loop_status" AS ENUM('open', 'in_progress', 'resolved', 'cancelled');
CREATE TYPE "public"."production_asset_status" AS ENUM('uploading', 'ready', 'processing', 'failed', 'archived');
CREATE TYPE "public"."production_asset_type" AS ENUM('video', 'audio', 'image', 'subtitle', 'graphic', 'font', 'document');
CREATE TYPE "public"."production_manifest_status" AS ENUM('draft', 'active', 'locked', 'archived');
CREATE TYPE "public"."production_revision_status" AS ENUM('draft', 'in_review', 'approved', 'superseded');
CREATE TYPE "public"."qc_issue_severity" AS ENUM('info', 'warning', 'error', 'blocking');
CREATE TYPE "public"."qc_issue_status" AS ENUM('open', 'acknowledged', 'resolved', 'wont_fix');
CREATE TYPE "public"."qc_report_status" AS ENUM('pending', 'passed', 'failed', 'needs_review');
CREATE TYPE "public"."render_job_status" AS ENUM('queued', 'running', 'succeeded', 'failed', 'cancelled');
CREATE TYPE "public"."timeline_track_type" AS ENUM('video', 'audio', 'voiceover', 'music', 'graphics', 'subtitles');
CREATE TYPE "public"."video_media_purge_status" AS ENUM('requested', 'in_progress', 'purge_failed', 'purged');
CREATE TYPE "public"."market_intel_status" AS ENUM('running', 'ready', 'failed');
CREATE TYPE "public"."presence_platform" AS ENUM('instagram', 'facebook', 'tiktok', 'linkedin');
CREATE TYPE "public"."presence_post_status" AS ENUM('draft', 'scheduled', 'publishing', 'published', 'failed', 'cancelled');
CREATE TYPE "public"."contract_acceptance_type" AS ENUM('autonomy', 'regulated_activity', 'asset_rights');
CREATE TYPE "public"."mandatory_pause_class" AS ENUM('probable_illegality', 'fraud', 'rights_violation', 'severe_account_ban_risk', 'overspend', 'severe_reputational_crisis');
CREATE TYPE "public"."mandatory_pause_source_type" AS ENUM('user', 'automated');
CREATE TYPE "public"."mandatory_pause_status" AS ENUM('active', 'resolved');
CREATE TYPE "public"."paid_media_action_type" AS ENUM('pause', 'resume', 'update_daily_budget', 'update_bid', 'update_creative_status', 'update_creative_rotation', 'cross_platform_budget_move');
CREATE TYPE "public"."paid_media_attempt_status" AS ENUM('pending', 'executing', 'succeeded', 'failed', 'verification_failed', 'rolled_back');
CREATE TYPE "public"."paid_media_budget_strategy" AS ENUM('cbo', 'abo');
CREATE TYPE "public"."paid_media_date_grain" AS ENUM('daily', 'hourly', 'lifetime');
CREATE TYPE "public"."paid_media_entity_type" AS ENUM('campaign', 'ad_set', 'ad', 'creative');
CREATE TYPE "public"."paid_media_event_delivery_status" AS ENUM('pending', 'sent', 'failed', 'capability_blocked', 'consent_withheld');
CREATE TYPE "public"."paid_media_event_source" AS ENUM('browser', 'server', 'crm');
CREATE TYPE "public"."paid_media_launch_attempt_status" AS ENUM('executing', 'succeeded', 'failed', 'compensation_failed');
CREATE TYPE "public"."paid_media_launch_stage" AS ENUM('compiled', 'simulated', 'approved', 'activating', 'active', 'failed', 'compensation_failed', 'rolled_back');
CREATE TYPE "public"."paid_media_launch_step_status" AS ENUM('pending', 'created', 'verified', 'compensated', 'compensation_failed');
CREATE TYPE "public"."paid_media_proposal_status" AS ENUM('pending_approval', 'approved', 'rejected', 'expired', 'executing', 'verified', 'failed', 'rolled_back');
CREATE TYPE "public"."paid_media_provider" AS ENUM('meta_ads', 'tiktok_ads', 'google_ads');
CREATE TYPE "public"."paid_media_reconciliation_status" AS ENUM('reconciled', 'partial', 'unattributed');
CREATE TYPE "public"."dead_letter_classification" AS ENUM('retryable', 'terminal', 'manual');
CREATE TYPE "public"."dead_letter_replay_status" AS ENUM('none', 'claimed', 'queued', 'succeeded', 'failed');
CREATE TYPE "public"."native_media_consent_type" AS ENUM('voice_clone', 'voice_synthesis', 'likeness', 'avatar_animation', 'lip_sync');
CREATE TYPE "public"."native_media_event_type" AS ENUM('submitted', 'leased', 'acknowledged', 'progress', 'completed', 'failed', 'cancelled', 'lease_expired', 'retry_scheduled', 'planned', 'attempted', 'provider_confirmed', 'artifact_qc');
CREATE TYPE "public"."native_media_job_status" AS ENUM('queued', 'leased', 'running', 'succeeded', 'failed', 'cancelled');
CREATE TYPE "public"."native_media_operation" AS ENUM('text_to_video', 'image_to_video', 'avatar_animation', 'voice_clone', 'tts', 'lip_sync', 'upscale', 'timeline_render', 'qc_extract');
CREATE TYPE "public"."masterplan_version_status" AS ENUM('draft', 'pending_approval', 'approved', 'superseded');
CREATE TYPE "public"."execution_evidence_state" AS ENUM('planned', 'attempted', 'provider_confirmed', 'artifact_qc', 'monitored', 'retryable', 'failed', 'recovery', 'compensated', 'exception');
CREATE TYPE "public"."regional_alert_status" AS ENUM('open', 'acknowledged');
CREATE TYPE "public"."regional_audience_opportunity_lifecycle" AS ENUM('observed', 'qualified', 'ready_for_activation', 'activated', 'converted', 'discarded');
CREATE TYPE "public"."regional_competitor_kind" AS ENUM('direct', 'indirect', 'substitute', 'aspirational', 'emerging');
CREATE TYPE "public"."regional_deletion_state" AS ENUM('active', 'opted_out', 'pending_deletion', 'deleted');
CREATE TYPE "public"."regional_lawful_basis_status" AS ENUM('unknown', 'not_permitted', 'permitted', 'opted_out');
CREATE TYPE "public"."regional_monitor_run_status" AS ENUM('queued', 'running', 'completed', 'failed');
CREATE TYPE "public"."interaction_action" AS ENUM('public_comment', 'private_message', 'reply', 'follow_up');
CREATE TYPE "public"."interaction_decision" AS ENUM('allowed', 'blocked', 'requires_approval');
CREATE TYPE "public"."interaction_lifecycle" AS ENUM('observed', 'scored', 'proposed', 'awaiting_approval', 'approved', 'scheduled', 'executing', 'verified', 'responded', 'failed', 'blocked', 'cancelled');
CREATE TYPE "public"."radar_billing_currency" AS ENUM('BRL', 'USD');
CREATE TYPE "public"."radar_entitlement_source" AS ENUM('subscription_included', 'asaas_purchase', 'admin');
CREATE TYPE "public"."radar_order_status" AS ENUM('initializing', 'pending', 'confirmed', 'fulfilled', 'overdue', 'expired', 'cancelled', 'refunded');
CREATE TYPE "public"."radar_package" AS ENUM('RADAR_ESSENTIAL', 'RADAR_PRO', 'RADAR_SCALE', 'WAR_ROOM');
CREATE TYPE "public"."radar_purchase_request_status" AS ENUM('pending_sales', 'cancelled', 'activated');
CREATE TYPE "public"."radar_subscription_status" AS ENUM('pending', 'active', 'cancelled', 'expired');
CREATE TYPE "public"."radar_usage_dimension" AS ENUM('light_scan', 'detailed_scan', 'council_run', 'monitored_campaign', 'competitor', 'region');
CREATE TYPE "public"."commercial_product_status" AS ENUM('active', 'retired');
CREATE TYPE "public"."commercial_subscription_status" AS ENUM('pending', 'active', 'paused', 'cancelled', 'expired');
CREATE TYPE "public"."entitlement_grant_source" AS ENUM('subscription', 'admin', 'migration');
CREATE TYPE "public"."community_attempt_status" AS ENUM('pending', 'sent', 'succeeded', 'failed', 'capability_blocked');
CREATE TYPE "public"."community_channel" AS ENUM('whatsapp', 'telegram', 'instagram', 'facebook');
CREATE TYPE "public"."community_decision" AS ENUM('allow', 'queue', 'delete', 'restrict', 'ban', 'respond', 'capability_blocked');
CREATE TYPE "public"."community_message_direction" AS ENUM('inbound', 'outbound');
CREATE TYPE "public"."community_message_status" AS ENUM('received', 'queued', 'sent', 'delivered', 'failed', 'capability_blocked');
CREATE TYPE "public"."lifecycle_action_status" AS ENUM('pending', 'claimed', 'completed', 'failed', 'suppressed');
CREATE TYPE "public"."lifecycle_event_status" AS ENUM('accepted', 'processed', 'failed');
CREATE TYPE "public"."lifecycle_event_type" AS ENUM('lead', 'checkout_started', 'payment_pending', 'payment_expired', 'paid', 'refunded', 'activation', 'renewal', 'message_opened', 'message_clicked');
CREATE TYPE "public"."lifecycle_stage" AS ENUM('lead', 'qualified', 'checkout_started', 'customer', 'at_risk', 'churned');
CREATE TYPE "public"."referral_reward_status" AS ENUM('pending', 'earned', 'fulfilled', 'reversed', 'rejected');
CREATE TYPE "public"."product_intake_entry_point" AS ENUM('launch', 'market_intel', 'social_media', 'paid_media');
CREATE TYPE "public"."product_intake_status" AS ENUM('draft', 'approved', 'locked', 'superseded');
CREATE TYPE "public"."approval_decision" AS ENUM('approved', 'rejected', 'revision_requested');
CREATE TYPE "public"."approval_subject_type" AS ENUM('masterplan', 'content_piece', 'checkpoint');
CREATE TYPE "public"."approval_sla_channel" AS ENUM('in_app');
CREATE TYPE "public"."approval_sla_event_kind" AS ENUM('warning', 'due', 'escalation', 'expired');
CREATE TYPE "public"."approval_sla_status" AS ENUM('open', 'resolved', 'expired');
CREATE TYPE "public"."conditional_execution_action" AS ENUM('paid_media_pause');
CREATE TYPE "public"."conditional_execution_attempt_status" AS ENUM('attempted', 'confirmed', 'ambiguous', 'recovery_required');
CREATE TYPE "public"."conditional_execution_intent_status" AS ENUM('planned', 'blocked', 'eligible', 'attempted', 'confirmed', 'ambiguous', 'recovery_required');
CREATE TYPE "public"."realization_action" AS ENUM('paid_media_pause', 'paid_media_launch');
CREATE TYPE "public"."realization_attempt_state" AS ENUM('claimed', 'in_flight', 'readback', 'confirmed', 'retryable', 'failed', 'ambiguous', 'compensated', 'compensation_failed');
CREATE TYPE "public"."realization_event_type" AS ENUM('created', 'preflighted', 'claimed', 'provider_receipt', 'readback', 'qc', 'retry', 'monitor', 'compensate', 'state_changed', 'exception');
CREATE TYPE "public"."realization_state" AS ENUM('proposal', 'planned', 'approval_binding', 'preflight', 'blocked', 'attempted', 'provider_confirmed', 'artifact_qc', 'monitored', 'retryable', 'failed', 'recovery', 'compensated', 'exception');
CREATE TYPE "public"."council_action_family" AS ENUM('paid_media_pause', 'paid_media_launch', 'unsupported');
CREATE TYPE "public"."council_cycle_status" AS ENUM('open', 'closed');
CREATE TYPE "public"."council_decision_status" AS ENUM('proposed', 'superseded');
CREATE TYPE "public"."council_outcome_status" AS ENUM('verified', 'inconclusive', 'unsupported', 'exception');
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"name" text NOT NULL,
	"phone" text,
	"locale" "locale" DEFAULT 'pt-BR' NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"phone_verified" boolean DEFAULT false NOT NULL,
	"has_seen_onboarding" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);

CREATE TABLE "plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" "plan_slug" NOT NULL,
	"price_monthly" numeric(10, 2) NOT NULL,
	"price_onboarding" numeric(10, 2) DEFAULT '0' NOT NULL,
	"credits_monthly" integer NOT NULL,
	"max_campaigns" integer NOT NULL,
	"max_videos_per_campaign" integer DEFAULT 5 NOT NULL,
	"max_domains" integer DEFAULT 1 NOT NULL,
	"max_workspaces" integer DEFAULT 1 NOT NULL,
	"allowed_social_networks" jsonb DEFAULT '["instagram","facebook","tiktok","linkedin","youtube"]'::jsonb NOT NULL,
	"max_accounts_per_network" jsonb DEFAULT '{"instagram":5,"facebook":5,"tiktok":5,"linkedin":5,"youtube":5}'::jsonb NOT NULL,
	"white_label" boolean DEFAULT false NOT NULL,
	"multi_nurturing_channels" boolean DEFAULT false NOT NULL,
	"features" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "plans_slug_unique" UNIQUE("slug")
);

CREATE TABLE "workspaces" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"plan_id" uuid NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"status" "workspace_status" DEFAULT 'active' NOT NULL,
	"credits_balance" integer DEFAULT 0 NOT NULL,
	"credits_last_reset" timestamp with time zone DEFAULT now() NOT NULL,
	"active_campaigns" integer DEFAULT 0 NOT NULL,
	"logo_url" text,
	"brand_name" text,
	"custom_domain" text,
	"settings" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "workspaces_slug_unique" UNIQUE("slug"),
	CONSTRAINT "workspaces_id_owner_id_uidx" UNIQUE("id","owner_id")
);

CREATE TABLE "credit_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"campaign_id" uuid,
	"type" "credit_transaction_type" NOT NULL,
	"action" "credit_action" NOT NULL,
	"amount" integer NOT NULL,
	"balance_before" integer NOT NULL,
	"balance_after" integer NOT NULL,
	"ai_provider" text,
	"tokens_used" integer,
	"cost_usd" numeric(10, 6),
	"description" text,
	"idempotency_key" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "campaigns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"title" text NOT NULL,
	"type" "campaign_type" DEFAULT 'launch' NOT NULL,
	"track" "campaign_track" DEFAULT 'six_digits' NOT NULL,
	"status" "campaign_status" DEFAULT 'intake' NOT NULL,
	"current_phase" "campaign_phase",
	"intake_data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"strategy_data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"timeline_data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"offer_data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"targeting_data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"audience_data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"memory_data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"brain_data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"duration_days" integer,
	"budget_total" integer,
	"revenue_target" text,
	"locale" text DEFAULT 'pt-BR' NOT NULL,
	"timezone" text DEFAULT 'America/Sao_Paulo' NOT NULL,
	"credits_cost" integer DEFAULT 0 NOT NULL,
	"execution_started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"pipeline_id" uuid,
	"pipeline_position" integer,
	"commercial_product_id" uuid,
	"commercial_subscription_id" uuid,
	"product_intake_version_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "campaigns_workspace_id_id_uidx" UNIQUE("workspace_id","id")
);

CREATE TABLE "campaign_agents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" uuid NOT NULL,
	"agent_type" "agent_type" NOT NULL,
	"status" "agent_status" DEFAULT 'pending' NOT NULL,
	"input" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"output" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"thoughts" text,
	"ai_provider" text,
	"model" text,
	"tokens_used" integer,
	"credits_used" integer DEFAULT 0 NOT NULL,
	"error_message" text,
	"retry_count" integer DEFAULT 0 NOT NULL,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "campaign_assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" uuid NOT NULL,
	"agent_id" uuid,
	"asset_type" "asset_type" NOT NULL,
	"title" text NOT NULL,
	"content" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" "asset_status" DEFAULT 'draft' NOT NULL,
	"preview_url" text,
	"final_url" text,
	"is_low_res" boolean DEFAULT false NOT NULL,
	"platform" text,
	"phase" text,
	"scheduled_for" timestamp with time zone,
	"published_at" timestamp with time zone,
	"approved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "approval_checkpoints" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" uuid NOT NULL,
	"asset_id" uuid,
	"checkpoint_type" "checkpoint_type" NOT NULL,
	"status" "checkpoint_status" DEFAULT 'pending' NOT NULL,
	"data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"user_feedback" text,
	"approved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "approval_checkpoints_campaign_id_uidx" UNIQUE("campaign_id","id")
);

CREATE TABLE "workspace_integrations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"provider" "integration_provider" NOT NULL,
	"status" "integration_status" DEFAULT 'disconnected' NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"token_expires_at" timestamp with time zone,
	"account_id" text,
	"account_name" text,
	"canonical_network" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"is_payment_gateway" boolean DEFAULT false NOT NULL,
	"blocks_execution" boolean DEFAULT false NOT NULL,
	"webhook_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"campaign_id" uuid,
	"agent_id" uuid,
	"action" text NOT NULL,
	"actor" text NOT NULL,
	"data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"ip_address" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "domain_dns_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"domain_id" uuid NOT NULL,
	"type" text NOT NULL,
	"name" text NOT NULL,
	"value" text NOT NULL,
	"ttl" integer DEFAULT 300 NOT NULL,
	"provider_record_id" text,
	"verified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "domain_operations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"domain_id" uuid,
	"operation" "domain_operation_type" NOT NULL,
	"status" "domain_operation_status" DEFAULT 'pending' NOT NULL,
	"idempotency_key" text NOT NULL,
	"provider" text,
	"provider_operation_id" text,
	"request" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"response" jsonb,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);

CREATE TABLE "domains" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"domain" text NOT NULL,
	"type" "domain_type" DEFAULT 'nexos_subdomain' NOT NULL,
	"ssl_status" "domain_ssl_status" DEFAULT 'pending' NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"dns_verified" boolean DEFAULT false NOT NULL,
	"expires_at" timestamp with time zone,
	"lifecycle_status" "domain_lifecycle_status" DEFAULT 'active' NOT NULL,
	"registrar_provider" text,
	"registrar_domain_id" text,
	"supplier_payment_reference" text,
	"supplier_payment_url" text,
	"supplier_payment_status" text,
	"supplier_order_id" text,
	"auto_renew" boolean DEFAULT true NOT NULL,
	"renewal_attempts" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "domains_domain_unique" UNIQUE("domain")
);

CREATE TABLE "landing_deployments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"page_id" uuid NOT NULL,
	"revision_id" uuid NOT NULL,
	"domain_id" uuid,
	"status" "landing_deployment_status" DEFAULT 'pending' NOT NULL,
	"idempotency_key" text NOT NULL,
	"provider" text,
	"provider_deployment_id" text,
	"deployment_url" text,
	"logs" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);

CREATE TABLE "landing_revisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"page_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"revision" integer NOT NULL,
	"source" jsonb NOT NULL,
	"html" text NOT NULL,
	"content_hash" text NOT NULL,
	"status" "landing_revision_status" DEFAULT 'generated' NOT NULL,
	"validation_errors" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "pages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"campaign_id" uuid,
	"domain_id" uuid,
	"type" "page_type" DEFAULT 'landing' NOT NULL,
	"title" text NOT NULL,
	"slug" text NOT NULL,
	"html" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" "page_status" DEFAULT 'draft' NOT NULL,
	"published_url" text,
	"is_white_label" boolean DEFAULT false NOT NULL,
	"lead_capture_sequence_id" uuid,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "ai_provider_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"campaign_id" uuid,
	"agent_type" text,
	"provider" "ai_provider" NOT NULL,
	"model" text NOT NULL,
	"input_tokens" integer DEFAULT 0 NOT NULL,
	"output_tokens" integer DEFAULT 0 NOT NULL,
	"total_tokens" integer DEFAULT 0 NOT NULL,
	"cost_usd" numeric(10, 6) NOT NULL,
	"credits_charged" integer DEFAULT 0 NOT NULL,
	"latency_ms" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "content_pieces" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"type" "content_type" NOT NULL,
	"status" "content_status" DEFAULT 'draft' NOT NULL,
	"title" text NOT NULL,
	"phase" text,
	"launch_phase" text,
	"day_index" integer,
	"mental_trigger" "mental_trigger",
	"sequence_item_id" uuid,
	"content" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"ai_provider" text,
	"credits_used" integer DEFAULT 0 NOT NULL,
	"agent_version" text DEFAULT '1.0',
	"approved_at" timestamp with time zone,
	"rejected_at" timestamp with time zone,
	"rejection_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "content_pieces_workspace_campaign_id_uidx" UNIQUE("workspace_id","campaign_id","id")
);

CREATE TABLE "media_briefs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"content_piece_id" uuid,
	"media_type" text NOT NULL,
	"concept_status" "media_concept_status" DEFAULT 'pending_concept' NOT NULL,
	"concept_data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"low_res_url" text,
	"final_url" text,
	"user_feedback" text,
	"approved_at" timestamp with time zone,
	"produced_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "campaign_alerts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"alert_type" "alert_type" NOT NULL,
	"severity" "alert_severity" NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"recommendation" text,
	"metric_key" text,
	"metric_value" numeric(14, 4),
	"threshold_value" numeric(14, 4),
	"is_acknowledged" boolean DEFAULT false NOT NULL,
	"acknowledged_at" timestamp with time zone,
	"acknowledged_by" text,
	"auto_action_taken" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "campaign_metrics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"metric_date" date NOT NULL,
	"day_index" integer NOT NULL,
	"phase" text,
	"clicks" integer DEFAULT 0 NOT NULL,
	"impressions" integer DEFAULT 0 NOT NULL,
	"spend_brl" numeric(12, 2) DEFAULT '0' NOT NULL,
	"cpl_brl" numeric(10, 2),
	"ctr" numeric(6, 4),
	"leads" integer DEFAULT 0 NOT NULL,
	"sales" integer DEFAULT 0 NOT NULL,
	"revenue_brl" numeric(14, 2) DEFAULT '0' NOT NULL,
	"roas" numeric(8, 4),
	"conversion_rate" numeric(6, 4),
	"emails_sent" integer DEFAULT 0 NOT NULL,
	"email_opens" integer DEFAULT 0 NOT NULL,
	"email_clicks" integer DEFAULT 0 NOT NULL,
	"open_rate" numeric(6, 4),
	"click_rate" numeric(6, 4),
	"social_reach" integer DEFAULT 0 NOT NULL,
	"social_engagements" integer DEFAULT 0 NOT NULL,
	"health_score" integer,
	"projected_revenue_brl" numeric(14, 2),
	"revenue_gap_percent" numeric(8, 4),
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "workspace_memory" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"campaign_id" uuid,
	"memory_type" "memory_type" NOT NULL,
	"agent_role" text NOT NULL,
	"content_type" text,
	"title" text NOT NULL,
	"summary" text NOT NULL,
	"content" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"tags" text[] DEFAULT '{}',
	"quality_score" real,
	"is_negative" boolean DEFAULT false NOT NULL,
	"is_public_reference" boolean DEFAULT false NOT NULL,
	"product_niche" text,
	"revenue_range" text,
	"usage_count" integer DEFAULT 0 NOT NULL,
	"last_used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "critique_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"campaign_id" uuid NOT NULL,
	"agent_role" text NOT NULL,
	"iteration" integer DEFAULT 1 NOT NULL,
	"raw_output" text NOT NULL,
	"critique_text" text NOT NULL,
	"refined_output" text NOT NULL,
	"self_score_before" real,
	"self_score_after" real,
	"improvement_delta" real,
	"issues" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"tokens_used" integer DEFAULT 0 NOT NULL,
	"credits_charged" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "social_posts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"campaign_id" uuid,
	"masterplan_version_id" uuid,
	"context_fingerprint" text,
	"content_piece_id" uuid,
	"integration_id" uuid NOT NULL,
	"platform" "social_platform" NOT NULL,
	"post_type" "social_post_type" DEFAULT 'feed_image' NOT NULL,
	"status" "social_post_status" DEFAULT 'draft' NOT NULL,
	"caption" text,
	"hashtags" text[] DEFAULT '{}' NOT NULL,
	"media_urls" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"call_to_action" text,
	"link_url" text,
	"scheduled_at" timestamp with time zone,
	"published_at" timestamp with time zone,
	"platform_post_id" text,
	"platform_url" text,
	"metrics" jsonb DEFAULT '{"likes":0,"comments":0,"shares":0,"views":0,"reach":0,"impressions":0,"clicks":0}'::jsonb NOT NULL,
	"retry_count" integer DEFAULT 0 NOT NULL,
	"manual_retry_count" integer DEFAULT 0 NOT NULL,
	"reel_script" text,
	"error_message" text,
	"ai_generated" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "social_posts_workspace_id_id_key" UNIQUE("workspace_id","id")
);

CREATE TABLE "social_publish_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"post_id" uuid NOT NULL,
	"attempt_key" text NOT NULL,
	"content_fingerprint" text NOT NULL,
	"state" "social_publish_attempt_state" DEFAULT 'executing' NOT NULL,
	"lease_owner" text,
	"lease_expires_at" timestamp with time zone,
	"retry_count" integer DEFAULT 0 NOT NULL,
	"next_attempt_at" timestamp with time zone,
	"provider_stage" text,
	"provider_container_id" text,
	"provider_publish_id" text,
	"receipt" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"readback" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "subscription_payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"plan_id" uuid NOT NULL,
	"amount_cents" integer NOT NULL,
	"currency" "payment_currency" DEFAULT 'BRL' NOT NULL,
	"method" "payment_method" NOT NULL,
	"status" "payment_status" DEFAULT 'pending' NOT NULL,
	"description" text,
	"external_id" text,
	"pix_data" jsonb,
	"boleto_data" jsonb,
	"crypto_data" jsonb,
	"bank_transfer_data" jsonb,
	"paid_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "revenue_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"campaign_id" uuid,
	"platform" "revenue_platform" NOT NULL,
	"event_type" "revenue_event_type" NOT NULL,
	"status" "revenue_event_status" DEFAULT 'confirmed' NOT NULL,
	"gross_amount_cents" integer NOT NULL,
	"net_amount_cents" integer NOT NULL,
	"currency" text DEFAULT 'BRL' NOT NULL,
	"product_name" text,
	"product_id" text,
	"customer_email" text,
	"customer_name" text,
	"transaction_id" text,
	"commission_amount_cents" integer DEFAULT 0,
	"is_recurring" boolean DEFAULT false NOT NULL,
	"webhook_payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"processed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "webhook_configs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"platform" "revenue_platform" NOT NULL,
	"webhook_token" text NOT NULL,
	"signing_secret" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"last_received_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "agency_clients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agency_workspace_id" uuid NOT NULL,
	"client_workspace_id" uuid,
	"client_email" text NOT NULL,
	"client_name" text,
	"status" "agency_client_status" DEFAULT 'pending' NOT NULL,
	"invite_token" text,
	"invite_expires_at" timestamp with time zone,
	"permissions" jsonb DEFAULT '{"canViewCampaigns":true,"canEditCampaigns":false,"canViewMetrics":true,"canViewRevenue":false,"canExecuteCampaigns":false,"canApproveContent":false,"canManageSocial":false}'::jsonb NOT NULL,
	"notes" text,
	"accepted_at" timestamp with time zone,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "whitelabel_configs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"brand_name" text NOT NULL,
	"tagline" text,
	"logo_url" text,
	"favicon_url" text,
	"login_bg_url" text,
	"theme" jsonb DEFAULT '{"primaryColor":"#6366f1","secondaryColor":"#1e1b4b","accentColor":"#a78bfa","textColor":"#f8fafc","bgColor":"#0f0e17","borderRadius":"8px","fontFamily":"Inter, sans-serif"}'::jsonb NOT NULL,
	"custom_css" text,
	"custom_domain" text,
	"domain_verified" boolean DEFAULT false NOT NULL,
	"domain_verify_token" text,
	"support_email" text,
	"support_url" text,
	"terms_url" text,
	"privacy_url" text,
	"meta_title" text,
	"meta_description" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "whitelabel_configs_workspace_id_unique" UNIQUE("workspace_id")
);

CREATE TABLE "compliance_checks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"campaign_id" uuid,
	"content_id" uuid,
	"content_title" text NOT NULL,
	"content_type" text NOT NULL,
	"content_text" text NOT NULL,
	"platform" "compliance_platform" DEFAULT 'generic' NOT NULL,
	"status" "compliance_status" DEFAULT 'pending' NOT NULL,
	"overall_severity" "compliance_severity" DEFAULT 'none' NOT NULL,
	"compliance_score" integer DEFAULT 100 NOT NULL,
	"violations" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"suggestions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"checked_by" text DEFAULT 'claude-3-5-sonnet-20241022' NOT NULL,
	"trace_id" text NOT NULL,
	"reviewed_by" uuid,
	"review_action" "review_action",
	"review_note" text,
	"reviewed_at" timestamp with time zone,
	"auto_blocked" integer DEFAULT 0 NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "launch_sequence_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sequence_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"phase" "launch_phase" NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"day_index" integer NOT NULL,
	"mental_trigger" text,
	"delivery_channels" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"content_type" text,
	"content_piece_id" uuid,
	"scheduled_at" timestamp with time zone,
	"status" "launch_sequence_item_status" DEFAULT 'pending' NOT NULL,
	"objective" text,
	"copy_hints" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "launch_sequences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"campaign_id" uuid,
	"name" text NOT NULL,
	"model" "launch_model" DEFAULT 'plf' NOT NULL,
	"status" "launch_sequence_status" DEFAULT 'draft' NOT NULL,
	"total_days" integer DEFAULT 21 NOT NULL,
	"launch_start_date" date,
	"cart_open_date" date,
	"cart_close_date" date,
	"revenue_target" text,
	"product_name" text,
	"product_price" text,
	"lead_capture_enabled" boolean DEFAULT false NOT NULL,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"ai_generated_plan" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "vsls" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"campaign_id" uuid,
	"title" text NOT NULL,
	"format" "vsl_format" DEFAULT 'vsl' NOT NULL,
	"status" "vsl_status" DEFAULT 'draft' NOT NULL,
	"total_duration" text,
	"total_word_count" integer,
	"hook_data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"sections" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"offer_reveal" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"ctas" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"technical_notes" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"vsl_notes" text,
	"product_name" text,
	"product_price" text,
	"target_audience" text,
	"main_promise" text,
	"intake_snapshot" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"ai_provider" text,
	"credits_used" integer DEFAULT 0 NOT NULL,
	"approved_at" timestamp with time zone,
	"rejected_at" timestamp with time zone,
	"rejection_reason" text,
	"generation_started_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "email_dispatches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"campaign_id" uuid,
	"provider" "email_provider" NOT NULL,
	"external_campaign_id" text,
	"list_id" text,
	"list_name" text,
	"subject" text NOT NULL,
	"preview_text" text,
	"from_name" text NOT NULL,
	"from_email" text NOT NULL,
	"sequence_item_id" uuid,
	"content_piece_id" uuid,
	"html_content" text,
	"text_content" text,
	"status" "email_dispatch_status" DEFAULT 'draft' NOT NULL,
	"scheduled_at" timestamp with time zone,
	"sent_at" timestamp with time zone,
	"recipient_count" integer DEFAULT 0 NOT NULL,
	"open_count" integer DEFAULT 0 NOT NULL,
	"click_count" integer DEFAULT 0 NOT NULL,
	"bounce_count" integer DEFAULT 0 NOT NULL,
	"unsubscribe_count" integer DEFAULT 0 NOT NULL,
	"open_rate" text,
	"click_rate" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"idempotency_key" text,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "whatsapp_dispatches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"campaign_id" uuid,
	"phone_number_id" text NOT NULL,
	"display_phone_number" text,
	"type" "whatsapp_dispatch_type" DEFAULT 'broadcast' NOT NULL,
	"recipients" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"sequence_item_id" uuid,
	"content_piece_id" uuid,
	"message" text NOT NULL,
	"media_url" text,
	"media_type" text,
	"template_name" text,
	"template_params" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" "whatsapp_dispatch_status" DEFAULT 'queued' NOT NULL,
	"external_message_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"scheduled_at" timestamp with time zone,
	"sent_at" timestamp with time zone,
	"recipient_count" integer DEFAULT 0 NOT NULL,
	"delivered_count" integer DEFAULT 0 NOT NULL,
	"read_count" integer DEFAULT 0 NOT NULL,
	"failed_count" integer DEFAULT 0 NOT NULL,
	"error_message" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"idempotency_key" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "sequence_contacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sequence_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"name" text,
	"email" text,
	"phone" text,
	"segment" "contact_segment" DEFAULT 'cold' NOT NULL,
	"journey_stage" "journey_stage" DEFAULT 'awareness' NOT NULL,
	"engagement_score" real DEFAULT 0 NOT NULL,
	"items_received" integer DEFAULT 0 NOT NULL,
	"items_opened" integer DEFAULT 0 NOT NULL,
	"items_clicked" integer DEFAULT 0 NOT NULL,
	"conversions" integer DEFAULT 0 NOT NULL,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "sequence_engagement" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sequence_id" uuid NOT NULL,
	"item_id" uuid,
	"contact_id" uuid,
	"workspace_id" uuid NOT NULL,
	"event" "engagement_event_type" NOT NULL,
	"channel" text,
	"external_ref" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "first_touch_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"sequence_id" uuid NOT NULL,
	"contact_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"channel" text NOT NULL,
	"version" text NOT NULL,
	"attempt_key" text NOT NULL,
	"state" "first_touch_attempt_state" DEFAULT 'executing' NOT NULL,
	"lease_owner" text,
	"lease_expires_at" timestamp with time zone,
	"retry_count" integer DEFAULT 0 NOT NULL,
	"next_attempt_at" timestamp with time zone,
	"receipt" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "waitlist" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"whatsapp" text NOT NULL,
	"email" text,
	"segment" text DEFAULT 'individual' NOT NULL,
	"source" text,
	"confirmed_at" timestamp with time zone,
	"notified" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "launch_recordings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"folder_id" uuid,
	"campaign_id" uuid,
	"name" text NOT NULL,
	"state" text DEFAULT 'recording' NOT NULL,
	"events" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"paused_at" timestamp with time zone,
	"stopped_at" timestamp with time zone,
	"total_paused_ms" integer DEFAULT 0 NOT NULL,
	"video_path" text,
	"video_size" integer,
	"video_mime_type" text,
	"video_uploaded_at" timestamp with time zone,
	"recording_mode" text DEFAULT 'manual' NOT NULL,
	"finalized_at" timestamp with time zone,
	"finalization_status" text DEFAULT 'pending' NOT NULL,
	"finalization_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "launch_recordings_recording_mode_check" CHECK ("launch_recordings"."recording_mode" in ('manual', 'automatic')),
	CONSTRAINT "launch_recordings_finalization_status_check" CHECK ("launch_recordings"."finalization_status" in ('pending', 'processing', 'ready', 'failed'))
);

CREATE TABLE "recording_folders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"system_type" text,
	"is_system" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "recording_folders_system_type_check" CHECK ("recording_folders"."system_type" is null or "recording_folders"."system_type" in ('automatic', 'manual')),
	CONSTRAINT "recording_folders_system_consistency_check" CHECK (("recording_folders"."is_system" = true and "recording_folders"."system_type" is not null) or ("recording_folders"."is_system" = false and "recording_folders"."system_type" is null))
);

CREATE TABLE "client_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"name" text NOT NULL,
	"industry" text,
	"product_name" text,
	"target_audience" text,
	"brand_voice" text,
	"main_pain" text,
	"transformation" text,
	"website" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "social_comment_actions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"campaign_id" uuid,
	"platform" "comment_platform" NOT NULL,
	"post_id" text NOT NULL,
	"comment_id" text NOT NULL,
	"parent_comment_id" text,
	"author_name" text,
	"author_id" text,
	"comment_text" text NOT NULL,
	"classification" "comment_classification",
	"confidence" numeric(4, 3),
	"action" "comment_action" DEFAULT 'pending' NOT NULL,
	"ai_reply" text,
	"platform_reply_id" text,
	"processing_error" text,
	"overridden_by" uuid,
	"overridden_at" timestamp with time zone,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"processed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "meta_webhook_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid,
	"integration_id" uuid,
	"account_id" text NOT NULL,
	"provider_event_id" text NOT NULL,
	"action_key" text DEFAULT 'initial_response' NOT NULL,
	"event_type" text NOT NULL,
	"status" text DEFAULT 'received' NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"claimed_at" timestamp with time zone,
	"send_started_at" timestamp with time zone,
	"sent_at" timestamp with time zone,
	"latency_ms" integer,
	"sla_status" text,
	"retry_count" integer DEFAULT 0 NOT NULL,
	"next_retry_at" timestamp with time zone,
	"dead_letter_at" timestamp with time zone,
	"rule_ref" text,
	"sequence_id" uuid,
	"comment_action_id" uuid,
	"outbound_endpoint" text,
	"outbound_request" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"provider_response" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"provider_message_id" text,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "campaign_creatives" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"status" "creative_status" DEFAULT 'concept_pending' NOT NULL,
	"format" "creative_format" DEFAULT 'feed_square' NOT NULL,
	"platform" "creative_platform" DEFAULT 'instagram' NOT NULL,
	"request_note" text,
	"concept" jsonb,
	"preview_url" text,
	"final_url" text,
	"prompt" text,
	"rejection_reason" text,
	"concept_approved_at" timestamp with time zone,
	"preview_approved_at" timestamp with time zone,
	"approved_at" timestamp with time zone,
	"image_expired" boolean DEFAULT false NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"price_cents" integer NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"sequence_id" uuid,
	"success_url" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "product_sales" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"buyer_name" text NOT NULL,
	"buyer_email" text NOT NULL,
	"buyer_cpf" text,
	"amount_cents" integer NOT NULL,
	"currency" "payment_currency" DEFAULT 'BRL' NOT NULL,
	"method" "payment_method" NOT NULL,
	"status" "payment_status" DEFAULT 'pending' NOT NULL,
	"external_id" text,
	"pix_data" jsonb,
	"boleto_data" jsonb,
	"card_data" jsonb,
	"paid_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "academy_funnel_emails" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lead_id" uuid NOT NULL,
	"step" integer NOT NULL,
	"scheduled_at" timestamp with time zone NOT NULL,
	"sent_at" timestamp with time zone,
	"status" varchar(20) DEFAULT 'scheduled' NOT NULL,
	"resend_id" varchar(100),
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "academy_leads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255) NOT NULL,
	"name" varchar(255),
	"phone" varchar(30),
	"source" varchar(100) DEFAULT 'free-guide' NOT NULL,
	"ip_address" varchar(45),
	"user_agent" text,
	"utm_source" varchar(100),
	"utm_medium" varchar(100),
	"utm_campaign" varchar(100),
	"funnel_enrolled_at" timestamp with time zone,
	"funnel_step" integer DEFAULT -1 NOT NULL,
	"unsubscribed_at" timestamp with time zone,
	"converted_at" timestamp with time zone,
	"crm_status" varchar(30) DEFAULT 'novo' NOT NULL,
	"crm_notes" text,
	"crm_last_action_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "academy_purchases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"access_token" varchar(32) NOT NULL,
	"customer_email" varchar(255) NOT NULL,
	"customer_name" varchar(255),
	"product_id" varchar(50) NOT NULL,
	"asaas_payment_id" varchar(100),
	"asaas_customer_id" varchar(100),
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"amount_cents" integer NOT NULL,
	"payment_url" varchar(500),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"confirmed_at" timestamp with time zone,
	CONSTRAINT "academy_purchases_access_token_unique" UNIQUE("access_token")
);

CREATE TABLE "invite_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(20) NOT NULL,
	"plan_slug" varchar(20) DEFAULT 'agency' NOT NULL,
	"label" varchar(200),
	"used" boolean DEFAULT false NOT NULL,
	"used_by_email" varchar(255),
	"used_by_user_id" uuid,
	"used_by_workspace_id" uuid,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "invite_codes_code_unique" UNIQUE("code")
);

CREATE TABLE "agent_execution_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" uuid,
	"workspace_id" uuid NOT NULL,
	"user_id" uuid,
	"agent_name" text NOT NULL,
	"action_type" text NOT NULL,
	"input_summary" text,
	"output_summary" text,
	"confidence_score" real,
	"risk_score" real,
	"approval_required" boolean DEFAULT false NOT NULL,
	"approval_status" "agent_approval_status" DEFAULT 'not_required' NOT NULL,
	"execution_status" "agent_execution_status" DEFAULT 'started' NOT NULL,
	"error_message" text,
	"provider_used" text,
	"model_used" text,
	"tokens_used" integer,
	"estimated_cost_usd" real,
	"is_dry_run" boolean DEFAULT false NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);

CREATE TABLE "vertical_memory" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vertical_key" text NOT NULL,
	"workspace_id" uuid,
	"campaign_type" text,
	"track" text,
	"sample_count" integer DEFAULT 0 NOT NULL,
	"avg_health_score" integer,
	"learnings" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "launch_pipelines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"current_position" integer DEFAULT 0 NOT NULL,
	"capture_position" integer DEFAULT -1 NOT NULL,
	"total_campaigns" integer DEFAULT 0 NOT NULL,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "sales_conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"campaign_id" uuid,
	"contact_name" varchar(200) DEFAULT '' NOT NULL,
	"contact_handle" varchar(300) DEFAULT '' NOT NULL,
	"channel" varchar(50) DEFAULT 'whatsapp' NOT NULL,
	"funnel_stage" varchar(50) DEFAULT 'warming' NOT NULL,
	"status" varchar(50) DEFAULT 'active' NOT NULL,
	"assigned_agent" varchar(100) DEFAULT 'sales_warmer' NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"closed_at" timestamp
);

CREATE TABLE "sales_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"role" varchar(20) NOT NULL,
	"content" text NOT NULL,
	"agent_role" varchar(100),
	"is_ai_generated" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE "integration_chat_conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"ended_at" timestamp
);

CREATE TABLE "integration_chat_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"role" varchar(20) NOT NULL,
	"content" text NOT NULL,
	"image_url" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE "campaign_groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"platform" "group_platform" NOT NULL,
	"group_name" text NOT NULL,
	"group_link" text,
	"group_id" text,
	"description" text,
	"segment" text,
	"member_count" integer DEFAULT 0,
	"integration_id" uuid,
	"lifecycle_status" text DEFAULT 'planning' NOT NULL,
	"lifecycle_error" text,
	"last_synced_at" timestamp with time zone,
	"status" "group_status" DEFAULT 'active' NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "video_projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"campaign_id" uuid,
	"title" text NOT NULL,
	"format" "video_format" DEFAULT 'vsl' NOT NULL,
	"status" "video_project_status" DEFAULT 'intake' NOT NULL,
	"retention_policy" "video_project_retention_policy" DEFAULT 'archive' NOT NULL,
	"media_purged_at" timestamp with time zone,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"script" text,
	"storyboard" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"credits_used" integer DEFAULT 0 NOT NULL,
	"error_message" text,
	"pending_action" text,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "video_projects_workspace_id_id_unique" UNIQUE("workspace_id","id")
);

CREATE TABLE "correction_loops" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"video_project_id" uuid NOT NULL,
	"revision_id" uuid NOT NULL,
	"qc_issue_id" uuid,
	"status" "correction_loop_status" DEFAULT 'open' NOT NULL,
	"instruction" text NOT NULL,
	"resolution" text,
	"specification" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "production_assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"video_project_id" uuid NOT NULL,
	"manifest_id" uuid,
	"asset_type" "production_asset_type" NOT NULL,
	"status" "production_asset_status" DEFAULT 'uploading' NOT NULL,
	"name" text NOT NULL,
	"uri" text NOT NULL,
	"mime_type" text,
	"byte_size" integer,
	"duration_ms" integer,
	"specification" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "production_manifests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"video_project_id" uuid NOT NULL,
	"name" text NOT NULL,
	"status" "production_manifest_status" DEFAULT 'draft' NOT NULL,
	"specification" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "production_revisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"video_project_id" uuid NOT NULL,
	"manifest_id" uuid,
	"parent_revision_id" uuid,
	"revision_number" integer NOT NULL,
	"status" "production_revision_status" DEFAULT 'draft' NOT NULL,
	"note" text,
	"specification" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "qc_issues" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"video_project_id" uuid NOT NULL,
	"qc_report_id" uuid NOT NULL,
	"severity" "qc_issue_severity" DEFAULT 'warning' NOT NULL,
	"status" "qc_issue_status" DEFAULT 'open' NOT NULL,
	"code" text NOT NULL,
	"message" text NOT NULL,
	"details" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "qc_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"video_project_id" uuid NOT NULL,
	"render_job_id" uuid,
	"status" "qc_report_status" DEFAULT 'pending' NOT NULL,
	"summary" text,
	"specification" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "render_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"video_project_id" uuid NOT NULL,
	"manifest_id" uuid,
	"status" "render_job_status" DEFAULT 'queued' NOT NULL,
	"output_uri" text,
	"output_mime_type" text,
	"error_message" text,
	"specification" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"queued_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "timeline_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"video_project_id" uuid NOT NULL,
	"track_id" uuid NOT NULL,
	"asset_id" uuid,
	"position" integer NOT NULL,
	"start_ms" integer NOT NULL,
	"duration_ms" integer NOT NULL,
	"trim_start_ms" integer DEFAULT 0 NOT NULL,
	"trim_end_ms" integer DEFAULT 0 NOT NULL,
	"settings" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "timeline_tracks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"video_project_id" uuid NOT NULL,
	"manifest_id" uuid NOT NULL,
	"track_type" timeline_track_type NOT NULL,
	"name" text NOT NULL,
	"position" integer NOT NULL,
	"settings" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "video_media_purges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"video_project_id" uuid NOT NULL,
	"render_job_id" uuid NOT NULL,
	"status" "video_media_purge_status" DEFAULT 'requested' NOT NULL,
	"acknowledged_checksum" text NOT NULL,
	"confirmation_text" text NOT NULL,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone,
	"purged_at" timestamp with time zone,
	"object_count" integer DEFAULT 0 NOT NULL,
	"deleted_object_count" integer DEFAULT 0 NOT NULL,
	"byte_count" integer DEFAULT 0 NOT NULL,
	"deleted_byte_count" integer DEFAULT 0 NOT NULL,
	"errors" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "agent_clarification_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" uuid,
	"workspace_id" uuid NOT NULL,
	"agent_role" text NOT NULL,
	"question" text NOT NULL,
	"options" jsonb,
	"context" text,
	"is_briefing_gap" boolean DEFAULT false,
	"severity" text DEFAULT 'normal',
	"status" text DEFAULT 'pending',
	"answer" text,
	"answered_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE "masterprint_downloads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"fingerprint" text NOT NULL,
	"user_id" text NOT NULL,
	"user_email" text NOT NULL,
	"user_name" text NOT NULL,
	"workspace_id" text NOT NULL,
	"workspace_name" text NOT NULL,
	"campaign_id" text NOT NULL,
	"campaign_title" text,
	"track" text,
	"ip_address" text,
	"user_agent" text,
	"generated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "masterprint_downloads_fingerprint_unique" UNIQUE("fingerprint")
);

CREATE TABLE "market_intel_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"campaign_id" uuid,
	"product_name" text NOT NULL,
	"market" text NOT NULL,
	"status" "market_intel_status" DEFAULT 'running' NOT NULL,
	"input" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"output" jsonb,
	"error" text,
	"source" text DEFAULT 'manual' NOT NULL,
	"chat_history" jsonb,
	"deepdive_insights" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "instagram_dm_sequences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"ig_account_id" text NOT NULL,
	"recipient_id" text NOT NULL,
	"post_id" uuid,
	"steps" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"current_step" integer DEFAULT 0 NOT NULL,
	"next_step_at" timestamp with time zone NOT NULL,
	"completed_at" timestamp with time zone,
	"last_error" text,
	"retry_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "social_presence_config" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"platforms" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"content_pillars" text[] DEFAULT '{}' NOT NULL,
	"tone" text DEFAULT '' NOT NULL,
	"business_context" text DEFAULT '' NOT NULL,
	"aligned_campaign_id" uuid,
	"weekly_insight" jsonb,
	"bio_suggestions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"last_week_generated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "social_presence_config_workspace_id_unique" UNIQUE("workspace_id")
);

CREATE TABLE "social_presence_posts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"platform" "presence_platform" NOT NULL,
	"status" "presence_post_status" DEFAULT 'draft' NOT NULL,
	"week_start" timestamp with time zone NOT NULL,
	"day_index" integer DEFAULT 0 NOT NULL,
	"posting_time" text DEFAULT '09:00' NOT NULL,
	"scheduled_for" timestamp with time zone,
	"format" text DEFAULT 'feed' NOT NULL,
	"pillar" text DEFAULT '' NOT NULL,
	"caption" text DEFAULT '' NOT NULL,
	"hashtags" text[] DEFAULT '{}' NOT NULL,
	"visual_direction" text DEFAULT '' NOT NULL,
	"video_script" text,
	"reel_script" text,
	"media_urls" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"objective" text DEFAULT '' NOT NULL,
	"launch_aligned" boolean DEFAULT false NOT NULL,
	"campaign_id" uuid,
	"launch_phase" text,
	"published_at" timestamp with time zone,
	"platform_post_id" text,
	"platform_url" text,
	"error_message" text,
	"retry_count" integer DEFAULT 0 NOT NULL,
	"manual_retry_count" integer DEFAULT 0 NOT NULL,
	"metrics" jsonb DEFAULT '{"likes":0,"comments":0,"shares":0,"views":0,"reach":0,"impressions":0}'::jsonb NOT NULL,
	"metrics_synced_at" timestamp with time zone,
	"ai_generated" boolean DEFAULT true NOT NULL,
	"media_gen_status" text,
	"storyboard_urls" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"media_job_id" text,
	"media_job_provider" text,
	"story_media_type" text,
	"highlight_name" text,
	"dm_response_flow" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "social_conversation_turns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"integration_id" uuid NOT NULL,
	"campaign_id" uuid,
	"account_id" text NOT NULL,
	"provider_user_id" text,
	"provider_event_id" text NOT NULL,
	"provider_message_id" text,
	"channel" text NOT NULL,
	"direction" text NOT NULL,
	"input_text" text,
	"reply_text" text,
	"masterplan_version" text,
	"masterplan_fingerprint" text,
	"context_fingerprint" text,
	"intent" text,
	"sales_stage" text,
	"decision" text,
	"confidence" numeric(4, 3),
	"needs_human" text,
	"safety_reason" text,
	"provenance" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"provider_response_id" text,
	"provider_status" text,
	"provider_error" text,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "contract_acceptances" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"campaign_id" uuid,
	"contract_key" text NOT NULL,
	"contract_version" text NOT NULL,
	"contract_hash" text NOT NULL,
	"acceptance_type" "contract_acceptance_type" NOT NULL,
	"evidence_snapshot" jsonb NOT NULL,
	"accepted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"idempotency_key" text NOT NULL,
	"revoked_at" timestamp with time zone,
	"revoked_by_user_id" uuid,
	"revocation_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "contract_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contract_key" text NOT NULL,
	"version" text NOT NULL,
	"content_hash" text NOT NULL,
	"content_snapshot" text NOT NULL,
	"published_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "mandatory_pauses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"campaign_id" uuid,
	"channel" text,
	"action" text,
	"pause_class" "mandatory_pause_class" NOT NULL,
	"severity" text NOT NULL,
	"status" "mandatory_pause_status" DEFAULT 'active' NOT NULL,
	"reason" text NOT NULL,
	"evidence_summary" text NOT NULL,
	"source_actor" text NOT NULL,
	"source_type" "mandatory_pause_source_type" NOT NULL,
	"idempotency_key" text NOT NULL,
	"resolved_at" timestamp with time zone,
	"resolved_by_user_id" uuid,
	"resolution_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "paid_media_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"integration_id" uuid NOT NULL,
	"provider" "paid_media_provider" NOT NULL,
	"provider_account_id" text NOT NULL,
	"account_name" text,
	"currency" text NOT NULL,
	"timezone" text NOT NULL,
	"is_selected" boolean DEFAULT false NOT NULL,
	"operational_health" boolean DEFAULT false NOT NULL,
	"health_checked_at" timestamp with time zone,
	"discovered_at" timestamp with time zone DEFAULT now() NOT NULL,
	"selected_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "paid_media_action_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"proposal_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"attempt_number" integer DEFAULT 1 NOT NULL,
	"status" "paid_media_attempt_status" DEFAULT 'pending' NOT NULL,
	"idempotency_key" text NOT NULL,
	"before_snapshot" jsonb NOT NULL,
	"provider_response" jsonb,
	"verification_evidence" jsonb,
	"after_snapshot" jsonb,
	"rollback_evidence" jsonb,
	"error_code" text,
	"error_message" text,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "paid_media_approvals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"proposal_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"decision" "paid_media_proposal_status" NOT NULL,
	"approver_id" uuid,
	"evidence" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"comment" text,
	"decided_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "paid_media_attribution_touchpoints" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"account_id" uuid,
	"entity_id" uuid,
	"provider" "paid_media_provider",
	"external_touchpoint_id" text NOT NULL,
	"click_id" text,
	"utm_source" text,
	"utm_campaign" text,
	"occurred_at" timestamp with time zone NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "paid_media_budget_strategies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	"campaign_entity_id" uuid NOT NULL,
	"strategy" "paid_media_budget_strategy" NOT NULL,
	"observed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"provider_data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "paid_media_conversions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"touchpoint_id" uuid,
	"external_conversion_id" text NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"currency" text NOT NULL,
	"value" numeric(18, 6) DEFAULT '0' NOT NULL,
	"reconciliation_status" "paid_media_reconciliation_status" DEFAULT 'unattributed' NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "paid_media_datasets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	"provider" "paid_media_provider" NOT NULL,
	"provider_dataset_id" text NOT NULL,
	"name" text,
	"ingestion_key" text NOT NULL,
	"last_event_at" timestamp with time zone,
	"last_diagnostic_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "paid_media_entities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	"provider" "paid_media_provider" NOT NULL,
	"provider_entity_id" text NOT NULL,
	"entity_type" "paid_media_entity_type" NOT NULL,
	"parent_provider_entity_id" text,
	"name" text,
	"status" text,
	"version" text,
	"currency" text NOT NULL,
	"timezone" text NOT NULL,
	"provider_data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"last_synced_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "paid_media_event_receipts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"dataset_id" uuid NOT NULL,
	"source" "paid_media_event_source" NOT NULL,
	"event_id" text NOT NULL,
	"event_name" text NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"event_match_keys" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"delivery_status" "paid_media_event_delivery_status" DEFAULT 'pending' NOT NULL,
	"provider_attempted_at" timestamp with time zone,
	"provider_response" jsonb,
	"provider_error_code" text,
	"provider_error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "paid_media_insights" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	"entity_id" uuid NOT NULL,
	"provider" "paid_media_provider" NOT NULL,
	"provider_insight_id" text,
	"metric_date" date NOT NULL,
	"date_grain" "paid_media_date_grain" DEFAULT 'daily' NOT NULL,
	"attribution_window" text,
	"currency" text NOT NULL,
	"timezone" text NOT NULL,
	"impressions" integer DEFAULT 0 NOT NULL,
	"clicks" integer DEFAULT 0 NOT NULL,
	"spend" numeric(18, 6) DEFAULT '0' NOT NULL,
	"conversions" numeric(18, 6) DEFAULT '0' NOT NULL,
	"conversion_value" numeric(18, 6) DEFAULT '0' NOT NULL,
	"raw_metrics" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "paid_media_launch_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"launch_plan_id" uuid NOT NULL,
	"attempt_key" text NOT NULL,
	"status" "paid_media_launch_attempt_status" DEFAULT 'executing' NOT NULL,
	"lease_owner" text,
	"lease_expires_at" timestamp with time zone,
	"heartbeat_at" timestamp with time zone,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "paid_media_launch_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"commercial_product_id" uuid NOT NULL,
	"commercial_subscription_id" uuid NOT NULL,
	"campaign_id" uuid NOT NULL,
	"masterplan_version_id" uuid NOT NULL,
	"context_fingerprint" text NOT NULL,
	"account_id" uuid NOT NULL,
	"product_intake_version_id" uuid NOT NULL,
	"provider" "paid_media_provider" NOT NULL,
	"launch_stage" "paid_media_launch_stage" DEFAULT 'compiled' NOT NULL,
	"plan_hash" text NOT NULL,
	"tree" jsonb NOT NULL,
	"provider_payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"readiness" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"approval_snapshot" jsonb,
	"approved_by_user_id" uuid,
	"approved_at" timestamp with time zone,
	"created_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "paid_media_launch_steps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"attempt_id" uuid NOT NULL,
	"step_key" text NOT NULL,
	"sequence" integer DEFAULT 0 NOT NULL,
	"entity_type" "paid_media_entity_type" NOT NULL,
	"provider_entity_id" text,
	"status" "paid_media_launch_step_status" DEFAULT 'pending' NOT NULL,
	"provider_response" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"readback" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"compensation" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "paid_media_policies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"provider" "paid_media_provider",
	"account_id" uuid,
	"enabled" boolean DEFAULT false NOT NULL,
	"auto_execute" boolean DEFAULT false NOT NULL,
	"mandatory_pause" boolean DEFAULT false NOT NULL,
	"mandatory_pause_reason" text,
	"minimum_sample_size" integer DEFAULT 0 NOT NULL,
	"minimum_data_quality_score" numeric(5, 4) DEFAULT '0' NOT NULL,
	"max_daily_budget_change_percent" numeric(8, 4),
	"max_daily_budget_change_absolute" numeric(18, 6),
	"max_bid_change_percent" numeric(8, 4),
	"accepted_at" timestamp with time zone,
	"acceptance_expires_at" timestamp with time zone,
	"accepted_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "paid_media_proposals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"campaign_id" uuid,
	"masterplan_version_id" uuid,
	"context_fingerprint" text,
	"account_id" uuid,
	"entity_id" uuid,
	"provider" "paid_media_provider" NOT NULL,
	"action_type" "paid_media_action_type" NOT NULL,
	"status" "paid_media_proposal_status" DEFAULT 'pending_approval' NOT NULL,
	"idempotency_key" text NOT NULL,
	"recommendation" text NOT NULL,
	"metrics" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"simulation" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"before_allocation" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"after_allocation" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"requested_change" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"policy_decision" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "paid_media_sync_cursors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	"entity_type" "paid_media_entity_type" NOT NULL,
	"cursor" text,
	"synced_through" timestamp with time zone,
	"claimed_at" timestamp with time zone,
	"claim_token" uuid,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "orchestration_dead_letters" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"campaign_id" uuid NOT NULL,
	"action" text NOT NULL,
	"job_id" text NOT NULL,
	"correlation_id" text NOT NULL,
	"attempt_count" integer NOT NULL,
	"classification" "dead_letter_classification" NOT NULL,
	"error_summary" text NOT NULL,
	"source" text DEFAULT 'worker' NOT NULL,
	"first_failed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_failed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"replay_status" "dead_letter_replay_status" DEFAULT 'none' NOT NULL,
	"replay_job_id" text,
	"replayed_by" text,
	"replayed_at" timestamp with time zone,
	"replay_finished_at" timestamp with time zone,
	"replay_error_summary" text
);

CREATE TABLE "native_media_consents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"subject_reference" text NOT NULL,
	"consent_type" "native_media_consent_type" NOT NULL,
	"evidence_object_key" text NOT NULL,
	"evidence_sha256" text NOT NULL,
	"granted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "native_media_job_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"video_project_id" uuid NOT NULL,
	"job_id" uuid NOT NULL,
	"worker_id" uuid,
	"event_type" "native_media_event_type" NOT NULL,
	"details" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "native_media_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"video_project_id" uuid NOT NULL,
	"operation" "native_media_operation" NOT NULL,
	"status" "native_media_job_status" DEFAULT 'queued' NOT NULL,
	"requested_model_id" text,
	"requested_model_revision" text,
	"required_license" text,
	"masterplan_version_id" uuid,
	"context_fingerprint" text,
	"idempotency_key" text,
	"consent_id" uuid,
	"request" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"input_objects" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"output_objects" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"attempt" integer DEFAULT 0 NOT NULL,
	"max_attempts" integer DEFAULT 3 NOT NULL,
	"lease_token" uuid,
	"leased_worker_id" uuid,
	"lease_expires_at" timestamp with time zone,
	"cancel_requested_at" timestamp with time zone,
	"error_code" text,
	"error_message" text,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "native_media_provenance" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"video_project_id" uuid NOT NULL,
	"job_id" uuid NOT NULL,
	"output_object_key" text NOT NULL,
	"output_sha256" text NOT NULL,
	"model_id" text NOT NULL,
	"model_revision" text,
	"model_license" text,
	"worker_id" uuid,
	"gpu" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"runtime" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"source_inputs" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "native_media_usage" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"video_project_id" uuid NOT NULL,
	"job_id" uuid NOT NULL,
	"worker_id" uuid,
	"model_id" text,
	"gpu_seconds" numeric(14, 3) DEFAULT '0' NOT NULL,
	"estimated_gpu_cost" numeric(14, 6) DEFAULT '0' NOT NULL,
	"actual_gpu_cost" numeric(14, 6),
	"telemetry" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "native_media_worker_nonces" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"worker_id" uuid NOT NULL,
	"nonce" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "native_media_workers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"worker_name" text NOT NULL,
	"credential_hash" text NOT NULL,
	"capabilities" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"gpu_info" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"runtime_info" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"last_heartbeat_at" timestamp with time zone DEFAULT now() NOT NULL,
	"healthy" boolean DEFAULT false NOT NULL,
	"disabled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "masterplan_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"campaign_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"status" "masterplan_version_status" DEFAULT 'draft' NOT NULL,
	"snapshot" jsonb NOT NULL,
	"content_hash" text NOT NULL,
	"context_fingerprint" text NOT NULL,
	"readiness_score" integer NOT NULL,
	"readiness_status" text NOT NULL,
	"readiness_blockers" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"autonomy_contract" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"allowed_actions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"required_approvals" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"commercial_product_id" uuid,
	"commercial_subscription_id" uuid,
	"product_intake_version_id" uuid,
	"created_by_user_id" uuid,
	"approved_by_user_id" uuid,
	"approved_at" timestamp with time zone,
	"superseded_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "masterplan_versions_workspace_campaign_id_uidx" UNIQUE("workspace_id","campaign_id","id")
);

CREATE TABLE "execution_evidence" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"campaign_id" uuid,
	"masterplan_version_id" uuid,
	"context_fingerprint" text,
	"subject_type" text NOT NULL,
	"subject_id" uuid NOT NULL,
	"state" "execution_evidence_state" NOT NULL,
	"details" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "regional_alerts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"campaign_id" uuid NOT NULL,
	"change_event_id" uuid NOT NULL,
	"status" "regional_alert_status" DEFAULT 'open' NOT NULL,
	"acknowledged_at" timestamp with time zone,
	"acknowledged_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "regional_audience_opportunities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"campaign_id" uuid NOT NULL,
	"signal_id" uuid NOT NULL,
	"competitor_id" uuid,
	"identity_hint_fingerprint" text,
	"opportunity_type" text NOT NULL,
	"summary" text NOT NULL,
	"attributes" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"heat_score" integer DEFAULT 0 NOT NULL,
	"heat_band" text DEFAULT 'cold' NOT NULL,
	"score_reasons" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"evidence_refs" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"observed_intent" text,
	"interest_topic" text,
	"inferred_region" text,
	"region_provenance" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"interaction_recency_hours" integer,
	"interaction_frequency" integer DEFAULT 1 NOT NULL,
	"lifecycle" "regional_audience_opportunity_lifecycle" DEFAULT 'observed' NOT NULL,
	"contact_permission" "regional_lawful_basis_status" DEFAULT 'unknown' NOT NULL,
	"contact_phone_e164" text,
	"processing_purpose" text,
	"lawful_basis" "regional_lawful_basis_status" DEFAULT 'unknown' NOT NULL,
	"consent_source" text,
	"consented_at" timestamp with time zone,
	"jurisdiction_codes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"retention_until" timestamp with time zone,
	"deletion_state" "regional_deletion_state" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "regional_audience_segments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"campaign_id" uuid NOT NULL,
	"fingerprint" text NOT NULL,
	"label" text NOT NULL,
	"dimensions" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"signal_count" integer DEFAULT 0 NOT NULL,
	"opportunity_count" integer DEFAULT 0 NOT NULL,
	"last_observed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "regional_change_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"campaign_id" uuid NOT NULL,
	"competitor_id" uuid NOT NULL,
	"observation_id" uuid NOT NULL,
	"previous_observation_id" uuid,
	"changes" jsonb NOT NULL,
	"material" text DEFAULT 'true' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "regional_change_events_material_check" CHECK ("regional_change_events"."material" in ('true', 'false'))
);

CREATE TABLE "regional_competitors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"campaign_id" uuid NOT NULL,
	"name" text NOT NULL,
	"kind" "regional_competitor_kind" NOT NULL,
	"website_url" text,
	"normalized_website_url" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "regional_evidence" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"campaign_id" uuid NOT NULL,
	"source_id" uuid NOT NULL,
	"fingerprint" text NOT NULL,
	"claim" text NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"observed_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "regional_monitor_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"campaign_id" uuid NOT NULL,
	"idempotency_key" text NOT NULL,
	"status" "regional_monitor_run_status" DEFAULT 'queued' NOT NULL,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"error" text,
	"summary" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "regional_observations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"campaign_id" uuid NOT NULL,
	"competitor_id" uuid NOT NULL,
	"evidence_id" uuid NOT NULL,
	"fingerprint" text NOT NULL,
	"facts" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"observed_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "regional_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"campaign_id" uuid NOT NULL,
	"region" text NOT NULL,
	"locale" text DEFAULT 'pt-BR' NOT NULL,
	"country_code" text,
	"subdivision" text,
	"city" text,
	"postal_code" text,
	"address" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"timezone" text,
	"languages" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"operating_regions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"residence_region" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"service_region" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"geo_provenance" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"geo_confidence" integer,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "regional_public_sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"campaign_id" uuid NOT NULL,
	"competitor_id" uuid,
	"url" text NOT NULL,
	"normalized_url" text NOT NULL,
	"title" text,
	"source_type" text DEFAULT 'public_web' NOT NULL,
	"verified_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "regional_social_signals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"campaign_id" uuid NOT NULL,
	"platform" text NOT NULL,
	"public_account_ref" text,
	"display_name" text,
	"source_url" text NOT NULL,
	"normalized_source_url" text NOT NULL,
	"post_ref" text,
	"interaction_type" text NOT NULL,
	"public_text_excerpt" text,
	"occurred_at" timestamp with time zone NOT NULL,
	"sentiment" text,
	"intent" text,
	"confidence" integer,
	"region_inference" text,
	"region_provenance" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"lawful_basis_status" "regional_lawful_basis_status" DEFAULT 'unknown' NOT NULL,
	"sensitive_data_excluded" boolean DEFAULT true NOT NULL,
	"fingerprint" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "interaction_approvals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"draft_id" uuid NOT NULL,
	"decision" text NOT NULL,
	"modified_content" text,
	"decided_by_user_id" uuid,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "interaction_decisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"opportunity_id" uuid NOT NULL,
	"decision" "interaction_decision" NOT NULL,
	"reasons" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"governor_snapshot" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "interaction_drafts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"opportunity_id" uuid NOT NULL,
	"content" text NOT NULL,
	"content_fingerprint" text NOT NULL,
	"cta_level" integer DEFAULT 0 NOT NULL,
	"council_assessment" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"similarity_score" integer DEFAULT 0 NOT NULL,
	"state" "interaction_lifecycle" DEFAULT 'proposed' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "interaction_executions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"opportunity_id" uuid NOT NULL,
	"draft_id" uuid,
	"mode" text NOT NULL,
	"state" "interaction_lifecycle" DEFAULT 'scheduled' NOT NULL,
	"evidence" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"result" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"incident" jsonb,
	"reserved_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);

CREATE TABLE "interaction_governance_policies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"window_minutes" integer DEFAULT 1440 NOT NULL,
	"workspace_ceiling" integer DEFAULT 0 NOT NULL,
	"account_ceiling" integer DEFAULT 0 NOT NULL,
	"competitor_ceiling" integer DEFAULT 0 NOT NULL,
	"post_ceiling" integer DEFAULT 0 NOT NULL,
	"recipient_ceiling" integer DEFAULT 0 NOT NULL,
	"recipient_cooldown_minutes" integer DEFAULT 10080 NOT NULL,
	"maximum_risk_score" integer DEFAULT 0 NOT NULL,
	"require_approval" boolean DEFAULT true NOT NULL,
	"purpose" text DEFAULT 'public engagement' NOT NULL,
	"jurisdiction_codes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"retention_days" integer DEFAULT 30 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "interaction_opportunities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"campaign_id" uuid,
	"source_audience_opportunity_id" uuid,
	"recipient_id" uuid NOT NULL,
	"integration_id" uuid NOT NULL,
	"platform" text NOT NULL,
	"action" "interaction_action" NOT NULL,
	"competitor_ref" text,
	"post_ref" text,
	"evidence" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"context" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"lawful_basis" text DEFAULT 'unknown' NOT NULL,
	"contactable" boolean DEFAULT false NOT NULL,
	"asset_owned" boolean DEFAULT false NOT NULL,
	"conversation_owned" boolean DEFAULT false NOT NULL,
	"risk_score" integer DEFAULT 100 NOT NULL,
	"state" "interaction_lifecycle" DEFAULT 'observed' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "interaction_platform_capabilities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"integration_id" uuid NOT NULL,
	"platform" text NOT NULL,
	"action" "interaction_action" NOT NULL,
	"official_adapter" boolean DEFAULT false NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"allows_automatic_execution" boolean DEFAULT false NOT NULL,
	"requires_owned_asset" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "interaction_recipients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"fingerprint" text NOT NULL,
	"opted_out" boolean DEFAULT false NOT NULL,
	"opted_out_at" timestamp with time zone,
	"purpose" text DEFAULT 'public engagement' NOT NULL,
	"jurisdiction_codes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"retention_until" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "radar_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"requested_by_user_id" uuid,
	"campaign_id" uuid,
	"package" text NOT NULL,
	"currency" "radar_billing_currency" NOT NULL,
	"amount_cents" integer NOT NULL,
	"description" text NOT NULL,
	"limits_snapshot" jsonb,
	"method" text,
	"status" "radar_order_status" DEFAULT 'pending' NOT NULL,
	"idempotency_key" text NOT NULL,
	"provider_payment_id" text,
	"provider_data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"confirmed_at" timestamp with time zone,
	"fulfilled_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"refunded_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "radar_purchase_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"package" "radar_package" NOT NULL,
	"currency" "radar_billing_currency" NOT NULL,
	"status" "radar_purchase_request_status" DEFAULT 'pending_sales' NOT NULL,
	"requested_by_user_id" uuid,
	"notes" text,
	"idempotency_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "radar_subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"package" "radar_package" NOT NULL,
	"currency" "radar_billing_currency" NOT NULL,
	"status" "radar_subscription_status" DEFAULT 'pending' NOT NULL,
	"period_starts_at" timestamp with time zone NOT NULL,
	"period_ends_at" timestamp with time zone NOT NULL,
	"window_starts_at" timestamp with time zone,
	"window_ends_at" timestamp with time zone,
	"limits_snapshot" jsonb NOT NULL,
	"entitlement_source" "radar_entitlement_source" DEFAULT 'admin' NOT NULL,
	"order_id" uuid,
	"campaign_id" uuid,
	"activated_by_user_id" uuid,
	"cancelled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "radar_usage_ledger" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"subscription_id" uuid,
	"dimension" "radar_usage_dimension" NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"campaign_id" uuid,
	"idempotency_key" text NOT NULL,
	"period_starts_at" timestamp with time zone NOT NULL,
	"period_ends_at" timestamp with time zone NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "commercial_products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"master_plan_key" text NOT NULL,
	"status" "commercial_product_status" DEFAULT 'active' NOT NULL,
	"capabilities" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"usage_policy" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "commercial_products_key_unique" UNIQUE("key")
);

CREATE TABLE "commercial_subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"status" "commercial_subscription_status" DEFAULT 'pending' NOT NULL,
	"provider_metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"started_at" timestamp with time zone,
	"ends_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "entitlement_grants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"subscription_id" uuid NOT NULL,
	"capability" text NOT NULL,
	"value" jsonb NOT NULL,
	"source" "entitlement_grant_source" DEFAULT 'subscription' NOT NULL,
	"granted_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "community_action_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"message_id" uuid,
	"integration_id" uuid,
	"action" "community_decision" NOT NULL,
	"idempotency_key" text NOT NULL,
	"status" "community_attempt_status" DEFAULT 'pending' NOT NULL,
	"provider_receipt" jsonb,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);

CREATE TABLE "community_conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"integration_id" uuid,
	"channel" "community_channel" NOT NULL,
	"provider_conversation_id" text NOT NULL,
	"title" text,
	"last_message_at" timestamp with time zone,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "community_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"conversation_id" uuid NOT NULL,
	"sender_participant_id" uuid,
	"provider_message_id" text NOT NULL,
	"direction" "community_message_direction" NOT NULL,
	"body" text,
	"attachments" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" "community_message_status" DEFAULT 'received' NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "community_moderation_decisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"message_id" uuid NOT NULL,
	"rule_id" uuid,
	"decision" "community_decision" NOT NULL,
	"reason" text NOT NULL,
	"approved_by" uuid,
	"approved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "community_moderation_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"channel" "community_channel",
	"name" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"condition" jsonb NOT NULL,
	"decision" "community_decision" NOT NULL,
	"requires_approval" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "community_participants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"conversation_id" uuid NOT NULL,
	"provider_participant_id" text NOT NULL,
	"display_name" text,
	"role" text,
	"consent_granted" boolean DEFAULT false NOT NULL,
	"identity_provenance" text DEFAULT 'provider_event' NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "community_provider_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"channel" "community_channel" NOT NULL,
	"provider_event_id" text NOT NULL,
	"payload" jsonb NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "community_response_policies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"campaign_id" uuid,
	"channel" "community_channel" NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"requires_consent" boolean DEFAULT true NOT NULL,
	"requires_approval" boolean DEFAULT true NOT NULL,
	"daily_quota" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "buyer_onboarding_instances" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"sale_id" uuid NOT NULL,
	"contact_id" uuid,
	"product_id" uuid NOT NULL,
	"status" "lifecycle_action_status" DEFAULT 'pending' NOT NULL,
	"activated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "cart_recovery_actions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"sale_id" uuid NOT NULL,
	"contact_id" uuid,
	"status" "lifecycle_action_status" DEFAULT 'pending' NOT NULL,
	"channel" text NOT NULL,
	"provider_dispatch_id" uuid,
	"reason" text,
	"attempted_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "lifecycle_contacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"email" text,
	"phone" text,
	"name" text,
	"email_consent" boolean DEFAULT false NOT NULL,
	"whatsapp_consent" boolean DEFAULT false NOT NULL,
	"stage" "lifecycle_stage" DEFAULT 'lead' NOT NULL,
	"temperature" integer DEFAULT 0 NOT NULL,
	"purchase_probability" integer DEFAULT 0 NOT NULL,
	"lifetime_value_cents" integer DEFAULT 0 NOT NULL,
	"churn_risk" integer DEFAULT 0 NOT NULL,
	"source" text,
	"profile" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"last_activity_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "lifecycle_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"contact_id" uuid,
	"event_key" text NOT NULL,
	"type" "lifecycle_event_type" NOT NULL,
	"status" "lifecycle_event_status" DEFAULT 'accepted' NOT NULL,
	"subject_type" text,
	"subject_id" text,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"processed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "purchaser_referral_attributions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"referral_id" uuid NOT NULL,
	"referred_contact_id" uuid NOT NULL,
	"sale_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "purchaser_referrals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"referrer_contact_id" uuid NOT NULL,
	"code" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "referral_rewards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"attribution_id" uuid NOT NULL,
	"status" "referral_reward_status" DEFAULT 'pending' NOT NULL,
	"amount_cents" integer DEFAULT 0 NOT NULL,
	"reason" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reversed_at" timestamp with time zone
);

CREATE TABLE "retention_actions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"contact_id" uuid NOT NULL,
	"status" "lifecycle_action_status" DEFAULT 'pending' NOT NULL,
	"risk_score" integer NOT NULL,
	"reason" text NOT NULL,
	"provider_dispatch_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);

CREATE TABLE "upsell_actions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"offer_id" uuid NOT NULL,
	"contact_id" uuid NOT NULL,
	"source_sale_id" uuid NOT NULL,
	"converted_sale_id" uuid,
	"status" "lifecycle_action_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "upsell_offers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"target_product_id" uuid NOT NULL,
	"approved" boolean DEFAULT false NOT NULL,
	"minimum_activation_hours" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "product_intakes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"commercial_product_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"status" "product_intake_status" DEFAULT 'draft' NOT NULL,
	"snapshot" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"entry_point" "product_intake_entry_point" NOT NULL,
	"source_campaign_id" uuid,
	"created_by_user_id" uuid,
	"approved_by_user_id" uuid,
	"approved_at" timestamp with time zone,
	"locked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "approval_decisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"campaign_id" uuid NOT NULL,
	"subject_type" "approval_subject_type" NOT NULL,
	"subject_id" text NOT NULL,
	"subject_version" integer,
	"decision" "approval_decision" NOT NULL,
	"actor_user_id" uuid NOT NULL,
	"decision_reason" text,
	"expected_snapshot_hash" text NOT NULL,
	"resolved_snapshot_hash" text NOT NULL,
	"masterplan_version_id" uuid,
	"context_fingerprint" text,
	"idempotency_key" text NOT NULL,
	"command_fingerprint" text NOT NULL,
	"content_piece_id" uuid,
	"checkpoint_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "approval_decisions_reason_required_check" CHECK (("decision" = 'approved' AND "decision_reason" IS NULL) OR ("decision" <> 'approved' AND length(trim("decision_reason")) > 0)),
	CONSTRAINT "approval_decisions_snapshot_hash_match_check" CHECK ("expected_snapshot_hash" = "resolved_snapshot_hash"),
	CONSTRAINT "approval_decisions_subject_typed_check" CHECK ((
        ("subject_type" = 'masterplan' AND "masterplan_version_id"::text = "subject_id" AND "content_piece_id" IS NULL AND "checkpoint_id" IS NULL)
        OR ("subject_type" = 'content_piece' AND "content_piece_id"::text = "subject_id" AND "masterplan_version_id" IS NULL AND "checkpoint_id" IS NULL)
        OR ("subject_type" = 'checkpoint' AND "checkpoint_id"::text = "subject_id" AND "content_piece_id" IS NULL)
      ))
);

CREATE TABLE "approval_sla_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"obligation_id" uuid NOT NULL,
	"event_kind" "approval_sla_event_kind" NOT NULL,
	"channel" "approval_sla_channel" DEFAULT 'in_app' NOT NULL,
	"delivered_at" timestamp with time zone DEFAULT now() NOT NULL,
	"receipt" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "approval_sla_obligations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"campaign_id" uuid NOT NULL,
	"subject_type" text NOT NULL,
	"subject_id" text NOT NULL,
	"masterplan_version_id" uuid,
	"content_piece_id" uuid,
	"checkpoint_id" uuid,
	"subject_snapshot_hash" text NOT NULL,
	"idempotency_key" text NOT NULL,
	"command_fingerprint" text NOT NULL,
	"due_at" timestamp with time zone NOT NULL,
	"warning_at" timestamp with time zone NOT NULL,
	"escalation_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"status" "approval_sla_status" DEFAULT 'open' NOT NULL,
	"channel" "approval_sla_channel" DEFAULT 'in_app' NOT NULL,
	"created_by" uuid NOT NULL,
	"resolved_decision_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "approval_sla_obligations_window_check" CHECK ("approval_sla_obligations"."warning_at" < "approval_sla_obligations"."due_at" AND "approval_sla_obligations"."due_at" < "approval_sla_obligations"."escalation_at" AND "approval_sla_obligations"."escalation_at" <= "approval_sla_obligations"."expires_at"),
	CONSTRAINT "approval_sla_obligations_subject_typed_check" CHECK ((
    ("subject_type" = 'masterplan' AND "masterplan_version_id"::text = "subject_id" AND "content_piece_id" IS NULL AND "checkpoint_id" IS NULL)
    OR ("subject_type" = 'content_piece' AND "content_piece_id"::text = "subject_id" AND "masterplan_version_id" IS NULL AND "checkpoint_id" IS NULL)
    OR ("subject_type" = 'checkpoint' AND "checkpoint_id"::text = "subject_id" AND "masterplan_version_id" IS NULL AND "content_piece_id" IS NULL)
  ))
);

CREATE TABLE "conditional_execution_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"intent_id" uuid NOT NULL,
	"attempt_key" text NOT NULL,
	"status" "conditional_execution_attempt_status" DEFAULT 'attempted' NOT NULL,
	"provider_receipt" jsonb,
	"readback" jsonb,
	"error_code" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"lease_owner" text,
	"lease_expires_at" timestamp with time zone,
	"apply_started_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "conditional_execution_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"intent_id" uuid NOT NULL,
	"event_type" text NOT NULL,
	"details" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "conditional_execution_intents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"campaign_id" uuid NOT NULL,
	"policy_id" uuid NOT NULL,
	"policy_action_id" uuid NOT NULL,
	"proposal_id" uuid NOT NULL,
	"intent_key" text NOT NULL,
	"status" "conditional_execution_intent_status" DEFAULT 'planned' NOT NULL,
	"block_code" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "conditional_execution_policies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"campaign_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"masterplan_version_id" uuid NOT NULL,
	"snapshot_hash" text NOT NULL,
	"context_fingerprint" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"owner_user_id" uuid NOT NULL,
	"idempotency_key" text NOT NULL,
	"revoked_at" timestamp with time zone,
	"revoked_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "conditional_execution_policy_version_check" CHECK ("conditional_execution_policies"."version" >= 1)
);

CREATE TABLE "conditional_execution_policy_actions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"policy_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"action_type" "conditional_execution_action" NOT NULL,
	"provider" text NOT NULL,
	"account_id" uuid NOT NULL,
	"entity_id" uuid NOT NULL,
	"max_actions_per_day" integer NOT NULL,
	CONSTRAINT "conditional_policy_actions_ceiling_check" CHECK ("conditional_execution_policy_actions"."max_actions_per_day" >= 1 AND "conditional_execution_policy_actions"."max_actions_per_day" <= 100)
);

CREATE TABLE "conditional_execution_policy_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"policy_id" uuid NOT NULL,
	"event_type" text NOT NULL,
	"actor_user_id" uuid NOT NULL,
	"details" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "realization_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contract_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"number" integer NOT NULL,
	"state" realization_attempt_state DEFAULT 'claimed' NOT NULL,
	"receipt" jsonb,
	"readback" jsonb,
	"error" jsonb,
	"claimed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"lease_owner" text,
	"lease_expires_at" timestamp with time zone,
	"qc" jsonb,
	"retry" jsonb,
	"recovery" jsonb,
	"compensation" jsonb,
	CONSTRAINT "realization_attempts_number_check" CHECK ("realization_attempts"."number" between 1 and 10)
);

CREATE TABLE "realization_contracts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"campaign_id" uuid NOT NULL,
	"masterplan_version_id" uuid NOT NULL,
	"action" realization_action NOT NULL,
	"state" realization_state DEFAULT 'proposal' NOT NULL,
	"idempotency_key" text NOT NULL,
	"binding_hash" text NOT NULL,
	"request_fingerprint" text NOT NULL,
	"context_fingerprint" text NOT NULL,
	"snapshot_hash" text NOT NULL,
	"subject_type" text NOT NULL,
	"subject_id" uuid NOT NULL,
	"binding" jsonb NOT NULL,
	"max_attempts" integer DEFAULT 3 NOT NULL,
	"attempts_used" integer DEFAULT 0 NOT NULL,
	"created_by_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "realization_contracts_max_attempts_check" CHECK ("realization_contracts"."max_attempts" between 1 and 10)
);

CREATE TABLE "realization_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contract_id" uuid NOT NULL,
	"attempt_id" uuid,
	"workspace_id" uuid NOT NULL,
	"type" realization_event_type NOT NULL,
	"details" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "council_actions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"decision_id" uuid NOT NULL,
	"family" "council_action_family" NOT NULL,
	"realization_contract_id" uuid,
	"idempotency_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "council_actions_supported_family_check" CHECK ("council_actions"."family" <> 'unsupported')
);

CREATE TABLE "council_cycles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"campaign_id" uuid NOT NULL,
	"masterplan_version_id" uuid NOT NULL,
	"context_fingerprint" text NOT NULL,
	"snapshot_hash" text NOT NULL,
	"owner_user_id" uuid NOT NULL,
	"status" "council_cycle_status" DEFAULT 'open' NOT NULL,
	"idempotency_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "council_decisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"cycle_id" uuid NOT NULL,
	"owner_user_id" uuid NOT NULL,
	"rationale_summary" text NOT NULL,
	"evidence_refs" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"target" jsonb NOT NULL,
	"baseline" jsonb NOT NULL,
	"threshold" jsonb NOT NULL,
	"window" jsonb NOT NULL,
	"due_at" timestamp with time zone,
	"action_required" boolean DEFAULT false NOT NULL,
	"status" "council_decision_status" DEFAULT 'proposed' NOT NULL,
	"supersedes_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "council_minutes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"cycle_id" uuid NOT NULL,
	"author_user_id" uuid NOT NULL,
	"summary" text NOT NULL,
	"evidence_refs" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "council_outcomes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"decision_id" uuid NOT NULL,
	"action_id" uuid,
	"next_cycle_id" uuid,
	"status" "council_outcome_status" NOT NULL,
	"verification_fingerprint" text NOT NULL,
	"verification" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "council_outcomes_next_cycle_required" CHECK ("council_outcomes"."next_cycle_id" IS NOT NULL)
);

CREATE TABLE "m11_social_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"created_by" uuid NOT NULL,
	"period_from" timestamp with time zone NOT NULL,
	"period_to" timestamp with time zone NOT NULL,
	"filters" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"aggregates" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"provenance" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"row_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "workspaces" ADD CONSTRAINT "workspaces_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "workspaces" ADD CONSTRAINT "workspaces_plan_id_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."plans"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "credit_transactions" ADD CONSTRAINT "credit_transactions_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_pipeline_id_launch_pipelines_id_fk" FOREIGN KEY ("pipeline_id") REFERENCES "public"."launch_pipelines"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_commercial_product_id_commercial_products_id_fk" FOREIGN KEY ("commercial_product_id") REFERENCES "public"."commercial_products"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_commercial_subscription_id_commercial_subscriptions_id_fk" FOREIGN KEY ("commercial_subscription_id") REFERENCES "public"."commercial_subscriptions"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "campaign_agents" ADD CONSTRAINT "campaign_agents_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "campaign_assets" ADD CONSTRAINT "campaign_assets_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "approval_checkpoints" ADD CONSTRAINT "approval_checkpoints_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "workspace_integrations" ADD CONSTRAINT "workspace_integrations_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "domain_dns_records" ADD CONSTRAINT "domain_dns_records_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "domain_dns_records" ADD CONSTRAINT "domain_dns_records_domain_id_domains_id_fk" FOREIGN KEY ("domain_id") REFERENCES "public"."domains"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "domain_operations" ADD CONSTRAINT "domain_operations_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "domain_operations" ADD CONSTRAINT "domain_operations_domain_id_domains_id_fk" FOREIGN KEY ("domain_id") REFERENCES "public"."domains"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "domains" ADD CONSTRAINT "domains_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "landing_deployments" ADD CONSTRAINT "landing_deployments_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "landing_deployments" ADD CONSTRAINT "landing_deployments_page_id_pages_id_fk" FOREIGN KEY ("page_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "landing_deployments" ADD CONSTRAINT "landing_deployments_revision_id_landing_revisions_id_fk" FOREIGN KEY ("revision_id") REFERENCES "public"."landing_revisions"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "landing_deployments" ADD CONSTRAINT "landing_deployments_domain_id_domains_id_fk" FOREIGN KEY ("domain_id") REFERENCES "public"."domains"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "landing_revisions" ADD CONSTRAINT "landing_revisions_page_id_pages_id_fk" FOREIGN KEY ("page_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "landing_revisions" ADD CONSTRAINT "landing_revisions_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "pages" ADD CONSTRAINT "pages_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "pages" ADD CONSTRAINT "pages_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "pages" ADD CONSTRAINT "pages_domain_id_domains_id_fk" FOREIGN KEY ("domain_id") REFERENCES "public"."domains"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "pages" ADD CONSTRAINT "pages_lead_capture_sequence_id_launch_sequences_id_fk" FOREIGN KEY ("lead_capture_sequence_id") REFERENCES "public"."launch_sequences"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "ai_provider_logs" ADD CONSTRAINT "ai_provider_logs_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "content_pieces" ADD CONSTRAINT "content_pieces_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "content_pieces" ADD CONSTRAINT "content_pieces_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "media_briefs" ADD CONSTRAINT "media_briefs_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "media_briefs" ADD CONSTRAINT "media_briefs_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "media_briefs" ADD CONSTRAINT "media_briefs_content_piece_id_content_pieces_id_fk" FOREIGN KEY ("content_piece_id") REFERENCES "public"."content_pieces"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "campaign_alerts" ADD CONSTRAINT "campaign_alerts_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "campaign_alerts" ADD CONSTRAINT "campaign_alerts_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "campaign_metrics" ADD CONSTRAINT "campaign_metrics_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "campaign_metrics" ADD CONSTRAINT "campaign_metrics_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "workspace_memory" ADD CONSTRAINT "workspace_memory_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "critique_logs" ADD CONSTRAINT "critique_logs_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "critique_logs" ADD CONSTRAINT "critique_logs_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "social_posts" ADD CONSTRAINT "social_posts_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "social_posts" ADD CONSTRAINT "social_posts_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "social_posts" ADD CONSTRAINT "social_posts_masterplan_version_id_masterplan_versions_id_fk" FOREIGN KEY ("masterplan_version_id") REFERENCES "public"."masterplan_versions"("id") ON DELETE restrict ON UPDATE no action;
ALTER TABLE "social_posts" ADD CONSTRAINT "social_posts_content_piece_id_content_pieces_id_fk" FOREIGN KEY ("content_piece_id") REFERENCES "public"."content_pieces"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "social_posts" ADD CONSTRAINT "social_posts_integration_id_workspace_integrations_id_fk" FOREIGN KEY ("integration_id") REFERENCES "public"."workspace_integrations"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "social_publish_attempts" ADD CONSTRAINT "social_publish_attempts_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "social_publish_attempts" ADD CONSTRAINT "social_publish_attempts_post_id_social_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."social_posts"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "subscription_payments" ADD CONSTRAINT "subscription_payments_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "subscription_payments" ADD CONSTRAINT "subscription_payments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "subscription_payments" ADD CONSTRAINT "subscription_payments_plan_id_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."plans"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "revenue_events" ADD CONSTRAINT "revenue_events_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "revenue_events" ADD CONSTRAINT "revenue_events_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "webhook_configs" ADD CONSTRAINT "webhook_configs_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "agency_clients" ADD CONSTRAINT "agency_clients_agency_workspace_id_workspaces_id_fk" FOREIGN KEY ("agency_workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "agency_clients" ADD CONSTRAINT "agency_clients_client_workspace_id_workspaces_id_fk" FOREIGN KEY ("client_workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "whitelabel_configs" ADD CONSTRAINT "whitelabel_configs_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "compliance_checks" ADD CONSTRAINT "compliance_checks_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "compliance_checks" ADD CONSTRAINT "compliance_checks_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "compliance_checks" ADD CONSTRAINT "compliance_checks_content_id_content_pieces_id_fk" FOREIGN KEY ("content_id") REFERENCES "public"."content_pieces"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "compliance_checks" ADD CONSTRAINT "compliance_checks_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "launch_sequence_items" ADD CONSTRAINT "launch_sequence_items_sequence_id_launch_sequences_id_fk" FOREIGN KEY ("sequence_id") REFERENCES "public"."launch_sequences"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "launch_sequence_items" ADD CONSTRAINT "launch_sequence_items_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "launch_sequences" ADD CONSTRAINT "launch_sequences_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "launch_sequences" ADD CONSTRAINT "launch_sequences_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "vsls" ADD CONSTRAINT "vsls_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "vsls" ADD CONSTRAINT "vsls_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "email_dispatches" ADD CONSTRAINT "email_dispatches_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "email_dispatches" ADD CONSTRAINT "email_dispatches_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "whatsapp_dispatches" ADD CONSTRAINT "whatsapp_dispatches_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "whatsapp_dispatches" ADD CONSTRAINT "whatsapp_dispatches_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "sequence_contacts" ADD CONSTRAINT "sequence_contacts_sequence_id_launch_sequences_id_fk" FOREIGN KEY ("sequence_id") REFERENCES "public"."launch_sequences"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "sequence_contacts" ADD CONSTRAINT "sequence_contacts_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "sequence_engagement" ADD CONSTRAINT "sequence_engagement_sequence_id_launch_sequences_id_fk" FOREIGN KEY ("sequence_id") REFERENCES "public"."launch_sequences"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "sequence_engagement" ADD CONSTRAINT "sequence_engagement_item_id_launch_sequence_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."launch_sequence_items"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "sequence_engagement" ADD CONSTRAINT "sequence_engagement_contact_id_sequence_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."sequence_contacts"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "sequence_engagement" ADD CONSTRAINT "sequence_engagement_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "first_touch_attempts" ADD CONSTRAINT "first_touch_attempts_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "launch_recordings" ADD CONSTRAINT "launch_recordings_folder_id_recording_folders_id_fk" FOREIGN KEY ("folder_id") REFERENCES "public"."recording_folders"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "recording_folders" ADD CONSTRAINT "recording_folders_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "client_profiles" ADD CONSTRAINT "client_profiles_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "social_comment_actions" ADD CONSTRAINT "social_comment_actions_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "social_comment_actions" ADD CONSTRAINT "social_comment_actions_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "meta_webhook_events" ADD CONSTRAINT "meta_webhook_events_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "meta_webhook_events" ADD CONSTRAINT "meta_webhook_events_integration_id_workspace_integrations_id_fk" FOREIGN KEY ("integration_id") REFERENCES "public"."workspace_integrations"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "campaign_creatives" ADD CONSTRAINT "campaign_creatives_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "campaign_creatives" ADD CONSTRAINT "campaign_creatives_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "products" ADD CONSTRAINT "products_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "product_sales" ADD CONSTRAINT "product_sales_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "product_sales" ADD CONSTRAINT "product_sales_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "academy_funnel_emails" ADD CONSTRAINT "academy_funnel_emails_lead_id_academy_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."academy_leads"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "invite_codes" ADD CONSTRAINT "invite_codes_used_by_user_id_users_id_fk" FOREIGN KEY ("used_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "invite_codes" ADD CONSTRAINT "invite_codes_used_by_workspace_id_workspaces_id_fk" FOREIGN KEY ("used_by_workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "agent_execution_logs" ADD CONSTRAINT "agent_execution_logs_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "agent_execution_logs" ADD CONSTRAINT "agent_execution_logs_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "agent_execution_logs" ADD CONSTRAINT "agent_execution_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "vertical_memory" ADD CONSTRAINT "vertical_memory_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "launch_pipelines" ADD CONSTRAINT "launch_pipelines_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "sales_conversations" ADD CONSTRAINT "sales_conversations_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "sales_conversations" ADD CONSTRAINT "sales_conversations_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "sales_messages" ADD CONSTRAINT "sales_messages_conversation_id_sales_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."sales_conversations"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "integration_chat_conversations" ADD CONSTRAINT "integration_chat_conversations_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "integration_chat_messages" ADD CONSTRAINT "integration_chat_messages_conversation_id_integration_chat_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."integration_chat_conversations"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "campaign_groups" ADD CONSTRAINT "campaign_groups_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "campaign_groups" ADD CONSTRAINT "campaign_groups_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "video_projects" ADD CONSTRAINT "video_projects_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "video_projects" ADD CONSTRAINT "video_projects_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "correction_loops" ADD CONSTRAINT "correction_loops_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "correction_loops" ADD CONSTRAINT "correction_loops_revision_id_production_revisions_id_fk" FOREIGN KEY ("revision_id") REFERENCES "public"."production_revisions"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "correction_loops" ADD CONSTRAINT "correction_loops_qc_issue_id_qc_issues_id_fk" FOREIGN KEY ("qc_issue_id") REFERENCES "public"."qc_issues"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "correction_loops" ADD CONSTRAINT "correction_loops_project_workspace_fkey" FOREIGN KEY ("workspace_id","video_project_id") REFERENCES "public"."video_projects"("workspace_id","id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "production_assets" ADD CONSTRAINT "production_assets_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "production_assets" ADD CONSTRAINT "production_assets_manifest_id_production_manifests_id_fk" FOREIGN KEY ("manifest_id") REFERENCES "public"."production_manifests"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "production_assets" ADD CONSTRAINT "production_assets_project_workspace_fkey" FOREIGN KEY ("workspace_id","video_project_id") REFERENCES "public"."video_projects"("workspace_id","id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "production_manifests" ADD CONSTRAINT "production_manifests_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "production_manifests" ADD CONSTRAINT "production_manifests_project_workspace_fkey" FOREIGN KEY ("workspace_id","video_project_id") REFERENCES "public"."video_projects"("workspace_id","id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "production_revisions" ADD CONSTRAINT "production_revisions_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "production_revisions" ADD CONSTRAINT "production_revisions_manifest_id_production_manifests_id_fk" FOREIGN KEY ("manifest_id") REFERENCES "public"."production_manifests"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "production_revisions" ADD CONSTRAINT "production_revisions_project_workspace_fkey" FOREIGN KEY ("workspace_id","video_project_id") REFERENCES "public"."video_projects"("workspace_id","id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "production_revisions" ADD CONSTRAINT "production_revisions_parent_fkey" FOREIGN KEY ("parent_revision_id") REFERENCES "public"."production_revisions"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "qc_issues" ADD CONSTRAINT "qc_issues_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "qc_issues" ADD CONSTRAINT "qc_issues_qc_report_id_qc_reports_id_fk" FOREIGN KEY ("qc_report_id") REFERENCES "public"."qc_reports"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "qc_issues" ADD CONSTRAINT "qc_issues_project_workspace_fkey" FOREIGN KEY ("workspace_id","video_project_id") REFERENCES "public"."video_projects"("workspace_id","id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "qc_reports" ADD CONSTRAINT "qc_reports_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "qc_reports" ADD CONSTRAINT "qc_reports_render_job_id_render_jobs_id_fk" FOREIGN KEY ("render_job_id") REFERENCES "public"."render_jobs"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "qc_reports" ADD CONSTRAINT "qc_reports_project_workspace_fkey" FOREIGN KEY ("workspace_id","video_project_id") REFERENCES "public"."video_projects"("workspace_id","id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "render_jobs" ADD CONSTRAINT "render_jobs_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "render_jobs" ADD CONSTRAINT "render_jobs_manifest_id_production_manifests_id_fk" FOREIGN KEY ("manifest_id") REFERENCES "public"."production_manifests"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "render_jobs" ADD CONSTRAINT "render_jobs_project_workspace_fkey" FOREIGN KEY ("workspace_id","video_project_id") REFERENCES "public"."video_projects"("workspace_id","id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "timeline_items" ADD CONSTRAINT "timeline_items_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "timeline_items" ADD CONSTRAINT "timeline_items_track_id_timeline_tracks_id_fk" FOREIGN KEY ("track_id") REFERENCES "public"."timeline_tracks"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "timeline_items" ADD CONSTRAINT "timeline_items_asset_id_production_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."production_assets"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "timeline_items" ADD CONSTRAINT "timeline_items_project_workspace_fkey" FOREIGN KEY ("workspace_id","video_project_id") REFERENCES "public"."video_projects"("workspace_id","id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "timeline_tracks" ADD CONSTRAINT "timeline_tracks_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "timeline_tracks" ADD CONSTRAINT "timeline_tracks_manifest_id_production_manifests_id_fk" FOREIGN KEY ("manifest_id") REFERENCES "public"."production_manifests"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "timeline_tracks" ADD CONSTRAINT "timeline_tracks_project_workspace_fkey" FOREIGN KEY ("workspace_id","video_project_id") REFERENCES "public"."video_projects"("workspace_id","id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "video_media_purges" ADD CONSTRAINT "video_media_purges_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "video_media_purges" ADD CONSTRAINT "video_media_purges_render_job_id_render_jobs_id_fk" FOREIGN KEY ("render_job_id") REFERENCES "public"."render_jobs"("id") ON DELETE restrict ON UPDATE no action;
ALTER TABLE "video_media_purges" ADD CONSTRAINT "video_media_purges_project_workspace_fkey" FOREIGN KEY ("workspace_id","video_project_id") REFERENCES "public"."video_projects"("workspace_id","id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "agent_clarification_requests" ADD CONSTRAINT "agent_clarification_requests_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "agent_clarification_requests" ADD CONSTRAINT "agent_clarification_requests_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "market_intel_reports" ADD CONSTRAINT "market_intel_reports_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "market_intel_reports" ADD CONSTRAINT "market_intel_reports_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "instagram_dm_sequences" ADD CONSTRAINT "instagram_dm_sequences_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "instagram_dm_sequences" ADD CONSTRAINT "instagram_dm_sequences_post_id_social_presence_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."social_presence_posts"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "social_presence_config" ADD CONSTRAINT "social_presence_config_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "social_presence_config" ADD CONSTRAINT "social_presence_config_aligned_campaign_id_campaigns_id_fk" FOREIGN KEY ("aligned_campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "social_presence_posts" ADD CONSTRAINT "social_presence_posts_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "social_presence_posts" ADD CONSTRAINT "social_presence_posts_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "social_conversation_turns" ADD CONSTRAINT "social_conversation_turns_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "social_conversation_turns" ADD CONSTRAINT "social_conversation_turns_integration_id_workspace_integrations_id_fk" FOREIGN KEY ("integration_id") REFERENCES "public"."workspace_integrations"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "social_conversation_turns" ADD CONSTRAINT "social_conversation_turns_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "contract_acceptances" ADD CONSTRAINT "contract_acceptances_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "contract_acceptances" ADD CONSTRAINT "contract_acceptances_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;
ALTER TABLE "contract_acceptances" ADD CONSTRAINT "contract_acceptances_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "contract_acceptances" ADD CONSTRAINT "contract_acceptances_revoked_by_user_id_users_id_fk" FOREIGN KEY ("revoked_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "mandatory_pauses" ADD CONSTRAINT "mandatory_pauses_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "mandatory_pauses" ADD CONSTRAINT "mandatory_pauses_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "mandatory_pauses" ADD CONSTRAINT "mandatory_pauses_resolved_by_user_id_users_id_fk" FOREIGN KEY ("resolved_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "paid_media_accounts" ADD CONSTRAINT "paid_media_accounts_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "paid_media_accounts" ADD CONSTRAINT "paid_media_accounts_integration_id_workspace_integrations_id_fk" FOREIGN KEY ("integration_id") REFERENCES "public"."workspace_integrations"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "paid_media_action_attempts" ADD CONSTRAINT "paid_media_action_attempts_proposal_id_paid_media_proposals_id_fk" FOREIGN KEY ("proposal_id") REFERENCES "public"."paid_media_proposals"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "paid_media_action_attempts" ADD CONSTRAINT "paid_media_action_attempts_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "paid_media_approvals" ADD CONSTRAINT "paid_media_approvals_proposal_id_paid_media_proposals_id_fk" FOREIGN KEY ("proposal_id") REFERENCES "public"."paid_media_proposals"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "paid_media_approvals" ADD CONSTRAINT "paid_media_approvals_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "paid_media_approvals" ADD CONSTRAINT "paid_media_approvals_approver_id_users_id_fk" FOREIGN KEY ("approver_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "paid_media_attribution_touchpoints" ADD CONSTRAINT "paid_media_attribution_touchpoints_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "paid_media_attribution_touchpoints" ADD CONSTRAINT "paid_media_attribution_touchpoints_account_id_paid_media_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."paid_media_accounts"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "paid_media_attribution_touchpoints" ADD CONSTRAINT "paid_media_attribution_touchpoints_entity_id_paid_media_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."paid_media_entities"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "paid_media_budget_strategies" ADD CONSTRAINT "paid_media_budget_strategies_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "paid_media_budget_strategies" ADD CONSTRAINT "paid_media_budget_strategies_account_id_paid_media_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."paid_media_accounts"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "paid_media_budget_strategies" ADD CONSTRAINT "paid_media_budget_strategies_campaign_entity_id_paid_media_entities_id_fk" FOREIGN KEY ("campaign_entity_id") REFERENCES "public"."paid_media_entities"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "paid_media_conversions" ADD CONSTRAINT "paid_media_conversions_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "paid_media_conversions" ADD CONSTRAINT "paid_media_conversions_touchpoint_id_paid_media_attribution_touchpoints_id_fk" FOREIGN KEY ("touchpoint_id") REFERENCES "public"."paid_media_attribution_touchpoints"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "paid_media_datasets" ADD CONSTRAINT "paid_media_datasets_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "paid_media_datasets" ADD CONSTRAINT "paid_media_datasets_account_id_paid_media_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."paid_media_accounts"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "paid_media_entities" ADD CONSTRAINT "paid_media_entities_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "paid_media_entities" ADD CONSTRAINT "paid_media_entities_account_id_paid_media_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."paid_media_accounts"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "paid_media_event_receipts" ADD CONSTRAINT "paid_media_event_receipts_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "paid_media_event_receipts" ADD CONSTRAINT "paid_media_event_receipts_dataset_id_paid_media_datasets_id_fk" FOREIGN KEY ("dataset_id") REFERENCES "public"."paid_media_datasets"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "paid_media_insights" ADD CONSTRAINT "paid_media_insights_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "paid_media_insights" ADD CONSTRAINT "paid_media_insights_account_id_paid_media_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."paid_media_accounts"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "paid_media_insights" ADD CONSTRAINT "paid_media_insights_entity_id_paid_media_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."paid_media_entities"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "paid_media_launch_attempts" ADD CONSTRAINT "paid_media_launch_attempts_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "paid_media_launch_attempts" ADD CONSTRAINT "paid_media_launch_attempts_launch_plan_id_paid_media_launch_plans_id_fk" FOREIGN KEY ("launch_plan_id") REFERENCES "public"."paid_media_launch_plans"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "paid_media_launch_plans" ADD CONSTRAINT "paid_media_launch_plans_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "paid_media_launch_plans" ADD CONSTRAINT "paid_media_launch_plans_commercial_product_id_commercial_products_id_fk" FOREIGN KEY ("commercial_product_id") REFERENCES "public"."commercial_products"("id") ON DELETE restrict ON UPDATE no action;
ALTER TABLE "paid_media_launch_plans" ADD CONSTRAINT "paid_media_launch_plans_commercial_subscription_id_commercial_subscriptions_id_fk" FOREIGN KEY ("commercial_subscription_id") REFERENCES "public"."commercial_subscriptions"("id") ON DELETE restrict ON UPDATE no action;
ALTER TABLE "paid_media_launch_plans" ADD CONSTRAINT "paid_media_launch_plans_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE restrict ON UPDATE no action;
ALTER TABLE "paid_media_launch_plans" ADD CONSTRAINT "paid_media_launch_plans_masterplan_version_id_masterplan_versions_id_fk" FOREIGN KEY ("masterplan_version_id") REFERENCES "public"."masterplan_versions"("id") ON DELETE restrict ON UPDATE no action;
ALTER TABLE "paid_media_launch_plans" ADD CONSTRAINT "paid_media_launch_plans_account_id_paid_media_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."paid_media_accounts"("id") ON DELETE restrict ON UPDATE no action;
ALTER TABLE "paid_media_launch_plans" ADD CONSTRAINT "paid_media_launch_plans_approved_by_user_id_users_id_fk" FOREIGN KEY ("approved_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "paid_media_launch_plans" ADD CONSTRAINT "paid_media_launch_plans_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "paid_media_launch_steps" ADD CONSTRAINT "paid_media_launch_steps_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "paid_media_launch_steps" ADD CONSTRAINT "paid_media_launch_steps_attempt_id_paid_media_launch_attempts_id_fk" FOREIGN KEY ("attempt_id") REFERENCES "public"."paid_media_launch_attempts"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "paid_media_policies" ADD CONSTRAINT "paid_media_policies_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "paid_media_policies" ADD CONSTRAINT "paid_media_policies_account_id_paid_media_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."paid_media_accounts"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "paid_media_policies" ADD CONSTRAINT "paid_media_policies_accepted_by_users_id_fk" FOREIGN KEY ("accepted_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "paid_media_proposals" ADD CONSTRAINT "paid_media_proposals_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "paid_media_proposals" ADD CONSTRAINT "paid_media_proposals_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "paid_media_proposals" ADD CONSTRAINT "paid_media_proposals_masterplan_version_id_masterplan_versions_id_fk" FOREIGN KEY ("masterplan_version_id") REFERENCES "public"."masterplan_versions"("id") ON DELETE restrict ON UPDATE no action;
ALTER TABLE "paid_media_proposals" ADD CONSTRAINT "paid_media_proposals_account_id_paid_media_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."paid_media_accounts"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "paid_media_proposals" ADD CONSTRAINT "paid_media_proposals_entity_id_paid_media_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."paid_media_entities"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "paid_media_sync_cursors" ADD CONSTRAINT "paid_media_sync_cursors_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "paid_media_sync_cursors" ADD CONSTRAINT "paid_media_sync_cursors_account_id_paid_media_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."paid_media_accounts"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "orchestration_dead_letters" ADD CONSTRAINT "orchestration_dead_letters_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "orchestration_dead_letters" ADD CONSTRAINT "orchestration_dead_letters_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "native_media_consents" ADD CONSTRAINT "native_media_consents_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "native_media_job_events" ADD CONSTRAINT "native_media_job_events_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "native_media_job_events" ADD CONSTRAINT "native_media_job_events_job_id_native_media_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."native_media_jobs"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "native_media_job_events" ADD CONSTRAINT "native_media_job_events_worker_id_native_media_workers_id_fk" FOREIGN KEY ("worker_id") REFERENCES "public"."native_media_workers"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "native_media_job_events" ADD CONSTRAINT "native_media_job_events_project_workspace_fkey" FOREIGN KEY ("workspace_id","video_project_id") REFERENCES "public"."video_projects"("workspace_id","id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "native_media_jobs" ADD CONSTRAINT "native_media_jobs_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "native_media_jobs" ADD CONSTRAINT "native_media_jobs_project_workspace_fkey" FOREIGN KEY ("workspace_id","video_project_id") REFERENCES "public"."video_projects"("workspace_id","id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "native_media_provenance" ADD CONSTRAINT "native_media_provenance_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "native_media_provenance" ADD CONSTRAINT "native_media_provenance_job_id_native_media_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."native_media_jobs"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "native_media_provenance" ADD CONSTRAINT "native_media_provenance_worker_id_native_media_workers_id_fk" FOREIGN KEY ("worker_id") REFERENCES "public"."native_media_workers"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "native_media_provenance" ADD CONSTRAINT "native_media_provenance_project_workspace_fkey" FOREIGN KEY ("workspace_id","video_project_id") REFERENCES "public"."video_projects"("workspace_id","id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "native_media_usage" ADD CONSTRAINT "native_media_usage_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "native_media_usage" ADD CONSTRAINT "native_media_usage_job_id_native_media_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."native_media_jobs"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "native_media_usage" ADD CONSTRAINT "native_media_usage_worker_id_native_media_workers_id_fk" FOREIGN KEY ("worker_id") REFERENCES "public"."native_media_workers"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "native_media_usage" ADD CONSTRAINT "native_media_usage_project_workspace_fkey" FOREIGN KEY ("workspace_id","video_project_id") REFERENCES "public"."video_projects"("workspace_id","id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "native_media_worker_nonces" ADD CONSTRAINT "native_media_worker_nonces_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "native_media_worker_nonces" ADD CONSTRAINT "native_media_worker_nonces_worker_id_native_media_workers_id_fk" FOREIGN KEY ("worker_id") REFERENCES "public"."native_media_workers"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "native_media_workers" ADD CONSTRAINT "native_media_workers_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "masterplan_versions" ADD CONSTRAINT "masterplan_versions_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "masterplan_versions" ADD CONSTRAINT "masterplan_versions_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "masterplan_versions" ADD CONSTRAINT "masterplan_versions_commercial_product_id_commercial_products_id_fk" FOREIGN KEY ("commercial_product_id") REFERENCES "public"."commercial_products"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "masterplan_versions" ADD CONSTRAINT "masterplan_versions_commercial_subscription_id_commercial_subscriptions_id_fk" FOREIGN KEY ("commercial_subscription_id") REFERENCES "public"."commercial_subscriptions"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "masterplan_versions" ADD CONSTRAINT "masterplan_versions_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "masterplan_versions" ADD CONSTRAINT "masterplan_versions_approved_by_user_id_users_id_fk" FOREIGN KEY ("approved_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "execution_evidence" ADD CONSTRAINT "execution_evidence_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "execution_evidence" ADD CONSTRAINT "execution_evidence_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "execution_evidence" ADD CONSTRAINT "execution_evidence_masterplan_version_id_masterplan_versions_id_fk" FOREIGN KEY ("masterplan_version_id") REFERENCES "public"."masterplan_versions"("id") ON DELETE restrict ON UPDATE no action;
ALTER TABLE "regional_alerts" ADD CONSTRAINT "regional_alerts_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "regional_alerts" ADD CONSTRAINT "regional_alerts_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "regional_alerts" ADD CONSTRAINT "regional_alerts_change_event_id_regional_change_events_id_fk" FOREIGN KEY ("change_event_id") REFERENCES "public"."regional_change_events"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "regional_audience_opportunities" ADD CONSTRAINT "regional_audience_opportunities_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "regional_audience_opportunities" ADD CONSTRAINT "regional_audience_opportunities_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "regional_audience_opportunities" ADD CONSTRAINT "regional_audience_opportunities_signal_id_regional_social_signals_id_fk" FOREIGN KEY ("signal_id") REFERENCES "public"."regional_social_signals"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "regional_audience_opportunities" ADD CONSTRAINT "regional_audience_opportunities_competitor_id_regional_competitors_id_fk" FOREIGN KEY ("competitor_id") REFERENCES "public"."regional_competitors"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "regional_audience_segments" ADD CONSTRAINT "regional_audience_segments_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "regional_audience_segments" ADD CONSTRAINT "regional_audience_segments_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "regional_change_events" ADD CONSTRAINT "regional_change_events_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "regional_change_events" ADD CONSTRAINT "regional_change_events_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "regional_change_events" ADD CONSTRAINT "regional_change_events_competitor_id_regional_competitors_id_fk" FOREIGN KEY ("competitor_id") REFERENCES "public"."regional_competitors"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "regional_change_events" ADD CONSTRAINT "regional_change_events_observation_id_regional_observations_id_fk" FOREIGN KEY ("observation_id") REFERENCES "public"."regional_observations"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "regional_change_events" ADD CONSTRAINT "regional_change_events_previous_observation_id_regional_observations_id_fk" FOREIGN KEY ("previous_observation_id") REFERENCES "public"."regional_observations"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "regional_competitors" ADD CONSTRAINT "regional_competitors_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "regional_competitors" ADD CONSTRAINT "regional_competitors_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "regional_evidence" ADD CONSTRAINT "regional_evidence_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "regional_evidence" ADD CONSTRAINT "regional_evidence_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "regional_evidence" ADD CONSTRAINT "regional_evidence_source_id_regional_public_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."regional_public_sources"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "regional_monitor_runs" ADD CONSTRAINT "regional_monitor_runs_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "regional_monitor_runs" ADD CONSTRAINT "regional_monitor_runs_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "regional_observations" ADD CONSTRAINT "regional_observations_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "regional_observations" ADD CONSTRAINT "regional_observations_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "regional_observations" ADD CONSTRAINT "regional_observations_competitor_id_regional_competitors_id_fk" FOREIGN KEY ("competitor_id") REFERENCES "public"."regional_competitors"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "regional_observations" ADD CONSTRAINT "regional_observations_evidence_id_regional_evidence_id_fk" FOREIGN KEY ("evidence_id") REFERENCES "public"."regional_evidence"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "regional_profiles" ADD CONSTRAINT "regional_profiles_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "regional_profiles" ADD CONSTRAINT "regional_profiles_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "regional_public_sources" ADD CONSTRAINT "regional_public_sources_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "regional_public_sources" ADD CONSTRAINT "regional_public_sources_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "regional_public_sources" ADD CONSTRAINT "regional_public_sources_competitor_id_regional_competitors_id_fk" FOREIGN KEY ("competitor_id") REFERENCES "public"."regional_competitors"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "regional_social_signals" ADD CONSTRAINT "regional_social_signals_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "regional_social_signals" ADD CONSTRAINT "regional_social_signals_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "interaction_approvals" ADD CONSTRAINT "interaction_approvals_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "interaction_approvals" ADD CONSTRAINT "interaction_approvals_draft_id_interaction_drafts_id_fk" FOREIGN KEY ("draft_id") REFERENCES "public"."interaction_drafts"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "interaction_decisions" ADD CONSTRAINT "interaction_decisions_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "interaction_decisions" ADD CONSTRAINT "interaction_decisions_opportunity_id_interaction_opportunities_id_fk" FOREIGN KEY ("opportunity_id") REFERENCES "public"."interaction_opportunities"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "interaction_drafts" ADD CONSTRAINT "interaction_drafts_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "interaction_drafts" ADD CONSTRAINT "interaction_drafts_opportunity_id_interaction_opportunities_id_fk" FOREIGN KEY ("opportunity_id") REFERENCES "public"."interaction_opportunities"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "interaction_executions" ADD CONSTRAINT "interaction_executions_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "interaction_executions" ADD CONSTRAINT "interaction_executions_opportunity_id_interaction_opportunities_id_fk" FOREIGN KEY ("opportunity_id") REFERENCES "public"."interaction_opportunities"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "interaction_executions" ADD CONSTRAINT "interaction_executions_draft_id_interaction_drafts_id_fk" FOREIGN KEY ("draft_id") REFERENCES "public"."interaction_drafts"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "interaction_governance_policies" ADD CONSTRAINT "interaction_governance_policies_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "interaction_opportunities" ADD CONSTRAINT "interaction_opportunities_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "interaction_opportunities" ADD CONSTRAINT "interaction_opportunities_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "interaction_opportunities" ADD CONSTRAINT "interaction_opportunities_source_audience_opportunity_id_regional_audience_opportunities_id_fk" FOREIGN KEY ("source_audience_opportunity_id") REFERENCES "public"."regional_audience_opportunities"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "interaction_opportunities" ADD CONSTRAINT "interaction_opportunities_recipient_id_interaction_recipients_id_fk" FOREIGN KEY ("recipient_id") REFERENCES "public"."interaction_recipients"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "interaction_opportunities" ADD CONSTRAINT "interaction_opportunities_integration_id_workspace_integrations_id_fk" FOREIGN KEY ("integration_id") REFERENCES "public"."workspace_integrations"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "interaction_platform_capabilities" ADD CONSTRAINT "interaction_platform_capabilities_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "interaction_platform_capabilities" ADD CONSTRAINT "interaction_platform_capabilities_integration_id_workspace_integrations_id_fk" FOREIGN KEY ("integration_id") REFERENCES "public"."workspace_integrations"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "interaction_recipients" ADD CONSTRAINT "interaction_recipients_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "radar_orders" ADD CONSTRAINT "radar_orders_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "radar_purchase_requests" ADD CONSTRAINT "radar_purchase_requests_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "radar_subscriptions" ADD CONSTRAINT "radar_subscriptions_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "radar_usage_ledger" ADD CONSTRAINT "radar_usage_ledger_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "radar_usage_ledger" ADD CONSTRAINT "radar_usage_ledger_subscription_id_radar_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."radar_subscriptions"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "commercial_subscriptions" ADD CONSTRAINT "commercial_subscriptions_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "commercial_subscriptions" ADD CONSTRAINT "commercial_subscriptions_product_id_commercial_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."commercial_products"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "entitlement_grants" ADD CONSTRAINT "entitlement_grants_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "entitlement_grants" ADD CONSTRAINT "entitlement_grants_subscription_id_commercial_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."commercial_subscriptions"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "entitlement_grants" ADD CONSTRAINT "entitlement_grants_granted_by_user_id_users_id_fk" FOREIGN KEY ("granted_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "community_action_attempts" ADD CONSTRAINT "community_action_attempts_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "community_action_attempts" ADD CONSTRAINT "community_action_attempts_message_id_community_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."community_messages"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "community_action_attempts" ADD CONSTRAINT "community_action_attempts_integration_id_workspace_integrations_id_fk" FOREIGN KEY ("integration_id") REFERENCES "public"."workspace_integrations"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "community_conversations" ADD CONSTRAINT "community_conversations_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "community_conversations" ADD CONSTRAINT "community_conversations_integration_id_workspace_integrations_id_fk" FOREIGN KEY ("integration_id") REFERENCES "public"."workspace_integrations"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "community_messages" ADD CONSTRAINT "community_messages_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "community_messages" ADD CONSTRAINT "community_messages_conversation_id_community_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."community_conversations"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "community_messages" ADD CONSTRAINT "community_messages_sender_participant_id_community_participants_id_fk" FOREIGN KEY ("sender_participant_id") REFERENCES "public"."community_participants"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "community_moderation_decisions" ADD CONSTRAINT "community_moderation_decisions_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "community_moderation_decisions" ADD CONSTRAINT "community_moderation_decisions_message_id_community_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."community_messages"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "community_moderation_decisions" ADD CONSTRAINT "community_moderation_decisions_rule_id_community_moderation_rules_id_fk" FOREIGN KEY ("rule_id") REFERENCES "public"."community_moderation_rules"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "community_moderation_rules" ADD CONSTRAINT "community_moderation_rules_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "community_participants" ADD CONSTRAINT "community_participants_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "community_participants" ADD CONSTRAINT "community_participants_conversation_id_community_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."community_conversations"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "community_provider_events" ADD CONSTRAINT "community_provider_events_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "community_response_policies" ADD CONSTRAINT "community_response_policies_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "community_response_policies" ADD CONSTRAINT "community_response_policies_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "buyer_onboarding_instances" ADD CONSTRAINT "buyer_onboarding_instances_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "buyer_onboarding_instances" ADD CONSTRAINT "buyer_onboarding_instances_sale_id_product_sales_id_fk" FOREIGN KEY ("sale_id") REFERENCES "public"."product_sales"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "buyer_onboarding_instances" ADD CONSTRAINT "buyer_onboarding_instances_contact_id_lifecycle_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."lifecycle_contacts"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "buyer_onboarding_instances" ADD CONSTRAINT "buyer_onboarding_instances_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "cart_recovery_actions" ADD CONSTRAINT "cart_recovery_actions_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "cart_recovery_actions" ADD CONSTRAINT "cart_recovery_actions_sale_id_product_sales_id_fk" FOREIGN KEY ("sale_id") REFERENCES "public"."product_sales"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "cart_recovery_actions" ADD CONSTRAINT "cart_recovery_actions_contact_id_lifecycle_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."lifecycle_contacts"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "lifecycle_contacts" ADD CONSTRAINT "lifecycle_contacts_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "lifecycle_events" ADD CONSTRAINT "lifecycle_events_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "lifecycle_events" ADD CONSTRAINT "lifecycle_events_contact_id_lifecycle_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."lifecycle_contacts"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "purchaser_referral_attributions" ADD CONSTRAINT "purchaser_referral_attributions_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "purchaser_referral_attributions" ADD CONSTRAINT "purchaser_referral_attributions_referral_id_purchaser_referrals_id_fk" FOREIGN KEY ("referral_id") REFERENCES "public"."purchaser_referrals"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "purchaser_referral_attributions" ADD CONSTRAINT "purchaser_referral_attributions_referred_contact_id_lifecycle_contacts_id_fk" FOREIGN KEY ("referred_contact_id") REFERENCES "public"."lifecycle_contacts"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "purchaser_referral_attributions" ADD CONSTRAINT "purchaser_referral_attributions_sale_id_product_sales_id_fk" FOREIGN KEY ("sale_id") REFERENCES "public"."product_sales"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "purchaser_referrals" ADD CONSTRAINT "purchaser_referrals_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "purchaser_referrals" ADD CONSTRAINT "purchaser_referrals_referrer_contact_id_lifecycle_contacts_id_fk" FOREIGN KEY ("referrer_contact_id") REFERENCES "public"."lifecycle_contacts"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "referral_rewards" ADD CONSTRAINT "referral_rewards_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "referral_rewards" ADD CONSTRAINT "referral_rewards_attribution_id_purchaser_referral_attributions_id_fk" FOREIGN KEY ("attribution_id") REFERENCES "public"."purchaser_referral_attributions"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "retention_actions" ADD CONSTRAINT "retention_actions_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "retention_actions" ADD CONSTRAINT "retention_actions_contact_id_lifecycle_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."lifecycle_contacts"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "upsell_actions" ADD CONSTRAINT "upsell_actions_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "upsell_actions" ADD CONSTRAINT "upsell_actions_offer_id_upsell_offers_id_fk" FOREIGN KEY ("offer_id") REFERENCES "public"."upsell_offers"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "upsell_actions" ADD CONSTRAINT "upsell_actions_contact_id_lifecycle_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."lifecycle_contacts"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "upsell_actions" ADD CONSTRAINT "upsell_actions_source_sale_id_product_sales_id_fk" FOREIGN KEY ("source_sale_id") REFERENCES "public"."product_sales"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "upsell_actions" ADD CONSTRAINT "upsell_actions_converted_sale_id_product_sales_id_fk" FOREIGN KEY ("converted_sale_id") REFERENCES "public"."product_sales"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "upsell_offers" ADD CONSTRAINT "upsell_offers_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "upsell_offers" ADD CONSTRAINT "upsell_offers_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "upsell_offers" ADD CONSTRAINT "upsell_offers_target_product_id_products_id_fk" FOREIGN KEY ("target_product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "product_intakes" ADD CONSTRAINT "product_intakes_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "product_intakes" ADD CONSTRAINT "product_intakes_commercial_product_id_commercial_products_id_fk" FOREIGN KEY ("commercial_product_id") REFERENCES "public"."commercial_products"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "product_intakes" ADD CONSTRAINT "product_intakes_source_campaign_id_campaigns_id_fk" FOREIGN KEY ("source_campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "product_intakes" ADD CONSTRAINT "product_intakes_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "product_intakes" ADD CONSTRAINT "product_intakes_approved_by_user_id_users_id_fk" FOREIGN KEY ("approved_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "approval_decisions" ADD CONSTRAINT "approval_decisions_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "approval_decisions" ADD CONSTRAINT "approval_decisions_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "approval_decisions" ADD CONSTRAINT "approval_decisions_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;
ALTER TABLE "approval_sla_events" ADD CONSTRAINT "approval_sla_events_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "approval_sla_events" ADD CONSTRAINT "approval_sla_events_obligation_id_approval_sla_obligations_id_fk" FOREIGN KEY ("obligation_id") REFERENCES "public"."approval_sla_obligations"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "approval_sla_obligations" ADD CONSTRAINT "approval_sla_obligations_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "approval_sla_obligations" ADD CONSTRAINT "approval_sla_obligations_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "approval_sla_obligations" ADD CONSTRAINT "approval_sla_obligations_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;
ALTER TABLE "approval_sla_obligations" ADD CONSTRAINT "approval_sla_obligations_resolved_decision_id_approval_decisions_id_fk" FOREIGN KEY ("resolved_decision_id") REFERENCES "public"."approval_decisions"("id") ON DELETE restrict ON UPDATE no action;
ALTER TABLE "conditional_execution_attempts" ADD CONSTRAINT "conditional_execution_attempts_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "conditional_execution_attempts" ADD CONSTRAINT "conditional_execution_attempts_intent_id_conditional_execution_intents_id_fk" FOREIGN KEY ("intent_id") REFERENCES "public"."conditional_execution_intents"("id") ON DELETE restrict ON UPDATE no action;
ALTER TABLE "conditional_execution_events" ADD CONSTRAINT "conditional_execution_events_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "conditional_execution_events" ADD CONSTRAINT "conditional_execution_events_intent_id_conditional_execution_intents_id_fk" FOREIGN KEY ("intent_id") REFERENCES "public"."conditional_execution_intents"("id") ON DELETE restrict ON UPDATE no action;
ALTER TABLE "conditional_execution_intents" ADD CONSTRAINT "conditional_execution_intents_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "conditional_execution_intents" ADD CONSTRAINT "conditional_execution_intents_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "conditional_execution_intents" ADD CONSTRAINT "conditional_execution_intents_policy_id_conditional_execution_policies_id_fk" FOREIGN KEY ("policy_id") REFERENCES "public"."conditional_execution_policies"("id") ON DELETE restrict ON UPDATE no action;
ALTER TABLE "conditional_execution_intents" ADD CONSTRAINT "conditional_execution_intents_policy_action_id_conditional_execution_policy_actions_id_fk" FOREIGN KEY ("policy_action_id") REFERENCES "public"."conditional_execution_policy_actions"("id") ON DELETE restrict ON UPDATE no action;
ALTER TABLE "conditional_execution_intents" ADD CONSTRAINT "conditional_execution_intents_proposal_id_paid_media_proposals_id_fk" FOREIGN KEY ("proposal_id") REFERENCES "public"."paid_media_proposals"("id") ON DELETE restrict ON UPDATE no action;
ALTER TABLE "conditional_execution_policies" ADD CONSTRAINT "conditional_execution_policies_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "conditional_execution_policies" ADD CONSTRAINT "conditional_execution_policies_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "conditional_execution_policies" ADD CONSTRAINT "conditional_execution_policies_masterplan_version_id_masterplan_versions_id_fk" FOREIGN KEY ("masterplan_version_id") REFERENCES "public"."masterplan_versions"("id") ON DELETE restrict ON UPDATE no action;
ALTER TABLE "conditional_execution_policies" ADD CONSTRAINT "conditional_execution_policies_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;
ALTER TABLE "conditional_execution_policies" ADD CONSTRAINT "conditional_execution_policies_revoked_by_users_id_fk" FOREIGN KEY ("revoked_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;
ALTER TABLE "conditional_execution_policy_actions" ADD CONSTRAINT "conditional_execution_policy_actions_policy_id_conditional_execution_policies_id_fk" FOREIGN KEY ("policy_id") REFERENCES "public"."conditional_execution_policies"("id") ON DELETE restrict ON UPDATE no action;
ALTER TABLE "conditional_execution_policy_actions" ADD CONSTRAINT "conditional_execution_policy_actions_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "conditional_execution_policy_actions" ADD CONSTRAINT "conditional_execution_policy_actions_account_id_paid_media_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."paid_media_accounts"("id") ON DELETE restrict ON UPDATE no action;
ALTER TABLE "conditional_execution_policy_actions" ADD CONSTRAINT "conditional_execution_policy_actions_entity_id_paid_media_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."paid_media_entities"("id") ON DELETE restrict ON UPDATE no action;
ALTER TABLE "conditional_execution_policy_events" ADD CONSTRAINT "conditional_execution_policy_events_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "conditional_execution_policy_events" ADD CONSTRAINT "conditional_execution_policy_events_policy_id_conditional_execution_policies_id_fk" FOREIGN KEY ("policy_id") REFERENCES "public"."conditional_execution_policies"("id") ON DELETE restrict ON UPDATE no action;
ALTER TABLE "conditional_execution_policy_events" ADD CONSTRAINT "conditional_execution_policy_events_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;
ALTER TABLE "realization_attempts" ADD CONSTRAINT "realization_attempts_contract_id_realization_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."realization_contracts"("id") ON DELETE restrict ON UPDATE no action;
ALTER TABLE "realization_attempts" ADD CONSTRAINT "realization_attempts_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "realization_contracts" ADD CONSTRAINT "realization_contracts_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "realization_contracts" ADD CONSTRAINT "realization_contracts_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "realization_contracts" ADD CONSTRAINT "realization_contracts_masterplan_version_id_masterplan_versions_id_fk" FOREIGN KEY ("masterplan_version_id") REFERENCES "public"."masterplan_versions"("id") ON DELETE restrict ON UPDATE no action;
ALTER TABLE "realization_contracts" ADD CONSTRAINT "realization_contracts_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;
ALTER TABLE "realization_events" ADD CONSTRAINT "realization_events_contract_id_realization_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."realization_contracts"("id") ON DELETE restrict ON UPDATE no action;
ALTER TABLE "realization_events" ADD CONSTRAINT "realization_events_attempt_id_realization_attempts_id_fk" FOREIGN KEY ("attempt_id") REFERENCES "public"."realization_attempts"("id") ON DELETE restrict ON UPDATE no action;
ALTER TABLE "realization_events" ADD CONSTRAINT "realization_events_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "council_actions" ADD CONSTRAINT "council_actions_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "council_actions" ADD CONSTRAINT "council_actions_decision_id_council_decisions_id_fk" FOREIGN KEY ("decision_id") REFERENCES "public"."council_decisions"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "council_actions" ADD CONSTRAINT "council_actions_realization_contract_id_realization_contracts_id_fk" FOREIGN KEY ("realization_contract_id") REFERENCES "public"."realization_contracts"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "council_cycles" ADD CONSTRAINT "council_cycles_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "council_cycles" ADD CONSTRAINT "council_cycles_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "council_cycles" ADD CONSTRAINT "council_cycles_masterplan_version_id_masterplan_versions_id_fk" FOREIGN KEY ("masterplan_version_id") REFERENCES "public"."masterplan_versions"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "council_cycles" ADD CONSTRAINT "council_cycles_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "council_decisions" ADD CONSTRAINT "council_decisions_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "council_decisions" ADD CONSTRAINT "council_decisions_cycle_id_council_cycles_id_fk" FOREIGN KEY ("cycle_id") REFERENCES "public"."council_cycles"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "council_decisions" ADD CONSTRAINT "council_decisions_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "council_minutes" ADD CONSTRAINT "council_minutes_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "council_minutes" ADD CONSTRAINT "council_minutes_cycle_id_council_cycles_id_fk" FOREIGN KEY ("cycle_id") REFERENCES "public"."council_cycles"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "council_minutes" ADD CONSTRAINT "council_minutes_author_user_id_users_id_fk" FOREIGN KEY ("author_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "council_outcomes" ADD CONSTRAINT "council_outcomes_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "council_outcomes" ADD CONSTRAINT "council_outcomes_decision_id_council_decisions_id_fk" FOREIGN KEY ("decision_id") REFERENCES "public"."council_decisions"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "council_outcomes" ADD CONSTRAINT "council_outcomes_action_id_council_actions_id_fk" FOREIGN KEY ("action_id") REFERENCES "public"."council_actions"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "m11_social_reports" ADD CONSTRAINT "m11_social_reports_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "m11_social_reports" ADD CONSTRAINT "m11_social_reports_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
CREATE UNIQUE INDEX "credit_tx_idempotency_key_uniq" ON "credit_transactions" USING btree ("idempotency_key") WHERE idempotency_key IS NOT NULL;
CREATE UNIQUE INDEX "domain_dns_records_domain_record_uq" ON "domain_dns_records" USING btree ("domain_id","type","name");
CREATE UNIQUE INDEX "domain_operations_workspace_idempotency_uq" ON "domain_operations" USING btree ("workspace_id","idempotency_key");
CREATE UNIQUE INDEX "landing_deployments_workspace_idempotency_uq" ON "landing_deployments" USING btree ("workspace_id","idempotency_key");
CREATE UNIQUE INDEX "landing_revisions_page_revision_uq" ON "landing_revisions" USING btree ("page_id","revision");
CREATE INDEX "campaign_alerts_campaign_idx" ON "campaign_alerts" USING btree ("campaign_id");
CREATE INDEX "campaign_alerts_severity_idx" ON "campaign_alerts" USING btree ("severity");
CREATE INDEX "campaign_metrics_campaign_date_idx" ON "campaign_metrics" USING btree ("campaign_id","metric_date");
CREATE INDEX "campaign_metrics_workspace_idx" ON "campaign_metrics" USING btree ("workspace_id");
CREATE UNIQUE INDEX "social_posts_workspace_id_uidx" ON "social_posts" USING btree ("workspace_id","id");
CREATE UNIQUE INDEX "social_posts_workspace_content_piece_integration_uidx" ON "social_posts" USING btree ("workspace_id","content_piece_id","integration_id") WHERE "social_posts"."content_piece_id" IS NOT NULL;
CREATE UNIQUE INDEX "social_publish_attempts_post_key_uidx" ON "social_publish_attempts" USING btree ("post_id","attempt_key");
CREATE INDEX "social_publish_attempts_workspace_state_idx" ON "social_publish_attempts" USING btree ("workspace_id","state","next_attempt_at");
CREATE UNIQUE INDEX "launch_sequence_items_workspace_id_uidx" ON "launch_sequence_items" USING btree ("workspace_id","id");
CREATE UNIQUE INDEX "launch_sequences_workspace_campaign_uidx" ON "launch_sequences" USING btree ("workspace_id","campaign_id");
CREATE UNIQUE INDEX "launch_sequences_workspace_id_uidx" ON "launch_sequences" USING btree ("workspace_id","id");
CREATE UNIQUE INDEX "email_dispatches_workspace_idempotency_uidx" ON "email_dispatches" USING btree ("workspace_id","idempotency_key") WHERE "email_dispatches"."idempotency_key" is not null;
CREATE UNIQUE INDEX "whatsapp_dispatches_workspace_idempotency_uidx" ON "whatsapp_dispatches" USING btree ("workspace_id","idempotency_key") WHERE "whatsapp_dispatches"."idempotency_key" is not null;
CREATE UNIQUE INDEX "sequence_contacts_workspace_sequence_email_uidx" ON "sequence_contacts" USING btree ("workspace_id","sequence_id",lower(trim("email"))) WHERE "sequence_contacts"."email" is not null;
CREATE UNIQUE INDEX "sequence_contacts_workspace_sequence_phone_uidx" ON "sequence_contacts" USING btree ("workspace_id","sequence_id",regexp_replace("phone", '[^0-9]', '', 'g')) WHERE "sequence_contacts"."phone" is not null;
CREATE INDEX "sequence_contacts_workspace_sequence_idx" ON "sequence_contacts" USING btree ("workspace_id","sequence_id");
CREATE UNIQUE INDEX "sequence_contacts_workspace_id_uidx" ON "sequence_contacts" USING btree ("workspace_id","id");
CREATE UNIQUE INDEX "sequence_engagement_first_touch_uidx" ON "sequence_engagement" USING btree ("workspace_id","sequence_id","contact_id","item_id","channel","event");
CREATE UNIQUE INDEX "first_touch_attempts_key_uidx" ON "first_touch_attempts" USING btree ("workspace_id","attempt_key");
CREATE INDEX "first_touch_attempts_due_idx" ON "first_touch_attempts" USING btree ("workspace_id","state","next_attempt_at");
CREATE UNIQUE INDEX "recording_folders_workspace_slug_uidx" ON "recording_folders" USING btree ("workspace_id","slug");
CREATE UNIQUE INDEX "recording_folders_workspace_system_type_uidx" ON "recording_folders" USING btree ("workspace_id","system_type") WHERE "recording_folders"."is_system" = true and "recording_folders"."system_type" is not null;
CREATE UNIQUE INDEX "meta_webhook_event_action_unique" ON "meta_webhook_events" USING btree ("account_id","provider_event_id","action_key");
CREATE INDEX "meta_webhook_events_retry_idx" ON "meta_webhook_events" USING btree ("status","next_retry_at");
CREATE INDEX "meta_webhook_events_workspace_idx" ON "meta_webhook_events" USING btree ("workspace_id","received_at");
CREATE INDEX "sales_conversations_workspace_idx" ON "sales_conversations" USING btree ("workspace_id");
CREATE INDEX "sales_conversations_status_idx" ON "sales_conversations" USING btree ("status");
CREATE INDEX "sales_conversations_stage_idx" ON "sales_conversations" USING btree ("funnel_stage");
CREATE INDEX "sales_messages_conv_idx" ON "sales_messages" USING btree ("conversation_id");
CREATE INDEX "integration_chat_conversations_workspace_idx" ON "integration_chat_conversations" USING btree ("workspace_id");
CREATE INDEX "integration_chat_conversations_status_idx" ON "integration_chat_conversations" USING btree ("status");
CREATE INDEX "integration_chat_messages_conv_idx" ON "integration_chat_messages" USING btree ("conversation_id");
CREATE INDEX "correction_loops_revision_status_idx" ON "correction_loops" USING btree ("revision_id","status");
CREATE INDEX "correction_loops_project_status_idx" ON "correction_loops" USING btree ("video_project_id","status");
CREATE INDEX "production_assets_project_idx" ON "production_assets" USING btree ("video_project_id","created_at");
CREATE INDEX "production_assets_manifest_idx" ON "production_assets" USING btree ("manifest_id");
CREATE UNIQUE INDEX "production_manifests_project_uidx" ON "production_manifests" USING btree ("video_project_id");
CREATE INDEX "production_manifests_workspace_idx" ON "production_manifests" USING btree ("workspace_id");
CREATE UNIQUE INDEX "production_revisions_project_number_uidx" ON "production_revisions" USING btree ("video_project_id","revision_number");
CREATE INDEX "production_revisions_manifest_idx" ON "production_revisions" USING btree ("manifest_id");
CREATE INDEX "qc_issues_report_status_idx" ON "qc_issues" USING btree ("qc_report_id","status");
CREATE INDEX "qc_issues_project_status_idx" ON "qc_issues" USING btree ("video_project_id","status");
CREATE INDEX "qc_reports_project_status_idx" ON "qc_reports" USING btree ("video_project_id","status","created_at");
CREATE INDEX "qc_reports_render_job_idx" ON "qc_reports" USING btree ("render_job_id");
CREATE INDEX "render_jobs_project_status_idx" ON "render_jobs" USING btree ("video_project_id","status","created_at");
CREATE INDEX "render_jobs_manifest_idx" ON "render_jobs" USING btree ("manifest_id");
CREATE UNIQUE INDEX "timeline_items_track_position_uidx" ON "timeline_items" USING btree ("track_id","position");
CREATE INDEX "timeline_items_project_idx" ON "timeline_items" USING btree ("video_project_id","start_ms");
CREATE UNIQUE INDEX "timeline_tracks_manifest_position_uidx" ON "timeline_tracks" USING btree ("manifest_id","position");
CREATE INDEX "timeline_tracks_project_idx" ON "timeline_tracks" USING btree ("video_project_id");
CREATE INDEX "video_media_purges_project_status_idx" ON "video_media_purges" USING btree ("workspace_id","video_project_id","status","created_at");
CREATE UNIQUE INDEX "social_conversation_turn_event_unique" ON "social_conversation_turns" USING btree ("workspace_id","integration_id","provider_event_id","direction");
CREATE INDEX "social_conversation_turn_account_user_idx" ON "social_conversation_turns" USING btree ("workspace_id","account_id","provider_user_id","created_at");
CREATE UNIQUE INDEX "contract_acceptances_workspace_idempotency_unique" ON "contract_acceptances" USING btree ("workspace_id","idempotency_key");
CREATE INDEX "contract_acceptances_workspace_campaign_type_idx" ON "contract_acceptances" USING btree ("workspace_id","campaign_id","acceptance_type");
CREATE INDEX "contract_acceptances_contract_idx" ON "contract_acceptances" USING btree ("contract_key","contract_version","contract_hash");
CREATE UNIQUE INDEX "contract_versions_key_version_unique" ON "contract_versions" USING btree ("contract_key","version");
CREATE UNIQUE INDEX "contract_versions_key_hash_unique" ON "contract_versions" USING btree ("contract_key","content_hash");
CREATE UNIQUE INDEX "mandatory_pauses_workspace_idempotency_unique" ON "mandatory_pauses" USING btree ("workspace_id","idempotency_key");
CREATE INDEX "mandatory_pauses_workspace_status_scope_idx" ON "mandatory_pauses" USING btree ("workspace_id","status","campaign_id","channel","action");
CREATE UNIQUE INDEX "paid_media_accounts_provider_account_unique" ON "paid_media_accounts" USING btree ("workspace_id","provider","provider_account_id");
CREATE INDEX "paid_media_accounts_workspace_provider_idx" ON "paid_media_accounts" USING btree ("workspace_id","provider");
CREATE UNIQUE INDEX "paid_media_action_attempts_proposal_attempt_unique" ON "paid_media_action_attempts" USING btree ("proposal_id","attempt_number");
CREATE UNIQUE INDEX "paid_media_action_attempts_idempotency_unique" ON "paid_media_action_attempts" USING btree ("idempotency_key");
CREATE INDEX "paid_media_action_attempts_workspace_status_idx" ON "paid_media_action_attempts" USING btree ("workspace_id","status");
CREATE INDEX "paid_media_approvals_proposal_idx" ON "paid_media_approvals" USING btree ("proposal_id");
CREATE UNIQUE INDEX "paid_media_touchpoints_workspace_external_unique" ON "paid_media_attribution_touchpoints" USING btree ("workspace_id","external_touchpoint_id");
CREATE INDEX "paid_media_touchpoints_workspace_click_idx" ON "paid_media_attribution_touchpoints" USING btree ("workspace_id","click_id");
CREATE UNIQUE INDEX "paid_media_budget_strategies_campaign_unique" ON "paid_media_budget_strategies" USING btree ("campaign_entity_id");
CREATE INDEX "paid_media_budget_strategies_workspace_account_idx" ON "paid_media_budget_strategies" USING btree ("workspace_id","account_id");
CREATE UNIQUE INDEX "paid_media_conversions_workspace_external_unique" ON "paid_media_conversions" USING btree ("workspace_id","external_conversion_id");
CREATE INDEX "paid_media_conversions_workspace_occurred_idx" ON "paid_media_conversions" USING btree ("workspace_id","occurred_at");
CREATE UNIQUE INDEX "paid_media_datasets_account_provider_dataset_unique" ON "paid_media_datasets" USING btree ("account_id","provider","provider_dataset_id");
CREATE UNIQUE INDEX "paid_media_datasets_ingestion_key_unique" ON "paid_media_datasets" USING btree ("ingestion_key");
CREATE INDEX "paid_media_datasets_workspace_account_idx" ON "paid_media_datasets" USING btree ("workspace_id","account_id");
CREATE UNIQUE INDEX "paid_media_entities_account_entity_unique" ON "paid_media_entities" USING btree ("account_id","provider_entity_id","entity_type");
CREATE INDEX "paid_media_entities_workspace_account_idx" ON "paid_media_entities" USING btree ("workspace_id","account_id");
CREATE UNIQUE INDEX "paid_media_event_receipts_dataset_event_unique" ON "paid_media_event_receipts" USING btree ("dataset_id","event_id");
CREATE INDEX "paid_media_event_receipts_workspace_occurred_idx" ON "paid_media_event_receipts" USING btree ("workspace_id","occurred_at");
CREATE UNIQUE INDEX "paid_media_insights_idempotency_unique" ON "paid_media_insights" USING btree ("entity_id","metric_date","date_grain","attribution_window");
CREATE INDEX "paid_media_insights_workspace_date_idx" ON "paid_media_insights" USING btree ("workspace_id","metric_date");
CREATE UNIQUE INDEX "paid_media_launch_attempts_plan_key_uidx" ON "paid_media_launch_attempts" USING btree ("launch_plan_id","attempt_key");
CREATE UNIQUE INDEX "paid_media_launch_plans_workspace_hash_uidx" ON "paid_media_launch_plans" USING btree ("workspace_id","plan_hash");
CREATE INDEX "paid_media_launch_plans_workspace_campaign_idx" ON "paid_media_launch_plans" USING btree ("workspace_id","campaign_id");
CREATE UNIQUE INDEX "paid_media_launch_steps_attempt_key_uidx" ON "paid_media_launch_steps" USING btree ("attempt_id","step_key");
CREATE INDEX "paid_media_policies_workspace_provider_idx" ON "paid_media_policies" USING btree ("workspace_id","provider","account_id");
CREATE UNIQUE INDEX "paid_media_proposals_workspace_idempotency_unique" ON "paid_media_proposals" USING btree ("workspace_id","idempotency_key");
CREATE INDEX "paid_media_proposals_workspace_status_idx" ON "paid_media_proposals" USING btree ("workspace_id","status");
CREATE UNIQUE INDEX "paid_media_sync_cursors_account_entity_unique" ON "paid_media_sync_cursors" USING btree ("account_id","entity_type");
CREATE INDEX "paid_media_sync_cursors_claim_idx" ON "paid_media_sync_cursors" USING btree ("claimed_at");
CREATE INDEX "orchestration_dead_letters_workspace_idx" ON "orchestration_dead_letters" USING btree ("workspace_id","last_failed_at");
CREATE INDEX "orchestration_dead_letters_campaign_idx" ON "orchestration_dead_letters" USING btree ("campaign_id","last_failed_at");
CREATE INDEX "orchestration_dead_letters_job_idx" ON "orchestration_dead_letters" USING btree ("job_id");
CREATE INDEX "native_media_consents_lookup_idx" ON "native_media_consents" USING btree ("workspace_id","subject_reference","consent_type","revoked_at");
CREATE INDEX "native_media_job_events_job_idx" ON "native_media_job_events" USING btree ("job_id","created_at");
CREATE INDEX "native_media_jobs_queue_idx" ON "native_media_jobs" USING btree ("status","operation","submitted_at");
CREATE INDEX "native_media_jobs_project_idx" ON "native_media_jobs" USING btree ("workspace_id","video_project_id","created_at");
CREATE INDEX "native_media_jobs_lease_idx" ON "native_media_jobs" USING btree ("lease_expires_at");
CREATE UNIQUE INDEX "native_media_jobs_workspace_project_idempotency_uidx" ON "native_media_jobs" USING btree ("workspace_id","video_project_id","idempotency_key");
CREATE UNIQUE INDEX "native_media_provenance_output_uidx" ON "native_media_provenance" USING btree ("workspace_id","output_object_key");
CREATE INDEX "native_media_provenance_job_idx" ON "native_media_provenance" USING btree ("job_id");
CREATE INDEX "native_media_usage_project_idx" ON "native_media_usage" USING btree ("workspace_id","video_project_id","created_at");
CREATE UNIQUE INDEX "native_media_worker_nonces_worker_nonce_uidx" ON "native_media_worker_nonces" USING btree ("worker_id","nonce");
CREATE INDEX "native_media_worker_nonces_expiry_idx" ON "native_media_worker_nonces" USING btree ("expires_at");
CREATE UNIQUE INDEX "native_media_workers_workspace_name_uidx" ON "native_media_workers" USING btree ("workspace_id","worker_name");
CREATE INDEX "native_media_workers_health_idx" ON "native_media_workers" USING btree ("workspace_id","healthy","last_heartbeat_at");
CREATE UNIQUE INDEX "masterplan_versions_workspace_campaign_version_uidx" ON "masterplan_versions" USING btree ("workspace_id","campaign_id","version");
CREATE INDEX "masterplan_versions_workspace_campaign_status_idx" ON "masterplan_versions" USING btree ("workspace_id","campaign_id","status");
CREATE INDEX "masterplan_versions_workspace_campaign_created_idx" ON "masterplan_versions" USING btree ("workspace_id","campaign_id","created_at");
CREATE INDEX "execution_evidence_workspace_subject_idx" ON "execution_evidence" USING btree ("workspace_id","subject_type","subject_id","created_at");
CREATE INDEX "execution_evidence_workspace_campaign_idx" ON "execution_evidence" USING btree ("workspace_id","campaign_id","created_at");
CREATE INDEX "execution_evidence_workspace_campaign_created_id_idx" ON "execution_evidence" USING btree ("workspace_id","campaign_id","created_at","id");
CREATE UNIQUE INDEX "regional_alerts_change_event_uidx" ON "regional_alerts" USING btree ("change_event_id");
CREATE INDEX "regional_alerts_workspace_campaign_status_idx" ON "regional_alerts" USING btree ("workspace_id","campaign_id","status");
CREATE UNIQUE INDEX "regional_audience_opportunities_signal_uidx" ON "regional_audience_opportunities" USING btree ("signal_id");
CREATE UNIQUE INDEX "regional_audience_opportunities_workspace_identity_uidx" ON "regional_audience_opportunities" USING btree ("workspace_id","campaign_id","identity_hint_fingerprint");
CREATE INDEX "regional_audience_opportunities_workspace_campaign_idx" ON "regional_audience_opportunities" USING btree ("workspace_id","campaign_id","created_at");
CREATE UNIQUE INDEX "regional_audience_segments_workspace_fingerprint_uidx" ON "regional_audience_segments" USING btree ("workspace_id","fingerprint");
CREATE INDEX "regional_audience_segments_workspace_campaign_idx" ON "regional_audience_segments" USING btree ("workspace_id","campaign_id","updated_at");
CREATE UNIQUE INDEX "regional_change_events_observation_uidx" ON "regional_change_events" USING btree ("observation_id");
CREATE INDEX "regional_change_events_workspace_campaign_idx" ON "regional_change_events" USING btree ("workspace_id","campaign_id","created_at");
CREATE UNIQUE INDEX "regional_competitors_workspace_campaign_url_uidx" ON "regional_competitors" USING btree ("workspace_id","campaign_id","normalized_website_url");
CREATE INDEX "regional_competitors_workspace_campaign_idx" ON "regional_competitors" USING btree ("workspace_id","campaign_id");
CREATE UNIQUE INDEX "regional_evidence_workspace_fingerprint_uidx" ON "regional_evidence" USING btree ("workspace_id","fingerprint");
CREATE INDEX "regional_evidence_workspace_campaign_idx" ON "regional_evidence" USING btree ("workspace_id","campaign_id");
CREATE UNIQUE INDEX "regional_monitor_runs_workspace_campaign_key_uidx" ON "regional_monitor_runs" USING btree ("workspace_id","campaign_id","idempotency_key");
CREATE INDEX "regional_monitor_runs_workspace_campaign_idx" ON "regional_monitor_runs" USING btree ("workspace_id","campaign_id","created_at");
CREATE UNIQUE INDEX "regional_observations_workspace_fingerprint_uidx" ON "regional_observations" USING btree ("workspace_id","fingerprint");
CREATE INDEX "regional_observations_competitor_time_idx" ON "regional_observations" USING btree ("workspace_id","competitor_id","observed_at");
CREATE UNIQUE INDEX "regional_profiles_workspace_campaign_uidx" ON "regional_profiles" USING btree ("workspace_id","campaign_id");
CREATE UNIQUE INDEX "regional_sources_workspace_campaign_url_uidx" ON "regional_public_sources" USING btree ("workspace_id","campaign_id","normalized_url");
CREATE INDEX "regional_sources_workspace_campaign_idx" ON "regional_public_sources" USING btree ("workspace_id","campaign_id");
CREATE UNIQUE INDEX "regional_social_signals_workspace_fingerprint_uidx" ON "regional_social_signals" USING btree ("workspace_id","fingerprint");
CREATE INDEX "regional_social_signals_workspace_campaign_time_idx" ON "regional_social_signals" USING btree ("workspace_id","campaign_id","occurred_at");
CREATE INDEX "interaction_approval_draft_idx" ON "interaction_approvals" USING btree ("workspace_id","draft_id","created_at");
CREATE INDEX "interaction_decision_opportunity_idx" ON "interaction_decisions" USING btree ("workspace_id","opportunity_id","created_at");
CREATE INDEX "interaction_draft_workspace_fingerprint_idx" ON "interaction_drafts" USING btree ("workspace_id","content_fingerprint");
CREATE INDEX "interaction_execution_workspace_time_idx" ON "interaction_executions" USING btree ("workspace_id","reserved_at");
CREATE UNIQUE INDEX "interaction_policy_workspace_uidx" ON "interaction_governance_policies" USING btree ("workspace_id");
CREATE UNIQUE INDEX "interaction_opportunity_source_integration_action_uidx" ON "interaction_opportunities" USING btree ("source_audience_opportunity_id","integration_id","action");
CREATE INDEX "interaction_opportunity_workspace_state_idx" ON "interaction_opportunities" USING btree ("workspace_id","state","created_at");
CREATE INDEX "interaction_opportunity_recipient_idx" ON "interaction_opportunities" USING btree ("workspace_id","recipient_id","created_at");
CREATE UNIQUE INDEX "interaction_capability_integration_action_uidx" ON "interaction_platform_capabilities" USING btree ("integration_id","action");
CREATE INDEX "interaction_capability_workspace_idx" ON "interaction_platform_capabilities" USING btree ("workspace_id");
CREATE UNIQUE INDEX "interaction_recipient_workspace_fingerprint_uidx" ON "interaction_recipients" USING btree ("workspace_id","fingerprint");
CREATE UNIQUE INDEX "radar_orders_workspace_idempotency_uidx" ON "radar_orders" USING btree ("workspace_id","idempotency_key");
CREATE UNIQUE INDEX "radar_orders_provider_payment_uidx" ON "radar_orders" USING btree ("provider_payment_id");
CREATE INDEX "radar_orders_workspace_status_idx" ON "radar_orders" USING btree ("workspace_id","status");
CREATE UNIQUE INDEX "radar_purchase_request_workspace_key_uidx" ON "radar_purchase_requests" USING btree ("workspace_id","idempotency_key");
CREATE INDEX "radar_purchase_request_workspace_status_idx" ON "radar_purchase_requests" USING btree ("workspace_id","status");
CREATE INDEX "radar_subscriptions_workspace_status_idx" ON "radar_subscriptions" USING btree ("workspace_id","status","period_ends_at");
CREATE INDEX "radar_subscriptions_workspace_window_idx" ON "radar_subscriptions" USING btree ("workspace_id","window_ends_at");
CREATE UNIQUE INDEX "radar_usage_workspace_idempotency_uidx" ON "radar_usage_ledger" USING btree ("workspace_id","idempotency_key");
CREATE INDEX "radar_usage_workspace_dimension_period_idx" ON "radar_usage_ledger" USING btree ("workspace_id","dimension","period_starts_at");
CREATE INDEX "commercial_subscriptions_workspace_status_idx" ON "commercial_subscriptions" USING btree ("workspace_id","status");
CREATE UNIQUE INDEX "entitlement_grants_subscription_capability_uidx" ON "entitlement_grants" USING btree ("subscription_id","capability");
CREATE INDEX "entitlement_grants_workspace_idx" ON "entitlement_grants" USING btree ("workspace_id");
CREATE UNIQUE INDEX "community_action_idempotency_uidx" ON "community_action_attempts" USING btree ("workspace_id","idempotency_key");
CREATE UNIQUE INDEX "community_conversation_provider_uidx" ON "community_conversations" USING btree ("workspace_id","channel","provider_conversation_id");
CREATE UNIQUE INDEX "community_message_provider_uidx" ON "community_messages" USING btree ("workspace_id","provider_message_id");
CREATE UNIQUE INDEX "community_participant_provider_uidx" ON "community_participants" USING btree ("conversation_id","provider_participant_id");
CREATE UNIQUE INDEX "community_provider_event_uidx" ON "community_provider_events" USING btree ("workspace_id","channel","provider_event_id");
CREATE UNIQUE INDEX "buyer_onboarding_sale_unique" ON "buyer_onboarding_instances" USING btree ("sale_id");
CREATE UNIQUE INDEX "cart_recovery_sale_channel_unique" ON "cart_recovery_actions" USING btree ("sale_id","channel");
CREATE UNIQUE INDEX "lifecycle_contacts_workspace_email_unique" ON "lifecycle_contacts" USING btree ("workspace_id","email");
CREATE UNIQUE INDEX "lifecycle_contacts_workspace_phone_unique" ON "lifecycle_contacts" USING btree ("workspace_id","phone");
CREATE UNIQUE INDEX "lifecycle_events_workspace_key_unique" ON "lifecycle_events" USING btree ("workspace_id","event_key");
CREATE UNIQUE INDEX "purchaser_referral_attribution_sale_unique" ON "purchaser_referral_attributions" USING btree ("sale_id");
CREATE UNIQUE INDEX "purchaser_referrals_workspace_code_unique" ON "purchaser_referrals" USING btree ("workspace_id","code");
CREATE UNIQUE INDEX "purchaser_referrals_referrer_unique" ON "purchaser_referrals" USING btree ("referrer_contact_id");
CREATE UNIQUE INDEX "referral_reward_attribution_unique" ON "referral_rewards" USING btree ("attribution_id");
CREATE UNIQUE INDEX "retention_contact_reason_unique" ON "retention_actions" USING btree ("contact_id","reason");
CREATE UNIQUE INDEX "upsell_action_offer_source_sale_unique" ON "upsell_actions" USING btree ("offer_id","source_sale_id");
CREATE UNIQUE INDEX "product_intakes_workspace_product_version_uidx" ON "product_intakes" USING btree ("workspace_id","commercial_product_id","version");
CREATE UNIQUE INDEX "product_intakes_one_draft_per_product_uidx" ON "product_intakes" USING btree ("workspace_id","commercial_product_id") WHERE "product_intakes"."status" = 'draft';
CREATE INDEX "product_intakes_workspace_product_status_idx" ON "product_intakes" USING btree ("workspace_id","commercial_product_id","status");
CREATE UNIQUE INDEX "approval_decisions_workspace_idempotency_uidx" ON "approval_decisions" USING btree ("workspace_id","idempotency_key");
CREATE UNIQUE INDEX "approval_decisions_workspace_subject_snapshot_uidx" ON "approval_decisions" USING btree ("workspace_id","subject_type","subject_id","resolved_snapshot_hash");
CREATE UNIQUE INDEX "approval_decisions_workspace_command_fingerprint_uidx" ON "approval_decisions" USING btree ("workspace_id","command_fingerprint");
CREATE INDEX "approval_decisions_campaign_subject_idx" ON "approval_decisions" USING btree ("workspace_id","campaign_id","subject_type","subject_id");
CREATE INDEX "approval_decisions_actor_idx" ON "approval_decisions" USING btree ("workspace_id","actor_user_id");
CREATE UNIQUE INDEX "approval_sla_events_obligation_kind_channel_uidx" ON "approval_sla_events" USING btree ("obligation_id","event_kind","channel");
CREATE INDEX "approval_sla_events_workspace_idx" ON "approval_sla_events" USING btree ("workspace_id","created_at");
CREATE UNIQUE INDEX "approval_sla_obligations_workspace_id_uidx" ON "approval_sla_obligations" USING btree ("workspace_id","id");
CREATE UNIQUE INDEX "approval_sla_obligations_subject_uidx" ON "approval_sla_obligations" USING btree ("workspace_id","campaign_id","subject_type","subject_id","subject_snapshot_hash");
CREATE UNIQUE INDEX "approval_sla_obligations_idempotency_uidx" ON "approval_sla_obligations" USING btree ("workspace_id","idempotency_key");
CREATE INDEX "approval_sla_obligations_due_idx" ON "approval_sla_obligations" USING btree ("status","due_at");
CREATE UNIQUE INDEX "conditional_execution_attempts_key_uidx" ON "conditional_execution_attempts" USING btree ("workspace_id","attempt_key");
CREATE INDEX "conditional_execution_events_intent_idx" ON "conditional_execution_events" USING btree ("intent_id","created_at");
CREATE UNIQUE INDEX "conditional_execution_intents_key_uidx" ON "conditional_execution_intents" USING btree ("workspace_id","intent_key");
CREATE INDEX "conditional_execution_intents_campaign_idx" ON "conditional_execution_intents" USING btree ("workspace_id","campaign_id","created_at");
CREATE UNIQUE INDEX "conditional_execution_policies_campaign_version_uidx" ON "conditional_execution_policies" USING btree ("workspace_id","campaign_id","version");
CREATE UNIQUE INDEX "conditional_execution_policies_idempotency_uidx" ON "conditional_execution_policies" USING btree ("workspace_id","idempotency_key");
CREATE UNIQUE INDEX "conditional_execution_policies_campaign_id_uidx" ON "conditional_execution_policies" USING btree ("workspace_id","campaign_id","id");
CREATE INDEX "conditional_execution_policies_current_idx" ON "conditional_execution_policies" USING btree ("workspace_id","campaign_id","enabled");
CREATE UNIQUE INDEX "conditional_policy_actions_policy_target_uidx" ON "conditional_execution_policy_actions" USING btree ("policy_id","provider","account_id","entity_id","action_type");
CREATE UNIQUE INDEX "conditional_actions_workspace_policy_id_uidx" ON "conditional_execution_policy_actions" USING btree ("workspace_id","policy_id","id");
CREATE INDEX "conditional_policy_events_policy_idx" ON "conditional_execution_policy_events" USING btree ("policy_id","created_at");
CREATE UNIQUE INDEX "realization_attempts_contract_number_uidx" ON "realization_attempts" USING btree ("contract_id","number");
CREATE UNIQUE INDEX "realization_attempts_workspace_contract_id_uidx" ON "realization_attempts" USING btree ("workspace_id","contract_id","id");
CREATE INDEX "realization_attempts_workspace_idx" ON "realization_attempts" USING btree ("workspace_id","claimed_at");
CREATE UNIQUE INDEX "realization_contracts_workspace_idempotency_uidx" ON "realization_contracts" USING btree ("workspace_id","idempotency_key");
CREATE UNIQUE INDEX "realization_contracts_workspace_id_uidx" ON "realization_contracts" USING btree ("workspace_id","id");
CREATE INDEX "realization_contracts_workspace_campaign_idx" ON "realization_contracts" USING btree ("workspace_id","campaign_id","created_at");
CREATE INDEX "realization_events_contract_created_idx" ON "realization_events" USING btree ("contract_id","created_at");
CREATE UNIQUE INDEX "council_actions_scope_idempotency_uidx" ON "council_actions" USING btree ("workspace_id","idempotency_key");
CREATE UNIQUE INDEX "council_actions_scope_uidx" ON "council_actions" USING btree ("workspace_id","id");
CREATE INDEX "council_actions_decision_idx" ON "council_actions" USING btree ("workspace_id","decision_id");
CREATE UNIQUE INDEX "council_cycles_scope_idempotency_uidx" ON "council_cycles" USING btree ("workspace_id","campaign_id","idempotency_key");
CREATE UNIQUE INDEX "council_cycles_scope_uidx" ON "council_cycles" USING btree ("workspace_id","id");
CREATE INDEX "council_cycles_campaign_idx" ON "council_cycles" USING btree ("workspace_id","campaign_id","created_at");
CREATE UNIQUE INDEX "council_decisions_scope_uidx" ON "council_decisions" USING btree ("workspace_id","id");
CREATE INDEX "council_decisions_cycle_idx" ON "council_decisions" USING btree ("workspace_id","cycle_id","created_at");
CREATE INDEX "council_minutes_cycle_idx" ON "council_minutes" USING btree ("workspace_id","cycle_id","created_at");
CREATE UNIQUE INDEX "council_outcomes_action_evidence_uidx" ON "council_outcomes" USING btree ("workspace_id","action_id","next_cycle_id","verification_fingerprint");
CREATE INDEX "council_outcomes_decision_idx" ON "council_outcomes" USING btree ("workspace_id","decision_id","created_at");
CREATE INDEX "m11_social_reports_workspace_created_idx" ON "m11_social_reports" USING btree ("workspace_id","created_at","id");
