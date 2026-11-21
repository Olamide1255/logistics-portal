DROP POLICY IF EXISTS storage_select_company_logo ON storage.objects;

CREATE POLICY storage_select_company_logo
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'shipment-documents'
  AND (storage.foldername(name))[1] = private.get_my_company_id()::text
  AND (
    (storage.foldername(name))[2] = 'company-logo'
    OR (
      (storage.foldername(name))[2] IS NULL
      AND storage.filename(name) LIKE 'logo-%'
    )
  )
);