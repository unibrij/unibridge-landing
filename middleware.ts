const COOKIE_NAME =
  "ub_partner_docs_session";

const SESSION_TTL_SECONDS =
  24 * 60 * 60;

const CLOCK_SKEW_SECONDS =
  5 * 60;

function readCookie(
  cookieHeader: string,
  name: string
) {
  const cookies =
    cookieHeader.split(";");

  for (
    const cookie of cookies
  ) {
    const separatorIndex =
      cookie.indexOf("=");

    if (
      separatorIndex === -1
    ) {
      continue;
    }

    const cookieName =
      cookie
        .slice(
          0,
          separatorIndex
        )
        .trim();

    if (
      cookieName !== name
    ) {
      continue;
    }

    return cookie
      .slice(
        separatorIndex + 1
      )
      .trim();
  }

  return null;
}

function base64UrlToBytes(
  value: string
) {
  const normalized =
    value
      .replace(/-/g, "+")
      .replace(/_/g, "/");

  const paddingLength =
    (
      4 -
      (
        normalized.length %
        4
      )
    ) %
    4;

  const padded =
    normalized +
    "=".repeat(
      paddingLength
    );

  let binary: string;

  try {
    binary =
      atob(padded);
  } catch {
    return null;
  }

  const bytes =
    new Uint8Array(
      binary.length
    );

  for (
    let i = 0;
    i < binary.length;
    i += 1
  ) {
    bytes[i] =
      binary.charCodeAt(i);
  }

  return bytes;
}

async function verifySessionToken(
  token: string | null
) {
  if (
    !token
  ) {
    return false;
  }

  const secret =
    process.env
      .PARTNER_DOCS_SESSION_SECRET;

  if (
    !secret ||
    secret.length < 32
  ) {
    return false;
  }

  const parts =
    token.split(".");

  if (
    parts.length !== 4
  ) {
    return false;
  }

  const [
    version,
    issuedAtRaw,
    expiresAtRaw,
    signatureRaw
  ] =
    parts;

  if (
    version !== "v1"
  ) {
    return false;
  }

  const issuedAt =
    Number(
      issuedAtRaw
    );

  const expiresAt =
    Number(
      expiresAtRaw
    );

  if (
    !Number.isSafeInteger(
      issuedAt
    ) ||
    !Number.isSafeInteger(
      expiresAt
    )
  ) {
    return false;
  }

  const now =
    Math.floor(
      Date.now() / 1000
    );

  if (
    issuedAt >
    now +
      CLOCK_SKEW_SECONDS
  ) {
    return false;
  }

  if (
    expiresAt <= now
  ) {
    return false;
  }

  const lifetime =
    expiresAt -
    issuedAt;

  if (
    lifetime <= 0 ||
    lifetime >
      SESSION_TTL_SECONDS
  ) {
    return false;
  }

  const signature =
    base64UrlToBytes(
      signatureRaw
    );

  if (
    !signature
  ) {
    return false;
  }

  const payload =
    `v1.${issuedAt}.${expiresAt}`;

  const encoder =
    new TextEncoder();

  const key =
    await crypto.subtle.importKey(
      "raw",
      encoder.encode(
        secret
      ),
      {
        name: "HMAC",
        hash: "SHA-256"
      },
      false,
      [
        "verify"
      ]
    );

  return crypto.subtle.verify(
    "HMAC",
    key,
    signature,
    encoder.encode(
      payload
    )
  );
}

export default async function middleware(
  request: Request
) {
  const url =
    new URL(
      request.url
    );

  const pathname =
    url.pathname;

  const isPartnerDocsIndex =
    pathname ===
      "/partner-docs" ||
    pathname ===
      "/partner-docs/" ||
    pathname ===
      "/partner-docs/index.html";

  const isPartnerDocsAsset =
    pathname.startsWith(
      "/partner-docs/assets/"
    );

  if (
    isPartnerDocsIndex ||
    isPartnerDocsAsset
  ) {
    return;
  }

  const cookieHeader =
    request.headers.get(
      "cookie"
    ) || "";

  const token =
    readCookie(
      cookieHeader,
      COOKIE_NAME
    );

  const hasAccess =
    await verifySessionToken(
      token
    );

  if (
    hasAccess
  ) {
    return;
  }

  return Response.redirect(
    new URL(
      "/partner-docs/",
      request.url
    ),
    302
  );
}

export const config = {
  matcher: [
    "/partner-docs/:path*"
  ]
};
