// Run after `npx cap add android`: permissions, hardware features, portrait/immersive theme, app icons.
const fs = require('fs'), path = require('path');
const A = path.join(__dirname, '..', 'android', 'app', 'src', 'main');
const mf = path.join(A, 'AndroidManifest.xml'); let x = fs.readFileSync(mf, 'utf8');
const perms = ['CAMERA', 'RECORD_AUDIO', 'MODIFY_AUDIO_SETTINGS', 'INTERNET', 'VIBRATE', 'WAKE_LOCK'];
const feats = ['<uses-feature android:name="android.hardware.camera" android:required="false" />', '<uses-feature android:name="android.hardware.camera.front" android:required="false" />', '<uses-feature android:name="android.hardware.microphone" android:required="false" />'];
let add = ''; perms.forEach(p => { if (!x.includes('android.permission.' + p + '"')) add += `    <uses-permission android:name="android.permission.${p}" />\n`; });
feats.forEach(f => { if (!x.includes(f.match(/android:name="([^"]+)"/)[1])) add += '    ' + f + '\n'; });
x = x.replace('</manifest>', add + '</manifest>');
if (!x.includes('android:hardwareAccelerated')) x = x.replace('<application', '<application android:hardwareAccelerated="true"');
if (!x.includes('screenOrientation')) x = x.replace('<activity', '<activity android:screenOrientation="unspecified"');
fs.writeFileSync(mf, x);
// icons
const icon = path.join(__dirname, '..', 'build', 'icon.png');
if (fs.existsSync(icon)) for (const d of fs.readdirSync(path.join(A, 'res'))) if (/^mipmap-/.test(d)) for (const n of ['ic_launcher.png', 'ic_launcher_round.png', 'ic_launcher_foreground.png']) { const f = path.join(A, 'res', d, n); if (fs.existsSync(f)) fs.copyFileSync(icon, f); }
console.log('[android] patched manifest + icons');
