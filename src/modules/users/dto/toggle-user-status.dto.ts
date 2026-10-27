import { IsEnum } from "class-validator";
import { UserStatus } from "../enums/user-status-enum";

export class ToggleUserStatusDto {
    @IsEnum(UserStatus)
    status!: UserStatus;
}
