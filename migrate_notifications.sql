-- assigned_at: görevin atanma zamanı (hatırlatma için)
-- reminder_sent: hatırlatma zaten gönderildiyse tekrar gönderme
ALTER TABLE todos ADD COLUMN IF NOT EXISTS assigned_at   timestamptz;
ALTER TABLE todos ADD COLUMN IF NOT EXISTS reminder_sent boolean DEFAULT false;

-- assign_todo: assigned_at ve reminder_sent'i de güncelle
CREATE OR REPLACE FUNCTION assign_todo(p_todo_id bigint, p_user_id uuid, p_email text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM todos t JOIN spaces s ON s.id = t.space_id
    WHERE t.id = p_todo_id AND s.owner_id = auth.uid()
  ) THEN RAISE EXCEPTION 'Only the owner can assign tasks'; END IF;
  UPDATE todos SET
    assigned_to   = p_user_id,
    assigned_email = p_email,
    assigned_at   = CASE WHEN p_user_id IS NOT NULL THEN now() ELSE NULL END,
    reminder_sent = false
  WHERE id = p_todo_id;
END;
$$;
