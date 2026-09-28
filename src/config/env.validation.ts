export type AppEnv = {
  PORT: number;
  DATABASE_URL: string;
  JWT_SECRET: string;
  JWT_EXPIRES_IN: string;
  CLINIC_TZ: string;
};

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

export function validateEnv(config: Record<string, unknown>): AppEnv {
  const databaseUrl = asString(config.DATABASE_URL).trim();
  const jwtSecret = asString(config.JWT_SECRET).trim();

  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required');
  }
  if (jwtSecret.length < 16) {
    throw new Error('JWT_SECRET must be at least 16 characters');
  }

  process.env.DATABASE_URL = databaseUrl;

  const portRaw = config.PORT;
  const port =
    typeof portRaw === 'number' ? portRaw : Number(asString(portRaw, '3000'));

  return {
    PORT: port,
    DATABASE_URL: databaseUrl,
    JWT_SECRET: jwtSecret,
    JWT_EXPIRES_IN: asString(config.JWT_EXPIRES_IN, '8h'),
    CLINIC_TZ: asString(config.CLINIC_TZ, 'UTC'),
  };
}
