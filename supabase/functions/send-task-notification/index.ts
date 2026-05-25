import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SENDER = 'noreply@elab.com.tr'
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
    const { type, todo_text, assigned_email, space_id } = await req.json()

    // Caller doğrulama
    const authHeader = req.headers.get('Authorization') ?? ''
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    )
    const { data: { user }, error: authErr } = await supabase.auth.getUser()
    if (authErr || !user) return json({ error: 'Unauthorized' }, 401)

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    if (type === 'assigned') {
      // → Atanan kişiye bildirim
      await sendEmail(
        assigned_email,
        `📋 Size yeni bir görev atandı`,
        `<p>Merhaba,</p>
         <p><b>"${escHtml(todo_text)}"</b> görevi size atandı.</p>
         <p><a href="${APP_URL}">Uygulamayı aç →</a></p>`
      )
    } else if (type === 'completed') {
      // → Space owner'ına bildirim
      const { data: space } = await admin
        .from('spaces')
        .select('owner_id')
        .eq('id', space_id)
        .single()
      if (!space) return json({ error: 'Space not found' }, 404)

      const { data: ownerData } = await admin.auth.admin.getUserById(space.owner_id)
      const ownerEmail = ownerData?.user?.email
      if (!ownerEmail) return json({ error: 'Owner email not found' }, 404)

      await sendEmail(
        ownerEmail,
        `✅ Görev Tamamlandı`,
        `<p><b>${escHtml(assigned_email)}</b>, "<b>${escHtml(todo_text)}</b>" görevini tamamladı.</p>
         <p><a href="${APP_URL}">Uygulamayı aç →</a></p>`
      )
    } else {
      return json({ error: 'Unknown type' }, 400)
    }

    return json({ ok: true })
  } catch (e) {
    console.error(e)
    return json({ error: String(e) }, 500)
  }
})

async function sendEmail(to: string, subject: string, html: string) {
  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': Deno.env.get('BREVO_KEY')!,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      sender: { name: 'Todo App', email: SENDER },
      to: [{ email: to }],
      subject,
      htmlContent: html,
    }),
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Brevo error ${res.status}: ${body}`)
  }
}

function escHtml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  })
}
