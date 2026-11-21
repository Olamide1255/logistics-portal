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
  -- Trusted server-side operations may use the service role.
  if actor_id is null then
    if current_setting('request.jwt.claim.role', true) = 'service_role' then
      return new;
    end if;
    raise exception 'Shipment attachments require an authenticated actor'
      using errcode = '42501';
  end if;

  actor_company_id := private.get_my_company_id();
  actor_role := private.get_my_role();

  select p.email
    into actor_email
  from public.profiles p
  where p.id = actor_id
    and p.company_id = actor_company_id;

  if actor_company_id is null or actor_role is null or actor_email is null then
    raise exception 'An active company profile is required to add shipment attachments'
      using errcode = '42501';
  end if;

  if new.shipment_id is null then
    raise exception 'A shipment is required for this record'
      using errcode = '23502';
  end if;

  select s.company_id
    into shipment_company_id
  from public.shipments s
  where s.id = new.shipment_id;

  if not found or shipment_company_id is distinct from actor_company_id then
    raise exception 'The shipment does not belong to the authenticated actor company'
      using errcode = '42501';
  end if;

  if tg_table_name = 'shipment_comments' then
    if length(btrim(coalesce(new.comment_text, ''))) = 0
       or length(new.comment_text) > 2000 then
      raise exception 'Comments must contain 1 to 2000 characters'
        using errcode = '22001';
    end if;

    new.updated_by_role := actor_role;
    new.action_by_name := actor_email;
  elsif tg_table_name = 'shipment_documents' then
    if length(btrim(coalesce(new.file_name, ''))) = 0
       or length(new.file_name) > 255
       or length(btrim(coalesce(new.file_url, ''))) = 0 then
      raise exception 'A valid document name and file reference are required'
        using errcode = '22001';
    end if;

    if new.file_path is not null and (
      split_part(new.file_path, '/', 1) <> actor_company_id::text
      or new.file_path ~ '(^|/)\.\.?(/|$)'
    ) then
      raise exception 'Document storage paths must remain inside the actor company folder'
        using errcode = '42501';
    end if;

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

revoke all on function private.enforce_shipment_attachment_integrity() from public, anon, authenticated;

drop trigger if exists enforce_shipment_comment_integrity on public.shipment_comments;
create trigger enforce_shipment_comment_integrity
before insert on public.shipment_comments
for each row execute function private.enforce_shipment_attachment_integrity();

drop trigger if exists enforce_shipment_document_integrity on public.shipment_documents;
create trigger enforce_shipment_document_integrity
before insert on public.shipment_documents
for each row execute function private.enforce_shipment_attachment_integrity();
