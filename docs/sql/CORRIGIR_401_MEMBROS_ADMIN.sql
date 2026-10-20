-- Corrige a leitura de membros no painel administrativo.
-- Execute no SQL Editor do projeto Supabase usado pelo site.

BEGIN;

CREATE OR REPLACE FUNCTION public.current_admin_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT p.role::text
  FROM public.profiles AS p
  WHERE p.id = auth.uid()
  LIMIT 1
$$;

REVOKE ALL ON FUNCTION public.current_admin_role() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.current_admin_role() FROM anon;
GRANT EXECUTE ON FUNCTION public.current_admin_role() TO authenticated;

GRANT SELECT ON TABLE public.membros TO authenticated;
ALTER TABLE public.membros ENABLE ROW LEVEL SECURITY;

-- Remove regras de leitura antigas da tabela para evitar políticas conflitantes
-- ou consultas recursivas à tabela profiles. A nova regra libera apenas os perfis
-- administrativos usados pelo painel.
DO $$
DECLARE
  policy_record record;
BEGIN
  FOR policy_record IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'membros'
      AND cmd = 'SELECT'
  LOOP
    EXECUTE format('DROP POLICY %I ON public.membros', policy_record.policyname);
  END LOOP;
END
$$;

CREATE POLICY "admin_roles_select_membros"
ON public.membros
FOR SELECT
TO authenticated
USING (public.current_admin_role() IN ('admin', 'pastor', 'secretario'));

COMMIT;
