import {
    Controller,
    Get,
} from '@nestjs/common';

import { PusherService } from './pusher.service';
import {
    PUSHER_CHANNELS,
    PUSHER_EVENTS,
} from './pusher.constants';
import {
    PusherNotificationType,
} from './pusher.types';

@Controller('pusher')
export class PusherController
{
    constructor(
        private readonly pusherService: PusherService,
    )
    {
    }

    @Get('test')
    async testPusher()
    {
        await this.pusherService.trigger(
            PUSHER_CHANNELS.ADMIN_MODERATOR,
            PUSHER_EVENTS.DOCUMENT_SUBMITTED,
            {
                type:
                    PusherNotificationType.DOCUMENT_SUBMITTED,

                title:
                    'Test Document Submission',

                message:
                    'This is a test notification from ToolShare backend.',

                userId:
                    'TEST-USER-001',

                userName:
                    'Test User',

                email:
                    'test@example.com',

                timestamp:
                    new Date(),
            },
        );

        return {
            message:
                'Pusher test event sent successfully',
        };
    }
}