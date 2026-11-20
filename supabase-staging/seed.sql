-- Synthetic, deterministic staging fixtures only. Never point this file at production.
insert into public.companies (id,name,email,status,subscription_tier,admin_invite_status)
values
 ('00000000-0000-4000-8000-000000000001','Staging Tenant Alpha','admin-alpha@example.test','Active','Staging','not_sent'),
 ('00000000-0000-4000-8000-000000000002','Staging Tenant Beta','admin-beta@example.test','Active','Staging','not_sent')
on conflict (id) do update set
 name=excluded.name,email=excluded.email,status=excluded.status,
 subscription_tier=excluded.subscription_tier,admin_invite_status=excluded.admin_invite_status;

insert into public.clients (id,client_name,contact_person,phone_number,email,company_id)
values
 ('10000000-0000-4000-8000-000000000001','Alpha Test Client','Alpha Contact','+2348000000001','alpha-client@example.test','00000000-0000-4000-8000-000000000001'),
 ('10000000-0000-4000-8000-000000000002','Beta Test Client','Beta Contact','+2348000000002','beta-client@example.test','00000000-0000-4000-8000-000000000002')
on conflict (id) do update set
 client_name=excluded.client_name,contact_person=excluded.contact_person,
 phone_number=excluded.phone_number,email=excluded.email,company_id=excluded.company_id;

insert into public.shipments
 (id,awb_number,client_id,sender_details,receiver_details,weight,origin,destination,
  commodity_type,payment_status,current_status,shipment_type,service_type,company_id)
values
 ('20000000-0000-4000-8000-000000000001','STG-ALPHA-0001','10000000-0000-4000-8000-000000000001',
  'Staging Alpha Sender','Staging Alpha Receiver',12.5,'LOS','LHR','General Cargo','Pending','Registered','Export','DDP',
  '00000000-0000-4000-8000-000000000001'),
 ('20000000-0000-4000-8000-000000000002','STG-BETA-0001','10000000-0000-4000-8000-000000000002',
  'Staging Beta Sender','Staging Beta Receiver',8.0,'LOS','DXB','General Cargo','Pending','Registered','Export','DDP',
  '00000000-0000-4000-8000-000000000002')
on conflict (id) do update set
 awb_number=excluded.awb_number,client_id=excluded.client_id,
 sender_details=excluded.sender_details,receiver_details=excluded.receiver_details,
 weight=excluded.weight,origin=excluded.origin,destination=excluded.destination,
 commodity_type=excluded.commodity_type,payment_status=excluded.payment_status,
 current_status=excluded.current_status,shipment_type=excluded.shipment_type,
 service_type=excluded.service_type,company_id=excluded.company_id;
