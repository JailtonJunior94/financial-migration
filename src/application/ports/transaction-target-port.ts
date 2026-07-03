import type {
  PublishableTransaction,
  RemoteTransactionMatch,
  RemoteTransactionRecord,
} from "../../domain/publication/types.ts";

export type TransactionBusinessKey = {
  readonly factKeyHash: string;
  readonly userId: string;
};

export interface TransactionTargetPort {
  findByBusinessKey(
    input: TransactionBusinessKey,
  ): Promise<RemoteTransactionMatch | undefined>;
  create(
    input: PublishableTransaction,
    idempotencyKey: string,
  ): Promise<RemoteTransactionRecord>;
}
