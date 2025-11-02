CREATE TABLE "ai_fix_attempts" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"error_signature" varchar(64) NOT NULL,
	"healing_session_id" varchar,
	"proposed_fix" text NOT NULL,
	"confidence_score" numeric(5, 2) NOT NULL,
	"outcome" text NOT NULL,
	"verification_results" jsonb,
	"pr_number" integer,
	"pr_url" text,
	"auto_merged" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "ai_knowledge_base" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"error_signature" varchar(64) NOT NULL,
	"error_type" text NOT NULL,
	"context" jsonb,
	"successful_fix" text NOT NULL,
	"confidence" numeric(5, 2) DEFAULT '0.00' NOT NULL,
	"times_encountered" integer DEFAULT 1 NOT NULL,
	"times_fixed" integer DEFAULT 0 NOT NULL,
	"last_encountered" timestamp DEFAULT now() NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "ai_knowledge_base_error_signature_unique" UNIQUE("error_signature")
);
--> statement-breakpoint
CREATE TABLE "api_key_usage" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"api_key_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"endpoint" text NOT NULL,
	"tokens_used" integer DEFAULT 0 NOT NULL,
	"cost" numeric(10, 4) DEFAULT '0.0000' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "api_keys" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"name" text NOT NULL,
	"key" varchar NOT NULL,
	"key_prefix" varchar NOT NULL,
	"last_used_at" timestamp,
	"expires_at" timestamp,
	"is_active" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "api_keys_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "architect_reviews" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"project_id" varchar,
	"task_id" varchar,
	"task_list_id" varchar,
	"review_type" text NOT NULL,
	"findings" text NOT NULL,
	"severity" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "automation_runs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"project_id" varchar,
	"template_id" varchar,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"config" jsonb NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"last_run_at" timestamp,
	"next_run_at" timestamp,
	"execution_count" integer DEFAULT 0,
	"error_count" integer DEFAULT 0,
	"deployment_url" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "automation_templates" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"description" text,
	"icon" text,
	"connector_type" text,
	"config_schema" jsonb NOT NULL,
	"code_template" text NOT NULL,
	"is_official" boolean DEFAULT false NOT NULL,
	"usage_count" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chat_messages" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"project_id" varchar,
	"file_id" varchar,
	"role" text NOT NULL,
	"content" text NOT NULL,
	"images" jsonb,
	"is_summary" boolean DEFAULT false NOT NULL,
	"is_platform_healing" boolean DEFAULT false NOT NULL,
	"platform_changes" jsonb,
	"approval_status" text,
	"approval_summary" text,
	"approved_by" varchar,
	"approved_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "commands" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"project_id" varchar,
	"command" text NOT NULL,
	"response" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"platform_mode" text DEFAULT 'user',
	"platform_changes" jsonb,
	"auto_committed" text DEFAULT 'false',
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "conversation_states" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"project_id" varchar,
	"current_goal" text,
	"mentioned_files" text[] DEFAULT ARRAY[]::text[],
	"session_summary" text,
	"context" jsonb DEFAULT '{}'::jsonb,
	"last_updated" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cost_tracking" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"project_id" varchar,
	"operation_type" text NOT NULL,
	"resource_type" text NOT NULL,
	"input_tokens" integer DEFAULT 0,
	"output_tokens" integer DEFAULT 0,
	"cached_tokens" integer DEFAULT 0,
	"storage_gb" numeric(10, 4) DEFAULT '0',
	"bandwidth_gb" numeric(10, 4) DEFAULT '0',
	"input_cost" numeric(10, 6) DEFAULT '0',
	"output_cost" numeric(10, 6) DEFAULT '0',
	"infrastructure_cost" numeric(10, 6) DEFAULT '0',
	"total_cost" numeric(10, 6) NOT NULL,
	"user_price" numeric(10, 2) NOT NULL,
	"margin_percent" numeric(5, 2) DEFAULT '90',
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "deployments" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"project_id" varchar NOT NULL,
	"subdomain" varchar NOT NULL,
	"custom_domain" varchar,
	"ssl_status" text DEFAULT 'pending',
	"env_variables" jsonb,
	"status" text DEFAULT 'active' NOT NULL,
	"monthly_visits" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "deployments_subdomain_unique" UNIQUE("subdomain")
);
--> statement-breakpoint
CREATE TABLE "design_prototypes" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"project_id" varchar,
	"plan_session_id" varchar,
	"name" text NOT NULL,
	"description" text,
	"screens" jsonb NOT NULL,
	"design_system_tokens" jsonb,
	"generated_files" jsonb,
	"status" text DEFAULT 'draft' NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"approved_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "dynamic_intelligence_sessions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"project_id" varchar,
	"task_id" varchar,
	"mode" text NOT NULL,
	"problem" text NOT NULL,
	"analysis" text,
	"recommendations" text,
	"tokens_used" integer DEFAULT 0,
	"thinking_time" integer DEFAULT 0,
	"cost" numeric(10, 4) DEFAULT '0.0000',
	"status" text DEFAULT 'running' NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "error_signature_deduplication" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"project_id" varchar NOT NULL,
	"error_signature" varchar(64) NOT NULL,
	"error_type" text NOT NULL,
	"error_message" text NOT NULL,
	"first_attempt_id" varchar NOT NULL,
	"last_attempt_id" varchar NOT NULL,
	"total_attempts" integer DEFAULT 1 NOT NULL,
	"successful_attempts" integer DEFAULT 0 NOT NULL,
	"total_charged" numeric(10, 2) DEFAULT '0.00' NOT NULL,
	"last_charged_at" timestamp,
	"resolved" boolean DEFAULT false NOT NULL,
	"resolved_at" timestamp,
	"resolved_by" varchar,
	"confidence" numeric(5, 2) DEFAULT '0.00' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "file_uploads" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"filename" text NOT NULL,
	"original_name" text NOT NULL,
	"mime_type" text NOT NULL,
	"size" integer NOT NULL,
	"storage_key" text NOT NULL,
	"storage_type" text DEFAULT 'base64' NOT NULL,
	"url" text,
	"folder_id" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "files" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"project_id" varchar,
	"filename" text NOT NULL,
	"path" text DEFAULT '' NOT NULL,
	"content" text DEFAULT '' NOT NULL,
	"language" text DEFAULT 'javascript' NOT NULL,
	"folder_id" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "git_repositories" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"project_id" varchar NOT NULL,
	"provider" text NOT NULL,
	"repo_url" text NOT NULL,
	"repo_name" text NOT NULL,
	"branch" text DEFAULT 'main' NOT NULL,
	"access_token" text,
	"last_synced_at" timestamp,
	"sync_status" text DEFAULT 'pending',
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "healing_conversations" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"target_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"title" text DEFAULT 'New Healing Session' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "healing_messages" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" varchar NOT NULL,
	"role" text NOT NULL,
	"content" text NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "healing_targets" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"type" text NOT NULL,
	"name" text NOT NULL,
	"project_id" varchar,
	"customer_id" varchar,
	"railway_project_id" text,
	"repository_url" text,
	"last_synced_at" timestamp,
	"status" text DEFAULT 'active' NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "health_monitoring_records" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"fix_attempt_id" varchar NOT NULL,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"ended_at" timestamp,
	"monitoring_duration" integer DEFAULT 300 NOT NULL,
	"checks_performed" integer DEFAULT 0 NOT NULL,
	"checks_passed_count" integer DEFAULT 0 NOT NULL,
	"checks_failed_count" integer DEFAULT 0 NOT NULL,
	"overall_health" text DEFAULT 'monitoring' NOT NULL,
	"final_status" text,
	"health_checks" jsonb DEFAULT '[]'::jsonb,
	"failure_reason" text,
	"failure_details" jsonb,
	"action_taken" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "image_generations" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"project_id" varchar,
	"prompt" text NOT NULL,
	"model" text DEFAULT 'gpt-image-1' NOT NULL,
	"image_url" text,
	"width" integer,
	"height" integer,
	"quality" text DEFAULT 'standard',
	"style" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"tokens_used" integer DEFAULT 0,
	"cost" numeric(10, 4) DEFAULT '0.0000',
	"error" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "leads" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar NOT NULL,
	"source" text DEFAULT 'landing_page' NOT NULL,
	"metadata" jsonb,
	"status" text DEFAULT 'new' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "leads_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "sysop_tasks" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"project_id" varchar,
	"command_id" varchar,
	"title" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"priority" integer DEFAULT 1 NOT NULL,
	"sub_agent_id" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "lomu_attachments" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"message_id" varchar NOT NULL,
	"file_name" varchar NOT NULL,
	"file_type" varchar NOT NULL,
	"content" text,
	"mime_type" varchar,
	"size" integer,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "lomu_automation" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"trigger" text NOT NULL,
	"trigger_conditions" jsonb NOT NULL,
	"actions" jsonb NOT NULL,
	"requires_approval" boolean DEFAULT true NOT NULL,
	"auto_commit" boolean DEFAULT false NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"execution_count" integer DEFAULT 0 NOT NULL,
	"last_executed_at" timestamp,
	"success_count" integer DEFAULT 0 NOT NULL,
	"failure_count" integer DEFAULT 0 NOT NULL,
	"created_by" varchar NOT NULL,
	"approved_by" varchar,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lomu_instructions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" text NOT NULL,
	"instruction" text NOT NULL,
	"scope" text DEFAULT 'global' NOT NULL,
	"conditions" jsonb,
	"priority" integer DEFAULT 5 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"example_behavior" text,
	"created_by" varchar NOT NULL,
	"approved_by" varchar,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lomu_jobs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"conversation_state" jsonb DEFAULT '[]'::jsonb,
	"last_iteration" integer DEFAULT 0 NOT NULL,
	"task_list_id" varchar,
	"error" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "lomu_knowledge" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"category" text NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"context" text,
	"solution" text,
	"tags" text[],
	"file_patterns" text[],
	"priority" integer DEFAULT 5 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"usage_count" integer DEFAULT 0 NOT NULL,
	"last_used_at" timestamp,
	"created_by" varchar,
	"approved_by" varchar,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lomu_memory" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" varchar,
	"memory_type" text NOT NULL,
	"content" text NOT NULL,
	"context" jsonb,
	"importance" integer DEFAULT 5 NOT NULL,
	"related_knowledge_ids" text[],
	"expires_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lomu_sessions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"pending_changes" jsonb DEFAULT '[]'::jsonb,
	"created_at" timestamp DEFAULT now(),
	"last_updated" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "maintenance_mode" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"enabled_by" varchar,
	"enabled_at" timestamp,
	"reason" text,
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "message_queue" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"project_id" varchar,
	"message" text NOT NULL,
	"priority" integer DEFAULT 5 NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"queued_at" timestamp DEFAULT now() NOT NULL,
	"started_at" timestamp,
	"completed_at" timestamp,
	"metadata" jsonb
);
--> statement-breakpoint
CREATE TABLE "monthly_usage" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"month" text NOT NULL,
	"ai_projects_count" integer DEFAULT 0 NOT NULL,
	"total_tokens" integer DEFAULT 0 NOT NULL,
	"total_ai_cost" numeric(10, 2) DEFAULT '0.00' NOT NULL,
	"storage_bytes_used" bigint DEFAULT 0 NOT NULL,
	"storage_cost" numeric(10, 2) DEFAULT '0.00' NOT NULL,
	"deployments_count" integer DEFAULT 0 NOT NULL,
	"deployment_visits" integer DEFAULT 0 NOT NULL,
	"deployment_cost" numeric(10, 2) DEFAULT '0.00' NOT NULL,
	"infra_cost" numeric(10, 2) DEFAULT '8.50' NOT NULL,
	"total_cost" numeric(10, 2) DEFAULT '8.50' NOT NULL,
	"plan_limit" numeric(10, 2) DEFAULT '0.00' NOT NULL,
	"overage" numeric(10, 2) DEFAULT '0.00' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "plan_sessions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"project_id" varchar,
	"title" text NOT NULL,
	"description" text,
	"status" text DEFAULT 'active' NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "plan_steps" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" varchar NOT NULL,
	"step_number" integer NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"estimated_time" integer,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "platform_audit_log" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"action" text NOT NULL,
	"description" text NOT NULL,
	"changes" jsonb,
	"backup_id" varchar,
	"commit_hash" varchar,
	"status" text NOT NULL,
	"error" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "platform_heal_attempts" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"incident_id" varchar NOT NULL,
	"session_id" varchar NOT NULL,
	"attempt_number" integer NOT NULL,
	"strategy" text NOT NULL,
	"actions_taken" jsonb,
	"files_modified" jsonb,
	"success" boolean DEFAULT false NOT NULL,
	"verification_passed" boolean,
	"error" text,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "platform_healing_sessions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"incident_id" varchar NOT NULL,
	"phase" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"diagnosis_notes" text,
	"proposed_fix" text,
	"files_changed" jsonb,
	"verification_results" jsonb,
	"verification_passed" boolean,
	"branch_name" varchar,
	"commit_hash" varchar,
	"deployment_id" varchar,
	"deployment_status" text,
	"deployment_url" text,
	"deployment_started_at" timestamp,
	"deployment_completed_at" timestamp,
	"tokens_used" integer DEFAULT 0,
	"model" varchar DEFAULT 'claude-sonnet-4-20250514',
	"started_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp,
	"error" text
);
--> statement-breakpoint
CREATE TABLE "platform_incident_playbooks" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"incident_type" text NOT NULL,
	"pattern" text NOT NULL,
	"fix_template" text NOT NULL,
	"confidence" numeric(3, 2) NOT NULL,
	"success_count" integer DEFAULT 0 NOT NULL,
	"failure_count" integer DEFAULT 0 NOT NULL,
	"last_used_at" timestamp,
	"learned_from" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "platform_incidents" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" text NOT NULL,
	"severity" text NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"source" text NOT NULL,
	"detected_at" timestamp DEFAULT now() NOT NULL,
	"resolved_at" timestamp,
	"status" text DEFAULT 'open' NOT NULL,
	"healing_session_id" varchar,
	"stack_trace" text,
	"affected_files" jsonb,
	"metrics" jsonb,
	"logs" text,
	"root_cause" text,
	"fix_description" text,
	"commit_hash" varchar,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"last_attempt_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "premium_fix_attempts" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"project_id" varchar NOT NULL,
	"error_signature" varchar(64) NOT NULL,
	"error_type" text NOT NULL,
	"error_description" text NOT NULL,
	"confidence_score" numeric(5, 2) NOT NULL,
	"diagnosis_notes" text,
	"proposed_fix" text,
	"sandbox_test_id" varchar,
	"sandbox_passed" boolean DEFAULT false NOT NULL,
	"stripe_payment_intent_id" text,
	"base_token_cost" numeric(10, 2) NOT NULL,
	"service_fee_percent" numeric(5, 2) DEFAULT '50.00' NOT NULL,
	"total_price" numeric(10, 2) NOT NULL,
	"payment_status" text DEFAULT 'pending' NOT NULL,
	"payment_captured_at" timestamp,
	"payment_refunded_at" timestamp,
	"status" text DEFAULT 'pending' NOT NULL,
	"phase" text DEFAULT 'diagnosis' NOT NULL,
	"health_monitoring_id" varchar,
	"health_check_passed" boolean,
	"commit_hash" varchar,
	"deployment_id" varchar,
	"deployment_url" text,
	"rolled_back" boolean DEFAULT false NOT NULL,
	"rollback_reason" text,
	"rollback_at" timestamp,
	"snapshot_before_fix" jsonb,
	"fix_summary" text,
	"issues_fixed" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"started_at" timestamp,
	"completed_at" timestamp,
	"error" text
);
--> statement-breakpoint
CREATE TABLE "pricing_config" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"resource_type" text NOT NULL,
	"provider_cost" numeric(10, 6) NOT NULL,
	"unit" text NOT NULL,
	"user_price" numeric(10, 6) NOT NULL,
	"margin_percent" numeric(5, 2) DEFAULT '90' NOT NULL,
	"description" text,
	"is_active" integer DEFAULT 1 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"updated_by" varchar,
	CONSTRAINT "pricing_config_resource_type_unique" UNIQUE("resource_type")
);
--> statement-breakpoint
CREATE TABLE "processed_stripe_events" (
	"id" varchar PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"processed_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_folders" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"name" text NOT NULL,
	"parent_id" varchar,
	"path" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_migrations" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"name" text NOT NULL,
	"filename" text NOT NULL,
	"sql" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"applied_at" timestamp,
	"rollback_sql" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_settings" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" varchar NOT NULL,
	"project_type" text DEFAULT 'webapp' NOT NULL,
	"framework" text,
	"build_command" text,
	"start_command" text,
	"test_command" text,
	"deployment_config" jsonb,
	"custom_settings" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "project_settings_project_id_unique" UNIQUE("project_id")
);
--> statement-breakpoint
CREATE TABLE "project_version_files" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"version_id" varchar NOT NULL,
	"path" text NOT NULL,
	"content" text NOT NULL,
	"language" text DEFAULT 'javascript' NOT NULL,
	"checksum" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_versions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"label" text NOT NULL,
	"description" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"template_id" varchar,
	"name" text NOT NULL,
	"description" text,
	"type" text DEFAULT 'webapp' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sandbox_test_results" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"fix_attempt_id" varchar NOT NULL,
	"test_type" text NOT NULL,
	"passed" boolean NOT NULL,
	"output" text,
	"error_message" text,
	"stack_trace" text,
	"files_affected" jsonb,
	"changes_applied" jsonb,
	"duration" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "satisfaction_surveys" (
	"id" varchar PRIMARY KEY NOT NULL,
	"user_id" varchar,
	"rating" integer NOT NULL,
	"category" varchar(50) NOT NULL,
	"feedback" text,
	"would_recommend" boolean,
	"feature_requests" text,
	"browser_info" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "service_messages" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" varchar NOT NULL,
	"sender_id" varchar NOT NULL,
	"sender_role" text NOT NULL,
	"message" text NOT NULL,
	"attachments" jsonb,
	"is_read" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "service_milestones" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" varchar NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"amount" numeric(10, 2) NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"is_paid" integer DEFAULT 0 NOT NULL,
	"stripe_payment_id" text,
	"paid_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "service_progress_logs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" varchar NOT NULL,
	"log_type" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"changed_by" varchar,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "service_requests" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"project_name" text NOT NULL,
	"project_type" text NOT NULL,
	"description" text NOT NULL,
	"specifications" jsonb,
	"quoted_price" numeric(10, 2) NOT NULL,
	"deposit_amount" numeric(10, 2) NOT NULL,
	"deposit_paid" integer DEFAULT 0 NOT NULL,
	"deposit_stripe_id" text,
	"final_payment_amount" numeric(10, 2),
	"final_payment_paid" integer DEFAULT 0 NOT NULL,
	"final_payment_stripe_id" text,
	"total_paid" numeric(10, 2) DEFAULT '0.00' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"priority" text DEFAULT 'normal' NOT NULL,
	"estimated_delivery" timestamp,
	"actual_delivery" timestamp,
	"assigned_to_admin_id" varchar,
	"preview_project_id" varchar,
	"preview_url" text,
	"export_ready" integer DEFAULT 0 NOT NULL,
	"exported_at" timestamp,
	"hosting_choice" text,
	"hosting_monthly_fee" numeric(10, 2),
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"sid" varchar PRIMARY KEY NOT NULL,
	"sess" jsonb NOT NULL,
	"expire" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sub_agents" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"project_id" varchar,
	"task_id" varchar,
	"agent_type" text NOT NULL,
	"task" text NOT NULL,
	"context" jsonb,
	"status" text DEFAULT 'running' NOT NULL,
	"result" text,
	"error" text,
	"tokens_used" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"plan" text DEFAULT 'free' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"stripe_customer_id" text,
	"stripe_subscription_id" text,
	"ai_credits_remaining" integer DEFAULT 5 NOT NULL,
	"current_period_start" timestamp DEFAULT now() NOT NULL,
	"current_period_end" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "subscriptions_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "support_ticket_messages" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ticket_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"message" text NOT NULL,
	"is_internal" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "support_tickets" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"subject" text NOT NULL,
	"description" text NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"priority" text DEFAULT 'normal' NOT NULL,
	"category" text DEFAULT 'general' NOT NULL,
	"assigned_to" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"resolved_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "task_lists" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"project_id" varchar,
	"chat_message_id" varchar,
	"title" text NOT NULL,
	"description" text,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "task_runners" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"project_id" varchar,
	"task_id" varchar,
	"runner_type" text NOT NULL,
	"status" text DEFAULT 'idle' NOT NULL,
	"current_step" text,
	"progress" integer DEFAULT 0,
	"tokens_used" integer DEFAULT 0,
	"started_at" timestamp,
	"completed_at" timestamp,
	"error" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task_list_id" varchar NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"architect_reviewed" text,
	"architect_review_reason" text,
	"sub_agent_id" varchar,
	"result" text,
	"error" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"started_at" timestamp,
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "team_invitations" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" varchar NOT NULL,
	"invited_email" varchar NOT NULL,
	"role" text DEFAULT 'viewer' NOT NULL,
	"invited_by" varchar NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"token" varchar NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "team_invitations_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "team_members" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"role" text DEFAULT 'viewer' NOT NULL,
	"joined_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "team_projects" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" varchar NOT NULL,
	"workspace_id" varchar NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "team_projects_project_id_unique" UNIQUE("project_id")
);
--> statement-breakpoint
CREATE TABLE "team_workspaces" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"owner_id" varchar NOT NULL,
	"description" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "template_files" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"template_id" varchar NOT NULL,
	"path" text NOT NULL,
	"content" text NOT NULL,
	"language" text DEFAULT 'javascript' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "template_purchases" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"template_id" varchar NOT NULL,
	"price" numeric(10, 2) NOT NULL,
	"platform_commission" numeric(10, 2) NOT NULL,
	"author_revenue" numeric(10, 2) NOT NULL,
	"stripe_payment_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "template_reviews" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"template_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"rating" integer NOT NULL,
	"title" text,
	"comment" text,
	"is_verified_purchase" integer DEFAULT 0 NOT NULL,
	"helpful_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "templates" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" varchar NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"category" text NOT NULL,
	"preview_url" text,
	"metadata" jsonb,
	"is_premium" integer DEFAULT 0 NOT NULL,
	"price" numeric(10, 2) DEFAULT '0.00' NOT NULL,
	"author_user_id" varchar,
	"sales_count" integer DEFAULT 0 NOT NULL,
	"revenue" numeric(10, 2) DEFAULT '0.00' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "templates_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "terminal_history" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"command" text NOT NULL,
	"output" text,
	"exit_code" integer,
	"executed_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "usage_logs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"project_id" varchar,
	"type" text NOT NULL,
	"input_tokens" integer DEFAULT 0 NOT NULL,
	"output_tokens" integer DEFAULT 0 NOT NULL,
	"total_tokens" integer DEFAULT 0 NOT NULL,
	"cost" numeric(10, 4) DEFAULT '0.0000' NOT NULL,
	"metadata" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_autonomy_settings" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"autonomy_level" text DEFAULT 'medium' NOT NULL,
	"auto_commit" boolean DEFAULT false NOT NULL,
	"auto_deploy" boolean DEFAULT false NOT NULL,
	"require_review" boolean DEFAULT true NOT NULL,
	"allow_sub_agents" boolean DEFAULT true NOT NULL,
	"max_concurrent_tasks" integer DEFAULT 3 NOT NULL,
	"auto_testing_enabled" boolean DEFAULT true NOT NULL,
	"preferences" jsonb,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_autonomy_settings_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "user_avatar_state" (
	"user_id" varchar PRIMARY KEY NOT NULL,
	"current_mood" varchar DEFAULT 'happy' NOT NULL,
	"last_mood_change" timestamp DEFAULT now() NOT NULL,
	"auto_mood_enabled" boolean DEFAULT true NOT NULL,
	"custom_message" text,
	"particle_preference" varchar DEFAULT 'auto' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar NOT NULL,
	"password" varchar,
	"first_name" varchar,
	"last_name" varchar,
	"profile_image_url" varchar,
	"role" varchar DEFAULT 'user' NOT NULL,
	"is_owner" boolean DEFAULT false NOT NULL,
	"autonomy_level" varchar(20) DEFAULT 'basic' NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "visual_edits" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"project_id" varchar NOT NULL,
	"file_id" varchar NOT NULL,
	"edit_type" text NOT NULL,
	"selector" text,
	"changes" jsonb NOT NULL,
	"generated_code" text,
	"applied" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workflow_runs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workflow_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"status" text DEFAULT 'running' NOT NULL,
	"current_step" integer DEFAULT 0,
	"total_steps" integer NOT NULL,
	"output" text,
	"error" text,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "workflows" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"project_id" varchar,
	"name" text NOT NULL,
	"description" text,
	"execution_mode" text DEFAULT 'parallel' NOT NULL,
	"steps" jsonb NOT NULL,
	"environment" jsonb,
	"is_template" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "idx_ai_fix_error_signature" ON "ai_fix_attempts" USING btree ("error_signature");--> statement-breakpoint
CREATE INDEX "idx_ai_fix_outcome" ON "ai_fix_attempts" USING btree ("outcome");--> statement-breakpoint
CREATE INDEX "idx_ai_fix_confidence" ON "ai_fix_attempts" USING btree ("confidence_score");--> statement-breakpoint
CREATE INDEX "idx_ai_knowledge_error_type" ON "ai_knowledge_base" USING btree ("error_type");--> statement-breakpoint
CREATE INDEX "idx_ai_knowledge_confidence" ON "ai_knowledge_base" USING btree ("confidence");--> statement-breakpoint
CREATE INDEX "idx_automation_runs_user" ON "automation_runs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_automation_runs_template" ON "automation_runs" USING btree ("template_id");--> statement-breakpoint
CREATE INDEX "idx_automation_templates_category" ON "automation_templates" USING btree ("category");--> statement-breakpoint
CREATE INDEX "idx_conversation_states_user_id" ON "conversation_states" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_conversation_states_project_id" ON "conversation_states" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "idx_conversation_states_last_updated" ON "conversation_states" USING btree ("last_updated");--> statement-breakpoint
CREATE INDEX "idx_design_prototypes_user" ON "design_prototypes" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_design_prototypes_project" ON "design_prototypes" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "idx_dynamic_intel_user" ON "dynamic_intelligence_sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_dynamic_intel_mode" ON "dynamic_intelligence_sessions" USING btree ("mode");--> statement-breakpoint
CREATE INDEX "idx_error_dedup_user_project" ON "error_signature_deduplication" USING btree ("user_id","project_id");--> statement-breakpoint
CREATE INDEX "idx_error_dedup_signature" ON "error_signature_deduplication" USING btree ("error_signature");--> statement-breakpoint
CREATE INDEX "idx_error_dedup_resolved" ON "error_signature_deduplication" USING btree ("resolved");--> statement-breakpoint
CREATE INDEX "idx_healing_conversations_target" ON "healing_conversations" USING btree ("target_id");--> statement-breakpoint
CREATE INDEX "idx_healing_conversations_user" ON "healing_conversations" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_healing_messages_conversation" ON "healing_messages" USING btree ("conversation_id");--> statement-breakpoint
CREATE INDEX "idx_healing_targets_user" ON "healing_targets" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_healing_targets_type" ON "healing_targets" USING btree ("type");--> statement-breakpoint
CREATE INDEX "idx_health_fix_attempt" ON "health_monitoring_records" USING btree ("fix_attempt_id");--> statement-breakpoint
CREATE INDEX "idx_health_overall" ON "health_monitoring_records" USING btree ("overall_health");--> statement-breakpoint
CREATE INDEX "idx_image_gen_user" ON "image_generations" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_image_gen_project" ON "image_generations" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "idx_sysop_tasks_user_id" ON "sysop_tasks" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_sysop_tasks_project_id" ON "sysop_tasks" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "idx_sysop_tasks_command_id" ON "sysop_tasks" USING btree ("command_id");--> statement-breakpoint
CREATE INDEX "idx_lomu_automation_trigger" ON "lomu_automation" USING btree ("trigger");--> statement-breakpoint
CREATE INDEX "idx_lomu_automation_active" ON "lomu_automation" USING btree ("active");--> statement-breakpoint
CREATE INDEX "idx_lomu_instructions_type" ON "lomu_instructions" USING btree ("type");--> statement-breakpoint
CREATE INDEX "idx_lomu_instructions_scope" ON "lomu_instructions" USING btree ("scope");--> statement-breakpoint
CREATE INDEX "idx_lomu_instructions_active" ON "lomu_instructions" USING btree ("active");--> statement-breakpoint
CREATE INDEX "idx_lomu_knowledge_category" ON "lomu_knowledge" USING btree ("category");--> statement-breakpoint
CREATE INDEX "idx_lomu_knowledge_active" ON "lomu_knowledge" USING btree ("active");--> statement-breakpoint
CREATE INDEX "idx_lomu_knowledge_priority" ON "lomu_knowledge" USING btree ("priority");--> statement-breakpoint
CREATE INDEX "idx_lomu_memory_session" ON "lomu_memory" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "idx_lomu_memory_type" ON "lomu_memory" USING btree ("memory_type");--> statement-breakpoint
CREATE INDEX "idx_lomu_memory_importance" ON "lomu_memory" USING btree ("importance");--> statement-breakpoint
CREATE INDEX "idx_message_queue_user" ON "message_queue" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_message_queue_status" ON "message_queue" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_plan_sessions_user" ON "plan_sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_plan_sessions_project" ON "plan_sessions" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "idx_plan_steps_session" ON "plan_steps" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "idx_premium_fix_user" ON "premium_fix_attempts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_premium_fix_project" ON "premium_fix_attempts" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "idx_premium_fix_error_sig" ON "premium_fix_attempts" USING btree ("error_signature");--> statement-breakpoint
CREATE INDEX "idx_premium_fix_status" ON "premium_fix_attempts" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_premium_fix_payment" ON "premium_fix_attempts" USING btree ("payment_status");--> statement-breakpoint
CREATE INDEX "idx_project_settings_project" ON "project_settings" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "idx_project_settings_type" ON "project_settings" USING btree ("project_type");--> statement-breakpoint
CREATE INDEX "idx_sandbox_fix_attempt" ON "sandbox_test_results" USING btree ("fix_attempt_id");--> statement-breakpoint
CREATE INDEX "idx_sandbox_test_type" ON "sandbox_test_results" USING btree ("test_type");--> statement-breakpoint
CREATE INDEX "satisfaction_user_id_idx" ON "satisfaction_surveys" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "satisfaction_category_idx" ON "satisfaction_surveys" USING btree ("category");--> statement-breakpoint
CREATE INDEX "satisfaction_created_at_idx" ON "satisfaction_surveys" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "IDX_session_expire" ON "sessions" USING btree ("expire");--> statement-breakpoint
CREATE INDEX "idx_task_runner_user" ON "task_runners" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_task_runner_status" ON "task_runners" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_visual_edits_project" ON "visual_edits" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "idx_visual_edits_file" ON "visual_edits" USING btree ("file_id");--> statement-breakpoint
CREATE INDEX "idx_workflow_runs_workflow" ON "workflow_runs" USING btree ("workflow_id");--> statement-breakpoint
CREATE INDEX "idx_workflow_runs_user" ON "workflow_runs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_workflows_user" ON "workflows" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_workflows_project" ON "workflows" USING btree ("project_id");