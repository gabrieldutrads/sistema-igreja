// Super Admin - Gerenciamento de Links Temporários
(function() {
  const db = window._supabaseClientInstance || window.getSupabaseClient();

  let tokens = [];
  let updateInterval = null;

  function toast(message) {
    const el = document.getElementById('toast');
    const msg = document.getElementById('toast-message');
    msg.textContent = message;
    el.classList.add('show');
    setTimeout(() => el.classList.remove('show'), 3000);
  }

  function setLoading(show) {
    document.getElementById('loading').classList.toggle('hidden', !show);
  }

  function formatTimeRemaining(seconds) {
    if (seconds <= 0) return 'Expirado';
    
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`;
    }
    return `${minutes}m ${secs}s`;
  }

  function getCountdownClass(seconds) {
    if (seconds <= 0) return '';
    if (seconds < 600) return 'danger'; // < 10 min
    if (seconds < 1800) return 'warning'; // < 30 min
    return '';
  }

  function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  async function gerarToken(event) {
    event.preventDefault();
    
    const recipientName = document.getElementById('recipient-name').value.trim();
    const recipientContact = document.getElementById('recipient-contact').value.trim();
    const notes = document.getElementById('notes').value.trim();
    
    const btn = event.target.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Gerando...';

    try {
      const { data, error } = await db.rpc('generate_registration_token', {
        p_notes: notes || null,
        p_recipient_name: recipientName,
        p_recipient_contact: recipientContact,
        p_duration_hours: 2
      });

      if (error) throw error;

      const result = data[0];
      
      // Limpa formulário
      document.getElementById('generate-form').reset();
      
      // Mostra link gerado
      mostrarLinkGerado(result);
      
      // Recarrega lista
      await carregarTokens();
      
      toast('✅ Link gerado com sucesso!');
    } catch (error) {
      console.error('Erro ao gerar token:', error);
      toast('❌ Erro ao gerar link: ' + error.message);
    } finally {
      btn.disabled = false;
      btn.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i> Gerar Link Temporário';
    }
  }

  window.gerarToken = gerarToken;

  function mostrarLinkGerado(result) {
    const modal = document.createElement('div');
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;z-index:10000;padding:1rem;';
    
    const content = document.createElement('div');
    content.style.cssText = 'background:white;border-radius:16px;padding:2rem;max-width:600px;width:100%;';
    
    const expires = new Date(result.expires_at);
    const now = new Date();
    const timeLeft = Math.floor((expires - now) / 1000);
    
    content.innerHTML = `
      <div style="text-align:center;margin-bottom:1.5rem;">
        <div style="width:80px;height:80px;background:linear-gradient(135deg,#16a34a,#22c55e);border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 1rem;box-shadow:0 10px 30px rgba(22,163,74,0.3);">
          <i class="fa-solid fa-check" style="font-size:2.5rem;color:white;"></i>
        </div>
        <h2 style="font-size:1.5rem;font-weight:700;margin-bottom:0.5rem;">Link Gerado!</h2>
        <p style="color:#64748b;">Válido por 2 horas</p>
      </div>

      <div style="background:#f8fafc;padding:1rem;border-radius:8px;margin-bottom:1.5rem;">
        <label style="display:block;font-weight:600;font-size:0.875rem;margin-bottom:0.5rem;">Link de Cadastro:</label>
        <div style="display:flex;gap:0.5rem;">
          <input type="text" id="generated-url" value="${result.registration_url}" readonly style="flex:1;padding:0.75rem;border:2px solid #e2e8f0;border-radius:6px;font-family:monospace;font-size:0.75rem;">
          <button onclick="copiarLink()" style="padding:0.75rem 1rem;background:#1e40af;color:white;border:none;border-radius:6px;cursor:pointer;font-weight:600;">
            <i class="fa-solid fa-copy"></i>
          </button>
        </div>
      </div>

      <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:1rem;margin-bottom:1.5rem;font-size:0.875rem;">
        <div style="background:#f8fafc;padding:1rem;border-radius:6px;">
          <div style="color:#64748b;margin-bottom:0.25rem;">Expira em:</div>
          <div style="font-weight:700;color:#1e40af;">${formatTimeRemaining(timeLeft)}</div>
        </div>
        <div style="background:#f8fafc;padding:1rem;border-radius:6px;">
          <div style="color:#64748b;margin-bottom:0.25rem;">Expira às:</div>
          <div style="font-weight:700;">${formatDate(result.expires_at)}</div>
        </div>
      </div>

      <div style="display:flex;gap:0.75rem;">
        <button onclick="compartilharWhatsApp('${encodeURIComponent(result.registration_url)}')" style="flex:1;padding:0.75rem;background:#25d366;color:white;border:none;border-radius:8px;cursor:pointer;font-weight:600;">
          <i class="fa-brands fa-whatsapp"></i> WhatsApp
        </button>
        <button onclick="compartilharEmail('${encodeURIComponent(result.registration_url)}')" style="flex:1;padding:0.75rem;background:#1e40af;color:white;border:none;border-radius:8px;cursor:pointer;font-weight:600;">
          <i class="fa-solid fa-envelope"></i> E-mail
        </button>
      </div>

      <button onclick="this.closest('[style*=fixed]').remove()" style="width:100%;margin-top:1rem;padding:0.75rem;background:#f1f5f9;border:none;border-radius:8px;cursor:pointer;font-weight:600;">
        Fechar
      </button>
    `;
    
    modal.appendChild(content);
    document.body.appendChild(modal);
    
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.remove();
    });
  }

  window.copiarLink = function() {
    const input = document.getElementById('generated-url');
    input.select();
    document.execCommand('copy');
    toast('✅ Link copiado!');
  };

  window.compartilharWhatsApp = function(url) {
    const message = encodeURIComponent(
      `🏛️ *Cadastro AD Bela-Vista*\n\n` +
      `Você foi convidado(a) a realizar seu cadastro!\n\n` +
      `⏰ Este link é válido por *2 horas*\n` +
      `🔗 Acesse: ${decodeURIComponent(url)}\n\n` +
      `_Qualquer dúvida, entre em contato conosco._`
    );
    window.open(`https://wa.me/?text=${message}`, '_blank');
  };

  window.compartilharEmail = function(url) {
    const subject = encodeURIComponent('Convite para Cadastro - AD Bela-Vista');
    const body = encodeURIComponent(
      `Olá!\n\n` +
      `Você foi convidado(a) a realizar seu cadastro na Igreja AD Bela-Vista.\n\n` +
      `IMPORTANTE: Este link é válido por apenas 2 horas.\n\n` +
      `Clique no link abaixo para acessar o formulário de cadastro:\n` +
      `${decodeURIComponent(url)}\n\n` +
      `Qualquer dúvida, entre em contato conosco.\n\n` +
      `Atenciosamente,\n` +
      `Administração AD Bela-Vista`
    );
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  };

  async function carregarTokens() {
    try {
      const { data, error } = await db.rpc('list_registration_tokens', {
        p_show_all: true
      });

      if (error) throw error;

      tokens = data || [];
      renderizarTokens();
      atualizarEstatisticas();
    } catch (error) {
      console.error('Erro ao carregar tokens:', error);
    }
  }

  window.carregarTokens = carregarTokens;

  function renderizarTokens() {
    const container = document.getElementById('tokens-container');
    
    if (!tokens.length) {
      container.innerHTML = `
        <div class="empty-state">
          <i class="fa-solid fa-inbox"></i>
          <p>Nenhum link gerado ainda</p>
        </div>
      `;
      return;
    }

    container.innerHTML = tokens.map(token => {
      let statusBadge = '';
      let statusClass = '';
      
      if (token.used_at) {
        statusBadge = '<span class="badge used"><i class="fa-solid fa-check"></i> Usado</span>';
        statusClass = 'used';
      } else if (token.is_expired || token.time_remaining_seconds <= 0) {
        statusBadge = '<span class="badge expired"><i class="fa-solid fa-clock"></i> Expirado</span>';
        statusClass = 'expired';
      } else {
        const countdownClass = getCountdownClass(token.time_remaining_seconds);
        statusBadge = `<span class="badge active"><i class="fa-solid fa-circle-check"></i> Ativo</span>`;
        statusClass = '';
      }

      const url = `${window.location.origin}/cadastro.html?token=${token.token}`;
      
      const countdown = token.time_remaining_seconds > 0 && !token.used_at
        ? `<div class="countdown ${getCountdownClass(token.time_remaining_seconds)}" data-expires="${token.expires_at}">
             <i class="fa-solid fa-hourglass-half"></i>
             ${formatTimeRemaining(token.time_remaining_seconds)}
           </div>`
        : '';

      return `
        <div class="token-item ${statusClass}">
          <div class="token-header">
            <div class="token-info">
              <div style="display:flex;align-items:center;gap:0.75rem;margin-bottom:0.5rem;">
                ${statusBadge}
                ${countdown}
              </div>
              <div style="font-weight:600;margin-bottom:0.25rem;">
                ${token.recipient_name || 'Sem nome'}
              </div>
              <div style="font-size:0.8125rem;color:#64748b;">
                ${token.recipient_contact || ''}
              </div>
              ${token.notes ? `<div style="font-size:0.8125rem;color:#64748b;margin-top:0.25rem;font-style:italic;">${token.notes}</div>` : ''}
              <div class="token-url">${url}</div>
              <div class="token-meta">
                <span><i class="fa-solid fa-user"></i> ${token.created_by_email}</span>
                <span><i class="fa-solid fa-calendar"></i> ${formatDate(token.created_at)}</span>
                <span><i class="fa-solid fa-clock"></i> Expira: ${formatDate(token.expires_at)}</span>
                ${token.used_at ? `<span><i class="fa-solid fa-check"></i> Usado: ${formatDate(token.used_at)}</span>` : ''}
              </div>
            </div>
            <div class="token-actions">
              <button class="btn btn-sm btn-primary" onclick="copiarTokenUrl('${url}')" title="Copiar link">
                <i class="fa-solid fa-copy"></i>
              </button>
              ${!token.used_at && token.time_remaining_seconds > 0 ? `
                <button class="btn btn-sm btn-danger" onclick="revogarToken('${token.id}')" title="Revogar">
                  <i class="fa-solid fa-ban"></i>
                </button>
              ` : ''}
            </div>
          </div>
        </div>
      `;
    }).join('');

    iniciarAtualizacaoContadores();
  }

  window.copiarTokenUrl = function(url) {
    navigator.clipboard.writeText(url).then(() => {
      toast('✅ Link copiado!');
    });
  };

  window.revogarToken = async function(tokenId) {
    if (!confirm('Deseja realmente revogar este link?')) return;

    try {
      const { data, error } = await db.rpc('revoke_registration_token', {
        p_token_id: tokenId
      });

      if (error) throw error;
      if (!data) throw new Error('O link já foi usado, expirou ou não pode ser revogado.');

      toast('✅ Link revogado');
      await carregarTokens();
    } catch (error) {
      console.error('Erro ao revogar:', error);
      toast('❌ Erro ao revogar link');
    }
  };

  function atualizarEstatisticas() {
    const active = tokens.filter(t => !t.used_at && !t.is_expired && t.time_remaining_seconds > 0).length;
    const used = tokens.filter(t => t.used_at).length;
    const expired = tokens.filter(t => t.is_expired || (t.time_remaining_seconds <= 0 && !t.used_at)).length;

    document.getElementById('stat-active').textContent = active;
    document.getElementById('stat-used').textContent = used;
    document.getElementById('stat-expired').textContent = expired;
  }

  function iniciarAtualizacaoContadores() {
    if (updateInterval) clearInterval(updateInterval);

    updateInterval = setInterval(() => {
      const countdowns = document.querySelectorAll('.countdown[data-expires]');
      let needsRefresh = false;

      countdowns.forEach(el => {
        const expires = new Date(el.dataset.expires);
        const now = new Date();
        const seconds = Math.floor((expires - now) / 1000);

        if (seconds <= 0) {
          el.innerHTML = '<i class="fa-solid fa-clock"></i> Expirado';
          el.classList.remove('warning');
          el.classList.add('danger');
          needsRefresh = true;
        } else {
          el.className = 'countdown ' + getCountdownClass(seconds);
          el.innerHTML = `<i class="fa-solid fa-hourglass-half"></i> ${formatTimeRemaining(seconds)}`;
        }
      });

      if (needsRefresh) {
        setTimeout(() => carregarTokens(), 1000);
      }
    }, 1000);
  }

  async function sair() {
    await db.auth.signOut();
    window.location.href = 'admin.html';
  }

  window.sair = sair;

  async function init() {
    try {
      setLoading(true);

      const { data: { session } } = await db.auth.getSession();
      if (!session) {
        window.location.href = 'admin.html';
        return;
      }

      // Verifica se é super admin
      const { data: profile } = await db
        .from('profiles')
        .select('role')
        .eq('id', session.user.id)
        .single();

      if (profile?.role !== 'admin') {
        alert('Acesso negado. Esta área é exclusiva para super administradores.');
        window.location.href = 'admin.html';
        return;
      }

      await carregarTokens();
      
      // Atualiza lista a cada 30 segundos
      setInterval(() => carregarTokens(), 30000);
      
    } catch (error) {
      console.error('Erro ao inicializar:', error);
      toast('❌ Erro ao carregar página');
    } finally {
      setLoading(false);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
