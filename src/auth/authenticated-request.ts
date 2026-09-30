import { Request } from 'express';
import { UserRole } from '../modules/users/enums/user-role-enum';

export interface AuthenticatedRequest extends Request {
  user: {
    userId: string;
    role: UserRole;
  };
}