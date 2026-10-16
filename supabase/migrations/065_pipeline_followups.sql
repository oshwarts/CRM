-- A suggested next step for every stage of the funnel, and closing a potential doctor as "not relevant" with a reason.
alter table public.pipeline_stages add column suggested_step text not null default '';

update public.pipeline_stages set suggested_step = case name
  when 'זיהוי ראשוני' then 'ליצור קשר ולקבוע שיחת היכרות'
  when 'יצירת קשר' then 'לקבוע פגישת היכרות'
  when 'פגישת היכרות' then 'לתאם הדגמת מוצר'
  when 'הדגמת מוצר' then 'לקבוע ניתוח ניסיון'
  when 'ניתוח ניסיון' then 'לסכם את הניסיון ולהגיש הצעה'
  when 'משא ומתן' then 'לשלוח הצעת מחיר ולסגור פרטים'
  when 'סגירה / הפיכה ללקוח' then 'להשלים הקמה והכשרה'
  else '' end
where suggested_step = '';

-- a doctor who will not become a client: status "lost" (shown as "לא רלוונטי") with the reason and the date
alter table public.doctors
  add column lost_reason text not null default '',
  add column lost_at date;
