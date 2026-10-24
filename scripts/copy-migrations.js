const fs = require('fs');
const path = require('path');

// tsc sólo emite .js: los .sql de src/migrations nunca llegaban a dist/, por lo
// que runMigrations() leía un directorio sin archivos y no aplicaba nada en
// producción (silenciosamente, porque readdirSync devolvía lista vacía).
const src = path.join(__dirname, '..', 'src', 'migrations');
const dest = path.join(__dirname, '..', 'dist', 'migrations');

fs.mkdirSync(dest, { recursive: true });

const sqlFiles = fs.readdirSync(src).filter(f => f.endsWith('.sql'));
for (const file of sqlFiles) {
  fs.copyFileSync(path.join(src, file), path.join(dest, file));
}
console.log(`Migraciones copiadas a dist/migrations/ (${sqlFiles.length} archivos)`);
