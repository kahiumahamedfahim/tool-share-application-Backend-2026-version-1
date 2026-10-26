export interface PusherNotificationData
{
    type: PusherNotificationType;
    title: string;
    message: string;
    userId: string;
    userName: string;
    email: string;
    timestamp: Date;
}
export enum PusherNotificationType
 {
    DOCUMENT_SUBMITTED = 'DOCUMENT_SUBMITTED',
    DOCUMENT_APPROVED = 'DOCUMENT_APPROVED',
    DOCUMENT_REJECTED = 'DOCUMENT_REJECTED',

    NEW_RENTAL_REQUEST = 'NEW_RENTAL_REQUEST',

    NEGOTIATION_OFFER = 'NEGOTIATION_OFFER',

    RENTAL_REQUEST_ACCEPTED = 'RENTAL_REQUEST_ACCEPTED',

    RENTAL_REQUEST_REJECTED = 'RENTAL_REQUEST_REJECTED',

    MANUAL_PAYMENT = 'MANUAL_PAYMENT',
}