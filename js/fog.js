import { CELL, R, key } from './geo.js';

// Lớp sương phủ lên bản đồ: tô kín màu sương, rồi "khoét" các ô đã khám phá (có làm mờ viền).
export class FogLayer {
  constructor(map, cells) {
    this.map = map;
    this.cells = cells; // Map<key, {cx, cy}>
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'fog-canvas';
    map.getContainer().appendChild(this.canvas);
    this.mask = document.createElement('canvas');
    this.texture = makeMistTexture();
    this._raf = 0;
    const req = () => this.requestDraw();
    map.on('move zoom resize viewreset', req);
    window.addEventListener('resize', req);
    this.requestDraw();
  }

  requestDraw() {
    if (this._raf) return;
    this._raf = requestAnimationFrame(() => { this._raf = 0; this.draw(); });
  }

  draw() {
    const map = this.map;
    const size = map.getSize();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const W = Math.round(size.x * dpr), H = Math.round(size.y * dpr);
    for (const c of [this.canvas, this.mask]) {
      if (c.width !== W || c.height !== H) { c.width = W; c.height = H; }
    }
    this.canvas.style.width = size.x + 'px';
    this.canvas.style.height = size.y + 'px';

    const z = map.getZoom();
    const scale = 256 * Math.pow(2, z);
    const k = scale / (2 * Math.PI * R); // px trên mét mercator
    const PR = Math.PI * R;
    const tl = map.project(map.containerPointToLatLng([0, 0]), z);
    const cellPx = CELL * k;

    const xMin = tl.x / k - PR, xMax = (tl.x + size.x) / k - PR;
    const yMax = PR - tl.y / k, yMin = PR - (tl.y + size.y) / k;
    const pad = 3;
    const cx0 = Math.floor(xMin / CELL) - pad, cx1 = Math.floor(xMax / CELL) + pad;
    const cy0 = Math.floor(yMin / CELL) - pad, cy1 = Math.floor(yMax / CELL) + pad;

    const m = this.mask.getContext('2d');
    m.setTransform(dpr, 0, 0, dpr, 0, 0);
    m.clearRect(0, 0, size.x, size.y);
    m.fillStyle = '#fff';
    m.beginPath();
    const r = Math.max(cellPx * 0.78, 0.7);
    const small = r < 1.5;
    const plot = (cx, cy) => {
      const px = ((cx + 0.5) * CELL + PR) * k - tl.x;
      const py = (PR - (cy + 0.5) * CELL) * k - tl.y;
      if (small) m.rect(px - r, py - r, r * 2, r * 2);
      else { m.moveTo(px + r, py); m.arc(px, py, r, 0, Math.PI * 2); }
    };
    const viewCount = (cx1 - cx0 + 1) * (cy1 - cy0 + 1);
    if (viewCount < this.cells.size) {
      for (let cx = cx0; cx <= cx1; cx++)
        for (let cy = cy0; cy <= cy1; cy++)
          if (this.cells.has(key(cx, cy))) plot(cx, cy);
    } else {
      for (const c of this.cells.values())
        if (c.cx >= cx0 && c.cx <= cx1 && c.cy >= cy0 && c.cy <= cy1) plot(c.cx, c.cy);
    }
    m.fill();

    const ctx = this.canvas.getContext('2d');
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    ctx.filter = 'none';
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(38, 46, 64, 0.93)';
    ctx.fillRect(0, 0, W, H);
    // vân sương trôi theo bản đồ
    const pat = ctx.createPattern(this.texture, 'repeat');
    if (pat) {
      const ox = -((tl.x * dpr * 0.5) % 512), oy = -((tl.y * dpr * 0.5) % 512);
      pat.setTransform?.(new DOMMatrix([1, 0, 0, 1, ox, oy]));
      ctx.fillStyle = pat;
      ctx.fillRect(0, 0, W, H);
    }
    ctx.globalCompositeOperation = 'destination-out';
    const blur = Math.max(1, Math.min(cellPx * 0.9, 14)) * dpr;
    ctx.filter = `blur(${blur}px)`;
    ctx.drawImage(this.mask, 0, 0);
    ctx.filter = 'none';
    ctx.globalCompositeOperation = 'source-over';
  }
}

function makeMistTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const g = c.getContext('2d');
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 70; i++) {
    const x = rnd() * 512, y = rnd() * 512, rad = 30 + rnd() * 110, a = 0.05 + rnd() * 0.07;
    for (const [dx, dy] of [[0, 0], [512, 0], [-512, 0], [0, 512], [0, -512]]) {
      const gr = g.createRadialGradient(x + dx, y + dy, 0, x + dx, y + dy, rad);
      gr.addColorStop(0, `rgba(190, 205, 230, ${a})`);
      gr.addColorStop(1, 'rgba(190, 205, 230, 0)');
      g.fillStyle = gr;
      g.fillRect(x + dx - rad, y + dy - rad, rad * 2, rad * 2);
    }
  }
  return c;
}
