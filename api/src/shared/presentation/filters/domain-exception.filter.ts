import { ArgumentsHost, Catch, ExceptionFilter } from '@nestjs/common';
import { Response } from 'express';
import { DomainError } from '../../domain/domain-error';
import { ErrorResponseBody } from './all-exceptions.filter';

/**
 * Maps domain errors (DomainError subclasses) to the standard error shape using
 * their `code` and `httpStatus`. Registered before the catch-all filter.
 */
@Catch(DomainError)
export class DomainExceptionFilter implements ExceptionFilter {
  catch(exception: DomainError, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const body: ErrorResponseBody = {
      error: { code: exception.code, message: exception.message },
    };
    response.status(exception.httpStatus).json(body);
  }
}
