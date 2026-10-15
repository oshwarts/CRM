-- An equipment item (a tray set) can have several pictures — e.g. an upper and a lower tray — each with its own label.
-- images = [{ "path": "equipment/….jpg", "label": "מגש עליון" }, …]. image_path stays and always holds the first one
-- (older app versions show only that one).
alter table public.equipment_items add column if not exists images jsonb not null default '[]'::jsonb;

update public.equipment_items
set images = jsonb_build_array(jsonb_build_object('path', image_path, 'label', ''))
where image_path <> '' and images = '[]'::jsonb;
