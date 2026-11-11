-- Sample content for local development only. Do not run in production.
insert into public.clusters (id, label) values
  ('00000000-0000-0000-0000-0000000000c1', 'Facial recognition'),
  ('00000000-0000-0000-0000-0000000000c2', 'Bottom trawling');

insert into public.petitions (organiser_name, title, target, region, ask, why, topic, goal, cluster_id, origin, imported_count, status) values
 ('Blue Line coalition (sample)', 'End bottom trawling in marine protected areas', 'Fisheries ministers', 'European Union',
  'Ban bottom trawling inside every marine protected area, with satellite tracking for all large vessels.', 'Protected areas that allow trawling are lines on a map. The seabed takes decades to recover.', 'oceans', 1000000, '00000000-0000-0000-0000-0000000000c2', 'unite', 389002, 'live'),
 ('Sea Watchers (sample)', 'Protected seas must mean protected', 'Fisheries ministers', 'European Union',
  'Close the loopholes that allow industrial fishing in protected seas.', 'Industrial fishing still happens inside most protected areas in Europe.', 'oceans', 250000, '00000000-0000-0000-0000-0000000000c2', 'imported', 120455, 'live'),
 ('Open Streets group (sample)', 'Ban live facial recognition in public spaces', 'Interior and transport ministries', 'European Union',
  'No live face scanning of people in streets, stations or squares. Any trial must be approved by a public vote first.', 'Cameras were switched on at stations without any public debate.', 'digital', 500000, '00000000-0000-0000-0000-0000000000c1', 'unite', 212400, 'live'),
 ('Riders United (sample)', 'Sick pay for platform delivery workers', 'Labour ministries', 'Worldwide',
  'Delivery apps must pay riders when they are sick, the same as any other employer.', 'Riders work through illness because a day off means no income.', 'labour', 250000, null, 'unite', 131552, 'live');
