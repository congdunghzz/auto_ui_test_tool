# QA Automation với AI Agent Skills + Playwright

**AI viết script một lần, Playwright chạy không cần LLM.**

Agent (Claude Code hoặc agent khác) chỉ dùng AI để:
- khám phá UI,
- hiểu testcase,
- sinh và bảo trì script,
- phân tích test fail.

Việc click, nhập liệu và assert do Playwright chạy trực tiếp: nhanh, ổn định, không tốn token.

```
            ┌────────────── AI (theo lô, khi cần) ──────────────┐
 URL + login│                                                   │
 ──────────►│ website-explorer ──► knowledge/ (màn hình,        │
            │   (script Playwright,   selector đã xác minh,     │
            │    không gọi LLM/click)  form, modal, API…)       │
 Testcase   │                              │                    │
 (MD/Excel) │ testcase-generator ◄─────────┘                    │
 ──────────►│   ──► playwright/ (Page Object + spec @TC-ID)     │
            └───────────────────────┬───────────────────────────┘
                                    ▼
                   npm test  (Playwright thuần, chạy song song)
                                    ▼
          reports/summary.md (PASS/FAIL/SKIPPED/BLOCKED theo mã TC)
          + screenshot, trace, page snapshot khi fail
                                    ▼
          npm run analyze ──► test-maintainer (AI) ──► sửa POM / báo bug
```

## Phần nào là công cụ, phần nào là demo

| Lớp | Gồm | Khi áp dụng cho web thật |
|---|---|---|
| **Skill** | `.claude/skills/*/SKILL.md`, `CLAUDE.md`, `AGENTS.md` | Giữ nguyên |
| **Công cụ** | `scripts/` (explore, import, coverage, analyze), `playwright/utils/` (reporter truy vết), `playwright/components/`, `playwright/fixtures/`, `playwright.config.ts`, `package.json` | Giữ nguyên |
| **Demo** | `demo-app/`, `knowledge/`, `testcases/{authentication,customer,order}`, `playwright/pages/*`, `playwright/tests/*`, `test-data/*`, phần `states`/`variants`/`startPaths` trong `explore.config.json` | Thay bằng của bạn: AI sẽ sinh lại cho web của bạn |

## Cấu trúc thư mục

```
.claude/skills/            5 Agent Skills (Claude Code tự nhận; agent khác đọc AGENTS.md)
  qa-autotest/             cửa vào: xem trạng thái, chuyển dự án sang web mới, điều phối 4 skill dưới
  website-explorer/        khám phá web → knowledge/
  testcase-generator/      testcase → Page Object + spec
  playwright-runner/       chạy test, báo cáo theo mã TC
  test-maintainer/         phân tích fail, bảo trì, báo bug
knowledge/                 UI Knowledge Base (explorer tự sinh + AI/QA bổ sung)
  application.md  navigation.md  screens/  components/  workflows/  screenshots/  raw/
  maintenance-log.md
testcases/<feature>/       testcase QA (.md chuẩn; import từ .xlsx/.csv) + _automation-report.md
  _template/               mẫu Excel/CSV
playwright/
  pages/  components/      Page Object Model + component dùng chung
  fixtures/                test fixture (inject page object, uniq()), factory dữ liệu
  tests/<feature>/         spec, mỗi test gắn tag @TC-...
  utils/                   reporter truy vết, đọc catalog testcase, env
scripts/                   explore.ts, import-testcases.ts, coverage.ts, analyze-failures.ts
test-data/                 dữ liệu test tĩnh theo feature
demo-app/                  app demo (QA Demo Shop) để chạy thử toàn bộ quy trình
explore.config.json        cấu hình explorer (login, phạm vi, states)
playwright.config.ts       cấu hình chạy, report, trace, auth
reports/                   (sinh ra khi chạy) html, results.json, summary.md, failures.md, coverage.md
```

## Cài đặt

Yêu cầu: Node.js ≥ 20.12 (khuyến nghị 22 hoặc 24).

```bash
npm install
```

```bash
npx playwright install chromium
```

```bash
cp .env.example .env
```

