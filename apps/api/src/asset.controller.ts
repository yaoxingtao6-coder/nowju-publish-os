import { Body, Controller, Get, Post } from '@nestjs/common';
import { AssetService } from './asset.service';

@Controller('media-assets')
export class AssetController {
  constructor(private readonly assets: AssetService) {}

  @Get()
  list() {
    return this.assets.list();
  }

  @Post()
  create(@Body() body: { kind: string; fileName: string; storageUrl: string; mimeType?: string; sizeBytes?: number; metadata?: Record<string, unknown> }) {
    return this.assets.create(body);
  }
}
