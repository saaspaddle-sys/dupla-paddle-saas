import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import {
  AmbiguousPreapprovalCreationError,
  DefinitivePreapprovalRejectionError,
  ProviderUnavailableError,
  AmbiguousUpgradePreferenceError,
} from './mercado-pago-preapproval.client';
import type {
  AuthorizedPayment,
  CreatePreapprovalInput,
  CreatedPreapproval,
  MercadoPagoPreapprovalClient,
  PreapprovalDetails,
  UpdateRecurringAmountInput,
  UpgradePayment,
  UpgradePreference,
} from './mercado-pago-preapproval.client';

@Injectable()
export class MercadoPagoHttpPreapprovalClient implements MercadoPagoPreapprovalClient {
  private readonly logger = new Logger(MercadoPagoHttpPreapprovalClient.name);

  constructor(private readonly config: ConfigService) {}

  async createUpgradePreference(input: {
    reference: string;
    payerEmail: string;
    amount: number;
    currencyId: string;
    backUrl: string;
    notificationUrl: string;
    expiresAt: Date;
    startsAt: Date;
  }): Promise<UpgradePreference> {
    const token = this.upgradeToken();
    let response: Response;
    try {
      response = await fetch(
        'https://api.mercadopago.com/checkout/preferences',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            items: [
              {
                title: 'Dupla Basic to Pro upgrade',
                quantity: 1,
                currency_id: input.currencyId,
                unit_price: input.amount,
              },
            ],
            payer: { email: input.payerEmail },
            external_reference: input.reference,
            notification_url: input.notificationUrl,
            back_urls: {
              success: input.backUrl,
              pending: input.backUrl,
              failure: input.backUrl,
            },
            auto_return: 'approved',
            expires: true,
            expiration_date_from: input.startsAt.toISOString(),
            expiration_date_to: input.expiresAt.toISOString(),
          }),
          signal: AbortSignal.timeout(10_000),
        },
      );
    } catch {
      throw new AmbiguousUpgradePreferenceError();
    }
    if (!response.ok) throw new AmbiguousUpgradePreferenceError();
    let data: unknown;
    try {
      data = await response.json();
    } catch {
      throw new AmbiguousUpgradePreferenceError();
    }
    if (!isUpgradePreference(data)) throw new AmbiguousUpgradePreferenceError();
    return {
      id: data.id,
      reference: data.external_reference,
      checkoutUrl: data.init_point,
    };
  }

  async findUpgradePreferenceByReference(
    reference: string,
  ): Promise<UpgradePreference | null> {
    const token = this.upgradeToken();
    const url = new URL(
      'https://api.mercadopago.com/checkout/preferences/search',
    );
    url.searchParams.set('external_reference', reference);
    url.searchParams.set('limit', '10');
    const data = await this.upgradeGetJson(url, token);
    if (!isUpgradePreferenceSearch(data)) throw new ProviderUnavailableError();
    if (data.total === 0) return null;
    if (data.total !== 1 || data.elements.length !== 1)
      throw new ProviderUnavailableError();
    const detail = await this.upgradeGetJson(
      new URL(
        `https://api.mercadopago.com/checkout/preferences/${encodeURIComponent(data.elements[0].id)}`,
      ),
      token,
    );
    if (!isUpgradePreference(detail) || detail.external_reference !== reference)
      throw new ProviderUnavailableError();
    return {
      id: detail.id,
      reference,
      checkoutUrl: detail.init_point,
    };
  }

  async getUpgradePayment(id: string): Promise<UpgradePayment> {
    const token = this.upgradeToken();
    const data = await this.upgradeGetJson(
      new URL(
        `https://api.mercadopago.com/v1/payments/${encodeURIComponent(id)}`,
      ),
      token,
    );
    if (!isUpgradePayment(data)) throw new ProviderUnavailableError();
    return toUpgradePayment(data);
  }

  async findUpgradePaymentsByReference(
    reference: string,
  ): Promise<UpgradePayment[]> {
    const token = this.upgradeToken();
    const url = new URL('https://api.mercadopago.com/v1/payments/search');
    url.searchParams.set('external_reference', reference);
    url.searchParams.set('limit', '10');
    const data = await this.upgradeGetJson(url, token);
    if (!isUpgradePaymentSearch(data) || data.paging.total > 10)
      throw new ProviderUnavailableError();
    return data.results.map(toUpgradePayment);
  }

  private upgradeToken(): string {
    const token = this.config.get<string>('MERCADO_PAGO_ACCESS_TOKEN');
    if (!token) throw new ProviderUnavailableError();
    return token;
  }

  private async upgradeGetJson(url: URL, token: string): Promise<unknown> {
    let response: Response;
    try {
      response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(10_000),
      });
    } catch {
      throw new ProviderUnavailableError();
    }
    if (!response.ok) throw new ProviderUnavailableError();
    try {
      return await response.json();
    } catch {
      throw new ProviderUnavailableError();
    }
  }

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
          // This integration redirects the payer to Mercado Pago. `pending`
          // is the documented initial state for that flow; without it MP may
          // interpret the request as a card-token subscription.
          status: 'pending',
          auto_recurring: {
            frequency: 1,
            frequency_type: 'months',
            transaction_amount: input.amount,
            currency_id: input.currencyId,
          },
        }),
        signal: AbortSignal.timeout(10_000),
      });
    } catch {
      // A timeout or transport failure can happen after Mercado Pago accepts
      // the request, so callers must recover through the durable reference.
      throw new AmbiguousPreapprovalCreationError();
    }
    if (!response.ok) {
      const rejection = await inspectPreapprovalRejection(response);
      this.logger.warn({
        event: 'mercado_pago_preapproval_create_rejected',
        ...rejection.diagnostic,
      });
      if (rejection.definitive) throw new DefinitivePreapprovalRejectionError();
      // Mercado Pago's HTTP status alone does not prove whether it created a
      // Preapproval. Only its documented validation envelope proves that the
      // request was rejected before a mandate could be created.
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

  async getAuthorizedPayment(id: string): Promise<AuthorizedPayment> {
    const accessToken = this.config.get<string>('MERCADO_PAGO_ACCESS_TOKEN');
    if (!accessToken) throw new ProviderUnavailableError();
    let response: Response;
    try {
      response = await fetch(
        `https://api.mercadopago.com/authorized_payments/${encodeURIComponent(id)}`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
          signal: AbortSignal.timeout(10_000),
        },
      );
    } catch {
      throw new ProviderUnavailableError();
    }
    if (!response.ok) throw new ProviderUnavailableError();
    let data: unknown;
    try {
      data = await response.json();
    } catch {
      throw new ProviderUnavailableError();
    }
    if (!isAuthorizedPayment(data)) throw new ProviderUnavailableError();
    return {
      id: String(data.id),
      invoiceStatus: data.status,
      paymentStatus: data.payment.status,
      preapprovalId: data.preapproval_id,
      amount: String(data.transaction_amount),
      currencyId: data.currency_id,
      externalReference: data.external_reference,
      paidAt: new Date(data.date_created),
    };
  }

  async getPreapproval(id: string): Promise<PreapprovalDetails> {
    const accessToken = this.config.get<string>('MERCADO_PAGO_ACCESS_TOKEN');
    if (!accessToken) throw new ProviderUnavailableError();
    let response: Response;
    try {
      response = await fetch(
        `https://api.mercadopago.com/preapproval/${encodeURIComponent(id)}`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
          signal: AbortSignal.timeout(10_000),
        },
      );
    } catch (error) {
      this.logger.warn({
        event: 'mercado_pago_preapproval_read_failed',
        preapprovalId: id,
        error: error instanceof Error ? error.name : 'unknown',
      });
      throw new ProviderUnavailableError();
    }
    if (!response.ok) {
      this.logger.warn({
        event: 'mercado_pago_preapproval_read_rejected',
        preapprovalId: id,
        status: response.status,
      });
      throw new ProviderUnavailableError();
    }
    const data: unknown = await response.json().catch(() => null);
    if (!isPreapprovalDetails(data)) {
      this.logger.warn({
        event: 'mercado_pago_preapproval_read_invalid_payload',
        preapprovalId: id,
      });
      throw new ProviderUnavailableError();
    }
    return {
      id: data.id,
      status: data.status,
      externalReference: data.external_reference,
      initPoint: data.init_point ?? null,
      ...(data.auto_recurring
        ? {
            transactionAmount: data.auto_recurring.transaction_amount,
            currencyId: data.auto_recurring.currency_id,
          }
        : {}),
    };
  }

  async findAuthorizedPaymentsByPreapproval(
    preapprovalId: string,
  ): Promise<AuthorizedPayment[]> {
    const accessToken = this.config.get<string>('MERCADO_PAGO_ACCESS_TOKEN');
    if (!accessToken) throw new ProviderUnavailableError();
    let response: Response;
    try {
      response = await fetch(
        `https://api.mercadopago.com/authorized_payments/search?preapproval_id=${encodeURIComponent(preapprovalId)}&limit=10`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
          signal: AbortSignal.timeout(10_000),
        },
      );
    } catch {
      throw new ProviderUnavailableError();
    }
    if (!response.ok) throw new ProviderUnavailableError();
    const data: unknown = await response.json().catch(() => null);
    if (!isAuthorizedPaymentSearch(data)) throw new ProviderUnavailableError();
    return data.results.map(toAuthorizedPayment);
  }

  async findPreapprovalByReference(
    reference: string,
  ): Promise<CreatedPreapproval | null> {
    const accessToken = this.config.get<string>('MERCADO_PAGO_ACCESS_TOKEN');
    if (!accessToken) throw new ProviderUnavailableError();
    let response: Response;
    try {
      response = await fetch(
        `https://api.mercadopago.com/preapproval/search?external_reference=${encodeURIComponent(reference)}`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
          signal: AbortSignal.timeout(10_000),
        },
      );
    } catch {
      throw new ProviderUnavailableError();
    }
    if (!response.ok) throw new ProviderUnavailableError();
    const data: unknown = await response.json().catch(() => null);
    if (!isPreapprovalSearch(data)) throw new ProviderUnavailableError();
    const matches = data.results.filter(
      (item) => item.external_reference === reference,
    );
    // An ambiguous recovery must stay in the durable recovery state. Choosing
    // one result could attach this owner to someone else's recurring mandate.
    if (matches.length !== 1) return null;
    const match = matches[0];
    return match
      ? { id: match.id, status: match.status, initPoint: match.init_point }
      : null;
  }

  pausePreapproval(id: string): Promise<void> {
    return this.updatePreapprovalStatus(id, 'paused');
  }

  resumePreapproval(id: string): Promise<void> {
    return this.updatePreapprovalStatus(id, 'authorized');
  }

  cancelPreapproval(id: string): Promise<void> {
    return this.updatePreapprovalStatus(id, 'cancelled');
  }

  async updateRecurringAmount(
    id: string,
    input: UpdateRecurringAmountInput,
  ): Promise<void> {
    const current = await this.getPreapproval(id);
    if (
      current.id !== id ||
      current.status !== 'authorized' ||
      current.currencyId !== input.currencyId
    )
      throw new ProviderUnavailableError();
    if (sameAmount(current.transactionAmount, input.amount)) return;

    const accessToken = this.config.get<string>('MERCADO_PAGO_ACCESS_TOKEN');
    if (!accessToken) throw new ProviderUnavailableError();
    try {
      await fetch(
        `https://api.mercadopago.com/preapproval/${encodeURIComponent(id)}`,
        {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            auto_recurring: {
              transaction_amount: input.amount,
              currency_id: input.currencyId,
            },
          }),
          signal: AbortSignal.timeout(10_000),
        },
      );
    } catch {
      await this.confirmRecurringAmount(id, input);
      return;
    }
    await this.confirmRecurringAmount(id, input);
  }

  private async confirmRecurringAmount(
    id: string,
    input: UpdateRecurringAmountInput,
  ): Promise<void> {
    const canonical = await this.getPreapproval(id);
    if (
      canonical.id !== id ||
      canonical.currencyId !== input.currencyId ||
      !sameAmount(canonical.transactionAmount, input.amount)
    )
      throw new ProviderUnavailableError();
  }

  private async updatePreapprovalStatus(
    id: string,
    status: 'paused' | 'authorized' | 'cancelled',
  ): Promise<void> {
    const accessToken = this.config.get<string>('MERCADO_PAGO_ACCESS_TOKEN');
    if (!accessToken) throw new ProviderUnavailableError();
    let response: Response;
    try {
      response = await fetch(
        `https://api.mercadopago.com/preapproval/${encodeURIComponent(id)}`,
        {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ status }),
          signal: AbortSignal.timeout(10_000),
        },
      );
    } catch {
      throw new ProviderUnavailableError();
    }
    if (!response.ok) throw new ProviderUnavailableError();
  }
}

