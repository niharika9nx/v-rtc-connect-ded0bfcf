-- Add user_response column to track yes/no responses to alerts
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS user_response TEXT;

-- Add index for faster queries
CREATE INDEX IF NOT EXISTS idx_alerts_user_response ON alerts(user_response, type, status);