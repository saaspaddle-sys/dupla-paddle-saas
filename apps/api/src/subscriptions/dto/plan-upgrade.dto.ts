import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';

export class PlanUpgradeRequestDto {
  @ApiProperty({ enum: ['pro'] })
  @IsIn(['pro'])
  targetPlan!: 'pro';
}

export class PlanUpgradeQuoteResponseDto {
  @ApiProperty({ enum: ['pro'] }) targetPlan!: 'pro';
  @ApiProperty({ example: '25000.00' }) amount!: string;
  @ApiProperty({ example: 'ARS' }) currency!: string;
  @ApiProperty({ example: '2026-10-21T00:00:00.000Z' })
  effectiveAt!: Date;
}
