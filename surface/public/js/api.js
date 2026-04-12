// unibrij/unibridge-landing/surface/public/js/api.js

window.UnibridgeApi = (() => {
  function parseResponse(r) {
    return r.text().then((text) => {
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        data = { raw: text };
      }

      if (!r.ok) {
        const msg =
          typeof data?.error === "string"
            ? data.error
            : data?.error?.message ||
              data?.message ||
              data?.raw ||
              "api_error";

        throw new Error(msg);
      }

      return data;
    });
  }

  function getClientReturnUrl() {
    try {
      if (
        typeof window !== "undefined" &&
        window.location &&
        typeof window.location.href === "string"
      ) {
        const href = window.location.href.trim();
        return href || null;
      }
    } catch {}

    return null;
  }

  function getClientOrigin() {
    try {
      if (
        typeof window !== "undefined" &&
        window.location &&
        typeof window.location.origin === "string"
      ) {
        const origin = window.location.origin.trim();
        return origin || null;
      }
    } catch {}

    return null;
  }

  function buildHeaders({
    includeJsonContentType = true,
    extra = {}
  } = {}) {
    const headers = {
      ...extra
    };

    if (includeJsonContentType) {
      headers["content-type"] = "application/json";
    }

    const returnUrl =
      getClientReturnUrl();

    if (returnUrl) {
      headers["x-return-url"] = returnUrl;
    }

    const clientOrigin =
      getClientOrigin();

    if (clientOrigin) {
      headers["x-client-origin"] = clientOrigin;
    }

    return headers;
  }

  async function apiPost(path, payload) {
    const r = await fetch(
      "/api/proxy?endpoint=" + encodeURIComponent(path),
      {
        method: "POST",
        headers: buildHeaders(),
        body: JSON.stringify(payload || {})
      }
    );

    return parseResponse(r);
  }

  async function apiPatch(path, payload) {
    const r = await fetch(
      "/api/proxy?endpoint=" + encodeURIComponent(path),
      {
        method: "PATCH",
        headers: buildHeaders(),
        body: JSON.stringify(payload || {})
      }
    );

    return parseResponse(r);
  }

  async function apiGet(path, query = {}) {
    const url = new URL("/api/proxy", window.location.origin);
    url.searchParams.set("endpoint", path);

    Object.entries(query || {}).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== "") {
        url.searchParams.set(k, String(v));
      }
    });

    const r = await fetch(url.toString(), {
      method: "GET",
      headers: buildHeaders({
        includeJsonContentType: false
      })
    });

    return parseResponse(r);
  }

  return {
    parseResponse,
    apiPost,
    apiPatch,
    apiGet
  };
})();
