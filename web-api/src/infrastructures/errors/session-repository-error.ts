export class GetSessionRepositoryError extends Error {
  params: unknown;

  public constructor(params: unknown) {
    super();
    this.params = params;
  }
}

export class GetSessionRepositoryUnknownError extends GetSessionRepositoryError {
  error: unknown;

  public constructor(params: unknown, error: unknown) {
    super(params);

    this.name = this.constructor.name;
    this.error = error;
  }
}
