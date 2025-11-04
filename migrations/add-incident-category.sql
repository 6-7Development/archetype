
-- Add incident_category and is_agent_failure columns to platform_incidents table
ALTER TABLE platform_incidents 
ADD COLUMN IF NOT EXISTS incident_category VARCHAR,
ADD COLUMN IF NOT EXISTS is_agent_failure BOOLEAN DEFAULT false;

-- Update source column to allow 'agent_monitor'
-- (No ALTER needed - VARCHAR already supports this value)
