import { BadRequestException, Injectable } from '@nestjs/common';

export const SUPPORTED_PLATFORMS = [
  'xiaohongshu',
  'douyin',
  'kuaishou',
  'wechat_channels',
  'weibo',
  'bilibili',
] as const;

export type SupportedPlatform = (typeof SUPPORTED_PLATFORMS)[number];
export type AdapterMode = 'manual' | 'official_api' | 'mock';

export type AdapterResult = {
  status: 'awaiting_confirmation' | 'published' | 'needs_auth';
  mode: AdapterMode;
  message: string;
};

type AdapterDescriptor = {
  platform: SupportedPlatform;
  mode: AdapterMode;
  automaticPublishing: boolean;
};

@Injectable()
export class PlatformAdapterService {
  supports(platform: string): platform is SupportedPlatform {
    return SUPPORTED_PLATFORMS.includes(platform as SupportedPlatform);
  }

  describe(platform: string): AdapterDescriptor {
    if (!this.supports(platform)) {
      throw new BadRequestException(`UNSUPPORTED_PLATFORM:${platform}`);
    }

    return {
      platform,
      mode: 'manual',
      automaticPublishing: false,
    };
  }

  list(): AdapterDescriptor[] {
    return SUPPORTED_PLATFORMS.map((platform) => this.describe(platform));
  }

  validateContent(input: { platform: string; title?: string | null; content?: string | null }) {
    if (!this.supports(input.platform)) {
      throw new BadRequestException(`UNSUPPORTED_PLATFORM:${input.platform}`);
    }
    if (!input.title?.trim() && !input.content?.trim()) {
      throw new BadRequestException('EMPTY_CONTENT');
    }
    return true;
  }

  async prepare(platform: string): Promise<AdapterResult> {
    const descriptor = this.describe(platform);

    if (descriptor.mode === 'official_api') {
      return {
        status: 'needs_auth',
        mode: descriptor.mode,
        message: `${platform} official API adapter requires account authorization.`,
      };
    }

    return {
      status: 'awaiting_confirmation',
      mode: descriptor.mode,
      message: `${platform} is prepared for the compliant human-confirmation publishing flow.`,
    };
  }
}
