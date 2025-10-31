-- Create premium auto-fix tables with EXACT schema from shared/schema.ts
-- Run this to add the premium one-click fix system tables

-- Premium Fix Attempts - Track paid one-click fix service
CREATE TABLE IF NOT EXISTS premium_fix_attempts (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::VARCHAR,
  user_id VARCHAR NOT NULL,
  project_id VARCHAR NOT NULL,
  
  -- Error identification (prevent double-charging)
  error_signature VARCHAR(64) NOT NULL,
  error_type TEXT NOT NULL,
  error_description TEXT NOT NULL,
  
  -- Confidence and diagnosis
  confidence_score DECIMAL(5, 2) NOT NULL,
  diagnosis_notes TEXT,
  proposed_fix TEXT,
  
  -- Sandbox testing
  sandbox_test_id VARCHAR,
  sandbox_passed BOOLEAN NOT NULL DEFAULT FALSE,
  
  -- Payment tracking (Stripe)
  stripe_payment_intent_id TEXT,
  base_token_cost DECIMAL(10, 2) NOT NULL,
  service_fee_percent DECIMAL(5, 2) NOT NULL DEFAULT 50.00,
  total_price DECIMAL(10, 2) NOT NULL,
  payment_status TEXT NOT NULL DEFAULT 'pending',
  payment_captured_at TIMESTAMP,
  payment_refunded_at TIMESTAMP,
  
  -- Execution tracking
  status TEXT NOT NULL DEFAULT 'pending',
  phase TEXT NOT NULL DEFAULT 'diagnosis',
  
  -- Health monitoring
  health_monitoring_id VARCHAR,
  health_check_passed BOOLEAN,
  
  -- Git/Deploy tracking
  commit_hash VARCHAR,
  deployment_id VARCHAR,
  deployment_url TEXT,
  
  -- Rollback tracking
  rolled_back BOOLEAN NOT NULL DEFAULT FALSE,
  rollback_reason TEXT,
  rollback_at TIMESTAMP,
  snapshot_before_fix JSONB,
  
  -- Summary for user
  fix_summary TEXT,
  issues_fixed JSONB,
  
  -- Timestamps
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  
  -- Error tracking
  error TEXT
);

CREATE INDEX IF NOT EXISTS idx_premium_fix_user ON premium_fix_attempts(user_id);
CREATE INDEX IF NOT EXISTS idx_premium_fix_project ON premium_fix_attempts(project_id);
CREATE INDEX IF NOT EXISTS idx_premium_fix_error_sig ON premium_fix_attempts(error_signature);
CREATE INDEX IF NOT EXISTS idx_premium_fix_status ON premium_fix_attempts(status);
CREATE INDEX IF NOT EXISTS idx_premium_fix_payment ON premium_fix_attempts(payment_status);

-- Sandbox Test Results - Isolated testing before applying fixes
CREATE TABLE IF NOT EXISTS sandbox_test_results (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::VARCHAR,
  fix_attempt_id VARCHAR NOT NULL,
  
  -- Test execution
  test_type TEXT NOT NULL,
  passed BOOLEAN NOT NULL,
  
  -- Results
  output TEXT,
  error_message TEXT,
  stack_trace TEXT,
  
  -- Files tested
  files_affected JSONB,
  changes_applied JSONB,
  
  -- Performance
  duration INTEGER,
  
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sandbox_fix_attempt ON sandbox_test_results(fix_attempt_id);
CREATE INDEX IF NOT EXISTS idx_sandbox_test_type ON sandbox_test_results(test_type);

-- Health Monitoring Records - Post-fix health tracking for 5 minutes
CREATE TABLE IF NOT EXISTS health_monitoring_records (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::VARCHAR,
  fix_attempt_id VARCHAR NOT NULL,
  
  -- Monitoring window
  started_at TIMESTAMP NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMP,
  monitoring_duration INTEGER NOT NULL DEFAULT 300,
  
  -- Health checks performed
  checks_performed INTEGER NOT NULL DEFAULT 0,
  checks_passed_count INTEGER NOT NULL DEFAULT 0,
  checks_failed_count INTEGER NOT NULL DEFAULT 0,
  
  -- Overall status
  overall_health TEXT NOT NULL DEFAULT 'monitoring',
  final_status TEXT,
  
  -- Detailed checks
  health_checks JSONB DEFAULT '[]'::JSONB,
  
  -- Failure details
  failure_reason TEXT,
  failure_details JSONB,
  
  -- Action taken
  action_taken TEXT,
  
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_health_fix_attempt ON health_monitoring_records(fix_attempt_id);
CREATE INDEX IF NOT EXISTS idx_health_overall ON health_monitoring_records(overall_health);

-- Error Signature Deduplication - Prevent charging twice for same error
CREATE TABLE IF NOT EXISTS error_signature_deduplication (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::VARCHAR,
  user_id VARCHAR NOT NULL,
  project_id VARCHAR NOT NULL,
  
  -- Error signature (MD5 hash)
  error_signature VARCHAR(64) NOT NULL,
  error_type TEXT NOT NULL,
  error_message TEXT NOT NULL,
  
  -- Fix tracking
  first_attempt_id VARCHAR NOT NULL,
  last_attempt_id VARCHAR NOT NULL,
  total_attempts INTEGER NOT NULL DEFAULT 1,
  successful_attempts INTEGER NOT NULL DEFAULT 0,
  
  -- Payment tracking (prevent double-charging)
  total_charged DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  last_charged_at TIMESTAMP,
  
  -- Resolution status
  resolved BOOLEAN NOT NULL DEFAULT FALSE,
  resolved_at TIMESTAMP,
  resolved_by VARCHAR,
  
  -- Learning
  confidence DECIMAL(5, 2) NOT NULL DEFAULT 0.00,
  
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_error_dedup_user_project ON error_signature_deduplication(user_id, project_id);
CREATE INDEX IF NOT EXISTS idx_error_dedup_signature ON error_signature_deduplication(error_signature);
CREATE INDEX IF NOT EXISTS idx_error_dedup_resolved ON error_signature_deduplication(resolved);

-- Success message
SELECT 'Premium Auto-Fix tables created successfully!' AS message;
