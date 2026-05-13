import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const APP_URL = 'https://aytac-cell.github.io/todo-app/'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, content-type',
      },
    })
  }

  try {
    const { space_id, invited_email, space_name, inviter_email } = await req.json()

    // Caller doğrulama
    const authHeader = req.headers.get('Authorization') ?? ''
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    )
    const { data: { user }, error: authErr } = await supabase.auth.getUser()
    if (authErr || !user) return json({ error: 'Unauthorized' }, 401)

    const { data: space } = await supabase.from('spaces')
      .select('owner_id').eq('id', space_id).single()
    if (space?.owner_id !== user.id) return json({ error: 'Forbidden' }, 403)

    // Admin client ile davet e-postası gönder (Brevo SMTP kullanır)
    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const { error: invErr } = await admin.auth.admin.inviteUserByEmail(invited_email, {
      redirectTo: APP_URL,
      data: {
        invited_to_space: space_id,
        invited_by: inviter_email,
        space_name,
      },
    })

    if (invErr) {
      // "User already registered" hatası kabul edilebilir — DB kaydımız zaten var
      if (!invErr.message.includes('already')) {
        console.error('inviteUserByEmail:', invErr.message)
        return json({ error: invErr.message }, 400)
      }
      console.warn('User already registered, skipping invite email:', invited_email)
    }

    return json({ ok: true })
  } catch (e) {
    console.error(e)
    return json({ error: String(e) }, 500)
  }
})

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  })
}
