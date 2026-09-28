SELECT 'CREATE DATABASE turnos_test'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'turnos_test')\gexec
