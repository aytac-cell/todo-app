-- due_at: görevin bitiş tarihi (tarih + saat)
ALTER TABLE todos ADD COLUMN IF NOT EXISTS due_at timestamptz;

-- set_due_date: sadece space owner'ı çağırabilir
DROP FUNCTION IF EXISTS set_due_date(bigint, timestamptz);
CREATE FUNCTION set_due_date(p_todo_id bigint, p_due_at timestamptz)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM todos t JOIN spaces s ON s.id = t.space_id
    WHERE t.id = p_todo_id AND s.owner_id = auth.uid()
  ) THEN RAISE EXCEPTION 'Only the owner can set due dates'; END IF;
  UPDATE todos SET due_at = p_due_at WHERE id = p_todo_id;
END;
$$;
