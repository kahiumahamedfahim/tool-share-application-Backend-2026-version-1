import { Injectable, UnauthorizedException } from "@nestjs/common";
import { Repository } from "typeorm";
import { DataSource } from "typeorm";
import { User } from "src/modules/users/entity/user-entity";
import { LoginDto } from "./dto/login-dto";
import * as bcrypt from 'bcrypt';
import { UserStatus } from "src/modules/users/enums/user-status-enum";
import { JwtService } from '@nestjs/jwt';
import { JwtModule } from '@nestjs/jwt';


@Injectable()
export class AuthService 
{
    private readonly userRepository : Repository<User>
    constructor(private readonly dataSource : DataSource,
    private readonly jwtService : JwtService)
    {
        this.userRepository=this.dataSource.getRepository(User);
        console.log('JWT SECRET:', process.env.JWT_SECRET);
    }

    async login(dto : LoginDto)
    {
        const user= await this.userRepository.findOne(
            {
                where :
                {
                    email : dto.email,
                }
            }
        );
        if(!user)
        {
            throw new UnauthorizedException('invalid email ,user not found ');
        }
        const isPassword=await bcrypt.compare(dto.password, user.password);
        if(!isPassword)
        {
            throw new UnauthorizedException('incorrect passowrd');
        }
        if(user.status
            !==UserStatus.ACTIVE)
        {
            throw new UnauthorizedException('your account ;is not active yet!');
        }

        const payload= 
        {
            userId : user.userId,
            role :user.role,
        };
        const accessToken= await this.jwtService.signAsync(payload);
        return {
                    accessToken,
                    userId: user.userId,
                    role: user.role,
    };
    }
}