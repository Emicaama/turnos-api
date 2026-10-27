import { Prisma } from '@prisma/client';
import { AppointmentStatus } from '../common/enums/appointment-status.enum';
import {
  canReschedule,
  canTransition,
  chooseSlot,
  isEntreturnoStart,
  takenJustNow,
} from './utils';

describe('chooseSlot', () => {
  it('programa si el horario está libre', () => {
    expect(chooseSlot(false)).toBe('programado');
  });

  it('manda a la lista de espera si el horario está ocupado', () => {
    expect(chooseSlot(true)).toBe('lista_de_espera');
  });
});

describe('takenJustNow', () => {
  it('reconoce el conflicto de una transacción simultánea', () => {
    const error = new Prisma.PrismaClientKnownRequestError('conflict', {
      code: 'P2034',
      clientVersion: 'test',
    });
    expect(takenJustNow(error)).toBe(true);
  });

  it('ignora otros errores', () => {
    expect(takenJustNow(new Error('no'))).toBe(false);
  });
});

describe('isEntreturnoStart', () => {
  it('acepta los :15 y los :45', () => {
    expect(isEntreturnoStart(15)).toBe(true);
    expect(isEntreturnoStart(45)).toBe(true);
  });

  it('rechaza el resto de los minutos', () => {
    expect(isEntreturnoStart(0)).toBe(false);
    expect(isEntreturnoStart(30)).toBe(false);
  });
});

describe('status-transitions', () => {
  it('pasa de programado a sala de espera', () => {
    expect(
      canTransition(
        AppointmentStatus.Programado,
        AppointmentStatus.EnSalaDeEspera,
      ),
    ).toBe(true);
  });

  it('no atiende un programado sin pasar por sala de espera', () => {
    expect(
      canTransition(AppointmentStatus.Programado, AppointmentStatus.Atendido),
    ).toBe(false);
  });

  it('no deja avanzar un cancelado', () => {
    expect(
      canTransition(AppointmentStatus.Cancelado, AppointmentStatus.Atendido),
    ).toBe(false);
  });

  it('permite reprogramar solo un programado', () => {
    expect(canReschedule(AppointmentStatus.Programado)).toBe(true);
    expect(canReschedule(AppointmentStatus.EnSalaDeEspera)).toBe(false);
    expect(canReschedule(AppointmentStatus.Cancelado)).toBe(false);
  });
});
