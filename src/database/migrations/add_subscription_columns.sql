-- Migration: Add subscription columns to users table
-- Run this script to add Stripe subscription support

-- Add subscription-related columns to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS subscription_plan VARCHAR(50) DEFAULT 'free',
ADD COLUMN IF NOT EXISTS subscription_status VARCHAR(50) DEFAULT 'inactive',
ADD COLUMN IF NOT EXISTS stripe_customer_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS stripe_subscription_id VARCHAR(255);

-- Update existing users to have the default values
UPDATE users 
SET subscription_plan = 'free',
    subscription_status = 'inactive'
WHERE subscription_plan IS NULL OR subscription_status IS NULL;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_subscription_plan ON users(subscription_plan);
CREATE INDEX IF NOT EXISTS idx_users_subscription_status ON users(subscription_status);
CREATE INDEX IF NOT EXISTS idx_users_stripe_customer_id ON users(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_users_stripe_subscription_id ON users(stripe_subscription_id);

-- Add constraints
ALTER TABLE users 
ADD CONSTRAINT check_subscription_plan 
CHECK (subscription_plan IN ('free', 'basic', 'pro', 'enterprise'));

ALTER TABLE users 
ADD CONSTRAINT check_subscription_status 
CHECK (subscription_status IN ('inactive', 'active', 'canceled', 'past_due', 'unpaid'));

-- Update storage limits based on subscription plans
-- Free: 5GB, Basic: 100GB, Pro: 1TB, Enterprise: 5TB
UPDATE users 
SET storage_limit = CASE 
    WHEN subscription_plan = 'free' THEN 5 * 1024 * 1024 * 1024
    WHEN subscription_plan = 'basic' THEN 100 * 1024 * 1024 * 1024
    WHEN subscription_plan = 'pro' THEN 1024 * 1024 * 1024 * 1024
    WHEN subscription_plan = 'enterprise' THEN 5 * 1024 * 1024 * 1024 * 1024
    ELSE 5 * 1024 * 1024 * 1024
END
WHERE subscription_plan IS NOT NULL;

-- Verify the migration
SELECT 
    column_name, 
    data_type, 
    is_nullable, 
    column_default
FROM information_schema.columns 
WHERE table_name = 'users' 
AND column_name IN ('subscription_plan', 'subscription_status', 'stripe_customer_id', 'stripe_subscription_id')
ORDER BY column_name;
