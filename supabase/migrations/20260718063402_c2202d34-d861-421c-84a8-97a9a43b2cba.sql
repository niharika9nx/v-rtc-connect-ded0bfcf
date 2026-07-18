
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can subscribe to their own topic" ON realtime.messages;
CREATE POLICY "Users can subscribe to their own topic"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  realtime.topic() = 'user:' || (SELECT auth.uid())::text
);

DROP POLICY IF EXISTS "Users can broadcast to their own topic" ON realtime.messages;
CREATE POLICY "Users can broadcast to their own topic"
ON realtime.messages
FOR INSERT
TO authenticated
WITH CHECK (
  realtime.topic() = 'user:' || (SELECT auth.uid())::text
);
