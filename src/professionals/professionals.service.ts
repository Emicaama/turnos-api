import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { CreateProfessionalDto } from './dto/create-professional.dto';
import { UpdateProfessionalDto } from './dto/update-professional.dto';

@Injectable()
export class ProfessionalsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
  ) {}

  async create(dto: CreateProfessionalDto) {
    const professional = await this.prisma.professional.create({
      data: {
        firstName: dto.firstName,
        lastName: dto.lastName,
        userId: dto.userId,
        specialtyIds: dto.specialtyIds ?? [],
        branchIds: dto.branchIds ?? [],
      },
    });
    if (dto.userId) {
      await this.usersService.linkProfessional(dto.userId, professional.id);
    }
    return professional;
  }

  list() {
    return this.prisma.professional.findMany({
      orderBy: { lastName: 'asc' },
    });
  }

  async findById(id: string) {
    const professional = await this.prisma.professional.findUnique({
      where: { id },
    });
    if (!professional) {
      throw new NotFoundException('Profesional no encontrado');
    }
    return professional;
  }

  async update(id: string, dto: UpdateProfessionalDto) {
    await this.findById(id);
    return this.prisma.professional.update({
      where: { id },
      data: {
        firstName: dto.firstName,
        lastName: dto.lastName,
        userId: dto.userId,
        specialtyIds: dto.specialtyIds,
        branchIds: dto.branchIds,
      },
    });
  }
}
