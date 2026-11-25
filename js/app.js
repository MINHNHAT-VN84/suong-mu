import { CONFIG } from './config.js';
import { createStore } from './store.js';
import { FogLayer } from './fog.js';
import * as G from './geo.js';
import { BADGES, CATEGORIES, catOf } from './badges.js';
import { icon, mascot, hydrateIcons } from './icons.js';

hydrateIcons();
document.getElementById('logo').innerHTML = mascot(96);

const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const S = {
  store: null, profile: null, map: null, fog: null,
  cells: new Map(), totalArea: 0,
  pos: null, lastAccepted: null, meMarker: null,
  places: new Map(), markers: new Map(), lastPoiFetch: null,
  earned: new Set(), stats: null, streakDay: null,
  sim: { enabled: false, car: false, timer: null },
};

/* ------------------------------- khởi động ------------------------------- */
async function main() {
  S.store = await createStore();
  if (!S.store.demo && !(await S.store.getUser())) return showAuth();
  await boot();
}

function showAuth() {
  $('#auth').classList.remove('hidden');
  // Link trong email bị lỗi (hết hạn, đã dùng) thì Supabase trả lỗi trên địa chỉ trang
  const h = new URLSearchParams(location.hash.slice(1) || location.search.slice(1));
  if (h.get('error_description')) {
    $('#auth-msg').textContent = 'Link đăng nhập không dùng được (' + h.get('error_description') + '). Hãy gửi lại link mới.';
    history.replaceState(null, '', location.pathname);
  }
  $('#show-email').onclick = e => { e.preventDefault(); $('#auth-form').classList.remove('hidden'); };
  $('#guest-form').onsubmit = async e => {
    e.preventDefault();
    const name = $('#guest-name').value.trim();
    if (!name) return;
    $('#auth-msg').textContent = 'Đang vào game...';
    try {
      await S.store.signInGuest(name);
      $('#auth').classList.add('hidden');
      await boot();
    } catch (err) {
      $('#auth-msg').textContent = /anonymous/i.test(err.message)
        ? 'Máy chủ chưa bật chế độ chơi không cần đăng ký (Allow anonymous sign-ins).'
        : 'Lỗi: ' + err.message;
    }
  };
  let email = '';
  $('#auth-form').onsubmit = async e => {
    e.preventDefault();
    email = $('#auth-email').value.trim();
    $('#auth-msg').textContent = 'Đang gửi...';
    try {
      await S.store.signIn(email);
      $('#auth-msg').textContent = 'Đã gửi email tới ' + email + '. Bấm vào link trong email, hoặc nhập mã số trong email vào ô trên.';
      $('#code-form').classList.remove('hidden');
    } catch (err) { $('#auth-msg').textContent = 'Lỗi: ' + err.message; }
  };
  $('#code-form').onsubmit = async e => {
    e.preventDefault();
    const code = $('#auth-code').value.trim();
    if (!code) return;
    $('#auth-msg').textContent = 'Đang kiểm tra mã...';
    try {
      await S.store.verifyCode(email, code);
      $('#auth').classList.add('hidden');
      await boot();
    } catch (err) { $('#auth-msg').textContent = 'Mã không đúng hoặc đã hết hạn: ' + err.message; }
  };
}

async function boot() {
  S.profile = await S.store.getProfile();
  for (const c of await S.store.loadCells()) addCellLocal(c);
  S.earned = new Set(await S.store.getBadges());
  initMap();
  bindUI();
  renderStats();
  S.sim.enabled = S.store.demo || new URLSearchParams(location.search).has('sim');
  if (S.sim.enabled) $('#btn-sim').classList.remove('hidden');
  startTracking();
  registerSW();
  if (S.store.demo) {
    setStatus('sim', 'Chế độ demo: chạm vào bản đồ để đi tới đó. Bấm 🚶 để đổi sang đi ô tô.', 7000);
  }
}

function addCellLocal(c) {
  const k = G.key(c.cx, c.cy);
  if (S.cells.has(k)) return false;
  S.cells.set(k, c);
  S.totalArea += G.cellArea(c.cy);
  return true;
}

