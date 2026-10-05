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
    DOCUMENT_SUBMITTED =
        'DOCUMENT_SUBMITTED',

    DOCUMENT_APPROVED =
        'DOCUMENT_APPROVED',

    DOCUMENT_REJECTED =
        'DOCUMENT_REJECTED',
}