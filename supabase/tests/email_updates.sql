\set ON_ERROR_STOP on
-- 0027: email updates for email signers (opt-in, encrypted, one-click stop, removed with the signature)
reset role;
insert into public.petitions (organiser_name, title, target, region, ask, why, topic, goal, origin, status)
values ('Updates (test)', 'Email updates test petition', 'Someone', 'Here', 'Please do this specific thing now.', 'Because it is needed here.', 'climate', 1000, 'unite', 'live');
select set_config('t.up', (select id::text from public.petitions where title = 'Email updates test petition'), false);

-- 1. nobody but the server can opt in, read addresses or stop someone else's emails
set role anon;
do $$ begin perform public.email_sign_notify('x', 'x@y.io', repeat('k', 40)); raise exception 'anon opted in';
exception when insufficient_privilege then null; end $$;
do $$ begin perform public.mail_batch(1, 10); raise exception 'anon read addresses';
exception when insufficient_privilege then null; end $$;
do $$ begin perform public.email_unsubscribe(repeat('k', 40)); raise exception 'anon unsubscribed';
exception when insufficient_privilege then null; end $$;
set role authenticated;
select set_config('request.jwt.claim.sub','22222222-2222-2222-2222-222222222222', false);
do $$ begin perform public.claim_mail_events(5); raise exception 'user claimed mail events';
exception when insufficient_privilege then null; end $$;
do $$ begin perform 1 from public.mail_sent; raise exception 'user read mail_sent';
exception when insufficient_privilege then null; end $$;
do $$ begin perform private.mail_key(); raise exception 'user read the key';
exception when insufficient_privilege then null; end $$;

-- 2. three signers: one opts in, one does not, one opts in but never confirms
set role service_role;
do $$ declare pid uuid := current_setting('t.up')::uuid;
begin
  perform public.email_sign_request(pid, 'Yes@x.io', encode(digest('up-yes', 'sha256'), 'hex'), 'hu', 'v1');
  perform public.email_sign_request(pid, 'no@x.io', encode(digest('up-no', 'sha256'), 'hex'), 'en', 'v1');
  perform public.email_sign_request(pid, 'later@x.io', encode(digest('up-later', 'sha256'), 'hex'), 'en', 'v1');
  if public.email_sign_notify(encode(digest('up-yes', 'sha256'), 'hex'), 'other@x.io', repeat('a', 40)) then raise exception 'opted in a different address'; end if;
  if public.email_sign_notify(encode(digest('up-yes', 'sha256'), 'hex'), 'yes@x.io', 'short') then raise exception 'weak key accepted'; end if;
  if not public.email_sign_notify(encode(digest('up-yes', 'sha256'), 'hex'), ' YES@x.io', repeat('a', 40)) then raise exception 'opt-in failed'; end if;
  if not public.email_sign_notify(encode(digest('up-later', 'sha256'), 'hex'), 'later@x.io', repeat('c', 40)) then raise exception 'opt-in failed (later)'; end if;
  if exists (select 1 from public.email_signatures e where e::text ilike '%yes@x.io%') then raise exception 'address stored in clear'; end if;
  perform public.email_sign_confirm(encode(digest('up-yes', 'sha256'), 'hex'));
  perform public.email_sign_confirm(encode(digest('up-no', 'sha256'), 'hex'));
  if public.email_sign_notify(encode(digest('up-no', 'sha256'), 'hex'), 'no@x.io', repeat('b', 40)) then raise exception 'opted in after confirming'; end if;
end $$;

-- 3. an event reaches only the confirmed signer who opted in, once
reset role;
insert into public.push_events (petition_id, kind, title, created_at) values (current_setting('t.up')::uuid, 'delivered', 'Handed over', now() - interval '1 minute');
set role service_role;
do $$ declare ev bigint; r record; n int := 0;
begin
  select id into ev from public.claim_mail_events(20) where petition_id = current_setting('t.up')::uuid;
  if ev is null then raise exception 'event not offered'; end if;
  for r in select * from public.mail_batch(ev, 50) loop
    n := n + 1;
    if r.email <> 'yes@x.io' or r.lang <> 'hu' or r.notify_key <> repeat('a', 40) then raise exception 'wrong target %', r; end if;
  end loop;
  if n <> 1 then raise exception 'expected 1 target, got %', n; end if;
  if exists (select 1 from public.mail_batch(ev, 50)) then raise exception 'sent twice'; end if;
  perform public.finish_mail_event(ev);
  if exists (select 1 from public.claim_mail_events(20) where id = ev) then raise exception 'event offered again'; end if;
end $$;

-- 4. small news goes at most every 3 days; big news always
reset role;
insert into public.push_events (petition_id, kind, title, created_at) values (current_setting('t.up')::uuid, 'milestone', 'A note', now() - interval '1 minute');
insert into public.push_events (petition_id, kind, created_at) values (current_setting('t.up')::uuid, 'win', now() - interval '1 minute');
set role service_role;
do $$ declare small bigint; big bigint;
begin
  select id into small from public.push_events where petition_id = current_setting('t.up')::uuid and kind = 'milestone';
  select id into big from public.push_events where petition_id = current_setting('t.up')::uuid and kind = 'win';
  if exists (select 1 from public.mail_batch(small, 50)) then raise exception 'small news too soon'; end if;
  if (select count(*) from public.mail_batch(big, 50)) <> 1 then raise exception 'big news not sent'; end if;
end $$;

-- 5. the daily limit
do $$ begin
  if public.mail_quota(10, 0) <> 10 then raise exception 'quota start'; end if;
  if public.mail_quota(10, 7) <> 3 then raise exception 'quota count'; end if;
  if public.mail_quota(10, 9) <> 0 then raise exception 'quota floor'; end if;
end $$;

-- 6. one click stops it and forgets the address; withdrawing removes everything
do $$ begin
  if public.email_unsubscribe_lookup(repeat('a', 40))->>'title' <> 'Email updates test petition' then raise exception 'lookup'; end if;
  if public.email_unsubscribe(repeat('a', 40)) <> current_setting('t.up')::uuid then raise exception 'stop failed'; end if;
  if exists (select 1 from public.email_signatures where notify_key = repeat('a', 40) or (petition_id = current_setting('t.up')::uuid and notify_email is not null and confirmed_at is not null)) then raise exception 'address kept after stop'; end if;
  if (select count(*) from public.email_signatures where petition_id = current_setting('t.up')::uuid and confirmed_at is not null) <> 2 then raise exception 'stop removed the signature'; end if;
  if public.email_unsubscribe(repeat('a', 40)) is not null then raise exception 'stop link works twice'; end if;
end $$;

-- 7. unconfirmed opt-ins are forgotten after 3 days; a taken-down petition forgets its addresses
reset role;
update public.email_signatures set created_at = now() - interval '4 days' where token_hash = encode(digest('up-later', 'sha256'), 'hex');
set role service_role;
do $$ begin
  perform public.claim_mail_events(1);
  if exists (select 1 from public.email_signatures where notify_key = repeat('c', 40)) then raise exception 'unconfirmed address kept'; end if;
end $$;
reset role;
