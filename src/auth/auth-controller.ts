import { Body, Controller, Post, Res } from '@nestjs/common';
import type  { Response } from 'express';

import { LoginDto } from './dto/login-dto';
import { AuthService } from './auth-service';


@Controller('auth')
export class AuthController {

  constructor(
    private readonly authService: AuthService,
  ) {}

  @Post('login')
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) response: Response
  ) {

    const result = await this.authService.login(dto);

    response.cookie(
      'access_token',
      result.accessToken,
      {
        httpOnly: true,
        secure: false,
        sameSite: 'lax',
        maxAge: 30 * 60 * 1000,
      },
    );

    return {
      message: 'Login successful',
      userId: result.userId,
      role: result.role,
      accessToken: result.accessToken,
    };
  }
}