/* --------------------------------- bản đồ -------------------------------- */
function initMap() {
  const map = L.map('map', { zoomControl: false, zoomAnimation: false, maxZoom: 19, minZoom: 3, attributionControl: true })
    .setView(CONFIG.DEFAULT_CENTER, 17);
  L.tileLayer(CONFIG.TILE_URL, { maxZoom: 19, subdomains: 'abcd', attribution: CONFIG.TILE_ATTRIBUTION }).addTo(map);
  S.map = map;
  S.fog = new FogLayer(map, S.cells);
  map.on('click', e => { if (S.sim.enabled) simWalkTo({ lat: e.latlng.lat, lng: e.latlng.lng }); });
}

function updateMeMarker(p, fast) {
  const meIc = L.divIcon({ className: '', html: `<div class="me-icon${fast ? ' fast' : ''}">${icon('user', 34)}</div>`, iconSize: [44, 44], iconAnchor: [22, 22] });
  if (!S.meMarker) S.meMarker = L.marker([p.lat, p.lng], { icon: meIc, zIndexOffset: 1000, interactive: false }).addTo(S.map);
  else { S.meMarker.setLatLng([p.lat, p.lng]); S.meMarker.setIcon(meIc); }
}

/* --------------------------- GPS & chống gian lận ------------------------ */
function startTracking() {
  let gotFix = false;
  if ('geolocation' in navigator) {
    navigator.geolocation.watchPosition(
      p => {
        if (S.sim.timer || S.sim.manual) return; // đang đi thử thì bỏ qua GPS thật
        gotFix = true;
        onPosition({ lat: p.coords.latitude, lng: p.coords.longitude, acc: p.coords.accuracy, t: p.timestamp, speed: p.coords.speed });
      },
      err => {
        if (!S.sim.enabled) setStatus('weak', 'Không lấy được vị trí. Hãy cho phép quyền vị trí cho trang này.');
        else fallbackStart();
      },
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 20000 });
  }
  if (S.sim.enabled) setTimeout(() => { if (!gotFix) fallbackStart(); }, 4000);
}

function fallbackStart() {
  if (S.pos) return;
  S.sim.manual = true;
  const [lat, lng] = CONFIG.DEFAULT_CENTER;
  onPosition({ lat, lng, acc: 5, t: Date.now() });
}

function onPosition(p) {
  const first = !S.pos;
  S.pos = p;
  if (first) S.map.setView([p.lat, p.lng], 18);

  if (p.acc > CONFIG.MAX_ACCURACY_M) {
    updateMeMarker(p, false);
    setStatus('weak', `GPS đang yếu (sai số ±${Math.round(p.acc)} m), tạm chưa mở sương.`);
    return;
  }
  const last = S.lastAccepted;
  const MAX = CONFIG.MAX_SPEED_KMH;
  // Tốc độ do chip GPS đo (Doppler) là đáng tin nhất; không có thì tự tính.
  const devKmh = (p.speed != null && !isNaN(p.speed) && p.speed >= 0) ? p.speed * 3.6 : null;
  let kmh = devKmh ?? 0;
  if (last) {
    const dt = (p.t - last.t) / 1000;
    if (dt <= 0) return;
    // Trừ đi sai số của 2 lần đo, để GPS "nhảy" khi đứng yên không bị tính là di chuyển
    const dEff = Math.max(0, G.distance(last, p) - (last.acc || 0) - (p.acc || 0));
    const calc = (dEff / dt) * 3.6;
    // Không có tốc độ từ chip: nếu các điểm lạ cũng nối tiếp nhau rất nhanh thì là đang đi xe thật
    const pv = S.pending;
    const pvKmh = pv && p.t > pv.t ? Math.max(0, G.distance(pv, p) - (pv.acc || 0) - (p.acc || 0)) / ((p.t - pv.t) / 1000) * 3.6 : 0;
    S.pending = p;
    if (calc > MAX && devKmh == null && pvKmh > MAX) {
      kmh = pvKmh;
    } else if (calc > MAX && (devKmh == null || devKmh <= MAX)) {
      // Nhảy điểm nhưng không thật sự chạy nhanh: bỏ qua điểm lạ.
      // Nếu vị trí mới lặp lại 3 lần liền thì coi đó là vị trí đúng.
      S.jumps = (S.jumps || 0) + 1;
      if (S.jumps < 3) return;
      S.jumps = 0;
      S.fastCount = 0;
      S.lastAccepted = { ...p, broken: true };
      updateMeMarker(p, false);
      reveal([p]);
      return;
    }
    else if (devKmh == null) kmh = calc;
  }
  S.jumps = 0;
  if (kmh > MAX) {
    // Chỉ cảnh báo khi đo nhanh 2 lần liên tiếp
    S.fastCount = (S.fastCount || 0) + 1;
    S.lastAccepted = { ...p, broken: true };
    if (S.fastCount >= 2) {
      updateMeMarker(p, true);
      setStatus('fast', `Bạn đang đi ${Math.round(kmh)} km/h. Sương chỉ mở khi đi bộ hoặc đạp xe (dưới ${MAX} km/h).`);
    }
    return;
  }
  S.fastCount = 0;
  S.pending = null;
  updateMeMarker(p, false);
  if (S.statusKind === 'fast' || S.statusKind === 'weak') clearStatus();

  const pts = [];
  if (last && !last.broken) {
    const d = G.distance(last, p);
    if (d < 200) {
      const steps = Math.ceil(d / 8);
      for (let i = 1; i <= steps; i++) pts.push(G.lerp(last, p, i / steps));
    } else pts.push(p);
  } else pts.push(p);
  S.lastAccepted = p;
  reveal(pts);
  maybeFetchPlaces(p);
  refreshPushLocation(p);
}

