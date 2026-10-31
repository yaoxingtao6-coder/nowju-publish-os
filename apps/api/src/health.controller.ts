import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class HealthController {
  @Get()
  getHealth() {
    return {
      ok: true,
      service: 'nowju-api',
      version: '0.1.0',
      timestamp: new Date().toISOString(),
    };
  }
}
