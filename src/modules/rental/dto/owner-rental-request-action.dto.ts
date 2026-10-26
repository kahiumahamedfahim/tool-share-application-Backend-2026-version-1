import {
    IsEnum,
    IsNotEmpty,
} from "class-validator";

export enum OwnerRentalRequestAction {
    ACCEPT = "ACCEPT",
    REJECT = "REJECT",
}

export class OwnerRentalRequestActionDto {

    @IsEnum(OwnerRentalRequestAction)
    @IsNotEmpty()
    action!: OwnerRentalRequestAction;
}