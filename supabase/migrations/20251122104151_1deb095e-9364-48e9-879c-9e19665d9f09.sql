-- Make the route bucket public so all users can view route images
UPDATE storage.buckets 
SET public = true 
WHERE id = 'route';