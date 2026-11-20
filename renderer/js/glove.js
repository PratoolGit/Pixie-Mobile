// Cute "glove" hand renderer. Replaces the bare skeleton: fingers are tapered tubes, the palm is a filled shape,
// there is a ruffled cuff at the wrist, glossy fingertips and stitch lines. Everything is drawn in two passes
// (outline of the union, then fill) so the silhouette is one clean shape with no seams between fingers and palm.
const FINGERS = [[1, 2, 3, 4], [5, 6, 7, 8], [9, 10, 11, 12], [13, 14, 15, 16], [17, 18, 19, 20]];
const WIDTH = [.34, .27, .29, .27, .23];        // base thickness relative to palm size (thumb, index, middle, ring, pinky)
const PALM = [0, 1, 5, 9, 13, 17];
const THEMES = { pink: { fill: ['#fff4f8', '#ffd3e4'], edge: '#e0568a', cuff: '#ff8fb9', cuff2: '#fff', shine: 'rgba(255,255,255,.85)', stitch: 'rgba(224,86,138,.45)' } };

// map camera-normalised coordinates to the screen with the video's own aspect ratio ("cover"), so hands are never stretched
export function coverMap(W, H, aspect = 4 / 3, mirror = true) {
  const vh = Math.max(H, W / aspect), vw = vh * aspect, ox = (W - vw) / 2, oy = (H - vh) / 2;
  return (x, y) => [ox + (mirror ? 1 - x : x) * vw, oy + y * vh];
}
export function drawGloves(g, hands, W, H, opt = {}) {
  const mirror = opt.mirror !== false, th = THEMES[opt.theme || 'pink'], alpha = opt.alpha ?? 1, map = opt.map || ((x, y) => [(mirror ? 1 - x : x) * W, y * H]);
  hands.forEach(h => {
    const lm = h.lm || h, P = i => map(lm[i].x, lm[i].y);
    const p0 = P(0), p9 = P(9), ps = Math.max(8, Math.hypot(p0[0] - p9[0], p0[1] - p9[1]));   // palm length in px = scale of everything
    const o = Math.max(1.5, ps * .045);
    g.save(); g.globalAlpha = alpha; g.lineCap = 'round'; g.lineJoin = 'round';
    const dx = p0[0] - p9[0], dy = p0[1] - p9[1], dl = Math.hypot(dx, dy) || 1, ux = dx / dl, uy = dy / dl;   // direction from hand towards the forearm
    const shape = (pad, color) => {
      g.strokeStyle = color; g.fillStyle = color;
      // palm
      g.lineWidth = pad + ps * .18; g.beginPath(); PALM.forEach((i, n) => { const p = P(i); n ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]); }); g.closePath(); g.fill(); g.stroke();
      // webbing between finger bases so fingers read as one glove
      g.lineWidth = pad + ps * .2; g.beginPath(); [5, 9, 13, 17].forEach((i, n) => { const p = P(i); n ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]); }); g.stroke();
      // fingers: tapered segments
      FINGERS.forEach((f, fi) => { for (let s = 0; s < 3; s++) { const a = P(f[s]), b = P(f[s + 1]); g.lineWidth = pad + ps * WIDTH[fi] * (1 - s * .1); g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke(); } });
      // wrist stub
      const w = P(0); g.lineWidth = pad + ps * .55; g.beginPath(); g.moveTo(w[0], w[1]); g.lineTo(w[0] + ux * ps * .12, w[1] + uy * ps * .12); g.stroke();
    };
    // cuff / sleeve at the wrist (drawn first, hand overlaps it)
    const cx = p0[0] + ux * ps * .38, cy = p0[1] + uy * ps * .38, cw = ps * .98, ch = ps * .62;
    g.save(); g.translate(cx, cy); g.rotate(Math.atan2(uy, ux) - Math.PI / 2);
    g.fillStyle = th.edge; g.beginPath(); g.roundRect(-cw / 2 - o, -ch / 2 - o, cw + o * 2, ch + o * 2, ps * .16); g.fill();
    g.fillStyle = th.cuff; g.beginPath(); g.roundRect(-cw / 2, -ch / 2, cw, ch, ps * .14); g.fill();
    g.fillStyle = th.cuff2; g.fillRect(-cw / 2 + 2, -ch / 2 + ch * .12, cw - 4, ch * .16);                    // ruffle band
    g.fillStyle = 'rgba(255,255,255,.9)'; const hs = ps * .13; g.beginPath(); g.moveTo(0, hs * .9); g.bezierCurveTo(-hs * 1.6, -hs * .2, -hs * .7, -hs * 1.4, 0, -hs * .5); g.bezierCurveTo(hs * .7, -hs * 1.4, hs * 1.6, -hs * .2, 0, hs * .9); g.fill();   // heart
    g.restore();
    shape(o * 2, th.edge);                                                                                      // pass 1: outline of the whole hand
    const gr = g.createLinearGradient(p0[0], p0[1], P(12)[0], P(12)[1]); gr.addColorStop(0, th.fill[1]); gr.addColorStop(.55, th.fill[0]); gr.addColorStop(1, th.fill[0]);
    shape(0, gr);                                                                                                 // pass 2: glove fill
    // finger shading: a soft inner line along each finger + glossy tips
    g.strokeStyle = th.shine; FINGERS.forEach((f, fi) => { const a = P(f[0]), b = P(f[3]); const nx = -(b[1] - a[1]), ny = b[0] - a[0], nl = Math.hypot(nx, ny) || 1, off = -ps * WIDTH[fi] * .18;
      g.lineWidth = Math.max(1.2, ps * WIDTH[fi] * .22); g.beginPath(); g.moveTo(a[0] + nx / nl * off, a[1] + ny / nl * off); [1, 2, 3].forEach(k => { const p = P(f[k]); g.lineTo(p[0] + nx / nl * off, p[1] + ny / nl * off); }); g.stroke(); });
    g.fillStyle = th.shine; FINGERS.forEach((f, fi) => { const t = P(f[3]); g.beginPath(); g.ellipse(t[0], t[1], ps * WIDTH[fi] * .22, ps * WIDTH[fi] * .3, 0, 0, 7); g.fill(); });
    // stitching: seams at knuckles and finger joints
    g.strokeStyle = th.stitch; g.lineWidth = Math.max(1, ps * .018); g.setLineDash([ps * .05, ps * .05]);
    g.beginPath(); [5, 9, 13, 17].forEach((i, n) => { const p = P(i); n ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]); }); g.stroke();
    [1, 2, 3].forEach(k => { g.beginPath(); [5, 9, 13, 17].forEach((i, n) => { const p = P(i + k); n ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]); }); if (k === 1) g.stroke(); });
    g.setLineDash([]); g.restore();
  });
}
