// s = { totalArea, bestStreak, placesCreated, reviews, cafeReviews, friends, night }
export const BADGES = [
  { id: 'area_1k', icon: '👣', name: 'Bước chân đầu tiên', desc: 'Mở 1.000 m²', test: s => s.totalArea >= 1000 },
  { id: 'area_1ha', icon: '🧭', name: 'Nhà thám hiểm', desc: 'Mở 1 ha (10.000 m²)', test: s => s.totalArea >= 1e4 },
  { id: 'area_10ha', icon: '🗺️', name: 'Người vẽ bản đồ', desc: 'Mở 10 ha', test: s => s.totalArea >= 1e5 },
  { id: 'area_1km2', icon: '🏆', name: 'Chúa tể 1 km²', desc: 'Mở 1 km²', test: s => s.totalArea >= 1e6 },
  { id: 'streak_3', icon: '🔥', name: 'Khởi động', desc: 'Chuỗi 3 ngày liên tiếp', test: s => s.bestStreak >= 3 },
  { id: 'streak_7', icon: '⚡', name: 'Kiên trì', desc: 'Chuỗi 7 ngày liên tiếp', test: s => s.bestStreak >= 7 },
  { id: 'streak_30', icon: '💎', name: 'Huyền thoại', desc: 'Chuỗi 30 ngày liên tiếp', test: s => s.bestStreak >= 30 },
  { id: 'pioneer', icon: '🚩', name: 'Người tiên phong', desc: 'Tạo điểm mới đầu tiên', test: s => s.placesCreated >= 1 },
  { id: 'critic', icon: '✍️', name: 'Nhà phê bình', desc: 'Viết 5 nhận xét', test: s => s.reviews >= 5 },
  { id: 'coffee', icon: '☕', name: 'Tín đồ cà phê', desc: 'Nhận xét 10 quán cà phê', test: s => s.cafeReviews >= 10 },
  { id: 'night', icon: '🌙', name: 'Cú đêm', desc: 'Khám phá trong khoảng 22h–4h', test: s => s.night },
  { id: 'social', icon: '🤝', name: 'Kết nối', desc: 'Kết bạn đầu tiên', test: s => s.friends >= 1 },
];

export const CATEGORIES = {
  cafe: { icon: '☕', name: 'Cà phê' },
  restaurant: { icon: '🍜', name: 'Quán ăn' },
  fast_food: { icon: '🍔', name: 'Đồ ăn nhanh' },
  bar: { icon: '🍺', name: 'Bar / Pub' },
  pub: { icon: '🍺', name: 'Bar / Pub' },
  park: { icon: '🌳', name: 'Công viên' },
  museum: { icon: '🏛️', name: 'Bảo tàng' },
  attraction: { icon: '📸', name: 'Điểm tham quan' },
  viewpoint: { icon: '🌅', name: 'Ngắm cảnh' },
  place_of_worship: { icon: '⛩️', name: 'Đền, chùa' },
  shop: { icon: '🛍️', name: 'Cửa hàng' },
  hidden_gem: { icon: '💎', name: 'Góc bí mật' },
  other: { icon: '📍', name: 'Khác' },
};
export const catOf = c => CATEGORIES[c] || CATEGORIES.other;
