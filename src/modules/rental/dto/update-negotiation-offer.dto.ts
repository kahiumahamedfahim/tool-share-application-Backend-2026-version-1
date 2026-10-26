import {
    IsEnum,
    IsNotEmpty,
} from "class-validator";

export enum NegotiationOfferAction {
    ACCEPT = "ACCEPT",
    REJECT = "REJECT",
}

export class UpdateNegotiationOfferDto {

    @IsEnum(NegotiationOfferAction)
    @IsNotEmpty()
    action!: NegotiationOfferAction;
}