// Lưới ô vuông 5 m trên hệ toạ độ Web Mercator. Mỗi ô đã đi qua = 1 ô "đã khám phá".
export const R = 6378137;
export const CELL = 5; // mét (mercator)
const D2R = Math.PI / 180;

export function toMerc(lat, lng) {
  return { x: R * lng * D2R, y: R * Math.log(Math.tan(Math.PI / 4 + (lat * D2R) / 2)) };
}
export function fromMerc(x, y) {
  return { lng: x / R / D2R, lat: (2 * Math.atan(Math.exp(y / R)) - Math.PI / 2) / D2R };
}
export const key = (cx, cy) => cx + ':' + cy;

export function cellOf(lat, lng) {
  const m = toMerc(lat, lng);
  return { cx: Math.floor(m.x / CELL), cy: Math.floor(m.y / CELL) };
}

// Các ô có tâm nằm trong bán kính radiusM (mét thực tế) quanh điểm.
export function cellsInRadius(lat, lng, radiusM) {
  const k = 1 / Math.cos(lat * D2R); // mercator phóng to theo vĩ độ
  const { x, y } = toMerc(lat, lng);
  const r = radiusM * k, r2 = r * r;
  const out = [];
  const x0 = Math.floor((x - r) / CELL), x1 = Math.floor((x + r) / CELL);
  const y0 = Math.floor((y - r) / CELL), y1 = Math.floor((y + r) / CELL);
  for (let cx = x0; cx <= x1; cx++) {
    for (let cy = y0; cy <= y1; cy++) {
      const dx = (cx + 0.5) * CELL - x, dy = (cy + 0.5) * CELL - y;
      if (dx * dx + dy * dy <= r2) out.push({ cx, cy });
    }
  }
  return out;
}

// Diện tích thật (m²) của một ô, phụ thuộc vĩ độ.
export function cellArea(cy) {
  const lat = fromMerc(0, (cy + 0.5) * CELL).lat;
  const s = CELL * Math.cos(lat * D2R);
  return s * s;
}

export function distance(a, b) {
  const dLat = (b.lat - a.lat) * D2R, dLng = (b.lng - a.lng) * D2R;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * D2R) * Math.cos(b.lat * D2R) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(h));
}

export function lerp(a, b, t) {
  return { lat: a.lat + (b.lat - a.lat) * t, lng: a.lng + (b.lng - a.lng) * t };
}

export function formatArea(m2) {
  if (m2 >= 1e6) return (m2 / 1e6).toFixed(2).replace('.', ',') + ' km²';
  if (m2 >= 1e4) return (m2 / 1e4).toFixed(2).replace('.', ',') + ' ha';
  return Math.round(m2).toLocaleString('vi-VN') + ' m²';
}

export function weekStart(d = new Date()) {
  const x = new Date(d); x.setHours(0, 0, 0, 0);
  const day = (x.getDay() + 6) % 7; // Thứ 2 = 0
  x.setDate(x.getDate() - day);
  return x.getTime();
}
export function monthStart(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth(), 1).getTime();
}
