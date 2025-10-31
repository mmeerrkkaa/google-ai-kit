export class GoogleAIError extends Error {
    public readonly statusCode?: number;
    public readonly details?: any;
  
    constructor(message: string, statusCode?: number, details?: any) {
      super(message);
      this.name = this.constructor.name;
      this.statusCode = statusCode;
      this.details = details;
      Object.setPrototypeOf(this, GoogleAIError.prototype);
    }
  }
  
  export class APIKeyError extends GoogleAIError {
    constructor(message: string = "Invalid or missing API key.", details?: any) {
      super(message, 400, details);
      this.name = "APIKeyError";
      Object.setPrototypeOf(this, APIKeyError.prototype);
    }
  }

  export class APIKeyExpiredError extends GoogleAIError {
    constructor(message: string = "API key expired. Please renew the API key.", details?: any) {
      super(message, 400, details);
      this.name = "APIKeyExpiredError";
      Object.setPrototypeOf(this, APIKeyExpiredError.prototype);
    }
  }

  export class APIKeyInvalidError extends GoogleAIError {
    constructor(message: string = "API key not found or invalid.", details?: any) {
      super(message, 400, details);
      this.name = "APIKeyInvalidError";
      Object.setPrototypeOf(this, APIKeyInvalidError.prototype);
    }
  }
  
  export class NetworkError extends GoogleAIError {
    constructor(message: string = "A network error occurred.") {
      super(message);
      this.name = "NetworkError";
      Object.setPrototypeOf(this, NetworkError.prototype);
    }
  }
  
  export class RateLimitError extends GoogleAIError {
    constructor(message: string = "Rate limit exceeded. Please try again later.") {
      super(message, 429);
      this.name = "RateLimitError";
      Object.setPrototypeOf(this, RateLimitError.prototype);
    }
  }
  
  export class BadRequestError extends GoogleAIError {
    constructor(message: string = "Bad request.", details?: any) {
      super(message, 400, details);
      this.name = "BadRequestError";
      Object.setPrototypeOf(this, BadRequestError.prototype);
    }
  }
  
  export class AuthenticationError extends GoogleAIError {
    constructor(message: string = "Authentication failed.", details?: any) {
      super(message, 401, details);
      this.name = "AuthenticationError";
      Object.setPrototypeOf(this, AuthenticationError.prototype);
    }
  }
  
  export class PermissionDeniedError extends GoogleAIError {
      constructor(message: string = "Permission denied.", details?: any) {
        super(message, 403, details);
        this.name = "PermissionDeniedError";
        Object.setPrototypeOf(this, PermissionDeniedError.prototype);
      }
    }

export class ConsumerSuspendedError extends GoogleAIError {
    constructor(message: string = "Consumer has been suspended.", details?: any) {
      super(message, 403, details);
      this.name = "ConsumerSuspendedError";
      Object.setPrototypeOf(this, ConsumerSuspendedError.prototype);
    }
  }
  
  export class NotFoundError extends GoogleAIError {
    constructor(message: string = "Resource not found.", details?: any) {
      super(message, 404, details);
      this.name = "NotFoundError";
      Object.setPrototypeOf(this, NotFoundError.prototype);
    }
  }
  
  export class InternalServerError extends GoogleAIError {
    constructor(message: string = "An internal server error occurred.", details?: any) {
      super(message, 500, details);
      this.name = "InternalServerError";
      Object.setPrototypeOf(this, InternalServerError.prototype);
    }
  }
  
  export function handleErrorResponse(response: any, errorData: any): GoogleAIError {
    const message = errorData?.error?.message || "An unknown API error occurred";
    const details = errorData?.error?.details;
    const status = errorData?.error?.status;

    // Проверка на специфичные ошибки через details
    if (details && Array.isArray(details)) {
      for (const detail of details) {
        // API Key Invalid
        if (detail['@type'] === 'type.googleapis.com/google.rpc.ErrorInfo' &&
            detail.reason === 'API_KEY_INVALID') {
          // Проверка на expired key
          if (message && message.toLowerCase().includes('expired')) {
            return new APIKeyExpiredError(message, details);
          }
          // Проверка на not found key
          if (message && (message.toLowerCase().includes('not found') ||
                         message.toLowerCase().includes('invalid'))) {
            return new APIKeyInvalidError(message, details);
          }
          return new APIKeyError(message, details);
        }

        // Consumer Suspended
        if (detail['@type'] === 'type.googleapis.com/google.rpc.ErrorInfo' &&
            detail.reason === 'CONSUMER_SUSPENDED') {
          return new ConsumerSuspendedError(message, details || status);
        }
      }
    }

    // Обработка по статус кодам
    switch (response.status) {
      case 400:
        // Дополнительная проверка по сообщению для 400
        if (message && message.toLowerCase().includes('api key')) {
          if (message.toLowerCase().includes('expired')) {
            return new APIKeyExpiredError(message, details || status);
          }
          if (message.toLowerCase().includes('not found') ||
              message.toLowerCase().includes('invalid')) {
            return new APIKeyInvalidError(message, details || status);
          }
          return new APIKeyError(message, details || status);
        }
        return new BadRequestError(message, details || status);
      case 401:
        return new AuthenticationError(message, details || status);
      case 403:
        return new PermissionDeniedError(message, details || status);
      case 404:
        return new NotFoundError(message, details || status);
      case 429:
        return new RateLimitError(message);
      case 500:
      case 502:
      case 503:
      case 504:
        return new InternalServerError(message, details || status);
      default:
        return new GoogleAIError(message, response.status, details || status);
    }
  }