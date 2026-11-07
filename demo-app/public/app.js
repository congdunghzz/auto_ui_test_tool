// Client-side logic for QA Demo Shop. Plain JS, no build step.
(function () {
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const money = (n) => Number(n).toLocaleString('vi-VN') + 'đ';
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const STATUS = { active: 'Hoạt động', inactive: 'Ngừng hoạt động' };
  const ORDER_STATUS = { pending: 'Chờ xử lý', completed: 'Hoàn thành', cancelled: 'Đã hủy' };

  // Simulated network latency so tests must rely on proper auto-waiting.
  async function api(method, url, body) {
    await sleep(80 + Math.random() * 170);
    const res = await fetch(url, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : {},
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    return { status: res.status, ok: res.ok, data };
  }

  let toastTimer;
  function toast(message) {
    const el = $('#toast');
    el.textContent = message;
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (el.hidden = true), 4000);
  }
  const flash = (msg) => sessionStorage.setItem('flash', msg);
  const pendingFlash = sessionStorage.getItem('flash');
  if (pendingFlash) { sessionStorage.removeItem('flash'); setTimeout(() => toast(pendingFlash), 0); }

  function showErrors(prefix, errors) {
    $$(`[id^="${prefix}"][id$="-error"]`).forEach((el) => (el.textContent = ''));
    for (const [field, msg] of Object.entries(errors || {})) {
      const key = { customerId: 'customer' }[field] || field;
      const el = document.getElementById(`${prefix}${key}-error`);
      if (el) el.textContent = msg;
    }
  }

  const logout = $('#logout-btn');
  if (logout) logout.addEventListener('click', async () => {
    await api('POST', '/api/logout');
    location.href = '/login';
  });

  const page = document.body.dataset.page;

  // ------------------------------------------------------------ login
  if (page === 'login') {
    $('#login-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const username = $('#username').value.trim();
      const password = $('#password').value;
      const errors = {};
      if (!username) errors.username = 'Vui lòng nhập tên đăng nhập';
      if (!password) errors.password = 'Vui lòng nhập mật khẩu';
      showErrors('', errors);
      $('#login-error').hidden = true;
      if (Object.keys(errors).length) return;
      const res = await api('POST', '/api/login', { username, password, remember: $('#remember').checked });
      if (!res.ok) {
        $('#login-error').textContent = res.data.error || 'Đăng nhập thất bại';
        $('#login-error').hidden = false;
        return;
      }
      const next = new URLSearchParams(location.search).get('next');
      location.href = next && next.startsWith('/') ? next : '/dashboard';
    });
  }

  // ------------------------------------------------------------ dashboard
  if (page === 'dashboard') {
    api('GET', '/api/stats').then(({ data }) => {
      $('[data-testid="stat-customers"]').textContent = data.customers;
      $('[data-testid="stat-pending-orders"]').textContent = data.pendingOrders;
      $('[data-testid="stat-revenue"]').textContent = money(data.revenue);
    });
  }

  // ------------------------------------------------------------ customers
  if (page === 'customers') {
    const state = { q: '', status: 'all', page: 1, pages: 1, editing: null, deleting: null };
    const tbody = $('#customer-rows');

    async function load() {
      const params = new URLSearchParams({ q: state.q, status: state.status, page: state.page, pageSize: 5 });
      const { data } = await api('GET', '/api/customers?' + params);
      state.pages = data.pages;
      state.page = data.page;
      tbody.innerHTML = data.items.map((c) => `
        <tr data-id="${c.id}">
          <td>${esc(c.name)}</td><td>${esc(c.email)}</td><td>${esc(c.phone || '')}</td>
          <td>${STATUS[c.status]}</td><td>${c.vip ? 'Có' : 'Không'}</td>
          <td><button type="button" class="btn btn-sm" data-action="edit">Sửa</button>
              <button type="button" class="btn btn-sm btn-danger" data-action="delete">Xóa</button></td>
        </tr>`).join('');
      tbody._items = data.items;
      $('#empty-state').hidden = data.items.length > 0;
      $('#page-info').textContent = `Trang ${data.page} / ${data.pages}`;
      $('#prev-page').disabled = data.page <= 1;
      $('#next-page').disabled = data.page >= data.pages;
    }

    let debounce;
    $('#search').addEventListener('input', (e) => {
      clearTimeout(debounce);
      debounce = setTimeout(() => { state.q = e.target.value; state.page = 1; load(); }, 300);
    });
    $('#status-filter').addEventListener('change', (e) => { state.status = e.target.value; state.page = 1; load(); });
    $('#prev-page').addEventListener('click', () => { if (state.page > 1) { state.page--; load(); } });
    $('#next-page').addEventListener('click', () => { if (state.page < state.pages) { state.page++; load(); } });

    const modal = $('#customer-modal-backdrop');
    const form = $('#customer-form');
    function openModal(customer) {
      state.editing = customer || null;
      form.reset();
      showErrors('c-', {});
      $('#customer-modal-title').textContent = customer ? 'Cập nhật khách hàng' : 'Thêm khách hàng';
      if (customer) {
        form.name.value = customer.name;
        form.email.value = customer.email;
        form.phone.value = customer.phone || '';
        form.status.value = customer.status;
        form.querySelector(`input[name="gender"][value="${customer.gender}"]`).checked = true;
        form.vip.checked = customer.vip;
        form.note.value = customer.note || '';
      }
      modal.hidden = false;
      form.name.focus();
    }
    const closeModal = () => { modal.hidden = true; };
    $('[data-testid="btn-add-customer"]').addEventListener('click', () => openModal());
    $('#customer-cancel').addEventListener('click', closeModal);
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { closeModal(); closeConfirm(); } });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const body = {
        name: form.name.value, email: form.email.value, phone: form.phone.value,
        status: form.status.value, gender: form.querySelector('input[name="gender"]:checked').value,
        vip: form.vip.checked, note: form.note.value,
      };
      const res = state.editing
        ? await api('PUT', `/api/customers/${state.editing.id}`, body)
        : await api('POST', '/api/customers', body);
      if (res.status === 422) return showErrors('c-', res.data.errors);
      closeModal();
      toast(state.editing ? 'Đã cập nhật khách hàng thành công' : 'Đã thêm khách hàng thành công');
      load();
    });

    const confirmBox = $('#confirm-backdrop');
    const closeConfirm = () => { confirmBox.hidden = true; };
    $('#confirm-cancel').addEventListener('click', closeConfirm);
    $('#confirm-ok').addEventListener('click', async () => {
      const c = state.deleting;
      await api('DELETE', `/api/customers/${c.id}`);
      closeConfirm();
      toast(`Đã xóa khách hàng ${c.name}`);
      load();
    });

    tbody.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-action]');
      if (!btn) return;
      const id = Number(btn.closest('tr').dataset.id);
      const customer = tbody._items.find((c) => c.id === id);
      if (btn.dataset.action === 'edit') openModal(customer);
      if (btn.dataset.action === 'delete') {
        state.deleting = customer;
        $('#confirm-message').textContent = `Bạn có chắc muốn xóa khách hàng ${customer.name}?`;
        confirmBox.hidden = false;
      }
    });
    load();
  }

  // ------------------------------------------------------------ orders
  if (page === 'orders') {
    const tbody = $('#order-rows');
    async function load(status) {
      const { data } = await api('GET', '/api/orders?status=' + status);
      tbody.innerHTML = data.length
        ? data.map((o) => `
          <tr><td><a href="/orders/${o.id}">${o.code}</a></td><td>${esc(o.customerName)}</td><td>${esc(o.productName)}</td>
          <td>${o.quantity}</td><td>${o.payment === 'cash' ? 'Tiền mặt' : 'Chuyển khoản'}</td>
          <td>${ORDER_STATUS[o.status]}</td><td>${money(o.total)}</td></tr>`).join('')
        : '<tr><td colspan="7">Không có đơn hàng</td></tr>';
    }
    $$('[role="tab"]').forEach((tab) => tab.addEventListener('click', () => {
      $$('[role="tab"]').forEach((t) => t.setAttribute('aria-selected', String(t === tab)));
      load(tab.dataset.status);
    }));
    load('all');
  }

  // ------------------------------------------------------------ new order
  if (page === 'order-new') {
    const form = $('#order-form');
    let products = [];
    function recalc() {
      const p = products.find((x) => x.id === Number(form.productId.value));
      const qty = Number(form.quantity.value) || 0;
      const total = p ? p.price * qty + (form.express.checked ? 30000 : 0) : 0;
      $('[data-testid="order-total"]').textContent = money(total);
    }
    Promise.all([
      api('GET', '/api/customers?status=active&pageSize=1000'),
      api('GET', '/api/products'),
    ]).then(([c, p]) => {
      products = p.data;
      form.customerId.insertAdjacentHTML('beforeend', c.data.items.map((x) => `<option value="${x.id}">${esc(x.name)}</option>`).join(''));
      form.productId.innerHTML = products.map((x) => `<option value="${x.id}">${esc(x.name)} — ${money(x.price)}</option>`).join('');
      recalc();
    });
    form.addEventListener('input', recalc);
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const res = await api('POST', '/api/orders', {
        customerId: form.customerId.value, productId: form.productId.value, quantity: form.quantity.value,
        payment: form.querySelector('input[name="payment"]:checked').value, express: form.express.checked, note: form.note.value,
      });
      if (res.status === 422) return showErrors('o-', res.data.errors);
      flash(`Đã tạo đơn hàng ${res.data.code}`);
      location.href = `/orders/${res.data.id}`;
    });
  }

  // ------------------------------------------------------------ order detail
  if (page === 'order-detail') {
    const btn = $('#complete-order');
    if (btn) btn.addEventListener('click', async () => {
      const id = btn.closest('[data-order-id]').dataset.orderId;
      await api('POST', `/api/orders/${id}/complete`);
      flash('Đã cập nhật trạng thái đơn hàng');
      location.reload();
    });
  }
})();