`.env` mặc định trỏ tới app demo (`http://localhost:4000`, tài khoản `admin` / `Admin@123`). Playwright tự khởi động app demo khi chạy test.

## Chạy thử nhanh với app demo

Explorer **không tự khởi động** app demo, nên mở một terminal riêng và để chạy:

```bash
npm run demo:app
```

```bash
npm run explore
```

Lệnh trên đọc lại UI và cập nhật `knowledge/`, mất khoảng 25 giây.

> Dùng Git Bash: khi truyền đường dẫn bắt đầu bằng `/` (ví dụ `--only /customers`), chạy bằng PowerShell hoặc thêm `MSYS_NO_PATHCONV=1` phía trước lệnh, vì Git Bash tự đổi `/customers` thành đường dẫn Windows.

```bash
npm test
```

Lệnh trên chạy toàn bộ test, mất khoảng 15–20 giây.

```bash
npm run analyze
```

```bash
npm run report
```

Kết quả đã kiểm chứng: 25 testcase (33 test, chạy khoảng 12–16 giây) gồm **22 PASS · 1 FAIL · 2 BLOCKED**.
- **TC-CUS-009 FAIL**: lỗi cố ý cài trong app demo, tìm kiếm phân biệt hoa thường. Test được giữ fail để báo bug.
- **TC-AUTH-006 BLOCKED**: màn hình không có nút đăng nhập Google (SSO).
- **TC-ORD-007 BLOCKED**: không có chức năng "In hóa đơn".

Hai case BLOCKED là do generator tự báo lại, không bịa ra test (xem `testcases/*/_automation-report.md`).

### Thử kịch bản bảo trì (UI đổi phiên bản)

1. Dừng app demo đang chạy, rồi chạy lại ở "bản phát hành mới". Bản này đổi nhãn ô tìm kiếm và nút Lưu.

   PowerShell:

   ```powershell
   $env:DEMO_UI_VERSION='2'; npm run demo:app
   ```

2. Chạy test. Các case có dùng ô tìm kiếm sẽ FAIL.

   ```bash
   npm test
   ```

3. Trong Claude Code gõ: *"Dùng skill test-maintainer phân tích các test fail"*. Agent sẽ:
   - quét lại màn hình `/customers` và thấy phần diff thay đổi;
   - sửa đúng 1 selector trong Page Object;
   - chạy lại test;
   - giữ TC-CUS-009 ở trạng thái FAIL (vì đó là bug thật) và viết `reports/bugs/TC-CUS-009.md`;
   - ghi lại thay đổi vào `knowledge/maintenance-log.md`.

## Dùng với website thật (qua Claude Code)

Mở thư mục này bằng Claude Code. Các skill trong `.claude/skills/` được nhận tự động.

**Cách nhanh nhất là dùng skill `qa-autotest`, cửa vào duy nhất.** Bạn chỉ cần nói việc muốn làm, skill sẽ:
- tự chạy `npm run status` để xem dự án đang ở đâu;
- chọn đúng skill bên dưới;
- dừng lại hỏi bạn ở những chỗ cần quyết định.

> /qa-autotest Áp dụng cho web https://staging.ten-he-thong.vn (đăng nhập bằng tài khoản test). Testcase ở testcases/kho/TC_Kho.xlsx. Làm từ đầu tới cuối.

> /qa-autotest Hôm qua dev mới deploy, test lại tính năng kho giúp mình.

> /qa-autotest Dự án đang tới đâu rồi, còn thiếu gì?

Lần đầu áp dụng cho web của bạn, skill sẽ:
1. Chạy `npm run project:init -- --base-url <url> --dry-run` để cho bạn xem kế hoạch: chuyển phần demo vào `examples/demo-shop/`, tạo khung trống cho web của bạn.
2. Chỉ chạy thật sau khi bạn đồng ý.
3. Nhờ bạn tự điền `QA_USERNAME` / `QA_PASSWORD` vào `.env`. Nếu web dùng SSO/OTP/captcha, bạn tự đăng nhập một lần bằng lệnh dưới; agent không bao giờ tự gõ mật khẩu SSO hay mã MFA.

```bash
npx playwright codegen https://staging.ten-he-thong.vn --save-storage=.auth/explorer.json
```

