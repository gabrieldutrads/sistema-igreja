// Painel do Pastor — lógica do admin
// Extraído do admin.html para arquivo separado.

(function () {
  const SUPABASE_URL = window.CONFIG.SUPABASE_URL;
  const SUPABASE_KEY = window.CONFIG.SUPABASE_KEY;

  const db = window._supabaseClientInstance || window.getSupabaseClient();

  let membrosCache = [], paginaAtual = 1, anivAberto = false;
  let metricChart = null;
  let indicadorAtivo = null, tipoVisualizacaoIndicador = 'bar';
  let historicoNotif = [], notifNaoLidas = 0, primeiraLeitura = true;
  const POR_PAGINA = 20;
  const ADMIN_ROLES = ['admin', 'pastor', 'secretario'];
  const DELETE_ROLES = ['admin', 'secretario'];
  let currentAdminRole = null;
  const INDICADORES_CAROUSEL = ['total', 'membros', 'congregados', 'ativos', 'mes'];
  let indicadorCarouselAtual = 0;
  const SAFE_URL_PROTOCOLS = new Set(['http:', 'https:']);
  let recoverySessionReady = false;

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[char]));
  }

  function escapeAttr(value) {
    return escapeHtml(value).replace(/`/g, '&#96;');
  }

  function jsString(value) {
    return JSON.stringify(String(value ?? '')).replace(/</g, '\\u003C');
  }

  function safeText(value, fallback = '—') {
    const text = value === null || value === undefined || value === '' ? fallback : value;
    return escapeHtml(text);
  }

  function safeUrl(value) {
    if (!value) return '';
    try {
      const url = new URL(String(value), window.location.origin);
      if (!SAFE_URL_PROTOCOLS.has(url.protocol)) return '';
      return escapeAttr(url.href);
    } catch (e) {
      return '';
    }
  }

  function obterConfiguracoesAdmin() {
    try {
      return JSON.parse(localStorage.getItem('admin-page-settings') || '{}') || {};
    } catch (error) {
      return {};
    }
  }

  function mostrarTela(id) {
    const carregando = document.getElementById('tela-carregando');
    if (carregando) carregando.classList.remove('ativa');
    ['tela-login', 'tela-principal'].forEach(t => {
      const el = document.getElementById(t);
      el.classList.remove('ativa');
      el.style.display = 'none';
    });
    const alvo = document.getElementById(id);
    alvo.style.display = '';
    setTimeout(() => alvo.classList.add('ativa'), 10);
  }

  window.mostrarTela = mostrarTela;

  function mostrarErroLogin(message) {
    const erro = document.getElementById('login-erro');
    if (!erro) return;
    erro.textContent = message;
    erro.classList.add('show');
  }

  function limparErroLogin() {
    const erro = document.getElementById('login-erro');
    if (!erro) return;
    erro.textContent = '';
    erro.classList.remove('show');
  }

  function alternarRecuperacaoSenha(abrir) {
    const panel = document.getElementById('recovery-panel');
    const email = document.getElementById('recovery-email');
    const loginEmail = document.getElementById('login-email');
    if (!panel) return;

    panel.hidden = !abrir;
    if (abrir) {
      if (!recoverySessionReady) mostrarEtapaCodigoRecuperacao();
      if (email && loginEmail?.value && !email.value) email.value = loginEmail.value.trim();
      email?.focus();
    } else {
      recoverySessionReady = false;
      mostrarEtapaCodigoRecuperacao();
      limparErroLogin();
    }
  }

  window.alternarRecuperacaoSenha = alternarRecuperacaoSenha;

  function recuperarDadosSenha() {
    return {
      email: document.getElementById('recovery-email')?.value.trim() || document.getElementById('login-email')?.value.trim() || '',
      code: document.getElementById('recovery-code')?.value.trim() || '',
      password: document.getElementById('recovery-password')?.value || '',
      confirm: document.getElementById('recovery-password-confirm')?.value || ''
    };
  }

  function recoveryRedirectUrl() {
    return `${window.location.origin}${window.location.pathname}`;
  }

  function mostrarEtapaCodigoRecuperacao() {
    const fields = document.getElementById('recovery-password-fields');
    const reset = document.getElementById('btn-recovery-reset');
    const skip = document.getElementById('btn-recovery-skip');
    const verify = document.getElementById('btn-recovery-verify');

    if (fields) fields.hidden = true;
    if (reset) reset.hidden = true;
    if (skip) skip.hidden = true;
    if (verify) verify.hidden = false;
  }

  function mostrarOpcoesAposCodigo() {
    const fields = document.getElementById('recovery-password-fields');
    const reset = document.getElementById('btn-recovery-reset');
    const skip = document.getElementById('btn-recovery-skip');
    const verify = document.getElementById('btn-recovery-verify');

    if (fields) fields.hidden = false;
    if (reset) reset.hidden = false;
    if (skip) skip.hidden = false;
    if (verify) verify.hidden = true;
  }

  async function solicitarCodigoRecuperacao() {
    const { email } = recuperarDadosSenha();
    const btn = document.getElementById('btn-recovery-send');
    if (!email) {
      mostrarErroLogin('Informe o e-mail do usuario.');
      return;
    }

    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<span class="loading"></span> Enviando...';
    }

    const { error } = await db.auth.resetPasswordForEmail(email, {
      redirectTo: recoveryRedirectUrl()
    });

    if (btn) {
      btn.disabled = false;
      btn.textContent = 'Enviar codigo por e-mail';
    }

    if (error) {
      mostrarErroLogin(error.message || 'Nao foi possivel enviar o e-mail de recuperacao.');
      return;
    }

    recoverySessionReady = false;
    mostrarEtapaCodigoRecuperacao();
    mostrarErroLogin('Enviamos o codigo para seu e-mail. Digite o codigo recebido para continuar.');
  }

  window.solicitarCodigoRecuperacao = solicitarCodigoRecuperacao;

  async function validarCodigoRecuperacao() {
    const { email, code } = recuperarDadosSenha();
    const btn = document.getElementById('btn-recovery-verify');

    if (recoverySessionReady) {
      mostrarOpcoesAposCodigo();
      mostrarErroLogin('Codigo validado. Escolha trocar a senha ou entrar no painel.');
      return true;
    }

    if (!email || !code) {
      mostrarErroLogin('Informe o e-mail e o codigo recebido.');
      return false;
    }

    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<span class="loading"></span> Validando...';
    }

    try {
      const { error } = await db.auth.verifyOtp({
        email,
        token: code,
        type: 'recovery'
      });
      if (error) throw error;

      recoverySessionReady = true;
      mostrarOpcoesAposCodigo();
      mostrarErroLogin('Codigo validado. Agora voce pode trocar a senha ou pular e entrar no painel.');
      return true;
    } catch (error) {
      mostrarErroLogin(error.message || 'Nao foi possivel validar o codigo.');
      return false;
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = 'Validar codigo';
      }
    }
  }

  window.validarCodigoRecuperacao = validarCodigoRecuperacao;

  async function entrarComSessaoRecuperada() {
    const { data: { session } } = await db.auth.getSession();
    if (!session) {
      mostrarErroLogin('Sessao expirada. Envie um novo codigo.');
      recoverySessionReady = false;
      mostrarEtapaCodigoRecuperacao();
      return false;
    }

    return validarAcesso(session);
  }

  async function redefinirSenhaComCodigo() {
    const { password, confirm } = recuperarDadosSenha();
    const btn = document.getElementById('btn-recovery-reset');

    if (!recoverySessionReady && !(await validarCodigoRecuperacao())) return;

    if (!password || password.length < 8) {
      mostrarErroLogin('A nova senha deve ter pelo menos 8 caracteres.');
      return;
    }
    if (password !== confirm) {
      mostrarErroLogin('A confirmacao da senha nao confere.');
      return;
    }

    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<span class="loading"></span> Salvando...';
    }

    try {
      const { error: updateError } = await db.auth.updateUser({ password });
      if (updateError) throw updateError;

      await entrarComSessaoRecuperada();
      ['recovery-code', 'recovery-password', 'recovery-password-confirm'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
      });
    } catch (error) {
      mostrarErroLogin(error.message || 'Nao foi possivel trocar a senha.');
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = 'Trocar senha e entrar';
      }
    }
  }

  window.redefinirSenhaComCodigo = redefinirSenhaComCodigo;

  async function pularRedefinicaoSenha() {
    const btn = document.getElementById('btn-recovery-skip');
    if (!recoverySessionReady && !(await validarCodigoRecuperacao())) return;

    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<span class="loading"></span> Entrando...';
    }

    try {
      await entrarComSessaoRecuperada();
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = 'Pular e ir para o painel';
      }
    }
  }

  window.pularRedefinicaoSenha = pularRedefinicaoSenha;

  function prepararPainelPremium() {
    const tela = document.getElementById('tela-principal');
    const header = tela?.querySelector('header');
    const main = tela?.querySelector('main');
    if (!tela || !header || !main || document.getElementById('admin-sidebar')) return;

    tela.classList.add('admin-premium');
    tela.insertAdjacentHTML('afterbegin', `
      <aside class="admin-sidebar" id="admin-sidebar">
        <div class="sidebar-brand">
          <img src="../assets/images-removebg-preview.png" alt="Logo AD Bela-Vista" class="sidebar-logo">
          <div><strong>AD Bela-Vista</strong><span>Painel administrativo</span></div>
        </div>
        <nav class="sidebar-nav" aria-label="Navegação principal">
          <a class="side-link active" href="#dashboard-top" data-nav="dashboard"><i class="fa-solid fa-table-columns"></i><span>Dashboard</span></a>
          <a class="side-link" href="#corpo-lista" data-nav="membros"><i class="fa-solid fa-users"></i><span>Membros</span></a>
          <a class="side-link" href="#aniv-body" data-nav="aniversariantes"><i class="fa-solid fa-cake-candles"></i><span>Aniversariantes</span></a>
          <a class="side-link" href="relatorios.html"><i class="fa-solid fa-file-export"></i><span>Relatórios</span></a>
          <a class="side-link" href="indicadores.html"><i class="fa-solid fa-chart-line"></i><span>Indicadores</span></a>
          <a class="side-link" href="usuarios.html"><i class="fa-solid fa-user-shield"></i><span>Usuários</span></a>
          <a class="side-link" href="configuracoes.html"><i class="fa-solid fa-gear"></i><span>Configurações</span></a>
        </nav>
        <div class="sidebar-footer">
          <span class="realtime-dot"></span>
          <div><strong>Tempo real ativo</strong><small>Supabase conectado</small></div>
        </div>
      </aside>`);

    main.id = 'dashboard-top';
    const headerTitle = header.querySelector('.header-title');
    const headerSub = header.querySelector('.header-sub');
    if (headerTitle) headerTitle.textContent = '';
    if (headerSub) headerSub.textContent = '';
    header.insertAdjacentHTML('afterbegin', `
      <button class="mobile-menu" type="button" onclick="document.body.classList.toggle('sidebar-open')" aria-label="Abrir menu">
        <i class="fa-solid fa-bars"></i>
      </button>`);

    const aniversariosCard = document.getElementById('aniv-body')?.closest('.aniv-card');
    if (aniversariosCard) {
      aniversariosCard.classList.add('birthdays-panel');
      document.getElementById('aniv-body')?.classList.add('fechado');
      const title = aniversariosCard.querySelector('.aniv-title');
      if (title) title.firstChild.textContent = 'Aniversariantes do mês ';
    }

    const tableWrap = document.querySelector('.table-wrap');
    if (tableWrap) {
      const thead = tableWrap.querySelector('thead tr');
      if (thead) {
        thead.innerHTML = '<th>Foto</th><th>Nome</th><th>CPF</th><th>Tipo</th><th>Status</th><th>Ministério</th><th>Celular</th><th>Ações</th>';
      }
    }

    const metricCards = {
      total: {
        icon: 'fa-users',
        title: 'Total de Registros',
        subtitle: 'Pessoas cadastradas no sistema',
        pill: 'crescimento total',
        trend: '+12% em relacao ao mes anterior',
        visual: 'progress',
        tone: 'purple'
      },
      membros: {
        icon: 'fa-user-group',
        title: 'Membros recebidos',
        subtitle: 'Membros oficialmente recebidos pela igreja',
        pill: 'entradas mensais',
        trend: '+14% no mes atual',
        visual: 'member-bars',
        tone: 'blue'
      },
      congregados: {
        icon: 'fa-user-group',
        title: 'Congregados acompanhados',
        subtitle: 'Pessoas em processo de acompanhamento',
        pill: 'acompanhados',
        trend: '75% de acompanhamento',
        visual: 'gauge',
        tone: 'amber'
      },
      ativos: {
        icon: 'fa-user-check',
        title: 'Cadastros ativos',
        subtitle: 'Membros ativos no sistema',
        pill: 'ativos x inativos',
        trend: 'Ativos em destaque',
        visual: 'people',
        tone: 'green'
      },
      mes: {
        icon: 'fa-user-plus',
        title: 'Novos este mes',
        subtitle: 'Evolucao de novos cadastros',
        pill: 'novos do mes',
        trend: 'Mostrando os ultimos meses',
        visual: 'trend-bars',
        tone: 'coral'
      },
      aniversariantes: {
        icon: 'fa-cake-candles',
        title: 'Aniversariantes',
        subtitle: 'Celebrações previstas para este mês',
        pill: 'aniversariantes',
        trend: 'Nenhum aniversariante este mês',
        visual: 'birthday',
        tone: 'red'
      }
    };

    const renderMetricVisual = (metric, config) => {
      if (config.visual === 'progress') {
        return `
          <div class="metric-progress" aria-hidden="true">
            <div class="metric-progress-top">
              <span>Crescimento do cadastro</span>
              <strong id="metric-total-percent">0%</strong>
            </div>
            <div class="metric-progress-track">
              <div class="metric-progress-fill" id="metric-total-fill" style="width: 0;"></div>
            </div>
            <small>Comparado ao mês anterior</small>
          </div>`;
      }
      if (config.visual === 'member-bars' || config.visual === 'trend-bars') {
        return `
          <div class="metric-member-bars" aria-hidden="true">
            <span class="member-bar" id="member-bar-0" style="--h:28%"><i class="fa-solid fa-user"></i><strong>0</strong><em>Mai</em></span>
            <span class="member-bar" id="member-bar-1" style="--h:28%"><i class="fa-solid fa-user"></i><strong>0</strong><em>Jun</em></span>
            <span class="member-bar" id="member-bar-2" style="--h:62%"><i class="fa-solid fa-user"></i><strong>1</strong><em>Jul</em></span>
            <span class="member-bar current" id="member-bar-3" style="--h:92%"><i class="fa-solid fa-user"></i><strong>2</strong><em>Ago</em></span>
          </div>`;
      }
      if (config.visual === 'gauge') {
        return `
          <div class="metric-gauge" aria-hidden="true">
            <span class="gauge-needle"></span>
            <strong id="metric-congregados-percent">0%</strong>
            <small>do total de congregados</small>
          </div>`;
      }
      if (config.visual === 'people') {
        return `
          <div class="metric-people" aria-hidden="true" id="metric-ativos-people"></div>`;
      }
      if (config.visual === 'birthday') {
        return `
          <div class="metric-birthday" aria-hidden="true">
            <div class="metric-hero-circle">
              <i class="fa-solid fa-cake-candles"></i>
            </div>
            <div class="metric-birthday-state" id="metric-aniversariantes-state">Nenhum aniversariante este mês</div>
          </div>`;
      }
      return `
        <div class="metric-hero-circle" aria-hidden="true">
          <i class="fa-solid ${metric === 'mes' ? 'fa-user-plus' : config.icon}"></i>
        </div>`;
    };

    const ensureBirthdayStrip = () => {
      const grid = document.querySelector('.stats-grid');
      if (!grid || document.getElementById('dashboard-birthday-strip')) return;

      grid.insertAdjacentHTML('afterend', `
        <section class="dashboard-birthday-strip" id="dashboard-birthday-strip">
          <div class="birthday-strip-icon"><i class="fa-regular fa-calendar-days"></i></div>
          <div>
            <strong id="dashboard-birthday-title">0 aniversariantes este mes</strong>
            <span id="dashboard-birthday-subtitle">Nenhuma celebracao prevista para este mes.</span>
          </div>
          <button class="birthday-strip-action" type="button" onclick="toggleAniv()">
            Ver aniversariantes <i class="fa-solid fa-chevron-right"></i>
          </button>
        </section>`);
    };

    document.querySelector('.stats-grid')?.classList.add('dashboard-metrics');
    document.querySelectorAll('.stat-card').forEach((card, index) => {
      if (card.dataset.ready === 'true') return;
      const metric = card.dataset.metric || ['total', 'membros', 'congregados', 'ativos', 'mes', 'aniversariantes'][index] || 'total';
      const config = metricCards[metric] || metricCards.total;
      const num = card.querySelector('.stat-num');
      const numId = num?.id || `stat-${metric}`;
      const currentValue = num?.textContent || '0';

      card.classList.add('premium-metric', `metric-${config.tone}`);
      card.innerHTML = `
        <div class="metric-card-head">
          <div class="metric-icon"><i class="fa-solid ${config.icon}"></i></div>
          <div>
            <h3>${config.title}</h3>
            <p>${config.subtitle}</p>
          </div>
        </div>
        <div class="metric-card-body">
          <div class="metric-stack">
            <div class="metric-value-pill">
              <span class="metric-pill-icon"><i class="fa-solid ${config.icon}"></i></span>
              <div>
                <div class="stat-num" id="${numId}">${currentValue}</div>
                <div class="stat-lbl">${config.pill}</div>
              </div>
            </div>
            <div class="metric-trend-pill">
              <span><i class="fa-solid fa-arrow-up"></i></span>
              <strong id="metric-${metric}-trend">${config.trend.split(' ')[0]}</strong>
              <small>${config.trend.replace(config.trend.split(' ')[0], '').trim()}</small>
            </div>
          </div>
          <div class="metric-visual metric-visual-${config.visual}">
            ${renderMetricVisual(metric, config)}
          </div>
        </div>
        <div class="metric-card-foot">
          <span id="metric-${metric}-foot-left">Atualizando dados...</span>
          <strong id="metric-${metric}-foot-right">--</strong>
        </div>`;
      card.setAttribute('role', 'button');
      card.setAttribute('tabindex', '0');
      card.setAttribute('aria-label', `Abrir indicador ${config.title}`);
      card.addEventListener('click', () => abrirPainelIndicador(card.dataset.metric || 'total'));
      card.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          abrirPainelIndicador(card.dataset.metric || 'total');
        }
      });
      card.dataset.ready = 'true';
    });
    redesenharCardsIndicadores();

    document.querySelectorAll('.side-link[data-nav]').forEach(link => {
      link.addEventListener('click', (event) => {
        const nav = link.dataset.nav;
        document.querySelectorAll('.side-link').forEach(a => a.classList.remove('active'));
        link.classList.add('active');
        if (nav === 'aniversariantes') {
          if (!anivAberto) toggleAniv();
        }
        document.body.classList.remove('sidebar-open');
      });
    });
  }

  function redesenharCardsIndicadores() {
    const indicadores = {
      total: {
        title: 'Total de Registros',
        desc: 'Cadastros gerais',
        icon: 'fa-users',
        numberId: 'stat-total',
        label: 'pessoas cadastradas',
        visual: `
          <div class="compact-growth-bars" id="ux-total-growth" aria-label="Crescimento acumulado"></div>
          <div class="annual-progress">
            <div class="annual-progress-head">
              <span>Meta anual</span>
              <strong id="ux-total-percent">0%</strong>
            </div>
            <span class="annual-progress-track"><i id="ux-total-progress"></i></span>
            <small id="ux-total-goal">0 registros no ano</small>
          </div>`
      },
      membros: {
        title: 'Membros Recebidos',
        desc: 'Recebidos pela igreja',
        icon: 'fa-user-group',
        numberId: 'stat-membros',
        label: 'membros registrados',
        visual: `
          <div class="compact-person-strip" id="ux-membros-icons" aria-hidden="true"></div>
          <div class="compact-month-bars" id="ux-membros-bars" aria-label="Evolução mensal de membros"></div>`
      },
      congregados: {
        title: 'Congregados Acompanhados',
        desc: 'Em acompanhamento',
        icon: 'fa-hand-holding-heart',
        numberId: 'stat-congregados',
        label: 'congregados cadastrados',
        visual: `
          <div class="compact-gauge-wrap">
            <div class="compact-gauge" id="ux-congregados-gauge" style="--pct:0%;">
              <div class="compact-gauge-center">
                <strong id="ux-congregados-percent">0%</strong>
              </div>
            </div>
            <div class="compact-gauge-facts">
              <span><strong id="ux-congregados-total">0</strong> congregados</span>
              <span><strong id="ux-congregados-acompanhados">0</strong> acompanhados</span>
            </div>
          </div>`
      },
      ativos: {
        title: 'Cadastros Ativos',
        desc: 'Situação atual',
        icon: 'fa-user-check',
        numberId: 'stat-ativos',
        label: 'cadastros ativos',
        visual: `
          <div class="compact-human-map" id="ux-ativos-people" aria-label="Pessoas ativas e inativas"></div>
          <div class="compact-legend">
            <span><i class="active"></i> Ativos</span>
            <span><i class="inactive"></i> Inativos</span>
          </div>`
      },
      mes: {
        title: 'Novos Este Mês',
        desc: 'Ritmo recente',
        icon: 'fa-arrow-trend-up',
        numberId: 'stat-mes',
        label: 'novos neste mês',
        visual: `
          <div class="month-progress-card" aria-label="Progresso do mês">
            <div class="month-progress-head">
              <span>Progresso do mês</span>
              <strong id="ux-mes-percent">0%</strong>
            </div>
            <span class="month-progress-track"><i id="ux-mes-progress"></i></span>
            <div class="month-progress-meta">
              <span id="ux-mes-days">Dia 1 de 30</span>
              <strong id="ux-mes-rate">0/dia</strong>
            </div>
          </div>`
      }
    };

    const grid = document.querySelector('.stats-grid');
    if (!grid) return;

    let section = document.getElementById('indicadores-igreja');
    if (!section) {
      section = document.createElement('section');
      section.id = 'indicadores-igreja';
      section.className = 'indicator-compact-section';
      section.innerHTML = `
        <div class="indicator-compact-head">
          <div>
            <h2>Indicadores da Igreja</h2>
            <p>Resumo rápido para acompanhar sem ocupar a tela toda.</p>
          </div>
        </div>`;
      section.tabIndex = 0;
      grid.parentNode.insertBefore(section, grid);
      section.appendChild(grid);
    }

    section.className = 'indicator-compact-section';
    grid.className = 'stats-grid indicator-compact-grid';
    grid.innerHTML = INDICADORES_CAROUSEL.map((metric) => {
      const item = indicadores[metric];
      return `
        <article class="stat-card indicator-compact-card indicator-compact-${metric}" data-metric="${metric}">
          <div class="indicator-compact-copy">
            <span class="indicator-compact-icon"><i class="fa-solid ${item.icon}"></i></span>
            <div>
              <h3>${item.title}</h3>
              <p>${item.desc}</p>
            </div>
          </div>
          <div class="indicator-compact-main">
            <strong class="stat-num" id="${item.numberId}">0</strong>
            <span>${item.label}</span>
          </div>
          <div class="indicator-compact-visual indicator-compact-visual-${metric}">
            ${item.visual}
          </div>
          <p class="indicator-compact-note" id="ux-secondary-${metric}">Atualizando indicador...</p>
        </article>`;
    }).join('');

    grid.querySelectorAll('.indicator-compact-card').forEach((slide) => {
      slide.setAttribute('role', 'button');
      slide.setAttribute('tabindex', '0');
      slide.setAttribute('aria-label', `Abrir indicador ${indicadores[slide.dataset.metric || 'total']?.title || 'Total'}`);
      slide.addEventListener('click', () => abrirPainelIndicador(slide.dataset.metric || 'total'));
      slide.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          abrirPainelIndicador(slide.dataset.metric || 'total');
        }
      });
    });
  }

  async function obterPerfil(userId) {
    const { data, error } = await db
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      console.warn('Erro ao validar perfil:', error.message);
      return null;
    }

    return data;
  }

  async function validarAcesso(session) {
    if (!session?.user?.id) {
      mostrarTela('tela-login');
      return false;
    }

    const profile = await obterPerfil(session.user.id);
    if (!profile || !ADMIN_ROLES.includes(profile.role)) {
      await db.auth.signOut();
      membrosCache = [];
      mostrarTela('tela-login');
      mostrarErroLogin('Acesso restrito. Esta área é exclusiva para administradores autorizados.');
      return false;
    }

    currentAdminRole = profile.role;
    document.getElementById('header-email').textContent = session.user.email || '';
    mostrarTela('tela-principal');
    carregarLista();
    iniciarRealtime();

    // Detecta retorno do cadastro feito pelo admin
    const urlParams = new URLSearchParams(window.location.search);
    const novoMembroId = urlParams.get('novo_membro');
    const novoMembroNome = urlParams.get('nome');
    
    if (novoMembroId && novoMembroNome) {
      // Remove os parâmetros da URL sem recarregar
      window.history.replaceState({}, '', '/pages/admin.html');
      
      // Mostra notificação de sucesso
      toast(`✅ ${decodeURIComponent(novoMembroNome)} cadastrado(a) com sucesso!`, 'sucesso', 4000);
      
      // Aguarda um pouco e abre a ficha do membro
      setTimeout(() => {
        abrirFicha(novoMembroId);
      }, 1000);
    }

    return true;
  }

  async function fazerLogin() {
    const email = document.getElementById('login-email').value.trim();
    const senha = document.getElementById('login-senha').value;
    const erro = document.getElementById('login-erro');
    const btn = document.getElementById('btn-entrar');

    if (!email || !senha) {
      erro.textContent = '⚠️ Preencha e-mail e senha.';
      erro.classList.add('show');
      return;
    }

    btn.innerHTML = '<span class="loading"></span> Entrando…';
    btn.disabled = true;
    erro.classList.remove('show');

    const { data, error } = await db.auth.signInWithPassword({ email, password: senha });
    btn.innerHTML = '✝ Entrar no Painel';
    btn.disabled = false;

    if (error) {
      console.warn('Falha no login administrativo:', error.message);
      erro.textContent = 'E-mail ou senha inválidos.';
      erro.classList.add('show');

      const box = document.querySelector('.login-box');
      box.style.animation = 'none';
      box.offsetHeight;
      box.style.animation = 'shake 0.4s ease';
      setTimeout(() => box.style.animation = '', 500);
      return;
    }

    await validarAcesso(data.session);
  }

  window.fazerLogin = fazerLogin;

  async function sair() {
    await db.auth.signOut();
    membrosCache = [];
    currentAdminRole = null;
    document.getElementById('login-email').value = '';
    document.getElementById('login-senha').value = '';
    mostrarTela('tela-login');
  }

  window.sair = sair;

  async function abrirCadastro() {
    try {
      // Gera token de cadastro automaticamente
      const { data, error } = await db.rpc('generate_registration_token', {
        p_duration_hours: 2,
        p_notes: 'Link direto do admin'
      });

      if (error) throw error;

      const token = data?.[0];
      if (!token) throw new Error('Token não retornado');

      // Monta URL com token e flag indicando origem admin
      const linkCompleto = `${window.location.origin}/pages/cadastro.html?token=${token.token}&admin=1`;

      // Abre em nova aba
      window.open(linkCompleto, '_blank', 'noopener,noreferrer');
      
      toast('✅ Ficha aberta com link automático');

    } catch (error) {
      console.error('Erro ao gerar link:', error);
      toast('❌ Não foi possível abrir a ficha: ' + erroTokenParaUsuario(error));
    }
  }

  window.abrirCadastro = abrirCadastro;

  function toast(msg, dur = 2800) {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), dur);
  }

  window.toast = toast;

  function maskCPF(i) {
    let v = i.value.replace(/\D/g, '');
    v = v.replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
    i.value = v;
  }
  window.maskCPF = maskCPF;

  function maskCEP(i) {
    i.value = i.value.replace(/\D/g, '').replace(/^(\d{5})(\d)/, '$1-$2');
  }
  window.maskCEP = maskCEP;

  function maskPhone(i) {
    let v = i.value.replace(/\D/g, '');
    v = v.replace(/^(\d{2})(\d)/g, '($1) $2').replace(/(\d)(\d{4})$/, '$1-$2');
    i.value = v;
  }
  window.maskPhone = maskPhone;

  function fmt(v) { return v ? safeText(v) : '<span style="color:var(--muted)">—</span>'; }
  function fmtDate(v) { return v ? v.split('-').reverse().join('/') : '<span style="color:var(--muted)">—</span>'; }

  function statusBadge(s) {
    const cls = {
      'Ativo': 'ativo',
      'Aprovado': 'ativo',
      'Pendente': 'pendente',
      'Em análise': 'analise',
      'Correção': 'correcao',
      'Inativo': 'inativo',
      'Transferido': 'transferido',
      'Falecido': 'falecido'
    }[s] || 'ativo';
    return `<span class="badge badge-${cls}">${safeText(s || 'Ativo')}</span>`;
  }

  function whatsappLink(cel) {
    if (!cel) return '';
    const n = cel.replace(/\D/g, '');
    return `<a href="https://wa.me/55${n}" target="_blank" class="member-action member-action-whatsapp" title="WhatsApp" aria-label="Abrir WhatsApp"><i class="fa-brands fa-whatsapp"></i></a>`;
  }

  function avatarImg(m, size = 32) {
    const foto = safeUrl(m.foto_url);
    const style = `--avatar-size:${size}px;--avatar-font:${Math.round(size * 0.45)}px;`;
    if (foto) return `<img src="${foto}" class="member-avatar" style="${style}" referrerpolicy="no-referrer" loading="lazy" alt="">`;
    return `<div class="member-avatar member-avatar-empty" style="${style}" aria-hidden="true"><i class="fa-solid fa-user"></i></div>`;
  }

  function isAtivo(m) {
    return !m.status || m.status === 'Ativo' || m.status === 'Aprovado';
  }

  function statusActions(m) {
    const id = escapeAttr(String(m.id ?? ''));
    const status = m.status || 'Ativo';
    if (status === 'Aprovado' || status === 'Ativo' || status === 'Inativo' || status === 'Transferido' || status === 'Falecido') return '';
    return `
      <button type="button" class="member-action member-action-approve" data-member-action="approve" data-member-id="${id}" title="Aprovar ficha" aria-label="Aprovar ficha"><i class="fa-solid fa-check"></i></button>
      <button type="button" class="member-action member-action-warn" data-member-action="correction" data-member-id="${id}" title="Solicitar correção" aria-label="Solicitar correção"><i class="fa-solid fa-triangle-exclamation"></i></button>
    `;
  }

  // ── NOTIFICAÇÕES ───────────────────────────────────────
  function atualizarSinoBadge() {
    const badge = document.getElementById('sino-badge');
    if (notifNaoLidas > 0) {
      badge.textContent = notifNaoLidas > 9 ? '9+' : notifNaoLidas;
      badge.classList.add('visivel');
    } else badge.classList.remove('visivel');
  }

  function fecharNotif(id) {
    const card = document.getElementById(id);
    if (!card) return;
    card.classList.add('notif-saindo');
    setTimeout(() => card.remove(), 300);
  }

  function abrirHistoricoNotif() {
    notifNaoLidas = 0;
    atualizarSinoBadge();
    renderHistorico();
    document.getElementById('hist-overlay').classList.add('open');
  }

  window.abrirHistoricoNotif = abrirHistoricoNotif;

  function criarNotificacao(membro) {
    if (primeiraLeitura) return;
    const id = 'notif-' + Date.now();
    const tel = membro.celular ? membro.celular.replace(/\D/g, '') : null;
    const hora = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

    historicoNotif.unshift({ membro, hora, id });
    notifNaoLidas++;
    atualizarSinoBadge();

    const stack = document.getElementById('notif-stack');
    const card = document.createElement('div');
    card.className = 'notif-card';
    card.id = id;

    card.innerHTML = `
      <div class="notif-topo">
        <span class="notif-pulse"></span>
        <span class="notif-label">✨ Novo cadastro</span>
        <span style="font-size:0.72rem;color:var(--muted);">${hora}</span>
        <button class="notif-close" onclick="fecharNotif('${id}')">✕</button>
      </div>
      <div class="notif-nome">${safeText(membro.nome)}</div>
      <div class="notif-meta">
        <span>${safeText(membro.tipo_cadastro || 'Membro')}</span>
        ${membro.celular ? `<span>📱 ${safeText(membro.celular)}</span>` : ''}
        ${membro.setor_igreja ? `<span>📍 ${safeText(membro.setor_igreja)}</span>` : ''}
      </div>
      <div class="notif-acoes">
        <button class="notif-btn" onclick="verDetalhes(${jsString(membro.id)});fecharNotif('${id}')">👁 Ver ficha</button>
        ${tel ? `<a class="notif-btn verde" href="https://wa.me/55${tel}" target="_blank">💬 WhatsApp</a>` : ''}
      </div>`;

    stack.appendChild(card);

    setTimeout(() => fecharNotif(id), 6200);
  }

  window.fecharNotif = fecharNotif;
  window.criarNotificacao = criarNotificacao;

  function renderHistorico() {
    const lista = document.getElementById('hist-lista');
    if (!historicoNotif.length) {
      lista.innerHTML = '<div style="text-align:center;padding:2rem;color:var(--muted);font-size:0.85rem;">📭 Nenhuma notificação ainda.</div>';
      return;
    }

    lista.innerHTML = historicoNotif.map(n => {
      const tel = n.membro.celular ? n.membro.celular.replace(/\D/g, '') : null;
      return `<div style="display:flex;align-items:center;gap:12px;padding:12px 0;border-bottom:1px solid var(--border);">
        <div style="width:40px;height:40px;border-radius:50%;background:rgba(201,168,76,0.12);display:flex;align-items:center;justify-content:center;font-size:1.2rem;flex-shrink:0;">✨</div>
        <div style="flex:1;">
          <div style="font-weight:700;font-size:0.9rem;">${safeText(n.membro.nome)}</div>
          <div style="font-size:0.75rem;color:var(--muted);">${safeText(n.membro.tipo_cadastro || '—')}${n.membro.celular ? ' · ' + safeText(n.membro.celular) : ''} · ${safeText(n.hora)}</div>
        </div>
        <div style="display:flex;gap:5px;">
          <button class="btn btn-ghost btn-sm" onclick="verDetalhes(${jsString(n.membro.id)});document.getElementById('hist-overlay').classList.remove('open')">👁</button>
          ${tel ? `<a href="https://wa.me/55${tel}" target="_blank" class="btn btn-green btn-sm" style="text-decoration:none;">💬</a>` : ''}
        </div>
      </div>`;
    }).join('');
  }

  window.renderHistorico = renderHistorico;

  function limparNotificacoes() {
    historicoNotif = [];
    notifNaoLidas = 0;
    atualizarSinoBadge();
    renderHistorico();
    document.getElementById('notif-stack').innerHTML = '';
  }

  window.limparNotificacoes = limparNotificacoes;

  function iniciarRealtime() {
    const channel = db.channel('novos-membros')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'membros' }, async payload => {
        const m = payload.new;
        membrosCache.unshift(m);

        // Atualiza indicador principal de “Último cadastro”
        atualizarUltimoCadastro(m);

        renderStats();
        popularFiltroSetor();
        popularFiltroCargo();
        renderAniversariantes();
        renderLista(m.id);
        criarNotificacao(m);
      })
      .subscribe((status, err) => {
        if (err) {
          toast('Tempo real indisponível no momento.');
        }
      });
  }

  function comprimirImagem(file, maxDim = 900) {
    return new Promise(resolve => {
      const r = new FileReader();
      r.onload = e => {
        const img = new Image();
        img.onload = () => {
          const c = document.createElement('canvas');
          const ratio = Math.min(1, maxDim / Math.max(img.width, img.height));
          c.width = Math.round(img.width * ratio);
          c.height = Math.round(img.height * ratio);
          c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
          c.toBlob(b => resolve(b), 'image/jpeg', 0.82);
        };
        img.src = e.target.result;
      };
      r.readAsDataURL(file);
    });
  }

  async function uploadFotoAdmin(file, pasta) {
    if (!file) return null;
    try {
      const blob = await comprimirImagem(file);
      const path = `${pasta}/${Date.now()}_${Math.random().toString(36).slice(2)}.jpg`;
      const bucket = 'membros-docs';
      const { error } = await db.storage.from(bucket).upload(path, blob, { contentType: 'image/jpeg', upsert: true });
      if (error) throw new Error(error.message);

      const { data, error: signedError } = await db.storage
        .from(bucket)
        .createSignedUrl(path, 60 * 60 * 24 * 7);

      if (signedError || !data?.signedUrl) throw new Error(signedError?.message || 'URL assinada indisponível');
      return data.signedUrl;
    } catch (e) {
      console.warn('Erro no upload da mídia:', e);
      return null;
    }
  }

  function obterArquivoSelecionado(...ids) {
    for (const id of ids) {
      const input = document.getElementById(id);
      if (input?.files?.[0]) return input.files[0];
    }
    return null;
  }

  function parseStorageUrl(value) {
    if (!value) return null;
    try {
      const url = new URL(String(value).replaceAll('&amp;', '&'), window.location.origin);
      const match = url.pathname.match(/\/storage\/v1\/object\/(?:public|sign)\/([^/]+)\/(.+)$/);
      if (!match) return null;
      return {
        bucket: decodeURIComponent(match[1]),
        path: decodeURIComponent(match[2])
      };
    } catch (error) {
      return null;
    }
  }

  async function renovarUrlAssinada(value) {
    const parsed = parseStorageUrl(value);
    if (!parsed || !String(value).includes('/object/sign/')) return value;

    const { data, error } = await db.storage
      .from(parsed.bucket)
      .createSignedUrl(parsed.path, 60 * 60 * 24 * 7);

    if (error || !data?.signedUrl) {
      console.warn('Erro ao renovar URL assinada:', error?.message);
      return value;
    }

    return data.signedUrl;
  }

  async function renovarUrlsMembroCampos(membro, campos) {
    if (!membro) return membro;
    const atualizado = { ...membro };
    await Promise.all((campos || []).map(async (campo) => {
      atualizado[campo] = await renovarUrlAssinada(atualizado[campo]);
    }));

    const idx = membrosCache.findIndex(item => String(item.id) === String(atualizado.id));
    if (idx !== -1) membrosCache[idx] = { ...membrosCache[idx], ...atualizado };
    return atualizado;
  }

  async function renovarUrlsMembro(membro) {
    return renovarUrlsMembroCampos(membro, [
      'foto_url',
      'doc_url',
      'foto_certidao_nasc',
      'foto_certidao_casamento',
      'foto_diploma',
      'foto_comprovante_end',
      'assinatura_url'
    ]);
  }

  function removerArquivosStorage(urls) {
    const porBucket = new Map();

    urls.forEach((url) => {
      const parsed = parseStorageUrl(url);
      if (!parsed) return;
      if (!porBucket.has(parsed.bucket)) porBucket.set(parsed.bucket, []);
      porBucket.get(parsed.bucket).push(parsed.path);
    });

    porBucket.forEach((paths, bucket) => {
      db.storage.from(bucket).remove(paths).then(({ error }) => {
        if (error) console.warn('Erro ao limpar Storage:', error.message);
      });
    });
  }

  function editPreviewFoto(input, previewId, placeholderId, areaId) {
    const file = input.files[0];
    if (!file) return;
    const r = new FileReader();
    r.onload = e => {
      const prev = document.getElementById(previewId);
      prev.src = e.target.result;
      prev.style.display = 'block';
      document.getElementById(placeholderId).style.display = 'none';
      document.getElementById(areaId).classList.add('tem-foto');
    };
    r.readAsDataURL(file);
  }

  window.editPreviewFoto = editPreviewFoto;

  function fmtDataHoraISO(v){
    try{
      if(!v) return null;
      const d = new Date(v);
      if(isNaN(d.getTime())) return null;
      return d.toLocaleString('pt-BR', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' });
    }catch(e){
      return null;
    }
  }

  function atualizarUltimoCadastro(m){
    const nomeEl = document.getElementById('last-cadastro-nome');
    const quandoEl = document.getElementById('last-cadastro-quando');
    if(!nomeEl || !quandoEl) return;

    const nome = m?.nome || '—';
    const quando = fmtDataHoraISO(m?.created_at) || fmtDataHoraISO(m?.commit_timestamp) || new Date().toLocaleString('pt-BR');

    nomeEl.textContent = nome;
    quandoEl.textContent = `Em ${quando}`;
    const activityName = document.getElementById('activity-last-name');
    const activityTime = document.getElementById('activity-last-time');
    if (activityName) activityName.textContent = nome;
    if (activityTime) activityTime.textContent = quando;
  }

  async function carregarLista() {
    const tableBody = document.getElementById('corpo-lista');
    if (tableBody) tableBody.innerHTML =
      `<tr><td colspan="8" style="text-align:center;color:var(--muted);padding:2.5rem;"><span class="loading" style="border-color:rgba(201,168,76,0.3);border-top-color:var(--gold);"></span><span style="margin-left:10px;">Carregando…</span></td></tr>`;

    const { data, error } = await db.from('membros').select('*').order('nome');
    if (error) {
      console.error('Erro ao carregar membros do painel:', error);
      const message = error.code === '42501'
        ? 'Sem permissão para ler membros. Execute docs/sql/CORRIGIR_401_MEMBROS_ADMIN.sql no Supabase.'
        : `Falha ao carregar membros (${error.code || 'erro'}): ${error.message || 'verifique conexão e permissões.'}`;
      membrosCache = [];
      if (tableBody) {
        tableBody.replaceChildren();
        const row = document.createElement('tr');
        const cell = document.createElement('td');
        cell.colSpan = 8;
        cell.className = 'load-error';
        cell.textContent = message;
        row.appendChild(cell);
        tableBody.appendChild(row);
      }
      const cardList = document.getElementById('members-card-list');
      if (cardList) {
        cardList.textContent = message;
        cardList.classList.add('load-error');
      }
      toast(`❌ ${message}`);
      return;
    }
    membrosCache = data || [];
    document.getElementById('members-card-list')?.classList.remove('load-error');
    primeiraLeitura = false;

    // Atualiza painel do “último cadastro”
    const maisRecente = [...membrosCache].sort((a,b)=>{
      const da = new Date(a?.created_at || a?.commit_timestamp || 0).getTime();
      const dbb = new Date(b?.created_at || b?.commit_timestamp || 0).getTime();
      return dbb - da;
    })[0];
    if (maisRecente) atualizarUltimoCadastro(maisRecente);

    renderStats();
    popularFiltroSetor();
    popularFiltroCargo();
    renderAniversariantes();
    renderLista();
  }

  function renderStoryStats() {
    const setText = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.textContent = val;
    };
    const setNum = (id, val) => {
      const el = document.getElementById(id);
      if (!el) return;
      if (el.textContent !== String(val)) {
        el.textContent = val;
        el.classList.remove('bump');
        void el.offsetWidth;
        el.classList.add('bump');
      }
    };
    const setStyle = (id, prop, val) => {
      const el = document.getElementById(id);
      if (el) el.style.setProperty(prop, val);
    };
    const plural = (value, single, pluralText) => `${value} ${value === 1 ? single : pluralText}`;
    const isAtivo = m => !m.status || m.status === 'Ativo';
    const parseDataLocal = valor => {
      if (!valor) return null;
      const partes = String(valor).slice(0, 10).split('-').map(Number);
      if (partes.length === 3 && partes.every(Boolean)) return new Date(partes[0], partes[1] - 1, partes[2]);
      const d = new Date(valor);
      return Number.isNaN(d.getTime()) ? null : d;
    };
    const chaveMes = data => `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}`;
    const meses = Array.from({ length: 6 }, (_, index) => {
      const data = new Date();
      data.setDate(1);
      data.setHours(12, 0, 0, 0);
      data.setMonth(data.getMonth() - (5 - index));
      return {
        key: chaveMes(data),
        label: data.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', ''),
        nome: data.toLocaleDateString('pt-BR', { month: 'long' }),
        atual: index === 5
      };
    });
    const contarMeses = lista => {
      const mapa = Object.fromEntries(meses.map(mes => [mes.key, 0]));
      lista.forEach(item => {
        if (!item.created_at) return;
        const d = new Date(item.created_at);
        if (Number.isNaN(d.getTime())) return;
        const key = chaveMes(d);
        if (mapa[key] !== undefined) mapa[key]++;
      });
      return meses.map(mes => mapa[mes.key]);
    };
    const textoComparacao = (atual, anterior, nome = 'cadastros') => {
      const delta = atual - anterior;
      if (delta > 0) return `+${delta} ${nome} vs mês anterior`;
      if (delta < 0) return `${Math.abs(delta)} a menos que no mês anterior`;
      if (atual > 0) return 'Mesmo ritmo do mês anterior';
      return 'Sem registros nos dois últimos meses';
    };
    const alturaBarra = (valor, maximo, min = 16, max = 86) => {
      if (!maximo) return min;
      return Math.max(min, Math.round((valor / maximo) * max));
    };

    const total = membrosCache.length;
    const membrosLista = membrosCache.filter(m => m.tipo_cadastro === 'Membro');
    const congregadosLista = membrosCache.filter(m => m.tipo_cadastro === 'Congregado');
    const ativos = membrosCache.filter(isAtivo).length;
    const inativos = Math.max(0, total - ativos);
    const membros = membrosLista.length;
    const congregados = congregadosLista.length;
    const registrosMes = contarMeses(membrosCache);
    const membrosMes = contarMeses(membrosLista);
    const doMes = registrosMes[registrosMes.length - 1] || 0;
    const mesAnterior = registrosMes[registrosMes.length - 2] || 0;
    const membrosAtual = membrosMes[membrosMes.length - 1] || 0;
    const aniversariantes = membrosCache
      .filter(m => m.data_nasc && isAtivo(m))
      .map(m => {
        const d = parseDataLocal(m.data_nasc);
        return d ? { ...m, mes: d.getMonth() } : null;
      })
      .filter(Boolean)
      .filter(m => m.mes === new Date().getMonth()).length;
    const acompanhados = congregadosLista.filter(m =>
      isAtivo(m) && (m.setor_igreja || m.congregacao_igreja || m.forma_recebimento || m.cargo_principal)
    ).length;
    const percentAcompanhados = congregados ? Math.round((acompanhados / congregados) * 100) : 0;
    const agora = new Date();
    const mesAtual = agora.getMonth();
    const anoAtual = agora.getFullYear();
    const registrosAno = membrosCache.filter(m => {
      if (!m.created_at) return false;
      const d = new Date(m.created_at);
      return !Number.isNaN(d.getTime()) && d.getFullYear() === anoAtual;
    }).length;
    const metaAnual = Math.max(100, Math.ceil(Math.max(registrosAno, total, 1) / 50) * 50);
    const percentMetaAnual = Math.min(100, Math.round((registrosAno / metaAnual) * 100));

    setNum('stat-total', total);
    setNum('stat-membros', membros);
    setNum('stat-congregados', congregados);
    setNum('stat-ativos', ativos);
    setNum('stat-mes', doMes);
    setNum('stat-aniversariantes', aniversariantes);
    setText('ux-total-percent', `${percentMetaAnual}%`);
    setText('ux-total-goal', `${registrosAno} de ${metaAnual} registros em ${anoAtual}`);
    setStyle('ux-total-progress', 'width', `${percentMetaAnual}%`);

    const renderBarras = (id, valores) => {
      const alvo = document.getElementById(id);
      if (!alvo) return;
      const maximo = Math.max(1, ...valores);
      alvo.innerHTML = meses.map((mes, index) => `
        <span class="ux-month-bar ${mes.atual ? 'current' : ''}" title="${valores[index]} em ${mes.nome}">
          <i class="ux-bar-fill" style="height:${alturaBarra(valores[index], maximo)}px"></i>
          <strong>${valores[index]}</strong>
          <em>${mes.label}</em>
        </span>`).join('');
    };

    const totalGrowth = document.getElementById('ux-total-growth');
    if (totalGrowth) {
      const anteriores = Math.max(0, total - registrosMes.reduce((acc, value) => acc + value, 0));
      let acumulado = anteriores;
      const progressao = registrosMes.map(value => {
        acumulado += value;
        return acumulado;
      });
      const maximo = Math.max(1, ...progressao);
      totalGrowth.innerHTML = meses.map((mes, index) => `
        <span class="ux-growth-step ${mes.atual ? 'current' : ''}" title="${progressao[index]} registros acumulados">
          <i class="ux-growth-fill" style="height:${alturaBarra(progressao[index], maximo)}px"></i>
          <b><i class="fa-solid ${mes.atual ? 'fa-user-check' : 'fa-user-plus'}"></i></b>
          <em>${mes.label}</em>
        </span>`).join('');
    }

    const membrosIcons = document.getElementById('ux-membros-icons');
    if (membrosIcons) {
      const maximo = Math.max(1, ...membrosMes);
      const preenchidos = membrosAtual ? Math.max(1, Math.ceil((membrosAtual / maximo) * 8)) : 0;
      membrosIcons.innerHTML = Array.from({ length: 8 }, (_, index) =>
        `<i class="fa-solid fa-user ${index < preenchidos ? 'active' : ''}"></i>`
      ).join('');
    }

    renderBarras('ux-membros-bars', membrosMes);

    const diasNoMes = new Date(anoAtual, mesAtual + 1, 0).getDate();
    const diaAtual = agora.getDate();
    const progressoMes = Math.min(100, Math.round((diaAtual / diasNoMes) * 100));
    const mediaDiaria = diaAtual ? (doMes / diaAtual) : 0;
    setText('ux-mes-percent', `${progressoMes}%`);
    setText('ux-mes-days', `Dia ${diaAtual} de ${diasNoMes}`);
    setText('ux-mes-rate', `${mediaDiaria.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}/dia`);
    const mesProgress = document.getElementById('ux-mes-progress');
    if (mesProgress) mesProgress.style.width = `${progressoMes}%`;

    const gauge = document.getElementById('ux-congregados-gauge');
    if (gauge) gauge.style.setProperty('--pct', `${percentAcompanhados}%`);
    setText('ux-congregados-percent', `${percentAcompanhados}%`);
    setText('ux-congregados-total', congregados);
    setText('ux-congregados-acompanhados', acompanhados);

    const people = document.getElementById('ux-ativos-people');
    if (people) {
      const slots = 24;
      const inativosSlots = total && inativos ? Math.max(1, Math.round((inativos / total) * slots)) : 0;
      people.innerHTML = Array.from({ length: slots }, (_, index) => {
        const inactive = !total || index >= slots - inativosSlots;
        return `<span class="${inactive ? 'inactive' : 'active'}"><i class="fa-solid fa-user"></i></span>`;
      }).join('');
    }

    setText('ux-aniversariantes-state', aniversariantes
      ? `${plural(aniversariantes, 'celebração prevista', 'celebrações previstas')}`
      : 'Não há aniversariantes este mês');

    setText('ux-secondary-total', textoComparacao(doMes, mesAnterior));
    setText('ux-secondary-membros', membrosAtual
      ? `${plural(membrosAtual, 'membro recebido', 'membros recebidos')} neste mês`
      : 'Nenhum membro recebido neste mês');
    setText('ux-secondary-congregados', congregados
      ? `${acompanhados} de ${congregados} congregados acompanhados`
      : 'Nenhum congregado cadastrado ainda');
    setText('ux-secondary-ativos', inativos
      ? `${ativos} ativos e ${inativos} inativos`
      : 'Todos os cadastros estão ativos');
    setText('ux-secondary-mes', textoComparacao(doMes, mesAnterior));
    setText('ux-secondary-aniversariantes', aniversariantes
      ? `${plural(aniversariantes, 'pessoa para celebrar', 'pessoas para celebrar')}`
      : 'Não há aniversariantes este mês');

    if (indicadorAtivo) renderPainelIndicador();
  }

  function renderStats() {
    return renderStoryStats();
    const total = membrosCache.length;
    const membros = membrosCache.filter(m => m.tipo_cadastro === 'Membro').length;
    const congregados = membrosCache.filter(m => m.tipo_cadastro === 'Congregado').length;
    const ativos = membrosCache.filter(m => !m.status || m.status === 'Ativo').length;
    const aniversariantes = membrosCache.filter(m => {
      if (!m.data_nasc || (m.status && m.status !== 'Ativo')) return false;
      const d = new Date(m.data_nasc);
      return d.getMonth() === new Date().getMonth();
    }).length;

    const agora = new Date();
    const doMes = membrosCache.filter(m => {
      if (!m.created_at) return false;
      const d = new Date(m.created_at);
      return d.getMonth() === agora.getMonth() && d.getFullYear() === agora.getFullYear();
    }).length;

    const setNum = (id, val) => {
      const el = document.getElementById(id);
      if (el.textContent !== String(val)) {
        el.textContent = val;
        el.classList.remove('bump');
        void el.offsetWidth;
        el.classList.add('bump');
      }
    };

    setNum('stat-total', total);
    setNum('stat-membros', membros);
    setNum('stat-congregados', congregados);
    setNum('stat-ativos', ativos);
    setNum('stat-mes', doMes);
    setNum('stat-aniversariantes', aniversariantes);

    const setText = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.textContent = val;
    };
    const setCssValue = (selector, prop, val) => {
      const el = document.querySelector(selector);
      if (el) el.style.setProperty(prop, val);
    };
    const plural = (value, single, pluralText) => `${value} ${value === 1 ? single : pluralText}`;
    const metaMensal = Math.max(4, doMes || 0);
    const totalPercent = metaMensal ? Math.min(100, Math.round((doMes / metaMensal) * 100)) : 0;
    const congregadosPercent = total ? Math.round((congregados / total) * 100) : 0;
    const ativosPercent = total ? Math.round((ativos / total) * 100) : 0;
    const mesesResumo = Array.from({ length: 4 }, (_, offset) => {
      const data = new Date(agora.getFullYear(), agora.getMonth() - (3 - offset), 1);
      const count = membrosCache.filter(m => {
        if (!m.created_at) return false;
        const d = new Date(m.created_at);
        return d.getMonth() === data.getMonth() && d.getFullYear() === data.getFullYear();
      }).length;
      return {
        label: data.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', ''),
        count
      };
    });
    const maiorMes = Math.max(1, ...mesesResumo.map(item => item.count));

    setText('metric-total-percent', `${totalPercent}%`);
    setCssValue('#metric-total-fill', 'width', `${totalPercent}%`);
    setText('metric-congregados-percent', `${congregadosPercent}%`);
    setCssValue('.metric-gauge', '--gauge-value', `${Math.min(180, Math.round((congregadosPercent / 100) * 180))}deg`);
    document.querySelectorAll('.metric-member-bars .member-bar').forEach((bar, index) => {
      const item = mesesResumo[index];
      if (!item) return;
      bar.style.setProperty('--h', `${Math.max(18, Math.round((item.count / maiorMes) * 92))}%`);
      const value = bar.querySelector('strong');
      const label = bar.querySelector('em');
      if (value) value.textContent = item.count;
      if (label) label.textContent = item.label;
      if (index === mesesResumo.length - 1) bar.classList.add('current');
    });

    const peopleContainer = document.getElementById('metric-ativos-people');
    if (peopleContainer) {
      const onCount = Math.min(10, ativos);
      const icons = Array.from({ length: 10 }, (_, index) => `
        <i class="fa-solid fa-user ${index < onCount ? 'on' : ''}"></i>`).join('');
      peopleContainer.innerHTML = icons;
    }

    const birthdayState = document.getElementById('metric-aniversariantes-state');
    if (birthdayState) {
      birthdayState.textContent = aniversariantes
        ? `${plural(aniversariantes, 'aniversariante ativo', 'aniversariantes ativos')}`
        : 'Nao ha aniversariantes este mes';
    }

    setText('metric-total-foot-left', `Meta mensal: ${metaMensal} registros`);
    setText('metric-total-foot-right', `${Math.min(doMes, metaMensal)} de ${metaMensal}`);
    setText('metric-membros-foot-left', `Este mês: ${agora.toLocaleDateString('pt-BR', { month: 'long' })}`);
    setText('metric-membros-foot-right', `Total no ano: ${membros}`);
    setText('metric-congregados-foot-left', `Total de congregados: ${congregados}`);
    setText('metric-congregados-foot-right', `Acompanhados: ${congregados}`);
    setText('metric-ativos-foot-left', `${ativos} de ${total} registros ativos`);
    setText('metric-ativos-foot-right', `${ativosPercent}%`);
    setText('metric-mes-foot-left', `${plural(doMes, 'novo cadastro', 'novos cadastros')}`);
    setText('metric-mes-foot-right', `Neste mês`);
    setText('metric-aniversariantes-foot-left', aniversariantes ? `${plural(aniversariantes, 'celebracao prevista', 'celebracoes previstas')}` : 'Nenhum aniversariante este mes');
    setText('metric-aniversariantes-foot-right', agora.toLocaleDateString('pt-BR', { month: 'long' }));

    setText('dashboard-birthday-title', `${plural(aniversariantes, 'aniversariante', 'aniversariantes')} este mes`);
    setText(
      'dashboard-birthday-subtitle',
      aniversariantes ? 'Confira a lista e prepare a celebracao do mes.' : 'Nenhuma celebracao prevista para este mes.'
    );

    if (indicadorAtivo) renderPainelIndicador();
  }

  function obterIndicador(metric = 'total') {
    const ativos = membrosCache.filter(m => !m.status || m.status === 'Ativo');
    const membros = membrosCache.filter(m => m.tipo_cadastro === 'Membro');
    const congregados = membrosCache.filter(m => m.tipo_cadastro === 'Congregado');
    const agora = new Date();
    const mesAtual = agora.getMonth();
    const anoAtual = agora.getFullYear();
    const doMes = membrosCache.filter(m => {
      if (!m.created_at) return false;
      const d = new Date(m.created_at);
      return d.getMonth() === mesAtual && d.getFullYear() === anoAtual;
    });
    const aniversariantes = membrosCache.filter(m => {
      if (!m.data_nasc || (m.status && m.status !== 'Ativo')) return false;
      const d = new Date(m.data_nasc);
      return d.getMonth() === mesAtual;
    });

    const porStatus = ['Ativo', 'Inativo', 'Transferido', 'Falecido'].map(status => ({
      label: status,
      value: membrosCache.filter(m => (m.status || 'Ativo') === status).length
    }));

    const porTipo = [
      { label: 'Membros', value: membros.length },
      { label: 'Congregados', value: congregados.length }
    ];

    const ultimosMeses = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(anoAtual, mesAtual - i, 1);
      const label = d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '');
      ultimosMeses.push({
        label,
        value: membrosCache.filter(m => {
          if (!m.created_at) return false;
          const cd = new Date(m.created_at);
          return cd.getMonth() === d.getMonth() && cd.getFullYear() === d.getFullYear();
        }).length
      });
    }

    const porDiaAniversario = aniversariantes
      .map(m => ({ label: String(new Date(m.data_nasc).getDate()).padStart(2, '0'), value: 1 }))
      .reduce((acc, item) => {
        const atual = acc.find(x => x.label === item.label);
        if (atual) atual.value += 1;
        else acc.push(item);
        return acc;
      }, [])
      .sort((a, b) => Number(a.label) - Number(b.label));

    const mapas = {
      total: {
        title: 'Total de cadastros',
        subtitle: 'Visao geral dos registros cadastrados',
        summary: `${membrosCache.length} registros no sistema, sendo ${membros.length} membros e ${congregados.length} congregados.`,
        items: ultimosMeses
      },
      membros: {
        title: 'Membros',
        subtitle: 'Distribuicao dos membros por status',
        summary: `${membros.length} membros cadastrados. ${membros.filter(m => !m.status || m.status === 'Ativo').length} estao ativos.`,
        items: porStatus.map(item => ({
          ...item,
          value: membros.filter(m => (m.status || 'Ativo') === item.label).length
        }))
      },
      congregados: {
        title: 'Congregados',
        subtitle: 'Congregados acompanhados pela igreja',
        summary: `${congregados.length} congregados cadastrados. Este indicador ajuda a acompanhar integracao e crescimento.`,
        items: porStatus.map(item => ({
          ...item,
          value: congregados.filter(m => (m.status || 'Ativo') === item.label).length
        }))
      },
      ativos: {
        title: 'Cadastros ativos',
        subtitle: 'Comparativo entre ativos e demais status',
        summary: `${ativos.length} cadastros ativos de um total de ${membrosCache.length}.`,
        items: [
          { label: 'Ativos', value: ativos.length },
          { label: 'Outros status', value: Math.max(0, membrosCache.length - ativos.length) }
        ]
      },
      mes: {
        title: 'Novos este mês',
        subtitle: 'Comparativo dos últimos 6 meses',
        summary: `${doMes.length} ${doMes.length === 1 ? 'novo cadastro registrado' : 'novos cadastros registrados'} neste mês.`,
        items: ultimosMeses
      },
      aniversariantes: {
        title: 'Aniversariantes',
        subtitle: 'Celebracoes do mes atual',
        summary: `${aniversariantes.length} aniversariante(s) ativo(s) neste mes.`,
        items: porDiaAniversario.length ? porDiaAniversario : [{ label: 'Sem dados', value: 0 }]
      }
    };

    return mapas[metric] || mapas.total;
  }

  function abrirPainelIndicador(metric) {
    indicadorAtivo = metric || 'total';
    if (indicadorAtivo === 'mes' && tipoVisualizacaoIndicador === 'bar') {
      tipoVisualizacaoIndicador = 'line';
    }
    document.querySelectorAll('.stat-card').forEach(card => {
      card.classList.toggle('active', card.dataset.metric === indicadorAtivo);
    });
    const panel = document.getElementById('metric-detail-panel');
    if (panel) {
      panel.hidden = false;
      panel.classList.add('open');
      panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
    renderPainelIndicador();
  }

  window.abrirPainelIndicador = abrirPainelIndicador;

  function fecharPainelIndicador() {
    indicadorAtivo = null;
    document.querySelectorAll('.stat-card').forEach(card => card.classList.remove('active'));
    const panel = document.getElementById('metric-detail-panel');
    if (panel) {
      panel.classList.remove('open');
      panel.hidden = true;
    }
    if (metricChart) {
      metricChart.destroy();
      metricChart = null;
    }
  }

  window.fecharPainelIndicador = fecharPainelIndicador;

  function alterarVisualizacaoIndicador(tipo) {
    tipoVisualizacaoIndicador = tipo || 'bar';
    const select = document.getElementById('metric-view-type');
    if (select && select.value !== tipoVisualizacaoIndicador) select.value = tipoVisualizacaoIndicador;
    if (!indicadorAtivo) abrirPainelIndicador('total');
    else renderPainelIndicador();
  }

  window.alterarVisualizacaoIndicador = alterarVisualizacaoIndicador;

  function renderPainelIndicador() {
    if (!indicadorAtivo) return;
    const info = obterIndicador(indicadorAtivo);
    const title = document.getElementById('metric-title');
    const subtitle = document.getElementById('metric-subtitle');
    const summary = document.getElementById('metric-summary');
    const textView = document.getElementById('metric-text-view');
    const canvas = document.getElementById('metric-chart');
    const select = document.getElementById('metric-view-type');
    if (select) select.value = tipoVisualizacaoIndicador;
    if (title) title.textContent = info.title;
    if (subtitle) subtitle.textContent = info.subtitle;
    if (summary) {
      summary.innerHTML = `<strong>Resumo</strong><p>${safeText(info.summary)}</p><ul>${info.items.map(item => `<li><span>${safeText(item.label)}</span><strong>${safeText(item.value)}</strong></li>`).join('')}</ul>`;
    }

    if (metricChart) {
      metricChart.destroy();
      metricChart = null;
    }

    const labels = info.items.map(item => item.label);
    const values = info.items.map(item => item.value);
    const palette = ['#6D4CFF', '#22C55E', '#F59E0B', '#06B6D4', '#EF4444', '#8B5CF6', '#14B8A6'];

    if (tipoVisualizacaoIndicador === 'text') {
      if (canvas) canvas.style.display = 'none';
      if (textView) {
        textView.style.display = 'grid';
        textView.innerHTML = `<h3>${safeText(info.title)}</h3><p>${safeText(info.summary)}</p>${info.items.map(item => `<div><span>${safeText(item.label)}</span><strong>${safeText(item.value)}</strong></div>`).join('')}`;
      }
      return;
    }

    if (canvas) canvas.style.display = 'block';
    if (textView) {
      textView.style.display = 'none';
      textView.innerHTML = '';
    }
    const ctx = canvas?.getContext('2d');
    if (!ctx) return;
    if (!window.Chart) {
      if (textView) {
        textView.style.display = 'grid';
        textView.innerHTML = `<h3>${safeText(info.title)}</h3><p>Biblioteca de gráficos indisponível. Veja o resumo ao lado.</p>`;
      }
      return;
    }

    const chartType = tipoVisualizacaoIndicador === 'donut' ? 'doughnut' : tipoVisualizacaoIndicador;
    const isRound = chartType === 'pie' || chartType === 'doughnut';
    metricChart = new Chart(ctx, {
      type: chartType,
      data: {
        labels,
        datasets: [{
          label: info.title,
          data: values,
          borderColor: '#6D4CFF',
          backgroundColor: isRound ? palette : 'rgba(109, 76, 255, 0.72)',
          pointBackgroundColor: '#fff',
          pointBorderColor: '#6D4CFF',
          borderRadius: chartType === 'bar' ? 10 : 0,
          borderWidth: isRound ? 3 : 2,
          fill: chartType === 'line',
          tension: 0.35
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: isRound, position: 'bottom', labels: { color: '#475569', boxWidth: 10 } }
        },
        scales: isRound ? {} : {
          y: { beginAtZero: true, grid: { color: 'rgba(226,232,240,0.85)' }, ticks: { color: '#64748b', stepSize: 1 } },
          x: { grid: { display: false }, ticks: { color: '#64748b' } }
        }
      }
    });
  }

  function exportarIndicadorPDF() {
    if (!indicadorAtivo) abrirPainelIndicador('total');
    const info = obterIndicador(indicadorAtivo);
    const { jsPDF } = window.jspdf || {};
    if (!jsPDF) { toast('Biblioteca PDF indisponível.'); return; }
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text(info.title, 14, 18);
    doc.setFontSize(10);
    doc.text(info.subtitle, 14, 26);
    doc.text(doc.splitTextToSize(info.summary, 180), 14, 38);
    if (metricChart && tipoVisualizacaoIndicador !== 'text') {
      const img = metricChart.toBase64Image();
      doc.addImage(img, 'PNG', 14, 58, 180, 85);
    }
    const startY = metricChart && tipoVisualizacaoIndicador !== 'text' ? 154 : 58;
    doc.autoTable({
      startY,
      head: [['Item', 'Quantidade']],
      body: info.items.map(item => [item.label, item.value])
    });
    doc.save(`indicador-${indicadorAtivo}.pdf`);
  }

  window.exportarIndicadorPDF = exportarIndicadorPDF;

  function exportarIndicadorPNG() {
    if (!metricChart || tipoVisualizacaoIndicador === 'text') {
      toast('Abra uma visualizacao grafica antes de baixar PNG.');
      return;
    }
    const a = document.createElement('a');
    a.href = metricChart.toBase64Image();
    a.download = `indicador-${indicadorAtivo}.png`;
    a.click();
  }

  window.exportarIndicadorPNG = exportarIndicadorPNG;

  function toggleFiltrosAvancados() {
    document.querySelector('.toolbar')?.classList.toggle('avancados-abertos');
  }

  window.toggleFiltrosAvancados = toggleFiltrosAvancados;

  function popularFiltroSetor() {
    const setores = [...new Set(membrosCache.map(m => m.setor_igreja).filter(Boolean))].sort();
    const sel = document.getElementById('filtro-setor');
    const val = sel.value;
    sel.innerHTML = '<option value="">Todos os setores</option>';
    setores.forEach(s => {
      const o = document.createElement('option');
      o.value = s;
      o.textContent = s;
      if (s === val) o.selected = true;
      sel.appendChild(o);
    });
  }

  function popularFiltroCargo() {
    const cargos = [...new Set(membrosCache.map(m => m.cargo_principal).filter(Boolean))].sort();
    const sel = document.getElementById('filtro-cargo');
    if (!sel) return;
    const val = sel.value;
    sel.innerHTML = '<option value="">Todos os cargos</option>';
    cargos.forEach(c => {
      const o = document.createElement('option');
      o.value = c;
      o.textContent = c;
      if (c === val) o.selected = true;
      sel.appendChild(o);
    });
  }

  function exportarExcel() {
    if (!membrosCache.length) { toast('⚠️ Nenhum membro para exportar.'); return; }
    const dados = membrosCache.map((m, idx) => ({
      '#': idx + 1,
      'Nome Completo': m.nome,
      'Tipo': m.tipo_cadastro,
      'Status': m.status || 'Ativo',
      'CPF/CRNM': m.cpf || '—',
      'Tipo Doc': m.tipo_cpf === 'estrangeiro' ? 'CRNM (Estrangeiro)' : 'CPF (Brasileiro)',
      'RG': m.rg || '—',
      'Nascimento': m.data_nasc ? m.data_nasc.split('-').reverse().join('/') : '—',
      'Idade': m.idade || '—',
      'Sexo': m.sexo || 'M',
      'Celular': m.celular || '—',
      'E-mail': m.email || '—',
      'Setor': m.setor_igreja || '—',
      'Congregação': m.congregacao_igreja || '—',
      'Cargo': m.cargo_principal || '—',
      'Forma Recebimento': m.forma_recebimento || '—'
    }));
    const ws = XLSX.utils.json_to_sheet(dados);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Membros");
    const maxLens = {};
    dados.forEach(row => {
      Object.entries(row).forEach(([k, v]) => {
        maxLens[k] = Math.max(maxLens[k] || 10, String(v).length);
      });
    });
    ws['!cols'] = Object.keys(maxLens).map(k => ({ wch: maxLens[k] + 2 }));
    XLSX.writeFile(wb, "membros_adbela-vista_2026.xlsx");
    toast('📊 Planilha Excel gerada com sucesso!');
  }
  window.exportarExcel = exportarExcel;

  function toggleAniv() {
    anivAberto = !anivAberto;
    document.getElementById('aniv-body').classList.toggle('fechado', !anivAberto);
    document.getElementById('aniv-chevron').textContent = anivAberto ? 'Ocultar' : 'Ver aniversariantes';
  }

  window.toggleAniv = toggleAniv;

  function renderAniversariantes() {
    const agora = new Date();
    const mesAtual = agora.getMonth();
    const hoje = agora.getDate();

    const lista = membrosCache
      .filter(m => m.data_nasc && (!m.status || m.status === 'Ativo'))
      .map(m => {
        const d = new Date(m.data_nasc);
        return { ...m, dia: d.getDate(), mes: d.getMonth(), ano: d.getFullYear() };
      })
      .filter(m => m.mes === mesAtual)
      .sort((a, b) => a.dia - b.dia);

    const cnt = document.getElementById('aniv-count');
    cnt.textContent = lista.length;
    cnt.style.display = lista.length ? '' : 'none';
    const title = document.querySelector('.birthdays-panel .aniv-title') || document.querySelector('.aniv-title');
    if (title?.childNodes?.[0]) {
      title.childNodes[0].textContent = `${lista.length} aniversariante${lista.length === 1 ? '' : 's'} este mes `;
    }
    const chevron = document.getElementById('aniv-chevron');
    if (chevron) chevron.textContent = anivAberto ? 'Ocultar' : 'Ver aniversariantes';

    const meses = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
    const body = document.getElementById('aniv-body');

    if (!lista.length) {
      body.innerHTML = '<div style="color:var(--muted);font-size:0.85rem;padding:0.5rem 0;text-align:center;">Nenhum aniversariante este mês 🎉</div>';
      return;
    }

    body.innerHTML = lista.map(m => {
      const eHoje = m.dia === hoje;
      const idade = agora.getFullYear() - m.ano;
      const tel = m.celular ? m.celular.replace(/\D/g, '') : null;
      const foto = safeUrl(m.foto_url);
      const nome = safeText(m.nome);
      const primeiroNome = encodeURIComponent(String(m.nome || '').split(' ')[0] || '');

      return `<div class="aniv-item" style="${eHoje ? 'background:rgba(201,168,76,0.06);border-radius:8px;padding:8px;' : ''}">
        ${foto ? `<img src="${foto}" class="aniv-avatar" referrerpolicy="no-referrer">` : `<div class="aniv-avatar-placeholder">🎂</div>`}
        <div class="aniv-info">
          <div class="aniv-nome">${nome} ${eHoje ? '<span class="hoje-badge">HOJE!</span>' : ''}</div>
          <div class="aniv-sub">Dia ${m.dia} de ${meses[mesAtual]} · ${idade} anos</div>
        </div>
        ${tel ? `<a href="https://wa.me/55${tel}?text=Feliz+aniversário+${primeiroNome}!+Que+Deus+te+abençoe+muito!" target="_blank" class="btn btn-gold btn-sm" style="text-decoration:none;">🎉 Parabenizar</a>` : ''}
      </div>`;
    }).join('');
  }

  function configurarFiltrosRapidos() {
    const buttons = Array.from(document.querySelectorAll('[data-quick-filter]'));
    if (!buttons.length || document.body.dataset.quickFiltersReady === 'true') return;

    buttons.forEach((button) => {
      button.addEventListener('click', () => {
        buttons.forEach(btn => btn.classList.remove('active'));
        button.classList.add('active');

        const tipo = document.getElementById('filtro-tipo');
        const status = document.getElementById('filtro-status');
        const quick = button.dataset.quickFilter;

        if (tipo) tipo.value = '';
        if (status) status.value = '';
        if (quick === 'pendentes' && status) status.value = 'Pendente';
        if (quick === 'ativos' && status) status.value = 'Ativo';
        if (quick === 'membros' && tipo) tipo.value = 'Membro';
        if (quick === 'congregados' && tipo) tipo.value = 'Congregado';

        paginaAtual = 1;
        renderLista();
      });
    });

    document.body.dataset.quickFiltersReady = 'true';
  }

  function atualizarResumoMembros(filtrados) {
    const total = membrosCache.length;
    const ativos = membrosCache.filter(isAtivo).length;
    const pendentes = membrosCache.filter(m => ['Pendente', 'Em análise', 'Correção'].includes(m.status || '')).length;
    const membros = membrosCache.filter(m => m.tipo_cadastro === 'Membro').length;
    const congregados = membrosCache.filter(m => m.tipo_cadastro === 'Congregado').length;

    const setText = (id, value) => {
      const el = document.getElementById(id);
      if (el) el.textContent = value;
    };

    setText('quick-count-todos', total);
    setText('quick-count-pendentes', pendentes);
    setText('quick-count-ativos', ativos);
    setText('quick-count-membros', membros);
    setText('quick-count-congregados', congregados);

    const title = document.getElementById('members-title');
    if (title) title.textContent = `${filtrados.length} ${filtrados.length === 1 ? 'cadastro encontrado' : 'cadastros encontrados'}`;
  }

  function renderMembrosMobile(lista) {
    const alvo = document.getElementById('members-card-list');
    if (!alvo) return;

    if (!lista.length) {
      alvo.innerHTML = '<div class="empty"><div class="e-icon"><i class="fa-solid fa-inbox"></i></div><p>Nenhum membro encontrado.</p></div>';
      return;
    }

    alvo.innerHTML = lista.map(m => {
      const id = String(m.id ?? '');
      const tipo = m.tipo_cadastro || '-';
      const badgeTipo = tipo === 'Membro' ? 'membro' : 'congregado';
      const ministerio = m.cargo_principal || m.setor_igreja || '-';
      const contato = m.celular || '-';

      return `
        <article class="member-mobile-card">
          <div class="member-mobile-top">
            ${avatarImg(m, 44)}
            <div>
              <strong class="member-name">${safeText(m.nome)}</strong>
              <div class="member-sub">${safeText(m.email || m.setor_igreja || '-')}</div>
            </div>
          </div>
          <div class="member-mobile-meta">
            <span>${safeText(m.cpf || '-')}</span>
            <span>${safeText(contato)}</span>
            <span>${safeText(ministerio)}</span>
          </div>
          <div class="member-mobile-foot">
            <div>
              <span class="badge badge-${badgeTipo}">${safeText(tipo)}</span>
              ${statusBadge(m.status)}
            </div>
            <div class="td-actions">
              <button type="button" class="member-action" data-member-action="details" data-member-id="${escapeAttr(id)}" aria-label="Visualizar"><i class="fa-solid fa-eye"></i></button>
              <button type="button" class="member-action" data-member-action="edit" data-member-id="${escapeAttr(id)}" aria-label="Editar"><i class="fa-solid fa-pen"></i></button>
              ${statusActions(m)}
              ${whatsappLink(m.celular)}
              ${DELETE_ROLES.includes(currentAdminRole) ? `<button type="button" class="member-action member-action-danger" data-member-action="delete" data-member-id="${escapeAttr(id)}" data-member-name="${escapeAttr(m.nome || '')}" aria-label="Excluir"><i class="fa-solid fa-trash"></i></button>` : ''}
            </div>
          </div>
        </article>`;
    }).join('');
  }

  function renderLista(novoId = null) {
    configurarAcoesLista();
    configurarFiltrosRapidos();
    const busca = document.getElementById('busca').value.toLowerCase();
    const filtroTipo = document.getElementById('filtro-tipo').value;
    const filtroStatus = document.getElementById('filtro-status').value;
    const filtroSetor = document.getElementById('filtro-setor').value;
    const filtroIdade = document.getElementById('filtro-idade').value;
    const filtroCargo = document.getElementById('filtro-cargo').value;

    const filtrados = membrosCache.filter(m => {
      const nomeBusca = String(m.nome || '').toLowerCase();
      const emailBusca = String(m.email || '').toLowerCase();
      const mb = !busca || nomeBusca.includes(busca)
        || (m.cpf || '').includes(busca)
        || (m.celular || '').includes(busca)
        || emailBusca.includes(busca);
      const mt = !filtroTipo || m.tipo_cadastro === filtroTipo;
      const ms = !filtroStatus || (m.status || 'Ativo') === filtroStatus;
      const mse = !filtroSetor || m.setor_igreja === filtroSetor;
      
      let mi = true;
      if (filtroIdade) {
        const idade = m.idade;
        if (idade === null || idade === undefined) mi = false;
        else if (filtroIdade === 'crianca') mi = (idade <= 12);
        else if (filtroIdade === 'adolescente') mi = (idade >= 13 && idade <= 17);
        else if (filtroIdade === 'jovem') mi = (idade >= 18 && idade <= 29);
        else if (filtroIdade === 'adulto') mi = (idade >= 30 && idade <= 59);
        else if (filtroIdade === 'idoso') mi = (idade >= 60);
      }

      const mc = !filtroCargo || m.cargo_principal === filtroCargo;

      return mb && mt && ms && mse && mi && mc;
    });

    atualizarResumoMembros(filtrados);

    const corpo = document.getElementById('corpo-lista');
    const totalPag = Math.max(1, Math.ceil(filtrados.length / POR_PAGINA));
    if (paginaAtual > totalPag) paginaAtual = 1;

    const inicio = (paginaAtual - 1) * POR_PAGINA;
    const pagina = filtrados.slice(inicio, inicio + POR_PAGINA);

    if (!filtrados.length) {
      corpo.innerHTML = `<tr><td colspan="8"><div class="empty"><div class="e-icon"><i class="fa-solid fa-inbox"></i></div><p>Nenhum membro encontrado.</p></div></td></tr>`;
      document.getElementById('paginacao').innerHTML = '';
      renderMembrosMobile([]);
      return;
    }

    corpo.innerHTML = pagina.map(m => {
      const id = String(m.id ?? '');
      const tipo = m.tipo_cadastro || '-';
      const badgeTipo = tipo === 'Membro' ? 'membro' : 'congregado';
      const destaque = String(m.id ?? '') === String(novoId ?? '') ? 'novo-destaque' : '';
      const ministerio = m.cargo_principal || m.setor_igreja || '-';
      const contato = m.celular || '-';
      return `<tr id="row-${escapeAttr(id)}" class="member-row ${destaque}">
      <td>${avatarImg(m, 42)}</td>
      <td>
        <strong class="member-name">${safeText(m.nome)}</strong>
        <div class="member-sub">${safeText(m.email || m.setor_igreja || '-')}</div>
      </td>
      <td><span class="member-doc">${safeText(m.cpf || '-')}</span></td>
      <td><span class="badge badge-${badgeTipo}">${safeText(tipo)}</span></td>
      <td>${statusBadge(m.status)}</td>
      <td><span class="member-ministry">${safeText(ministerio)}</span></td>
      <td><span class="member-phone">${safeText(contato)}</span></td>
      <td><div class="td-actions">
        <button type="button" class="member-action" data-member-action="details" data-member-id="${escapeAttr(id)}" title="Visualizar" aria-label="Visualizar"><i class="fa-solid fa-eye"></i></button>
        <button type="button" class="member-action" data-member-action="edit" data-member-id="${escapeAttr(id)}" title="Editar" aria-label="Editar"><i class="fa-solid fa-pen"></i></button>
        ${statusActions(m)}
        ${whatsappLink(m.celular)}
        ${DELETE_ROLES.includes(currentAdminRole) ? `<button type="button" class="member-action member-action-danger" data-member-action="delete" data-member-id="${escapeAttr(id)}" data-member-name="${escapeAttr(m.nome || '')}" title="Excluir" aria-label="Excluir"><i class="fa-solid fa-trash"></i></button>` : ''}
      </div></td></tr>`;
    }).join('');
    renderMembrosMobile(pagina);

    const pag = document.getElementById('paginacao');
    if (totalPag <= 1) {
      pag.innerHTML = `<span>${filtrados.length} registros</span>`;
      return;
    }

    let h = `<span>${filtrados.length} registros</span>`;
    h += `<button class="btn btn-ghost btn-sm" onclick="mudarPagina(${paginaAtual - 1})" ${paginaAtual === 1 ? 'disabled' : ''}>‹</button>`;

    for (let p = 1; p <= totalPag; p++) {
      if (p === paginaAtual) h += `<button class="btn btn-primary btn-sm">${p}</button>`;
      else if (p === 1 || p === totalPag || Math.abs(p - paginaAtual) <= 1) h += `<button class="btn btn-ghost btn-sm" onclick="mudarPagina(${p})">${p}</button>`;
      else if (Math.abs(p - paginaAtual) === 2) h += `<span>…</span>`;
    }

    h += `<button class="btn btn-ghost btn-sm" onclick="mudarPagina(${paginaAtual + 1})" ${paginaAtual === totalPag ? 'disabled' : ''}>›</button>`;
    pag.innerHTML = h;
  }

  window.carregarLista = carregarLista;
  window.renderLista = renderLista;

  function configurarAcoesLista() {
    if (document.body.dataset.memberActionsReady === 'true') return;

    document.addEventListener('click', (event) => {
      const control = event.target.closest('[data-member-action]');
      if (!control) return;

      event.preventDefault();
      const id = control.dataset.memberId || '';
      const action = control.dataset.memberAction;

      if (action === 'details') window.verDetalhes(id);
      if (action === 'edit') {
        abrirEdicao(id);
        document.getElementById('modal-overlay')?.classList.remove('open');
      }
      if (action === 'pdf') imprimirFicha(id);
      if (action === 'approve') alterarStatusCadastro(id, 'Aprovado');
      if (action === 'correction') alterarStatusCadastro(id, 'Correção');
      if (action === 'delete') {
        document.getElementById('modal-overlay')?.classList.remove('open');
        excluirMembro(id, control.dataset.memberName || '');
      }
    });

    document.body.dataset.memberActionsReady = 'true';
  }

  async function alterarStatusCadastro(id, status) {
    const membro = membrosCache.find(item => String(item.id) === String(id));
    if (!membro) return;

    const patch = { status };
    if (status === 'Aprovado') {
      patch.data_aprovacao = new Date().toISOString().slice(0, 10);
    }

    const { error } = await db.from('membros').update(patch).eq('id', id);
    if (error) {
      toast('Não foi possível atualizar o status.');
      return;
    }

    Object.assign(membro, patch);
    renderStats();
    renderLista();
    toast(status === 'Aprovado' ? 'Ficha aprovada.' : 'Correção solicitada.');
  }

  let renderListaTimer = null;
  function renderListaDebounced() {
    clearTimeout(renderListaTimer);
    renderListaTimer = setTimeout(() => renderLista(), 120);
  }
  window.renderListaDebounced = renderListaDebounced;

  function mudarPagina(p) {
    paginaAtual = p;
    renderLista();
    document.querySelector('.table-wrap')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  window.mudarPagina = mudarPagina;

  function verDetalhes(id) {
    const m = membrosCache.find(x => String(x.id) === String(id));
    if (!m) return;

    const idSeguro = String(m.id ?? '');
    const tel = m.celular ? m.celular.replace(/\D/g, '') : null;
    const foto = safeUrl(m.foto_url);
    const doc = safeUrl(m.doc_url);
    const tipo = m.tipo_cadastro || '-';
    const badgeTipo = tipo === 'Membro' ? 'membro' : 'congregado';
    const enderecoLinha = `${fmt(m.endereco)}${m.bairro ? ', ' + safeText(m.bairro) : ''}${m.cidade_estado ? ' — ' + safeText(m.cidade_estado) : ''}`;

    document.getElementById('modal-conteudo').innerHTML = `
      <div class="modal-header">
        <div style="display:flex;align-items:center;">
          ${foto ? `<img src="${foto}" class="foto-modal-grande" referrerpolicy="no-referrer">` : `<div style="width:80px;height:80px;border-radius:50%;background:rgba(201,168,76,0.12);display:flex;align-items:center;justify-content:center;font-size:2rem;margin-right:1rem;flex-shrink:0;">👤</div>`}
          <div>
            <div class="modal-nome">${safeText(m.nome)}</div>
            <div style="margin-top:4px;display:flex;gap:6px;flex-wrap:wrap;">
              <span class="badge badge-${badgeTipo}">${safeText(tipo)}</span>
              ${statusBadge(m.status)}
            </div>
          </div>
        </div>
        <button class="btn btn-ghost btn-sm" onclick="document.getElementById('modal-overlay').classList.remove('open')">✕</button>
      </div>

      <div class="modal-section"><div class="modal-section-title">👤 Dados Pessoais</div><div class="modal-grid">
        <div class="modal-field"><strong>${m.tipo_cpf === 'estrangeiro' ? 'CRNM' : 'CPF'}</strong><span>${fmt(m.cpf)}</span></div>
        ${m.tipo_cpf !== 'estrangeiro' ? `<div class="modal-field"><strong>RG</strong><span>${fmt(m.rg)}</span></div>` : ''}
        <div class="modal-field"><strong>Nascimento</strong><span>${fmtDate(m.data_nasc)}${m.idade ? ' · ' + safeText(m.idade) + ' anos' : ''}</span></div>
        <div class="modal-field"><strong>Sexo</strong><span>${fmt(m.sexo)}</span></div>
        <div class="modal-field"><strong>Estado Civil</strong><span>${fmt(m.estado_civil)}</span></div>
        <div class="modal-field"><strong>Cônjuge</strong><span>${fmt(m.conjuge_nome)}</span></div>
        <div class="modal-field"><strong>Escolaridade</strong><span>${fmt(m.escolaridade)}</span></div>
        <div class="modal-field"><strong>Ocupação</strong><span>${fmt(m.ocupacao)}</span></div>
      </div></div>

      <div class="modal-section"><div class="modal-section-title">📍 Contato</div><div class="modal-grid">
        <div class="modal-field" style="grid-column:1/-1;"><strong>Endereço</strong><span>${enderecoLinha}</span></div>
        <div class="modal-field"><strong>Celular</strong><span>${fmt(m.celular)}</span></div>
        <div class="modal-field"><strong>E-mail</strong><span>${fmt(m.email)}</span></div>
      </div></div>

      <div class="modal-section"><div class="modal-section-title">✝️ Igreja</div><div class="modal-grid">
        <div class="modal-field"><strong>Setor</strong><span>${fmt(m.setor_igreja)}</span></div>
        <div class="modal-field"><strong>Congregação</strong><span>${fmt(m.congregacao_igreja)}</span></div>
        <div class="modal-field"><strong>Recebimento</strong><span>${fmt(m.forma_recebimento)}</span></div>
        <div class="modal-field"><strong>Cargo</strong><span>${fmt(m.cargo_principal)}</span></div>
        <div class="modal-field"><strong>Batismo Águas</strong><span>${fmtDate(m.data_batismo_aguas)}</span></div>
        <div class="modal-field"><strong>Batismo ES</strong><span>${fmtDate(m.data_batismo_es)}</span></div>
      </div></div>

      ${doc ? `<div class="modal-section"><div class="modal-section-title">🪪 Documento</div><img src="${doc}" style="width:100%;max-height:200px;object-fit:contain;border-radius:8px;" referrerpolicy="no-referrer"></div>` : ''}
      ${m.talentos ? `<div class="modal-section"><div class="modal-section-title">🌟 Talentos</div><span style="font-size:0.88rem;">${safeText(m.talentos)}</span></div>` : ''}

      <div style="display:flex;gap:8px;margin-top:1rem;justify-content:flex-end;flex-wrap:wrap;">
        ${tel ? `<a href="https://wa.me/55${tel}" target="_blank" class="btn btn-green btn-sm" style="text-decoration:none;">💬 WhatsApp</a>` : ''}
        <button class="btn btn-ghost btn-sm" onclick="abrirEdicao(${jsString(idSeguro)});document.getElementById('modal-overlay').classList.remove('open')">✏️ Editar</button>
        <button type="button" class="btn btn-ghost btn-sm" data-member-action="pdf" data-member-id="${escapeAttr(idSeguro)}"><i class="fa-solid fa-file-pdf"></i> PDF completo</button>
        <button class="btn btn-danger btn-sm" onclick="excluirMembro(${jsString(idSeguro)},${jsString(m.nome || '')});document.getElementById('modal-overlay').classList.remove('open')">✕ Excluir</button>
      </div>`;

    document.getElementById('modal-overlay').classList.add('open');
  }
  window.verDetalhes = verDetalhes;

  async function verDetalhesFicha(id) {
    const membroOriginal = membrosCache.find(x => String(x.id) === String(id));
    if (!membroOriginal) return;
    const m = await renovarUrlsMembroCampos(membroOriginal, ['foto_url', 'doc_url']);

    const idSeguro = String(m.id ?? '');
    const tel = m.celular ? m.celular.replace(/\D/g, '') : null;
    const foto = safeUrl(m.foto_url);
    const doc = safeUrl(m.doc_url);
    const tipo = m.tipo_cadastro || '-';
    const badgeTipo = tipo === 'Membro' ? 'membro' : 'congregado';
    const enderecoLinha = `${fmt(m.endereco)}${m.bairro ? ', ' + safeText(m.bairro) : ''}${m.cidade_estado ? ' - ' + safeText(m.cidade_estado) : ''}`;

    const field = (label, value, extraClass = '') => `
      <div class="profile-field ${extraClass}">
        <span>${safeText(label)}</span>
        <strong>${fmt(value)}</strong>
      </div>`;

    const dateField = (label, value, extra = '') => `
      <div class="profile-field">
        <span>${safeText(label)}</span>
        <strong>${fmtDate(value)}${extra}</strong>
      </div>`;

    const docStatus = [
      ['Foto', m.foto_url],
      ['Documento', m.doc_url],
      ['Nascimento', m.foto_certidao_nasc],
      ['Casamento', m.foto_certidao_casamento],
      ['Diploma', m.foto_diploma],
      ['Endereço', m.foto_comprovante_end],
      ['Assinatura', m.assinatura_url]
    ].map(([label, value]) => `
      <span class="profile-doc-chip ${value ? 'ok' : ''}">
        <i class="fa-solid ${value ? 'fa-check' : 'fa-minus'}"></i>${safeText(label)}
      </span>`).join('');

    const modal = document.getElementById('modal-conteudo');
    modal.className = 'modal member-profile-modal';
    modal.innerHTML = `
      <div class="profile-sheet-head">
        <div class="profile-photo-wrap">
          ${foto ? `<img src="${foto}" class="profile-photo" referrerpolicy="no-referrer" alt="Foto de ${safeText(m.nome)}">` : `<div class="profile-photo profile-photo-empty"><i class="fa-solid fa-user"></i></div>`}
        </div>
        <div class="profile-title">
          <span>Ficha cadastral</span>
          <h2>${safeText(m.nome)}</h2>
          <div class="profile-badges">
            <span class="badge badge-${badgeTipo}">${safeText(tipo)}</span>
            ${statusBadge(m.status)}
          </div>
        </div>
        <button type="button" class="profile-close" onclick="document.getElementById('modal-overlay').classList.remove('open')" aria-label="Fechar"><i class="fa-solid fa-xmark"></i></button>
      </div>

      <div class="profile-summary">
        ${field(m.tipo_cpf === 'estrangeiro' ? 'CRNM' : 'CPF', m.cpf)}
        ${field('Celular', m.celular)}
        ${field('Setor', m.setor_igreja)}
        ${field('Cargo', m.cargo_principal)}
      </div>

      <div class="profile-section">
        <div class="profile-section-title"><i class="fa-solid fa-id-card"></i><span>Identificação</span></div>
        <div class="profile-grid">
          ${m.tipo_cpf !== 'estrangeiro' ? field('RG', m.rg) : ''}
          ${dateField('Nascimento', m.data_nasc, m.idade ? ` - ${safeText(m.idade)} anos` : '')}
          ${field('Sexo', m.sexo)}
          ${field('Estado civil', m.estado_civil)}
          ${field('Cônjuge', m.conjuge_nome)}
          ${dateField('Casamento', m.data_casamento)}
          ${field('Escolaridade', m.escolaridade)}
          ${field('Ocupação', m.ocupacao)}
        </div>
      </div>

      <div class="profile-section">
        <div class="profile-section-title"><i class="fa-solid fa-location-dot"></i><span>Contato e endereço</span></div>
        <div class="profile-grid">
          ${field('Endereço', enderecoLinha, 'wide')}
          ${field('E-mail', m.email)}
          ${field('Fone residencial', m.fone_res)}
          ${field('Fone comercial', m.fone_com)}
          ${field('CEP', m.cep)}
        </div>
      </div>

      <div class="profile-section">
        <div class="profile-section-title"><i class="fa-solid fa-church"></i><span>Igreja</span></div>
        <div class="profile-grid">
          ${field('Congregação', m.congregacao_igreja)}
          ${field('Recebimento', m.forma_recebimento)}
          ${dateField('Batismo águas', m.data_batismo_aguas)}
          ${dateField('Batismo ES', m.data_batismo_es)}
          ${dateField('Aprovação', m.data_aprovacao)}
          ${field('Outras funções', m.outras_funcoes)}
        </div>
      </div>

      <div class="profile-section">
        <div class="profile-section-title"><i class="fa-solid fa-folder-open"></i><span>Documentos</span></div>
        <div class="profile-docs">${docStatus}</div>
        ${doc ? `<img src="${doc}" class="profile-document-preview" referrerpolicy="no-referrer" alt="Documento anexado">` : ''}
      </div>

      ${m.talentos ? `<div class="profile-section"><div class="profile-section-title"><i class="fa-solid fa-star"></i><span>Talentos</span></div><p class="profile-note">${safeText(m.talentos)}</p></div>` : ''}

      <div class="profile-actions">
        ${tel ? `<a href="https://wa.me/55${tel}" target="_blank" class="btn btn-green btn-sm" style="text-decoration:none;"><i class="fa-brands fa-whatsapp"></i> WhatsApp</a>` : ''}
        <button type="button" class="btn btn-ghost btn-sm" data-member-action="edit" data-member-id="${escapeAttr(idSeguro)}"><i class="fa-solid fa-pen"></i> Editar</button>
        <button type="button" class="btn btn-ghost btn-sm" data-member-action="pdf" data-member-id="${escapeAttr(idSeguro)}"><i class="fa-solid fa-file-pdf"></i> PDF completo</button>
        ${DELETE_ROLES.includes(currentAdminRole) ? `<button type="button" class="btn btn-danger btn-sm" data-member-action="delete" data-member-id="${escapeAttr(idSeguro)}" data-member-name="${escapeAttr(m.nome || '')}"><i class="fa-solid fa-trash"></i> Excluir</button>` : ''}
      </div>`;

    document.getElementById('modal-overlay').classList.add('open');
  }
  window.verDetalhes = verDetalhesFicha;

  function ensureSelectValue(el, value) {
    if (!el || el.tagName !== 'SELECT' || value === null || value === undefined || value === '') return;

    const exists = Array.from(el.options || []).some(opt => opt.value === String(value));
    if (!exists) {
      const opt = document.createElement('option');
      opt.value = value;
      opt.textContent = value;
      el.appendChild(opt);
    }
  }

  function sincronizarEdicaoCongregacaoPastor() {
    const setor = document.getElementById('edit-setor');
    const congregacao = document.getElementById('edit-congregacao');

    if (setor && congregacao) {
      congregacao.value = setor.value || '';
    }
  }

  window.sincronizarEdicaoCongregacaoPastor = sincronizarEdicaoCongregacaoPastor;

  async function abrirEdicao(id) {
    const membroOriginal = membrosCache.find(x => String(x.id) === String(id));
    if (!membroOriginal) return;
    const m = await renovarUrlsMembroCampos(membroOriginal, ['foto_url', 'doc_url']);

    const mapa = {
      'nome': m.nome,
      'rg': m.rg,
      'cpf': m.cpf,
      'nasc': m.data_nasc,
      'idade': m.idade,
      'sangue': m.tipo_sanguineo,
      'esc': m.escolaridade,
      'civil': m.estado_civil,
      'conjuge': m.conjuge_nome,
      'casamento': m.data_casamento,
      'cep': m.cep,
      'bairro': m.bairro,
      'endereco': m.endereco,
      'cidade': m.cidade_estado,
      'fone-res': m.fone_res,
      'fone-com': m.fone_com,
      'celular': m.celular,
      'email': m.email,
      'recebimento': m.forma_recebimento,
      'cargo': m.cargo_principal,
      'setor': m.setor_igreja,
      'congregacao': m.congregacao_igreja,
      'bat-aguas': m.data_batismo_aguas,
      'bat-es': m.data_batismo_es,
      'aprovacao': m.data_aprovacao,
      'filhos': m.qtd_filhos || 0,
      'dep1-nome': m.nome_dep1,
      'dep1-par': m.parentesco_dep1,
      'dep2-nome': m.nome_dep2,
      'dep2-par': m.parentesco_dep2
    };

    Object.entries(mapa).forEach(([k, v]) => {
      const el = document.getElementById('edit-' + k);
      if (el) {
        ensureSelectValue(el, v);
        el.value = v ?? '';
      }
    });
    sincronizarEdicaoCongregacaoPastor();

    document.getElementById('edit-id').value = m.id;
    document.getElementById('edit-status').value = m.status || 'Ativo';

    document.querySelectorAll('input[name="edit-tipo"]').forEach(r => r.checked = (r.value === (m.tipo_cadastro || 'Membro')));
    document.querySelectorAll('input[name="edit-sexo"]').forEach(r => r.checked = (r.value === (m.sexo || 'M')));

    const pf = document.getElementById('edit-preview-foto');
    const pd = document.getElementById('edit-preview-doc');

    const fotoAtual = safeUrl(m.foto_url);
    const docAtual = safeUrl(m.doc_url);

    if (fotoAtual) {
      pf.src = fotoAtual;
      pf.style.display = 'block';
      document.getElementById('edit-placeholder-foto').style.display = 'none';
      document.getElementById('edit-area-foto').classList.add('tem-foto');
    } else {
      pf.style.display = 'none';
      document.getElementById('edit-placeholder-foto').style.display = '';
      document.getElementById('edit-area-foto').classList.remove('tem-foto');
    }

    if (docAtual) {
      pd.src = docAtual;
      pd.style.display = 'block';
      document.getElementById('edit-placeholder-doc').style.display = 'none';
      document.getElementById('edit-area-doc').classList.add('tem-foto');
    } else {
      pd.style.display = 'none';
      document.getElementById('edit-placeholder-doc').style.display = '';
      document.getElementById('edit-area-doc').classList.remove('tem-foto');
    }

    ['edit-input-foto', 'edit-input-cam', 'edit-input-doc', 'edit-input-doc-cam'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });

    document.getElementById('edit-overlay').classList.add('open');
  }

  window.abrirEdicao = abrirEdicao;

  async function salvarEdicao() {
    const id = document.getElementById('edit-id').value;
    const nome = document.getElementById('edit-nome').value.trim();

    if (!nome) { toast('⚠️ Nome obrigatório!'); return; }
    if (/^\d+$/.test(nome)) { toast('⚠️ Nome inválido!'); return; }

    const btn = document.getElementById('btn-salvar-edit');
    btn.innerHTML = '<span class="loading"></span> Salvando…';
    btn.disabled = true;

    const arquivoFoto = obterArquivoSelecionado('edit-input-foto', 'edit-input-cam');
    const arquivoDoc = obterArquivoSelecionado('edit-input-doc', 'edit-input-doc-cam');

    const [novaFoto, novaDoc] = await Promise.all([
      arquivoFoto ? uploadFotoAdmin(arquivoFoto, 'fotos') : Promise.resolve(null),
      arquivoDoc ? uploadFotoAdmin(arquivoDoc, 'docs') : Promise.resolve(null)
    ]);

    if ((arquivoFoto && !novaFoto) || (arquivoDoc && !novaDoc)) {
      btn.innerHTML = '💾 Salvar Alterações';
      btn.disabled = false;
      toast('❌ Não foi possível enviar a foto/documento. Confira as permissões do Storage.');
      return;
    }

    const mAtual = membrosCache.find(x => String(x.id) === String(id));

    sincronizarEdicaoCongregacaoPastor();
    const setorEdicao = document.getElementById('edit-setor').value;

    const dados = {
      tipo_cadastro: document.querySelector('input[name="edit-tipo"]:checked')?.value || 'Membro',
      status: document.getElementById('edit-status').value,
      nome,
      rg: document.getElementById('edit-rg').value,
      cpf: document.getElementById('edit-cpf').value,
      data_nasc: document.getElementById('edit-nasc').value || null,
      idade: parseInt(document.getElementById('edit-idade').value) || null,
      sexo: document.querySelector('input[name="edit-sexo"]:checked')?.value || 'M',
      tipo_sanguineo: document.getElementById('edit-sangue').value,
      escolaridade: document.getElementById('edit-esc').value,
      estado_civil: document.getElementById('edit-civil').value,
      conjuge_nome: document.getElementById('edit-conjuge').value,
      data_casamento: document.getElementById('edit-casamento').value || null,
      cep: document.getElementById('edit-cep').value,
      bairro: document.getElementById('edit-bairro').value,
      endereco: document.getElementById('edit-endereco').value,
      cidade_estado: document.getElementById('edit-cidade').value,
      fone_res: document.getElementById('edit-fone-res').value,
      fone_com: document.getElementById('edit-fone-com').value,
      celular: document.getElementById('edit-celular').value,
      email: document.getElementById('edit-email').value,
      forma_recebimento: document.getElementById('edit-recebimento').value,
      cargo_principal: document.getElementById('edit-cargo').value,
      setor_igreja: setorEdicao,
      congregacao_igreja: setorEdicao,
      data_batismo_aguas: document.getElementById('edit-bat-aguas').value || null,
      data_batismo_es: document.getElementById('edit-bat-es').value || null,
      data_aprovacao: document.getElementById('edit-aprovacao').value || null,
      qtd_filhos: parseInt(document.getElementById('edit-filhos').value) || 0,
      nome_dep1: document.getElementById('edit-dep1-nome').value,
      parentesco_dep1: document.getElementById('edit-dep1-par').value,
      nome_dep2: document.getElementById('edit-dep2-nome').value,
      parentesco_dep2: document.getElementById('edit-dep2-par').value,
      foto_url: novaFoto || (mAtual ? mAtual.foto_url : null),
      doc_url: novaDoc || (mAtual ? mAtual.doc_url : null)
    };

    const { error } = await db.from('membros').update(dados).eq('id', id);
    btn.innerHTML = '💾 Salvar Alterações';
    btn.disabled = false;

    if (error) { toast('❌ Erro ao salvar.'); return; }

    if (novaFoto && mAtual?.foto_url) removerArquivosStorage([mAtual.foto_url]);
    if (novaDoc && mAtual?.doc_url) removerArquivosStorage([mAtual.doc_url]);

    const idx = membrosCache.findIndex(x => String(x.id) === String(id));
    if (idx !== -1) membrosCache[idx] = { ...membrosCache[idx], ...dados };

    renderStats();
    popularFiltroSetor();
    popularFiltroCargo();
    renderAniversariantes();
    renderLista();

    document.getElementById('edit-overlay').classList.remove('open');
    toast('✅ Cadastro atualizado!');
  }

  window.salvarEdicao = salvarEdicao;

  function garantirModalExclusao() {
    let overlay = document.getElementById('delete-overlay');
    if (overlay) return overlay;

    document.body.insertAdjacentHTML('beforeend', `
      <div class="overlay" id="delete-overlay" onclick="fecharOverlayClick(event,'delete-overlay')">
        <div class="modal modal-danger" role="dialog" aria-modal="true" aria-labelledby="delete-title" style="max-width:460px;">
          <div class="modal-header">
            <div>
              <div class="modal-kicker">Ação permanente</div>
              <div class="modal-nome" id="delete-title">Excluir cadastro</div>
            </div>
            <button class="btn btn-ghost btn-sm" type="button" onclick="fecharModalExclusao()" aria-label="Fechar">
              <i class="fa-solid fa-xmark"></i>
            </button>
          </div>
          <p class="delete-copy" id="delete-copy"></p>
          <div class="delete-target" id="delete-target"></div>
          <div class="delete-actions">
            <button class="btn btn-ghost" type="button" onclick="fecharModalExclusao()">Cancelar</button>
            <button class="btn btn-danger" type="button" id="btn-confirmar-exclusao">
              <i class="fa-solid fa-trash"></i> Excluir permanentemente
            </button>
          </div>
        </div>
      </div>`);

    return document.getElementById('delete-overlay');
  }

  function fecharModalExclusao() {
    document.getElementById('delete-overlay')?.classList.remove('open');
  }

  window.fecharModalExclusao = fecharModalExclusao;

  function abrirConfirmacaoExclusao(id, nome) {
    const overlay = garantirModalExclusao();
    const nomeSeguro = nome || 'este cadastro';
    document.getElementById('delete-copy').textContent = 'Esta ação remove o cadastro e tenta limpar as mídias vinculadas no Storage. Depois disso, não há desfazer.';
    document.getElementById('delete-target').textContent = nomeSeguro;
    document.getElementById('btn-confirmar-exclusao').onclick = () => excluirMembro(id, nomeSeguro, true);
    overlay.classList.add('open');
  }

  async function excluirMembro(id, nome, confirmado = false) {
    if (!DELETE_ROLES.includes(currentAdminRole)) {
      toast('Apenas administradores podem excluir cadastros.');
      return;
    }

    if (!confirmado) {
      abrirConfirmacaoExclusao(id, nome);
      return;
    }

    const btn = document.getElementById('btn-confirmar-exclusao');
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<span class="loading"></span> Excluindo...';
    }

    const m = membrosCache.find(x => String(x.id) === String(id));
    const { error } = await db.from('membros').delete().eq('id', id);
    if (error) {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-trash"></i> Excluir permanentemente';
      }
      toast('❌ Erro ao excluir.');
      return;
    }

    if (m) {
      removerArquivosStorage([
        m.foto_url,
        m.doc_url,
        m.foto_certidao_nasc,
        m.foto_certidao_casamento,
        m.foto_diploma,
        m.foto_comprovante_end,
        m.assinatura_url
      ]);
    }

    membrosCache = membrosCache.filter(m => String(m.id) !== String(id));
    renderStats();
    popularFiltroSetor();
    popularFiltroCargo();
    renderAniversariantes();
    renderLista();
    fecharModalExclusao();
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<i class="fa-solid fa-trash"></i> Excluir permanentemente';
    }
    toast('🗑️ Membro excluído.');
  }

  window.excluirMembro = excluirMembro;

  function fecharOverlayClick(e, id) {
    if (e.target === document.getElementById(id)) document.getElementById(id).classList.remove('open');
  }

  window.fecharOverlayClick = fecharOverlayClick;

  function exportarPDF() {
    if (!membrosCache.length) { toast('⚠️ Nenhum membro.'); return; }
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    doc.setFillColor(26, 18, 8);
    doc.rect(0, 0, 210, 38, 'F');
    doc.setTextColor(232, 201, 109);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text('LISTA DE MEMBROS — AD BELA-VISTA 2026', 105, 15, { align: 'center' });

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(180, 150, 80);
    doc.text(`Gerado em ${new Date().toLocaleDateString('pt-BR')} · Total: ${membrosCache.length}`, 105, 27, { align: 'center' });

    doc.autoTable({
      head: [['#', 'Nome', 'Tipo', 'Status', 'CPF/CRNM', 'Celular', 'Setor']],
      body: membrosCache.map((m, i) => [i + 1, m.nome, m.tipo_cadastro, m.status || 'Ativo', m.cpf || '—', m.celular || '—', m.setor_igreja || '—']),
      startY: 44,
      styles: { font: 'helvetica', fontSize: 7.5, cellPadding: 4 },
      headStyles: { fillColor: [61, 43, 31], textColor: [232, 201, 109], fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [250, 247, 242] },
      columnStyles: { 0: { cellWidth: 8 } }
    });

    doc.save('membros_adbela-vista_2026.pdf');
    toast('📄 PDF gerado!');
  }

  window.exportarPDF = exportarPDF;

  async function gerarFichaPdf(id) {
    const m = membrosCache.find(x => String(x.id) === String(id));
    if (!m) return;

    const { jsPDF } = window.jspdf || {};
    if (!jsPDF) { toast('Biblioteca PDF indisponível.'); return; }

    toast('Gerando ficha completa em PDF...');

    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const margin = 14;
    const contentW = pageW - (margin * 2);
    let y = 0;

    const text = (value, fallback = '—') => {
      if (value === null || value === undefined || value === '') return fallback;
      return String(value);
    };
    const date = value => value ? String(value).split('-').reverse().join('/') : '—';
    const sanitizeFile = value => String(value || 'ficha')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9_-]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 70) || 'ficha';

    const imageToDataUrl = async (url) => {
      if (!url) return null;
      try {
        const parsed = parseStorageUrl(url);
        let blob = null;

        if (parsed) {
          const { data, error } = await db.storage.from(parsed.bucket).download(parsed.path);
          if (!error && data) blob = data;
          else console.warn('Storage download falhou:', error?.message);
        }

        if (!blob) {
          const response = await fetch(String(url).replaceAll('&amp;', '&'), { mode: 'cors' });
          if (!response.ok) return null;
          blob = await response.blob();
        }

        return await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
      } catch (error) {
        console.warn('Não foi possível carregar imagem para PDF:', error);
        return null;
      }
    };

    const imageFormat = dataUrl => String(dataUrl || '').includes('image/jpeg') ? 'JPEG' : 'PNG';

    const addHeader = () => {
      doc.setFillColor(15, 118, 110);
      doc.rect(0, 0, pageW, 28, 'F');
      doc.setFillColor(29, 78, 216);
      doc.rect(0, 22, pageW, 6, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      doc.text('FICHA CADASTRAL COMPLETA', margin, 12);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.text('Igreja AD Bela-Vista · Rua Frei Lauro, 44 · Ponte do Imaruim · Palhoça - SC', margin, 19);
      doc.setTextColor(219, 234, 254);
      doc.text(`Gerado em ${new Date().toLocaleString('pt-BR')}`, pageW - margin, 12, { align: 'right' });
      doc.text(`Status: ${text(m.status, 'Ativo')}`, pageW - margin, 19, { align: 'right' });
      y = 38;
    };

    const addFooter = () => {
      const pages = doc.internal.getNumberOfPages();
      for (let i = 1; i <= pages; i++) {
        doc.setPage(i);
        doc.setDrawColor(226, 232, 240);
        doc.line(margin, pageH - 12, pageW - margin, pageH - 12);
        doc.setTextColor(100, 116, 139);
        doc.setFontSize(8);
        doc.text(`Ficha de ${text(m.nome)}`, margin, pageH - 7);
        doc.text(`Página ${i} de ${pages}`, pageW - margin, pageH - 7, { align: 'right' });
      }
    };

    const ensureSpace = (height) => {
      if (y + height <= pageH - 18) return;
      doc.addPage();
      addHeader();
    };

    const section = (title) => {
      ensureSpace(16);
      y += 2;
      doc.setFillColor(239, 246, 255);
      doc.setDrawColor(191, 219, 254);
      doc.roundedRect(margin, y, contentW, 9, 2, 2, 'FD');
      doc.setTextColor(29, 78, 216);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.text(title, margin + 3, y + 6);
      y += 14;
    };

    const addRows = (rows) => {
      const colGap = 8;
      const colW = (contentW - colGap) / 2;
      for (let i = 0; i < rows.length; i += 2) {
        const pair = [rows[i], rows[i + 1]].filter(Boolean);
        const prepared = pair.map(([label, value]) => {
          const lines = doc.splitTextToSize(text(value), colW - 4);
          return { label, lines };
        });
        const rowH = Math.max(10, ...prepared.map(item => 6 + item.lines.length * 4));
        ensureSpace(rowH + 2);
        prepared.forEach((item, index) => {
          const x = margin + index * (colW + colGap);
          doc.setTextColor(100, 116, 139);
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(7.5);
          doc.text(item.label.toUpperCase(), x, y);
          doc.setTextColor(15, 23, 42);
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(9);
          doc.text(item.lines, x, y + 4.5);
        });
        y += rowH;
      }
    };

    const addTextBlock = (title, value) => {
      if (!value) return;
      section(title);
      const lines = doc.splitTextToSize(text(value), contentW);
      ensureSpace(lines.length * 4 + 4);
      doc.setTextColor(15, 23, 42);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.text(lines, margin, y);
      y += lines.length * 4 + 3;
    };

    const addMemberSummary = (fotoData) => {
      ensureSpace(38);
      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(203, 213, 225);
      doc.roundedRect(margin, y, contentW, 34, 3, 3, 'FD');
      doc.setFillColor(29, 78, 216);
      doc.roundedRect(margin, y, 2.2, 34, 3, 3, 'F');

      if (fotoData) {
        try {
          doc.addImage(fotoData, imageFormat(fotoData), margin + 4, y + 4, 26, 26);
        } catch (error) {
          console.warn('Não foi possível inserir foto no PDF:', error);
        }
      } else {
        doc.setFillColor(239, 246, 255);
        doc.circle(margin + 17, y + 17, 13, 'F');
        doc.setTextColor(29, 78, 216);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.text('Sem foto', margin + 17, y + 18, { align: 'center' });
      }

      doc.setTextColor(15, 23, 42);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.text(doc.splitTextToSize(text(m.nome), contentW - 42), margin + 36, y + 11);
      doc.setTextColor(100, 116, 139);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.text(`${text(m.tipo_cadastro)} · ${text(m.status, 'Ativo')}`, margin + 36, y + 19);
      doc.text(`${m.tipo_cpf === 'estrangeiro' ? 'CRNM' : 'CPF'}: ${text(m.cpf)} · Celular: ${text(m.celular)}`, margin + 36, y + 26);
      y += 42;
    };

    addHeader();

    const fotoData = await imageToDataUrl(safeUrl(m.foto_url));
    addMemberSummary(fotoData);

    section('Identificação');
    addRows([
      ['Nome completo', m.nome],
      ['Tipo de cadastro', m.tipo_cadastro],
      [m.tipo_cpf === 'estrangeiro' ? 'CRNM' : 'CPF', m.cpf],
      ['RG', m.rg],
      ['Nascimento', date(m.data_nasc)],
      ['Idade', m.idade ? `${m.idade} anos` : '—'],
      ['Sexo', m.sexo],
      ['Tipo sanguíneo', m.tipo_sanguineo],
      ['Estado civil', m.estado_civil],
      ['Escolaridade', m.escolaridade],
      ['Cônjuge', m.conjuge_nome],
      ['Data casamento', date(m.data_casamento)]
    ]);

    section('Endereço e Contato');
    addRows([
      ['CEP', m.cep],
      ['Bairro', m.bairro],
      ['Endereço', m.endereco],
      ['Cidade / UF', m.cidade_estado],
      ['Fone residencial', m.fone_res],
      ['Fone comercial', m.fone_com],
      ['Celular / WhatsApp', m.celular],
      ['E-mail', m.email]
    ]);

    section('Dados Profissionais');
    addRows([
      ['Ocupação atual', m.ocupacao],
      ['Empresa / local de trabalho', m.empresa],
      ['Tem computador', m.tem_computador],
      ['Acesso à internet', m.tem_internet]
    ]);

    section('Dados da Igreja');
    addRows([
      ['Forma de recebimento', m.forma_recebimento],
      ['Setor', m.setor_igreja],
      ['Congregação', m.congregacao_igreja],
      ['Igreja anterior', m.igreja_anterior],
      ['Cidade da igreja anterior', m.igreja_cidade],
      ['Pastor anterior', m.igreja_pastor],
      ['Batismo nas águas', date(m.data_batismo_aguas)],
      ['Batismo no Espírito Santo', date(m.data_batismo_es)],
      ['Data de aprovação', date(m.data_aprovacao)],
      ['Cargo principal', m.cargo_principal],
      ['Outras funções', m.outras_funcoes]
    ]);

    section('Família');
    addRows([
      ['Quantidade de filhos', m.qtd_filhos ?? 0],
      ['Integrante 1', m.nome_dep1],
      ['Parentesco 1', m.parentesco_dep1],
      ['Integrante 2', m.nome_dep2],
      ['Parentesco 2', m.parentesco_dep2],
      ['Integrante 3', m.nome_dep3],
      ['Parentesco 3', m.parentesco_dep3]
    ]);

    addTextBlock('Talentos e Recursos', m.talentos);

    section('Documentos anexados');
    addRows([
      ['Foto do membro', m.foto_url ? 'Anexada' : 'Não anexada'],
      ['Documento', m.doc_url ? 'Anexado' : 'Não anexado'],
      ['Certidão de nascimento', m.foto_certidao_nasc ? 'Anexada' : 'Não anexada'],
      ['Certidão de casamento', m.foto_certidao_casamento ? 'Anexada' : 'Não anexada'],
      ['Diploma / certificado', m.foto_diploma ? 'Anexado' : 'Não anexado'],
      ['Comprovante de endereço', m.foto_comprovante_end ? 'Anexado' : 'Não anexado']
    ]);

    section('Declaração e Assinatura');
    const declaracao = 'Declaro que as informações fornecidas neste cadastro são verdadeiras e completas. Comprometo-me a comunicar qualquer alteração ao secretariado da igreja.';
    const declaracaoLines = doc.splitTextToSize(declaracao, contentW);
    ensureSpace(declaracaoLines.length * 4 + 50);
    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(declaracaoLines, margin, y);
    y += declaracaoLines.length * 4 + 8;

    // Buscar assinatura do membro
    const assinaturaMembroData = await imageToDataUrl(safeUrl(m.assinatura_url));
    
    // Buscar assinatura do pastor do banco de dados
    let pastorSignatureData = null;
    let pastorNome = 'Pastor responsável';
    let pastorCargo = 'Pastor responsável';
    try {
      const { data: pastorSig } = await db.rpc('get_pastor_signature');
      if (pastorSig) {
        pastorNome = pastorSig.pastor_name || 'Pastor responsável';
        pastorCargo = pastorSig.pastor_role || 'Pastor responsável';
        if (pastorSig.signature_url) {
          pastorSignatureData = await imageToDataUrl(pastorSig.signature_url);
        }
      }
    } catch (error) {
      console.warn('Não foi possível carregar assinatura do pastor:', error);
    }

    const assinaturaW = (contentW - 18) / 2;
    const membroX = margin;
    const pastorX = margin + assinaturaW + 18;
    
    // Adicionar assinatura do membro
    if (assinaturaMembroData) {
      try {
        doc.addImage(assinaturaMembroData, imageFormat(assinaturaMembroData), membroX, y, 74, 26);
      } catch (error) {
        console.warn('Não foi possível inserir assinatura do membro no PDF:', error);
      }
    }
    
    // Adicionar assinatura do pastor
    if (pastorSignatureData) {
      try {
        doc.addImage(pastorSignatureData, imageFormat(pastorSignatureData), pastorX, y, 74, 26);
      } catch (error) {
        console.warn('Não foi possível inserir assinatura do pastor no PDF:', error);
      }
    }
    
    y += 32;

    doc.setDrawColor(15, 23, 42);
    doc.line(membroX, y, membroX + assinaturaW, y);
    doc.line(pastorX, y, pastorX + assinaturaW, y);
    doc.setTextColor(100, 116, 139);
    doc.setFontSize(8);
    doc.text('Assinatura do membro', membroX, y + 5);
    doc.text(pastorNome, pastorX, y + 5);
    doc.text(pastorCargo, pastorX, y + 10);
    doc.text(`Data do cadastro: ${date(m.created_at ? String(m.created_at).slice(0, 10) : '')}`, pageW - margin, y + 16, { align: 'right' });

    addFooter();
    doc.save(`ficha_completa_${sanitizeFile(m.nome)}.pdf`);
    toast('Ficha completa em PDF gerada!');
  }

  async function imprimirFicha(id) {
    try {
      console.log('Gerando PDF completo para membro:', id);
      await gerarFichaPdf(id);
    } catch (error) {
      console.error('Erro ao gerar ficha PDF:', error);
      toast('Erro ao gerar PDF. Verifique o console para detalhes.');
    }
  }

  window.imprimirFicha = imprimirFicha;

  let pastorSignatureCanvas = null;
  let pastorSignatureCtx = null;
  let pastorSignatureDrawing = false;
  let pastorSignatureSigned = false;
  let pastorSignatureLastPoint = null;

  function garantirModalAssinaturaPastor() {
    if (document.getElementById('pastor-signature-overlay')) return;

    const overlay = document.createElement('div');
    overlay.className = 'overlay';
    overlay.id = 'pastor-signature-overlay';
    overlay.onclick = event => fecharOverlayClick(event, 'pastor-signature-overlay');
    overlay.innerHTML = `
      <div class="modal signature-pad-modal" onclick="event.stopPropagation()">
        <div class="modal-head">
          <div>
            <h2>Assinatura do pastor</h2>
            <p>Esta assinatura sera exibida nas fichas baixadas pelos membros.</p>
          </div>
          <button class="btn btn-ghost btn-sm" type="button" onclick="fecharAssinaturaPastor()" aria-label="Fechar">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>
        <div class="signature-pad-body">
          <div class="signature-pad-fields">
            <label>Nome exibido
              <input id="pastor-signature-name" type="text" placeholder="Nome do pastor">
            </label>
            <label>Cargo exibido
              <input id="pastor-signature-role" type="text" placeholder="Pastor responsável">
            </label>
          </div>
          <div class="signature-canvas-wrap">
            <canvas id="pastor-signature-canvas" width="900" height="260"></canvas>
          </div>
          <div class="signature-pad-actions">
            <button class="btn btn-ghost" type="button" onclick="limparAssinaturaPastor()">
              <i class="fa-solid fa-eraser"></i> Limpar
            </button>
            <button class="btn btn-gold" type="button" onclick="salvarAssinaturaPastor()">
              <i class="fa-solid fa-floppy-disk"></i> Salvar assinatura
            </button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    inicializarCanvasAssinaturaPastor();
  }

  function pontoAssinaturaPastor(event) {
    const rect = pastorSignatureCanvas.getBoundingClientRect();
    const pointer = event.touches?.[0] || event;
    return {
      x: (pointer.clientX - rect.left) * (pastorSignatureCanvas.width / rect.width),
      y: (pointer.clientY - rect.top) * (pastorSignatureCanvas.height / rect.height)
    };
  }

  function desenharAssinaturaPastor(event) {
    if (!pastorSignatureDrawing) return;
    event.preventDefault();
    const point = pontoAssinaturaPastor(event);
    pastorSignatureCtx.beginPath();
    pastorSignatureCtx.moveTo(pastorSignatureLastPoint.x, pastorSignatureLastPoint.y);
    pastorSignatureCtx.lineTo(point.x, point.y);
    pastorSignatureCtx.stroke();
    pastorSignatureLastPoint = point;
    pastorSignatureSigned = true;
  }

  function inicializarCanvasAssinaturaPastor() {
    pastorSignatureCanvas = document.getElementById('pastor-signature-canvas');
    pastorSignatureCtx = pastorSignatureCanvas.getContext('2d');
    pastorSignatureCtx.strokeStyle = '#1a1208';
    pastorSignatureCtx.lineWidth = 3;
    pastorSignatureCtx.lineCap = 'round';
    pastorSignatureCtx.lineJoin = 'round';

    const start = event => {
      event.preventDefault();
      pastorSignatureDrawing = true;
      pastorSignatureLastPoint = pontoAssinaturaPastor(event);
    };
    const stop = () => {
      pastorSignatureDrawing = false;
      pastorSignatureLastPoint = null;
    };

    pastorSignatureCanvas.addEventListener('mousedown', start);
    pastorSignatureCanvas.addEventListener('mousemove', desenharAssinaturaPastor);
    pastorSignatureCanvas.addEventListener('mouseup', stop);
    pastorSignatureCanvas.addEventListener('mouseleave', stop);
    pastorSignatureCanvas.addEventListener('touchstart', start, { passive: false });
    pastorSignatureCanvas.addEventListener('touchmove', desenharAssinaturaPastor, { passive: false });
    pastorSignatureCanvas.addEventListener('touchend', stop);
  }

  async function abrirAssinaturaPastor() {
    garantirModalAssinaturaPastor();
    limparAssinaturaPastor(false);

    const configAdmin = obterConfiguracoesAdmin();
    document.getElementById('pastor-signature-name').value = configAdmin.pastorName || '';
    document.getElementById('pastor-signature-role').value = configAdmin.pastorRole || 'Pastor responsável';

    try {
      const { data } = await db.rpc('get_pastor_signature');
      if (data?.pastor_name) document.getElementById('pastor-signature-name').value = data.pastor_name;
      if (data?.pastor_role) document.getElementById('pastor-signature-role').value = data.pastor_role;
      if (data?.signature_url) {
        const img = new Image();
        img.onload = () => {
          pastorSignatureCtx.drawImage(img, 0, 0, pastorSignatureCanvas.width, pastorSignatureCanvas.height);
          pastorSignatureSigned = true;
        };
        img.src = data.signature_url;
      }
    } catch (error) {
      console.warn('Nao foi possivel carregar assinatura do pastor:', error);
    }

    document.getElementById('pastor-signature-overlay').classList.add('open');
  }

  function fecharAssinaturaPastor() {
    document.getElementById('pastor-signature-overlay')?.classList.remove('open');
  }

  function limparAssinaturaPastor(showToast = true) {
    if (!pastorSignatureCtx || !pastorSignatureCanvas) return;
    pastorSignatureCtx.clearRect(0, 0, pastorSignatureCanvas.width, pastorSignatureCanvas.height);
    pastorSignatureSigned = false;
    if (showToast) toast('Assinatura limpa.');
  }

  async function salvarAssinaturaPastor() {
    if (!pastorSignatureSigned) {
      toast('Assine no quadro antes de salvar.');
      return;
    }

    const signatureUrl = pastorSignatureCanvas.toDataURL('image/png');
    const pastorName = document.getElementById('pastor-signature-name').value.trim() || 'Pastor responsável';
    const pastorRole = document.getElementById('pastor-signature-role').value.trim() || 'Pastor responsável';

    const { error } = await db.rpc('admin_save_pastor_signature', {
      p_signature_url: signatureUrl,
      p_pastor_name: pastorName,
      p_pastor_role: pastorRole
    });

    if (error) {
      toast(error.message || 'Nao foi possivel salvar a assinatura.');
      return;
    }

    const settings = obterConfiguracoesAdmin();
    localStorage.setItem('admin-page-settings', JSON.stringify({
      ...settings,
      pastorName,
      pastorRole
    }));
    fecharAssinaturaPastor();
    toast('Assinatura do pastor salva.');
  }

  window.abrirAssinaturaPastor = abrirAssinaturaPastor;
  window.fecharAssinaturaPastor = fecharAssinaturaPastor;
  window.limparAssinaturaPastor = limparAssinaturaPastor;
  window.salvarAssinaturaPastor = salvarAssinaturaPastor;

  document.addEventListener('DOMContentLoaded', async () => {
    prepararPainelPremium();
    const recoveryIncoming =
      new URLSearchParams(window.location.hash.slice(1)).get('type') === 'recovery' ||
      new URLSearchParams(window.location.search).get('type') === 'recovery';

    db.auth.onAuthStateChange((event, session) => {
      if (event !== 'PASSWORD_RECOVERY') return;
      recoverySessionReady = true;
      mostrarTela('tela-login');
      alternarRecuperacaoSenha(true);
      mostrarOpcoesAposCodigo();
      const email = document.getElementById('recovery-email');
      if (email && session?.user?.email) email.value = session.user.email;
      mostrarErroLogin('Link validado. Escolha trocar a senha ou entrar no painel.');
    });

    const { data: { session } } = await db.auth.getSession();

    if (recoveryIncoming) {
      recoverySessionReady = Boolean(session);
      mostrarTela('tela-login');
      alternarRecuperacaoSenha(true);
      if (session) mostrarOpcoesAposCodigo();
      else mostrarEtapaCodigoRecuperacao();
      if (session?.user?.email) document.getElementById('recovery-email').value = session.user.email;
      mostrarErroLogin(session ? 'Link validado. Escolha trocar a senha ou entrar no painel.' : 'Digite o codigo recebido para continuar.');
      return;
    }

    if (session) {
      await validarAcesso(session);
    } else {
      mostrarTela('tela-login');
    }
  });

})();



  // ══════════════════════════════════════════════════════════════
  // SISTEMA DE LINKS TEMPORÁRIOS DE CADASTRO
  // ══════════════════════════════════════════════════════════════

  let tokensAtivos = [];
  let updateTokensInterval = null;
  let tokensRequestInProgress = false;
  let filtroAtivo = 'todos'; // 'todos', 'ativos', 'usados', 'expirados'
  let tokensCache = null;
  let ultimaAtualizacao = 0;
  let tokensRpcUnavailable = false;
  const CACHE_TIMEOUT = 30000; // 30 segundos
  const tokensSetupMessage = 'Execute docs/sql/ALINHAR_RPC_TOKENS_SUPABASE.sql no SQL Editor do Supabase.';

  function erroTokenParaUsuario(error) {
    if (error?.code === 'PGRST202') {
      return `As funções de links não estão instaladas neste Supabase. ${tokensSetupMessage}`;
    }
    return error?.message || 'Tente novamente.';
  }

  function abrirGeradorLinks() {
    document.getElementById('links-overlay').classList.add('open');
    carregarTokens();
  }

  window.abrirGeradorLinks = abrirGeradorLinks;

  function fecharGeradorLinks() {
    document.getElementById('links-overlay').classList.remove('open');
  }

  window.fecharGeradorLinks = fecharGeradorLinks;

  async function gerarNovoLink() {
    const observacao = document.getElementById('link-observacao').value.trim();
    
    try {
      const { data, error } = await db.rpc('generate_registration_token', {
        p_duration_hours: 2,
        p_notes: observacao || null
      });

      if (error) throw error;

      const token = data?.[0];
      if (!token) throw new Error('Token não retornado');

      // Usa a URL retornada pela função ou monta manualmente
      const linkCompleto = token.registration_url || `${window.location.origin}/pages/cadastro.html?token=${token.token}`;

      // Copia para clipboard
      await navigator.clipboard.writeText(linkCompleto);

      toast('✅ Link gerado e copiado!');
      document.getElementById('link-observacao').value = '';
      
      // Recarrega lista forçando reload (invalida cache)
      await carregarTokens(true);

    } catch (error) {
      console.error('Erro ao gerar link:', error);
      toast('❌ Erro ao gerar link: ' + erroTokenParaUsuario(error));
    }
  }

  window.gerarNovoLink = gerarNovoLink;

  async function carregarTokens(forcarReload = false) {
    const container = document.getElementById('links-ativos-lista');

    if (tokensRequestInProgress) return;

    if (tokensRpcUnavailable && !forcarReload) {
      mostrarErroConfiguracaoTokens();
      return;
    }

    if (forcarReload) tokensRpcUnavailable = false;
    tokensRequestInProgress = true;

    try {
      // Usar cache se disponível e não expirado
      const agora = Date.now();
      if (!forcarReload && tokensCache && (agora - ultimaAtualizacao < CACHE_TIMEOUT)) {
        tokensAtivos = tokensCache;
        renderTokens();
        renderStatsTokens();
        return;
      }

      if (container) {
        container.innerHTML = '<div class="token-state" role="status">Carregando links...</div>';
      }

      const { data, error } = await db.rpc('list_active_tokens');

      if (error) throw error;

      tokensAtivos = data || [];
      tokensCache = tokensAtivos;
      ultimaAtualizacao = agora;

      renderTokens();
      renderStatsTokens();

    } catch (error) {
      if (error?.code === 'PGRST202' || /could not find the function public\.list_active_tokens/i.test(error?.message || '')) {
        tokensRpcUnavailable = true;
        console.warn('RPC list_active_tokens não encontrada. Execute docs/sql/ALINHAR_RPC_TOKENS_SUPABASE.sql no Supabase.');
        mostrarErroConfiguracaoTokens();
        return;
      }

      // Erros de rede não devem gerar notificações repetidas dentro do modal.
      if (error?.message?.includes('Failed to fetch')) {
        console.warn('Sem conexão com o servidor de tokens.');
        // Preserva os dados antigos, mas informa que a lista pode estar desatualizada.
        if (tokensCache !== null) {
          tokensAtivos = tokensCache;
          renderTokens();
          renderStatsTokens();
          container?.insertAdjacentHTML('afterbegin',
            '<div class="token-state" role="status">Sem conexão. Exibindo os últimos dados carregados.</div>');
        } else if (container) {
          container.innerHTML = '<div class="token-state token-state-error" role="alert">Sem conexão com o servidor. Verifique sua internet e tente novamente.</div>';
        }
        return;
      }
      
      console.error('Erro ao carregar tokens:', error);
      if (container) {
        container.innerHTML = '<div class="token-state token-state-error" role="alert">Não foi possível carregar os links. Verifique sua sessão e as permissões do usuário.</div>';
      }
    } finally {
      tokensRequestInProgress = false;
    }
  }

  function mostrarErroConfiguracaoTokens() {
    const container = document.getElementById('links-ativos-lista');
    if (!container) return;

    container.innerHTML = `
      <div class="token-state token-state-error" role="alert">
        <strong>Os recursos de links ainda não foram instalados neste Supabase.</strong>
        <span>Abra o SQL Editor do projeto e execute <code>docs/sql/ALINHAR_RPC_TOKENS_SUPABASE.sql</code>.</span>
        <button type="button" class="btn btn-ghost btn-sm" onclick="window.carregarTokens(true)">Verificar novamente</button>
      </div>`;
  }

  window.carregarTokens = carregarTokens;

  function renderTokens() {
    const container = document.getElementById('links-ativos-lista');
    
    // Define filtro padrão se não existir
    if (typeof filtroAtivo === 'undefined') {
      filtroAtivo = 'todos';
    }
    
    // Filtrar com base no filtro ativo
    let tokensFiltrados;
    if (filtroAtivo === 'ativos') {
      tokensFiltrados = tokensAtivos.filter(t => !t.used && !t.revoked && !t.expired);
    } else if (filtroAtivo === 'usados') {
      tokensFiltrados = tokensAtivos.filter(t => t.used);
    } else if (filtroAtivo === 'expirados') {
      tokensFiltrados = tokensAtivos.filter(t => t.expired && !t.used);
    } else {
      tokensFiltrados = tokensAtivos;
    }

    if (tokensFiltrados.length === 0) {
      const mensagens = {
        ativos: 'Nenhum link ativo no momento.',
        usados: 'Nenhum link foi usado ainda.',
        expirados: 'Nenhum link expirado.',
        todos: 'Nenhum token encontrado.'
      };
      container.innerHTML = `<div style="color:var(--muted);text-align:center;padding:1rem;">${mensagens[filtroAtivo]}</div>`;
      return;
    }

    // Função helper para escapar HTML localmente
    const escapeHtml = (str) => {
      const div = document.createElement('div');
      div.textContent = str || '';
      return div.innerHTML;
    };

    container.innerHTML = tokensFiltrados.map(token => {
      const baseUrl = window.location.origin;
      const linkCompleto = `${baseUrl}/pages/cadastro.html?token=${token.token}`;
      const segundosRestantes = token.time_remaining_seconds || 0;
      
      // Escapar valores antes de usar no HTML
      const tokenString = escapeHtml(String(token.token || ''));
      const tokenPreview = escapeHtml(String(token.token || '').substring(0, 8));
      const obs = escapeHtml(token.observacao || '');
      const linkEscapado = escapeHtml(linkCompleto);
      
      return `
        <div class="token-card" data-token="${tokenString}">
          <div class="token-card-header">
            <div class="token-card-info">
              <div class="token-id">🎫 Token: ${tokenPreview}...</div>
              ${obs ? `<div class="token-obs">${obs}</div>` : ''}
              <div class="token-countdown" data-seconds="${segundosRestantes}">
                <i class="fa-solid fa-clock"></i> Expira em: <span class="countdown-time">${formatarTempo(segundosRestantes)}</span>
              </div>
            </div>
            <button type="button" class="btn-revoke" onclick="window.revogarTokenByString('${tokenString}')" title="Revogar link">
              <i class="fa-solid fa-ban"></i>
            </button>
          </div>
          <div class="token-card-actions">
            <input type="text" readonly value="${linkEscapado}" class="token-link-input">
            <button type="button" class="btn-copy" onclick="window.copiarLinkToken('${linkEscapado}')" title="Copiar link">
              <i class="fa-solid fa-copy"></i>
            </button>
          </div>
        </div>
      `;
    }).join('');
  }

  function formatarTempo(segundos) {
    if (segundos <= 0) return '00:00:00';
    
    const h = Math.floor(segundos / 3600);
    const m = Math.floor((segundos % 3600) / 60);
    const s = segundos % 60;
    
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  function atualizarCountdownTokens() {
    document.querySelectorAll('.token-countdown').forEach(el => {
      let segundos = parseInt(el.dataset.seconds);
      
      if (segundos > 0) {
        segundos--;
        el.dataset.seconds = segundos;
        const timeEl = el.querySelector('.countdown-time');
        if (timeEl) {
          timeEl.textContent = formatarTempo(segundos);
        }

        // Muda cor quando < 10 minutos
        if (segundos < 600) {
          el.style.color = '#dc2626';
        }
      } else if (el.dataset.reloadRequested !== 'true') {
        // Expirou - recarrega lista (forçando reload)
        el.dataset.reloadRequested = 'true';
        carregarTokens(true);
      }
    });
  }

  function renderStatsTokens() {
    const ativos = tokensAtivos.filter(t => !t.used && !t.revoked && !t.expired).length;
    const usados = tokensAtivos.filter(t => t.used).length;
    const expirados = tokensAtivos.filter(t => t.expired && !t.used).length;

    const statAtivosEl = document.getElementById('stat-links-ativos');
    const statUsadosEl = document.getElementById('stat-links-usados');
    const statExpiradosEl = document.getElementById('stat-links-expirados');

    if (statAtivosEl) statAtivosEl.textContent = ativos;
    if (statUsadosEl) statUsadosEl.textContent = usados;
    if (statExpiradosEl) statExpiradosEl.textContent = expirados;

    // Adiciona classes active aos cards clicados
    document.querySelectorAll('.stat-card-tokens').forEach(card => {
      card.classList.remove('active');
    });
    const ativoCard = document.querySelector(`[data-filtro="${filtroAtivo}"]`);
    if (ativoCard) ativoCard.classList.add('active');
  }

  function filtrarTokens(tipo) {
    filtroAtivo = tipo;
    renderTokens();
    renderStatsTokens();
  }

  window.filtrarTokens = filtrarTokens;

  async function copiarLink(link) {
    try {
      await navigator.clipboard.writeText(link);
      toast('✅ Link copiado!');
    } catch (error) {
      console.error('Erro ao copiar:', error);
      toast('❌ Erro ao copiar link');
    }
  }

  window.copiarLink = copiarLink;
  window.copiarLinkToken = copiarLink; // Alias para o onclick inline

  async function revogarToken(tokenString) {
    if (!confirm('Deseja mesmo revogar este link? Ele não poderá mais ser usado.')) return;

    try {
      const token = tokensAtivos.find(item => item.token === tokenString);
      if (!token) throw new Error('O link não está mais na lista. Atualize e tente novamente.');

      const { data, error } = await db.rpc('revoke_registration_token', {
        p_token_id: token.id
      });

      if (error) throw error;
      if (!data) throw new Error('O link já foi usado, expirou ou não pode ser revogado.');

      toast('✅ Link revogado');
      
      // Invalida cache e recarrega
      await carregarTokens(true);

    } catch (error) {
      console.error('Erro ao revogar:', error);
      toast('❌ Erro ao revogar: ' + erroTokenParaUsuario(error));
    }
  }

  window.revogarToken = revogarToken;
  window.revogarTokenById = revogarToken; // Alias antigo (compatibilidade)
  window.revogarTokenByString = revogarToken; // Alias correto

  // ══════════════════════════════════════════════════════════════
  // FIM DO SISTEMA DE LINKS TEMPORÁRIOS
  // ══════════════════════════════════════════════════════════════

  // Inicia o contador de tokens (sempre ativo em background)
  updateTokensInterval = setInterval(() => {
    atualizarCountdownTokens();
  }, 1000);
