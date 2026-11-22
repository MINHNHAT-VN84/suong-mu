import { CONFIG } from './config.js';
import { cellArea, weekStart, monthStart } from './geo.js';

export async function createStore() {
  const forceDemo = new URLSearchParams(location.search).has('demo');
  if (CONFIG.SUPABASE_URL && CONFIG.SUPABASE_ANON_KEY && !forceDemo) {
    const s = new SupabaseStore();
    await s.init();
    return s;
  }
  return new LocalStore();
}

const todayStr = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/* ------------------------------------------------------------------ */
/* CHẾ ĐỘ DEMO: lưu mọi thứ trong localStorage, có sẵn bạn bè giả.      */
/* ------------------------------------------------------------------ */
class LocalStore {
  constructor() {
    this.demo = true;
    this.k = 'fogmap_demo_v1';
    let d = null;
    try { d = JSON.parse(localStorage.getItem(this.k)); } catch {}
    this.d = d || this.seed();
  }
  seed() {
    return {
      profile: { id: 'me', display_name: 'Người chơi', avatar: '🧑', friend_code: 'DEMO01', point_credits: 3,
        streak: 0, best_streak: 0, last_active_date: null, is_admin: true },
      cells: {}, places: [], reviews: [], badges: [], videos: [], broadcasts: [],
      friends: ['lan', 'hung', 'mai'],
      people: {
        lan: { display_name: 'Lan', avatar: '👩', code: 'LAN123', week: 18200, month: 52300, all: 312000 },
        hung: { display_name: 'Hùng', avatar: '🧔', code: 'HUNG77', week: 9400, month: 61000, all: 148000 },
        mai: { display_name: 'Mai', avatar: '👧', code: 'MAI555', week: 2100, month: 8800, all: 26500 },
        tuan: { display_name: 'Tuấn', avatar: '👨‍🦱', code: 'TUAN88', week: 25400, month: 70100, all: 501000 },
      },
    };
  }
  save() { try { localStorage.setItem(this.k, JSON.stringify(this.d)); } catch {} }

  async getUser() { return { id: 'me' }; }
  async signIn() {}
  async signOut() { try { localStorage.removeItem(this.k); } catch {} }
  async getProfile() { return { ...this.d.profile }; }
  async updateProfile(p) { Object.assign(this.d.profile, p); this.save(); }

  async loadCells() {
    return Object.entries(this.d.cells).map(([k, t]) => {
      const [cx, cy] = k.split(':').map(Number);
      return { cx, cy, t };
    });
  }
  addCells(cells) { for (const c of cells) this.d.cells[c.cx + ':' + c.cy] = c.t; this._saveSoon(); }
  _saveSoon() { clearTimeout(this._st); this._st = setTimeout(() => this.save(), 1500); }

  async getPlaces() { return this.d.places; }
  async createPlace(p) {
    if (this.d.profile.point_credits <= 0) throw new Error('Hết lượt tạo điểm');
    const place = { ...p, id: 'u' + Date.now(), source: 'user', created_by: 'me', created_at: Date.now() };
    this.d.places.push(place);
    this.d.profile.point_credits--;
    this.save();
    return place;
  }
  async getReviews(place) {
    return this.d.reviews.filter(r => r.place_id === place.id)
      .map(r => ({ ...r, author: r.user_id === 'me' ? this.d.profile : this.d.people[r.user_id] }))
      .sort((a, b) => b.created_at - a.created_at);
  }
  async addReview(place, rating, comment) {
    this.d.reviews = this.d.reviews.filter(r => !(r.place_id === place.id && r.user_id === 'me'));
    this.d.reviews.push({ id: 'r' + Date.now(), place_id: place.id, category: place.category, user_id: 'me', rating, comment, created_at: Date.now() });
    this.save();
  }
  async getLeaderboard(period) {
    const since = period === 'week' ? weekStart() : period === 'month' ? monthStart() : 0;
    let mine = 0;
    for (const [k, t] of Object.entries(this.d.cells)) if (t >= since) mine += cellArea(+k.split(':')[1]);
    const rows = this.d.friends.map(id => {
      const p = this.d.people[id];
      return { id, display_name: p.display_name, avatar: p.avatar, area_m2: p[period === 'week' ? 'week' : period === 'month' ? 'month' : 'all'], is_me: false };
    });
    rows.push({ id: 'me', display_name: this.d.profile.display_name, avatar: this.d.profile.avatar, area_m2: mine, is_me: true });
    return rows.sort((a, b) => b.area_m2 - a.area_m2);
  }
  async addFriend(code) {
    code = code.trim().toUpperCase();
    const id = Object.keys(this.d.people).find(i => this.d.people[i].code === code);
    if (!id) throw new Error('Không tìm thấy mã bạn bè này (thử TUAN88)');
    if (this.d.friends.includes(id)) throw new Error('Hai bạn đã là bạn bè');
    this.d.friends.push(id); this.save();
    return this.d.people[id].display_name;
  }
  async claimVideoReward() {
    const today = todayStr();
    const n = this.d.videos.filter(v => v === today).length;
    if (n >= CONFIG.MAX_VIDEO_REWARDS_PER_DAY) throw new Error('Hôm nay bạn đã nhận đủ lượt từ video');
    this.d.videos.push(today);
    this.d.profile.point_credits++;
    this.save();
    return this.d.profile.point_credits;
  }
  async touchStreak() {
    const p = this.d.profile, today = todayStr();
    const y = new Date(); y.setDate(y.getDate() - 1);
    if (p.last_active_date !== today) {
      p.streak = p.last_active_date === todayStr(y) ? p.streak + 1 : 1;
      p.best_streak = Math.max(p.best_streak, p.streak);
      p.last_active_date = today;
      this.save();
    }
    return { streak: p.streak, best_streak: p.best_streak };
  }
  async getBadges() { return this.d.badges; }
  async awardBadge(id) { if (!this.d.badges.includes(id)) { this.d.badges.push(id); this.save(); } }
  async getStats() {
    const mine = this.d.reviews.filter(r => r.user_id === 'me');
    return {
      placesCreated: this.d.places.filter(p => p.created_by === 'me').length,
      reviews: mine.length,
      cafeReviews: mine.filter(r => r.category === 'cafe').length,
      friends: this.d.friends.length,
    };
  }
  async savePushSubscription() {}
  async sendBroadcast(payload) {
    const reg = await navigator.serviceWorker?.getRegistration();
    if (Notification.permission !== 'granted') await Notification.requestPermission();
    if (reg && Notification.permission === 'granted') {
      await reg.showNotification(payload.title, { body: payload.body, icon: 'icons/icon-192.png', data: { url: payload.url || './' } });
    }
    this.d.broadcasts.unshift({ ...payload, created_at: new Date().toISOString(), sent_count: 1 });
    this.save();
    return { sent: 1, failed: 0 };
  }
  async getBroadcasts() { return this.d.broadcasts; }
}

