// Minimal error responder. Every failure uses the project shape:
// { "error": { "code": string, "message": string, "details": [] } }
export function sendError(res, status, code, message, details = []) {
  return res.status(status).json({ error: { code, message, details } });
}

// Maps a Zod error to details entries. Only field + message; never echoes
// submitted values.
export function validationDetails(zodError) {
  return zodError.issues.map((issue) => ({
    field: issue.path.join("."),
    message: issue.message,
  }));
}
