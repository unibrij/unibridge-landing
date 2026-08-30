// connect-app/src/api/client.js

export const API_BASE =
  "https://unibridge-v2-vqia6yp7wq-uc.a.run.app/v2";


export async function parseJson(
  response
) {
  return response
    .json()
    .catch(() => ({}));
}


export function resolveErrorMessage(
  data,
  fallback
) {
  if (
    typeof data?.error ===
    "string"
  ) {
    return (
      data.error ||
      fallback
    );
  }

  return (
    data?.error?.code ||
    data?.error?.message ||
    fallback
  );
}


export function assertOk(
  response,
  data,
  fallback
) {
  if (
    !response.ok ||
    !data?.ok
  ) {
    throw new Error(
      resolveErrorMessage(
        data,
        fallback
      )
    );
  }
}


export function buildCustomerAuthHeaders(
  accessToken
) {
  const normalizedAccessToken =
    String(
      accessToken ||
      ""
    ).trim();

  if (
    !normalizedAccessToken
  ) {
    throw new Error(
      "customer_access_token_required"
    );
  }

  return {
    "Content-Type":
      "application/json",

    Authorization:
      `Bearer ${normalizedAccessToken}`
  };
}
