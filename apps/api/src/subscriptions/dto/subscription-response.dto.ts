import { ApiProperty } from '@nestjs/swagger';
import {
  SubscriptionPlan,
  SubscriptionStatus,
} from '../../generated/prisma/enums';

export class SubscriptionResponseDto {
  @ApiProperty({ enum: SubscriptionPlan }) plan!: SubscriptionPlan;
  @ApiProperty({ enum: SubscriptionStatus }) status!: SubscriptionStatus;
  @ApiProperty({ example: 1 }) maxTournaments!: number;
}
