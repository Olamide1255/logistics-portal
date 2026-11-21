-- Restrict new shipment uploads to a real tenant-owned shipment folder.
drop policy if exists storage_insert_own_company on storage.objects;
create policy storage_insert_own_company
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'shipment-documents'
  and (storage.foldername(name))[1] = private.get_my_company_id()::text
  and (storage.foldername(name))[2] is not null
  and (storage.foldername(name))[3] is not null
  and exists (
    select 1
    from public.shipments s
    where s.id::text = (storage.foldername(name))[2]
      and s.company_id = private.get_my_company_id()
  )
);

-- Preserve the referenced-file guard for both canonical object keys and legacy
-- Supabase Storage URLs stored before attachment metadata was normalized.
drop policy if exists storage_delete_own_company_orphan on storage.objects;
create policy storage_delete_own_company_orphan
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'shipment-documents'
  and (storage.foldername(name))[1] = private.get_my_company_id()::text
  and (storage.foldername(name))[2] is not null
  and exists (
    select 1
    from public.shipments s
    where s.id::text = (storage.foldername(name))[2]
      and s.company_id = private.get_my_company_id()
  )
  and not exists (
    select 1
    from public.shipment_documents d
    where d.company_id = private.get_my_company_id()
      and (
        d.file_path = storage.objects.name
        or d.file_url = storage.objects.name
        or replace(
          regexp_replace(split_part(d.file_url, '/shipment-documents/', 2), '[?#].*$', ''),
          '%20',
          ' '
        ) = storage.objects.name
      )
  )
);
