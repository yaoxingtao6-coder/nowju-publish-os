import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ConfirmationService } from './confirmation.service';

@Controller('publish-confirmations')
export class ConfirmationController {
  constructor(private readonly confirmations: ConfirmationService) {}

  @Get('pending')
  listPending() {
    return this.confirmations.listPending();
  }

  @Post(':publishJobId/pending')
  ensurePending(@Param('publishJobId') publishJobId: string) {
    return this.confirmations.ensurePending(publishJobId);
  }

  @Post(':publishJobId/decision')
  decide(
    @Param('publishJobId') publishJobId: string,
    @Body() body: { decision: 'approved' | 'rejected'; note?: string },
  ) {
    return this.confirmations.decide(publishJobId, body.decision, body.note);
  }
}
