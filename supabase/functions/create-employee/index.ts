import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const roleOptions = new Set([
  'Mitarbeiter',
  'Manager',
  'Service',
  'Küche',
  'Bar',
  'Kasse',
  'Lieferung',
  'Aushilfe',
  'Geschäftsführer',
  'Geschaeftsinhaber',
])

function normalizeSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replaceAll(' ', '-')
    .replace(/[^a-z0-9-]/g, '')
}

function employeeEmailFromName(name: string) {
  const handle = name
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '')

  return handle ? `${handle}@chinatown.de` : ''
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405)
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const serviceRoleKey = Deno.env.get('SERVICE_ROLE_KEY')
  const authorization = req.headers.get('Authorization')

  if (!supabaseUrl || !anonKey || !serviceRoleKey || !authorization) {
    return jsonResponse({ error: 'Server is missing auth configuration' }, 500)
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
  })
  const adminClient = createClient(supabaseUrl, serviceRoleKey)

  const {
    data: { user },
    error: userError,
  } = await userClient.auth.getUser()

  if (userError || !user) {
    return jsonResponse({ error: 'Not authenticated' }, 401)
  }

  const { data: adminEmployee, error: adminError } = await adminClient
    .from('employees')
    .select('id')
    .eq('auth_user_id', user.id)
    .eq('is_admin', true)
    .eq('active', true)
    .maybeSingle()

  if (adminError || !adminEmployee) {
    return jsonResponse({ error: 'Only admins can create employees' }, 403)
  }

  const body = await req.json()
  const name = String(body.name ?? '').trim()
  const slug = normalizeSlug(String(body.slug ?? ''))
  const role = String(body.role ?? 'Mitarbeiter')
  const password = String(body.password ?? '')
  const isAdmin = Boolean(body.is_admin)
  const email = employeeEmailFromName(name)

  if (!name || !slug || !email) {
    return jsonResponse({ error: 'Name and slug are required' }, 400)
  }

  if (!roleOptions.has(role)) {
    return jsonResponse({ error: 'Invalid role' }, 400)
  }

  if (password.length < 6) {
    return jsonResponse({ error: 'Initial password must contain at least 6 characters' }, 400)
  }

  const { data: createdUser, error: createUserError } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      employee_slug: slug,
      initial_password: true,
    },
  })

  if (createUserError) {
    return jsonResponse({ error: createUserError.message }, 400)
  }

  const { data: employee, error: insertError } = await adminClient
    .from('employees')
    .insert({
      auth_user_id: createdUser.user.id,
      name,
      slug,
      role,
      is_admin: isAdmin,
      active: true,
    })
    .select('id, auth_user_id, name, slug, role, is_admin, active')
    .single()

  if (insertError) {
    await adminClient.auth.admin.deleteUser(createdUser.user.id)
    return jsonResponse({ error: insertError.message }, 400)
  }

  return jsonResponse({
    employee,
    email,
    password,
  })
})
