import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Supply } from '@prisma/client';
import { isUniqueConstraintError } from '../prisma/prisma.errors';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSupplyDto } from './dto/create-supply.dto';
import { UpdateSupplyDto } from './dto/update-supply.dto';

@Injectable()
export class SuppliesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateSupplyDto) {
    try {
      return await this.prisma.supply.create({ data: dto });
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new ConflictException('Ya existe un insumo con ese nombre');
      }
      throw error;
    }
  }

  list() {
    return this.prisma.supply.findMany({ orderBy: { name: 'asc' } });
  }

  async findById(id: string) {
    const supply = await this.prisma.supply.findUnique({ where: { id } });
    if (!supply) {
      throw new NotFoundException('Insumo no encontrado');
    }
    return supply;
  }

  async update(id: string, dto: UpdateSupplyDto) {
    await this.findById(id);
    return this.prisma.supply.update({ where: { id }, data: dto });
  }

  async takeOneUnit(
    tx: Prisma.TransactionClient,
    supplyId: string,
  ): Promise<Supply> {
    const { count } = await tx.supply.updateMany({
      where: { id: supplyId, stock: { gt: 0 } },
      data: { stock: { decrement: 1 } },
    });
    if (count === 0) {
      throw new ConflictException('No queda stock de ese insumo');
    }
    return tx.supply.findUniqueOrThrow({ where: { id: supplyId } });
  }
}
