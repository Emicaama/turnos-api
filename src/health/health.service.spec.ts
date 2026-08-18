import { PrismaService } from '../prisma/prisma.service';
import { HealthService } from './health.service';

describe('HealthService', () => {
  it('devuelve ok si Mongo responde ping', async () => {
    const prisma = {
      $runCommandRaw: jest.fn().mockResolvedValue({ ok: 1 }),
    } as unknown as PrismaService;
    const service = new HealthService(prisma);
    await expect(service.status()).resolves.toEqual({
      status: 'ok',
      mongo: true,
    });
  });

  it('devuelve down si Mongo no responde', async () => {
    const prisma = {
      $runCommandRaw: jest.fn().mockRejectedValue(new Error('offline')),
    } as unknown as PrismaService;
    const service = new HealthService(prisma);
    await expect(service.status()).resolves.toEqual({
      status: 'down',
      mongo: false,
    });
  });
});
