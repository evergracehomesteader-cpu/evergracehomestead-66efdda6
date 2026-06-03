INSERT INTO public.feed_units (name, lbs_per_unit, is_system)
VALUES
  ('Bucket', 10, true),
  ('Half bucket', 5, true),
  ('Quarter bucket', 2.5, true),
  ('Scoop', 1, true),
  ('Bag', 50, true),
  ('Ounce', 0.0625, true)
ON CONFLICT DO NOTHING;