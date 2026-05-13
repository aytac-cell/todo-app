import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const FROM_EMAIL = 'aytac@elab.com.tr'
const BREVO_KEY  = Deno.env.get('BREVO_KEY') ?? ''
const FROM_NAME  = 'Yapılacaklar'
const APP_URL    = 'https://aytac-cell.github.io/todo-app/'

async function sendSmtp(to: string, subject: string, html: string) {
  // Brevo transactional email via their API
  // We use the service account approach: basic auth over SMTP encoded as base64 for fetch
  // Since we can't do SMTP from Deno directly, we use Brevo's REST endpoint
  // Brevo allows using SMTP credentials for their "Email Campaigns API v3"
  // Actually we use their SendSMTPEmail endpoint with basic auth
  const credentials = btoa(`${SMTP_USER}:${SMTP_PASS}`)

  // Try Brevo REST API (v3) - the SMTP key works as API key for some accounts
  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': BREVO_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      sender:  { name: FROM_NAME, email: FROM_EMAIL },
      to:      [{ email: to }],
      subject: subject,
      htmlContent: html,
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Brevo API error ${res.status}: ${err}`)
  }
  return res.json()
}

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

    // Verify caller is authenticated + is space owner
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

    // Send invitation email
    const subject = `${inviter_email} sizi listeye davet etti / invited you to their list`
    const html = `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
        <h2 style="color:#6c63ff">Yapılacaklar / To-Do List</h2>
        <p><strong>${inviter_email}</strong> sizi <strong>"${space_name}"</strong> listesine davet etti.</p>
        <p><strong>${inviter_email}</strong> invited you to the <strong>"${space_name}"</strong> list.</p>
        <br>
        <a href="${APP_URL}" style="background:#6c63ff;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;display:inline-block;font-weight:600">
          Listeye Git / Open List
        </a>
        <p style="color:#aaa;font-size:12px;margin-top:24px">
          Uygulamaya giriş yaptıktan sonra davet bildirimi göreceksiniz.<br>
          After signing in, you'll see the invitation notification.
        </p>
      </div>
    `

    await sendSmtp(invited_email, subject, html)
    return json({ ok: true })
  } catch (e) {
    return json({ error: e.message }, 500)
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
