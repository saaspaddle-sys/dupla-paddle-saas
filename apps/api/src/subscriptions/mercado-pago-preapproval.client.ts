export const MERCADO_PAGO_PREAPPROVAL_CLIENT = Symbol(
  'MERCADO_PAGO_PREAPPROVAL_CLIENT',
);

export class DefinitivePreapprovalRejectionError extends Error {
  constructor() {
    super('provider definitively rejected preapproval creation');
  }
}

/**
 * The provider may have accepted the request but the client cannot prove it.
 * Its message is deliberately local and must never contain provider payloads.
 */
export class AmbiguousPreapprovalCreationError extends Error {
  constructor() {
    super('provider preapproval creation outcome is ambiguous');
  }
}

/** La lectura canónica no pudo verificarse y el proveedor debe reintentar. */
export class ProviderUnavailableError extends Error {}

export class AmbiguousUpgradePreferenceError extends Error {}

export interface UpgradePreference {
  id: string;
  reference: string;
  checkoutUrl: string;
}

export interface UpgradePayment {
  id: string;
  status: string;
  reference: string;
  amount: string;
  currencyId: string;
  approvedAt: Date | null;
}

export interface CreatePreapprovalInput {
  reference: string;
  payerEmail: string;
  reason: string;
  amount: number;
  currencyId: string;
  backUrl: string;
}

export interface AuthorizedPayment {
  id: string;
  /** Status of the invoice returned by /authorized_payments/{id}. */
  invoiceStatus: string;
  /** Status of the nested payment. Only `approved` grants an entitlement. */
  paymentStatus: string;
  preapprovalId: string;
  /** Keep Mercado Pago's decimal representation exact until Prisma compares it. */
  amount: string | number;
  currencyId: string;
  externalReference: string;
  /** Canonical provider timestamp, never the webhook receipt time. */
  paidAt: Date;
}

export interface CreatedPreapproval {
  id: string;
  status: string;
  initPoint: string;
}

/** Canonical state returned by GET /preapproval/{id}. */
export interface PreapprovalDetails {
  id: string;
  status: string;
  externalReference: string;
  // Mercado Pago returns null after a preapproval is cancelled.
  initPoint: string | null;
  transactionAmount?: string | number;
  currencyId?: string;
}

export interface UpdateRecurringAmountInput {
  amount: number;
  currencyId: string;
}

export interface MercadoPagoPreapprovalClient {
  createUpgradePreference?(input: {
    reference: string;
    payerEmail: string;
    amount: number;
    currencyId: string;
    backUrl: string;
    notificationUrl: string;
    expiresAt: Date;
    startsAt: Date;
  }): Promise<UpgradePreference>;
  findUpgradePreferenceByReference?(
    reference: string,
  ): Promise<UpgradePreference | null>;
  getUpgradePayment?(id: string): Promise<UpgradePayment>;
  findUpgradePaymentsByReference?(reference: string): Promise<UpgradePayment[]>;
  create(input: CreatePreapprovalInput): Promise<CreatedPreapproval>;
  getAuthorizedPayment(id: string): Promise<AuthorizedPayment>;
  /** Reads one mandate by provider id; transport or payload failures reject. */
  getPreapproval(id: string): Promise<PreapprovalDetails>;
  /**
   * Returns a provider-bounded set of invoices for one known mandate. Callers
   * must still correlate every candidate to their durable checkout.
   */
  findAuthorizedPaymentsByPreapproval?(
    preapprovalId: string,
  ): Promise<AuthorizedPayment[]>;
  pausePreapproval?(id: string): Promise<void>;
  resumePreapproval?(id: string): Promise<void>;
  cancelPreapproval?(id: string): Promise<void>;
  updateRecurringAmount?(
    id: string,
    input: UpdateRecurringAmountInput,
  ): Promise<void>;
  findPreapprovalByReference?(
    reference: string,
  ): Promise<CreatedPreapproval | null>;
}
