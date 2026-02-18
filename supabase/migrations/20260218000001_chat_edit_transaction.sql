-- Migration: 20260218000001_chat_edit_transaction.sql
-- Description: Add atomic transaction function for message editing
-- Date: February 18, 2026
--
-- Implements atomic edit operation that:
-- 1. Marks original message as non-canonical
-- 2. Inserts revision message
-- 3. Truncates all messages after the edit point
-- 4. Updates chat timestamp
-- 5. Returns canonical timeline

-- ============================================================================
-- EDIT MESSAGE TRANSACTION FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION public.edit_message_transaction(
  p_user_id uuid,
  p_chat_id uuid,
  p_message_id uuid,
  p_new_content text
)
RETURNS TABLE (
  canonical_messages jsonb,
  truncated_count integer,
  revision_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_original_message record;
  v_revision record;
  v_truncated_count integer;
  v_canonical_messages jsonb;
BEGIN
  -- Verify ownership and get original message
  SELECT * INTO v_original_message
  FROM chat_messages
  WHERE id = p_message_id 
    AND chat_id = p_chat_id 
    AND user_id = p_user_id
    AND is_canonical = true;
    
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Message not found or not editable';
  END IF;
  
  IF v_original_message.role != 'user' THEN
    RAISE EXCEPTION 'Only user messages can be edited';
  END IF;
  
  -- Mark original message as non-canonical
  UPDATE chat_messages
  SET is_canonical = false,
      edited_at = now()
  WHERE id = p_message_id
    AND user_id = p_user_id;
  
  -- Truncate all messages after this point
  UPDATE chat_messages
  SET is_canonical = false
  WHERE chat_id = p_chat_id
    AND user_id = p_user_id
    AND is_canonical = true
    AND created_at > v_original_message.created_at
  RETURNING * INTO v_truncated_count;
    
  GET DIAGNOSTICS v_truncated_count = ROW_COUNT;
  
  -- Insert revision message
  INSERT INTO chat_messages (
    chat_id,
    user_id,
    role,
    mode,
    source,
    input_text,
    output_text,
    revision_of,
    is_canonical,
    status
  ) VALUES (
    p_chat_id,
    p_user_id,
    v_original_message.role,
    v_original_message.mode,
    v_original_message.source,
    p_new_content,
    NULL,
    p_message_id,
    true,
    'sent'
  )
  RETURNING * INTO v_revision;
  
  -- Update chat timestamp
  UPDATE chats
  SET updated_at = now()
  WHERE id = p_chat_id
    AND user_id = p_user_id;
  
  -- Get canonical timeline
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', id,
      'role', role,
      'mode', mode,
      'source', source,
      'input_text', input_text,
      'output_text', output_text,
      'created_at', created_at,
      'status', status,
      'edited_at', edited_at,
      'revision_of', revision_of
    ) ORDER BY created_at ASC
  ) INTO v_canonical_messages
  FROM chat_messages
  WHERE chat_id = p_chat_id
    AND user_id = p_user_id
    AND is_canonical = true;
  
  -- Return results
  RETURN QUERY SELECT v_canonical_messages, v_truncated_count, v_revision.id;
END;
$$;

-- ============================================================================
-- PERMISSIONS
-- ============================================================================

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.edit_message_transaction TO authenticated;

-- Add RLS policy if not exists
COMMENT ON FUNCTION public.edit_message_transaction IS 
  'Atomically edit a user message and return canonical timeline. All operations in single transaction.';

-- ============================================================================
-- REGENERATE MESSAGE TRANSACTION FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION public.regenerate_message_transaction(
  p_user_id uuid,
  p_chat_id uuid
)
RETURNS TABLE (
  canonical_messages jsonb,
  truncated_count integer,
  last_user_message_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_last_assistant record;
  v_reference_message record;
  v_truncated_count integer;
  v_canonical_messages jsonb;
BEGIN
  -- Verify chat ownership
  IF NOT EXISTS (
    SELECT 1 FROM chats 
    WHERE id = p_chat_id AND user_id = p_user_id
  ) THEN
    RAISE EXCEPTION 'Chat not found';
  END IF;
  
  -- Find last assistant message
  SELECT * INTO v_last_assistant
  FROM chat_messages
  WHERE chat_id = p_chat_id
    AND user_id = p_user_id
    AND is_canonical = true
    AND role = 'assistant'
  ORDER BY created_at DESC
  LIMIT 1;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No assistant message to regenerate';
  END IF;
  
  -- Find reference message (last user message before assistant)
  SELECT * INTO v_reference_message
  FROM chat_messages
  WHERE chat_id = p_chat_id
    AND user_id = p_user_id
    AND is_canonical = true
    AND created_at <= v_last_assistant.created_at
  ORDER BY created_at DESC
  LIMIT 1 OFFSET 1;
  
  IF v_reference_message IS NULL THEN
    -- No message before assistant, use the assistant message itself as reference
    v_reference_message := v_last_assistant;
  END IF;
  
  -- Truncate from reference point
  UPDATE chat_messages
  SET is_canonical = false
  WHERE chat_id = p_chat_id
    AND user_id = p_user_id
    AND is_canonical = true
    AND created_at > v_reference_message.created_at;
    
  GET DIAGNOSTICS v_truncated_count = ROW_COUNT;
  
  -- Update chat timestamp
  UPDATE chats
  SET updated_at = now()
  WHERE id = p_chat_id
    AND user_id = p_user_id;
  
  -- Get canonical timeline
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', id,
      'role', role,
      'mode', mode,
      'source', source,
      'input_text', input_text,
      'output_text', output_text,
      'created_at', created_at,
      'status', status,
      'edited_at', edited_at,
      'revision_of', revision_of
    ) ORDER BY created_at ASC
  ) INTO v_canonical_messages
  FROM chat_messages
  WHERE chat_id = p_chat_id
    AND user_id = p_user_id
    AND is_canonical = true;
  
  -- Return results
  RETURN QUERY SELECT v_canonical_messages, v_truncated_count, v_reference_message.id;
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.regenerate_message_transaction TO authenticated;

COMMENT ON FUNCTION public.regenerate_message_transaction IS 
  'Atomically prepare for message regeneration by truncating last assistant response.';
