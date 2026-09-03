insert into public.companies (name) values
  ('Ami Technologies'),
  ('CPM'),
  ('Johnson')
on conflict (name) do nothing;

insert into public.procedures (name, category, is_mako) values
  ('החלפת ברך מלאה – MAKO (TKA)', 'knee', true),
  ('החלפת ברך חלקית / יוני – MAKO (PKA)', 'knee', true),
  ('החלפת מפרק ירך – MAKO (THA)', 'hip', true),
  ('החלפת ברך מלאה – קונבנציונלי', 'knee', false),
  ('החלפת מפרק ירך – גישה קדמית', 'hip', false),
  ('החלפת מפרק ירך – גישה אחורית', 'hip', false),
  ('ארתרוסקופיית ברך', 'knee', false),
  ('שחזור רצועה צולבת קדמית (ACL)', 'knee', false),
  ('החלפת מפרק כתף', 'shoulder', false),
  ('ארתרוסקופיית כתף', 'shoulder', false),
  ('קיבוע שברים (ORIF)', 'other', false),
  ('ניתוח עמוד שדרה מותני', 'spine', false),
  ('החלפת מפרק מרפק', 'other', false),
  ('ארתרודזה של קרסול', 'other', false)
on conflict (name) do nothing;