/**
 * Mercado Pago validation errors have a stable, documented JSON envelope.
 * We deliberately accept only that shape: an arbitrary 4xx (or an HTML/error
 * proxy response) is not enough evidence to delete a durable reservation.
 *
 * The response is never logged or returned. Reading is capped to avoid holding
 * an unexpectedly large provider payload in memory.
 */
type RejectionDiagnostic = {
  httpStatus: number;
  contentType: 'json' | 'text' | 'other' | 'missing';
  bodyState: 'parsed' | 'malformed' | 'oversized' | 'unreadable';
  providerErrorCategory?: string;
  providerMessageCategory?: string;
  providerCauseCategories?: string[];
  providerCauseCount?: number;
};

async function inspectPreapprovalRejection(
  response: Response,
): Promise<{ definitive: boolean; diagnostic: RejectionDiagnostic }> {
  const contentType = classifyContentType(
    response.headers.get('content-type') ?? '',
  );
  const base = { httpStatus: response.status, contentType };
  if (contentType !== 'json') {
    return {
      definitive: false,
      diagnostic: { ...base, bodyState: 'unreadable' },
    };
  }

  const body = await readBodyCapped(response, 4096);
  if (!body.text) {
    return {
      definitive: false,
      diagnostic: {
        ...base,
        bodyState: body.oversized ? 'oversized' : 'unreadable',
      },
    };
  }

  let data: unknown;
  try {
    data = JSON.parse(body.text);
  } catch {
    return {
      definitive: false,
      diagnostic: { ...base, bodyState: 'malformed' },
    };
  }
  const codes = extractSafeProviderCodes(data);
  return {
    definitive:
      response.status === 400 && isMercadoPagoValidationError(data, codes),
    diagnostic: { ...base, bodyState: 'parsed', ...codes },
  };
}

