(function () {
  "use strict";

  const $ = id => document.getElementById(id);
  const tools = {
    json: { title: "JSON Formatter", badge: "FORMATTER", description: "Biến JSON khó đọc thành cấu trúc rõ ràng. Gọn gàng, chính xác, trong tích tắc." },
    sql: { title: "SQL Formatter", badge: "POSTGRESQL", description: "Truy vấn phức tạp, trình bày đơn giản. Định dạng SQL dành cho PostgreSQL." },
    compare: { title: "Text Comparer", badge: "COMPARE", description: "Tìm điều khác biệt. So sánh hai văn bản và xem chính xác những dòng đã thay đổi." },
    convert: { title: "Convert Text", badge: "CONVERTER", description: "Đúng tên, đúng kiểu. Chuyển đổi cách viết ngay trong ô nhập với một lần nhấn." },
    escape: { title: "Escape / Unescape", badge: "ENCODER", description: "Xử lý ký tự đặc biệt dễ dàng. Escape và khôi phục văn bản cho JSON, HTML hoặc URL." }
  };
  const fields = {
    json: ["json-input", "json-output"],
    sql: ["sql-input", "sql-output"],
    compare: ["compare-before", "compare-after"],
    convert: ["convert-input"],
    escape: ["escape-input", "escape-output"]
  };
  const examples = {
    json: '{"project":"DevToys","version":"1.0.0","private":true,"tools":["JSON Formatter","SQL Formatter","Text Comparer"],"settings":{"theme":"dark","indent":2},"message":"Hello, developer!"}',
    sql: "with active_users as (select id, name, email from users where active = true) select u.name, u.email, count(o.id) as order_count from active_users u left join orders o on o.user_id = u.id where o.created_at >= now() - interval '30 days' group by u.name, u.email order by order_count desc limit 10;",
    compare: ['const project = "DevToys";\nconst version = "1.0.0";\nconst tools = 3;\n\nconsole.log(project);', 'const project = "DevToys";\nconst version = "1.1.0";\nconst tools = 5;\nconst isPrivate = true;\n\nconsole.log(project);'],
    convert: "hello wonderful world\ngetHTTPResponse\nngười dùng mới",
    escape: 'Hello, "developer"!\n<div class="greeting">Xin chào & welcome</div>'
  };
  let currentTool = "json";
  let toastTimer;
  const convertHistory = [];

  function updateStats(id) {
    const value = $(id).value;
    const stats = document.querySelector(`[data-stats="${id}"]`);
    if (stats) stats.textContent = `${value.length.toLocaleString("vi-VN")} ký tự · ${value ? value.split("\n").length.toLocaleString("vi-VN") : 0} dòng`;
  }

  function setValue(id, value) {
    $(id).value = value;
    updateStats(id);
  }

  function feedback(tool, message = "", error = false) {
    const element = $(`${tool}-feedback`);
    element.textContent = message;
    element.classList.toggle("error", error);
  }

  function toast(message, error = false) {
    clearTimeout(toastTimer);
    $("toast").textContent = message;
    $("toast").classList.toggle("error", error);
    $("toast").hidden = false;
    toastTimer = setTimeout(() => { $("toast").hidden = true; }, error ? 6000 : 3000);
  }

  function invalidate(tool) {
    feedback(tool);
    if (["json", "sql", "escape"].includes(tool)) setValue(`${tool}-output`, "");
    if (tool === "json") {
      $("json-state").textContent = "Chờ định dạng";
      $("json-state").classList.remove("success");
    }
    if (tool === "compare") {
      $("diff-card").hidden = true;
      $("diff-body").replaceChildren();
      $("diff-summary").replaceChildren();
    }
  }

  function route() {
    const requested = location.hash.slice(1);
    currentTool = Object.hasOwn(tools, requested) ? requested : "json";
    for (const name of Object.keys(tools)) $(`panel-${name}`).hidden = name !== currentTool;
    document.querySelectorAll("[data-tool]").forEach(link => {
      const active = link.dataset.tool === currentTool;
      link.classList.toggle("active", active);
      if (active) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    });
    const tool = tools[currentTool];
    $("page-title").textContent = tool.title;
    $("page-badge").textContent = tool.badge;
    $("page-description").textContent = tool.description;
    $("breadcrumb-current").textContent = tool.title;
    document.title = `DevToys — ${tool.title}`;
  }

  function runJSON(minify = false) {
    invalidate("json");
    try {
      const result = DevToys.formatJSON($("json-input").value, $("json-indent").value, minify);
      setValue("json-output", result);
      $("json-state").textContent = "✓ JSON hợp lệ";
      $("json-state").classList.add("success");
      feedback("json", minify ? "Đã rút gọn JSON." : "Đã định dạng JSON thành công.");
    } catch (error) {
      $("json-state").textContent = "Đầu vào không hợp lệ";
      feedback("json", `Không thể xử lý JSON: ${error.message}`, true);
    }
  }

  function runSQL() {
    invalidate("sql");
    try {
      setValue("sql-output", DevToys.formatSQL($("sql-input").value, $("sql-indent").value, $("sql-uppercase").checked));
      feedback("sql", "Đã định dạng SQL. Truy vấn không được thực thi hoặc kiểm tra cú pháp đầy đủ.");
    } catch (error) {
      feedback("sql", `Không thể định dạng SQL: ${error.message}`, true);
    }
  }

  function runCompare() {
    invalidate("compare");
    try {
      const rows = DevToys.compareTexts($("compare-before").value, $("compare-after").value, $("compare-whitespace").checked);
      let beforeLine = 0;
      let afterLine = 0;
      let added = 0;
      let removed = 0;
      const fragment = document.createDocumentFragment();
      for (const row of rows) {
        const tr = document.createElement("tr");
        tr.className = row.type;
        const oldNumber = row.type === "added" ? "" : String(++beforeLine);
        const newNumber = row.type === "removed" ? "" : String(++afterLine);
        const sign = row.type === "added" ? "+" : row.type === "removed" ? "−" : " ";
        for (const value of [oldNumber, newNumber, sign, row.text || "\u00a0"]) {
          const td = document.createElement("td");
          td.textContent = value;
          tr.append(td);
        }
        if (row.type === "added") added++;
        if (row.type === "removed") removed++;
        fragment.append(tr);
      }
      $("diff-body").append(fragment);
      for (const [className, label] of [["diff-added", `+ ${added} thêm`], ["diff-removed", `− ${removed} xóa`]]) {
        const span = document.createElement("span");
        span.className = className;
        span.textContent = label;
        $("diff-summary").append(span);
      }
      $("diff-card").hidden = false;
      feedback("compare", added || removed
        ? `Tìm thấy khác biệt: ${added} dòng thêm và ${removed} dòng xóa.`
        : `Hai văn bản giống nhau${$("compare-whitespace").checked ? " khi bỏ qua khoảng trắng đầu/cuối dòng" : ""}.`);
    } catch (error) {
      feedback("compare", error.message, true);
    }
  }

  function runConvert(mode) {
    try {
      const original = $("convert-input").value;
      if (!original.trim()) throw new Error("Vui lòng nhập văn bản cần chuyển đổi.");
      const result = DevToys.convertCase(original, mode);
      if (result !== original) {
        convertHistory.push(original);
        if (convertHistory.length > 20) convertHistory.shift();
      }
      setValue("convert-input", result);
      $("convert-undo").disabled = convertHistory.length === 0;
      feedback("convert", `Đã chuyển sang ${{ snake: "snake_case", camel: "camelCase", pascal: "PascalCase" }[mode]}.`);
    } catch (error) {
      feedback("convert", error.message, true);
    }
  }

  function runEscape(unescape = false) {
    invalidate("escape");
    try {
      setValue("escape-output", DevToys.transformEscape($("escape-input").value, $("escape-mode").value, unescape));
      feedback("escape", unescape ? "Đã unescape văn bản." : "Đã escape văn bản.");
    } catch (error) {
      feedback("escape", `Không thể ${unescape ? "unescape" : "escape"}: ${error.message}`, true);
    }
  }

  document.querySelectorAll("textarea:not([readonly])").forEach(textarea => {
    textarea.addEventListener("input", () => {
      updateStats(textarea.id);
      const tool = Object.keys(fields).find(name => fields[name].includes(textarea.id));
      invalidate(tool);
      if (tool === "convert") {
        convertHistory.length = 0;
        $("convert-undo").disabled = true;
      }
    });
  });

  document.querySelectorAll("[data-clear]").forEach(button => {
    button.addEventListener("click", () => {
      const tool = button.dataset.clear;
      fields[tool].forEach(id => setValue(id, ""));
      invalidate(tool);
      if (tool === "convert") { convertHistory.length = 0; $("convert-undo").disabled = true; }
      $(fields[tool][0]).focus();
    });
  });

  document.querySelectorAll("[data-sample]").forEach(button => {
    button.addEventListener("click", () => {
      const tool = button.dataset.sample;
      const inputFields = fields[tool].filter(id => !$(id).readOnly);
      if (inputFields.some(id => $(id).value) && !confirm("Thay nội dung hiện tại bằng ví dụ mẫu?")) return;
      invalidate(tool);
      if (tool === "compare") examples.compare.forEach((value, index) => setValue(inputFields[index], value));
      else setValue(inputFields[0], examples[tool]);
      if (tool === "convert") { convertHistory.length = 0; $("convert-undo").disabled = true; }
      feedback(tool, "Đã tải ví dụ. Nhấn nút xử lý để xem kết quả.");
    });
  });

  document.querySelectorAll("[data-copy]").forEach(button => {
    button.addEventListener("click", async () => {
      const field = $(button.dataset.copy);
      if (!field.value) { toast("Chưa có nội dung để sao chép.", true); return; }
      try {
        if (!navigator.clipboard?.writeText) throw new Error("Trình duyệt không hỗ trợ clipboard trong ngữ cảnh này.");
        await navigator.clipboard.writeText(field.value);
        toast("Đã sao chép vào clipboard.");
      } catch (error) {
        field.focus();
        field.select();
        toast(`Không thể sao chép tự động: ${error.message} Nội dung đã được chọn; hãy nhấn Ctrl/Cmd+C.`, true);
      }
    });
  });

  $("json-format").addEventListener("click", () => runJSON());
  $("json-minify").addEventListener("click", () => runJSON(true));
  $("sql-format").addEventListener("click", runSQL);
  $("compare-run").addEventListener("click", runCompare);
  $("escape-run").addEventListener("click", () => runEscape());
  $("unescape-run").addEventListener("click", () => runEscape(true));
  document.querySelectorAll("[data-case]").forEach(button => button.addEventListener("click", () => runConvert(button.dataset.case)));
  $("convert-undo").addEventListener("click", () => {
    if (!convertHistory.length) return;
    setValue("convert-input", convertHistory.pop());
    $("convert-undo").disabled = convertHistory.length === 0;
    feedback("convert", "Đã hoàn tác chuyển đổi.");
  });
  $("escape-use-output").addEventListener("click", () => {
    if (!$("escape-output").value) { feedback("escape", "Chưa có kết quả để dùng làm đầu vào.", true); return; }
    setValue("escape-input", $("escape-output").value);
    invalidate("escape");
  });
  for (const [id, tool] of [["json-indent", "json"], ["sql-indent", "sql"], ["sql-uppercase", "sql"], ["compare-whitespace", "compare"]]) {
    $(id).addEventListener("change", () => invalidate(tool));
  }
  $("escape-mode").addEventListener("change", () => {
    invalidate("escape");
    const mode = $("escape-mode").value;
    $("escape-output-label").textContent = $("escape-mode").selectedOptions[0].textContent;
    $("escape-help").textContent = {
      json: "JSON string: escape nội dung chuỗi, không thêm cặp dấu ngoặc kép bên ngoài. Unescape nhận nội dung theo cùng quy ước.",
      html: "HTML: hỗ trợ &amp;, &lt;, &gt;, &quot;, &apos;, &nbsp; và mã số Unicode (&#39;, &#x1F600;). Chỉ giải mã một lớp, không thực thi HTML.",
      url: "URL component: dùng encodeURIComponent / decodeURIComponent, không phải toàn bộ URL. Dấu + được giữ nguyên khi unescape, không chuyển thành dấu cách."
    }[mode];
  });
  $("theme-toggle").addEventListener("click", () => {
    const light = document.documentElement.dataset.theme !== "light";
    document.documentElement.dataset.theme = light ? "light" : "dark";
    $("theme-toggle").setAttribute("aria-label", `Chuyển sang giao diện ${light ? "tối" : "sáng"}`);
  });
  $("shortcut-key").textContent = /Mac|iPhone|iPad/.test(navigator.platform) ? "⌘" : "Ctrl";
  document.addEventListener("keydown", event => {
    if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
      event.preventDefault();
      if (currentTool === "json") runJSON();
      else if (currentTool === "sql") runSQL();
      else if (currentTool === "compare") runCompare();
      else if (currentTool === "escape") runEscape();
    }
  });
  window.addEventListener("hashchange", route);
  route();
})();
