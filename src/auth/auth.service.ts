import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { Role } from '../common/enums/role.enum';
import { UsersService } from '../users/users.service';
import type { AuthUser } from './auth-user';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  async login(dto: LoginDto): Promise<{ accessToken: string }> {
    const user = await this.usersService.findByEmail(dto.email);
    if (!user) {
      throw new UnauthorizedException('Credenciales inválidas');
    }
    const matches = await bcrypt.compare(dto.password, user.passwordHash);
    if (!matches) {
      throw new UnauthorizedException('Credenciales inválidas');
    }
    const payload: AuthUser = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role as Role,
      professionalId: user.professionalId ?? undefined,
    };
    return { accessToken: await this.jwtService.signAsync(payload) };
  }
}
