# DevToys

Bộ công cụ cho lập trình viên, viết bằng **HTML, CSS và JavaScript thuần**.
Không framework, không thư viện bên ngoài, không CDN, không bước build, không backend.
Giao diện tiếng Việt, responsive, có chế độ sáng/tối.

## Chạy ứng dụng

Mở trực tiếp [index.html](./index.html) bằng trình duyệt hiện đại.
Các công cụ hoạt động offline, không cần cài đặt dependency.

Để dùng Clipboard API ổn định hơn, nên chạy qua localhost. Ví dụ nếu đã cài Python 3:

```sh
cd /duong-dan/den/devtoys
python3 -m http.server 8080 --bind 127.0.0.1
```

Truy cập `http://127.0.0.1:8080`. Dừng server bằng `Ctrl+C`.
Đây chỉ là server phục vụ file tĩnh, không nhận dữ liệu người dùng.
Triển khai bằng cách đưa các file HTML/CSS/JS và tài liệu này lên bất kỳ static host nào.

## Các chức năng

### 1. JSON Formatter

- Dán JSON vào ô **Đầu vào** rồi nhấn **Format JSON**.
- Chọn thụt lề 2 spaces, 4 spaces hoặc Tab.
- **Minify** loại bỏ khoảng trắng không cần thiết.
- Hiển thị lỗi cho JSON sai cú pháp; không giữ lại kết quả cũ khi đầu vào thay đổi hoặc xử lý lỗi.
- Hỗ trợ object, array và giá trị JSON độc lập như `null`, `true`, số, chuỗi.
- Nút **Dùng ví dụ**, **Xóa** và **Sao chép** hỗ trợ thao tác nhanh.

Sử dụng `JSON.parse` và `JSON.stringify` tiêu chuẩn của JavaScript:
không hỗ trợ comment, dấu phẩy thừa hoặc JSON5. Khóa trùng bị gộp theo hành vi
`JSON.parse`; khóa dạng số có thể đổi thứ tự. Số lớn/vượt độ chính xác của
JavaScript có thể bị làm tròn (số nguyên chính xác đến `2^53 - 1`); không dùng công cụ
để bảo toàn nguyên văn số có độ chính xác cao. Nên biểu diễn ID lớn bằng chuỗi.

### 2. SQL Formatter — PostgreSQL

- Nhập truy vấn và nhấn **Format SQL**.
- Chọn thụt lề và bật/tắt **IN HOA từ khóa**. Khi tắt, giữ cách viết từ khóa đầu vào.
- Xuống dòng cho `SELECT`, `FROM`, `WHERE`, `JOIN`, `GROUP BY`, `ORDER BY`,
  CTE, `RETURNING`, `INSERT`, `UPDATE`, v.v.
- Giữ nguyên nội dung chuỗi `'...'`, chuỗi escape `E'...'`, tên `"QuotedName"`,
  chuỗi Unicode `U&'...'`, dollar-quoted `$$...$$` / `$tag$...$tag$`,
  tham số `$1`, comment `--` và block comment lồng nhau `/* ... */`.
- Giữ các toán tử PostgreSQL như `::`, `->>`, `#>>`, `@>` và literal số.
- Báo lỗi khi chuỗi/comment chưa đóng hoặc ngoặc không cân bằng.

