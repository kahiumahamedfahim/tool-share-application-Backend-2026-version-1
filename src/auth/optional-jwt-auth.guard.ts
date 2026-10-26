import {
    CanActivate,
    ExecutionContext,
    Injectable,
} from "@nestjs/common";

import { JwtService } from "@nestjs/jwt";

@Injectable()
export class OptionalJwtAuthGuard implements CanActivate
{
    constructor(
        private readonly jwtService: JwtService,
    )
    {
    }

    async canActivate(
        context: ExecutionContext,
    ): Promise<boolean>
    {
        const request =
            context.switchToHttp().getRequest();

        const token =
            request.cookies?.access_token;

        if (!token)
        {
            return true;
        }

        try
        {
            const payload =
                await this.jwtService.verifyAsync(token);

            request.user = payload;
        }
        catch
        {
            request.user = undefined;
        }

        return true;
    }
}