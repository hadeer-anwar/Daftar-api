import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
} from '@nestjs/common';

import { MongoServerError } from 'mongodb';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  catch(exception: any, host: ArgumentsHost) {
    const ctx = host.switchToHttp();

    const response = ctx.getResponse();
    const request = ctx.getRequest();

    // Mongo duplicate
    if (exception instanceof MongoServerError && exception.code === 11000) {
      return response.status(409).json({
        statusCode: 409,
        message: 'Resource already exists',
        error: 'Conflict',
        path: request.url,
        timestamp: new Date().toISOString(),
      });
    }

    // Nest exceptions
    if (exception instanceof HttpException) {
      const status = exception.getStatus();

      return response.status(status).json({
        statusCode: status,
        message: exception.getResponse(),
        path: request.url,
        timestamp: new Date().toISOString(),
      });
    }

    // Unknown
    return response.status(500).json({
      statusCode: 500,
      message: 'Internal server error',
      error: 'Internal Server Error',
      path: request.url,
      timestamp: new Date().toISOString(),
    });
  }
}
