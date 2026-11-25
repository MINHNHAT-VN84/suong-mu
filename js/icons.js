// Bộ icon 3D dễ thương (SVG nội tuyến, không cần tải thêm file).
let n = 0;
const uid = () => 'i' + (++n);

// gradient dọc 2 màu + bóng đổ mềm phía dưới
const grad = (id, a, b) => `<linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient>`;
const shadow = (cx = 32, cy = 58, rx = 18) => `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="3.5" fill="#000" opacity=".16"/>`;
const shine = (x, y, rx, ry, rot = -20) => `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" transform="rotate(${rot} ${x} ${y})" fill="#fff" opacity=".55"/>`;
const svg = (body, size) => `<svg class="ic" viewBox="0 0 64 64" width="${size}" height="${size}" aria-hidden="true">${body}</svg>`;

const DEF = {
  // bản đồ gấp
  map: () => { const a = uid(), b = uid(), c = uid(); return `<defs>${grad(a, '#7fe0a0', '#2fae63')}${grad(b, '#a6efbf', '#49c47c')}${grad(c, '#ffd36b', '#f59e0b')}</defs>${shadow()}
    <path d="M8 16l15-5 18 5 15-5v37l-15 5-18-5-15 5z" fill="url(#${a})"/>
    <path d="M23 11l18 5v37l-18-5z" fill="url(#${b})"/>
    <path d="M14 36c6-2 9 4 15 1s8-9 15-6" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round" stroke-dasharray="1 6"/>
    <path d="M44 14c-5 0-8 3.5-8 7.5 0 5.5 8 12.5 8 12.5s8-7 8-12.5c0-4-3-7.5-8-7.5z" fill="url(#${c})" stroke="#c2710c" stroke-width="1.2"/>
    <circle cx="44" cy="21.5" r="3" fill="#fff"/>${shine(18, 20, 5, 2.5)}`; },
  // la bàn
  compass: () => { const a = uid(), b = uid(); return `<defs>${grad(a, '#8ec5ff', '#2f6fe0')}${grad(b, '#ffffff', '#dfe8f7')}</defs>${shadow()}
    <circle cx="32" cy="31" r="24" fill="url(#${a})"/><circle cx="32" cy="31" r="18" fill="url(#${b})"/>
    <path d="M32 15l5 16h-10z" fill="#ff5d5d"/><path d="M32 47l-5-16h10z" fill="#9aa6bd"/>
    <circle cx="32" cy="31" r="3.2" fill="#fff" stroke="#5b6b88" stroke-width="1.5"/>${shine(22, 17, 7, 3.5)}`; },
  // cúp
  trophy: () => { const a = uid(), b = uid(); return `<defs>${grad(a, '#ffe27a', '#f0a20a')}${grad(b, '#b98cff', '#6d3ee0')}</defs>${shadow()}
    <path d="M16 14h-6c0 10 5 15 11 15M48 14h6c0 10-5 15-11 15" stroke="#f0a20a" stroke-width="4" fill="none" stroke-linecap="round"/>
    <path d="M16 9h32v12c0 11-7 18-16 18S16 32 16 21z" fill="url(#${a})"/>
    <rect x="28" y="38" width="8" height="8" fill="#e09000"/>
    <rect x="18" y="45" width="28" height="9" rx="3" fill="url(#${b})"/>
    <path d="M32 15l2.4 5 5.4.6-4 3.7 1.1 5.3-4.9-2.8-4.9 2.8 1.1-5.3-4-3.7 5.4-.6z" fill="#fff" opacity=".9"/>${shine(22, 15, 3, 6, 10)}`; },
  // huy chương
  medal: () => { const a = uid(), b = uid(), c = uid(); return `<defs>${grad(a, '#ff8a8a', '#e23b5a')}${grad(b, '#7ab8ff', '#2f6fe0')}${grad(c, '#ffe27a', '#f0a20a')}</defs>${shadow(32, 59, 14)}
    <path d="M18 4h11l7 20h-11z" fill="url(#${a})"/><path d="M46 4H35l-7 20h11z" fill="url(#${b})"/>
    <circle cx="32" cy="38" r="17" fill="url(#${c})"/><circle cx="32" cy="38" r="12" fill="none" stroke="#fff" stroke-width="2" opacity=".6"/>
    <path d="M32 30l2.6 5.3 5.8.8-4.2 4 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.2-4 5.8-.8z" fill="#fff"/>${shine(24, 30, 5, 3)}`; },
  // nhân vật chibi
  user: () => { const a = uid(), b = uid(), c = uid(); return `<defs>${grad(a, '#ffe0c7', '#f6b98e')}${grad(b, '#5a4636', '#2f231a')}${grad(c, '#7fb2ff', '#3f74e6')}</defs>${shadow()}
    <path d="M14 58c0-10 8-16 18-16s18 6 18 16z" fill="url(#${c})"/>
    <circle cx="32" cy="27" r="17" fill="url(#${a})"/>
    <path d="M15 25c0-11 8-17 17-17s17 6 17 17c-4-5-10-7-17-7s-13 2-17 7z" fill="url(#${b})"/>
    <ellipse cx="25.5" cy="29" rx="2.6" ry="3.4" fill="#2f231a"/><ellipse cx="38.5" cy="29" rx="2.6" ry="3.4" fill="#2f231a"/>
    <circle cx="26.4" cy="27.8" r="1" fill="#fff"/><circle cx="39.4" cy="27.8" r="1" fill="#fff"/>
    <ellipse cx="21" cy="35" rx="3" ry="1.8" fill="#ff8f8f" opacity=".6"/><ellipse cx="43" cy="35" rx="3" ry="1.8" fill="#ff8f8f" opacity=".6"/>
    <path d="M29 36q3 2.5 6 0" stroke="#7a4a32" stroke-width="1.8" fill="none" stroke-linecap="round"/>`; },
  // ngọn lửa
  flame: () => { const a = uid(), b = uid(); return `<defs>${grad(a, '#ffb347', '#ff4d2e')}${grad(b, '#fff3a3', '#ffc533')}</defs>${shadow(32, 59, 13)}
    <path d="M32 4c3 9 16 15 16 31a16 16 0 0 1-32 0c0-8 4-12 7-15 0 5 2 8 5 9-2-9 1-18 4-25z" fill="url(#${a})"/>
    <path d="M32 30c2 5 8 7 8 14a8 8 0 0 1-16 0c0-5 4-8 8-14z" fill="url(#${b})"/>${shine(25, 24, 2.5, 6, 15)}`; },
  // cờ
  flag: () => { const a = uid(), b = uid(); return `<defs>${grad(a, '#ff8a6b', '#e8432d')}${grad(b, '#c9d1de', '#8994a8')}</defs>${shadow(22, 59, 12)}
    <rect x="13" y="6" width="5" height="52" rx="2.5" fill="url(#${b})"/><circle cx="15.5" cy="6.5" r="4" fill="#ffd36b"/>
    <path d="M18 10c8-4 14 4 22 0s10-2 14 0v22c-4-2-6-4-14 0s-14-4-22 0z" fill="url(#${a})"/>${shine(27, 14, 5, 2)}`; },
  // định vị
  locate: () => { const a = uid(); return `<defs>${grad(a, '#7ab8ff', '#2f6fe0')}</defs>
    <circle cx="32" cy="32" r="17" fill="none" stroke="url(#${a})" stroke-width="5"/>
    <path d="M32 6v10M32 48v10M6 32h10M48 32h10" stroke="url(#${a})" stroke-width="5" stroke-linecap="round"/>
    <circle cx="32" cy="32" r="7" fill="url(#${a})"/><circle cx="29.5" cy="29.5" r="2.2" fill="#fff" opacity=".8"/>`; },
  plus: () => `<path d="M32 12v40M12 32h40" stroke="#fff" stroke-width="9" stroke-linecap="round"/>`,
  // đi bộ / ô tô (chế độ thử)
  walk: () => { const a = uid(); return `<defs>${grad(a, '#7fe0a0', '#2fae63')}</defs><circle cx="36" cy="10" r="6" fill="url(#${a})"/>
    <path d="M34 20l-8 14 8 6-4 16M34 20l10 12 8-2M26 34l-10 2M34 40l10 14" stroke="url(#${a})" stroke-width="6" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`; },
  car: () => { const a = uid(); return `<defs>${grad(a, '#ff8a8a', '#e23b5a')}</defs>
    <path d="M10 40l5-14c1-3 3-5 7-5h20c4 0 6 2 7 5l5 14v8H10z" fill="url(#${a})"/><path d="M19 30l3-6h20l3 6z" fill="#cfe6ff"/>
    <circle cx="20" cy="48" r="6" fill="#33384a"/><circle cx="44" cy="48" r="6" fill="#33384a"/><circle cx="20" cy="48" r="2" fill="#ccc"/><circle cx="44" cy="48" r="2" fill="#ccc"/>`; },
};

