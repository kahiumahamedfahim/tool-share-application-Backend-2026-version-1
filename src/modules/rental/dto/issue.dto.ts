import {
    IsEnum,
    IsNotEmpty,
    IsOptional,
    IsString,
    MaxLength,
    IsNumber,
    Min,
    Max,
    IsDateString,
} from "class-validator";

import {
    IssueCategory,
    IssueSeverity,
    IssueStatus,
    IssueResolution,
} from "../entity/rental-issue.entity";

// =====================================================
// CREATE ISSUE
// =====================================================

export class CreateIssueDto {
    @IsNotEmpty()
    @IsString()
    rentalRequestId!: string;

    @IsNotEmpty()
    @IsEnum(IssueCategory)
    category!: IssueCategory;

    @IsOptional()
    @IsEnum(IssueSeverity)
    severity?: IssueSeverity;

    @IsNotEmpty()
    @IsString()
    @MaxLength(200)
    title!: string;

    @IsOptional()
    @IsString()
    @MaxLength(2000)
    description?: string;

    @IsOptional()
    @IsString()
    @MaxLength(500)
    evidenceReference?: string;
}

// =====================================================
// RESPOND TO ISSUE (owner/renter)
// =====================================================

export class RespondToIssueDto {
    @IsNotEmpty()
    @IsString()
    @MaxLength(2000)
    response!: string;

    @IsOptional()
    @IsString()
    @MaxLength(500)
    evidenceReference?: string;
}

// =====================================================
// MODERATOR DECISION ON ISSUE
// =====================================================

export class DecideIssueDto {
    @IsNotEmpty()
    @IsEnum(IssueResolution)
    resolution!: IssueResolution;

    @IsOptional()
    @IsNumber()
    @Min(0)
    resolutionAmount?: number;

    @IsOptional()
    @IsString()
    @MaxLength(2000)
    resolutionNote?: string;

    @IsOptional()
    @IsEnum(IssueStatus)
    status?: IssueStatus;
}

// =====================================================
// ISSUE QUERY FILTER
// =====================================================

export class IssueQueryDto {
    @IsOptional()
    @IsString()
    rentalRequestId?: string;

    @IsOptional()
    @IsString()
    rentalId?: string;

    @IsOptional()
    @IsEnum(IssueStatus)
    status?: IssueStatus;

    @IsOptional()
    @IsEnum(IssueCategory)
    category?: IssueCategory;
}
