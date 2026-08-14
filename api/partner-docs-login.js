import crypto from "crypto";

const COOKIE_NAME =
  "ub_partner_docs_session";

const SESSION_TTL_SECONDS =
  24 * 60 * 60;

function safeEqualString(
  a,
  b
) {
  const aHash =
    crypto
      .createHash("sha256")
      .update(String(a))
      .digest();

  const bHash =
    crypto
      .createHash("sha256")
      .update(String(b))
      .digest();

  return crypto.timingSafeEqual(
    aHash,
    bHash
  );
}

function createSessionToken(
  secret
) {
  const issuedAt =
    Math.floor(
      Date.now() / 1000
    );

  const expiresAt =
    issuedAt +
    SESSION_TTL_SECONDS;

  const payload =
    `v1.${issuedAt}.${expiresAt}`;

  const signature =
    crypto
      .createHmac(
        "sha256",
        secret
      )
      .update(payload)
      .digest("base64url");

  return `${payload}.${signature}`;
}

export default function handler(
  req,
  res
) {
  res.setHeader(
    "Cache-Control",
    "no-store"
  );

  if (
    req.method !== "POST"
  ) {
    res.setHeader(
      "Allow",
      "POST"
    );

    res.status(405).json({
      ok: false,
      error:
        "method_not_allowed"
    });

    return;
  }

  const expectedPassword =
    process.env
      .PARTNER_DOCS_PASSWORD;

  const sessionSecret =
    process.env
      .PARTNER_DOCS_SESSION_SECRET;

  if (
    !expectedPassword
  ) {
    res.status(500).json({
      ok: false,
      error:
        "password_not_configured"
    });

    return;
  }

  if (
    !sessionSecret ||
    sessionSecret.length < 32
  ) {
    res.status(500).json({
      ok: false,
      error:
        "session_secret_not_configured"
    });

    return;
  }

  const {
    password
  } =
    req.body || {};

  const submittedPassword =
    typeof password === "string"
      ? password.trim()
      : "";

  if (
    !safeEqualString(
      submittedPassword,
      expectedPassword
    )
  ) {
    res.status(401).json({
      ok: false,
      error:
        "invalid_password"
    });

    return;
  }

  const token =
    createSessionToken(
      sessionSecret
    );

  res.setHeader(
    "Set-Cookie",
    [
      `${COOKIE_NAME}=${token}`,
      "Path=/partner-docs",
      "HttpOnly",
      "Secure",
      "SameSite=Lax",
      `Max-Age=${SESSION_TTL_SECONDS}`
    ].join("; ")
  );

  res.status(200).json({
    ok: true
  });
}
