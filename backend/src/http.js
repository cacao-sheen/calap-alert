// Error with an HTTP status whose message is safe to show to the user.
export function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  err.expose = true;
  return err;
}

// Throws 400 if any of the given fields is empty.
export function required(fields) {
  const missing = Object.entries(fields)
    .filter(([, v]) => v === undefined || v === null || v === '')
    .map(([k]) => k);
  if (missing.length) throw httpError(400, `Missing: ${missing.join(', ')}`);
}

export function oneOf(value, allowed, field) {
  if (!allowed.includes(value)) throw httpError(400, `${field} must be one of: ${allowed.join(', ')}`);
}
