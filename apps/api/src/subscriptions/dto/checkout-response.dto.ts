import { ApiProperty } from '@nestjs/swagger';
import { SubscriptionPlan } from '../../generated/prisma/enums';

export class CheckoutResponseDto {
  @ApiProperty({ enum: SubscriptionPlan }) plan!: SubscriptionPlan;
  @ApiProperty({ format: 'uuid' }) reference!: string;
  @ApiProperty({ format: 'uri' }) checkoutUrl!: string;
  @ApiProperty({
    description: 'true when an existing pending checkout was reused',
  })
  reused!: boolean;
}
