import pino from "pino";
import type { LoggerPort } from "../../application/ports/logger-port.ts";

export class PinoLoggerAdapter implements LoggerPort {
  private readonly logger = pino({
    level: "info",
  });

  info(message: string, context?: Record<string, unknown>): void {
    this.logger.info(context ?? {}, message);
  }

  warn(message: string, context?: Record<string, unknown>): void {
    this.logger.warn(context ?? {}, message);
  }

  error(message: string, context?: Record<string, unknown>): void {
    this.logger.error(context ?? {}, message);
  }
}
