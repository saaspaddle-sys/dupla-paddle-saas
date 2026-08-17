import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { PlayersService } from './players.service';
import { RegisterPlayerController } from './register-player.controller';

@Module({
  imports: [PrismaModule],
  controllers: [RegisterPlayerController],
  providers: [PlayersService],
  // Lo necesita el futuro AuthModule para resolver si un User tiene Player
  // al armar el JWT, y el alta por el organizador (slice futuro) reusa
  // este mismo service.
  exports: [PlayersService],
})
export class PlayersModule {}
