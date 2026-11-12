\set ON_ERROR_STOP on
-- 0019: signing with only an email, and the error log
reset role;
update public.petitions set status = 'live' where title like 'Protected seas%';
insert into auth.users values ('45454545-4545-4545-4545-454545454545', 'Dora@x.io', now()) on conflict do nothing;
insert into public.profiles (id) values ('45454545-4545-4545-4545-454545454545') on conflict do nothing;
select set_config('t.pid', (select id::text from public.petitions where title like 'Protected seas%'), false);
select set_config('t.tok', encode(digest('secret-link-1', 'sha256'), 'hex'), false);

-- 1. guests and accounts cannot touch email signatures or call the server-only steps
set role anon;
do $$ begin perform 1 from public.email_signatures; raise exception 'anon read email signatures';
exception when insufficient_privilege then null; end $$;
do $$ begin perform public.email_sign_request(current_setting('t.pid')::uuid, 'x@y.io', current_setting('t.tok'), 'en', 'v1'); raise exception 'anon requested';
exception when insufficient_privilege then null; end $$;
do $$ begin perform public.email_sign_confirm(current_setting('t.tok')); raise exception 'anon confirmed';
exception when insufficient_privilege then null; end $$;
set role authenticated;
select set_config('request.jwt.claim.sub','22222222-2222-2222-2222-222222222222', false);
do $$ begin perform 1 from public.email_signatures; raise exception 'user read email signatures';
exception when insufficient_privilege then null; end $$;
do $$ begin perform private.email_hash('a@x.io'); raise exception 'user hashed';
exception when insufficient_privilege then null; end $$;

-- 2. request, wait, confirm; the email itself is never stored
set role service_role;
do $$ declare before bigint := (select signatures from public.petition_stats where id = current_setting('t.pid')::uuid); r text;
begin
  if public.email_sign_request(current_setting('t.pid')::uuid, 'not-an-email', current_setting('t.tok'), 'en', 'v1') <> 'bad_email' then raise exception 'bad email accepted'; end if;
  r := public.email_sign_request(current_setting('t.pid')::uuid, ' Dora@X.io ', current_setting('t.tok'), 'hu', 'v1-hu', 'hu', null, '10.0.0.1');
  if r <> 'sent' then raise exception 'request: %', r; end if;
  if exists (select 1 from public.email_signatures where email_hash ilike '%dora%' or token_hash = 'secret-link-1') then raise exception 'email stored'; end if;
  if (select signatures from public.petition_stats where id = current_setting('t.pid')::uuid) <> before then raise exception 'counted before confirming'; end if;
  if public.email_sign_request(current_setting('t.pid')::uuid, 'dora@x.io', encode(digest('secret-link-2', 'sha256'), 'hex'), 'en', 'v1') <> 'wait' then raise exception 'no resend wait'; end if;
  if (public.email_sign_lookup(current_setting('t.tok'))->>'confirmed')::boolean then raise exception 'lookup confirmed it'; end if;
  if public.email_sign_confirm(current_setting('t.tok'))->>'status' <> 'confirmed' then raise exception 'not confirmed'; end if;
  if public.email_sign_confirm(current_setting('t.tok'))->>'status' <> 'confirmed' then raise exception 'second press failed'; end if;
  if (select signatures from public.petition_stats where id = current_setting('t.pid')::uuid) <> before + 1 then raise exception 'not counted once'; end if;
  if (select country from public.email_signatures where token_hash = current_setting('t.tok')) <> 'HU' then raise exception 'country lost'; end if;
  if (select ip_hash from public.email_signatures where token_hash = current_setting('t.tok')) is not null then raise exception 'ip kept'; end if;
  if public.email_sign_request(current_setting('t.pid')::uuid, 'DORA@x.io', encode(digest('secret-link-3', 'sha256'), 'hex'), 'en', 'v1') <> 'already' then raise exception 'signed twice'; end if;
  if public.email_sign_confirm('nope')->>'status' <> 'unknown' then raise exception 'any link works'; end if;
end $$;

