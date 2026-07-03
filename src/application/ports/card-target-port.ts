import type {
  PublishableCard,
  RemoteCardMatch,
  RemoteCardRecord,
} from "../../domain/publication/types.ts";

export type CardBusinessKey = {
  readonly businessKey: string;
  readonly userId: string;
};

export interface CardTargetPort {
  findByBusinessKey(
    input: CardBusinessKey,
  ): Promise<RemoteCardMatch | undefined>;
  create(
    input: PublishableCard,
    idempotencyKey: string,
  ): Promise<RemoteCardRecord>;
}
