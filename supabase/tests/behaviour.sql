\set ON_ERROR_STOP on
grant usage on schema public, auth to authenticated;
grant all on all tables in schema public to authenticated;
grant all on all sequences in schema public to authenticated;
grant select on auth.users to authenticated;
insert into auth.users values ('11111111-1111-1111-1111-111111111111','a@x.io', now()), ('22222222-2222-2222-2222-222222222222','b@x.io', now()), ('33333333-3333-3333-3333-333333333333','c@x.io', null);
set role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111', false);
-- signing without consent fails
do $$ begin perform public.sign_petition((select id from public.petitions where title like 'Sick pay%')); raise exception 'should have failed'; exception when others then if sqlerrm <> 'consent_required' then raise; end if; end $$;
select public.give_signature_consent('v1');
select public.sign_petition((select id from public.petitions where title like 'End bottom%'), 'Seas matter', true) as combined_after_sign;
-- user A can see own signature
select count(*) as own_visible from public.signatures;
-- founder-less petition: A signed trawl, so A may post a video for it, but not for sick pay
insert into public.videos (petition_id, uploader_id, storage_path, caption, trim_end) values ((select id from public.petitions where title like 'End bottom%'), '11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111/a.mp4', 'Trawlers in the reserve', 30);
do $$ begin insert into public.videos (petition_id, uploader_id, storage_path, caption, trim_end) values ((select id from public.petitions where title like 'Sick pay%'), '11111111-1111-1111-1111-111111111111', 'x/b.mp4', 'Not signed yet', 30); raise exception 'should have failed'; exception when insufficient_privilege then null; end $$;
-- user B cannot read A's signatures
select set_config('request.jwt.claim.sub','22222222-2222-2222-2222-222222222222', false);
select count(*) as others_visible from public.signatures;
-- pending video invisible to B
select count(*) as pending_visible_to_other from public.videos;
-- unconfirmed email cannot sign
select set_config('request.jwt.claim.sub','33333333-3333-3333-3333-333333333333', false);
do $$ begin perform public.give_signature_consent('v1'); perform public.sign_petition((select id from public.petitions where title like 'Sick pay%')); raise exception 'should have failed'; exception when others then if sqlerrm <> 'email_not_confirmed' then raise; end if; end $$;
-- daily limit
select set_config('request.jwt.claim.sub','22222222-2222-2222-2222-222222222222', false);
select public.give_signature_consent('v1');
reset role;
insert into public.petitions (organiser_name,title,target,region,ask,why,topic,goal,status)
select 'Test org','Test petition number '||g,'Someone','Hungary','A specific ask that is long enough.','A reason that is long enough to pass.','health',1000,'live' from generate_series(1,11) g;
set role authenticated;
do $$ declare r record; n int := 0; begin
  for r in select id from public.petitions where title like 'Test petition%' order by title loop
    begin perform public.sign_petition(r.id); n := n + 1; exception when others then if sqlerrm <> 'daily_limit_reached' then raise; end if; end;
  end loop; if n <> 10 then raise exception 'expected 10 signatures, got %', n; end if; end $$;
-- revoke consent deletes signatures
select public.revoke_signature_consent();
select count(*) as after_revoke from public.signatures;
reset role;
select p.title, st.signatures, st.combined, st.united_count from public.petition_stats st join public.petitions p using (id) where p.cluster_id is not null order by 1;
