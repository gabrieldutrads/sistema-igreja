-- Execute this script in the Supabase SQL Editor after creating the
-- registration_tokens table with docs/sql/2_registration-tokens-SAFE.sql.
-- It aligns the token RPCs with the current admin and superadmin pages.
-- Browser access is restricted to these RPCs; direct table access is revoked.

DROP FUNCTION IF EXISTS public.list_active_tokens();
DROP FUNCTION IF EXISTS public.list_registration_tokens(UUID, BOOLEAN);
DROP FUNCTION IF EXISTS public.generate_registration_token(UUID, TEXT, TEXT, TEXT, INTEGER);
DROP FUNCTION IF EXISTS public.generate_registration_token(UUID, TEXT);
DROP FUNCTION IF EXISTS public.generate_registration_token(INTEGER, TEXT);
DROP FUNCTION IF EXISTS public.revoke_registration_token(UUID, UUID);
DROP FUNCTION IF EXISTS public.revoke_registration_token(TEXT);

ALTER TABLE public.registration_tokens ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  v_policy_name TEXT;
BEGIN
  FOR v_policy_name IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'registration_tokens'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.registration_tokens', v_policy_name);
  END LOOP;
END;
$$;

REVOKE ALL ON TABLE public.registration_tokens FROM PUBLIC, anon, authenticated;

