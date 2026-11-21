create or replace function private.enforce_shipment_attachment_integrity()
returns trigger
language plpgsql
security definer
set search_path to pg_catalog, public, private, storage
as $function$
declare
  actor_id uuid := auth.uid();
  actor_company_id uuid;
  actor_role text;
  actor_email text;
  shipment_company_id uuid;
begin
  if actor_id is null then
    if current_setting('request.jwt.claim.role', true) = 'service_role' then
      return new;
    end if;
    raise exception 'Shipment attachments require an authenticated actor'
      using errcode = '42501';
  end if;

  actor_company_id := private.get_my_company_id();
  actor_role := private.get_my_role();

  select p.email into actor_email
  from public.profiles p
  where p.id = actor_id and p.company_id = actor_company_id;

  if actor_company_id is null or actor_role is null or actor_email is null then
    raise exception 'An active company profile is required to add shipment attachments'
      using errcode = '42501';
  end if;

  if new.shipment_id is null then
    raise exception 'A shipment is required for this record'
      using errcode = '23502';
  end if;

  select s.company_id into shipment_company_id
  from public.shipments s where s.id = new.shipment_id;

  if not found or shipment_company_id is distinct from actor_company_id then
    raise exception 'The shipment does not belong to the authenticated actor company'
      using errcode = '42501';
  end if;

  if tg_table_name = 'shipment_comments' then
    if length(btrim(coalesce(new.comment_text, ''))) = 0 or length(new.comment_text) > 2000 then
      raise exception 'Comments must contain 1 to 2000 characters'
        using errcode = '22001';
    end if;
    new.updated_by_role := actor_role;
    new.action_by_name := actor_email;
  elsif tg_table_name = 'shipment_documents' then
    if length(btrim(coalesce(new.file_name, ''))) = 0
       or length(new.file_name) > 255
       or new.file_path is null
       or length(new.file_path) > 1024 then
      raise exception 'A valid document name and private storage path are required'
        using errcode = '22001';
    end if;

    if split_part(new.file_path, '/', 1) <> actor_company_id::text
       or split_part(new.file_path, '/', 2) <> new.shipment_id::text
       or split_part(new.file_path, '/', 3) = ''
       or new.file_path ~ '(^|/)\.\.?(/|$)'
       or new.file_path ~ '^[A-Za-z][A-Za-z0-9+.-]*:' then
      raise exception 'Document storage paths must remain inside the shipment folder'
        using errcode = '42501';
    end if;

    -- The database stores only the private object key, never an arbitrary external URL.
    new.file_url := new.file_path;
    new.uploaded_by := actor_email;
  else
    raise exception 'Unsupported shipment attachment table'
      using errcode = '22023';
  end if;

  new.company_id := actor_company_id;
  new.created_at := now();
  return new;
end;
$function$;

-- Permit tenant cleanup of orphaned uploads, but never deletion of an object
-- already referenced by a shipment document. The platform-admin policy remains.
drop policy if exists storage_delete_own_company_orphan on storage.objects;
create policy storage_delete_own_company_orphan
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'shipment-documents'
  and (storage.foldername(name))[1] = private.get_my_company_id()::text
  and not exists (
    select 1
    from public.shipment_documents d
    where d.company_id = private.get_my_company_id()
      and (d.file_path = storage.objects.name or d.file_url = storage.objects.name)
  )
);
