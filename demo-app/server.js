// QA Demo Shop — a small, dependency-free web app used as the authorized target
// for demonstrating the QA automation skill suite. In-memory data, cookie session.
//
// Intentional defect (for the failure-analysis demo): customer search is
// case-sensitive (see filterCustomers). Do NOT "fix" it without updating the demo docs.
//
// DEMO_UI_VERSION=2 simulates a new UI release (renamed labels) so the
// test-maintainer skill can be exercised against a real selector change.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const PORT = Number(process.env.PORT || 4000);
const UI_V2 = process.env.DEMO_UI_VERSION === '2';
const USERS = { admin: { password: 'Admin@123', displayName: 'Quản trị viên' } };

// ---------------------------------------------------------------- data
const sessions = new Map();
let nextCustomerId = 1;
let nextOrderId = 1;
const customers = [];
const orders = [];
const products = [
  { id: 1, name: 'Bàn phím cơ K1', price: 850000 },
  { id: 2, name: 'Chuột không dây M2', price: 320000 },
  { id: 3, name: 'Màn hình 24 inch', price: 3200000 },
];

const seedCustomers = [
  ['Nguyễn Văn An', 'an.nguyen@example.com', '0901234567', 'active', 'male', true],
  ['Trần Thị Bình', 'binh.tran@example.com', '0912345678', 'active', 'female', false],
  ['Lê Hoàng Cường', 'cuong.le@example.com', '0923456789', 'inactive', 'male', false],
  ['Phạm Minh Dũng', 'dung.pham@example.com', '0934567890', 'active', 'male', true],
  ['Hoàng Thu Hà', 'ha.hoang@example.com', '0945678901', 'active', 'female', false],
  ['Vũ Đức Huy', 'huy.vu@example.com', '0956789012', 'inactive', 'male', false],
  ['Đặng Ngọc Lan', 'lan.dang@example.com', '0967890123', 'active', 'female', true],
  ['Bùi Quang Minh', 'minh.bui@example.com', '0978901234', 'active', 'male', false],
  ['Đỗ Thanh Nga', 'nga.do@example.com', '0989012345', 'active', 'female', false],
  ['Ngô Gia Phúc', 'phuc.ngo@example.com', '0990123456', 'active', 'other', false],
  ['Dương Mỹ Quyên', 'quyen.duong@example.com', '0381234567', 'inactive', 'female', false],
  ['Lý Thành Sơn', 'son.ly@example.com', '0392345678', 'active', 'male', true],
];
for (const [name, email, phone, status, gender, vip] of seedCustomers) {
  customers.push({ id: nextCustomerId++, name, email, phone, status, gender, vip, note: '' });
}
const seedOrders = [
  [1, 1, 2, 'cash', 'pending'],
  [2, 2, 1, 'transfer', 'completed'],
  [4, 3, 1, 'transfer', 'pending'],
  [5, 1, 1, 'cash', 'cancelled'],
  [7, 2, 3, 'cash', 'completed'],
  [8, 3, 2, 'transfer', 'pending'],
];
for (const [customerId, productId, quantity, payment, status] of seedOrders) {
  createOrder({ customerId, productId, quantity, payment, express: false, note: '' }, status);
}

function createOrder(input, status = 'pending') {
  const product = products.find((p) => p.id === input.productId);
  const total = product.price * input.quantity + (input.express ? 30000 : 0);
  const order = {
    id: nextOrderId,
    code: 'DH' + String(nextOrderId).padStart(4, '0'),
    customerId: input.customerId,
    productId: input.productId,
    quantity: input.quantity,
    payment: input.payment,
    express: !!input.express,
    note: input.note || '',
    status,
    total,
  };
  nextOrderId++;
  orders.push(order);
  return order;
}

// ---------------------------------------------------------------- helpers
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^0\d{9}$/;

