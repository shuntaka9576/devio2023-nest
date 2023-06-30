export class GetSessionResolverError extends Error {
  paramas: unknown;

  public constructor(params: unknown) {
    super();
    this.paramas = params;
  }
}

export class GetSessionResolverValidationError extends GetSessionResolverError {
  error: unknown;

  public constructor(params: unknown, error: unknown) {
    super(params);

    this.name = this.constructor.name;
    this.error = error;
  }
}

export class GetSessionResolverUnknownError extends GetSessionResolverError {
  error: unknown;

  public constructor(params: unknown, error: unknown) {
    super(params);

    this.name = this.constructor.name;
    this.error = error;
  }
}
