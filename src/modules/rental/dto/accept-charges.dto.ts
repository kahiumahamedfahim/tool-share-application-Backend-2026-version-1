import { IsNotEmpty } from "class-validator";

export enum ChargesAction {
    ACCEPT = "ACCEPT",
    REJECT = "REJECT",
}

export class AcceptChargesDto {

    @IsNotEmpty()
    action!: ChargesAction;
}
