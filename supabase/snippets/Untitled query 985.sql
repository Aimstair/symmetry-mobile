ALTER TABLE users DISABLE ROW LEVEL SECURITY;
UPDATE public.users p SET id = a.id FROM auth.users a WHERE LOWER(p.email) = LOWER(a.email) AND p.id != a.id;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;