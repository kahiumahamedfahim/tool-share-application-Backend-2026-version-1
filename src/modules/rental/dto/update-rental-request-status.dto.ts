import { IsEnum } from "class-validator";
import { RentalRequestStatus } from "../enum/rental-request-status.enum";

export class UpdateRentalRequestStatusDto {
    @IsEnum(RentalRequestStatus)
    status!: RentalRequestStatus;
}