**Giới hạn:** đây là formatter theo token, không phải parser PostgreSQL đầy đủ.
Không xác nhận tính hợp lệ/ngữ nghĩa, không kết nối database, không chạy SQL.
Phần thân dollar-quoted của function/procedure được giữ nguyên, không format bên trong.
Giả định chuỗi thường dùng `standard_conforming_strings = on`; dùng `E'...'`
khi cần escape bằng dấu `\`. Không hỗ trợ lệnh meta của `psql` và nội dung
`COPY ... FROM STDIN`. Các cấu trúc SQL đặc biệt có thể chưa có bố cục tối ưu;
kiểm tra truy vấn trước khi sử dụng trong môi trường thật.

### 3. Text Comparer

- Nhập **Văn bản gốc** và **Văn bản mới**, nhấn **So sánh văn bản**.
- So sánh theo dòng bằng longest common subsequence (LCS).
- Dòng thêm: màu xanh và dấu `+`; dòng xóa: màu đỏ và dấu `−`.
- Bảng có số dòng cũ/mới và tổng số dòng thêm/xóa.
- Một dòng sửa được biểu diễn thành một dòng xóa và một dòng thêm.
- Tùy chọn bỏ qua khoảng trắng **đầu/cuối mỗi dòng**, không bỏ qua khoảng trắng ở giữa.
- Chuẩn hóa CRLF/CR thành LF trước khi so sánh; phân biệt dấu xuống dòng cuối văn bản.
- Khi bật bỏ qua khoảng trắng, dòng không đổi hiển thị nội dung từ văn bản gốc.
- Có thể so sánh với văn bản rỗng; không so sánh ở cấp ký tự/từ.

### 4. Convert Text

Trang có **một textbox** và ba nút:

| Nút | Ví dụ đầu vào | Kết quả ngay trong textbox |
| --- | --- | --- |
| snake_case | `hello wonderful world` | `hello_wonderful_world` |
| camelCase | `hello wonderful world` | `helloWonderfulWorld` |
| PascalCase | `hello wonderful world` | `HelloWonderfulWorld` |

- Nhận diện từ dựa trên khoảng trắng, dấu câu, dấu gạch dưới/gạch ngang và ranh giới chữ hoa.
- Nhận diện từ viết tắt: `getHTTPResponse` → `get_http_response`.
- Hỗ trợ Unicode/chữ có dấu: `người dùng mới` → `ngườiDùngMới`.
- Chuẩn hóa Unicode NFC; giữ dòng trống và chuyển đổi từng dòng riêng biệt.
- Dấu câu, emoji và các ký tự không phải chữ/số được xem là dấu phân cách và bị bỏ.
- Kết quả là chuyển đổi văn bản, không bảo đảm là identifier hợp lệ trong mọi ngôn ngữ.
- **Hoàn tác** tối đa 20 lần chuyển đổi. Gõ/sửa thủ công, xóa hoặc tải ví dụ sẽ xóa lịch sử này.

### 5. Text Escape / Unescape

Chọn chế độ, nhập văn bản rồi nhấn **Escape** hoặc **Unescape**.
Nút **Dùng kết quả làm đầu vào** giúp chuyển đổi ngược nhanh.

| Chế độ | Quy ước |
| --- | --- |
| JSON string | Escape nội dung chuỗi bằng quy tắc JSON, **không thêm** dấu `"` bao ngoài. Unescape cũng nhận nội dung **không có** cặp dấu `"` bao ngoài. |
| HTML entities | Escape `&`, `<`, `>`, `"`, `'`. Unescape hỗ trợ `amp`, `lt`, `gt`, `quot`, `apos`, `nbsp` và mã số thập phân/hexadecimal như `&#39;`, `&#x1F600;`. |
| URL component | Dùng `encodeURIComponent` / `decodeURIComponent` cho một thành phần URL, không phải toàn bộ URL. |

Ví dụ JSON string: văn bản chứa xuống dòng thực được escape thành `\n`;
`a"b` thành `a\"b`. Chuỗi escape sai cú pháp hoặc URL encoding sai được báo lỗi.

HTML chỉ giải mã **một lớp**, yêu cầu entity có dấu `;`, phân biệt hoa/thường
ở tên entity. Tên entity không được hỗ trợ và mã Unicode không hợp lệ được báo lỗi;
chuỗi không khớp dạng entity được giữ nguyên. Đây không phải HTML sanitizer.
Kết quả luôn là văn bản, không được render/thực thi thành HTML.
URL unescape **không** đổi `+` thành dấu cách (khác quy tắc form-urlencoded).

