import { Role } from '../common/enums/role.enum';

export type AuthUser = {
  id: string;
  email: string;
  name: string;
  role: Role;
  professionalId?: string;
};
