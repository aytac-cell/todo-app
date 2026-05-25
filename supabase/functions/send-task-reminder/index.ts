import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SENDER = 'noreply@elab.com.tr'
const APP_URL = 'https://aytac-cell.github.io/todo-app/'
const DELAY_MS = 60_000 // 1 dakika

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
    const { todo_id, todo_text, assigned_email } = await req.json()

    // Caller doğrulama
    const authHeader = req.headers.get('Authorization') ?? ''
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    )
    const { data: { user }, error: authErr } = await supabase.auth.getUser()
    if (authErr || !user) return json({ error: 'Unauthorized' }, 401)

    // 1 dakika bekle
    await new Promise<void>(r => setTimeout(r, DELAY_MS))

    // Görevin güncel durumunu kontrol et (service role — RLS bypass)
    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )
    const { data: todo } = await admin
      .from('todos')
      .select('done, reminder_sent, assigned_to')
      .eq('id', todo_id)
      .single()

    // Hâlâ atanmış, tamamlanmamış ve hatırlatma gönderilmemişse gönder
    if (todo && !todo.done && !todo.reminder_sent && todo.assigned_to) {
      await sendEmail(
        assigned_email,
        `⏰ Hatırlatma: Göreviniz bekliyor`,
        `<p>Merhaba,</p>
         <p><b>"${escHtml(todo_text)}"</b> görevi hâlâ tamamlanmadı.</p>
         <p><a href="${APP_URL}">Uygulamayı aç →</a></p>`
      )

      // reminder_sent = true — tekrar gönderme önleme
      await admin.from('todos').update({ reminder_sent: true }).eq('id', todo_id)

      return json({ ok: true, reminded: true })
    }

    return json({ ok: true, reminded: false })
  } catch (e) {
    console.error(e)
    return json({ error: String(e) }, 500)
  }
})

async function sendEmail(to: string, subject: string, html: string) {
  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': Deno.env.get('BREVO_API_KEY')!,
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
