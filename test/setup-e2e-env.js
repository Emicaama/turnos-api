process.env.JWT_SECRET =
  process.env.JWT_SECRET || 'test-secret-16chars';
process.env.JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '8h';
process.env.CLINIC_TZ =
  process.env.CLINIC_TZ || 'America/Argentina/Buenos_Aires';
process.env.PORT = process.env.PORT || '3000';
