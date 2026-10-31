import { Injectable } from '@nestjs/common';

export const SUPPORTED_PLATFORMS = [
  'xiaohongshu',
  'douyin',
  'kuaishou',
  'wechat_channels',
  'weibo',
  'bilibili',
] as const;

export type SupportedPlatform = (typeof SUPPORTED_PLATFORMS)[number];

export type AdapterResult = {
  status: 'awaiting_confirmation' | 'published';
  mode: 'human_confirmation' | 'official_api';
  message: string;
};

@Injectable()
export class PlatformAdapterService {
  supports(platform: string): platform is SupportedPlatform {
    return SUPPORTED_PLATFORMS.includes(platform as SupportedPlatform);
  }

  async prepare(platform: string): Promise<AdapterResult> {
    if (!this.supports(platform)) {
      throw new Error(`UNSUPPORTED_PLATFORM:${platform}`);
    }

    return {
      status: 'awaiting_confirmation',
      mode: 'human_confirmation',
      message: `${platform} adapter is ready for account authorization and final human confirmation flow.`,
    };
  }
}
