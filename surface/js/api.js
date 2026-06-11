// unibrij/unibridge-landing/surface/js/api.js

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

  async function apiPost(path, payload) {
    const r = await fetch(
      "/api/proxy?endpoint=" + encodeURIComponent(path),
      {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
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
        headers: {
          "content-type": "application/json"
        },
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
      method: "GET"
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
