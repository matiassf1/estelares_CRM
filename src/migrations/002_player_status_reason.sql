-- Add status reason to player_registrations
ALTER TABLE player_registrations
  ADD COLUMN IF NOT EXISTS status_reason TEXT;
