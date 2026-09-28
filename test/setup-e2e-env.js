const fs = require('node:fs');
const path = require('node:path');

const file = path.join(__dirname, '.e2e-database-url');
if (fs.existsSync(file)) {
  process.env.DATABASE_URL = fs.readFileSync(file, 'utf8').trim();
}

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-16chars';
process.env.JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '8h';
process.env.CLINIC_TZ =
  process.env.CLINIC_TZ || 'America/Argentina/Buenos_Aires';
process.env.PORT = process.env.PORT || '3000';
