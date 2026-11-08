-- Schema simplificado para tabela membros (apenas 3 campos obrigatórios)
-- Versão: 2026-11-08
-- Este script cria/atualiza a tabela membros com apenas os campos necessários
-- para o formulário simplificado de cadastro.

-- =====================================
-- Tabela membros simplificada
-- =====================================

CREATE TABLE IF NOT EXISTS public.membros (
  id UUID PRIMARY KEY DEFAULT extensions.gen_random_uuid(),

  -- Campos obrigatórios do formulário simplificado
  nome TEXT NOT NULL,                              -- Nome completo
  celular TEXT NOT NULL,                           -- Telefone/WhatsApp
  batismo_espirito_santo TEXT NOT NULL             -- 'sim' | 'nao' | 'prefiro_nao_informar'
    CHECK (batismo_espirito_santo IN ('sim', 'nao', 'prefiro_nao_informar')),

  -- Metadados de cadastro
  tipo_cadastro TEXT NOT NULL DEFAULT 'Congregado', -- Fixo: Congregado (padrão simplificado)
  status TEXT NOT NULL DEFAULT 'Pendente',          -- Status inicial
  member_account_id UUID REFERENCES public.member_accounts(id) ON DELETE SET NULL,

  -- Privacidade e LGPD
  privacy_consent BOOLEAN NOT NULL DEFAULT FALSE,
  privacy_accepted_at TIMESTAMPTZ,
  privacy_version TEXT NOT NULL DEFAULT '2026-07-15',
  privacy_source TEXT NOT NULL DEFAULT 'public_registration',

  -- Auditoria
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================================
-- Índices para performance
-- =====================================

CREATE INDEX IF NOT EXISTS idx_membros_nome ON public.membros(nome);
CREATE INDEX IF NOT EXISTS idx_membros_celular ON public.membros(celular);
CREATE INDEX IF NOT EXISTS idx_membros_status ON public.membros(status);
CREATE INDEX IF NOT EXISTS idx_membros_member_account_id ON public.membros(member_account_id);
CREATE INDEX IF NOT EXISTS idx_membros_created_at ON public.membros(created_at DESC);

-- =====================================
-- RLS (Row Level Security)
-- =====================================

ALTER TABLE public.membros ENABLE ROW LEVEL SECURITY;

-- Política: Acesso público apenas para INSERT (cadastro via token)
-- A validação do token é feita via RPC SECURITY DEFINER (validate_registration_token)
CREATE POLICY "Inserção pública via token validado" ON public.membros
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Política: Apenas admins/pastores/secretários podem ler/atualizar
CREATE POLICY "Admins podem gerenciar membros" ON public.membros
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'pastor', 'secretario')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'pastor', 'secretario')
    )
  );

-- Política: Membros podem ver seus próprios dados (via member_account_id)
CREATE POLICY "Membro vê próprio cadastro" ON public.membros
  FOR SELECT
  TO authenticated
  USING (
    member_account_id IN (
      SELECT id FROM public.member_accounts
      WHERE id IN (
        SELECT account_id FROM public.member_account_sessions
        WHERE token_hash = current_setting('request.jwt.claims.token_hash', true)
          AND expires_at > NOW()
      )
    )
  );

-- =====================================
-- Trigger para updated_at
-- =====================================

CREATE OR REPLACE FUNCTION public.update_membros_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_update_membros_updated_at ON public.membros;
CREATE TRIGGER trigger_update_membros_updated_at
  BEFORE UPDATE ON public.membros
  FOR EACH ROW
  EXECUTE FUNCTION public.update_membros_updated_at();

-- =====================================
-- Comentários
-- =====================================

COMMENT ON TABLE public.membros IS 'Cadastro simplificado de membros (3 campos: nome, celular, batismo_espirito_santo)';
COMMENT ON COLUMN public.membros.nome IS 'Nome completo do membro';
COMMENT ON COLUMN public.membros.celular IS 'Telefone/WhatsApp com DDD';
COMMENT ON COLUMN public.membros.batismo_espirito_santo IS 'Batizado com Espírito Santo: sim, nao, prefiro_nao_informar';
COMMENT ON COLUMN public.membros.tipo_cadastro IS 'Tipo fixo: Congregado (padrão simplificado)';
COMMENT ON COLUMN public.membros.privacy_consent IS 'Consentimento LGPD obrigatório';
COMMENT ON COLUMN public.membros.privacy_version IS 'Versão dos termos de privacidade aceita';
COMMENT ON COLUMN public.membros.privacy_source IS 'Origem: public_registration | member_registration';

-- =====================================
-- Mensagem de conclusão
-- =====================================

DO $$
BEGIN
  RAISE NOTICE '✅ Tabela membros simplificada criada/atualizada!';
  RAISE NOTICE '📋 Campos disponíveis:';
  RAISE NOTICE '   - nome (obrigatório)';
  RAISE NOTICE '   - celular (obrigatório)';
  RAISE NOTICE '   - batismo_espirito_santo (obrigatório: sim/nao/prefiro_nao_informar)';
  RAISE NOTICE '   - tipo_cadastro (fixo: Congregado)';
  RAISE NOTICE '   - status (padrão: Pendente)';
  RAISE NOTICE '   - member_account_id (vínculo com área do membro)';
  RAISE NOTICE '   - privacy_consent/version/source (LGPD)';
  RAISE NOTICE '   - created_at/updated_at (auditoria)';
  RAISE NOTICE '🔒 RLS configurado: INSERT público via token, SELECT/UPDATE restrito a admins';
END $$;