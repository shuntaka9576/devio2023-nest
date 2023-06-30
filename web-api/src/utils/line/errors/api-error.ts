export class LineApiError extends Error {
  public constructor() {
    super();
  }
}

export class LineApiVerifyAccessTokenInvalidClientIdError extends LineApiError {
  token: string;
  verifyTokenResult: object;

  public constructor(token: string, verifyTokenResult: object) {
    super();

    this.name = this.constructor.name;
    this.token = token;
    this.verifyTokenResult = verifyTokenResult;
  }
}

export class LineApiVerifyAccessTokenExpiredError extends LineApiError {
  token: string;
  verifyTokenResult: object;

  public constructor(token: string, verifyTokenResult: object) {
    super();

    this.name = this.constructor.name;
    this.token = token;
    this.verifyTokenResult = verifyTokenResult;
  }
}