// Cập nhật vị trí gần nhất cho thông báo theo khu vực (tối đa 10 phút/lần)
let lastPushLoc = 0;
async function refreshPushLocation(p) {
  if (S.store.demo || !S.swReg || Date.now() - lastPushLoc < 600000) return;
  lastPushLoc = Date.now();
  try { const sub = await S.swReg.pushManager.getSubscription(); if (sub) await S.store.savePushSubscription(sub, p); } catch {}
}

function reveal(points) {
  const now = Date.now();
  const fresh = [];
  for (const pt of points) {
    for (const c of G.cellsInRadius(pt.lat, pt.lng, CONFIG.REVEAL_RADIUS_M)) {
      const cell = { cx: c.cx, cy: c.cy, t: now };
      if (addCellLocal(cell)) fresh.push(cell);
    }
  }
  if (!fresh.length) return;
  S.store.addCells(fresh);
  S.fog.requestDraw();
  renderStats();
  refreshMarkersSoon();
  onExploredToday();
  const h = new Date().getHours();
  if (h >= 22 || h < 4) award('night');
  checkBadgesSoon();
}

async function onExploredToday() {
  const today = new Date().toDateString();
  if (S.streakDay === today) return;
  S.streakDay = today;
  try {
    const r = await S.store.touchStreak();
    if (r) { S.profile.streak = r.streak; S.profile.best_streak = r.best_streak; renderStats(); }
  } catch (e) { console.warn(e); }
}

/* -------------------------------- địa điểm ------------------------------- */
const OSM_CATS = { cafe: 'cafe', restaurant: 'restaurant', fast_food: 'fast_food', bar: 'bar', pub: 'pub', park: 'park',
  museum: 'museum', attraction: 'attraction', viewpoint: 'viewpoint', place_of_worship: 'place_of_worship' };

