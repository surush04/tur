import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';

function readBody(body: string | object): { message: string | string[]; code?: string } {
  if (typeof body === 'string') return { message: body };
  const record = body as { message?: string | string[]; code?: string };
  return {
    message: record.message ?? 'Request failed.',
    code: record.code,
  };
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const parsed = readBody(exception.getResponse() as string | object);
      response.status(status).json({
        statusCode: status,
        message: parsed.message,
        code: parsed.code,
      });
      return;
    }

    const prismaCode =
      typeof exception === 'object' && exception && 'code' in exception
        ? String((exception as { code: unknown }).code)
        : '';
    if (prismaCode === 'P2002') {
      response.status(409).json({
        statusCode: 409,
        message: 'That record already exists.',
        code: 'CONFLICT',
      });
      return;
    }
    if (prismaCode === 'P2003' || prismaCode === 'P2025') {
      response.status(409).json({
        statusCode: 409,
        message: 'The record could not be changed because related data still depends on it.',
        code: 'CONFLICT',
      });
      return;
    }

    this.logger.error(exception instanceof Error ? exception.stack : exception);
    response.status(500).json({
      statusCode: 500,
      message: 'Something went wrong. Please try again.',
      code: 'INTERNAL',
    });
  }
}