function validateCustomer(body, existingId) {
  const errors = {};
  const name = String(body.name || '').trim();
  const email = String(body.email || '').trim();
  const phone = String(body.phone || '').trim();
  if (!name) errors.name = 'Họ tên là bắt buộc';
  else if (name.length > 100) errors.name = 'Họ tên tối đa 100 ký tự';
  if (!email) errors.email = 'Email là bắt buộc';
  else if (!EMAIL_RE.test(email)) errors.email = 'Email không hợp lệ';
  else if (customers.some((c) => c.email.toLowerCase() === email.toLowerCase() && c.id !== existingId))
    errors.email = 'Email đã tồn tại';
  if (phone && !PHONE_RE.test(phone)) errors.phone = 'Số điện thoại phải gồm 10 chữ số và bắt đầu bằng 0';
  if (String(body.note || '').length > 200) errors.note = 'Ghi chú tối đa 200 ký tự';
  return {
    errors,
    value: {
      name, email, phone,
      status: body.status === 'inactive' ? 'inactive' : 'active',
      gender: ['male', 'female', 'other'].includes(body.gender) ? body.gender : 'other',
      vip: !!body.vip,
      note: String(body.note || ''),
    },
  };
}

function filterCustomers(q, status) {
  return customers.filter((c) => {
    // DEFECT (intentional): case-sensitive match. "nguyễn" does not find "Nguyễn Văn An".
    const matchesQ = !q || c.name.includes(q) || c.email.includes(q);
    const matchesStatus = !status || status === 'all' || c.status === status;
    return matchesQ && matchesStatus;
  });
}

function orderView(o) {
  const c = customers.find((x) => x.id === o.customerId);
  const p = products.find((x) => x.id === o.productId);
  return { ...o, customerName: c ? c.name : '(đã xóa)', productName: p.name };
}