async function maybeFetchPlaces(p) {
  if (S.lastPoiFetch && G.distance(S.lastPoiFetch, p) < 250) return;
  S.lastPoiFetch = { lat: p.lat, lng: p.lng };
  const d = 0.005; // ~500 m
  const b = { s: p.lat - d, n: p.lat + d, w: p.lng - d, e: p.lng + d };
  // Điểm do người chơi tạo + điểm đã có nhận xét
  S.store.getPlaces(b).then(list => { for (const pl of list) S.places.set(pl.id, pl); refreshMarkersSoon(); }).catch(console.warn);
  // Điểm có sẵn từ OpenStreetMap
  try {
    const q = `[out:json][timeout:15];(node["amenity"~"^(cafe|restaurant|fast_food|bar|pub|place_of_worship)$"]["name"](around:450,${p.lat},${p.lng});node["tourism"~"^(museum|attraction|viewpoint)$"]["name"](around:450,${p.lat},${p.lng});node["leisure"="park"]["name"](around:450,${p.lat},${p.lng}););out 150;`;
    const res = await fetch('https://overpass-api.de/api/interpreter', { method: 'POST', body: 'data=' + encodeURIComponent(q),
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
    const json = await res.json();
    for (const el of json.elements || []) {
      const t = el.tags || {};
      const raw = t.amenity || t.tourism || t.leisure;
      const id = 'osm:node/' + el.id;
      if (!S.places.has(id)) S.places.set(id, { id, name: t['name:vi'] || t.name, category: OSM_CATS[raw] || 'other', lat: el.lat, lng: el.lon, source: 'osm' });
    }
    refreshMarkersSoon();
  } catch (e) { console.warn('Overpass lỗi', e); }
}

function isExplored(lat, lng) {
  const c = G.cellOf(lat, lng);
  for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) if (S.cells.has(G.key(c.cx + dx, c.cy + dy))) return true;
  return false;
}

let markerTimer = 0;
function refreshMarkersSoon() { clearTimeout(markerTimer); markerTimer = setTimeout(refreshMarkers, 300); }
function refreshMarkers() {
  for (const pl of S.places.values()) {
    if (S.markers.has(pl.id) || !isExplored(pl.lat, pl.lng)) continue;
    const cat = catOf(pl.category);
    const plIc = L.divIcon({ className: '', html: `<div class="place-icon ${pl.source === 'user' ? 'user' : ''}">${cat.icon}</div>`, iconSize: [34, 34], iconAnchor: [17, 17] });
    const m = L.marker([pl.lat, pl.lng], { icon: plIc }).addTo(S.map).on('click', () => openPlace(pl));
    S.markers.set(pl.id, m);
  }
}

async function openPlace(pl) {
  const cat = catOf(pl.category);
  openSheet(`
    <h2>${cat.icon} ${esc(pl.name)}</h2>
    <div class="muted">${cat.name}${pl.source === 'user' ? ' · do người chơi tạo' : ''}</div>
    ${pl.description ? `<p>${esc(pl.description)}</p>` : ''}
    <div id="rating-sum" class="muted" style="margin-top:6px">Đang tải nhận xét...</div>
    <h3>Nhận xét của bạn</h3>
    <div class="stars" id="stars">${[1, 2, 3, 4, 5].map(i => `<button data-v="${i}">★</button>`).join('')}</div>
    <label for="rv-text">Cảm nhận</label>
    <textarea id="rv-text" maxlength="500" placeholder="Không gian, đồ uống, giá cả..."></textarea>
    <button id="rv-send" class="btn btn-primary btn-block" style="margin-top:10px">Gửi nhận xét</button>
    <h3>Mọi người nói gì</h3>
    <div id="rv-list"></div>`);
  let rating = 0;
  const stars = [...document.querySelectorAll('#stars button')];
  stars.forEach(b => b.onclick = () => { rating = +b.dataset.v; stars.forEach(s => s.classList.toggle('on', +s.dataset.v <= rating)); });
  const load = async () => {
    try {
      const list = await S.store.getReviews(pl);
      const avg = list.length ? list.reduce((a, r) => a + r.rating, 0) / list.length : 0;
      $('#rating-sum').innerHTML = list.length ? `<span class="stars-sm">${'★'.repeat(Math.round(avg))}</span> ${avg.toFixed(1)} · ${list.length} nhận xét` : 'Chưa có nhận xét. Hãy là người đầu tiên!';
      $('#rv-list').innerHTML = list.map(r => `<div class="review"><div><b>${esc(r.author?.avatar || '🙂')} ${esc(r.author?.display_name || 'Người chơi')}</b> <span class="stars-sm">${'★'.repeat(r.rating)}</span></div>
        <div>${esc(r.comment)}</div><div class="meta">${new Date(r.created_at).toLocaleDateString('vi-VN')}</div></div>`).join('') || '<p class="muted">Trống</p>';
    } catch (e) { $('#rating-sum').textContent = 'Lỗi tải nhận xét: ' + e.message; }
  };
  load();
  $('#rv-send').onclick = async () => {
    if (!rating) return toast('Chọn số sao trước nhé');
    if (!isExplored(pl.lat, pl.lng)) return toast('Bạn cần khám phá khu vực này trước');
    try {
      await S.store.addReview(pl, rating, $('#rv-text').value.trim());
      toast('Đã gửi nhận xét');
      $('#rv-text').value = '';
      load();
      checkBadgesSoon(true);
    } catch (e) { toast('Lỗi: ' + e.message); }
  };
}

function openCreatePlace() {
  if (!S.pos) return toast('Chưa xác định được vị trí của bạn');
  if (!isExplored(S.pos.lat, S.pos.lng)) return toast('Hãy đứng ở khu vực đã mở sương để tạo điểm');
  if ((S.profile.point_credits || 0) <= 0) {
    return openSheet(`
      <h2>🚩 Hết lượt tạo điểm</h2>
      <p>Xem hết một video ngắn để nhận thêm <b>1 lượt tạo điểm</b>. Tối đa ${CONFIG.MAX_VIDEO_REWARDS_PER_DAY} lần mỗi ngày.</p>
      <button id="go-video" class="btn btn-primary btn-block">▶ Xem video nhận lượt</button>`, () => {
      $('#go-video').onclick = () => { closeSheet(); watchVideo(() => openCreatePlace()); };
    });
  }
  openSheet(`
    <h2>🚩 Tạo điểm mới tại đây</h2>
    <div class="muted">Bạn còn ${S.profile.point_credits} lượt. Điểm sẽ đặt đúng vị trí bạn đang đứng.</div>
    <label for="np-name">Tên địa điểm</label>
    <input id="np-name" maxlength="80" placeholder="VD: Quán chè bà Tư">
    <label for="np-cat">Loại</label>
    <select id="np-cat">${Object.entries(CATEGORIES).filter(([k]) => k !== 'pub').map(([k, v]) => `<option value="${k}">${v.icon} ${v.name}</option>`).join('')}</select>
    <label for="np-desc">Mô tả</label>
    <textarea id="np-desc" maxlength="300" placeholder="Có gì đặc biệt ở đây?"></textarea>
    <button id="np-save" class="btn btn-primary btn-block" style="margin-top:12px">Tạo điểm (-1 lượt)</button>
    <button id="np-video" class="btn btn-block" style="margin-top:8px">▶ Xem video để thêm lượt</button>`);
  $('#np-video').onclick = () => { closeSheet(); watchVideo(() => openCreatePlace()); };
  $('#np-save').onclick = async () => {
    const name = $('#np-name').value.trim();
    if (name.length < 2) return toast('Nhập tên địa điểm');
    try {
      const pl = await S.store.createPlace({ name, category: $('#np-cat').value, description: $('#np-desc').value.trim(), lat: S.pos.lat, lng: S.pos.lng });
      S.profile.point_credits = Math.max(0, S.profile.point_credits - 1);
      S.places.set(pl.id, pl);
      refreshMarkers();
      renderStats();
      closeSheet();
      toast('Đã tạo điểm mới. Bạn là Người tiên phong ở đây!');
      checkBadgesSoon(true);
    } catch (e) { toast('Lỗi: ' + e.message); }
  };
}

/* ------------------------- video có thưởng (không tua) -------------------- */
function watchVideo(after) {
  const modal = $('#video-modal'), v = $('#reward-video'), bar = $('#video-progress');
  modal.classList.remove('hidden');
  v.src = CONFIG.REWARD_VIDEO_URL;
  v.controls = false;
  let maxT = 0, done = false;
  bar.style.width = '0';
  v.ontimeupdate = () => {
    if (v.currentTime > maxT + 1.2) v.currentTime = maxT; // chặn tua
    else maxT = Math.max(maxT, v.currentTime);
    if (v.duration) bar.style.width = (maxT / v.duration * 100) + '%';
  };
  v.onseeking = () => { if (v.currentTime > maxT + 1.2) v.currentTime = maxT; };
  v.onratechange = () => { if (v.playbackRate !== 1) v.playbackRate = 1; };
  const onHide = () => { if (document.hidden) v.pause(); };
  document.addEventListener('visibilitychange', onHide);
  const close = () => { v.pause(); modal.classList.add('hidden'); document.removeEventListener('visibilitychange', onHide); v.removeAttribute('src'); v.load(); };
  v.onended = async () => {
    if (done || !v.duration || maxT < v.duration - 1.5) return;
    done = true;
    try {
      S.profile.point_credits = await S.store.claimVideoReward();
      renderStats();
      toast('+1 lượt tạo điểm!');
      close();
      after?.();
    } catch (e) { toast(e.message); close(); }
  };
  $('#video-play').onclick = () => v.play().catch(e => toast('Không phát được video: ' + e.message));
  $('#video-close').onclick = () => { if (!done) toast('Bạn cần xem hết video để nhận lượt'); close(); };
}

/* --------------------------- huy hiệu & thống kê ------------------------- */
let badgeTimer = 0;
function checkBadgesSoon(refetch) {
  clearTimeout(badgeTimer);
  badgeTimer = setTimeout(async () => {
    if (!S.stats || refetch) { try { S.stats = await S.store.getStats(); } catch { S.stats = {}; } }
    const s = { totalArea: S.totalArea, bestStreak: S.profile.best_streak || 0, night: S.earned.has('night'), ...S.stats };
    for (const b of BADGES) if (!S.earned.has(b.id) && b.test(s)) award(b.id);
  }, refetch ? 100 : 2000);
}
function award(id) {
  if (S.earned.has(id)) return;
  S.earned.add(id);
  S.store.awardBadge(id).catch(console.warn);
  const b = BADGES.find(x => x.id === id);
  if (b) toast(`${b.icon} Huy hiệu mới: ${b.name}!`, 3500);
}

function renderStats() {
  $('#stat-area').textContent = G.formatArea(S.totalArea);
  $('#stat-streak').textContent = S.profile.streak || 0;
  $('#stat-credits').textContent = S.profile.point_credits ?? 0;
}

/* ------------------------------- các màn hình ---------------------------- */
async function openRank(period = 'week') {
  openSheet(`
    <h2>🏅 Bảng xếp hạng</h2>
    <div class="muted">Diện tích khám phá được so với bạn bè</div>
    <div class="tabs" id="rank-tabs">
      <button data-p="week">Tuần này</button><button data-p="month">Tháng này</button><button data-p="all">Mọi lúc</button>
    </div>
    <ul class="rank" id="rank-list"><li class="muted">Đang tải...</li></ul>
    <h3>Thêm bạn</h3>
    <div class="row"><input id="fr-code" placeholder="Nhập mã bạn bè" maxlength="12" style="text-transform:uppercase"><button id="fr-add" class="btn btn-primary">Thêm</button></div>
    <div class="note">Mã của bạn: <b>${esc(S.profile.friend_code)}</b>. Gửi mã này cho bạn bè để cùng đua.${S.store.demo ? ' (Demo: thử mã TUAN88)' : ''} Bảng tuần reset vào 0h thứ Hai.</div>`);
  document.querySelectorAll('#rank-tabs button').forEach(b => {
    b.classList.toggle('active', b.dataset.p === period);
    b.onclick = () => openRank(b.dataset.p);
  });
  $('#fr-add').onclick = async () => {
    try { const n = await S.store.addFriend($('#fr-code').value); toast(`Đã kết bạn với ${n}`); checkBadgesSoon(true); openRank(period); }
    catch (e) { toast(e.message); }
  };
  try {
    const rows = await S.store.getLeaderboard(period);
    const medal = i => ['🥇', '🥈', '🥉'][i] || (i + 1);
    $('#rank-list').innerHTML = rows.map((r, i) => `<li class="${r.is_me ? 'me' : ''}"><span class="pos">${medal(i)}</span><span class="av">${esc(r.avatar)}</span>
      <span class="name">${esc(r.display_name)}${r.is_me ? ' (bạn)' : ''}</span><span class="area">${G.formatArea(r.area_m2)}</span></li>`).join('');
  } catch (e) { $('#rank-list').innerHTML = `<li class="muted">Lỗi: ${esc(e.message)}</li>`; }
}

function openBadges() {
  openSheet(`
    <h2>🎖️ Huy hiệu</h2>
    <div class="muted" style="margin-bottom:12px">Đã có ${S.earned.size}/${BADGES.length} · Chuỗi dài nhất: ${S.profile.best_streak || 0} ngày</div>
    <div class="badges">${BADGES.map(b => `<div class="badge ${S.earned.has(b.id) ? 'got' : ''}"><div class="i">${b.icon}</div><div class="n">${b.name}</div><div class="d">${b.desc}</div></div>`).join('')}</div>`);
}

const AVATARS = ['🧑', '👩', '👨', '👧', '🧔', '👵', '🦊', '🐼', '🐯', '🐸', '🦄', '🐙', '🚀', '🌸'];
function openProfile() {
  const p = S.profile;
  openSheet(`
    <h2>${esc(p.avatar)} ${esc(p.display_name)}</h2>
    <div class="kv"><span>Đã khám phá</span><b>${G.formatArea(S.totalArea)}</b></div>
    <div class="kv"><span>Chuỗi hiện tại / dài nhất</span><b>${p.streak || 0} / ${p.best_streak || 0} ngày</b></div>
    <div class="kv"><span>Lượt tạo điểm</span><b>${p.point_credits ?? 0}</b></div>
    <div class="kv"><span>Mã bạn bè</span><span class="code">${esc(p.friend_code)}</span></div>
    <label for="pf-name">Tên hiển thị</label>
    <input id="pf-name" maxlength="30" value="${esc(p.display_name)}">
    <label>Ảnh đại diện</label>
    <div class="avatars" id="pf-av">${AVATARS.map(a => `<button class="${a === p.avatar ? 'on' : ''}">${a}</button>`).join('')}</div>
    <button id="pf-save" class="btn btn-primary btn-block" style="margin-top:12px">Lưu</button>
    ${S.store.isGuest ? `<div class="note" style="margin-top:12px">Bạn đang chơi không cần đăng ký. Tiến trình chỉ lưu trên máy này. Muốn giữ khi đổi điện thoại thì gắn email (không bắt buộc):
      <div class="row" style="margin-top:8px"><input id="pf-email" type="email" placeholder="Email"><button id="pf-link" class="btn">Lưu</button></div></div>` : ''}
    <button id="pf-push" class="btn btn-blue btn-block" style="margin-top:8px">🔔 Bật thông báo</button>
    <button id="pf-video" class="btn btn-block" style="margin-top:8px">▶ Xem video nhận lượt tạo điểm</button>
    ${p.is_admin ? '<a class="btn btn-block" style="margin-top:8px;text-align:center;text-decoration:none;color:inherit" href="admin.html">🛠️ Trang quản trị</a>' : ''}
    <button id="pf-out" class="btn btn-block" style="margin-top:8px;color:var(--bad)">${S.store.demo ? 'Xoá dữ liệu demo' : S.store.isGuest ? 'Thoát (mất tiến trình nếu chưa gắn email)' : 'Đăng xuất'}</button>
    <div class="note">Trên iPhone, thông báo chỉ hoạt động khi bạn mở trang bằng Safari, bấm Chia sẻ → "Thêm vào Màn hình chính", rồi mở app từ màn hình chính.</div>`);
  let av = p.avatar;
  document.querySelectorAll('#pf-av button').forEach(b => b.onclick = () => {
    av = b.textContent; document.querySelectorAll('#pf-av button').forEach(x => x.classList.toggle('on', x === b));
  });
  $('#pf-save').onclick = async () => {
    const name = $('#pf-name').value.trim() || p.display_name;
    try { await S.store.updateProfile({ display_name: name, avatar: av }); Object.assign(S.profile, { display_name: name, avatar: av }); toast('Đã lưu'); openProfile(); }
    catch (e) { toast('Lỗi: ' + e.message); }
  };
  $('#pf-push').onclick = enablePush;
  if ($('#pf-link')) $('#pf-link').onclick = async () => {
    const email = $('#pf-email').value.trim();
    if (!email) return;
    try { await S.store.linkEmail(email); toast('Đã gửi email xác nhận. Bấm link trong email để hoàn tất.', 4000); }
    catch (e) { toast('Lỗi: ' + e.message); }
  };
  $('#pf-video').onclick = () => { closeSheet(); watchVideo(); };
  $('#pf-out').onclick = async () => { await S.store.signOut(); location.reload(); };
}

/* ------------------------------ thông báo đẩy ----------------------------- */
async function registerSW() {
  if ('serviceWorker' in navigator) {
    try { S.swReg = await navigator.serviceWorker.register('sw.js'); } catch (e) { console.warn('SW', e); }
  }
}
async function enablePush() {
  if (!('Notification' in window) || !S.swReg) return toast('Trình duyệt này chưa hỗ trợ thông báo. Trên iPhone hãy thêm app vào Màn hình chính.');
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') return toast('Bạn chưa cho phép thông báo');
  if (!CONFIG.VAPID_PUBLIC_KEY) {
    S.swReg.showNotification('Thành Phố Sương Mù', { body: 'Thông báo đã bật (chế độ demo).', icon: 'icons/icon-192.png' });
    return toast('Đã bật thông báo');
  }
  try {
    const sub = await S.swReg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToU8(CONFIG.VAPID_PUBLIC_KEY) });
    await S.store.savePushSubscription(sub, S.pos);
    toast('Đã bật thông báo');
  } catch (e) { toast('Lỗi bật thông báo: ' + e.message); }
}
function b64ToU8(s) {
  const pad = '='.repeat((4 - s.length % 4) % 4);
  const raw = atob((s + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, c => c.charCodeAt(0));
}

/* ------------------------------- đi thử (demo) ---------------------------- */
// Mô phỏng đi bộ: chạy nhanh trên màn hình nhưng dấu thời gian giả lập tốc độ 5 km/h (hoặc 60 km/h khi bật chế độ ô tô).
function simWalkTo(target) {
  if (!S.pos) return;
  S.sim.manual = true;
  clearInterval(S.sim.timer);
  const kmh = S.sim.car ? 60 : 5;
  const stepM = 6;
  let cur = { lat: S.pos.lat, lng: S.pos.lng }, t = S.pos.t;
  S.sim.timer = setInterval(() => {
    const d = G.distance(cur, target);
    if (d < 1) { clearInterval(S.sim.timer); S.sim.timer = null; return; }
    const f = Math.min(1, stepM / d);
    const next = G.lerp(cur, target, f);
    t += (G.distance(cur, next) / (kmh / 3.6)) * 1000;
    cur = next;
    onPosition({ lat: cur.lat, lng: cur.lng, acc: 0, t });
    if (!S.map.getBounds().pad(-0.25).contains([cur.lat, cur.lng])) S.map.panTo([cur.lat, cur.lng], { animate: false });
  }, 60);
}

/* ---------------------------------- UI ----------------------------------- */
function bindUI() {
  $('#btn-locate').onclick = () => S.pos ? S.map.setView([S.pos.lat, S.pos.lng], Math.max(S.map.getZoom(), 17)) : toast('Đang tìm vị trí...');
  $('#btn-add').onclick = openCreatePlace;
  $('#btn-sim').onclick = () => {
    S.sim.car = !S.sim.car;
    $('#btn-sim').innerHTML = icon(S.sim.car ? 'car' : 'walk', 28);
    $('#btn-sim').classList.toggle('on', S.sim.car);
    toast(S.sim.car ? 'Đi thử bằng ô tô (60 km/h): sương sẽ KHÔNG mở' : 'Đi thử đi bộ (5 km/h)');
  };
  $('#backdrop').onclick = closeSheet;
  document.querySelectorAll('.bottomnav button').forEach(b => b.onclick = () => {
    const v = b.dataset.view;
    if (v === 'map') closeSheet();
    else if (v === 'rank') openRank();
    else if (v === 'badges') openBadges();
    else if (v === 'profile') openProfile();
    setNav(v);
  });
}
function setNav(v) { document.querySelectorAll('.bottomnav button').forEach(x => x.classList.toggle('active', x.dataset.view === v)); }

function openSheet(html, onMount) {
  $('#sheet-body').innerHTML = html;
  $('#sheet').classList.remove('hidden');
  $('#backdrop').classList.remove('hidden');
  onMount?.();
}
function closeSheet() {
  $('#sheet').classList.add('hidden');
  $('#backdrop').classList.add('hidden');
  setNav('map');
}

let toastTimer = 0;
function toast(msg, ms = 2500) {
  const t = $('#toast');
  t.textContent = msg; t.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), ms);
}
let statusTimer = 0;
function setStatus(kind, msg, ms) {
  const el = $('#status');
  el.className = 'status ' + kind; el.textContent = msg; S.statusKind = kind;
  clearTimeout(statusTimer);
  if (ms) statusTimer = setTimeout(clearStatus, ms);
}
function clearStatus() { $('#status').classList.add('hidden'); S.statusKind = null; }

main().catch(e => { console.error(e); toast('Lỗi khởi động: ' + e.message, 6000); });
