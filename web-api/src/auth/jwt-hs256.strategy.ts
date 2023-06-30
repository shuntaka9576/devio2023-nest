import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable } from '@nestjs/common';

const LINE_CHANNEL_SECRET = process.env.LINE_CHANNEL_SECRET;

export interface JwtPayload {
  iss: string;
  sub: string;
  aud: string;
  exp: number;
  iat: number;
  amr: string[];
  name: string;
  picture: string;
}

export const jwtHs256Strategy = 'jwtHs256Strategy';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, jwtHs256Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: LINE_CHANNEL_SECRET,
      algorithms: ['HS256'],
    });
  }

  async validate(payload: JwtPayload): Promise<JwtPayload> {
    return {
      iss: payload.iss,
      sub: payload.sub,
      aud: payload.aud,
      exp: payload.exp,
      iat: payload.iat,
      amr: payload.amr,
      name: payload.name,
      picture: payload.picture,
    };
  }
}
