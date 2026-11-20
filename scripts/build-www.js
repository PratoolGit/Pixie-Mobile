// Assembles the web bundle for Capacitor: renderer/* + assets/* -> www/ (same root-relative layout the Electron protocol serves).
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..'), out = path.join(root, 'www');
fs.rmSync(out, { recursive: true, force: true }); fs.mkdirSync(out, { recursive: true });
fs.cpSync(path.join(root, 'renderer'), out, { recursive: true });
fs.cpSync(path.join(root, 'assets'), path.join(out, 'assets'), { recursive: true });
if (!fs.existsSync(path.join(out, 'vendor', 'models', 'hand_landmarker.task'))) console.warn('[www] vision models missing - hand/face tracking will fall back to the simulator');
console.log('[www] built', out);
