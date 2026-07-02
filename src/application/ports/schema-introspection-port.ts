import type { SchemaInspection } from "../../domain/schema/types.ts";

export interface SchemaIntrospectionPort {
  inspect(): Promise<SchemaInspection>;
}
