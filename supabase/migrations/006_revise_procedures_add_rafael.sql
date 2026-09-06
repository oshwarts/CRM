-- keep only joint-replacement procedures
delete from public.procedures;
insert into public.procedures (name, category, is_mako) values
  ('החלפת ברך – MAKO', 'knee', true),
  ('החלפת ירך – MAKO', 'hip', true),
  ('החלפת ברך חלקית (יוני) – MAKO', 'knee', true),
  ('החלפת ברך ידנית', 'knee', false),
  ('החלפת ירך ידנית', 'hip', false),
  ('רוויזיית ברך', 'knee', false),
  ('רוויזיית ירך', 'hip', false),
  ('GMRS', 'other', false);

insert into public.hospitals (name, city, sector, lat, lng)
select 'רפאל מדיקל סנטר', 'בני ברק', 'private', 32.0810, 34.8290
where not exists (select 1 from public.hospitals where name = 'רפאל מדיקל סנטר');
