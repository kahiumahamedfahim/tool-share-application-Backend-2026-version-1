import {
    Body,
    Controller,
    Get,
    Post,
    Req,
    Res,
    UseGuards,
} from "@nestjs/common";

import type { Request, Response } from "express";

import { LoginDto } from "./dto/login-dto";
import { AuthService } from "./auth-service";
import { JwtAuthGuard } from "./jwt-auth.guard";

@Controller("auth")
export class AuthController {
    constructor(
        private readonly authService: AuthService,
    ) {}

    @Post("login")
    async login(
        @Body() dto: LoginDto,
        @Res({ passthrough: true }) response: Response,
    ) {
        console.log("controller hit");

        const result = await this.authService.login(dto);

        response.cookie(
            "access_token",
            result.accessToken,
            {
                httpOnly: true,
                secure: false,
                sameSite: "lax",
                maxAge: 30 * 60 * 1000,
            },
        );

        return {
            message: "Login successful",
            userId: result.userId,
            role: result.role,
            accessToken: result.accessToken,
        };
    }

    @Get("profile")
    @UseGuards(JwtAuthGuard)
    async getProfile(@Req() request: Request) {
        return {
            userId: (request as any).user.userId,
            role: (request as any).user.role,
        };
    }

    @Post("logout")
    async logout(
        @Res({ passthrough: true }) response: Response,
    ) {
        response.clearCookie(
            "access_token",
            {
                httpOnly: true,
                secure: false,
                sameSite: "lax",
            },
        );

        return {
            message: "Logout successful",
        };
    }
}