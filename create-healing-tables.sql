-- Create healing tables with correct UUID schema
-- This runs after drop-old-tables.js to ensure clean creation

-- Platform Incidents (detection system)
CREATE TABLE IF NOT EXISTS platform_incidents (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::VARCHAR,
  type VARCHAR NOT NULL,
  source VARCHAR NOT NULL,
  severity VARCHAR NOT NULL,
  description TEXT NOT NULL,
  detected_at TIMESTAMP NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMP,
  user_id VARCHAR,
  metadata JSONB DEFAULT '{}'::JSONB
);

-- AI Fix Attempts (healing attempts tracking)
CREATE TABLE IF NOT EXISTS ai_fix_attempts (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::VARCHAR,
  incident_id VARCHAR NOT NULL REFERENCES platform_incidents(id) ON DELETE CASCADE,
  session_id VARCHAR,
  attempt_number INTEGER NOT NULL,
  approach VARCHAR NOT NULL,
  actions JSONB DEFAULT '[]'::JSONB,
  result VARCHAR,
  verified BOOLEAN DEFAULT FALSE,
  deployed BOOLEAN DEFAULT FALSE,
  commit_hash VARCHAR,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMP
);

-- Healing Targets (manual chat targets)
CREATE TABLE IF NOT EXISTS healing_targets (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::VARCHAR,
  name VARCHAR NOT NULL,
  description TEXT,
  category VARCHAR NOT NULL,
  priority INTEGER DEFAULT 1,
  enabled BOOLEAN DEFAULT TRUE,
  config JSONB DEFAULT '{}'::JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Platform Healing Sessions (chat sessions)
CREATE TABLE IF NOT EXISTS platform_healing_sessions (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::VARCHAR,
  target_id VARCHAR REFERENCES healing_targets(id) ON DELETE SET NULL,
  user_id VARCHAR NOT NULL,
  title VARCHAR NOT NULL,
  status VARCHAR NOT NULL DEFAULT 'active',
  metadata JSONB DEFAULT '{}'::JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Platform Heal Attempts (linked to sessions)
CREATE TABLE IF NOT EXISTS platform_heal_attempts (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::VARCHAR,
  incident_id VARCHAR REFERENCES platform_incidents(id) ON DELETE CASCADE,
  session_id VARCHAR NOT NULL REFERENCES platform_healing_sessions(id) ON DELETE CASCADE,
  attempt_number INTEGER NOT NULL,
  approach VARCHAR NOT NULL,
  actions JSONB DEFAULT '[]'::JSONB,
  result VARCHAR,
  verified BOOLEAN DEFAULT FALSE,
  deployed BOOLEAN DEFAULT FALSE,
  commit_hash VARCHAR,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMP
);

-- Insert default healing target for Platform Code
INSERT INTO healing_targets (id, name, description, category, priority, enabled)
VALUES (
  gen_random_uuid()::VARCHAR,
  '🔧 Platform Code',
  'Modify LomuAI platform source code, fix bugs, and add features',
  'platform',
  1,
  true
) ON CONFLICT (id) DO NOTHING;
