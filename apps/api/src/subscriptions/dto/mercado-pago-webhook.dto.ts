import { Transform, Type } from 'class-transformer';
import {
  IsObject,
  IsOptional,
  IsString,
  IsBoolean,
  IsDateString,
  IsInt,
  ValidateNested,
} from 'class-validator';

class MercadoPagoWebhookDataDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'number' ? String(value) : value,
  )
  @IsString()
  id!: string;
}

/** El payload mínimo firmado que necesitamos; el resto se conserva opaco. */
export class MercadoPagoWebhookDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'number' ? String(value) : value,
  )
  @IsString()
  id!: string;

  @IsString()
  type!: string;

  @IsOptional()
  @IsString()
  action?: string;

  // Mercado Pago includes these fields in the documented envelope. They are
  // declared rather than globally allowing arbitrary input, so our normal
  // whitelist remains a boundary against unexpected request bodies.
  @IsOptional()
  @IsBoolean()
  live_mode?: boolean;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'number' ? String(value) : value,
  )
  @IsString()
  user_id?: string;

  @IsOptional()
  @IsString()
  api_version?: string;

  @IsOptional()
  @IsString()
  date_created?: string;

  // Subscription-preapproval notifications use a slightly different
  // documented envelope from authorized-payment notifications. Declare the
  // known metadata explicitly so the global whitelist can stay strict.
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'number' ? String(value) : value,
  )
  @IsString()
  application_id?: string;

  @IsOptional()
  @IsDateString()
  date?: string;

  @IsOptional()
  @IsString()
  entity?: string;

  @IsOptional()
  @IsInt()
  version?: number;

  @IsObject()
  @ValidateNested()
  @Type(() => MercadoPagoWebhookDataDto)
  data!: MercadoPagoWebhookDataDto;
}