Bạn vẫn có thể gọi trực tiếp từng skill:

1. **Khám phá:**
   > Dùng skill website-explorer khám phá web trong .env, bỏ qua /admin.

   Agent sẽ:
   - viết bước đăng nhập vào `explore.config.json` (bước này dùng chung cho cả explorer lẫn test);
   - chạy `npm run explore`;
   - thêm `states` để mở modal hoặc lấy thông báo validation, thêm `variants` cho màn hình hiển thị khác nhau theo dữ liệu;
   - điền mục *Curated notes* trong `knowledge/screens/*.md`.

2. **Sinh test:**
   > Dùng skill testcase-generator cho file testcases/order/order.xlsx.

   Agent sẽ:
   - import file Excel;
   - map từng bước với knowledge;
   - viết Page Object và spec;
   - ghi `_automation-report.md` (AUTOMATED / BLOCKED / NEEDS INFO);
   - chạy typecheck và test để xác minh.

3. **Chạy:**
   > Chạy smoke test.

   Hoặc gõ trực tiếp `npm test -- --grep @smoke`.

4. **Khi test fail:**
   > Dùng skill test-maintainer phân tích các test fail.

   Agent đọc `reports/failures.md`, explore lại đúng màn hình liên quan rồi phân loại lỗi:
   - **Selector đổi:** sửa Page Object.
   - **Hành vi đổi:** hỏi QA trước khi sửa.
   - **Bug của app:** giữ test fail, viết `reports/bugs/<TC>.md`.

## Định dạng testcase

### Markdown (chuẩn)

Ví dụ đầy đủ: `testcases/customer/customer-management.md`.

```markdown
## TC-CUS-001: Thêm khách hàng với dữ liệu hợp lệ

- **Type:** positive
- **Priority:** high
- **Tags:** smoke, crud
- **Preconditions:** Đã đăng nhập
- **Test data:** Họ tên: ...; Email: ...

**Steps**

1. Mở màn hình Khách hàng
2. Nhấn "Thêm khách hàng"

**Expected**

- Hiển thị thông báo "Đã thêm khách hàng thành công"
```

### Excel/CSV

Dùng mẫu tạo bằng `npm run testcases:template`, hoặc file sẵn có của bạn. Tên cột được nhận bằng tiếng Việt hoặc tiếng Anh:

| Trường | Tên cột được chấp nhận (không phân biệt hoa thường) |
|---|---|
| ID | ID, TC ID, Mã TC, Mã testcase |
| Tính năng | Feature, Tính năng, Chức năng, Module |
| Tiêu đề | Title, Scenario, Kịch bản, Tên testcase, Mô tả |
| Loại / Ưu tiên / Tags | Type, Loại · Priority, Độ ưu tiên · Tags, Nhãn |
| Điều kiện | Preconditions, Điều kiện tiên quyết |
| Dữ liệu | Test data, Dữ liệu test |
| Các bước | Steps, Các bước, Bước thực hiện |
| Kết quả mong đợi | Expected, Expected result, Kết quả mong đợi |

Có thể viết mỗi bước trên một dòng riêng: dòng không có ID được gộp vào testcase ngay phía trên.

```bash
npm run testcases:import -- path/to/file.xlsx --feature order
```

## Các lệnh

| Lệnh | Mục đích |
|---|---|
| `npm run status` | Xem dự án đang ở đâu: môi trường, web đích, knowledge, testcase, lần chạy gần nhất, việc nên làm tiếp |
| `npm run project:init -- --base-url <url> [--sso] --dry-run` | Chuyển sang web của bạn: cất demo vào `examples/demo-shop/`, tạo khung trống (bỏ `--dry-run` để chạy thật) |
| `npm run explore` | Khám phá toàn bộ, cập nhật `knowledge/` |
| `npm run explore -- --only /customers,/orders/new` | Explore lại một số màn hình, có diff thay đổi |
| `npm run explore -- --headed --no-states` | Xem trình duyệt, bỏ qua bước lấy states |
| `npm run testcases:import -- file.xlsx --feature x` | Excel/CSV → Markdown |
| `npm test` | Chạy tất cả (song song) |
| `npm test -- --grep @TC-CUS-001` | Chạy một testcase |
| `npm test -- --grep "@customer"` / `"@smoke"` | Lọc theo feature hoặc tag |
| `npm run test:headed` / `npm run test:ui` | Xem test chạy |
| `npm run report` | Mở HTML report |
| `npm run analyze` | Tạo `reports/failures.md` (bộ bằng chứng cho AI) |
| `npm run coverage [-- feature]` | Testcase nào đã hoặc chưa tự động hóa |
| `npm run typecheck` | Kiểm tra TypeScript |

