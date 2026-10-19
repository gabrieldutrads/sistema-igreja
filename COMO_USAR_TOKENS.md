# 🔐 Sistema de Tokens de Cadastro Temporários

## 📋 Visão Geral

O sistema usa tokens temporários seguros para controlar o acesso ao cadastro de novos membros. Cada token é:
- **Único e criptografado**
- **Temporário** (válido por 2 horas por padrão)
- **De uso único** (não pode ser reutilizado)
- **Rastreável** (registra quem criou e quem usou)

---

## 🚀 Como Configurar

### 1. Execute o SQL no Supabase

1. Abra o **SQL Editor** do projeto Supabase usado pelo site.
2. Execute `docs/sql/2_registration-tokens-SAFE.sql` para criar a tabela e as funções-base.
3. Execute `docs/sql/ALINHAR_RPC_TOKENS_SUPABASE.sql` para instalar as funções RPC esperadas pelas telas atuais.
4. Não é necessário editar URL no SQL: o painel monta o link usando o domínio em que está aberto.

### 2. Integre com a Interface Admin (Opcional)

Você pode criar uma interface na área administrativa para gerar tokens facilmente. Veja o exemplo abaixo.

---

## 💻 Como Usar

### 🔹 Gerar um Token (Administrador)

No **SQL Editor** do Supabase ou via código JavaScript:

```sql
-- Gerar token padrão (2 horas)
SELECT * FROM generate_registration_token();

-- Gerar token com 4 horas de validade e nota
SELECT * FROM generate_registration_token(4, 'Token para João Silva - Novo congregado');
```

**Retorno:**
```
token: "abc123XYZ789_exemplo"
expires_at: "2024-01-15 16:30:00"
registration_url: "https://seu-dominio.vercel.app/pages/cadastro.html?token=abc123XYZ789_exemplo"
```

Copie a `registration_url` e envie para o novo membro via WhatsApp, e-mail ou SMS.

---

### 🔹 Listar Tokens Ativos

Veja todos os tokens criados nos últimos 7 dias:

```sql
SELECT * FROM list_active_tokens();
```

**Retorna:**
- Token gerado
- Quem criou
- Data de criação
- Data de expiração
- Tempo restante
- Status (usado ou não)
- Link completo

---

### 🔹 Revogar um Token

Se precisar cancelar um token antes de expirar:

```sql
SELECT revoke_registration_token('abc123XYZ789_exemplo');
```

Retorna `TRUE` se revogado com sucesso.

---

### 🔹 Validar um Token (Automático)

O sistema valida automaticamente quando alguém acessa o link. Mas você pode testar manualmente:

```sql
SELECT * FROM validate_registration_token('abc123XYZ789_exemplo');
```

**Retorna:**
- `valid`: Token válido?
- `expired`: Token expirado?
- `used`: Token já usado?
- `expires_at`: Data de expiração
- `time_remaining_seconds`: Segundos restantes
- `created_by_name`: Quem criou

---

## 🎯 Fluxo de Uso Completo

### Para o Administrador:

1. **Gerar token:**
   ```sql
   SELECT * FROM generate_registration_token(2, 'Maria Santos - indicação pastor');
   ```

2. **Copiar o link gerado:**
   ```
   https://seu-dominio.vercel.app/pages/cadastro.html?token=abc123...
   ```

3. **Enviar para o novo membro:**
   - Via WhatsApp: "Olá Maria! Aqui está seu link para cadastro na igreja: [LINK]. Válido por 2 horas."
   - Via E-mail: Template formal com instruções
   - Via SMS: Link encurtado

### Para o Novo Membro:

1. **Recebe o link** via WhatsApp/E-mail/SMS
2. **Clica no link** (ou cola no navegador)
3. **Sistema valida automaticamente:**
   - ✅ Token válido → Mostra formulário de cadastro
   - ❌ Token expirado → Mensagem: "Link expirado, solicite novo"
   - ❌ Token usado → Mensagem: "Link já utilizado"
   - ❌ Token inválido → Mensagem: "Link inválido"
4. **Preenche o cadastro** normalmente
5. **Ao enviar**, token é marcado como usado automaticamente

---

## 🔒 Segurança

### ✅ Recursos de Segurança Implementados:

1. **Tokens criptografados** (32 caracteres aleatórios)
2. **Expiração automática** (2 horas padrão)
3. **Uso único** (não pode ser reutilizado)
4. **Rastreamento completo** (quem criou, quando, quem usou)
5. **RLS habilitado** (apenas admins podem gerar/ver tokens)
6. **Revogação manual** (administrador pode cancelar)
7. **Limpeza automática** (tokens expirados são removidos)

