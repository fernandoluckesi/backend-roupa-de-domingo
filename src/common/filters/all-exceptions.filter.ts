import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import { Request, Response } from "express";

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    let message: string | string[] = "Algo deu errado do nosso lado.";
    let error = "InternalServerError";

    if (exception instanceof HttpException) {
      const res = exception.getResponse();
      if (typeof res === "string") {
        message = res;
      } else if (typeof res === "object" && res !== null) {
        const body = res as Record<string, unknown>;
        message = (body.message as string | string[]) ?? exception.message;
        error = (body.error as string) ?? exception.name;
      }
    } else if (exception instanceof Error) {
      error = exception.name;
      this.logger.error(exception.message, exception.stack);
    }

    if (status >= 500) {
      this.logger.error(`${request.method} ${request.url} -> ${status}`);
    }

    response.status(status).json({
      statusCode: status,
      error,
      message,
      path: request.url,
      timestamp: new Date().toISOString(),
    });
  }
}
