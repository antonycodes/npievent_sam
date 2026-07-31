# Tổng hợp phiên làm việc — NPI Event Coordinator Dashboard

> Ngày: 2026-07-29
> Dự án: `npievent-main` (Vite + React + TypeScript + Tailwind, đồng bộ dữ liệu từ Lark Base)
> Chi tiết kỹ thuật đầy đủ (tên field, dòng code, lý do) đã được ghi trong `memory.md` của dự án — file này là bản tóm tắt dễ đọc cho người.

---

## 1. Chạy thử dự án (`npm install` / `npm run dev`)
- Máy không có sẵn Node.js/npm → cài bản portable Node v24 để chạy thử được.
- Gặp lỗi chữ ký code (code-signature) của binary native `@rollup/rollup-darwin-arm64` bị Gatekeeper chặn (do zip transfer/quarantine) → fix bằng cách xoá `node_modules`/`package-lock.json`, gỡ cờ quarantine, cài lại sạch.
- Kết quả: `npm run dev` chạy OK ở `localhost:5173`, `npx tsc -b --noEmit` sạch.

## 2. 2 khu vực chờ ngoài bàn: "Chờ check-in" và "Chờ điều phối"
- Hiện khách đã check-in (có STT) nhưng chưa từng vào bàn nào ("Chờ check-in"), và khách vừa xong 1 khâu, đang chờ điều phối sang khâu tiếp theo ("Chờ điều phối") — suy hoàn toàn từ dữ liệu Lark có sẵn (Check-in + 3 bảng DS), không cần thêm bảng/cột Lark mới.
- Bấm vào chấm STT mở popover riêng hiện đủ thông tin khách.

## 3. Bộ lọc nhanh "Chỉ hiện đã thu thiết bị"
- Thêm chip lọc dựa theo cột nghiệm thu thiết bị trong Check-in — chỉ tô sáng bàn có khách đã nghiệm thu, còn lại làm mờ (giống cơ chế 2 filter có sẵn).

## 4. Sửa 3 hiểu sai sau khi xem bản build đầu
- **STT khách**: phải lấy từ cột `STT` chính trong Check-in (số duy nhất, cấp 1 lần, theo suốt sự kiện), không phải "Phụ-STT" (cột helper cục bộ từng bàn/từng khâu) — bắt được 1 ca sai thực tế khi verify bằng dữ liệu Lark thật (1 khách hiện nhầm STT của người khác).
- **Dòng "Check thu máy cũ"**: thêm vào cả 3 popover (bàn / khách / khu chờ) — hiện đỏ khi "Đã nghiệm thu", xám khi "Chưa nghiệm thu".
- **Trạng thái động ở "Chờ điều phối"**: đổi từ text tĩnh giống nhau cho mọi khách, sang động theo khâu vừa hoàn tất — dạng `Đã hoàn tất "Khâu ..."`.
- **Bug tự phát hiện khi verify**: thêm dòng mới làm popover cao hơn → bị cắt bởi lớp che của board ở 1 số vị trí gần mép dưới → fix tận gốc bằng cách tách lớp che khuất (chỉ bọc phần hình ảnh tĩnh) ra khỏi lớp chứa popover, để popover không bao giờ bị ẩn nữa.

## 5. Sửa lỗi field "Check nghiệm thu" (formula, không phải checkbox)
- Cột thật là formula field bên Lark, trả về text dạng tag màu: `"✅ Đã nghiệm thu (n) máy"` / `"❌ Chưa nghiệm thu máy"` — không phải boolean thô như đoán ban đầu, và tên cột thật viết thường ("Check nghiệm thu", không phải "Check Nghiệm thu").
- Sửa lại cách đọc để nhận diện đúng theo emoji/từ khoá thay vì so khớp chuỗi chính xác — không còn bị lệch bởi phần "(n) máy" thay đổi theo số lượng.

## 6. Sửa bug "Số 1 đã nghiệm thu 1 máy nhưng hiển thị Chưa nghiệm thu"
- Nguyên nhân: trang Cài đặt Lark đã lưu sẵn (trong bộ nhớ trình duyệt) tên cột cũ sai case ("Check Nghiệm thu" — hoa) từ lần sửa trước — giá trị đã lưu luôn được ưu tiên hơn giá trị mặc định mới trong code, nên dù code đã sửa đúng, app vẫn đọc nhầm tên cột không tồn tại.
- Đã sửa lại cấu hình đã lưu trong bản preview, và xác nhận qua chính hàm xử lý dữ liệu thật của app (không đoán qua giao diện) rằng kết quả tính đúng.

