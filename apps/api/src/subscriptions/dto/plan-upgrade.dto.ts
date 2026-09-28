import { ApiProperty } from '@nestjs/swagger';
import { IsIn, Matches } from 'class-validator';

export class PlanUpgradeRequestDto {
  @ApiProperty({ enum: ['pro'] })
  @IsIn(['pro'])
  targetPlan!: 'pro';
}

export class CreateUpgradeRequestDto extends PlanUpgradeRequestDto {
  @ApiProperty({ example: '7500.00' })
  @Matches(/^(0|[1-9]\d*)\.\d{2}$/)
  expectedAmount!: string;
}
