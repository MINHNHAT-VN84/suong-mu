import { CONFIG } from './config.js';
import { createStore } from './store.js';

const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const store = await createStore();
if (!store.demo && !(await store.getUser())) location.href = './';
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
const profile = await store.getProfile();
if (!profile.is_admin) $('#denied').classList.remove('hidden');
else start();

function start() {
  $('#panel').classList.remove('hidden');
  let map, center = null, marker, circle;
  document.querySelectorAll('input[name=tg]').forEach(r => r.onchange = () => {
    const area = $('input[name=tg]:checked').value === 'area';
    $('#area-box').classList.toggle('hidden', !area);
    if (area && !map) {
      map = L.map('pick-map').setView(CONFIG.DEFAULT_CENTER, 11);
      L.tileLayer(CONFIG.TILE_URL, { subdomains: 'abcd', attribution: CONFIG.TILE_ATTRIBUTION }).addTo(map);
      map.on('click', e => { center = e.latlng; draw(); });
      $('#r').oninput = draw;
    }
  });
  function draw() {
    if (!center) return;
    const rad = (+$('#r').value || 1) * 1000;
    if (!marker) { marker = L.marker(center).addTo(map); circle = L.circle(center, { radius: rad, color: '#ff7a3d' }).addTo(map); }
    marker.setLatLng(center); circle.setLatLng(center); circle.setRadius(rad);
  }

  $('#send').onclick = async () => {
    const title = $('#t').value.trim(), body = $('#b').value.trim();
    if (!title || !body) return ($('#msg').textContent = 'Cần nhập tiêu đề và nội dung.');
    const type = $('input[name=tg]:checked').value;
    const target = type === 'area'
      ? (center ? { type, lat: center.lat, lng: center.lng, radius_km: +$('#r').value } : null)
      : { type: 'all' };
    if (!target) return ($('#msg').textContent = 'Chạm vào bản đồ để chọn tâm khu vực.');
    if (!confirm(`Gửi "${title}" tới ${type === 'all' ? 'TẤT CẢ người chơi' : 'người chơi trong bán kính ' + target.radius_km + ' km'}?`)) return;
    $('#send').disabled = true; $('#msg').textContent = 'Đang gửi...';
    try {
      const r = await store.sendBroadcast({ title, body, url: $('#u').value.trim() || './', target });
      $('#msg').textContent = `Đã gửi tới ${r.sent} thiết bị${r.failed ? `, lỗi ${r.failed}` : ''}.`;
      loadHist();
    } catch (e) { $('#msg').textContent = 'Lỗi: ' + e.message; }
    $('#send').disabled = false;
  };
  loadHist();
}

async function loadHist() {
  const list = await store.getBroadcasts();
  $('#hist').innerHTML = list.length ? list.map(b => `<div class="hist"><b>${esc(b.title)}</b> <span class="muted">· ${new Date(b.created_at).toLocaleString('vi-VN')} · ${b.sent_count ?? 0} thiết bị</span><div>${esc(b.body)}</div></div>`).join('') : 'Chưa gửi thông báo nào.';
}
