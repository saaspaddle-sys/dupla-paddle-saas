import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AmbiguousPreapprovalCreationError } from './mercado-pago-preapproval.client';
import type {
  CreatePreapprovalInput,
  CreatedPreapproval,
  MercadoPagoPreapprovalClient,
} from './mercado-pago-preapproval.client';

@Injectable()
export class MercadoPagoHttpPreapprovalClient implements MercadoPagoPreapprovalClient {
  constructor(private readonly config: ConfigService) {}

  async create(input: CreatePreapprovalInput): Promise<CreatedPreapproval> {
    const accessToken = this.config.get<string>('MERCADO_PAGO_ACCESS_TOKEN');
    if (!accessToken)
      throw new ServiceUnavailableException({
        code: 'billing_not_configured',
        message: 'billing is not configured',
      });
    let response: Response;
    try {
      response = await fetch('https://api.mercadopago.com/preapproval', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          reason: input.reason,
          external_reference: input.reference,
          payer_email: input.payerEmail,
          back_url: input.backUrl,
          auto_recurring: {
            frequency: 1,
            frequency_type: 'months',
            transaction_amount: input.amount,
            currency_id: input.currencyId,
          },
        }),
      });
    } catch {
      // A timeout or transport failure can happen after Mercado Pago accepts
      // the request, so callers must recover through the durable reference.
      throw new AmbiguousPreapprovalCreationError();
    }
    if (!response.ok) {
      // Mercado Pago's HTTP status alone does not prove whether it created a
      // Preapproval. Until a documented response body positively proves the
      // opposite, every non-2xx outcome is recoverable rather than deletable.
      throw new AmbiguousPreapprovalCreationError();
    }
    let data: unknown;
    try {
      data = await response.json();
    } catch {
      throw new AmbiguousPreapprovalCreationError();
    }
    if (!isPreapproval(data)) throw new AmbiguousPreapprovalCreationError();
    return { id: data.id, status: data.status, initPoint: data.init_point };
  }
}
function isPreapproval(
  value: unknown,
): value is { id: string; status: string; init_point: string } {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as Record<string, unknown>).id === 'string' &&
    typeof (value as Record<string, unknown>).status === 'string' &&
    typeof (value as Record<string, unknown>).init_point === 'string'
  );
}
