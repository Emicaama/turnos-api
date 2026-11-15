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

function prepareAppointmentStatus() {
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

const LATEST_STAY = `ORDER BY a."dischargedAt" IS NULL DESC, a."admittedAt" DESC LIMIT 1`;

function prepareNursingStays() {
  const legacy = psql(
    `SELECT count(*) FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name IN ('VitalSign', 'DoseAdministration')
       AND column_name = 'appointmentId'`,
    true,
  );
  if (legacy === '0') {
    return;
  }

  psql(
    `ALTER TABLE "VitalSign"
       ADD COLUMN IF NOT EXISTS "admissionId" TEXT,
       ADD COLUMN IF NOT EXISTS "authorUserId" TEXT;
     ALTER TABLE "DoseAdministration"
       ADD COLUMN IF NOT EXISTS "admissionId" TEXT,
       ADD COLUMN IF NOT EXISTS "authorUserId" TEXT;
     UPDATE "VitalSign" v SET "admissionId" = (
       SELECT a.id FROM "Admission" a
       WHERE a."patientId" = v."patientId" ${LATEST_STAY}
     ) WHERE "admissionId" IS NULL;
     UPDATE "DoseAdministration" d SET "admissionId" = COALESCE(
       (SELECT l."admissionId" FROM "AccountLine" l WHERE l."doseId" = d.id),
       (SELECT a.id FROM "Admission" a
        JOIN "Prescription" p ON p."patientId" = a."patientId"
        WHERE p.id = d."indicacionId" ${LATEST_STAY})
     ) WHERE "admissionId" IS NULL;
     UPDATE "VitalSign" v SET "authorUserId" = (
       SELECT u.id FROM "User" u WHERE u.name = v."authorName"
       ORDER BY u."createdAt" LIMIT 1
     ) WHERE "authorUserId" IS NULL;
     UPDATE "DoseAdministration" d SET "authorUserId" = (
       SELECT u.id FROM "User" u WHERE u.name = d."authorName"
       ORDER BY u."createdAt" LIMIT 1
     ) WHERE "authorUserId" IS NULL;`,
    false,
  );

  const orphans = psql(
    `SELECT
       (SELECT count(*) FROM "VitalSign"
        WHERE "admissionId" IS NULL OR "authorUserId" IS NULL)
       || ' ' ||
       (SELECT count(*) FROM "DoseAdministration"
        WHERE "admissionId" IS NULL OR "authorUserId" IS NULL)`,
    true,
  );
  const [vitals, doses] = orphans.split(' ').map(Number);
  if (vitals || doses) {
    throw new Error(
      `Hay ${vitals} signos vitales y ${doses} dosis viejos que no se pueden ` +
        'vincular a una internación o a un usuario. Borralos ' +
        '(WHERE "admissionId" IS NULL OR "authorUserId" IS NULL) o reseteá la ' +
        'base con docker compose down -v, y volvé a correr npm run prisma:push.',
    );
  }
}

function prepareAdmissionReason() {
  const type = psql(
    `SELECT data_type FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'Admission'
       AND column_name = 'reason'`,
    true,
  );
  if (type !== 'USER-DEFINED') {
    return;
  }
  psql(
    `ALTER TABLE "Admission" ALTER COLUMN "reason" TYPE TEXT USING "reason"::text`,
    false,
  );
}

function preparePatientBalances() {
  const state = psql(
    `SELECT CASE
      WHEN to_regclass('public."Patient"') IS NULL THEN 'missing'
      WHEN EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'Patient'
          AND column_name = 'appointmentBalance'
      ) THEN 'ready'
      ELSE 'legacy'
    END`,
    true,
  );
  if (state !== 'legacy') {
    return;
  }
  psql(
    `ALTER TABLE "Patient"
       ADD COLUMN "appointmentBalance" INTEGER NOT NULL DEFAULT 0,
       ADD COLUMN "supplyBalance" INTEGER NOT NULL DEFAULT 0;
     UPDATE "Patient" p SET
       "appointmentBalance" = COALESCE((
         SELECT SUM(c.amount) FROM "Charge" c
         JOIN "Appointment" a ON a.id = c."appointmentId"
         WHERE a."patientId" = p.id AND c.payer = 'paciente'
       ), 0),
       "supplyBalance" = COALESCE((
         SELECT SUM(l.amount) FROM "AccountLine" l
         JOIN "Admission" s ON s.id = l."admissionId"
         WHERE s."patientId" = p.id
       ), 0);`,
    false,
  );
}

function prepareBedStatus() {
  const hasLibre = psql(
    `SELECT EXISTS (
      SELECT 1 FROM pg_enum e
      JOIN pg_type t ON e.enumtypid = t.oid
      WHERE t.typname = 'BedStatus' AND e.enumlabel = 'libre'
    )`,
    true,
  );
  if (hasLibre === 't') {
    psql(`ALTER TYPE "BedStatus" RENAME VALUE 'libre' TO 'disponible'`, false);
  }
}

function prepareWings() {
  if (psql(`SELECT to_regclass('public."Bed"')`, true) === '') {
    return;
  }
  psql(
    `CREATE TABLE IF NOT EXISTS "Wing" (
       id TEXT PRIMARY KEY,
       name TEXT NOT NULL UNIQUE,
       code INTEGER NOT NULL UNIQUE,
       description TEXT,
       "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
       "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
     );
     ALTER TABLE "Bed" ADD COLUMN IF NOT EXISTS "wingId" TEXT;
     ALTER TABLE "Bed" ADD COLUMN IF NOT EXISTS sala TEXT;
     ALTER TABLE "Bed" ADD COLUMN IF NOT EXISTS habitacion TEXT;`,
    false,
  );

  const codes = psql(
    `SELECT DISTINCT LEFT(number, 1)
     FROM "Bed"
     WHERE "wingId" IS NULL AND number ~ '^[1-9]'`,
    true,
  );
  for (const code of codes.split('\n').filter(Boolean)) {
    const id = psql(`SELECT gen_random_uuid()::text`, true);
    psql(
      `INSERT INTO "Wing" (id, name, code, description, "createdAt", "updatedAt")
       VALUES ('${id}', 'Ala ${code}', ${code}, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       ON CONFLICT (code) DO NOTHING`,
      false,
    );
  }
  psql(
    `UPDATE "Bed" b SET
       "wingId" = w.id,
       sala = COALESCE(b.sala, w.name)
     FROM "Wing" w
     WHERE b."wingId" IS NULL
       AND LEFT(b.number, 1) = w.code::text`,
    false,
  );
  const orphans = psql(
    `SELECT count(*) FROM "Bed" WHERE "wingId" IS NULL`,
    true,
  );
  if (Number(orphans) > 0) {
    throw new Error(
      `Hay ${orphans} camas sin ala. Asignales un wingId o reseteá la base.`,
    );
  }
}

prepareAppointmentStatus();
prepareNursingStays();
prepareAdmissionReason();
preparePatientBalances();
prepareBedStatus();
prepareWings();
