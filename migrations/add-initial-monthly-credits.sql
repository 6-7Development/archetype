-- Migration: Add initialMonthlyCredits to credit_wallets table
-- This field stores the user's monthly credit allowance based on their subscription tier
-- Used for calculating percentage-based billing warnings

ALTER TABLE credit_wallets 
ADD COLUMN IF NOT EXISTS initial_monthly_credits INTEGER NOT NULL DEFAULT 5000;

-- Update existing wallets with default value (5000 credits)
-- This ensures existing users have a baseline for percentage calculations
UPDATE credit_wallets 
SET initial_monthly_credits = 5000 
WHERE initial_monthly_credits IS NULL;

-- Add comment for documentation
COMMENT ON COLUMN credit_wallets.initial_monthly_credits IS 'User monthly credit allowance based on subscription tier (Free=50, Starter=250, Pro=750, Business=2000, Enterprise=6000)';