CREATE FUNCTION public.generate_registration_token(
  p_duration_hours INTEGER DEFAULT 2,
  p_notes TEXT DEFAULT NULL,
  p_recipient_name TEXT DEFAULT NULL,
  p_recipient_contact TEXT DEFAULT NULL
)
RETURNS TABLE (
  token TEXT,
  expires_at TIMESTAMPTZ,
  registration_url TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, auth
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_user_email TEXT;
  v_user_role TEXT;
  v_token TEXT;
  v_expires_at TIMESTAMPTZ;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  IF p_duration_hours IS NULL OR p_duration_hours < 1 OR p_duration_hours > 168 THEN
    RAISE EXCEPTION 'A duração do link deve estar entre 1 e 168 horas';
  END IF;

  SELECT p.role, u.email
  INTO v_user_role, v_user_email
  FROM public.profiles AS p
  JOIN auth.users AS u ON u.id = p.id
  WHERE p.id = v_user_id;

  IF COALESCE(v_user_role, '') NOT IN ('admin', 'pastor', 'secretario') THEN
    RAISE EXCEPTION 'Usuário sem permissão para gerar links';
  END IF;

  v_token := replace(gen_random_uuid()::TEXT, '-', '')
    || replace(gen_random_uuid()::TEXT, '-', '');
  v_expires_at := NOW() + make_interval(hours => p_duration_hours);

  INSERT INTO public.registration_tokens (
    token,
    created_by,
    created_by_email,
    created_by_role,
    expires_at,
    notes,
    recipient_info
  )
  VALUES (
    v_token,
    v_user_id,
    v_user_email,
    v_user_role,
    v_expires_at,
    p_notes,
    jsonb_build_object('name', p_recipient_name, 'contact', p_recipient_contact)
  );

  RETURN QUERY SELECT v_token, v_expires_at, NULL::TEXT;
END;
$$;

CREATE FUNCTION public.list_active_tokens()
RETURNS TABLE (
  id UUID,
  token TEXT,
  observacao TEXT,
  created_by_name TEXT,
  created_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  time_remaining_seconds INTEGER,
  used BOOLEAN,
  used_at TIMESTAMPTZ,
  used_by_email TEXT,
  expired BOOLEAN,
  revoked BOOLEAN,
  registration_url TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, auth
AS $$
DECLARE
  v_user_role TEXT;
BEGIN
  SELECT p.role INTO v_user_role
  FROM public.profiles AS p
  WHERE p.id = auth.uid();

  IF COALESCE(v_user_role, '') NOT IN ('admin', 'pastor', 'secretario') THEN
    RAISE EXCEPTION 'Usuário sem permissão para listar links';
  END IF;

  RETURN QUERY
  SELECT
    rt.id,
    rt.token,
    rt.notes,
    rt.created_by_email,
    rt.created_at,
    rt.expires_at,
    CASE
      WHEN rt.is_active AND rt.used_at IS NULL AND rt.expires_at > NOW()
        THEN GREATEST(EXTRACT(EPOCH FROM (rt.expires_at - NOW()))::INTEGER, 0)
      ELSE 0
    END,
    rt.used_at IS NOT NULL,
    rt.used_at,
    rt.used_by_email,
    rt.expires_at <= NOW() AND rt.used_at IS NULL,
    NOT rt.is_active AND rt.used_at IS NULL AND rt.expires_at > NOW(),
    NULL::TEXT
  FROM public.registration_tokens AS rt
  WHERE rt.is_active OR rt.created_at >= NOW() - INTERVAL '7 days'
  ORDER BY rt.created_at DESC;
END;
$$;

CREATE FUNCTION public.list_registration_tokens(
  p_show_all BOOLEAN DEFAULT FALSE
)
RETURNS TABLE (
  id UUID,
  token TEXT,
  created_by_email TEXT,
  created_by_role TEXT,
  expires_at TIMESTAMPTZ,
  used_at TIMESTAMPTZ,
  used_by_email TEXT,
  is_active BOOLEAN,
  is_expired BOOLEAN,
  time_remaining_seconds INTEGER,
  notes TEXT,
  recipient_name TEXT,
  recipient_contact TEXT,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, auth
AS $$
DECLARE
  v_user_role TEXT;
BEGIN
  SELECT p.role INTO v_user_role
  FROM public.profiles AS p
  WHERE p.id = auth.uid();

  IF COALESCE(v_user_role, '') NOT IN ('admin', 'pastor', 'secretario') THEN
    RAISE EXCEPTION 'Usuário sem permissão para listar links';
  END IF;

  RETURN QUERY
  SELECT
    rt.id,
    rt.token,
    rt.created_by_email,
    rt.created_by_role,
    rt.expires_at,
    rt.used_at,
    rt.used_by_email,
    rt.is_active,
    rt.expires_at <= NOW() AND rt.used_at IS NULL,
    CASE
      WHEN rt.is_active AND rt.used_at IS NULL AND rt.expires_at > NOW()
        THEN GREATEST(EXTRACT(EPOCH FROM (rt.expires_at - NOW()))::INTEGER, 0)
      ELSE 0
    END,
    rt.notes,
    rt.recipient_info->>'name',
    rt.recipient_info->>'contact',
    rt.created_at
  FROM public.registration_tokens AS rt
  WHERE COALESCE(p_show_all, FALSE) OR rt.created_by = auth.uid()
  ORDER BY rt.created_at DESC;
END;
$$;

CREATE FUNCTION public.revoke_registration_token(
  p_token_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, auth
AS $$
DECLARE
  v_user_role TEXT;
  v_rows_updated INTEGER;
BEGIN
  SELECT p.role INTO v_user_role
  FROM public.profiles AS p
  WHERE p.id = auth.uid();

  IF COALESCE(v_user_role, '') NOT IN ('admin', 'pastor', 'secretario') THEN
    RAISE EXCEPTION 'Usuário sem permissão para revogar links';
  END IF;

  UPDATE public.registration_tokens AS rt
  SET is_active = FALSE,
      updated_at = NOW()
  WHERE rt.id = p_token_id
    AND rt.is_active
    AND rt.used_at IS NULL
    AND (v_user_role = 'admin' OR rt.created_by = auth.uid());

  GET DIAGNOSTICS v_rows_updated = ROW_COUNT;
  RETURN v_rows_updated = 1;
END;
$$;

REVOKE ALL ON FUNCTION public.generate_registration_token(INTEGER, TEXT, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.list_active_tokens() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.list_registration_tokens(BOOLEAN) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.revoke_registration_token(UUID) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.generate_registration_token(INTEGER, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_active_tokens() TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_registration_tokens(BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_registration_token(UUID) TO authenticated;

NOTIFY pgrst, 'reload schema';
