import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { AccountService, AuthStatus } from './account.service';

@Controller('platform-accounts')
export class AccountController {
  constructor(private readonly accounts: AccountService) {}

  @Get()
  list() {
    return this.accounts.list();
  }

  @Post()
  create(@Body() body: { platform: string; displayName: string; authMode?: string }) {
    return this.accounts.create(body);
  }

  @Patch(':id/status')
  updateStatus(
    @Param('id') id: string,
    @Body() body: { authStatus: AuthStatus; expiresAt?: string | null },
  ) {
    return this.accounts.updateStatus(id, body.authStatus, body.expiresAt);
  }
}
