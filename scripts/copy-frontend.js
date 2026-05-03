const fs = require('fs');
const path = require('path');

const src = path.join(__dirname, '..', 'frontend', 'dist');
const dest = path.join(__dirname, '..', 'public');

if (fs.existsSync(dest)) {
  fs.rmSync(dest, { recursive: true });
}
fs.cpSync(src, dest, { recursive: true });
console.log('Frontend copiado a public/');