-- 3. limits: 10 a day per email, 20 an hour per connection, site-wide cap
do $$ declare i int; r text;
begin
  for i in 1..12 loop
    insert into public.petitions (organiser_name, title, target, region, ask, why, topic, goal, origin, status)
    values ('Limits (test)', 'Limit petition number ' || i, 'Someone', 'Here', 'Please do this specific thing now.', 'Because it is needed here.', 'climate', 1000, 'unite', 'live');
  end loop;
  for i in 1..10 loop
    r := public.email_sign_request((select id from public.petitions where title = 'Limit petition number ' || i), 'busy@x.io', encode(digest('l' || i, 'sha256'), 'hex'), 'en', 'v1');
    if r <> 'sent' then raise exception 'limit hit early at %: %', i, r; end if;
  end loop;
  if public.email_sign_request((select id from public.petitions where title = 'Limit petition number 11'), 'busy@x.io', encode(digest('l11', 'sha256'), 'hex'), 'en', 'v1') <> 'daily_limit_reached' then raise exception 'no daily limit'; end if;
  for i in 1..20 loop
    perform public.email_sign_request((select id from public.petitions where title = 'Limit petition number 12'), 'ip' || i || '@x.io', encode(digest('ip' || i, 'sha256'), 'hex'), 'en', 'v1', null, null, '10.9.9.9');
  end loop;
  if public.email_sign_request((select id from public.petitions where title = 'Limit petition number 12'), 'ip21@x.io', encode(digest('ip21', 'sha256'), 'hex'), 'en', 'v1', null, null, '10.9.9.9') <> 'busy' then raise exception 'no ip limit'; end if;
  if public.email_sign_request((select id from public.petitions where title = 'Limit petition number 12'), 'cap@x.io', encode(digest('cap', 'sha256'), 'hex'), 'en', 'v1', null, null, null, 5) <> 'busy' then raise exception 'no site cap'; end if;
end $$;

-- 4. signing in with that email moves the signature into the account, counted once
set role authenticated;
select set_config('request.jwt.claim.sub','45454545-4545-4545-4545-454545454545', false);
do $$ declare before bigint := (select signatures from public.petition_stats where id = current_setting('t.pid')::uuid);
begin
  if public.claim_email_signatures() <> 1 then raise exception 'not claimed'; end if;
  if not exists (select 1 from public.signatures where user_id = auth.uid() and petition_id = current_setting('t.pid')::uuid) then raise exception 'not in account'; end if;
  if (select signatures from public.petition_stats where id = current_setting('t.pid')::uuid) <> before then raise exception 'count changed on claim'; end if;
end $$;
reset role;
do $$ begin if not public.has_signature_consent('45454545-4545-4545-4545-454545454545') then raise exception 'consent not carried'; end if; end $$;

-- 5. an account signing what it signed by email counts once; withdrawing by link removes it
reset role;
insert into public.consents (user_id, kind, text_version) values ('11111111-1111-1111-1111-111111111111', 'signatures', 'v1');
set role service_role;
select public.email_sign_request((select id from public.petitions where title = 'Limit petition number 12'), 'A@x.io', encode(digest('dup', 'sha256'), 'hex'), 'en', 'v1');
select public.email_sign_confirm(encode(digest('dup', 'sha256'), 'hex'));
reset role;
insert into public.signatures (user_id, petition_id) values ('11111111-1111-1111-1111-111111111111', (select id from public.petitions where title = 'Limit petition number 12'));
do $$ begin if exists (select 1 from public.email_signatures where token_hash = encode(digest('dup', 'sha256'), 'hex')) then raise exception 'double counted'; end if; end $$;
set role service_role;
select public.email_sign_request((select id from public.petitions where title = 'Limit petition number 12'), 'wd@x.io', encode(digest('wd', 'sha256'), 'hex'), 'en', 'v1');
select public.email_sign_confirm(encode(digest('wd', 'sha256'), 'hex'));
-- the report and the organiser dashboard count email signatures
do $$ begin if (public.petition_report((select id from public.petitions where title = 'Limit petition number 12'))->>'verified')::int < 2 then raise exception 'report misses email signatures'; end if; end $$;
do $$ begin if public.email_sign_withdraw(encode(digest('wd', 'sha256'), 'hex')) is null then raise exception 'withdraw failed'; end if;
  if public.email_sign_lookup(encode(digest('wd', 'sha256'), 'hex')) is not null then raise exception 'still there'; end if; end $$;

-- 6. error log: first time alerts, repeats wait 6 hours, only moderators read it
do $$ begin
  if not public.log_error('fp1', 'server', 'Boom', '/p/1') then raise exception 'first not alerted'; end if;
  if public.log_error('fp1', 'server', 'Boom', '/p/1') then raise exception 'repeat alerted'; end if;
  if (select count from public.error_events where fingerprint = 'fp1') <> 2 then raise exception 'not counted'; end if;
end $$;
set role authenticated;
select set_config('request.jwt.claim.sub','22222222-2222-2222-2222-222222222222', false);
do $$ begin if exists (select 1 from public.error_events) then raise exception 'non-moderator reads errors'; end if; end $$;
do $$ begin perform public.log_error('x', 'server', 'fake'); raise exception 'user logged';
exception when insufficient_privilege then null; end $$;
reset role;
select 'email signing tests passed';
