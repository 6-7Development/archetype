-- Create healing tables with EXACT schema from shared/schema.ts
-- This runs after drop-old-tables.js to ensure clean creation

-- Platform Incidents (detection system)
CREATE TABLE IF NOT EXISTS platform_incidents (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::VARCHAR,
  
  -- Incident details
  type TEXT NOT NULL,
  severity TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  
  -- Detection metadata
  source TEXT NOT NULL,
  detected_at TIMESTAMP NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMP,
  
  -- Status tracking
  status TEXT NOT NULL DEFAULT 'open',
  
  -- Healing session link
  healing_session_id VARCHAR,
  
  -- Metadata for diagnosis
  stack_trace TEXT,
  affected_files JSONB,
  metrics JSONB,
  logs TEXT,
  
  -- Resolution tracking
  root_cause TEXT,
  fix_description TEXT,
  commit_hash VARCHAR,
  
  -- Retry tracking
  attempt_count INTEGER NOT NULL DEFAULT 0,
  last_attempt_at TIMESTAMP,
  
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Platform Healing Sessions (ongoing healing processes)
CREATE TABLE IF NOT EXISTS platform_healing_sessions (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Link to incident
  incident_id VARCHAR NOT NULL,
  
  -- Session metadata
  phase TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  
  -- Diagnosis data
  diagnosis_notes TEXT,
  proposed_fix TEXT,
  
  -- Files changed
  files_changed JSONB,
  
  -- Verification results
  verification_results JSONB,
  verification_passed BOOLEAN,
  
  -- Git/Deploy tracking
  branch_name VARCHAR,
  commit_hash VARCHAR,
  deployment_id VARCHAR,
  deployment_status TEXT,
  deployment_url TEXT,
  deployment_started_at TIMESTAMP,
  deployment_completed_at TIMESTAMP,
  
  -- AI metadata
  tokens_used INTEGER DEFAULT 0,
  model VARCHAR DEFAULT 'claude-sonnet-4-20250514',
  
  -- Timestamps
  started_at TIMESTAMP NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMP,
  
  -- Error tracking
  error TEXT
);

-- Platform Heal Attempts (individual fix attempts)
CREATE TABLE IF NOT EXISTS platform_heal_attempts (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::VARCHAR,
  
  -- Links
  incident_id VARCHAR NOT NULL,
  session_id VARCHAR NOT NULL,
  
  -- Attempt details
  attempt_number INTEGER NOT NULL,
  strategy TEXT NOT NULL,
  
  -- What was tried
  actions_taken JSONB,
  files_modified JSONB,
  
  -- Results
  success BOOLEAN NOT NULL DEFAULT FALSE,
  verification_passed BOOLEAN,
  error TEXT,
  
  -- Timestamps
  started_at TIMESTAMP NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMP
);

-- AI Fix Attempts (learning/debugging)
CREATE TABLE IF NOT EXISTS ai_fix_attempts (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::VARCHAR,
  
  -- Links
  error_signature VARCHAR(64) NOT NULL,
  healing_session_id VARCHAR,
  
  -- The proposed fix
  proposed_fix TEXT NOT NULL,
  confidence_score DECIMAL(5, 2) NOT NULL,
  outcome TEXT NOT NULL,
  verification_results JSONB,
  
  -- PR tracking
  pr_number INTEGER,
  pr_url TEXT,
  auto_merged BOOLEAN DEFAULT FALSE,
  
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ai_fix_error_signature ON ai_fix_attempts(error_signature);
CREATE INDEX IF NOT EXISTS idx_ai_fix_outcome ON ai_fix_attempts(outcome);
CREATE INDEX IF NOT EXISTS idx_ai_fix_confidence ON ai_fix_attempts(confidence_score);

-- Healing Targets (what can be healed)
CREATE TABLE IF NOT EXISTS healing_targets (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::VARCHAR,
  user_id VARCHAR NOT NULL,
  type TEXT NOT NULL,
  name TEXT NOT NULL,
  project_id VARCHAR,
  customer_id VARCHAR,
  railway_project_id TEXT,
  repository_url TEXT,
  last_synced_at TIMESTAMP,
  status TEXT NOT NULL DEFAULT 'active',
  metadata JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_healing_targets_user ON healing_targets(user_id);
CREATE INDEX IF NOT EXISTS idx_healing_targets_type ON healing_targets(type);

-- Insert default healing target for Platform Code
INSERT INTO healing_targets (id, user_id, type, name, status, metadata)
VALUES (
  gen_random_uuid()::VARCHAR,
  'system',
  'platform',
  '🔧 Platform Code',
  'active',
  '{"description": "Modify LomuAI platform source code, fix bugs, and add features"}'::JSONB
) ON CONFLICT (id) DO NOTHING;

-- Healing Conversations (persistent chat sessions for manual healing)
CREATE TABLE IF NOT EXISTS healing_conversations (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::VARCHAR,
  target_id VARCHAR NOT NULL,
  user_id VARCHAR NOT NULL,
  title TEXT NOT NULL DEFAULT 'New Healing Session',
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_healing_conversations_target ON healing_conversations(target_id);
CREATE INDEX IF NOT EXISTS idx_healing_conversations_user ON healing_conversations(user_id);

-- Healing Messages (chat history for manual healing)
CREATE TABLE IF NOT EXISTS healing_messages (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::VARCHAR,
  conversation_id VARCHAR NOT NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_healing_messages_conversation ON healing_messages(conversation_id);

-- Platform Incident Playbooks (learned patterns for automated fixes)
CREATE TABLE IF NOT EXISTS platform_incident_playbooks (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::VARCHAR,
  incident_type TEXT NOT NULL,
  pattern TEXT NOT NULL,
  fix_template TEXT NOT NULL,
  confidence DECIMAL(3, 2) NOT NULL,
  success_count INTEGER NOT NULL DEFAULT 0,
  failure_count INTEGER NOT NULL DEFAULT 0,
  last_used_at TIMESTAMP,
  learned_from VARCHAR,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- AI Knowledge Base (learn from past fixes to improve auto-healing)
CREATE TABLE IF NOT EXISTS ai_knowledge_base (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::VARCHAR,
  error_signature VARCHAR(64) NOT NULL UNIQUE,
  error_type TEXT NOT NULL,
  context JSONB,
  successful_fix TEXT NOT NULL,
  confidence_score DECIMAL(5, 2) NOT NULL,
  times_applied INTEGER NOT NULL DEFAULT 0,
  success_rate DECIMAL(5, 2) NOT NULL DEFAULT 0.00,
  tags TEXT[],
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  last_applied_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ai_knowledge_error_signature ON ai_knowledge_base(error_signature);
CREATE INDEX IF NOT EXISTS idx_ai_knowledge_error_type ON ai_knowledge_base(error_type);
