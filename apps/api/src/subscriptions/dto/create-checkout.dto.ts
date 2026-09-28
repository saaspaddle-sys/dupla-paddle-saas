import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';

export class CreateCheckoutDto {
  @ApiProperty({ enum: ['basic', 'pro'] })
  @IsIn(['basic', 'pro'])
  plan!: 'basic' | 'pro';
}