## Thao tác chung

- Điều hướng bằng thanh công cụ bên trái; trên màn hình nhỏ có thể cuộn ngang danh sách.
- URL hash `#json`, `#sql`, `#compare`, `#convert`, `#escape` mở trực tiếp từng công cụ.
- `Ctrl+Enter` / `Cmd+Enter`: format JSON/SQL, chạy so sánh, hoặc escape tùy trang hiện tại.
- Các textarea hiển thị số ký tự và số dòng; ký tự được đếm theo UTF-16 của JavaScript.
- Đổi giao diện bằng nút mặt trời ở góc trên bên phải.
- Chuyển công cụ vẫn giữ dữ liệu trong tab hiện tại. Reload/đóng trang xóa dữ liệu và lựa chọn giao diện.
- Tải ví dụ khi đã có nội dung sẽ hỏi xác nhận để tránh ghi đè vô ý.
- Clipboard có thể cần quyền trình duyệt và secure context (HTTPS/localhost).
  Nếu bị chặn, ứng dụng báo lỗi và chọn nội dung để sao chép thủ công bằng `Ctrl/Cmd+C`.
- Không lưu đầu vào, kết quả hoặc lịch sử vào localStorage, cookie hay dịch vụ bên ngoài.
  Sao chép là hành động chủ động của người dùng và đưa nội dung vào clipboard hệ điều hành.

## Giới hạn xử lý

Nhằm tránh treo tab, các chức năng có giới hạn rõ ràng:

| Công cụ | Giới hạn |
| --- | --- |
| JSON, Convert Text, Escape/Unescape | 1.000.000 đơn vị mã UTF-16 cho đầu vào |
| SQL | 100.000 đơn vị mã UTF-16, 20.000 token, 100 cấp ngoặc |
| Text Comparer | 200.000 đơn vị mã UTF-16 và 5.000 dòng cho mỗi văn bản |
| Ma trận so sánh | Tối đa 4.000.000 cặp dòng sau khi loại tiền tố/hậu tố giống nhau |

Nếu vượt giới hạn, ứng dụng thông báo lỗi để người dùng chia nhỏ dữ liệu.
Xử lý đồng bộ trên main thread; dữ liệu lớn gần giới hạn có thể gây chậm tạm thời.

## Cấu trúc mã nguồn

```text
devtoys/
├── index.html            # Giao diện, các panel và SVG icon nội bộ
├── styles.css            # Responsive layout, dark/light theme
├── utils.js              # Logic thuần của năm công cụ
├── app.js                # Sự kiện UI, điều hướng, clipboard, feedback
├── tests/
│   └── utils.test.cjs    # Kiểm thử bằng Node.js test runner tích hợp
└── README.md             # Tài liệu này
```

Không có yêu cầu Node.js để **chạy ứng dụng**. Chỉ cần Node.js 18+ nếu muốn chạy
bộ kiểm thử logic mà không cài thêm package:

```sh
node --test tests/utils.test.cjs
node --check utils.js
node --check app.js
```

Kiểm thử bao gồm định dạng/rút gọn JSON, token SQL và tính ổn định khi format lặp,
Unicode/case conversion, diff/reconstruction, các ngưỡng giới hạn, escape round-trip
và dữ liệu lỗi. Để kiểm tra thủ công, dùng nút ví dụ trên mỗi công cụ, thử dữ liệu
sai, sao chép kết quả, thao tác bàn phím, giao diện sáng/tối và màn hình nhỏ.

## Trình duyệt

Dùng phiên bản Chrome, Edge, Firefox hoặc Safari hiện đại.
Mã sử dụng Unicode property escapes, `Array.prototype.at`, `Object.hasOwn`,
CSS custom properties và `color-mix()`. Không hỗ trợ Internet Explorer.
