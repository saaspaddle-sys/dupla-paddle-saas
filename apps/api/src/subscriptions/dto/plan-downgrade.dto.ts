import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';

export class PlanDowngradeRequestDto {
  @ApiProperty({ enum: ['basic'] })
  @IsIn(['basic'])
  targetPlan!: 'basic';
}

export class PlanDowngradeQuoteResponseDto {
  @ApiProperty({ enum: ['basic'] }) targetPlan!: 'basic';
  @ApiProperty({ example: '10000.00' }) amount!: string;
  @ApiProperty({ example: 'ARS' }) currency!: string;
  @ApiProperty({ example: '2026-10-21T00:00:00.000Z' })
  effectiveAt!: Date;
}
