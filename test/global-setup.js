const { execSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const databaseUrl =
  'postgresql://turnos:turnos_secret@localhost:5433/turnos_test?schema=public';

function run(command) {
  return execSync(command, {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

module.exports = async () => {
  try {
    run(
      'docker compose exec -T postgres psql -U turnos -d postgres -c "SELECT 1"',
    );
  } catch (error) {
    const detail = error.stderr || error.message || error;
    throw new Error(
      `Postgres no está disponible. Corré docker compose up -d. ${detail}`,
    );
  }

  try {
    run(
      'docker compose exec -T postgres psql -U turnos -d postgres -c "CREATE DATABASE turnos_test"',
    );
  } catch (error) {
    const detail = `${error.stderr || ''} ${error.message || ''}`;
    if (!detail.includes('already exists')) {
      throw error;
    }
  }

  execSync('npx prisma db push --skip-generate', {
    cwd: root,
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: databaseUrl },
  });

  fs.writeFileSync(path.join(__dirname, '.e2e-database-url'), databaseUrl);
};

module.exports.databaseUrl = databaseUrl;