function isMercadoPagoValidationError(
  value: unknown,
  codes: Omit<RejectionDiagnostic, 'httpStatus' | 'contentType' | 'bodyState'>,
): boolean {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  const knownEnvelope = codes.providerErrorCategory === 'validation';
  const knownValidationMessage =
    codes.providerMessageCategory !== undefined &&
    codes.providerMessageCategory !== 'unclassified';
  return (
    Number(record.status) === 400 &&
    (knownEnvelope ||
      (knownValidationMessage && typeof record.message === 'string'))
  );
}

async function readBodyCapped(
  response: Response,
  maxBytes: number,
): Promise<{ text: string | null; oversized: boolean }> {
  const declaredLength = Number(response.headers.get('content-length'));
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes)
    return { text: null, oversized: true };
  if (!response.body) return { text: null, oversized: false };

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const result = await reader.read();
      if (result.done) break;
      size += result.value.byteLength;
      if (size > maxBytes) {
        await reader.cancel();
        return { text: null, oversized: true };
      }
      chunks.push(result.value);
    }
  } catch {
    return { text: null, oversized: false };
  }
  const merged = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return { text: new TextDecoder().decode(merged), oversized: false };
}

function extractSafeProviderCodes(
  value: unknown,
): Omit<RejectionDiagnostic, 'httpStatus' | 'contentType' | 'bodyState'> {
  if (typeof value !== 'object' || value === null) return {};
  const record = value as Record<string, unknown>;
  const providerErrorCategory = classifyProviderError(record.error);
  const providerMessageCategory = classifyProviderMessage(record.message);
  const providerCauseCategories = Array.isArray(record.cause)
    ? record.cause
        .map((cause) => {
          if (typeof cause !== 'object' || cause === null) return 'unknown';
          const causeRecord = cause as Record<string, unknown>;
          const fromCode = classifyProviderMessage(causeRecord.code);
          if (fromCode && fromCode !== 'unclassified') return fromCode;
          const fromDescription = classifyProviderMessage(
            causeRecord.description,
          );
          return fromDescription && fromDescription !== 'unclassified'
            ? fromDescription
            : 'unknown';
        })
        .slice(0, 8)
    : undefined;
  return {
    ...(providerErrorCategory ? { providerErrorCategory } : {}),
    ...(providerMessageCategory ? { providerMessageCategory } : {}),
    ...(providerCauseCategories?.length ? { providerCauseCategories } : {}),
    ...(Array.isArray(record.cause)
      ? { providerCauseCount: record.cause.length }
      : {}),
  };
}

