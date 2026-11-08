# 🚀 Scripts de Teste de Performance

Scripts para testar a velocidade e performance do site em produção.

## 📋 O que os scripts fazem?

- Testam o tempo de resposta de todas as páginas principais
- Fazem múltiplas requisições para obter média confiável
- Geram relatório com estatísticas detalhadas
- Classificam a performance (Excelente, Bom, Regular, Lento)
- Identificam páginas mais rápidas e mais lentas

## 🔧 Configuração

Antes de executar, **EDITE** o script e altere a URL:

```python
# Python
BASE_URL = "https://SEU-DOMINIO.vercel.app"
```

```powershell
# PowerShell
$BASE_URL = "https://SEU-DOMINIO.vercel.app"
```

Substitua por sua URL real, exemplo:
- `https://igreja-sistema.vercel.app`
- `https://adbelavista.com.br`

## 🐍 Usando Python (Linux/Mac/Windows)

### Requisitos
- Python 3.6 ou superior (já vem instalado no Linux/Mac)

### Executar
```bash
python test-performance.py
```

ou

```bash
python3 test-performance.py
```

### Resultado
- Mostra estatísticas no terminal
- Salva relatório JSON: `performance-test-YYYYMMDD-HHMMSS.json`

## 💻 Usando PowerShell (Windows)

### Executar
```powershell
.\test-performance.ps1
```

ou, se houver erro de política de execução:

```powershell
powershell -ExecutionPolicy Bypass -File .\test-performance.ps1
```

### Resultado
- Mostra estatísticas coloridas no terminal
- Não salva arquivo (só exibe no console)

## 📊 Interpretação dos Resultados

### Tempos de Resposta

| Tempo Médio | Classificação | O que significa |
|-------------|---------------|-----------------|
| < 200ms | 🟢 **EXCELENTE** | Site muito rápido, experiência ótima |
| 200-500ms | 🟡 **BOM** | Performance adequada, usuário satisfeito |
| 500-1000ms | 🟠 **REGULAR** | Pode melhorar, usuário percebe lentidão |
| > 1000ms | 🔴 **LENTO** | Precisa otimização urgente |

### Fatores que Afetam Performance

✅ **Bom para performance**:
- CDNs (Vercel, Cloudflare)
- Imagens otimizadas
- CSS/JS minificados
- Cache configurado
- HTTP/2 ativo

❌ **Ruim para performance**:
- Muitas bibliotecas externas
- Imagens grandes sem compressão
- Requests desnecessários
- Sem cache
- Servidor lento

## 📈 Exemplo de Saída

```
======================================================================
🚀 TESTE DE PERFORMANCE DO SITE
======================================================================
📍 URL Base: https://igreja-sistema.vercel.app
🔢 Requisições por página: 5
======================================================================

📄 Testando: /
   Req 1: ✅ 156ms (HTTP 200)
   Req 2: ✅ 142ms (HTTP 200)
   Req 3: ✅ 138ms (HTTP 200)
   Req 4: ✅ 145ms (HTTP 200)
   Req 5: ✅ 149ms (HTTP 200)
   📊 Média: 146ms | Min: 138ms | Max: 156ms

📄 Testando: /pages/admin.html
   Req 1: ✅ 234ms (HTTP 200)
   Req 2: ✅ 198ms (HTTP 200)
   Req 3: ✅ 210ms (HTTP 200)
   Req 4: ✅ 205ms (HTTP 200)
   Req 5: ✅ 215ms (HTTP 200)
   📊 Média: 212ms | Min: 198ms | Max: 234ms

======================================================================
📊 RESUMO GERAL
======================================================================
⏱️  Tempo Médio Geral: 185ms
🚀 Tempo Mais Rápido: 138ms
🐌 Tempo Mais Lento: 456ms

📈 Avaliação: 🟢 EXCELENTE
💬 Site muito rápido!

🏆 TOP 3 PÁGINAS MAIS RÁPIDAS:
   1. / - 146ms
   2. /pages/cadastro.html - 178ms
   3. /pages/privacidade.html - 182ms

======================================================================
✅ Teste concluído!
======================================================================
```

## 🔍 Análise de Problemas

### Se o site está lento:

1. **Verifique o Vercel Dashboard**
   - Acesse: https://vercel.com/dashboard
   - Veja métricas de performance
   - Confira logs de erros

2. **Verifique o Supabase**
   - Acesse: https://supabase.com/dashboard
   - Confira Database Statistics
   - Veja queries lentas

3. **Teste diferentes horários**
   - Execute script em horários diferentes
   - Compare resultados
   - Identifique padrões

4. **Teste de diferentes locais**
   - Use VPN para testar de outras regiões
   - Compare velocidades
   - Vercel tem edge network global

### Otimizações Comuns

✅ **Fáceis de implementar**:
- Ativar cache de assets estáticos
- Comprimir imagens
- Minificar CSS/JS
- Usar lazy loading

⚙️ **Médias**:
- Implementar Service Worker
- Otimizar queries do banco
- Usar índices no Supabase
- Reduzir número de requests

🔧 **Avançadas**:
- CDN personalizado
- Edge Functions do Vercel
- Database em região mais próxima
- Preload de recursos críticos

## 🆘 Troubleshooting

### Erro: "Invoke-WebRequest não reconhecido"
**Solução**: Use PowerShell (não CMD)

### Erro: "python não é reconhecido"
**Solução**: Instale Python de python.org

### Erro: "SSL Certificate error"
**Solução**: Verifique certificado SSL no Vercel

### Erro: "Connection timeout"
**Possíveis causas**:
- Site está offline
- URL incorreta
- Firewall bloqueando
- Problema de DNS

## 📱 Testes Complementares

Além destes scripts, teste também:

1. **Google PageSpeed Insights**
   - https://pagespeed.web.dev/
   - Análise completa de performance
   - Sugestões de otimização

2. **GTmetrix**
   - https://gtmetrix.com/
   - Relatório detalhado
   - Comparação histórica

3. **WebPageTest**
   - https://www.webpagetest.org/
   - Teste de múltiplas localizações
   - Waterfall de recursos

4. **Lighthouse (Chrome DevTools)**
   - F12 → Lighthouse
   - Performance, SEO, Accessibility
   - Relatório offline

## 💡 Dicas

- Execute testes **fora do horário de pico** para baseline
- Execute testes **no horário de pico** para ver comportamento real
- Compare resultados ao longo do tempo
- Documente mudanças que melhoraram/pioraram performance
- Teste após cada deploy importante

## 📊 Métricas Alvo (Recomendadas)

| Métrica | Alvo | Excelente |
|---------|------|-----------|
| **Tempo de Resposta** | < 500ms | < 200ms |
| **First Contentful Paint** | < 1.8s | < 1.0s |
| **Largest Contentful Paint** | < 2.5s | < 1.5s |
| **Time to Interactive** | < 3.8s | < 2.0s |
| **Cumulative Layout Shift** | < 0.1 | < 0.05 |

## 🔗 Links Úteis

- [Vercel Analytics](https://vercel.com/docs/analytics)
- [Web.dev Performance](https://web.dev/performance/)
- [MDN Web Performance](https://developer.mozilla.org/en-US/docs/Web/Performance)
- [Chrome User Experience Report](https://developers.google.com/web/tools/chrome-user-experience-report)

---

**Criado para**: Sistema de Gestão Eclesiástica AD Bela-Vista  
**Data**: 2024  
**Versão**: 1.0
