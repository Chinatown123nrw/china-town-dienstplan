-- Admin login setup:
-- 1. In Supabase Dashboard, go to Authentication -> Users.
-- 2. Create this user manually:
--    email: admin@chinatown.de
--    password: china1234
-- 3. Run this SQL to connect the auth user to David Lox as admin.

update employees
set
  auth_user_id = (
    select id
    from auth.users
    where lower(email) = lower('admin@chinatown.de')
  ),
  is_admin = true,
  active = true
where slug = '02-david-lox';

select e.name, e.slug, e.is_admin, e.active, e.auth_user_id, u.email
from employees e
left join auth.users u on u.id = e.auth_user_id
where e.slug = '02-david-lox';
