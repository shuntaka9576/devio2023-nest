import { Module } from '@nestjs/common';
import { GetSessionUseCase } from 'src/domains/get-session-use-case';
import { PrismaClientProvider } from 'src/infrastructures/prisma-provider';
import { SessionRepository } from 'src/infrastructures/session-repository';
import { SessionResolver } from './resolvers/session-resolver';

@Module({
  imports: [],
  providers: [
    SessionResolver,
    GetSessionUseCase,
    SessionRepository,
    PrismaClientProvider,
  ],
})
export class HandlerModule {}
