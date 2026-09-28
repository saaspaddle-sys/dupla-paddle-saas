import { ApiProperty } from '@nestjs/swagger';

export class ImmediateUpgradeQuoteDto {
  @ApiProperty({ enum: ['pro'] }) targetPlan!: 'pro';
  @ApiProperty({ example: '7500.00' }) amount!: string;
  @ApiProperty({ example: '25000.00' }) recurringAmount!: string;
  @ApiProperty({ example: 'ARS' }) currency!: string;
  @ApiProperty({ example: '2026-10-21T00:00:00.000Z' })
  periodEndsAt!: Date;
}

export class ImmediateUpgradeCheckoutDto extends ImmediateUpgradeQuoteDto {
  @ApiProperty({ example: '9fd80e8b-cce4-475e-a80e-a900a8ff3be8' })
  reference!: string;
  @ApiProperty({
    example: 'https://www.mercadopago.com.ar/checkout/v1/redirect?pref_id=...',
  })
  checkoutUrl!: string;
  @ApiProperty({ example: true }) reused!: boolean;
}

export class PendingUpgradeDto {
  @ApiProperty({ enum: ['creating', 'pending', 'paid', 'review_required'] })
  state!: 'creating' | 'pending' | 'paid' | 'review_required';
  @ApiProperty() reference!: string;
  @ApiProperty({ example: '7500.00' }) amount!: string;
  @ApiProperty({ example: 'ARS' }) currency!: string;
  @ApiProperty({ nullable: true }) checkoutUrl!: string | null;
  @ApiProperty() periodEndsAt!: Date;
}
