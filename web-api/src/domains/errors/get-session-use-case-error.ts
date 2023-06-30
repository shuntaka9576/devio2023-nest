export class GetSessionUseCaseError extends Error {
  paramas: unknown;

  public constructor(params: unknown) {
    super();
    this.paramas = params;
  }
}

export class GetSessionUseCaseUnknownError extends GetSessionUseCaseError {
  error: unknown;

  public constructor(params: unknown, error: unknown) {
    super(params);

    this.name = this.constructor.name;
    this.error = error;
  }
}
