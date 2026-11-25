// Cấu hình app. Để trống SUPABASE_URL thì app chạy ở CHẾ ĐỘ DEMO (dữ liệu lưu trên máy, có bạn bè giả).
export const CONFIG = {
  SUPABASE_URL: 'https://zcqpwolxmdijlpejipsc.supabase.co',        // ví dụ: 'https://abcd1234.supabase.co'
  SUPABASE_ANON_KEY: 'sb_publishable_1-WVPuuor9rQrjjMB6ggfg_LLADEyQn',   // Project Settings > API > anon public key
  // Địa chỉ app trên mạng: link đăng nhập trong email sẽ mở về đây
  APP_URL: 'https://minhnhat-vn84.github.io/suong-mu/',
  VAPID_PUBLIC_KEY: '',      // khoá công khai Web Push (xem README)

  // Video phải xem hết mới được thêm lượt tạo điểm. Thay bằng video của bạn.
  REWARD_VIDEO_URL: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4',

  REVEAL_RADIUS_M: 20,       // bán kính mở sương quanh người chơi
  MAX_SPEED_KMH: 30,         // đi nhanh hơn mức này (xe máy, ô tô) sẽ không mở sương
  MAX_ACCURACY_M: 40,        // GPS sai số lớn hơn mức này thì bỏ qua
  MAX_VIDEO_REWARDS_PER_DAY: 5,

  DEFAULT_CENTER: [21.0287, 105.8524], // Hồ Gươm, dùng khi chưa có GPS ở chế độ demo
  TILE_URL: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  TILE_ATTRIBUTION: '&copy; OpenStreetMap contributors',
};
