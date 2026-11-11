-- UNIER starter petitions. Run once in the Supabase SQL Editor.
-- They arrive as "pending": open /moderate on the site, read each one, and Approve the ones you want live.
-- Edit any wording here before running. Titles 10-90 characters; goal must be 1000, 10000, 50000, 100000, 250000, 500000 or 1000000.

insert into public.petitions (organiser_name, title, target, region, ask, why, topic, goal, status) values
 ('UNIER team', 'Free tap water for every customer in cafés and restaurants', 'National governments and city councils', 'Europe',
  'Every café, bar and restaurant should give customers a glass of tap water for free when they ask, as France and Spain already require.',
  'Drinking water is a basic need. Having to buy bottled water hits people on low incomes hardest and adds to plastic waste.', 'health', 10000, 'pending'),
 ('UNIER team', 'Clean the plastic out of the Tisza river', 'Hungarian, Romanian and Ukrainian water authorities', 'Hungary, Romania, Ukraine',
  'Install floating barriers at the main waste hotspots on the Tisza and its tributaries, fund regular clean-ups, and publish how much waste is removed each year.',
  'Every flood carries plastic bottles and bags down the Tisza. Volunteers pull out huge amounts every year, but they cannot keep up alone.', 'climate', 10000, 'pending'),
 ('UNIER team', 'Shade, water and paid breaks for outdoor workers in heatwaves', 'Labour ministries', 'Worldwide',
  'Above 32°C, outdoor workers must get shade, drinking water and paid rest breaks. Above 38°C they must be able to stop work without losing pay.',
  'Heatwaves are getting longer and hotter. Builders, couriers and farm workers are the first to get ill, and many cannot afford to stop.', 'labour', 50000, 'pending'),
 ('UNIER team', 'Affordable rooms for students in every university city', 'Education ministries and city councils', 'Europe',
  'Build and renovate public student housing so a room costs no more than a third of an average student budget, and publish waiting lists openly.',
  'Rents in university cities have risen far faster than grants and part-time wages. Students now choose where to study by what they can afford.', 'housing', 10000, 'pending'),
 ('UNIER team', 'Put every public contract online, in full', 'National governments', 'Worldwide',
  'Publish every public contract above €10,000 online, in full and free to search, within 30 days of signing.',
  'Public money belongs to the public. When contracts are hidden, nobody can check whether the price was fair or who really benefited.', 'digital', 10000, 'pending'),
 ('UNIER team', 'Free period products in every school', 'Education ministries', 'Worldwide',
  'Provide free pads and tampons in school toilets, paid for from the national education budget.',
  'Many students miss school because they cannot afford period products. Scotland already provides them for free. Others can too.', 'health', 10000, 'pending'),
 ('UNIER team', 'Join the High Seas Treaty and protect the open ocean', 'Governments that have not ratified it yet', 'Worldwide',
  'Every country should ratify the UN High Seas Treaty and back new protected areas in international waters.',
  'Two thirds of the ocean lies outside any country''s borders and has almost no protection. The treaty creates the tools to change that, but only if countries join.', 'oceans', 100000, 'pending');

-- Make yourself a moderator so you can approve them (put your own login email here):
update public.profiles set is_moderator = true where id = (select id from auth.users where email = 'YOUR-EMAIL@EXAMPLE.COM');