export function icon(name, size = 24) { return svg((DEF[name] || DEF.map)(), size); }

// Linh vật Sương (mây chibi) dùng cho màn hình đăng nhập
export function mascot(size = 96) {
  const a = uid(), b = uid();
  return svg(`<defs>${grad(a, '#ffffff', '#cfdcf2')}${grad(b, '#7fe0a0', '#2fae63')}</defs>${shadow(32, 58, 20)}
    <ellipse cx="32" cy="50" rx="22" ry="5" fill="url(#${b})" opacity=".9"/>
    <path d="M14 46a9 9 0 0 1 1-18 12 12 0 0 1 22-7 10 10 0 0 1 15 9 8 8 0 0 1-2 16z" fill="url(#${a})" stroke="#b5c4de" stroke-width="1.2"/>
    <ellipse cx="27" cy="35" rx="2.6" ry="3.3" fill="#33384a"/><ellipse cx="39" cy="35" rx="2.6" ry="3.3" fill="#33384a"/>
    <circle cx="27.8" cy="33.8" r="1" fill="#fff"/><circle cx="39.8" cy="33.8" r="1" fill="#fff"/>
    <ellipse cx="22.5" cy="40" rx="3" ry="1.8" fill="#ff9a9a" opacity=".7"/><ellipse cx="43.5" cy="40" rx="3" ry="1.8" fill="#ff9a9a" opacity=".7"/>
    <path d="M30 40q3 2.5 6 0" stroke="#33384a" stroke-width="1.8" fill="none" stroke-linecap="round"/>${shine(24, 24, 6, 2.5)}`, size);
}

// Thay mọi <i data-icon="..."> trong trang bằng icon tương ứng
export function hydrateIcons(root = document) {
  root.querySelectorAll('[data-icon]').forEach(el => {
    el.innerHTML = icon(el.dataset.icon, +(el.dataset.size || 24));
  });
}
