// Minimal error responder. Every failure uses the project shape:
// { "error": { "code": string, "message": string, "details": [] } }
export function sendError(res, status, code, message, details = []) {
  return res.status(status).json({ error: { code, message, details } });
}
