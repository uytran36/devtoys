(function (root) {
  "use strict";

  const MAX_TEXT = 1000000;

  function checkSize(text, limit = MAX_TEXT) {
    if (text.length > limit) {
      throw new Error(`Văn bản quá lớn. Giới hạn là ${limit.toLocaleString("vi-VN")} ký tự.`);
    }
  }

  function formatJSON(text, indent = "2", minify = false) {
    checkSize(text);
    if (!text.trim()) throw new Error("Vui lòng nhập JSON cần định dạng.");
    const spacing = indent === "tab" ? "\t" : Number(indent);
    return JSON.stringify(JSON.parse(text), null, minify ? 0 : spacing);
  }

  const SQL_KEYWORDS = new Set((
    "select from where group by order having limit offset fetch first next rows row only " +
    "insert into values update set delete returning with recursive as distinct on all " +
    "join left right full outer inner cross natural lateral using union intersect except " +
    "and or not null true false is in exists between like ilike similar escape asc desc " +
    "nulls last case when then else end over partition window filter within " +
    "create replace function procedure table view materialized index unique if drop alter " +
    "add column constraint primary key references default check begin commit rollback " +
    "do language plpgsql sql declare conflict nothing cascade restrict truncate " +
    "for of nowait skip locked share no key update grant revoke to coalesce cast " +
    "current_date current_time current_timestamp interval at time zone explain analyze " +
    "verbose costs buffers format vacuum analyze"
  ).split(/\s+/));

  function tokenizeSQL(text) {
    const tokens = [];
    let i = 0;
    let newlineBefore = false;
    function push(type, start) {
      tokens.push({ type, value: text.slice(start, i), newlineBefore });
      newlineBefore = false;
      if (tokens.length > 20000) throw new Error("SQL quá phức tạp. Giới hạn là 20.000 token.");
    }
    while (i < text.length) {
      const start = i;
      const rest = text.slice(i);
      const whitespace = rest.match(/^\s+/u);
      if (whitespace) {
        newlineBefore ||= /[\r\n]/.test(whitespace[0]);
        i += whitespace[0].length;
        continue;
      }
      if (rest.startsWith("--")) {
        while (i < text.length && !/[\r\n]/.test(text[i])) i++;
        push("line-comment", start);
        continue;
      }
      if (rest.startsWith("/*")) {
        let nesting = 1;
        i += 2;
        while (i < text.length && nesting) {
          if (text.startsWith("/*", i)) { nesting++; i += 2; }
          else if (text.startsWith("*/", i)) { nesting--; i += 2; }
          else i++;
        }
        if (nesting) throw new Error("Comment SQL chưa đóng (thiếu */).");
        push("block-comment", start);
        continue;
      }
      const quoted = rest.match(/^(?:[eEbBxXnN]|[uU]&)?'/) || rest.match(/^(?:[uU]&)?"/);
      if (quoted) {
        const quote = quoted[0].at(-1);
        const backslashEscapes = /^[eE]'/.test(quoted[0]);
        i += quoted[0].length;
        let closed = false;
        while (i < text.length) {
          if (backslashEscapes && text[i] === "\\") { i += 2; continue; }
          if (text[i] === quote) {
            if (text[i + 1] === quote) { i += 2; continue; }
            i++;
            closed = true;
            break;
          }
          i++;
        }
        if (!closed) throw new Error("Chuỗi hoặc tên trích dẫn trong SQL chưa đóng.");
        push(quote === "'" ? "string" : "identifier", start);
        continue;
      }
      const dollar = rest.match(/^\$(?:[\p{L}_][\p{L}\p{N}_]*)?\$/u);
      if (dollar) {
        const end = text.indexOf(dollar[0], i + dollar[0].length);
        if (end < 0) throw new Error(`Chuỗi dollar-quoted chưa đóng: ${dollar[0]}`);
        i = end + dollar[0].length;
        push("string", start);
        continue;
      }
      const parameter = rest.match(/^\$\d+/);
      const number = rest.match(/^(?:0[xX][0-9a-fA-F](?:_?[0-9a-fA-F])*|0[oO][0-7](?:_?[0-7])*|0[bB][01](?:_?[01])*|(?:\d(?:_?\d)*(?:\.(?:\d(?:_?\d)*)?)?|\.\d(?:_?\d)*)(?:[eE][+-]?\d(?:_?\d)*)?)/);
      const word = rest.match(/^[\p{L}_][\p{L}\p{M}\p{N}_$]*/u);
      if (parameter || number || word) {
        const match = parameter || number || word;
        i += match[0].length;
        push(word ? "word" : "number", start);
        continue;
      }
      if (rest.startsWith("::") || rest.startsWith(":=")) {
        i += 2;
        push("operator", start);
        continue;
      }
      const operator = rest.match(/^[+\-*/<>=~!@#%^&|`?:]+/);
      if (operator) {
        let value = operator[0];
        const commentStart = value.slice(1).search(/--|\/\*/);
        if (commentStart >= 0) value = value.slice(0, commentStart + 1);
        i += value.length;
        push("operator", start);
        continue;
      }
      i++;
      push("punctuation", start);
    }
    return tokens;
  }

  const SQL_CLAUSES = [
    "LEFT OUTER JOIN", "RIGHT OUTER JOIN", "FULL OUTER JOIN", "GROUP BY", "ORDER BY",
    "INSERT INTO", "DELETE FROM", "UNION ALL", "LEFT JOIN", "RIGHT JOIN", "FULL JOIN",
    "INNER JOIN", "CROSS JOIN", "NATURAL JOIN", "ON CONFLICT", "DO UPDATE", "DO NOTHING",
    "SELECT", "FROM", "WHERE", "HAVING", "LIMIT", "OFFSET", "FETCH", "RETURNING",
    "VALUES", "SET", "UPDATE", "WITH", "JOIN", "UNION", "INTERSECT", "EXCEPT", "WINDOW"
  ].map(clause => clause.split(" "));
  const LIST_CLAUSES = new Set(["SELECT", "SET", "RETURNING", "GROUP BY", "ORDER BY", "WITH", "VALUES"]);

  function formatSQL(text, indent = "2", uppercase = true) {
    checkSize(text, 100000);
    if (!text.trim()) throw new Error("Vui lòng nhập SQL cần định dạng.");
    const tokens = tokenizeSQL(text);
    const unit = indent === "tab" ? "\t" : " ".repeat(Number(indent));
    const lines = [];
    let line = "";
    let level = 0;
    const contexts = [{ query: true, clause: "", between: false, base: 0 }];
    const opens = [];
    let previous = null;

    function flush() {
      if (line.trim()) lines.push(line.trimEnd());
      line = "";
    }
    function append(value, tight = false) {
      if (!line) line = unit.repeat(level) + value;
      else line += (tight || /[.([]$/.test(line) ? "" : " ") + value;
    }
    function display(token) {
      return uppercase && token.type === "word" && SQL_KEYWORDS.has(token.value.toLowerCase())
        ? token.value.toUpperCase() : token.value;
    }
    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];
      const value = token.value;
      const context = contexts.at(-1);
      const upper = token.type === "word" ? value.toUpperCase() : "";
      if (token.type === "line-comment" || token.type === "block-comment") {
        if (token.newlineBefore) flush();
        append(value);
        flush();
        previous = token;
        continue;
      }
      if (token.type === "string" && token.newlineBefore && previous?.type === "string") flush();
      if (value === "(" || value === "[") {
        if (opens.length >= 100) throw new Error("SQL lồng nhau quá sâu. Giới hạn là 100 cấp ngoặc.");
        const next = tokens.slice(i + 1).find(item => !item.type.endsWith("comment"));
        const query = value === "(" && next?.type === "word" && /^(SELECT|WITH)$/i.test(next.value);
        const isCall = value === "(" && previous?.type === "word" &&
          (!SQL_KEYWORDS.has(previous.value.toLowerCase()) || /^(coalesce|cast|filter|over)$/i.test(previous.value));
        append(value, isCall || value === "[" || previous?.value === "::");
        opens.push(value);
        contexts.push({ query, clause: "", between: false, base: level + 1, parentLevel: level });
        if (query) { flush(); level++; }
      } else if (value === ")" || value === "]") {
        const expected = value === ")" ? "(" : "[";
        if (opens.pop() !== expected) throw new Error("Dấu ngoặc trong SQL không cân bằng.");
        const closed = contexts.pop();
        if (closed.query) flush();
        level = closed.parentLevel;
        append(value, true);
      } else if (value === ";") {
        append(value, true);
        flush();
        if (contexts.length === 1) { context.clause = ""; context.between = false; level = 0; }
      } else if (value === ",") {
        append(value, true);
        if (context.query && LIST_CLAUSES.has(context.clause)) flush();
      } else if (value === ".") {
        append(value, true);
      } else {
        const clause = context.query && token.type === "word"
          ? SQL_CLAUSES.find(words => words.every((word, offset) =>
            tokens[i + offset]?.type === "word" && tokens[i + offset].value.toUpperCase() === word))
          : null;
        if (clause) {
          flush();
          level = context.base;
          const name = clause.join(" ");
          context.clause = name;
          context.between = false;
          append(tokens.slice(i, i + clause.length).map(display).join(" "));
          i += clause.length - 1;
          if (LIST_CLAUSES.has(name)) { flush(); level = context.base + 1; }
          else level = context.base + 1;
        } else {
          if (upper === "BETWEEN") context.between = true;
          if (upper === "AND" && context.between) context.between = false;
          else if (context.query && /^(AND|OR|ON)$/.test(upper) &&
            /^(WHERE|HAVING|.*JOIN|FROM)$/.test(context.clause)) {
            flush();
            level = context.base + 1;
          }
          append(display(token), value === "::" || previous?.value === "::");
        }
      }
      previous = tokens[i];
    }
    if (opens.length) throw new Error("Dấu ngoặc trong SQL không cân bằng.");
    flush();
    return lines.join("\n");
  }

  function convertCase(text, mode) {
    checkSize(text);
    if (!["snake", "camel", "pascal"].includes(mode)) throw new Error("Kiểu chuyển đổi không hợp lệ.");
    const capitalize = word => {
      const [first, ...rest] = [...word];
      return first.toUpperCase() + rest.join("");
    };
    return text.normalize("NFC").split(/\r\n|\r|\n/).map(line => {
      const separated = line
        .replace(/(\p{Lu})(\p{Lu}\p{Ll})/gu, "$1 $2")
        .replace(/([\p{Ll}\p{N}])(\p{Lu})/gu, "$1 $2");
      const words = (separated.match(/[\p{L}\p{N}][\p{L}\p{M}\p{N}]*/gu) || []).map(word => word.toLowerCase());
      if (mode === "snake") return words.join("_");
      return words.map((word, index) => mode === "camel" && index === 0 ? word : capitalize(word)).join("");
    }).join("\n");
  }

  function compareTexts(before, after, ignoreWhitespace = false) {
    checkSize(before, 200000);
    checkSize(after, 200000);
    const split = text => text === "" ? [] : text.replace(/\r\n?/g, "\n").split("\n");
    const a = split(before);
    const b = split(after);
    if (a.length > 5000 || b.length > 5000) throw new Error("Mỗi văn bản được tối đa 5.000 dòng.");
    const normalize = line => ignoreWhitespace ? line.trim() : line;
    const ak = a.map(normalize);
    const bk = b.map(normalize);
    let prefix = 0;
    while (prefix < a.length && prefix < b.length && ak[prefix] === bk[prefix]) prefix++;
    let suffix = 0;
    while (suffix < a.length - prefix && suffix < b.length - prefix &&
      ak[a.length - suffix - 1] === bk[b.length - suffix - 1]) suffix++;
    const n = a.length - prefix - suffix;
    const m = b.length - prefix - suffix;
    if (n * m > 4000000) throw new Error("Có quá nhiều dòng khác biệt để so sánh. Hãy chia văn bản thành các đoạn nhỏ hơn.");
    const width = m + 1;
    const matrix = new Uint16Array((n + 1) * width);
    for (let i = n - 1; i >= 0; i--) {
      for (let j = m - 1; j >= 0; j--) {
        matrix[i * width + j] = ak[i + prefix] === bk[j + prefix]
          ? matrix[(i + 1) * width + j + 1] + 1
          : Math.max(matrix[(i + 1) * width + j], matrix[i * width + j + 1]);
      }
    }
    const result = a.slice(0, prefix).map(text => ({ type: "same", text }));
    let i = 0;
    let j = 0;
    while (i < n || j < m) {
      if (i < n && j < m && ak[i + prefix] === bk[j + prefix]) {
        result.push({ type: "same", text: a[i++ + prefix] });
        j++;
      } else if (i < n && (j === m || matrix[(i + 1) * width + j] >= matrix[i * width + j + 1])) {
        result.push({ type: "removed", text: a[i++ + prefix] });
      } else result.push({ type: "added", text: b[j++ + prefix] });
    }
    result.push(...a.slice(a.length - suffix).map(text => ({ type: "same", text })));
    return result;
  }

  const HTML_ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: "\u00a0" };
  const HTML_ESCAPE = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

  function transformEscape(text, mode, unescape = false) {
    checkSize(text);
    if (mode === "json") {
      return unescape ? JSON.parse(`"${text}"`) : JSON.stringify(text).slice(1, -1);
    }
    if (mode === "url") return unescape ? decodeURIComponent(text) : encodeURIComponent(text);
    if (mode !== "html") throw new Error("Kiểu escape không hợp lệ.");
    if (!unescape) return text.replace(/[&<>"']/g, char => HTML_ESCAPE[char]);
    return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z][a-z0-9]*);/gi, (entity, name) => {
      if (name[0] !== "#") {
        if (!Object.hasOwn(HTML_ENTITIES, name)) throw new Error(`Chưa hỗ trợ HTML entity ${entity}. Dùng mã số Unicode thay thế.`);
        return HTML_ENTITIES[name];
      }
      const code = /^#x/i.test(name) ? parseInt(name.slice(2), 16) : Number(name.slice(1));
      if (code > 0x10ffff || (code >= 0xd800 && code <= 0xdfff) || code === 0) {
        throw new Error(`Mã Unicode không hợp lệ: ${entity}`);
      }
      return String.fromCodePoint(code);
    });
  }

  const api = { formatJSON, tokenizeSQL, formatSQL, convertCase, compareTexts, transformEscape };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.DevToys = Object.freeze(api);
})(globalThis);
