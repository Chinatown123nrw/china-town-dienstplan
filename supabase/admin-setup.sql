-- Admin login setup:
-- 1. In Supabase Dashboard, go to Authentication -> Users.
-- 2. Create this user manually:
--    email: admin@chinatown.de
--    password: china1234
-- 3. Optional shared role logins:
--    email: mitarbeiter@chinatown.de
--    password: MitarbeiterNRWCHINA
--    email: manager@chinatown.de
--    password: ManagerTownNRW
-- 4. Run this SQL to connect the auth users.

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

insert into employees (auth_user_id, name, slug, role, is_admin, active)
select u.id, 'Mitarbeiter Zugang', 'mitarbeiter-zugang', 'Mitarbeiter', false, true
from auth.users u
where lower(u.email) = lower('mitarbeiter@chinatown.de')
  and not exists (
    select 1 from employees e where e.slug = 'mitarbeiter-zugang'
  );

update employees
set
  auth_user_id = (
    select id
    from auth.users
    where lower(email) = lower('mitarbeiter@chinatown.de')
  ),
  role = 'Mitarbeiter',
  is_admin = false,
  active = true
where slug = 'mitarbeiter-zugang';

insert into employees (auth_user_id, name, slug, role, is_admin, active)
select u.id, 'Manager Zugang', 'manager-zugang', 'Manager', false, true
from auth.users u
where lower(u.email) = lower('manager@chinatown.de')
  and not exists (
    select 1 from employees e where e.slug = 'manager-zugang'
  );

update employees
set
  auth_user_id = (
    select id
    from auth.users
    where lower(email) = lower('manager@chinatown.de')
  ),
  role = 'Manager',
  is_admin = false,
  active = true
where slug = 'manager-zugang';

select e.name, e.slug, e.is_admin, e.active, e.auth_user_id, u.email
from employees e
left join auth.users u on u.id = e.auth_user_id
where e.slug in ('02-david-lox', 'mitarbeiter-zugang', 'manager-zugang');
