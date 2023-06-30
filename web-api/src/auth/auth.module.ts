import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { LineHttpBearerStrategy } from './http-bearer.strategy';

@Module({
  imports: [PassportModule],
  providers: [LineHttpBearerStrategy],
})
export class AuthModule {}
