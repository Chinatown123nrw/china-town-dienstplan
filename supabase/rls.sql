-- Run this in the Supabase SQL Editor after creating employees and shifts.
-- It makes employees and shifts readable for logged-in users, while writes are
-- restricted to admins or to the employee taking/releasing their own shift.

alter table employees enable row level security;
alter table shifts enable row level security;

create or replace function public.current_employee_slug()
returns text
language sql
security definer
set search_path = public
stable
as $$
  select slug
  from public.employees
  where auth_user_id = auth.uid()
    and active = true
  limit 1
$$;

create or replace function public.current_employee_is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(
    (
      select is_admin
      from public.employees
      where auth_user_id = auth.uid()
        and active = true
      limit 1
    ),
    false
  )
$$;

drop policy if exists "Users can read active employees" on employees;
drop policy if exists "Admins can manage employees" on employees;
drop policy if exists "Authenticated users can read shifts" on shifts;
drop policy if exists "Admins can insert shifts" on shifts;
drop policy if exists "Admins can delete shifts" on shifts;
drop policy if exists "Admins can update shifts" on shifts;
drop policy if exists "Employees can take open shifts" on shifts;
drop policy if exists "Employees can release own shifts" on shifts;

create policy "Users can read active employees"
on employees
for select
to authenticated
using (active = true);

create policy "Admins can manage employees"
on employees
for all
to authenticated
using (public.current_employee_is_admin())
with check (public.current_employee_is_admin());

create policy "Authenticated users can read shifts"
on shifts
for select
to authenticated
using (true);

create policy "Admins can insert shifts"
on shifts
for insert
to authenticated
with check (public.current_employee_is_admin());

create policy "Admins can delete shifts"
on shifts
for delete
to authenticated
using (public.current_employee_is_admin());

create policy "Admins can update shifts"
on shifts
for update
to authenticated
using (public.current_employee_is_admin())
with check (public.current_employee_is_admin());

create policy "Employees can take open shifts"
on shifts
for update
to authenticated
using (open = true)
with check (
  open = false
  and employee_name = public.current_employee_slug()
);

create policy "Employees can release own shifts"
on shifts
for update
to authenticated
using (
  open = false
  and employee_name = public.current_employee_slug()
)
with check (
  open = true
  and employee_name is null
);