### 🛡️ Proteções Contra Ataques:

- **Brute force**: Token de 32 caracteres = 2^192 combinações
- **Token reuse**: Marcado como usado após primeiro uso
- **Time-based attacks**: Expiração rigorosa
- **Privilege escalation**: RLS garante apenas admins acessam

---

## 🧹 Manutenção

### Limpar Tokens Expirados

Execute periodicamente (ou configure cron job):

```sql
SELECT cleanup_expired_tokens();
```

Retorna o número de tokens deletados.

### Configurar Limpeza Automática (Supabase)

1. Acesse **Database** → **Functions**
2. Crie nova função agendada:
   ```sql
   SELECT cron.schedule(
     'cleanup-expired-tokens',
     '0 3 * * *', -- Todo dia às 3h da manhã
     'SELECT cleanup_expired_tokens();'
   );
   ```

---

## 📊 Relatórios e Monitoramento

### Tokens Gerados Hoje

```sql
SELECT 
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE used) as usados,
  COUNT(*) FILTER (WHERE NOT used AND expires_at > NOW()) as ativos,
  COUNT(*) FILTER (WHERE NOT used AND expires_at < NOW()) as expirados
FROM registration_tokens
WHERE created_at::date = CURRENT_DATE;
```

### Taxa de Conversão (Últimos 30 dias)

```sql
SELECT 
  COUNT(*) as total_gerados,
  COUNT(*) FILTER (WHERE used) as total_usados,
  ROUND(
    COUNT(*) FILTER (WHERE used)::NUMERIC / 
    NULLIF(COUNT(*), 0) * 100, 
    2
  ) as taxa_conversao_pct
FROM registration_tokens
WHERE created_at > NOW() - INTERVAL '30 days';
```

---

## 🐛 Troubleshooting

### Problema: "Link inválido" mesmo com token correto

**Solução:**
1. Verifique se a URL base foi configurada corretamente nas funções SQL
2. Confirme que o token não foi usado ou expirou
3. Execute `SELECT * FROM validate_registration_token('SEU_TOKEN');`

### Problema: Usuário não consegue acessar página de cadastro

**Solução:**
1. Verifique se o link tem o formato: `https://dominio.com/pages/cadastro.html?token=...`
2. Confirme que `cadastro.html` está validando o token corretamente
3. Veja o console do navegador para erros JavaScript

### Problema: Token expira muito rápido

**Solução:**
Gere tokens com mais tempo:
```sql
SELECT * FROM generate_registration_token(4); -- 4 horas
```

---

## 📱 Integração com WhatsApp/E-mail

### Exemplo de Mensagem WhatsApp:

```
🙏 *Igreja AD Bela-Vista*

Olá, João Silva!

Bem-vindo à nossa comunidade! 

Seu link para cadastro está pronto:
[LINK_AQUI]

⏰ *Importante:* Este link é válido por apenas *2 horas* e pode ser usado *uma vez*.

Se tiver dúvidas, entre em contato com a secretaria.

Que Deus abençoe! 🙌
```

### Exemplo de E-mail:

```html
<h2>Bem-vindo à Igreja AD Bela-Vista!</h2>
<p>Olá, <strong>João Silva</strong>!</p>
<p>Estamos felizes em tê-lo conosco. Para completar seu cadastro, clique no botão abaixo:</p>
<a href="[LINK_AQUI]" style="background:#c9a84c;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;display:inline-block;margin:20px 0;">
  ✝ Completar Cadastro
</a>
<p><small>Este link é válido por 2 horas e pode ser usado apenas uma vez.</small></p>
<p><small>Se você não solicitou este cadastro, ignore esta mensagem.</small></p>
```

---

## ✅ Checklist de Implementação

- [ ] Executar `GERAR_TOKEN_CADASTRO.sql` no Supabase
- [ ] Alterar URL base nas funções SQL
- [ ] Testar geração de token
- [ ] Testar link de cadastro com token
- [ ] Verificar validação de token expirado
- [ ] Verificar validação de token usado
- [ ] Configurar limpeza automática (cron)
- [ ] Criar templates de mensagem (WhatsApp/E-mail)
- [ ] Treinar equipe administrativa
- [ ] Documentar processo interno

---

## 📞 Suporte

Em caso de dúvidas ou problemas:
1. Verifique os logs do Supabase
2. Teste as funções SQL manualmente
3. Revise as permissões RLS
4. Verifique o console do navegador

---

**Criado para Igreja AD Bela-Vista** ✝  
*Sistema de Gestão de Membros*