## Báo cáo

- **`reports/summary.md`**: bảng theo **mã testcase** với PASS / FAIL / SKIPPED / BLOCKED, thời gian chạy, lỗi tóm tắt, đường dẫn screenshot và trace, danh sách testcase chưa tự động hóa. Một testcase có nhiều test (data-driven) được gộp lại: chỉ cần một test fail thì cả testcase FAIL.
- **`reports/html/`**: HTML report của Playwright. Mỗi bước QA là một `test.step`.
- **`reports/artifacts/`**: screenshot, `trace.zip`, `error-context.md` (snapshot trang lúc fail). Chỉ lưu khi test fail.
- **`reports/failures.md`**: tạo bằng `npm run analyze`. Gồm phân loại sơ bộ, snapshot, màn hình liên quan và bước gợi ý tiếp theo.
- **BLOCKED** gồm các trường hợp:
  - test không chạy được vì setup đăng nhập fail;
  - test đánh dấu `test.fixme`, hoặc có annotation `blocked` khi thiếu chức năng hay thiếu dữ liệu.

## Nguyên tắc thiết kế

- **Tách AI khỏi thực thi.** Khi chạy test không có lời gọi LLM nào. AI chỉ chạy theo lô: đọc knowledge, sinh code, đọc digest lỗi.
- **Explorer chạy tất định.** Script tự đọc DOM và cây accessibility, rồi kiểm tra mỗi selector khớp **đúng 1 phần tử**. Thứ tự ưu tiên: data-testid → role + name → label → placeholder → CSS. Nếu một selector bị trùng khi modal đang mở, script tự chuyển sang selector chặt hơn.
- **Tái sử dụng knowledge.** Generator đọc file trong `knowledge/` chứ không mở lại web. Explorer chỉ chạy lại cho màn hình mới hoặc màn hình đã thay đổi.
- **Page Object Model.** Selector chỉ nằm ở `pages/` và `components/`. Khi UI đổi chỉ cần sửa một chỗ.
- **Truy vết.** Mã TC có cả trong tiêu đề và tag; reporter map kết quả về đúng testcase QA.
- **Assertion tất định, không giấu bug.** Không sửa expected result cho test pass, không skip để làm báo cáo đẹp.

## Hạn chế hiện tại và hướng phát triển

- Explorer **chỉ đi theo link** `<a href>`. Màn hình chỉ mở được qua nút bấm (SPA router), menu hover hoặc wizard nhiều bước cần khai báo bằng `startPaths` hoặc `states`. Có thể bổ sung chế độ "click an toàn" với whitelist.
- Tên accessible do script tự tính gần đúng. Selector nào không khớp được sẽ bị đánh dấu `UNRESOLVED`, không đoán.
- Thông báo validation chỉ được biết khi có `state` kích hoạt nó. Rule nghiệp vụ không thấy được trên UI vẫn cần tài liệu hoặc QA cung cấp.
- Iframe, shadow DOM đóng, canvas/chart và nội dung file tải về (PDF, Excel) chưa được explorer phân tích.
- Dữ liệu test tạo qua UI nên an toàn khi chạy song song nhưng chậm hơn tạo qua API. Có thể thêm fixture gọi API, nếu API được tài liệu hóa.
- Mới cấu hình Chromium. Thêm Firefox/WebKit trong `projects` của `playwright.config.ts`.
- Có thể tích hợp CI (GitHub Actions/GitLab) bằng `npm ci && npx playwright install --with-deps chromium && npm test`. Có thể đẩy `summary.json` lên công cụ quản lý test (Jira/Xray, TestRail) theo mã TC.
