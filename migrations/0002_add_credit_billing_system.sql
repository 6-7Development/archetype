-- Migration: Add Credit Billing System
-- Date: 2025-11-06
-- Description: Adds credit wallets, ledger, agent runs, and updates users/monthly_usage for credit-based billing

-- ============================================================================
-- 1. Update users table - Add billing fields
-- ============================================================================

ALTER TABLE users 
ADD COLUMN IF NOT EXISTS billing_status TEXT NOT NULL DEFAULT 'trial',
ADD COLUMN IF NOT EXISTS default_payment_method_id VARCHAR;

COMMENT ON COLUMN users.billing_status IS 'User billing status: trial, trial_grace, active, suspended';
COMMENT ON COLUMN users.default_payment_method_id IS 'Stripe payment method ID for automatic billing';

-- ============================================================================
-- 2. Update monthly_usage table - Add credits consumed tracking
-- ============================================================================

ALTER TABLE monthly_usage 
ADD COLUMN IF NOT EXISTS credits_consumed INTEGER NOT NULL DEFAULT 0;

COMMENT ON COLUMN monthly_usage.credits_consumed IS 'Total credits consumed during this month';

-- ============================================================================
-- 3. Create credit_wallets table - One wallet per user
-- ============================================================================

CREATE TABLE IF NOT EXISTS credit_wallets (
  user_id VARCHAR PRIMARY KEY,
  available_credits INTEGER NOT NULL DEFAULT 0,
  reserved_credits INTEGER NOT NULL DEFAULT 0,
  last_top_up_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

COMMENT ON TABLE credit_wallets IS 'Credit wallet for each user - tracks available and reserved credits';
COMMENT ON COLUMN credit_wallets.user_id IS 'One wallet per user (foreign key to users.id)';
COMMENT ON COLUMN credit_wallets.available_credits IS 'Credits ready to use for AI operations';
COMMENT ON COLUMN credit_wallets.reserved_credits IS 'Credits reserved for active agent runs';
COMMENT ON COLUMN credit_wallets.last_top_up_at IS 'Timestamp of last credit purchase';

-- ============================================================================
-- 4. Create credit_ledger table - Transaction log for all credit movements
-- ============================================================================

CREATE TABLE IF NOT EXISTS credit_ledger (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR NOT NULL,
  delta_credits INTEGER NOT NULL,
  usd_amount NUMERIC(10, 4),
  source TEXT NOT NULL,
  reference_id VARCHAR,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

COMMENT ON TABLE credit_ledger IS 'Immutable transaction log for all credit movements';
COMMENT ON COLUMN credit_ledger.delta_credits IS 'Credit change: positive for additions, negative for consumption';
COMMENT ON COLUMN credit_ledger.usd_amount IS 'Dollar amount for purchases (null for consumption)';
COMMENT ON COLUMN credit_ledger.source IS 'Transaction source: monthly_allocation, purchase, lomu_chat, architect_consultation, refund, adjustment';
COMMENT ON COLUMN credit_ledger.reference_id IS 'Link to related record (usage log, stripe payment, etc.)';
COMMENT ON COLUMN credit_ledger.metadata IS 'Additional metadata: owner_exempt, package, model, etc.';

-- Create indexes for credit_ledger
CREATE INDEX IF NOT EXISTS idx_credit_ledger_user_id ON credit_ledger(user_id);
CREATE INDEX IF NOT EXISTS idx_credit_ledger_source ON credit_ledger(source);
CREATE INDEX IF NOT EXISTS idx_credit_ledger_created_at ON credit_ledger(created_at);

-- ============================================================================
-- 5. Create agent_runs table - Track agent execution state for pause/resume
-- ============================================================================

CREATE TABLE IF NOT EXISTS agent_runs (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR NOT NULL,
  project_id VARCHAR,
  status TEXT NOT NULL,
  credits_reserved INTEGER NOT NULL DEFAULT 0,
  credits_consumed INTEGER NOT NULL DEFAULT 0,
  context JSONB,
  paused_at TIMESTAMP,
  resumed_at TIMESTAMP,
  completed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

COMMENT ON TABLE agent_runs IS 'Track agent execution state for pause/resume functionality';
COMMENT ON COLUMN agent_runs.user_id IS 'User who initiated the agent run';
COMMENT ON COLUMN agent_runs.project_id IS 'Project being worked on (null for platform healing)';
COMMENT ON COLUMN agent_runs.status IS 'Run status: running, paused, locked, completed, failed';
COMMENT ON COLUMN agent_runs.credits_reserved IS 'Credits held for this run (returned if cancelled)';
COMMENT ON COLUMN agent_runs.credits_consumed IS 'Actual credits used so far';
COMMENT ON COLUMN agent_runs.context IS 'Serialized state: messages, taskState, filesTouched, streamPosition';

-- Create indexes for agent_runs
CREATE INDEX IF NOT EXISTS idx_agent_runs_user_id ON agent_runs(user_id);
CREATE INDEX IF NOT EXISTS idx_agent_runs_project_id ON agent_runs(project_id);
CREATE INDEX IF NOT EXISTS idx_agent_runs_status ON agent_runs(status);
CREATE INDEX IF NOT EXISTS idx_agent_runs_created_at ON agent_runs(created_at);

-- ============================================================================
-- 6. Add foreign key constraints (optional - for data integrity)
-- ============================================================================

-- Note: Foreign keys are optional in this schema. Uncomment if you want strict referential integrity.
-- ALTER TABLE credit_wallets ADD CONSTRAINT fk_credit_wallets_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
-- ALTER TABLE credit_ledger ADD CONSTRAINT fk_credit_ledger_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
-- ALTER TABLE agent_runs ADD CONSTRAINT fk_agent_runs_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
-- ALTER TABLE agent_runs ADD CONSTRAINT fk_agent_runs_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL;

-- ============================================================================
-- 7. Insert initial credit wallet for existing users
-- ============================================================================

-- Create credit wallets for all existing users (with 0 credits)
INSERT INTO credit_wallets (user_id, available_credits, reserved_credits, created_at, updated_at)
SELECT id, 0, 0, NOW(), NOW()
FROM users
ON CONFLICT (user_id) DO NOTHING;

-- ============================================================================
-- Migration complete
-- ============================================================================
