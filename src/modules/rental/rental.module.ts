import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";

import { RentalRequest } from "./entity/rental-request.entity";
import { NegotiationOffer } from "./entity/negotiation-offer.entity";
import {
    ActualRental,
    RentalStateHistory,
} from "./entity/actual-rental.entity";
import { RentalPayment } from "./entity/rental-payment.entity";
import {
    RentalCharge,
    RentalChargeEvent,
} from "./entity/rental-charge.entity";
import {
    CheckpointMedia,
    HandoverCheckpoint,
} from "./entity/handover-checkpoint.entity";
import { HandoverOtp } from "./entity/handover-otp.entity";
import { RentalIssue } from "./entity/rental-issue.entity";
import { HandoverRiderAssignment } from "./entity/handover-rider-assignment.entity";

import { Product } from "../Product/Entity/product.entity";
import { User } from "../users/entity/user-entity";

import { RentalService } from "./rental.service";
import { RentalController } from "./rental.controller";

import { HandoverService } from "./handover.service";
import { HandoverOtpService } from "./handover-otp.service";
import { HandoverController } from "./handover.controller";

import { PusherModule } from "src/pusher/pusher.module";
import { AuthModule } from "src/auth/auth-module";
import { EmailModule } from "src/email/email.module";


@Module({
    imports: [
        TypeOrmModule.forFeature([
            RentalRequest,
            NegotiationOffer,
            ActualRental,
            RentalStateHistory,
            RentalPayment,
            RentalCharge,
            RentalChargeEvent,
            HandoverCheckpoint,
            CheckpointMedia,
            HandoverOtp,
            HandoverRiderAssignment,
            RentalIssue,
            Product,
            User,
        ]),

        PusherModule,
        AuthModule,
        EmailModule,
    ],

    controllers: [
        RentalController,
        HandoverController,
    ],

    providers: [
        RentalService,
        HandoverService,
        HandoverOtpService,
    ],

    exports: [
        RentalService,
        HandoverService,
    ],
})
export class RentalModule {}
