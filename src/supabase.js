import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://aeynzhguucjuunwpsslf.supabase.co'

const supabaseKey =
  'sb_publishable_0P5Em2JCo5xytj3N79a_AQ_H0x372Zk'

export const supabase = createClient(supabaseUrl, supabaseKey)