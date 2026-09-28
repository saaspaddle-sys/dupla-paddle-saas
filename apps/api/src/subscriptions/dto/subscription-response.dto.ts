import { ApiProperty } from '@nestjs/swagger';
import {
  SubscriptionPlan,
  SubscriptionStatus,
} from '../../generated/prisma/enums';
import { PendingUpgradeDto } from './immediate-upgrade.dto';
import { PlanDowngradeQuoteResponseDto } from './plan-downgrade.dto';

export class SubscriptionResponseDto {
  @ApiProperty({ enum: SubscriptionPlan }) plan!: SubscriptionPlan;
  @ApiProperty({ enum: SubscriptionStatus }) status!: SubscriptionStatus;
  @ApiProperty({ example: 1 }) maxTournaments!: number;
  @ApiProperty({ example: '2026-10-21T00:00:00.000Z', nullable: true })
  currentPeriodEndsAt!: Date | null;
  @ApiProperty({ example: true }) renewsAutomatically!: boolean;
  @ApiProperty({ type: PendingUpgradeDto, nullable: true })
  pendingUpgrade!: PendingUpgradeDto | null;
  @ApiProperty({ type: PlanDowngradeQuoteResponseDto, nullable: true })
  pendingDowngrade!: PlanDowngradeQuoteResponseDto | null;
}
