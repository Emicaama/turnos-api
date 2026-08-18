import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { User } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { isUniqueConstraintError } from '../prisma/prisma.errors';
import { CreateUserDto } from './dto/create-user.dto';

const publicUser = { omit: { passwordHash: true } } as const;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateUserDto) {
    const passwordHash = await bcrypt.hash(dto.password, 10);
    try {
      return await this.prisma.user.create({
        data: {
          email: dto.email.toLowerCase(),
          passwordHash,
          name: dto.name,
          role: dto.role,
          professionalId: dto.professionalId,
        },
        ...publicUser,
      });
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new ConflictException('El email ya está registrado');
      }
      throw error;
    }
  }

  findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });
  }

  async findById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      ...publicUser,
    });
    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }
    return user;
  }

  list() {
    return this.prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      ...publicUser,
    });
  }

  async linkProfessional(
    userId: string,
    professionalId: string,
  ): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { professionalId },
    });
  }
}
