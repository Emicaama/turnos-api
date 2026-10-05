const { spawnSync } = require('node:child_process');

const direct = process.env.PREPARE_STATUS_DIRECT === '1';

function psql(sql, capture) {
  const command = direct ? 'psql' : 'docker';
  const args = direct
    ? [process.env.DATABASE_URL, '-v', 'ON_ERROR_STOP=1', '-tA', '-c', sql]
    : [
        'compose',
        'exec',
        '-T',
        'postgres',
        'psql',
        '-U',
        'turnos',
        '-d',
        'turnos',
        '-v',
        'ON_ERROR_STOP=1',
        '-tA',
        '-c',
        sql,
      ];
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    env: process.env,
  });
  if (result.status !== 0) {
    const detail = `${result.stderr || ''}${result.stdout || ''}`.trim();
    throw new Error(detail || 'psql falló al preparar los estados');
  }
  return capture ? (result.stdout || '').trim() : '';
}

function main() {
  const state = psql(
    `SELECT CASE
      WHEN to_regclass('public."Appointment"') IS NULL THEN 'missing'
      WHEN EXISTS (
        SELECT 1
        FROM pg_enum e
        JOIN pg_type t ON e.enumtypid = t.oid
        WHERE t.typname = 'AppointmentStatus' AND e.enumlabel = 'pendiente'
      ) THEN 'legacy'
      ELSE 'ready'
    END`,
    true,
  );
  if (state !== 'legacy') {
    return;
  }

  for (const label of ['programado', 'en_sala_de_espera', 'atendido']) {
    psql(
      `ALTER TYPE "AppointmentStatus" ADD VALUE IF NOT EXISTS '${label}'`,
      false,
    );
  }

  psql(
    `UPDATE "Appointment"
     SET status = (
       CASE status::text
         WHEN 'pendiente' THEN 'programado'
         WHEN 'confirmado' THEN 'programado'
         WHEN 'completado' THEN 'atendido'
         WHEN 'ausente' THEN 'cancelado'
         ELSE status::text
       END
     )::"AppointmentStatus"
     WHERE status::text IN ('pendiente', 'confirmado', 'completado', 'ausente')`,
    false,
  );
}

main();
