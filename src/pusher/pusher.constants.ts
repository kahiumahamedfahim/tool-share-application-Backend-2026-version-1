export const PUSHER_CHANNELS = {
    ADMIN_MODERATOR: 'admin-moderator-channel',

    OWNER: (userId: string) => `owner-${userId}-channel`,

    RENTER: (userId: string) => `renter-${userId}-channel`,
};

export const PUSHER_EVENTS = {
    DOCUMENT_SUBMITTED: 'document-submitted',

    NEW_RENTAL_REQUEST: 'new-rental-request',

    NEW_NEGOTIATION_OFFER: 'new-negotiation-offer',

    RENTAL_REQUEST_ACCEPTED: 'rental-request-accepted',

    RENTAL_REQUEST_REJECTED: 'rental-request-rejected',

    MANUAL_PAYMENT_UPDATE: 'payment-update',

    HANDOVER_VERIFICATION: 'handover-verification',

    RETURN_VERIFICATION: 'return-verification',
};