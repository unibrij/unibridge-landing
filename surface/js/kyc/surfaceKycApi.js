// surface/js/kyc/surfaceKycApi.js

function getApiPost() {
  const apiPost =
    window.UnibridgeApi?.apiPost;

  if (
    typeof apiPost !==
    "function"
  ) {
    throw new Error(
      "surface_api_unavailable"
    );
  }

  return apiPost;
}

function normalizeKycSessionId(
  value
) {
  const id =
    String(
      value ||
      ""
    ).trim();

  if (
    !/^kyc_[A-Za-z0-9_-]+$/
      .test(id)
  ) {
    throw new Error(
      "invalid_kyc_session_id"
    );
  }

  return id;
}

export async function createSurfaceKycSession() {
  const apiPost =
    getApiPost();

  return apiPost(
    "fiat/kyc/shared/create",
    {}
  );
}

export async function reconcileSurfaceKycSession({
  kyc_session_id
} = {}) {
  const id =
    normalizeKycSessionId(
      kyc_session_id
    );

  const apiPost =
    getApiPost();

  return apiPost(
    `fiat/kyc/shared/${id}/reconcile`,
    {}
  );
}