function classifyProviderError(value: unknown): string | undefined {
  if (typeof value !== 'string')
    return value === undefined ? undefined : 'unknown';
  switch (value.toLowerCase()) {
    case 'bad_request':
    case 'invalid_request':
      return 'validation';
    case 'unauthorized':
    case 'invalid_token':
      return 'authentication';
    case 'forbidden':
      return 'authorization';
    case 'conflict':
      return 'conflict';
    default:
      return 'unknown';
  }
}

function classifyProviderMessage(value: unknown): string | undefined {
  if (typeof value !== 'string' || value.length === 0) return undefined;
  const message = value.toLowerCase();
  if (message.includes('payer') && message.includes('collector'))
    return 'payer_matches_collector';
  if (message.includes('payer_email')) return 'invalid_payer_email';
  if (message.includes('card_token')) return 'card_token_required';
  if (message.includes('transaction_amount')) return 'invalid_amount';
  if (message.includes('currency_id')) return 'invalid_currency';
  if (message.includes('back_url')) return 'invalid_back_url';
  if (message.includes('notification_url')) return 'invalid_notification_url';
  if (message.includes('auto_recurring')) return 'invalid_auto_recurring';
  if (message.includes('status')) return 'invalid_status';
  return 'unclassified';
}

function classifyContentType(
  value: string,
): RejectionDiagnostic['contentType'] {
  const normalized = value.toLowerCase();
  if (!normalized) return 'missing';
  if (normalized.includes('json')) return 'json';
  if (normalized.startsWith('text/')) return 'text';
  return 'other';
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

function isPreapprovalDetails(value: unknown): value is {
  id: string;
  status: string;
  external_reference: string;
  init_point?: string | null;
  auto_recurring?: {
    transaction_amount: string | number;
    currency_id: string;
  };
} {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  const autoRecurring = record.auto_recurring;
  let validAutoRecurring = autoRecurring === undefined;
  if (typeof autoRecurring === 'object' && autoRecurring !== null) {
    const recurring = autoRecurring as Record<string, unknown>;
    const amount = recurring.transaction_amount;
    validAutoRecurring =
      (typeof amount === 'string' ||
        (typeof amount === 'number' && Number.isFinite(amount))) &&
      typeof recurring.currency_id === 'string';
  }
  return (
    typeof record.id === 'string' &&
    typeof record.status === 'string' &&
    typeof record.external_reference === 'string' &&
    (typeof record.init_point === 'string' ||
      record.init_point === null ||
      record.init_point === undefined) &&
    validAutoRecurring
  );
}

function sameAmount(value: string | number | undefined, expected: number) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric.toFixed(2) === expected.toFixed(2);
}

