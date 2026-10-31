// Thrown for every failed request, so pages can show error.message.
export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}
