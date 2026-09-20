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

/** La lectura canÃ³nica no pudo verificarse y el proveedor debe reintentar. */
export class ProviderUnavailableError extends Error {}

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

export interface MercadoPagoPreapprovalClient {
  create(input: CreatePreapprovalInput): Promise<CreatedPreapproval>;
  getAuthorizedPayment(id: string): Promise<AuthorizedPayment>;
  cancelPreapproval?(id: string): Promise<void>;
  findPreapprovalByReference?(
    reference: string,
  ): Promise<CreatedPreapproval | null>;
}
