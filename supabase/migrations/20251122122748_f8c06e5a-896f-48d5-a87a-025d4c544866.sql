-- Add verified column to passes table
ALTER TABLE passes ADD COLUMN verified boolean DEFAULT true;

-- Create index for faster duplicate checks
CREATE INDEX idx_passes_buss_pass_id ON passes(buss_pass_id) WHERE buss_pass_id IS NOT NULL;