function isUpgradePreference(value: unknown): value is {
  id: string;
  external_reference: string;
  init_point: string;
} {
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.id === 'string' &&
    typeof record.external_reference === 'string' &&
    typeof record.init_point === 'string' &&
    isProviderHttpsUrl(record.init_point)
  );
}

function isProviderHttpsUrl(value: string): boolean {
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

function isUpgradePreferenceSearch(value: unknown): value is {
  total: number;
  elements: Array<{ id: string }>;
} {
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  return (
    Number.isInteger(record.total) &&
    Array.isArray(record.elements) &&
    record.elements.length <= 10 &&
    record.elements.every((element: unknown) =>
      Boolean(
        element &&
        typeof element === 'object' &&
        typeof (element as Record<string, unknown>).id === 'string',
      ),
    )
  );
}

type ProviderUpgradePayment = {
  id: string | number;
  status: string;
  external_reference: string;
  transaction_amount: string | number;
  currency_id: string;
  date_approved?: string | null;
};

function isUpgradePayment(value: unknown): value is ProviderUpgradePayment {
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  return (
    (typeof record.id === 'string' || typeof record.id === 'number') &&
    typeof record.status === 'string' &&
    typeof record.external_reference === 'string' &&
    (typeof record.transaction_amount === 'string' ||
      typeof record.transaction_amount === 'number') &&
    Number.isFinite(Number(record.transaction_amount)) &&
    Number(record.transaction_amount) > 0 &&
    typeof record.currency_id === 'string' &&
    (record.date_approved === undefined ||
      record.date_approved === null ||
      (typeof record.date_approved === 'string' &&
        !Number.isNaN(Date.parse(record.date_approved))))
  );
}

function isUpgradePaymentSearch(value: unknown): value is {
  paging: { total: number };
  results: ProviderUpgradePayment[];
} {
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  const paging = record.paging as Record<string, unknown> | undefined;
  return (
    paging !== undefined &&
    Number.isInteger(paging.total) &&
    Array.isArray(record.results) &&
    record.results.length <= 10 &&
    record.results.every(isUpgradePayment)
  );
}

function toUpgradePayment(value: ProviderUpgradePayment): UpgradePayment {
  return {
    id: String(value.id),
    status: value.status,
    reference: value.external_reference,
    amount: String(value.transaction_amount),
    currencyId: value.currency_id,
    approvedAt: value.date_approved ? new Date(value.date_approved) : null,
  };
}
function isAuthorizedPayment(value: unknown): value is {
  id: string | number;
  status: string;
  preapproval_id: string;
  transaction_amount: string | number;
  currency_id: string;
  external_reference: string;
  payment: { status: string };
  date_created: string;
} {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  return (
    (typeof record.id === 'string' || typeof record.id === 'number') &&
    typeof record.status === 'string' &&
    typeof record.preapproval_id === 'string' &&
    (typeof record.transaction_amount === 'string' ||
      (typeof record.transaction_amount === 'number' &&
        Number.isFinite(record.transaction_amount))) &&
    typeof record.currency_id === 'string' &&
    typeof record.external_reference === 'string' &&
    typeof record.payment === 'object' &&
    record.payment !== null &&
    typeof (record.payment as Record<string, unknown>).status === 'string' &&
    typeof record.date_created === 'string' &&
    !Number.isNaN(Date.parse(record.date_created))
  );
}

function isAuthorizedPaymentSearch(value: unknown): value is {
  results: Array<{
    id: string | number;
    status: string;
    preapproval_id: string;
    transaction_amount: string | number;
    currency_id: string;
    external_reference: string;
    payment: { status: string };
    date_created: string;
  }>;
} {
  if (typeof value !== 'object' || value === null) return false;
  const results = (value as Record<string, unknown>).results;
  return (
    Array.isArray(results) &&
    results.length <= 10 &&
    results.every(isAuthorizedPayment)
  );
}

function toAuthorizedPayment(data: {
  id: string | number;
  status: string;
  preapproval_id: string;
  transaction_amount: string | number;
  currency_id: string;
  external_reference: string;
  payment: { status: string };
  date_created: string;
}): AuthorizedPayment {
  return {
    id: String(data.id),
    invoiceStatus: data.status,
    paymentStatus: data.payment.status,
    preapprovalId: data.preapproval_id,
    amount: String(data.transaction_amount),
    currencyId: data.currency_id,
    externalReference: data.external_reference,
    paidAt: new Date(data.date_created),
  };
}

function isPreapprovalSearch(value: unknown): value is {
  results: Array<{
    id: string;
    status: string;
    init_point: string;
    external_reference: string;
  }>;
} {
  if (
    typeof value !== 'object' ||
    value === null ||
    !Array.isArray((value as Record<string, unknown>).results)
  )
    return false;
  return (value as { results: unknown[] }).results.every(
    (item) =>
      typeof item === 'object' &&
      item !== null &&
      typeof (item as Record<string, unknown>).id === 'string' &&
      typeof (item as Record<string, unknown>).status === 'string' &&
      typeof (item as Record<string, unknown>).init_point === 'string' &&
      typeof (item as Record<string, unknown>).external_reference === 'string',
  );
}
