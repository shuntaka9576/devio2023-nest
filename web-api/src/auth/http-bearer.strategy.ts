import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { Logger } from '@nestjs/common';
import { Strategy } from 'passport-http-bearer';
import * as Line from '../utils/line/api';
import { asyncLocalStorage } from '../infrastructures/async-storage';

export interface UserProfile {
  sub: string;
}

export const lineStrategy = 'lineStrategy';

@Injectable()
export class LineHttpBearerStrategy extends PassportStrategy(
  Strategy,
  lineStrategy,
) {
  private readonly logger = new Logger(LineHttpBearerStrategy.name);

  async validate(bearerToken: string): Promise<UserProfile> {
    try {
      // 検証失敗した場合、実行時例外に落ちる
      await Line.verifyAccessToken(bearerToken);
      const userInfo = await Line.getUserInfo(bearerToken);

      const store = asyncLocalStorage.getStore();
      if (store != null) {
        asyncLocalStorage.run(store, () => {
          store.lineId = userInfo.sub;
        });
      }

      return {
        sub: userInfo.sub,
      };
    } catch (e) {
      this.logger.log('UnauthorizedRequest', {
        bearerToken: bearerToken,
        error: e,
      });

      throw new UnauthorizedException();
    }
  }
}