/* ------------------------------------------------------------------ */
/* BẢN THẬT: Supabase (đăng nhập email, Postgres, Edge Function push).  */
/* ------------------------------------------------------------------ */
class SupabaseStore {
  async init() {
    this.demo = false;
    const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.50.0/+esm');
    this.sb = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);
    this.queue = [];
    setInterval(() => this.flush(), 5000);
    addEventListener('pagehide', () => this.flush());
  }
  get uid() { return this.user?.id; }
  async getUser() {
    const { data: { session } } = await this.sb.auth.getSession();
    this.user = session?.user || null;
    return this.user;
  }
  async signIn(email) {
    const { error } = await this.sb.auth.signInWithOtp({ email, options: { emailRedirectTo: location.hostname === 'localhost' ? location.origin + location.pathname : (CONFIG.APP_URL || location.origin + location.pathname) } });
    if (error) throw error;
  }
  // Chơi ngay không cần email (Supabase anonymous sign-in)
  async signInGuest(name) {
    const { data, error } = await this.sb.auth.signInAnonymously();
    if (error) throw error;
    this.user = data.user;
    for (let i = 0; i < 5; i++) { // chờ trigger tạo hồ sơ
      const { error: e2, count } = await this.sb.from('profiles').update({ display_name: name }, { count: 'exact' }).eq('id', this.uid);
      if (!e2 && count) return;
      await new Promise(r => setTimeout(r, 400));
    }
  }
  get isGuest() { return !!this.user?.is_anonymous; }
  // Gắn email để giữ tiến trình khi đổi máy
  async linkEmail(email) {
    const { error } = await this.sb.auth.updateUser({ email }, { emailRedirectTo: CONFIG.APP_URL });
    if (error) throw error;
  }
  async verifyCode(email, token) {
    let r = await this.sb.auth.verifyOtp({ email, token, type: 'email' });
    if (r.error) r = await this.sb.auth.verifyOtp({ email, token, type: 'signup' });
    if (r.error) throw r.error;
    this.user = r.data.user;
  }
  async signOut() { await this.sb.auth.signOut(); }
  async getProfile() {
    const { data, error } = await this.sb.from('profiles').select('*').eq('id', this.uid).single();
    if (error) throw error;
    return data;
  }
  async updateProfile(p) {
    const { error } = await this.sb.from('profiles').update({ display_name: p.display_name, avatar: p.avatar }).eq('id', this.uid);
    if (error) throw error;
  }
  async loadCells() {
    const out = [];
    for (let i = 0; ; i += 1000) {
      const { data, error } = await this.sb.from('explored_cells').select('cx,cy,explored_at')
        .eq('user_id', this.uid).range(i, i + 999);
      if (error) throw error;
      for (const r of data) out.push({ cx: r.cx, cy: r.cy, t: Date.parse(r.explored_at) });
      if (data.length < 1000) break;
    }
    return out;
  }
  addCells(cells) {
    for (const c of cells) this.queue.push({ user_id: this.uid, cx: c.cx, cy: c.cy });
    if (this.queue.length > 500) this.flush();
  }
  async flush() {
    if (!this.queue.length || this.flushing) return;
    this.flushing = true;
    const batch = this.queue.splice(0, 1000);
    const { error } = await this.sb.from('explored_cells').upsert(batch, { onConflict: 'user_id,cx,cy', ignoreDuplicates: true });
    if (error) this.queue.unshift(...batch);
    this.flushing = false;
  }
  async getPlaces(b) {
    const { data, error } = await this.sb.from('places').select('*')
      .gte('lat', b.s).lte('lat', b.n).gte('lng', b.w).lte('lng', b.e).limit(500);
    if (error) throw error;
    return data.map(p => ({ ...p, id: p.osm_id || p.id, dbId: p.id, source: p.osm_id ? 'osm' : 'user' }));
  }
  async createPlace(p) {
    const { data, error } = await this.sb.rpc('create_place', {
      p_name: p.name, p_category: p.category, p_description: p.description || '', p_lat: p.lat, p_lng: p.lng });
    if (error) throw error;
    return { ...data, dbId: data.id, source: 'user' };
  }
  async placeDbId(place) {
    if (place.dbId) return place.dbId;
    const { data, error } = await this.sb.rpc('ensure_osm_place', {
      p_osm_id: place.id, p_name: place.name, p_category: place.category, p_lat: place.lat, p_lng: place.lng });
    if (error) throw error;
    place.dbId = data;
    return data;
  }
  async getReviews(place) {
    const id = await this.placeDbId(place);
    const { data, error } = await this.sb.from('reviews').select('*, author:profiles(display_name,avatar)')
      .eq('place_id', id).order('created_at', { ascending: false }).limit(50);
    if (error) throw error;
    return data.map(r => ({ ...r, created_at: Date.parse(r.created_at) }));
  }
  async addReview(place, rating, comment) {
    const id = await this.placeDbId(place);
    const { error } = await this.sb.rpc('add_review', { p_place_id: id, p_rating: rating, p_comment: comment });
    if (error) throw error;
  }
  async getLeaderboard(period) {
    await this.flush();
    const { data, error } = await this.sb.rpc('get_leaderboard', { p_period: period });
    if (error) throw error;
    return data.map(r => ({ id: r.player_id, display_name: r.display_name, avatar: r.avatar, area_m2: r.area_m2, is_me: r.is_me }));
  }
  async addFriend(code) {
    const { data, error } = await this.sb.rpc('add_friend', { p_code: code.trim().toUpperCase() });
    if (error) throw error;
    return data;
  }
  async claimVideoReward() {
    const { data, error } = await this.sb.rpc('claim_video_reward');
    if (error) throw error;
    return data;
  }
  async touchStreak() {
    const { data, error } = await this.sb.rpc('touch_streak');
    if (error) throw error;
    return Array.isArray(data) ? data[0] : data;
  }
  async getBadges() {
    const { data } = await this.sb.from('user_badges').select('badge_id').eq('user_id', this.uid);
    return (data || []).map(r => r.badge_id);
  }
  async awardBadge(id) {
    await this.sb.from('user_badges').upsert({ user_id: this.uid, badge_id: id }, { onConflict: 'user_id,badge_id', ignoreDuplicates: true });
  }
  async getStats() {
    const c = q => q.then(r => r.count || 0);
    const [placesCreated, reviews, cafeReviews, friends] = await Promise.all([
      c(this.sb.from('places').select('id', { count: 'exact', head: true }).eq('created_by', this.uid)),
      c(this.sb.from('reviews').select('id', { count: 'exact', head: true }).eq('user_id', this.uid)),
      c(this.sb.from('reviews').select('id, places!inner(category)', { count: 'exact', head: true }).eq('user_id', this.uid).eq('places.category', 'cafe')),
      c(this.sb.from('friendships').select('friend_id', { count: 'exact', head: true }).eq('user_id', this.uid)),
    ]);
    return { placesCreated, reviews, cafeReviews, friends };
  }
  async savePushSubscription(sub, pos) {
    const j = sub.toJSON();
    await this.sb.from('push_subscriptions').upsert({
      user_id: this.uid, endpoint: j.endpoint, p256dh: j.keys.p256dh, auth: j.keys.auth,
      last_lat: pos?.lat ?? null, last_lng: pos?.lng ?? null, updated_at: new Date().toISOString(),
    }, { onConflict: 'endpoint' });
  }
  async sendBroadcast(payload) {
    const { data, error } = await this.sb.functions.invoke('send-push', { body: payload });
    if (error) throw error;
    return data;
  }
  async getBroadcasts() {
    const { data } = await this.sb.from('broadcasts').select('*').order('created_at', { ascending: false }).limit(20);
    return data || [];
  }
}
