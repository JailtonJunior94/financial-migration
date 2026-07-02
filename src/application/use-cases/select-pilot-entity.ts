import { selectPilotEntity } from "../../domain/schema/select-pilot-entity.ts";
import type {
  PilotEntitySelection,
  SchemaInspection,
} from "../../domain/schema/types.ts";
import type { ClockPort } from "../ports/clock-port.ts";
import type { LoggerPort } from "../ports/logger-port.ts";

export class SelectPilotEntityUseCase {
  constructor(
    private readonly clock: ClockPort,
    private readonly logger: LoggerPort,
  ) {}

  execute(inspections: SchemaInspection[]): PilotEntitySelection {
    const result = selectPilotEntity(inspections, this.clock.nowIso());
    if (!result.ok) {
      throw result.error;
    }

    this.logger.info("Pilot entity selected.", result.value);
    return result.value;
  }
}
