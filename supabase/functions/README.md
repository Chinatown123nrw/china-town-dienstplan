## Edge Functions

### create-employee

Creates a Supabase Auth user and the matching `employees` row in one admin-only action.

Deploy once:

```powershell
supabase secrets set SUPABASE_SERVICE_ROLE_KEY="YOUR_SERVICE_ROLE_KEY"
supabase functions deploy create-employee
```

The function uses the logged-in user's JWT to verify that the caller is an active admin employee.

Do not put the service role key into React/Vite code.
