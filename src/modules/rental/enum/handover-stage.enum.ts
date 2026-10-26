// =====================================================
// PHASE 13 - HANDOVER / CHAIN OF CUSTODY
// =====================================================

// The 6 mandatory checkpoints, in strict order.
// Stage N is only available after stage N-1
// has been VERIFIED.
// (Stage 2 and 5 are moderator warehouse gates.)

export enum HandoverStage {
    // Stage 1: Rider picks up the product from
    // the owner. Media by rider + OTP verified
    // against the OWNER's email.
    OWNER_HANDOVER = "OWNER_HANDOVER",

    // Stage 2: Product arrives at the warehouse.
    // Moderator inspects and verifies.
    // (Moderator ID saved to DB.)
    WAREHOUSE_IN = "WAREHOUSE_IN",

    // Stage 3: Rider delivers the product to the
    // renter. Media by rider + OTP verified
    // against the RENTER's email.
    // Rental becomes ACTIVE, cash collected.
    DELIVERED_TO_RENTER = "DELIVERED_TO_RENTER",

    // Stage 4: Rider picks the product up from
    // the renter after the term. Media by rider +
    // OTP verified against the RENTER's email.
    // (Early return requires moderator approval.)
    RETURN_PICKUP = "RETURN_PICKUP",

    // Stage 5: Returned product back at the
    // warehouse. Moderator inspects again.
    RETURN_WAREHOUSE_IN = "RETURN_WAREHOUSE_IN",

    // Stage 6: Rider returns the product to the
    // owner. Media by rider + OTP verified
    // against the OWNER's email. Cash handed
    // over to the owner.
    OWNER_RETURN = "OWNER_RETURN",
}

export enum HandoverCheckpointStatus {
    PENDING = "PENDING",
    VERIFIED = "VERIFIED",
    REJECTED = "REJECTED",
}

export enum CheckpointMediaType {
    PHOTO = "PHOTO",
    VIDEO = "VIDEO",
}

// OTP purposes — each maps to the party whose
// email receives the code.

export enum HandoverOtpPurpose {
    OWNER_HANDOVER = "OWNER_HANDOVER",
    RENTER_DELIVERY = "RENTER_DELIVERY",
    RENTER_RETURN = "RENTER_RETURN",
    OWNER_RETURN = "OWNER_RETURN",
}

// Stages that require rider media upload.

export const RIDER_MEDIA_STAGES: HandoverStage[] = [
    HandoverStage.OWNER_HANDOVER,
    HandoverStage.DELIVERED_TO_RENTER,
    HandoverStage.RETURN_PICKUP,
    HandoverStage.OWNER_RETURN,
];

// Stages that require moderator verdicts.

export const MODERATOR_GATE_STAGES: HandoverStage[] = [
    HandoverStage.WAREHOUSE_IN,
    HandoverStage.RETURN_WAREHOUSE_IN,
];

// Stage → OTP purpose mapping.

export const STAGE_OTP_PURPOSES: Record<
    string,
    HandoverOtpPurpose
> = {
    [HandoverStage.OWNER_HANDOVER]:
        HandoverOtpPurpose.OWNER_HANDOVER,
    [HandoverStage.DELIVERED_TO_RENTER]:
        HandoverOtpPurpose.RENTER_DELIVERY,
    [HandoverStage.RETURN_PICKUP]:
        HandoverOtpPurpose.RENTER_RETURN,
    [HandoverStage.OWNER_RETURN]:
        HandoverOtpPurpose.OWNER_RETURN,
};

// Ordered stage list for sequential gating.

export const HANDOVER_STAGE_ORDER: HandoverStage[] = [
    HandoverStage.OWNER_HANDOVER,
    HandoverStage.WAREHOUSE_IN,
    HandoverStage.DELIVERED_TO_RENTER,
    HandoverStage.RETURN_PICKUP,
    HandoverStage.RETURN_WAREHOUSE_IN,
    HandoverStage.OWNER_RETURN,
];
