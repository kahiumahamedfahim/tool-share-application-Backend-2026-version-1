import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';

import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
  ) {}

  async canActivate(
    context: ExecutionContext,
  ): Promise<boolean> {

    const request =
      context.switchToHttp().getRequest();
      console.log('COOKIE HEADER:', request.headers.cookie);
console.log('PARSED COOKIES:', request.cookies);

    const token =
      this.extractTokenFromCookie(request);

    if (!token) {
      throw new UnauthorizedException(
        'Authentication required.',
      );
    }

    try {
      const payload =
        await this.jwtService.verifyAsync(token);

      request['user'] = payload;
    } catch {
      throw new UnauthorizedException(
        'Invalid or expired token.',
      );
    }

    return true;
  }

  private extractTokenFromCookie(
    request: Request,
  ): string | undefined {
    return request.cookies?.access_token;
  }
}