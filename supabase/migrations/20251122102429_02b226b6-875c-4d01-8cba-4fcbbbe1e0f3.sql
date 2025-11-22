-- Create storage bucket for pass documents
INSERT INTO storage.buckets (id, name, public)
VALUES ('pass-documents', 'pass-documents', true);

-- Create RLS policies for pass documents bucket
CREATE POLICY "Users can upload their own pass documents"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'pass-documents' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can view their own pass documents"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'pass-documents' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can update their own pass documents"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'pass-documents' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete their own pass documents"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'pass-documents' AND
  auth.uid()::text = (storage.foldername(name))[1]
);