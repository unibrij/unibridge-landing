// partner-portal/js/session.js

export class UnauthorizedSessionError extends Error {
  constructor(message = "Partner portal session is required.") {
    super(message);
    this.name = "UnauthorizedSessionError";
    this.code = "unauthorized";
    this.status = 401;
  }
}

function normalizeBaseUrl(baseUrl = "") {
  return String(baseUrl || "").replace(/\/+$/, "");
}

async function parseJson(response) {
  return response.json().catch(() => ({}));
}

export async function getPartnerPortalSession({
  baseUrl = "/v2/integrations"
} = {}) {
  const response =
    await fetch(
      `${normalizeBaseUrl(baseUrl)}/session`,
      {
        method: "GET",
        credentials: "include",
        headers: {
          Accept: "application/json"
        }
      }
    );

  const payload =
    await parseJson(response);

  if (!response.ok) {
    throw new UnauthorizedSessionError(
      payload?.error?.message ||
        "Unable to verify partner portal session."
    );
  }

  if (!payload?.authenticated) {
    throw new UnauthorizedSessionError();
  }

  return {
    user: payload.user || null,
    member: payload.member || null
  };
}

export function isUnauthorizedSessionError(error) {
  return (
    error instanceof UnauthorizedSessionError ||
    error?.code === "unauthorized" ||
    error?.status === 401
  );
}
