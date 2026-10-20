(function () {
  const SUPABASE_URL = window.CONFIG?.SUPABASE_URL;
  const SUPABASE_KEY = window.CONFIG?.SUPABASE_KEY;
  const ADMIN_ROLES = ['admin', 'pastor', 'secretario'];
  const page = document.body.dataset.page;
  const state = {
    db: null,
    membros: [],
    users: [],
    chart: null
  };

  function $(id) {
    return document.getElementById(id);
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[char]));
  }

  function safeText(value, fallback = '-') {
    const text = value === null || value === undefined || value === '' ? fallback : value;
    return escapeHtml(text);
  }

  function toast(msg) {
    const el = $('toast');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('show');
    setTimeout(() => el.classList.remove('show'), 2800);
  }

  function setText(id, value) {
    const el = $(id);
    if (el) el.textContent = value;
  }

  function fmt(v) {
    return v || '-';
  }

  function fmtDate(v) {
    return v ? v.split('-').reverse().join('/') : '-';
  }

  function fmtDateTime(v) {
    if (!v) return '-';
    const date = new Date(v);
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
  }

  function getCounts() {
    const now = new Date();
    const membros = state.membros.filter(m => m.tipo_cadastro === 'Membro');
    const congregados = state.membros.filter(m => m.tipo_cadastro === 'Congregado');
    const ativos = state.membros.filter(m => !m.status || m.status === 'Ativo');
    const mes = state.membros.filter(m => {
      if (!m.created_at) return false;
      const d = new Date(m.created_at);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });
    const aniversariantes = state.membros.filter(m => {
      if (!m.data_nasc || (m.status && m.status !== 'Ativo')) return false;
      return new Date(m.data_nasc).getMonth() === now.getMonth();
    });
    return { total: state.membros.length, membros: membros.length, congregados: congregados.length, ativos: ativos.length, mes: mes.length, aniversariantes: aniversariantes.length };
  }

  function setStats() {
    const c = getCounts();
    Object.entries(c).forEach(([key, value]) => setText(`stat-${key}`, value));
  }

  function rowsForReport(limit = 8) {
    return state.membros.slice(0, limit).map(m => `
      <tr>
        <td>${safeText(m.nome)}</td>
        <td>${safeText(m.cpf)}</td>
        <td>${safeText(m.tipo_cadastro)}</td>
        <td>${safeText(m.status || 'Ativo')}</td>
        <td>${safeText(m.celular)}</td>
        <td>${safeText(m.setor_igreja)}</td>
      </tr>
    `).join('');
  }

  function exportarExcel() {
    if (!state.membros.length) { toast('Nenhum cadastro para exportar.'); return; }
    const dados = state.membros.map((m, idx) => ({
      '#': idx + 1,
      'Nome Completo': m.nome,
      'Tipo': m.tipo_cadastro,
      'Status': m.status || 'Ativo',
      'CPF/CRNM': m.cpf || '-',
      'RG': m.rg || '-',
      'Nascimento': fmtDate(m.data_nasc),
      'Idade': m.idade || '-',
      'Celular': m.celular || '-',
      'E-mail': m.email || '-',
      'Setor': m.setor_igreja || '-',
      'Congregação': m.congregacao_igreja || '-',
      'Cargo': m.cargo_principal || '-'
    }));
    const ws = XLSX.utils.json_to_sheet(dados);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Membros');
    XLSX.writeFile(wb, 'relatorio-membros-ad-bela-vista.xlsx');
    toast('Excel gerado com sucesso.');
  }

  function exportarPDF() {
    if (!state.membros.length) { toast('Nenhum cadastro para exportar.'); return; }
    const { jsPDF } = window.jspdf || {};
    if (!jsPDF) { toast('Biblioteca PDF indisponível.'); return; }
    const doc = new jsPDF('landscape');
    const c = getCounts();
    doc.setFontSize(16);
    doc.text('Relatório Geral de Membros - AD Bela-Vista', 14, 16);
    doc.setFontSize(9);
    doc.text(`Total: ${c.total} | Membros: ${c.membros} | Congregados: ${c.congregados} | Ativos: ${c.ativos}`, 14, 24);
    doc.autoTable({
      startY: 32,
      head: [['#', 'Nome', 'Tipo', 'Status', 'CPF/CRNM', 'Celular', 'Setor', 'Cargo']],
      body: state.membros.map((m, idx) => [idx + 1, fmt(m.nome), fmt(m.tipo_cadastro), fmt(m.status || 'Ativo'), fmt(m.cpf), fmt(m.celular), fmt(m.setor_igreja), fmt(m.cargo_principal)]),
      styles: { fontSize: 8 }
    });
    doc.save('relatorio-membros-ad-bela-vista.pdf');
    toast('PDF gerado com sucesso.');
  }

  function exportarGraficoPNG() {
    if (!state.chart) { toast('Escolha um indicador gráfico primeiro.'); return; }
    const a = document.createElement('a');
    a.href = state.chart.toBase64Image();
    a.download = 'indicador-ad-bela-vista.png';
    a.click();
  }

  function getIndicatorData(metric) {
    const c = getCounts();
    const now = new Date();
    if (metric === 'tipo') {
      return {
        title: 'Membros e Congregados',
        labels: ['Membros', 'Congregados'],
        values: [c.membros, c.congregados]
      };
    }
    if (metric === 'status') {
      const labels = ['Ativo', 'Inativo', 'Transferido', 'Falecido'];
      return {
        title: 'Status dos Cadastros',
        labels,
        values: labels.map(status => state.membros.filter(m => (m.status || 'Ativo') === status).length)
      };
    }
    if (metric === 'setor') {
      const map = {};
      state.membros.forEach(m => {
        const key = m.setor_igreja || 'Sem setor';
        map[key] = (map[key] || 0) + 1;
      });
      const sorted = Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 8);
      return {
        title: 'Membros por Setor',
        labels: sorted.map(x => x[0]),
        values: sorted.map(x => x[1])
      };
    }
    const labels = [];
    const values = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      labels.push(d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', ''));
      values.push(state.membros.filter(m => {
        if (!m.created_at) return false;
        const cd = new Date(m.created_at);
        return cd.getMonth() === d.getMonth() && cd.getFullYear() === d.getFullYear();
      }).length);
    }
    return { title: 'Crescimento Mensal', labels, values };
  }

  function renderIndicator() {
    const canvas = $('indicator-chart');
    if (!canvas || !window.Chart) return;
    const metric = $('indicator-metric')?.value || 'crescimento';
    const typeValue = $('indicator-type')?.value || 'bar';
    const data = getIndicatorData(metric);
    const chartType = typeValue === 'donut' ? 'doughnut' : typeValue;
    const isRound = chartType === 'pie' || chartType === 'doughnut';
    if (state.chart) state.chart.destroy();
    state.chart = new Chart(canvas.getContext('2d'), {
      type: chartType,
      data: {
        labels: data.labels,
        datasets: [{
          label: data.title,
          data: data.values,
          borderColor: '#2563eb',
          backgroundColor: isRound ? ['#2563eb', '#0f766e', '#d97706', '#ef4444', '#8b5cf6', '#06b6d4', '#16a34a', '#f97316'] : 'rgba(37, 99, 235, 0.72)',
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
          legend: { display: isRound, position: 'bottom' }
        },
        scales: isRound ? {} : {
          y: { beginAtZero: true, ticks: { stepSize: 1 } },
          x: { grid: { display: false } }
        }
      }
    });
    setText('indicator-title', data.title);
    const list = $('indicator-summary');
    if (list) {
      list.innerHTML = data.labels.map((label, idx) => `<li><span>${safeText(label)}</span><strong>${safeText(data.values[idx])}</strong></li>`).join('');
    }
  }

  function renderReportsPage() {
    setStats();
    const tbody = $('report-preview');
    if (tbody) tbody.innerHTML = rowsForReport(10) || '<tr><td colspan="6" class="empty">Nenhum cadastro encontrado.</td></tr>';
  }

  function renderIndicatorsPage() {
    setStats();
    renderIndicator();
  }

  function loadSettings() {
    const saved = JSON.parse(localStorage.getItem('admin-page-settings') || '{}');
    document.querySelectorAll('[data-setting]').forEach(input => {
      const key = input.dataset.setting;
      if (input.type === 'checkbox') input.checked = saved[key] !== false;
      else if (saved[key]) input.value = saved[key];
    });
  }

  function saveSettings() {
    const data = {};
    document.querySelectorAll('[data-setting]').forEach(input => {
      data[input.dataset.setting] = input.type === 'checkbox' ? input.checked : input.value;
    });
    localStorage.setItem('admin-page-settings', JSON.stringify(data));
    toast('Configurações salvas.');
  }

  function renderSettingsPage() {
    loadSettings();
  }

  function roleLabel(role) {
    const labels = {
      admin: 'Administrador',
      pastor: 'Pastor',
      secretario: 'Secretário',
      'sem perfil': 'Sem perfil'
    };
    return labels[role] || role || 'Sem perfil';
  }

  function roleClass(role) {
    return String(role || 'sem-perfil').replace(/\s+/g, '-').replace(/[^a-z0-9-]/gi, '').toLowerCase();
  }

  function renderUsersPage() {
    const users = state.users || [];
    setText('user-stat-total', users.length);
    setText('user-stat-admin', users.filter(user => user.role === 'admin').length);
    setText('user-stat-pastor', users.filter(user => user.role === 'pastor').length);
    setText('user-stat-secretario', users.filter(user => user.role === 'secretario').length);

    const tbody = $('admin-users-body');
    if (!tbody) return;
    tbody.innerHTML = users.map(user => `
      <tr>
        <td>${safeText(user.email)}</td>
        <td><span class="role-pill role-${roleClass(user.role)}">${safeText(roleLabel(user.role))}</span></td>
        <td>${safeText(fmtDateTime(user.created_at))}</td>
        <td>${safeText(fmtDateTime(user.last_sign_in_at))}</td>
      </tr>
    `).join('') || '<tr><td colspan="4" class="empty">Nenhum usuário administrativo encontrado.</td></tr>';
  }

  async function loadUsers() {
    const { data, error } = await state.db.rpc('admin_list_auth_users');
    if (error) {
      toast(`Erro ao carregar usuários: ${error.message}`);
      return;
    }
    state.users = data || [];
    renderUsersPage();
  }

  async function saveAdminUser(event) {
    event?.preventDefault();

    const email = $('admin-user-email')?.value?.trim();
    const password = $('admin-user-password')?.value || '';
    const role = $('admin-user-role')?.value || 'secretario';
    const button = $('admin-user-save');

    if (!email) {
      toast('Informe o e-mail do usuário.');
      return;
    }

    if (password && password.length < 8) {
      toast('A senha inicial precisa ter pelo menos 8 caracteres.');
      return;
    }

    const original = button?.innerHTML;
    if (button) {
      button.disabled = true;
      button.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Salvando...';
    }

    try {
      if (password) {
        // Cria cliente temporário apenas para signup (sem persistir sessão)
        const { createClient } = window.supabase;
        const signupClient = createClient(SUPABASE_URL, SUPABASE_KEY, {
          auth: {
            persistSession: false,
            autoRefreshToken: false,
            detectSessionInUrl: false,
            storage: {
              getItem: () => null,
              setItem: () => {},
              removeItem: () => {}
            }
          }
        });
        const { error: signupError } = await signupClient.auth.signUp({
          email,
          password,
          options: {
            data: { requested_role: role },
            emailRedirectTo: `${window.location.origin}${window.location.pathname.replace(/\/[^/]*$/, '/admin.html')}`
          }
        });
        if (signupError && !String(signupError.message || '').toLowerCase().includes('already')) {
          throw signupError;
        }
      }

      const { error } = await state.db.rpc('admin_upsert_user_role', {
        p_email: email,
        p_role: role
      });
      if (error) throw error;

      $('admin-user-form')?.reset();
      if ($('admin-user-role')) $('admin-user-role').value = 'secretario';
      toast('Usuário salvo com sucesso.');
      await loadUsers();
    } catch (error) {
      toast(`Erro ao salvar usuário: ${error.message || 'tente novamente.'}`);
    } finally {
      if (button) {
        button.disabled = false;
        button.innerHTML = original;
      }
    }
  }

  async function loadData() {
    if (page === 'usuarios') {
      await loadUsers();
      return;
    }

    if (page === 'configuracoes') {
      renderSettingsPage();
      return;
    }

    const { data, error } = await state.db.from('membros').select('*').order('nome');
    if (error) {
      console.error('Erro ao carregar membros da página administrativa:', error);
      const message = error.code === '42501'
        ? 'Sem permissão para ler membros. Execute docs/sql/CORRIGIR_401_MEMBROS_ADMIN.sql no SQL Editor do Supabase.'
        : `Não foi possível carregar os membros (${error.code || 'erro'}): ${error.message || 'verifique a conexão e as permissões do Supabase.'}`;
      state.membros = [];
      if (state.chart) {
        state.chart.destroy();
        state.chart = null;
      }
      ['total', 'membros', 'congregados', 'ativos', 'mes', 'aniversariantes'].forEach(key => setText(`stat-${key}`, '—'));
      toast(message);
      if (page === 'relatorios') {
        const tbody = $('report-preview');
        if (tbody) tbody.innerHTML = `<tr><td colspan="6" class="load-error">${safeText(message)}</td></tr>`;
      }
      if (page === 'indicadores') {
        setText('indicator-title', 'Dados indisponíveis');
        const summary = $('indicator-summary');
        if (summary) summary.innerHTML = `<li class="load-error">${safeText(message)}</li>`;
      }
      return;
    }
    state.membros = data || [];
    if (page === 'relatorios') renderReportsPage();
    if (page === 'indicadores') renderIndicatorsPage();
  }

  async function validateAccess() {
    if (!SUPABASE_URL || !SUPABASE_KEY || !window._supabaseClientInstance) return false;
    state.db = window._supabaseClientInstance;
    const { data: { session } } = await state.db.auth.getSession();
    if (!session?.user?.id) {
      window.location.href = 'admin.html';
      return false;
    }
    setText('header-email', session.user.email || '');
    const { data, error } = await state.db.from('profiles').select('role').eq('id', session.user.id).maybeSingle();
    if (error || !data || !ADMIN_ROLES.includes(data.role)) {
      await state.db.auth.signOut();
      window.location.href = 'admin.html';
      return false;
    }
    return true;
  }

  async function init() {
    if (!(await validateAccess())) return;
    await loadData();
    $('refresh-btn')?.addEventListener('click', () => {
      if (page === 'configuracoes') renderSettingsPage();
      else loadData();
    });
    $('logout-btn')?.addEventListener('click', async () => {
      await state.db.auth.signOut();
      window.location.href = 'admin.html';
    });
    $('export-pdf-btn')?.addEventListener('click', exportarPDF);
    $('export-excel-btn')?.addEventListener('click', exportarExcel);
    $('export-png-btn')?.addEventListener('click', exportarGraficoPNG);
    $('indicator-metric')?.addEventListener('change', renderIndicator);
    $('indicator-type')?.addEventListener('change', renderIndicator);
    $('save-settings-btn')?.addEventListener('click', saveSettings);
    $('admin-user-form')?.addEventListener('submit', saveAdminUser);
    $('users-refresh-btn')?.addEventListener('click', loadUsers);
    $('reset-settings-btn')?.addEventListener('click', () => {
      localStorage.removeItem('admin-page-settings');
      loadSettings();
      toast('Configurações restauradas.');
    });
  }

  document.addEventListener('DOMContentLoaded', init);
})();
