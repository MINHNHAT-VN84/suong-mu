# Sương Mù - bản đồ khám phá

Web app chạy trên điện thoại (PWA, cài được ra màn hình chính). Bản đồ bị phủ sương; bạn đi tới đâu, sương mở ra trong bán kính 20 m tới đó.

## Có gì trong bản này

| Tính năng | Ghi chú |
|---|---|
| Sương mù 20 m | Lưới ô 5×5 m. Mỗi ô đã đi qua được lưu lại, tính ra diện tích thật (m², ha, km²). |
| Chống gian lận | Đi nhanh hơn 30 km/h (xe máy, ô tô) không mở sương. Bỏ qua GPS sai số lớn hơn 40 m và các cú "nhảy" vị trí bất thường. |
| Địa điểm | Quán xá, công viên, bảo tàng lấy từ OpenStreetMap, chỉ hiện khi khu vực đó đã mở sương. |
| Nhận xét | Chấm 1–5 sao và viết cảm nhận. Chỉ được nhận xét nơi mình đã khám phá. |
| Tạo điểm mới | Tạo đúng tại chỗ bạn đứng. Mỗi lần tốn 1 lượt, người mới có 3 lượt. |
| Xem video để thêm lượt | Phải xem hết video, không tua được, chuyển tab là video dừng. Được +1 lượt, tối đa 5 lần/ngày. |
| Bạn bè, bảng xếp hạng | Kết bạn bằng mã 6 ký tự. Xếp hạng theo tuần (reset 0h thứ Hai, giờ Việt Nam), tháng và mọi lúc. |
| Huy hiệu | 12 huy hiệu: diện tích, chuỗi ngày, Người tiên phong, Nhà phê bình, Tín đồ cà phê, Cú đêm, Kết nối. |
| Chuỗi ngày | Ngày nào cũng mở ít nhất 1 ô sương thì chuỗi tăng. |
| Trang quản trị (`admin.html`) | Soạn và gửi thông báo đẩy tới tất cả người chơi hoặc theo khu vực (chọn tâm trên bản đồ và bán kính km). |

## Chạy thử ngay (chế độ demo)

Khi `js/config.js` để trống `SUPABASE_URL` (hoặc mở link có thêm `?demo` ở cuối), app chạy ở **chế độ demo**: dữ liệu lưu trên máy, có sẵn vài người bạn giả để xem bảng xếp hạng.

- Chạm vào bản đồ để "đi bộ" tới đó và xem sương mở ra.
- Bấm nút 🚶 để đổi sang 🚗 (60 km/h) và thấy sương **không** mở.
- Thử kết bạn với mã `TUAN88`.

Chạy trên máy tính: mở terminal trong thư mục này, gõ `python3 -m http.server 8000`, rồi mở `http://localhost:8000`.

## Đưa lên mạng thật (khoảng 30 phút)

Bạn cần tạo 2 tài khoản miễn phí:

1. **Supabase** (supabase.com): lưu tài khoản người chơi, ô đã khám phá, địa điểm, nhận xét, bảng xếp hạng và gửi thông báo.
2. **Nơi đăng web**: GitHub Pages, Netlify hoặc Vercel (đều miễn phí). Bắt buộc có HTTPS thì GPS và thông báo mới chạy.

### Bước 1: Supabase
1. Tạo project mới, chọn vùng Singapore cho nhanh.
2. Vào **SQL Editor**, dán toàn bộ `supabase/schema.sql` và bấm Run.
3. Vào **Authentication > URL Configuration**, điền địa chỉ web của bạn vào *Site URL* và *Redirect URLs*.
4. Vào **Project Settings > API**, chép *Project URL* và *anon public key* vào `js/config.js`.

### Bước 2: Thông báo đẩy
1. Tạo khoá VAPID: `npx web-push generate-vapid-keys`
2. Dán *Public Key* vào `VAPID_PUBLIC_KEY` trong `js/config.js`.
3. Cài Supabase CLI rồi chạy:
   ```
   supabase login
   supabase link --project-ref <mã-project>
   supabase secrets set VAPID_PUBLIC_KEY=... VAPID_PRIVATE_KEY=... VAPID_SUBJECT=mailto:email-cua-ban@gmail.com
   supabase functions deploy send-push
   ```

### Bước 3: Đăng web
Đưa cả thư mục lên GitHub Pages / Netlify / Vercel. Không cần build.

### Bước 4: Cấp quyền quản trị cho mình
Vào app một lần với tên của bạn, rồi chạy trong SQL Editor (thay đúng tên bạn đã nhập):
```sql
update public.profiles set is_admin = true where display_name = 'Tên của bạn';
```
Sau đó trong tab **Tôi** sẽ có nút **Trang quản trị**.

## Lưu ý
- **iPhone**: chỉ nhận thông báo khi người dùng mở bằng Safari, bấm Chia sẻ → *Thêm vào Màn hình chính*, rồi mở app từ màn hình chính (iOS 16.4 trở lên).
- **GPS khi tắt màn hình**: web app không ghi được vị trí khi điện thoại khoá màn hình. Muốn đi bộ mà để điện thoại trong túi vẫn mở sương thì cần làm app native (React Native / Flutter). Đây là bước tiếp theo nên làm nếu app có nhiều người chơi.
- **Video quảng cáo có thưởng**: bản này dùng video của bạn (`REWARD_VIDEO_URL`). Quảng cáo AdMob có thưởng chỉ chạy trong app native; bản web có thể dùng Google Ad Manager (rewarded ads cho web).
- **Bản đồ nền**: đang dùng CARTO Voyager miễn phí, đủ cho thử nghiệm. Khi có nhiều người dùng nên chuyển sang MapTiler hoặc Stadia Maps (có gói miễn phí, cần API key). Chỉ cần đổi `TILE_URL` trong `js/config.js`.
- **Chống gian lận**: lọc tốc độ đang làm ở máy người chơi; máy chủ kiểm tra lượt tạo điểm, video và quyền nhận xét. Muốn chặt hơn có thể chuyển phần lọc tốc độ lên máy chủ.

## Cấu trúc thư mục
```
index.html, styles.css      Giao diện chính
admin.html                  Trang gửi thông báo
js/config.js                Cấu hình (Supabase, VAPID, video, bán kính, tốc độ)
js/app.js                   Logic app: GPS, sương, địa điểm, xếp hạng, huy hiệu
js/fog.js                   Vẽ lớp sương
js/geo.js                   Lưới ô 5 m, tính diện tích
js/store.js                 Lưu dữ liệu (demo trên máy / Supabase)
js/badges.js                Danh sách huy hiệu, loại địa điểm
sw.js, manifest.webmanifest PWA: cài app, offline, nhận thông báo
supabase/schema.sql         Database + bảo mật
supabase/functions/send-push  Hàm gửi thông báo
```
