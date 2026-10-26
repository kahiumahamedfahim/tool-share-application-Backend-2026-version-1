import {
    IsBoolean,
    IsEnum,
    IsNotEmpty,
    IsOptional,
    IsString,
    Length,
    MaxLength,
} from "class-validator";

import { HandoverStage } from "../enum/handover-stage.enum";

// =====================================================
// RIDER - SUBMIT STAGE MEDIA
// (multipart upload handled by the controller;
//  this DTO carries the optional note)
// =====================================================

export class SubmitHandoverNoteDto {

    @IsOptional()
    @IsString()
    @MaxLength(1000)
    note?: string;
}

// =====================================================
// RIDER - VERIFY STAGE OTP
// =====================================================

export class VerifyHandoverOtpDto {

    @IsString()
    @IsNotEmpty()
    @Length(6, 6)
    code!: string;
}

// =====================================================
// MODERATOR - WAREHOUSE GATE VERDICT
// =====================================================

export class ModeratorGateDto {

    @IsBoolean()
    @IsNotEmpty()
    approved!: boolean;

    @IsOptional()
    @IsString()
    @MaxLength(1000)
    note?: string;
}

// =====================================================
// MODERATOR - EARLY RETURN DECISION
// =====================================================

export class EarlyReturnDecisionDto {

    @IsBoolean()
    @IsNotEmpty()
    approved!: boolean;

    @IsOptional()
    @IsString()
    @MaxLength(1000)
    note?: string;
}

export class AssignHandoverRiderDto {
    @IsString()
    @IsNotEmpty()
    riderId!: string;
}

// =====================================================
// SHARED - STAGE PATH PARAM VALIDATION
// =====================================================

export class HandoverStageParamDto {

    @IsEnum(HandoverStage)
    @IsNotEmpty()
    stage!: HandoverStage;
}
