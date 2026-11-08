// Cadastro de Membros — versão simplificada
// Campos: Nome completo, Telefone, Batizado com Espírito Santo?

(function () {

  const db = window._supabaseClientInstance || window.getSupabaseClient();
  const params = new URLSearchParams(window.location.search);
  const isMemberFlow = params.get('origem') === 'membro';
  const registrationToken = params.get('token');
  const MEMBER_SESSION_KEY = 'ad_bela_vista_member_session';
  let tokenValidation = null;
  const PUBLIC_SUBMISSION_KEY = 'ad_bela_vista_public_submission_guard';
  const PUBLIC_SUBMISSION_COOLDOWN_MS = 5 * 60 * 1000;
  const PRIVACY_POLICY_VERSION = window.CONFIG.PRIVACY_POLICY_VERSION;
  let currentSession = null;
  let privacidadeInicialAceita = false;

  function carregarSessaoMembro() {
    try {
      currentSession = JSON.parse(sessionStorage.getItem(MEMBER_SESSION_KEY) || localStorage.getItem(MEMBER_SESSION_KEY) || 'null');
    } catch (error) {
      currentSession = null;
    }

    if (isMemberFlow && !currentSession?.token) {
      window.location.href = '/pages/membro-login.html';
    }
  }

  carregarSessaoMembro();

  function onlyDigits(value) {
    return String(value || '').replace(/\D/g, '');
  }

  function submissionFingerprint(dados) {
    return [
      onlyDigits(dados?.celular).slice(-8),
      String(dados?.nome || '').trim().toLowerCase().slice(0, 48)
    ].filter(Boolean).join(':');
  }

  function getPublicSubmissionGuard() {
    try {
      return JSON.parse(localStorage.getItem(PUBLIC_SUBMISSION_KEY) || 'null');
    } catch (error) {
      localStorage.removeItem(PUBLIC_SUBMISSION_KEY);
      return null;
    }
  }

  function assertPublicSubmissionAllowed(dados) {
    if (isMemberFlow) return;

    const trap = document.getElementById('website');
    if (trap?.value) {
      throw new Error('Não foi possível validar o envio.');
    }

    const previous = getPublicSubmissionGuard();
    const fingerprint = submissionFingerprint(dados);
    if (!previous?.at || !previous?.fingerprint || previous.fingerprint !== fingerprint) return;

    const elapsed = Date.now() - Number(previous.at || 0);
    if (elapsed < PUBLIC_SUBMISSION_COOLDOWN_MS) {
      const wait = Math.ceil((PUBLIC_SUBMISSION_COOLDOWN_MS - elapsed) / 60000);
      throw new Error(`Aguarde ${wait} minuto(s) antes de reenviar esta ficha.`);
    }
  }

  function rememberPublicSubmission(dados) {
    if (isMemberFlow) return;
    localStorage.setItem(PUBLIC_SUBMISSION_KEY, JSON.stringify({
      fingerprint: submissionFingerprint(dados),
      at: Date.now()
    }));
  }

  function prepararProtecaoPublica() {
    if (isMemberFlow) return;
    const form = document.getElementById('form-cadastro');
    if (!form || document.getElementById('website')) return;

    const trap = document.createElement('input');
    trap.type = 'text';
    trap.id = 'website';
    trap.name = 'website';
    trap.tabIndex = -1;
    trap.autocomplete = 'off';
    trap.setAttribute('aria-hidden', 'true');
    trap.style.position = 'absolute';
    trap.style.left = '-9999px';
    trap.style.width = '1px';
    trap.style.height = '1px';
    trap.style.opacity = '0';
    form.appendChild(trap);
  }

  // ── Validações ───────────────────────────────
  function validarNome(input) {
    const hint = document.createElement('div');
    hint.id = 'hint-nome';
    hint.className = 'hint';

    if (!document.getElementById('hint-nome')) {
      input.parentNode.appendChild(hint);
    }

    const valor = input.value;
    const regex = /^[A-Za-zÀ-ÿ\s]+$/;

    if (!valor) {
      hint.textContent = '';
      input.classList.remove('valido', 'invalido');
      return;
    }

    if (!regex.test(valor)) {
      hint.textContent = '❌ Apenas letras são permitidas.';
      hint.className = 'hint erro';
      input.classList.add('invalido');
      input.classList.remove('valido');
    } else if (valor.trim().split(' ').length < 2) {
      hint.textContent = '⚠️ Digite nome completo.';
      hint.className = 'hint erro';
      input.classList.add('invalido');
      input.classList.remove('valido');
    } else {
      hint.textContent = '✓ Nome válido';
      hint.className = 'hint ok';
      input.classList.add('valido');
      input.classList.remove('invalido');
    }
  }
  window.validarNome = validarNome;

  function bloquearNumeros(input) {
    input.value = input.value.replace(/[0-9]/g, '');
  }
  window.bloquearNumeros = bloquearNumeros;

  function maskPhone(i) {
    let v = i.value.replace(/\D/g, '');
    v = v.slice(0, 11);
    if (v.length <= 10) v = v.replace(/^(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3');
    else v = v.replace(/^(\d{2})(\d{5})(\d{0,4})/, '($1) $2-$3');
    i.value = v;
  }
  window.maskPhone = maskPhone;

  function validarTelefone(input, hintId, obrigatorio = false) {
    const hint = document.getElementById(hintId);
    if (!hint) return;
    const v = input.value.replace(/\D/g, '');

    if (!v && !obrigatorio) {
      hint.textContent = '';
      input.classList.remove('valido', 'invalido');
      return;
    }

    if (v.length < 10 || v.length > 11) {
      if (obrigatorio || v.length > 0) {
        hint.textContent = 'Número incompleto (DDD + número).';
        hint.className = 'hint erro';
        input.classList.add('invalido');
        input.classList.remove('valido');
      }
    } else {
      hint.textContent = '✓ Válido';
      hint.className = 'hint ok';
      input.classList.add('valido');
      input.classList.remove('invalido');
    }
  }
  window.validarTelefone = validarTelefone;

  // ── TOAST ─────────────────────────────
  function toast(msg, tipo = '', dur = 3200) {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.className = tipo ? `show ${tipo}` : 'show';
    setTimeout(() => t.className = '', dur);
  }
  window.toast = toast;

  // ── Coleta dados simplificados ───────────────────────
  function coletarDados() {
    const batismoEs = document.querySelector('input[name="batismo_espirito_santo"]:checked')?.value || 'prefiro_nao_informar';

    const dados = {
      tipo_cadastro: 'Congregado', // Padrão simplificado
      nome: document.getElementById('nome').value.trim(),
      celular: document.getElementById('celular').value.trim(),
      batismo_espirito_santo: batismoEs,
      privacy_version: PRIVACY_POLICY_VERSION,
      privacy_consent: document.getElementById('privacy-final-consent')?.checked === true,
      privacy_source: isMemberFlow ? 'member_registration' : 'public_registration',
      status: isMemberFlow ? 'Em análise' : 'Pendente'
    };

    if (currentSession?.accountId) {
      dados.member_account_id = currentSession.accountId;
    }

    return dados;
  }
  window.coletarDados = coletarDados;

  function validar(dados) {
    let ok = true;

    const required = [
      ['nome', document.getElementById('nome')],
      ['celular', document.getElementById('celular')]
    ];

    required.forEach(([k, el]) => {
      if (!el) return;
      if (!dados[k] || String(dados[k]).trim() === '') {
        el.classList.add('invalid');
        ok = false;
      } else {
        el.classList.remove('invalid');
      }
    });

    // Validar telefone
    const celDigits = (dados.celular || '').replace(/\D/g, '');
    if (celDigits.length > 0 && celDigits.length < 10) {
      document.getElementById('celular').classList.add('invalid');
      ok = false;
    }

    // Consentimento obrigatório
    const consentimento = document.getElementById('privacy-final-consent');
    if (!consentimento?.checked) {
      consentimento?.classList.add('invalid');
      const hint = document.getElementById('hint-privacy-final');
      if (hint) {
        hint.textContent = 'É obrigatório marcar "Li e aceito" antes de finalizar o cadastro.';
        hint.className = 'hint erro';
      }
      ok = false;
    }

    return ok;
  }
  window.validar = validar;

  async function salvarMembro() {
    if (isMemberFlow && !currentSession?.token) {
      carregarSessaoMembro();
      if (!currentSession?.token) return;
    }

    if (!privacidadeInicialAceita) {
      toast('⚠️ É necessário aceitar os termos de privacidade.', 'erro');
      mostrarTelaPrivacidadeCadastro();
      return;
    }

    if (!PRIVACY_POLICY_VERSION) {
      toast('❌ A versão dos termos de privacidade não está configurada.', 'erro');
      return;
    }

    const dados = coletarDados();

    if (!validar(dados)) {
      toast('⚠️ Preencha os campos obrigatórios.', 'erro');
      const invalido = document.querySelector('.invalid');
      invalido?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    try {
      assertPublicSubmissionAllowed(dados);
    } catch (error) {
      toast(error.message || 'Não foi possível validar o envio.', 'erro', 7000);
      return;
    }

    const btn = document.getElementById('btn-salvar');
    btn.innerHTML = '<span class="spin"></span> Enviando…';
    btn.disabled = true;

    try {
      if (isMemberFlow) {
        const { error } = await db.rpc('member_create_registration', {
          p_session_token: currentSession.token,
          p_payload: dados
        });
        if (error) throw error;
      } else {
        const { data: membroInserido, error } = await db.from('membros')
          .insert([dados])
          .select('id, nome_completo')
          .single();
        if (error) throw error;

        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('admin') === '1' && membroInserido) {
          toast('✅ Cadastro salvo! Redirecionando...', 'sucesso', 2000);
          setTimeout(() => {
            window.location.href = `/pages/admin.html?novo_membro=${membroInserido.id}&nome=${encodeURIComponent(membroInserido.nome_completo)}`;
          }, 2000);
          return;
        }
      }

      if (isMemberFlow) {
        window.location.href = '/pages/membro.html?cadastro=ok';
        return;
      }

      document.getElementById('app').style.display = 'none';
      document.getElementById('tela-sucesso').classList.add('show');
      rememberPublicSubmission(dados);
      window.scrollTo(0, 0);
    } catch (e) {
      const detalhe = e?.message || e?.details || e?.hint || 'Tente novamente.';
      console.warn('Erro ao salvar cadastro:', e);
      toast(`❌ Erro ao enviar: ${detalhe}`, 'erro', 7000);
      btn.innerHTML = '✝ Enviar Cadastro';
      btn.disabled = false;
    }
  }

  window.salvarMembro = salvarMembro;

  function atualizarConsentimentoFinal() {
    const consentimento = document.getElementById('privacy-final-consent');
    const botao = document.getElementById('btn-salvar');
    const hint = document.getElementById('hint-privacy-final');
    const aceito = consentimento?.checked === true;

    if (botao) botao.disabled = !aceito;
    consentimento?.classList.remove('invalid');
    if (hint && aceito) {
      hint.textContent = 'Consentimento confirmado. Agora você pode finalizar o cadastro.';
      hint.className = 'hint ok';
    } else if (hint) {
      hint.textContent = '';
      hint.className = 'hint';
    }
  }

  document.getElementById('privacy-final-consent')?.addEventListener('change', atualizarConsentimentoFinal);

  function novoCadastro() {
    document.getElementById('tela-sucesso').classList.remove('show');
    document.getElementById('app').style.display = 'block';
    document.querySelectorAll('input[type=text], input[type=tel], input[type=email], textarea, select').forEach(el => el.value = '');
    document.querySelectorAll('input[type=radio]').forEach(el => el.checked = false);
    document.querySelector('input[name="batismo_espirito_santo"][value="prefiro_nao_informar"]')?.checked = true;
    document.querySelectorAll('.hint').forEach(hint => {
      hint.textContent = '';
      hint.className = 'hint';
    });
    document.getElementById('btn-salvar').innerHTML = '✝ Enviar Cadastro';
    document.getElementById('btn-salvar').disabled = true;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  window.novoCadastro = novoCadastro;

  function mostrarTelaPrivacidadeCadastro() {
    privacidadeInicialAceita = false;
    document.getElementById('tela-privacidade-cadastro').classList.remove('cadastro-flow-hidden');
    document.getElementById('cadastro-formulario').classList.add('cadastro-flow-hidden');
    document.querySelector('.submit-wrap')?.classList.add('cadastro-flow-hidden');
  }

  function aceitarPrivacidadeInicial() {
    privacidadeInicialAceita = true;
    document.getElementById('tela-privacidade-cadastro').classList.add('cadastro-flow-hidden');
    document.getElementById('cadastro-formulario').classList.remove('cadastro-flow-hidden');
    document.querySelector('.submit-wrap')?.classList.remove('cadastro-flow-hidden');
    document.getElementById('cadastro-formulario')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  window.aceitarPrivacidadeInicial = aceitarPrivacidadeInicial;

  // Valida token antes de mostrar página
  (async function() {
    const isValid = await validarTokenCadastro();
    if (isValid) {
      mostrarTelaPrivacidadeCadastro();
    }
  })();

  // Valida token de cadastro
  async function validarTokenCadastro() {
    if (!registrationToken) {
      mostrarAcessoNegado();
      return false;
    }

    try {
      const { data, error } = await db.rpc('validate_registration_token', {
        p_token: registrationToken
      });

      if (error) throw error;

      const validation = data?.[0];

      if (!validation || !validation.valid) {
        if (validation?.expired) {
          mostrarTokenExpirado(validation);
        } else if (validation?.used) {
          mostrarTokenUsado();
        } else {
          mostrarTokenInvalido();
        }
        return false;
      }

      tokenValidation = validation;
      iniciarContagemRegressiva(validation.time_remaining_seconds);
      return true;

    } catch (error) {
      console.error('Erro ao validar token:', error);
      mostrarErroValidacao();
      return false;
    }
  }

  // ── Telas de erro/aviso (sem botão de voltar) ─────────────────────

  function criarTelaErro(titulo, icone, corIcone, mensagem, detalhe = '') {
    document.body.innerHTML = `
      <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;padding:2rem;text-align:center;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);">
        <div style="background:white;padding:3rem;border-radius:16px;box-shadow:0 20px 60px rgba(0,0,0,0.3);max-width:500px;width:100%;">
          <div style="width:80px;height:80px;background:${corIcone}20;border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 1.5rem;">
            <i class="fa-solid ${icone}" style="font-size:2.5rem;color:${corIcone};"></i>
          </div>
          <h1 style="font-size:1.75rem;font-weight:700;color:#1a1a1a;margin:0 0 1rem;">${titulo}</h1>
          <p style="color:#666;line-height:1.6;margin:0 0 1.5rem;">${mensagem}</p>
          ${detalhe ? `<p style="color:#666;font-size:0.875rem;margin:1rem 0;">${detalhe}</p>` : ''}
        </div>
      </div>
    `;
  }

  function mostrarAcessoNegado() {
    criarTelaErro(
      'Acesso Restrito',
      'fa-lock',
      '#dc2626',
      'O cadastro é feito apenas através de link de convite.',
      '<strong>Entre em contato com a secretaria da igreja</strong> para solicitar seu link personalizado.'
    );
  }

  function mostrarTokenExpirado(validation) {
    criarTelaErro(
      'Este link não está mais disponível.',
      'fa-hourglass-end',
      '#f59e0b',
      'Por segurança, cada link possui um prazo limitado de utilização.',
      'Entre em contato com a secretaria da igreja para solicitar um novo acesso.'
    );
  }

  function mostrarTokenUsado() {
    criarTelaErro(
      'Este link não está mais disponível.',
      'fa-check-circle',
      '#3b82f6',
      'Este link de cadastro já foi utilizado. Cada link pode ser usado apenas uma vez.',
      'Se você ainda não completou seu cadastro, entre em contato com a secretaria.'
    );
  }

  function mostrarTokenInvalido() {
    criarTelaErro(
      'Este link não está mais disponível.',
      'fa-exclamation-triangle',
      '#dc2626',
      'Este link de cadastro não é válido ou foi revogado.',
      'Entre em contato com a secretaria para obter um novo link.'
    );
  }

  function mostrarErroValidacao() {
    criarTelaErro(
      'Erro de Conexão',
      'fa-wifi',
      '#dc2626',
      'Não foi possível validar o link de cadastro. Verifique sua conexão com a internet.',
      '<button onclick="window.location.reload()" style="padding:0.75rem 1.5rem;background:#c9a84c;color:white;border:none;border-radius:8px;cursor:pointer;font-weight:600;width:100%;margin-top:1rem;"><i class="fa-solid fa-rotate"></i> Tentar Novamente</button>'
    );
  }

  // Contagem regressiva
  let countdownInterval = null;
  function iniciarContagemRegressiva(secondsRemaining) {
    const banner = document.createElement('div');
    banner.id = 'countdown-banner';
    banner.style.cssText = 'position:fixed;top:0;left:0;right:0;background:linear-gradient(135deg,#1e40af,#3b82f6);color:white;padding:1rem;text-align:center;z-index:9998;box-shadow:0 4px 12px rgba(0,0,0,0.15);';
    banner.innerHTML = `
      <div style="max-width:1200px;margin:0 auto;display:flex;align-items:center;justify-content:center;gap:1rem;flex-wrap:wrap;">
        <i class="fa-solid fa-hourglass-half"></i>
        <span style="font-weight:600;">Este link expira em:</span>
        <strong id="countdown-time" style="font-size:1.125rem;font-family:monospace;"></strong>
      </div>
    `;

    document.body.insertBefore(banner, document.body.firstChild);
    document.body.style.paddingTop = banner.offsetHeight + 'px';

    let remaining = secondsRemaining;

    function atualizarContador() {
      if (remaining <= 0) {
        clearInterval(countdownInterval);
        mostrarTokenExpirado({ expires_at: new Date().toISOString() });
        return;
      }

      const minutes = Math.floor(remaining / 60);
      const seconds = remaining % 60;

      const timeEl = document.getElementById('countdown-time');
      if (timeEl) {
        timeEl.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

        if (remaining < 60) {
          banner.style.background = 'linear-gradient(135deg,#dc2626,#ef4444)';
        } else if (remaining < 300) {
          banner.style.background = 'linear-gradient(135deg,#f59e0b,#fbbf24)';
        }
      }

      remaining--;
    }

    atualizarContador();
    countdownInterval = setInterval(atualizarContador, 1000);
  }

  prepararProtecaoPublica();

})();