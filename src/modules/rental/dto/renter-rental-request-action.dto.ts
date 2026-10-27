import { IsNotEmpty } from "class-validator";

export enum RenterRentalRequestAction {
    CONFIRM = "CONFIRM",
    REJECT = "REJECT",
}

export class RenterRentalRequestActionDto {

    @IsNotEmpty()
    action!: RenterRentalRequestAction;
}
