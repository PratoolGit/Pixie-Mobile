// In-page glove overlay (dashboard on desktop and the whole phone UI): draws the tracked hands as gloves right over Pixie.
import { on, Vision } from './vision.js';
import { drawGloves, coverMap } from './glove.js';
import { S } from './store.js';
const cv = document.createElement('canvas'); cv.id = 'gloves'; document.body.appendChild(cv);
const g = cv.getContext('2d', { alpha: true });
let W = 0, H = 0, dpr = 1, hands = [], got = 0, raf = 0, clearT = 0;
function fit() { dpr = Math.min(2, devicePixelRatio || 1); W = innerWidth; H = innerHeight; cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
fit(); addEventListener('resize', fit);
function draw() {
  raf = 0; g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H);
  if (S.gloves === false || !hands.length) return;
  const v = Vision.video, ar = v && v.videoWidth ? v.videoWidth / v.videoHeight : 4 / 3;
  drawGloves(g, hands, W, H, { map: coverMap(W, H, ar, true), alpha: .94 });
}
on('hand_frame', e => {
  hands = e.hands; got = performance.now(); if (!raf) raf = requestAnimationFrame(draw);
  clearTimeout(clearT); clearT = setTimeout(() => { hands = []; if (!raf) raf = requestAnimationFrame(draw); }, 260);
});