## 7. Trạng thái động dùng đúng cột "Done in Flow" từ Check-in
- Thay vì tự suy đoán khâu vừa hoàn tất dựa theo cụm bàn, đọc trực tiếp cột `Done in Flow` — nguồn chính xác hơn vì đây là sự kiện chạy real-time, cách suy cũ có thể bị lệch. Đã chứng minh bằng 1 ca thật: cách suy cũ nói khách "vừa xong Thu cũ", còn "Done in Flow" thật nói đúng hơn là "Tư vấn" (khách đã tiến xa hơn từ lúc đó).
- Có xử lý phòng lỗi: giá trị `"Check in"` (mặc định của formula khi khách chưa xong khâu nào) không bị hiểu nhầm là tên khâu.

## 8. Zone "End Flow" — khách đã hoàn tất toàn bộ quy trình
- Ban đầu định làm bảng "Điều phối" riêng, nhưng cột "End flow" đã được đưa thẳng vào Check-in nên không cần thêm bảng/route proxy mới.
- Giá trị `"End flow"` = đã xong toàn bộ (tự động loại khỏi "Chờ điều phối", tránh 1 khách hiện ở 2 nơi cùng lúc); `"In flow"` = vẫn đang trong luồng.
- **Sau đó đổi sang dạng bảng**: không còn là 1 zone trên board nữa — có nút "End Flow (n)" ở khu Lọc nhanh, bấm mở modal liệt kê bảng đầy đủ thông tin khách (STT, tên, sản phẩm, ghi chú thanh toán, check thu máy cũ, khâu cuối).

## 9. Bố trí lại sơ đồ board
- "Chờ check-in" → chuyển sang vị trí "Vách phụ kiện" cũ (góc trên-phải), đổi nhãn thành "Đã check-in".
- "Chờ điều phối" → chuyển sang vị trí "Bàn demo 20 SP" cũ (khu vực lớn hơn hẳn, dễ nhìn hơn).
- 2 khu vực tĩnh cũ ("Vách phụ kiện", "Bàn demo 20 SP") đã được thay thế hoàn toàn bởi 2 zone chức năng này.

## 10. Tối ưu responsive cho Desktop 1920×1080 và iPad 11"–13"
- Test thật bằng cách đo toạ độ trực tiếp (không đoán qua ảnh chụp) ở 5 kích thước: desktop, iPad 11"/13" × ngang/dọc.
- **Bug tìm thấy**: hàng "chú thích màu" + "Lọc nhanh" bật chế độ nằm ngang ở ngưỡng 1024px, nhưng thực tế cần tới ~1246px mới đủ chỗ → mọi kích thước iPad test được (trừ 11" dọc) đều lọt vào khoảng giữa, khiến nội dung vỡ thành 2 hàng xen kẽ rất khó đọc.
- **Đã sửa**: đẩy ngưỡng chuyển hàng ngang lên 1536px (dư an toàn) — iPad giờ xếp dọc gọn gàng ở mọi hướng, desktop 1920 vẫn giữ nguyên 1 hàng như cũ.
- **Ghi nhận, chưa sửa**: một số nút/chấm bấm nhỏ hơn khuyến nghị 44×44pt của Apple cho thiết bị cảm ứng (nút bàn 36px, chấm STT khu chờ 20px, chấm khách dưới bàn 16px). Chưa tự ý tăng vì có rủi ro đè lên bàn hàng dưới ở board thu nhỏ (iPad dọc) — cần tính lại toạ độ cẩn thận, để tuỳ bạn quyết định có muốn làm tiếp không.

## 11. Xuất file zip dự án
- Đã xuất 2 lần trong phiên này (bản đầu và bản đầy đủ các tính năng/fix ở trên), loại `node_modules` và build cache, verify `tsc --noEmit` sạch trước khi đóng gói mỗi lần.

---

*Toàn bộ thay đổi đều đã qua `tsc --noEmit` và verify trực tiếp trên browser (mock data lẫn dữ liệu Lark thật khi có thể) trước khi báo hoàn thành.*