function parseCookies(req) {
  const out = {};
  for (const part of (req.headers.cookie || '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

function currentUser(req) {
  const sid = parseCookies(req).sid;
  return sid && sessions.has(sid) ? sessions.get(sid) : null;
}

function send(res, status, body, headers = {}) {
  res.writeHead(status, headers);
  res.end(body);
}
const json = (res, status, data, headers = {}) =>
  send(res, status, JSON.stringify(data), { 'Content-Type': 'application/json; charset=utf-8', ...headers });

function readBody(req) {
  return new Promise((resolve) => {
    let raw = '';
    req.on('data', (c) => (raw += c));
    req.on('end', () => {
      try { resolve(raw ? JSON.parse(raw) : {}); } catch { resolve({}); }
    });
  });
}

// ---------------------------------------------------------------- HTML
const esc = (s) => String(s).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);

function layout(page, title, user, content) {
  const nav = user
    ? `<header class="topbar">
        <span class="brand">QA Demo Shop</span>
        <span class="user" data-testid="current-user">${esc(user.displayName)}</span>
        <button type="button" id="logout-btn" class="btn btn-ghost">Đăng xuất</button>
      </header>
      <div class="shell">
        <nav aria-label="Menu chính" class="sidebar">
          <a href="/dashboard" ${page === 'dashboard' ? 'aria-current="page"' : ''}>Tổng quan</a>
          <a href="/customers" ${page === 'customers' ? 'aria-current="page"' : ''}>Khách hàng</a>
          <a href="/orders" ${page.startsWith('order') ? 'aria-current="page"' : ''}>Đơn hàng</a>
        </nav>
        <main class="content">${content}</main>
      </div>`
    : `<main class="content narrow">${content}</main>`;
  return `<!doctype html>
<html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)} · QA Demo Shop</title><link rel="stylesheet" href="/static/styles.css"></head>
<body data-page="${page}" data-ui-version="${UI_V2 ? 2 : 1}">
${nav}
<div id="toast" role="status" aria-live="polite" data-testid="toast" class="toast" hidden></div>
<script src="/static/app.js"></script>
</body></html>`;
}

const pages = {
  login: () => `
    <h1>Đăng nhập</h1>
    <form id="login-form" novalidate class="card">
      <div class="field">
        <label for="username">Tên đăng nhập</label>
        <input id="username" name="username" autocomplete="username" aria-describedby="username-error">
        <p class="error" id="username-error"></p>
      </div>
      <div class="field">
        <label for="password">Mật khẩu</label>
        <input id="password" name="password" type="password" autocomplete="current-password" aria-describedby="password-error">
        <p class="error" id="password-error"></p>
      </div>
      <label class="inline"><input type="checkbox" id="remember" name="remember"> Ghi nhớ đăng nhập</label>
      <div role="alert" id="login-error" class="alert" hidden></div>
      <button type="submit" class="btn btn-primary">Đăng nhập</button>
    </form>`,

  dashboard: () => `
    <h1>Tổng quan</h1>
    <section class="cards" aria-label="Thống kê">
      <article class="stat"><h2>Tổng khách hàng</h2><p data-testid="stat-customers">…</p></article>
      <article class="stat"><h2>Đơn hàng chờ xử lý</h2><p data-testid="stat-pending-orders">…</p></article>
      <article class="stat"><h2>Doanh thu</h2><p data-testid="stat-revenue">…</p></article>
    </section>
    <p><a href="/customers">Xem danh sách khách hàng</a> · <a href="/orders/new">Tạo đơn hàng mới</a></p>`,

  customers: () => `
    <div class="page-head">
      <h1>Khách hàng</h1>
      <button type="button" class="btn btn-primary" data-testid="btn-add-customer">Thêm khách hàng</button>
    </div>
    <div class="toolbar">
      <div class="field">
        <label for="search">${UI_V2 ? 'Tìm khách hàng' : 'Tìm kiếm khách hàng'}</label>
        <input id="search" type="search" placeholder="Nhập tên hoặc email">
      </div>
      <div class="field">
        <label for="status-filter">Trạng thái</label>
        <select id="status-filter">
          <option value="all">Tất cả</option>
          <option value="active">Hoạt động</option>
          <option value="inactive">Ngừng hoạt động</option>
        </select>
      </div>
    </div>
    <table aria-label="Danh sách khách hàng" class="table">
      <thead><tr><th>Họ tên</th><th>Email</th><th>Số điện thoại</th><th>Trạng thái</th><th>VIP</th><th>Thao tác</th></tr></thead>
      <tbody id="customer-rows"><tr><td colspan="6">Đang tải…</td></tr></tbody>
    </table>
    <p id="empty-state" class="muted" hidden>Không tìm thấy khách hàng nào</p>
    <nav aria-label="Phân trang" class="pager">
      <button type="button" id="prev-page" class="btn">Trang trước</button>
      <span id="page-info" data-testid="page-info">Trang 1 / 1</span>
      <button type="button" id="next-page" class="btn">Trang sau</button>
    </nav>

    <div class="backdrop" id="customer-modal-backdrop" hidden>
      <div role="dialog" aria-modal="true" aria-labelledby="customer-modal-title" class="modal" id="customer-modal">
        <h2 id="customer-modal-title">Thêm khách hàng</h2>
        <form id="customer-form" novalidate>
          <div class="field">
            <label for="c-name">Họ tên *</label>
            <input id="c-name" name="name" maxlength="120" aria-describedby="c-name-error">
            <p class="error" id="c-name-error"></p>
          </div>
          <div class="field">
            <label for="c-email">Email *</label>
            <input id="c-email" name="email" type="email" aria-describedby="c-email-error">
            <p class="error" id="c-email-error"></p>
          </div>
          <div class="field">
            <label for="c-phone">Số điện thoại</label>
            <input id="c-phone" name="phone" inputmode="numeric" placeholder="0xxxxxxxxx" aria-describedby="c-phone-error">
            <p class="error" id="c-phone-error"></p>
          </div>
          <div class="field">
            <label for="c-status">Trạng thái khách hàng</label>
            <select id="c-status" name="status">
              <option value="active">Hoạt động</option>
              <option value="inactive">Ngừng hoạt động</option>
            </select>
          </div>
          <fieldset class="field">
            <legend>Giới tính</legend>
            <label class="inline"><input type="radio" name="gender" value="male"> Nam</label>
            <label class="inline"><input type="radio" name="gender" value="female"> Nữ</label>
            <label class="inline"><input type="radio" name="gender" value="other" checked> Khác</label>
          </fieldset>
          <label class="inline"><input type="checkbox" id="c-vip" name="vip"> Khách hàng VIP</label>
          <div class="field">
            <label for="c-note">Ghi chú</label>
            <textarea id="c-note" name="note" rows="3" aria-describedby="c-note-error"></textarea>
            <p class="error" id="c-note-error"></p>
          </div>
          <div class="actions">
            <button type="button" class="btn" id="customer-cancel">Hủy</button>
            <button type="submit" class="btn btn-primary">${UI_V2 ? 'Lưu thông tin' : 'Lưu'}</button>
          </div>
        </form>
      </div>
    </div>

    <div class="backdrop" id="confirm-backdrop" hidden>
      <div role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" aria-describedby="confirm-message" class="modal">
        <h2 id="confirm-title">Xác nhận xóa</h2>
        <p id="confirm-message"></p>
        <div class="actions">
          <button type="button" class="btn" id="confirm-cancel">Hủy</button>
          <button type="button" class="btn btn-danger" id="confirm-ok">Xóa</button>
        </div>
      </div>
    </div>`,

  orders: () => `
    <div class="page-head">
      <h1>Đơn hàng</h1>
      <a class="btn btn-primary" href="/orders/new">Tạo đơn hàng</a>
    </div>
    <div role="tablist" aria-label="Lọc theo trạng thái" class="tabs">
      <button role="tab" aria-selected="true" data-status="all">Tất cả</button>
      <button role="tab" aria-selected="false" data-status="pending">Chờ xử lý</button>
      <button role="tab" aria-selected="false" data-status="completed">Hoàn thành</button>
      <button role="tab" aria-selected="false" data-status="cancelled">Đã hủy</button>
    </div>
    <div role="tabpanel" aria-label="Kết quả">
      <table aria-label="Danh sách đơn hàng" class="table">
        <thead><tr><th>Mã đơn</th><th>Khách hàng</th><th>Sản phẩm</th><th>Số lượng</th><th>Thanh toán</th><th>Trạng thái</th><th>Tổng tiền</th></tr></thead>
        <tbody id="order-rows"><tr><td colspan="7">Đang tải…</td></tr></tbody>
      </table>
    </div>`,

  'order-new': () => `
    <h1>Tạo đơn hàng</h1>
    <form id="order-form" novalidate class="card">
      <div class="field">
        <label for="o-customer">Khách hàng *</label>
        <select id="o-customer" name="customerId" aria-describedby="o-customer-error"><option value="">-- Chọn khách hàng --</option></select>
        <p class="error" id="o-customer-error"></p>
      </div>
      <div class="field">
        <label for="o-product">Sản phẩm *</label>
        <select id="o-product" name="productId"></select>
      </div>
      <div class="field">
        <label for="o-quantity">Số lượng *</label>
        <input id="o-quantity" name="quantity" type="number" min="1" max="100" value="1" aria-describedby="o-quantity-error">
        <p class="error" id="o-quantity-error"></p>
      </div>
      <fieldset class="field">
        <legend>Phương thức thanh toán</legend>
        <label class="inline"><input type="radio" name="payment" value="cash" checked> Tiền mặt</label>
        <label class="inline"><input type="radio" name="payment" value="transfer"> Chuyển khoản</label>
      </fieldset>
      <label class="inline"><input type="checkbox" id="o-express" name="express"> Giao hàng nhanh (+30.000đ)</label>
      <div class="field">
        <label for="o-note">Ghi chú đơn hàng</label>
        <textarea id="o-note" name="note" rows="2"></textarea>
      </div>
      <p>Tổng tiền: <strong data-testid="order-total" aria-live="polite">0đ</strong></p>
      <div class="actions">
        <a href="/orders" class="btn">Quay lại</a>
        <button type="submit" class="btn btn-primary">Tạo đơn</button>
      </div>
    </form>`,

  'order-detail': (order) => `
    <h1>Đơn hàng ${esc(order.code)}</h1>
    <dl class="details card" aria-label="Thông tin đơn hàng">
      <dt>Khách hàng</dt><dd data-testid="order-customer">${esc(order.customerName)}</dd>
      <dt>Sản phẩm</dt><dd data-testid="order-product">${esc(order.productName)}</dd>
      <dt>Số lượng</dt><dd data-testid="order-quantity">${order.quantity}</dd>
      <dt>Thanh toán</dt><dd data-testid="order-payment">${order.payment === 'cash' ? 'Tiền mặt' : 'Chuyển khoản'}</dd>
      <dt>Trạng thái</dt><dd data-testid="order-status">${{ pending: 'Chờ xử lý', completed: 'Hoàn thành', cancelled: 'Đã hủy' }[order.status]}</dd>
      <dt>Tổng tiền</dt><dd data-testid="order-detail-total">${order.total.toLocaleString('vi-VN')}đ</dd>
    </dl>
    <div class="actions" data-order-id="${order.id}">
      <a href="/orders" class="btn">Quay lại danh sách</a>
      ${order.status === 'pending' ? '<button type="button" class="btn btn-primary" id="complete-order">Đánh dấu hoàn thành</button>' : ''}
    </div>`,
};

// ---------------------------------------------------------------- server
const STATIC = path.join(__dirname, 'public');

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const p = url.pathname;
  const user = currentUser(req);

  try {
    if (p.startsWith('/static/')) {
      const file = path.join(STATIC, path.basename(p));
      if (!fs.existsSync(file)) return send(res, 404, 'Not found');
      const type = file.endsWith('.css') ? 'text/css' : 'application/javascript';
      return send(res, 200, fs.readFileSync(file), { 'Content-Type': `${type}; charset=utf-8` });
    }

    // ---- API
    if (p.startsWith('/api/')) {
      if (p === '/api/health') return json(res, 200, { ok: true });
      if (p === '/api/login' && req.method === 'POST') {
        const body = await readBody(req);
        const u = USERS[body.username];
        if (!u || u.password !== body.password)
          return json(res, 401, { error: 'Tên đăng nhập hoặc mật khẩu không đúng' });
        const sid = crypto.randomUUID();
        sessions.set(sid, { username: body.username, displayName: u.displayName });
        const maxAge = body.remember ? '; Max-Age=2592000' : '';
        return json(res, 200, { ok: true }, { 'Set-Cookie': `sid=${sid}; Path=/; HttpOnly; SameSite=Lax${maxAge}` });
      }
      if (!user) return json(res, 401, { error: 'Unauthorized' });
      if (p === '/api/logout' && req.method === 'POST') {
        sessions.delete(parseCookies(req).sid);
        return json(res, 200, { ok: true }, { 'Set-Cookie': 'sid=; Path=/; Max-Age=0' });
      }
      if (p === '/api/stats') {
        return json(res, 200, {
          customers: customers.length,
          pendingOrders: orders.filter((o) => o.status === 'pending').length,
          revenue: orders.filter((o) => o.status === 'completed').reduce((s, o) => s + o.total, 0),
        });
      }
      if (p === '/api/products') return json(res, 200, products);
      if (p === '/api/customers' && req.method === 'GET') {
        const q = url.searchParams.get('q') || '';
        const status = url.searchParams.get('status') || 'all';
        const page = Math.max(1, Number(url.searchParams.get('page') || 1));
        const pageSize = Number(url.searchParams.get('pageSize') || 5);
        const all = filterCustomers(q.trim(), status);
        const pagesCount = Math.max(1, Math.ceil(all.length / pageSize));
        const items = all.slice((page - 1) * pageSize, page * pageSize);
        return json(res, 200, { items, total: all.length, page, pages: pagesCount });
      }
      if (p === '/api/customers' && req.method === 'POST') {
        const { errors, value } = validateCustomer(await readBody(req));
        if (Object.keys(errors).length) return json(res, 422, { errors });
        const c = { id: nextCustomerId++, ...value };
        customers.unshift(c);
        return json(res, 201, c);
      }
      const cm = p.match(/^\/api\/customers\/(\d+)$/);
      if (cm) {
        const c = customers.find((x) => x.id === Number(cm[1]));
        if (!c) return json(res, 404, { error: 'Không tìm thấy khách hàng' });
        if (req.method === 'PUT') {
          const { errors, value } = validateCustomer(await readBody(req), c.id);
          if (Object.keys(errors).length) return json(res, 422, { errors });
          Object.assign(c, value);
          return json(res, 200, c);
        }
        if (req.method === 'DELETE') {
          customers.splice(customers.indexOf(c), 1);
          return json(res, 200, { ok: true });
        }
        return json(res, 200, c);
      }
      if (p === '/api/orders' && req.method === 'GET') {
        const status = url.searchParams.get('status') || 'all';
        const list = orders.filter((o) => status === 'all' || o.status === status).slice().reverse();
        return json(res, 200, list.map(orderView));
      }
      if (p === '/api/orders' && req.method === 'POST') {
        const body = await readBody(req);
        const errors = {};
        const customerId = Number(body.customerId);
        const quantity = Number(body.quantity);
        if (!customers.some((c) => c.id === customerId)) errors.customerId = 'Vui lòng chọn khách hàng';
        if (!Number.isInteger(quantity) || quantity < 1 || quantity > 100) errors.quantity = 'Số lượng phải từ 1 đến 100';
        if (!products.some((x) => x.id === Number(body.productId))) errors.productId = 'Vui lòng chọn sản phẩm';
        if (Object.keys(errors).length) return json(res, 422, { errors });
        const o = createOrder({
          customerId, quantity, productId: Number(body.productId),
          payment: body.payment === 'transfer' ? 'transfer' : 'cash', express: !!body.express, note: body.note,
        });
        return json(res, 201, orderView(o));
      }
      const om = p.match(/^\/api\/orders\/(\d+)(\/complete)?$/);
      if (om) {
        const o = orders.find((x) => x.id === Number(om[1]));
        if (!o) return json(res, 404, { error: 'Không tìm thấy đơn hàng' });
        if (om[2] && req.method === 'POST') {
          if (o.status !== 'pending') return json(res, 409, { error: 'Đơn hàng không ở trạng thái chờ xử lý' });
          o.status = 'completed';
        }
        return json(res, 200, orderView(o));
      }
      return json(res, 404, { error: 'Not found' });
    }

    // ---- pages
    const html = (page, title, ...args) =>
      send(res, 200, layout(page, title, user, pages[page](...args)), { 'Content-Type': 'text/html; charset=utf-8' });
    const redirect = (to) => send(res, 302, '', { Location: to });

    if (p === '/login') return user ? redirect('/dashboard') : html('login', 'Đăng nhập');
    if (!user) return redirect('/login?next=' + encodeURIComponent(p));
    if (p === '/' ) return redirect('/dashboard');
    if (p === '/dashboard') return html('dashboard', 'Tổng quan');
    if (p === '/customers') return html('customers', 'Khách hàng');
    if (p === '/orders') return html('orders', 'Đơn hàng');
    if (p === '/orders/new') return html('order-new', 'Tạo đơn hàng');
    const od = p.match(/^\/orders\/(\d+)$/);
    if (od) {
      const o = orders.find((x) => x.id === Number(od[1]));
      if (o) return html('order-detail', `Đơn hàng ${o.code}`, orderView(o));
    }
    return send(res, 404, layout('notfound', 'Không tìm thấy', user, '<h1>404 — Không tìm thấy trang</h1>'), {
      'Content-Type': 'text/html; charset=utf-8',
    });
  } catch (err) {
    console.error(err);
    return json(res, 500, { error: 'Internal error' });
  }
});

server.listen(PORT, () => console.log(`QA Demo Shop running at http://localhost:${PORT} (UI v${UI_V2 ? 2 : 1})`));
