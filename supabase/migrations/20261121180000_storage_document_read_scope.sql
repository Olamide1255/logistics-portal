-- Restrict private document reads to a real shipment folder in the actor's tenant.
drop policy if exists storage_select_own_company on storage.objects;
create policy storage_select_own_company
on storage.objects
for select
to authenticated
using (
  bucket_id = 'shipment-documents'
  and (storage.foldername(name))[1] = private.get_my_company_id()::text
  and (storage.foldername(name))[2] is not null
  and exists (
    select 1 from public.shipments s
    where s.id::text = (storage.foldername(name))[2]
      and s.company_id = private.get_my_company_id()
  )
);
