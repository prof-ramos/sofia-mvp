-- Add user_id columns to existing tables
ALTER TABLE "resources" ADD COLUMN "user_id" uuid;
ALTER TABLE "embeddings" ADD COLUMN "user_id" uuid;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS "idx_resources_user_id" ON "resources" ("user_id");
CREATE INDEX IF NOT EXISTS "idx_embeddings_user_id" ON "embeddings" ("user_id");

-- Enable Row Level Security
ALTER TABLE "resources" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "embeddings" ENABLE ROW LEVEL SECURITY;

-- RLS Policies for resources
CREATE POLICY "Users can view own resources"
  ON "resources"
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own resources"
  ON "resources"
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own resources"
  ON "resources"
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own resources"
  ON "resources"
  FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for embeddings
CREATE POLICY "Users can view own embeddings"
  ON "embeddings"
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own embeddings"
  ON "embeddings"
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own embeddings"
  ON "embeddings"
  FOR DELETE
  USING (auth.uid() = user_id);
