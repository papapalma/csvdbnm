-- Add level column to programs table
-- This column stores the skill level required for the training program

ALTER TABLE programs 
ADD COLUMN IF NOT EXISTS level VARCHAR(50) 
CHECK (level IN ('Beginner', 'Intermediate', 'Advanced', 'All Levels'));

-- Add comment for documentation
COMMENT ON COLUMN programs.level IS 'Skill level required for the training program';
