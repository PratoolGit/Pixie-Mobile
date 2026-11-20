// Background vision worker: MediaPipe runs here so the UI thread never blocks.
// Frames arrive as transferred ImageBitmaps (zero-copy); results go back as plain arrays (image + metric world landmarks + handedness).
let hand = null, face = null;
const plain = l => l.map(p => ({ x: p.x, y: p.y, z: p.z }));
function load(base) {
  self.exports = {};
  try { importScripts(base + 'vision_bundle.cjs'); } catch { importScripts(base + 'vision_bundle.cjs.js'); }   // some WebViews dislike the .cjs extension
  return self.exports;
}
self.onmessage = async e => {
  const m = e.data;
  if (m.type === 'init') {
    try {
      const mod = load(m.base);
      const files = await mod.FilesetResolver.forVisionTasks(m.base + 'wasm');
      const make = async (Klass, file, extra) => {
        for (const delegate of ['GPU', 'CPU']) {
          try { return await Klass.createFromOptions(files, { baseOptions: { modelAssetPath: m.base + 'models/' + file, delegate }, runningMode: 'VIDEO', ...extra }); }
          catch (err) { if (delegate === 'CPU') throw err; }
        }
      };
      hand = await make(mod.HandLandmarker, 'hand_landmarker.task', m.opts || { numHands: 2, minHandDetectionConfidence: 0.55, minTrackingConfidence: 0.5 });
      face = await make(mod.FaceLandmarker, 'face_landmarker.task', { numFaces: 1 });
      postMessage({ type: 'ready' });
    } catch (err) { postMessage({ type: 'error', error: String((err && err.message) || err) }); }
    return;
  }
  if (m.type === 'frame') {
    const t0 = performance.now();
    try {
      const hr = hand.detectForVideo(m.bm, m.ts);
      let fl = null;
      if (m.face) { const fr = face.detectForVideo(m.bm, m.ts + 0.5); fl = fr.faceLandmarks && fr.faceLandmarks[0] ? plain(fr.faceLandmarks[0]) : null; }
      m.bm.close();
      const hands = (hr.landmarks || []).map((lm, i) => ({ lm: plain(lm), world: hr.worldLandmarks && hr.worldLandmarks[i] ? plain(hr.worldLandmarks[i]) : null,
        label: hr.handedness && hr.handedness[i] && hr.handedness[i][0] ? hr.handedness[i][0].categoryName : undefined, score: hr.handedness && hr.handedness[i] && hr.handedness[i][0] ? hr.handedness[i][0].score : undefined }));
      postMessage({ type: 'result', hands, faceRun: !!m.face, face: fl, ms: performance.now() - t0, t: m.t });
    } catch (err) { try { m.bm.close(); } catch {} postMessage({ type: 'frameerror', error: String((err && err.message) || err) }); }
  }
};
