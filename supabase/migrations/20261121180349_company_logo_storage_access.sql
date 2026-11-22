DROP POLICY IF EXISTS storage_select_company_logo ON storage.objects;
DROP POLICY IF EXISTS storage_insert_company_logo ON storage.objects;
DROP POLICY IF EXISTS storage_delete_company_logo ON storage.objects;

CREATE POLICY storage_select_company_logo
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'shipment-documents'
  AND (storage.foldername(name))[1] = private.get_my_company_id()::text
  AND private.get_my_role() = 'Super Admin'
  AND (
    (storage.foldername(name))[2] = 'company-logo'
    OR (
      (storage.foldername(name))[2] IS NULL
      AND storage.filename(name) LIKE 'logo-%'
    )
  )
);

CREATE POLICY storage_insert_company_logo
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'shipment-documents'
  AND (storage.foldername(name))[1] = private.get_my_company_id()::text
  AND (storage.foldername(name))[2] = 'company-logo'
  AND private.get_my_role() = 'Super Admin'
  AND storage.filename(name) LIKE 'logo-%'
  AND storage.extension(name) IN ('png', 'jpg')
);

CREATE POLICY storage_delete_company_logo
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'shipment-documents'
  AND (storage.foldername(name))[1] = private.get_my_company_id()::text
  AND private.get_my_role() = 'Super Admin'
  AND (
    (storage.foldername(name))[2] = 'company-logo'
    OR (
      (storage.foldername(name))[2] IS NULL
      AND storage.filename(name) LIKE 'logo-%'
    )
  )
);