// surface/js/debug/stripeDebug.js

const DEBUG_PARAM =
  String(
    new URLSearchParams(
      window.location.search
    ).get("debug") ?? ""
  )
    .trim()
    .toLowerCase();

const DEBUG_ENABLED =
  DEBUG_PARAM
    .split(",")
    .map(
      value =>
        value.trim()
    )
    .some(
      value =>
        value === "stripe" ||
        value === "all" ||
        value === "1" ||
        value === "true"
    );

const PANEL_ID =
  "stripeDebugPanel";

const OUTPUT_ID =
  "stripeDebugOutput";

const MAX_ENTRIES =
  120;

const MAX_SANITIZE_DEPTH =
  8;

const entries = [];

let outputElement =
  null;

let lastStatusText =
  null;

let lastSettlementStateKey =
  null;


/*
--------------------------------------------------
Safe text
--------------------------------------------------
*/

function sanitizeText(
  value
) {
  let text =
    String(
      value ?? ""
    );

  text =
    text.replace(
      /Bearer\s+[^\s]+/gi,
      "Bearer [REDACTED]"
    );

  text =
    text.replace(
      /\bsk_(?:live|test)_[A-Za-z0-9_-]+\b/g,
      "[STRIPE_SECRET_REDACTED]"
    );

  text =
    text.replace(
      /\bpk_(?:live|test)_[A-Za-z0-9_-]+\b/g,
      "[STRIPE_KEY_REDACTED]"
    );

  text =
    text.replace(
      /\blwlsk_[A-Za-z0-9_-]+\b/g,
      "[LINK_SECRET_REDACTED]"
    );

  text =
    text.replace(
      /\blwlpk_[A-Za-z0-9_-]+\b/g,
      "[LINK_KEY_REDACTED]"
    );

  text =
    text.replace(
      /\beyJ[A-Za-z0-9._-]{20,}\b/g,
      "[JWT_REDACTED]"
    );

  text =
    text.replace(
      /\b\d{3}-\d{2}-\d{4}\b/g,
      "[SSN_REDACTED]"
    );

  text =
    text.replace(
      /client_secret\s*[:=]\s*["']?[^"',}\s]+/gi,
      "client_secret=[REDACTED]"
    );

  text =
    text.replace(
      /(?:crypto_?payment_?token|payment_?token)\s*[:=]\s*["']?[^"',}\s]+/gi,
      "payment_token=[REDACTED]"
    );

  text =
    text.replace(
      /(?:access_?token|refresh_?token)\s*[:=]\s*["']?[^"',}\s]+/gi,
      "oauth_token=[REDACTED]"
    );

  if (
    text.length >
    500
  ) {
    return (
      text.slice(
        0,
        500
      ) +
      "…"
    );
  }

  return text;
}


function normalizeString(
  value
) {
  return String(
    value ?? ""
  ).trim();
}


function maskIdentifier(
  value
) {
  const normalized =
    normalizeString(
      value
    );

  if (!normalized) {
    return null;
  }

  if (
    normalized.length <=
    8
  ) {
    return "***";
  }

  return (
    `${normalized.slice(0, 4)}` +
    `…${normalized.slice(-4)}`
  );
}


function maskWalletAddress(
  value
) {
  const normalized =
    normalizeString(
      value
    );

  if (!normalized) {
    return null;
  }

  if (
    normalized.length <=
    12
  ) {
    return "***";
  }

  return (
    `${normalized.slice(0, 6)}` +
    `…${normalized.slice(-6)}`
  );
}


/*
--------------------------------------------------
Sensitive debug data guards
--------------------------------------------------
*/

function normalizeDebugKey(
  key
) {
  return normalizeString(
    key
  )
    .replace(
      /[^a-z0-9]/gi,
      ""
    )
    .toLowerCase();
}


function isSafePresenceKey(
  key,
  value
) {
  if (
    typeof value !==
      "boolean"
  ) {
    return false;
  }

  const normalizedKey =
    normalizeDebugKey(
      key
    );

  return (
    normalizedKey.endsWith(
      "present"
    ) ||
    normalizedKey.endsWith(
      "created"
    ) ||
    normalizedKey.endsWith(
      "available"
    ) ||
    normalizedKey.endsWith(
      "verified"
    ) ||
    normalizedKey.endsWith(
      "registered"
    ) ||
    normalizedKey.endsWith(
      "match"
    )
  );
}


function isSensitiveKey(
  key
) {
  const normalizedKey =
    normalizeDebugKey(
      key
    );

  if (!normalizedKey) {
    return false;
  }

  return (
    normalizedKey ===
      "authorization" ||
    normalizedKey ===
      "bearer" ||
    normalizedKey.includes(
      "accesstoken"
    ) ||
    normalizedKey.includes(
      "refreshtoken"
    ) ||
    normalizedKey.includes(
      "paymenttoken"
    ) ||
    normalizedKey.includes(
      "cryptopaymenttoken"
    ) ||
    normalizedKey.includes(
      "clientsecret"
    ) ||
    normalizedKey.includes(
      "oauthsecret"
    ) ||
    normalizedKey.includes(
      "oauthclientsecret"
    ) ||
    normalizedKey ===
      "secret" ||
    normalizedKey ===
      "stripekey" ||
    normalizedKey ===
      "stripesecret" ||
    normalizedKey ===
      "ssn" ||
    normalizedKey.includes(
      "socialsecurity"
    ) ||
    normalizedKey ===
      "idnumber" ||
    normalizedKey ===
      "taxid"
  );
}


function isWalletAddressKey(
  key
) {
  const normalizedKey =
    normalizeDebugKey(
      key
    );

  if (!normalizedKey) {
    return false;
  }

  return (
    normalizedKey ===
      "wallet" ||
    normalizedKey ===
      "walletaddress" ||
    normalizedKey ===
      "depositaddress" ||
    normalizedKey ===
      "destinationaddress" ||
    normalizedKey ===
      "returnaddress" ||
    normalizedKey ===
      "executionwalletaddress"
  );
}


function sanitizeDebugData(
  value,
  key = "",
  depth = 0,
  seen = new WeakSet()
) {
  if (
    value === null ||
    value === undefined
  ) {
    return value ??
      null;
  }

  if (
    isSensitiveKey(
      key
    )
  ) {
    if (
      isSafePresenceKey(
        key,
        value
      )
    ) {
      return value;
    }

    return "[REDACTED]";
  }

  if (
    isWalletAddressKey(
      key
    ) &&
    typeof value ===
      "string"
  ) {
    return maskWalletAddress(
      value
    );
  }

  if (
    typeof value ===
      "string"
  ) {
    return sanitizeText(
      value
    );
  }

  if (
    typeof value ===
      "number" ||
    typeof value ===
      "boolean"
  ) {
    return value;
  }

  if (
    typeof value ===
      "bigint"
  ) {
    return String(
      value
    );
  }

  if (
    typeof value ===
      "function"
  ) {
    return "[FUNCTION]";
  }

  if (
    typeof value !==
      "object"
  ) {
    return sanitizeText(
      value
    );
  }

  if (
    depth >=
    MAX_SANITIZE_DEPTH
  ) {
    return "[MAX_DEPTH]";
  }

  if (
    seen.has(
      value
    )
  ) {
    return "[CIRCULAR]";
  }

  seen.add(
    value
  );

  if (
    value instanceof Error
  ) {
    return {
      name:
        sanitizeText(
          value.name
        ),

      message:
        sanitizeText(
          value.message
        ),

      code:
        sanitizeText(
          value.code ??
          ""
        ) ||
        null,

      status:
        Number(
          value.status
        ) ||
        null
    };
  }

  if (
    Array.isArray(
      value
    )
  ) {
    return value.map(
      item =>
        sanitizeDebugData(
          item,
          "",
          depth + 1,
          seen
        )
    );
  }

  const result =
    {};

  for (
    const [
      childKey,
      childValue
    ]
    of Object.entries(
      value
    )
  ) {
    result[
      childKey
    ] =
      sanitizeDebugData(
        childValue,
        childKey,
        depth + 1,
        seen
      );
  }

  return result;
}


/*
--------------------------------------------------
Safe error projection
--------------------------------------------------
*/

function projectError(
  error
) {
  return {
    message:
      sanitizeText(
        error?.message ??
        error ??
        "unknown_error"
      ),

    code:
      sanitizeText(
        error?.code ??
        ""
      ) ||
      null,

    status:
      Number(
        error?.status
      ) ||
      null
  };
}


function extractPublicHttpError(
  payload
) {
  if (!payload) {
    return {
      code:
        null,

      message:
        null
    };
  }

  const source =
    payload?.error ??
    payload;

  if (
    typeof source ===
    "string"
  ) {
    return {
      code:
        null,

      message:
        sanitizeText(
          source
        )
    };
  }

  return {
    code:
      sanitizeText(
        source?.code ??
        payload?.code ??
        ""
      ) ||
      null,

    message:
      sanitizeText(
        source?.message ??
        payload?.message ??
        ""
      ) ||
      null
  };
}


/*
--------------------------------------------------
Verification projection
--------------------------------------------------
*/

function projectVerifications(
  value
) {
  if (
    Array.isArray(
      value
    )
  ) {
    return value.map(
      item => ({
        name:
          normalizeString(
            item?.name
          ) ||
          null,

        status:
          normalizeString(
            item?.status
          ) ||
          null
      })
    );
  }

  if (
    value &&
    typeof value ===
      "object"
  ) {
    return Object
      .entries(
        value
      )
      .reduce(
        (
          result,
          [
            name,
            item
          ]
        ) => {
          result[name] =
            typeof item ===
              "string"
              ? item
              : normalizeString(
                  item?.status
                ) ||
                null;

          return result;
        },
        {}
      );
  }

  return null;
}


function projectFieldNames(
  value
) {
  if (
    !Array.isArray(
      value
    )
  ) {
    return null;
  }

  return value
    .map(
      item =>
        typeof item ===
          "string"
          ? item
          : item?.name ??
            item?.field ??
            null
    )
    .filter(Boolean);
}


/*
--------------------------------------------------
Endpoint resolution
--------------------------------------------------
*/

function resolveObservedEndpoint(
  rawUrl
) {
  try {
    const url =
      new URL(
        rawUrl,
        window.location.origin
      );

    let path =
      url.pathname;

    /*
    ----------------------------------------------
    Support Surface proxy routes too.
    ----------------------------------------------
    */

    if (
      path ===
      "/api/proxy"
    ) {
      const proxyEndpoint =
        normalizeString(
          url.searchParams.get(
            "endpoint"
          )
        )
          .replace(
            /^\/+/,
            ""
          )
          .replace(
            /^v2\//,
            ""
          );

      if (proxyEndpoint) {
        path =
          `/v2/${proxyEndpoint}`;
      }
    }

    if (
      path.startsWith(
        "/v2/ramp/stripe/browser/"
      )
    ) {
      return path;
    }

    if (
      path ===
      "/v2/settlement/create"
    ) {
      return path;
    }

    if (
      path ===
      "/v2/settlement/status"
    ) {
      return path;
    }

    return null;
  } catch {
    return null;
  }
}


/*
--------------------------------------------------
Safe response projection
--------------------------------------------------
*/

function projectResponse(
  endpoint,
  payload
) {
  if (
    !payload ||
    typeof payload !==
      "object"
  ) {
    return null;
  }

  if (
    endpoint ===
    "/v2/settlement/create"
  ) {
    return {
      settlement_id:
        payload?.settlement_id ??
        payload?.settlement?.settlement_id ??
        payload?.settlement?.id ??
        payload?.id ??
        null,

      status:
        payload?.status ??
        payload?.settlement?.status ??
        null
    };
  }

  if (
    endpoint ===
    "/v2/settlement/status"
  ) {
    const status =
      payload?.status ??
      payload?.settlement?.status ??
      null;

    return {
      settlement_id:
        payload?.settlement_id ??
        payload?.settlement?.settlement_id ??
        payload?.settlement?.id ??
        null,

      status,

      next_action:
        payload?.next_action ??
        payload?.nextAction ??
        payload?.settlement?.next_action ??
        null
    };
  }

  if (
    endpoint.endsWith(
      "/config"
    )
  ) {
    return {
      mode:
        payload?.mode ??
        null,

      is_sandbox:
        typeof payload?.isSandbox ===
          "boolean"
          ? payload.isSandbox
          : typeof payload?.is_sandbox ===
              "boolean"
            ? payload.is_sandbox
            : null,

      publishable_key_present:
        Boolean(
          payload?.publishableKey ??
          payload?.publishable_key
        )
    };
  }

  if (
    endpoint.endsWith(
      "/link-auth-intent"
    )
  ) {
    return {
      auth_intent_created:
        Boolean(
          payload?.authIntentId ??
          payload?.auth_intent_id
        ),

      expires_at:
        payload?.expiresAt ??
        payload?.expires_at ??
        null
    };
  }

  if (
    endpoint.endsWith(
      "/customer-context"
    )
  ) {
    return {
      crypto_customer_id:
        maskIdentifier(
          payload?.cryptoCustomerId ??
          payload?.crypto_customer_id
        ),

      livemode:
        payload?.livemode ??
        null,

      verifications:
        projectVerifications(
          payload?.verifications
        ),

      provided_fields:
        projectFieldNames(
          payload?.providedFields ??
          payload?.provided_fields
        )
    };
  }

  if (
    endpoint.endsWith(
      "/kyc-context"
    )
  ) {
    return {
      crypto_customer_id:
        maskIdentifier(
          payload?.cryptoCustomerId ??
          payload?.crypto_customer_id
        ),

      verifications:
        projectVerifications(
          payload?.verifications
        ),

      provided_fields:
        projectFieldNames(
          payload?.providedFields ??
          payload?.provided_fields
        ),

      missing_fields:
        projectFieldNames(
          payload?.missingFields ??
          payload?.missing_fields
        )
    };
  }

  if (
    endpoint.endsWith(
      "/wallet-context"
    )
  ) {
    return {
      settlement_id:
        payload?.settlement_id ??
        null,

      crypto_customer_id:
        maskIdentifier(
          payload?.crypto_customer_id
        ),

      registered:
        payload?.registered ===
          true,

      consumer_wallet_id:
        maskIdentifier(
          payload?.consumer_wallet_id
        ),

      network:
        payload?.network ??
        null,

      wallet:
        maskWalletAddress(
          payload?.wallet_address
        )
    };
  }

  if (
    endpoint.endsWith(
      "/transaction-limits"
    )
  ) {
    const limits =
      Array.isArray(
        payload?.limits
      )
        ? payload.limits.map(
            item => ({
              limit:
                item?.limit ??
                null,

              settlement_speed:
                item?.settlement_speed ??
                null
            })
          )
        : null;

    return {
      settlement_id:
        payload?.settlement_id ??
        null,

      currency:
        payload?.currency ??
        null,

      payment_method:
        payload?.payment_method ??
        null,

      available:
        payload?.available ??
        null,

      limits
    };
  }

  if (
    endpoint.endsWith(
      "/headless-session"
    )
  ) {
    return {
      settlement_id:
        payload?.settlement_id ??
        null,

      session_id:
        maskIdentifier(
          payload?.sessionId ??
          payload?.session_id ??
          payload?.id
        ),

      client_secret_present:
        Boolean(
          payload?.clientSecret ??
          payload?.client_secret
        ),

      transaction_details_present:
        Boolean(
          payload?.transactionDetails ??
          payload?.transaction_details
        )
    };
  }

  return {
    ok:
      payload?.ok ??
      null
  };
}


/*
--------------------------------------------------
Output
--------------------------------------------------
*/

function formatTime() {
  return new Date()
    .toLocaleTimeString(
      [],
      {
        hour12:
          false
      }
    );
}


function render() {
  if (!outputElement) {
    return;
  }

  outputElement.textContent =
    entries
      .map(
        entry => {
          const data =
            entry.data &&
            Object.keys(
              entry.data
            ).length
              ? `\n${JSON.stringify(
                  entry.data,
                  null,
                  2
                )}`
              : "";

          return (
            `[${entry.time}] ` +
            `${entry.label}` +
            data
          );
        }
      )
      .join(
        "\n\n"
      );

  outputElement.scrollTop =
    outputElement.scrollHeight;
}


function writeEvent(
  label,
  data = {}
) {
  if (!DEBUG_ENABLED) {
    return;
  }

  const safeData =
    sanitizeDebugData(
      data
    );

  entries.push({
    time:
      formatTime(),

    label:
      sanitizeText(
        label
      ),

    data:
      (
        safeData &&
        typeof safeData ===
          "object" &&
        !Array.isArray(
          safeData
        )
      )
        ? safeData
        : {
            value:
              safeData
          }
  });

  while (
    entries.length >
    MAX_ENTRIES
  ) {
    entries.shift();
  }

  render();
}


function writeError(
  label,
  error
) {
  writeEvent(
    label,
    projectError(
      error
    )
  );
}


function clear() {
  entries.length =
    0;

  lastStatusText =
    null;

  lastSettlementStateKey =
    null;

  render();
}


/*
--------------------------------------------------
Debug panel
--------------------------------------------------
*/

function mountPanel() {
  if (!DEBUG_ENABLED) {
    return;
  }

  if (
    document.getElementById(
      PANEL_ID
    )
  ) {
    outputElement =
      document.getElementById(
        OUTPUT_ID
      );

    return;
  }

  const panel =
    document.createElement(
      "details"
    );

  panel.id =
    PANEL_ID;

  panel.open =
    true;

  panel.style.width =
    "100%";

  panel.style.marginTop =
    "14px";

  panel.style.border =
    "1px solid rgba(94, 234, 212, 0.22)";

  panel.style.borderRadius =
    "14px";

  panel.style.background =
    "rgba(0, 8, 31, 0.94)";

  panel.style.textAlign =
    "left";

  panel.style.overflow =
    "hidden";


  const summary =
    document.createElement(
      "summary"
    );

  summary.textContent =
    "Stripe debug";

  summary.style.cursor =
    "pointer";

  summary.style.padding =
    "12px 14px";

  summary.style.fontWeight =
    "700";

  summary.style.fontSize =
    "13px";


  const toolbar =
    document.createElement(
      "div"
    );

  toolbar.style.display =
    "flex";

  toolbar.style.gap =
    "8px";

  toolbar.style.padding =
    "0 12px 10px";


  const copyButton =
    document.createElement(
      "button"
    );

  copyButton.type =
    "button";

  copyButton.textContent =
    "Copy";

  copyButton.addEventListener(
    "click",
    async () => {
      try {
        await navigator
          .clipboard
          .writeText(
            outputElement
              ?.textContent ??
            ""
          );

        copyButton.textContent =
          "Copied";

        setTimeout(
          () => {
            copyButton.textContent =
              "Copy";
          },
          1000
        );
      } catch (
        error
      ) {
        writeError(
          "DEBUG_COPY_FAILED",
          error
        );
      }
    }
  );


  const clearButton =
    document.createElement(
      "button"
    );

  clearButton.type =
    "button";

  clearButton.textContent =
    "Clear";

  clearButton.addEventListener(
    "click",
    clear
  );


  for (
    const button
    of [
      copyButton,
      clearButton
    ]
  ) {
    button.style.padding =
      "6px 10px";

    button.style.borderRadius =
      "8px";

    button.style.border =
      "1px solid rgba(255,255,255,0.15)";

    button.style.background =
      "rgba(255,255,255,0.06)";

    button.style.color =
      "inherit";

    button.style.cursor =
      "pointer";
  }


  outputElement =
    document.createElement(
      "pre"
    );

  outputElement.id =
    OUTPUT_ID;

  outputElement.style.margin =
    "0";

  outputElement.style.padding =
    "12px";

  outputElement.style.maxHeight =
    "360px";

  outputElement.style.overflow =
    "auto";

  outputElement.style.whiteSpace =
    "pre-wrap";

  outputElement.style.wordBreak =
    "break-word";

  outputElement.style.fontSize =
    "11px";

  outputElement.style.lineHeight =
    "1.45";

  outputElement.style.background =
    "rgba(0,0,0,0.22)";


  toolbar.append(
    copyButton,
    clearButton
  );

  panel.append(
    summary,
    toolbar,
    outputElement
  );


  const statusBox =
    document.getElementById(
      "status"
    );

  if (
    statusBox?.parentNode
  ) {
    statusBox.insertAdjacentElement(
      "afterend",
      panel
    );
  } else {
    document.body.appendChild(
      panel
    );
  }

  render();
}


/*
--------------------------------------------------
Fetch observer

No request body.
No headers.
No tokens.
--------------------------------------------------
*/

function installFetchObserver() {
  const originalFetch =
    window.fetch.bind(
      window
    );

  window.fetch =
    async (
      input,
      init
    ) => {
      const rawUrl =
        typeof input ===
          "string"
          ? input
          : input?.url ??
            String(
              input ?? ""
            );

      const endpoint =
        resolveObservedEndpoint(
          rawUrl
        );

      if (!endpoint) {
        return originalFetch(
          input,
          init
        );
      }

      const method =
        normalizeString(
          init?.method ??
          input?.method ??
          "GET"
        )
          .toUpperCase();

      const startedAt =
        performance.now();

      writeEvent(
        "HTTP_REQUEST",
        {
          method,
          endpoint
        }
      );

      try {
        const response =
          await originalFetch(
            input,
            init
          );

        const durationMs =
          Math.round(
            performance.now() -
            startedAt
          );

        const payload =
          await response
            .clone()
            .json()
            .catch(
              () =>
                null
            );

        if (!response.ok) {
          writeEvent(
            "HTTP_ERROR",
            {
              method,
              endpoint,

              status:
                response.status,

              duration_ms:
                durationMs,

              ...extractPublicHttpError(
                payload
              )
            }
          );

          return response;
        }

        const projected =
          projectResponse(
            endpoint,
            payload
          );

        /*
        ----------------------------------------------
        Avoid settlement status poll spam.

        Dedupe by:
        settlement_id + status

        Never dedupe only by status because two
        different settlements may legitimately have
        the same lifecycle state.
        ----------------------------------------------
        */

        if (
          endpoint ===
          "/v2/settlement/status"
        ) {
          const settlementId =
            normalizeString(
              projected
                ?.settlement_id
            );

          const nextStatus =
            normalizeString(
              projected
                ?.status
            );

          const nextStateKey =
            (
              settlementId ||
              nextStatus
            )
              ? (
                  `${settlementId || "unknown"}:` +
                  `${nextStatus || "unknown"}`
                )
              : null;

          if (
            nextStateKey &&
            nextStateKey ===
              lastSettlementStateKey
          ) {
            return response;
          }

          if (
            nextStateKey
          ) {
            lastSettlementStateKey =
              nextStateKey;
          }
        }

        writeEvent(
          "HTTP_OK",
          {
            method,
            endpoint,

            status:
              response.status,

            duration_ms:
              durationMs,

            ...(
              projected ??
              {}
            )
          }
        );

        return response;
      } catch (
        error
      ) {
        writeEvent(
          "NETWORK_ERROR",
          {
            method,
            endpoint,

            ...projectError(
              error
            )
          }
        );

        throw error;
      }
    };
}


/*
--------------------------------------------------
Browser errors
--------------------------------------------------
*/

function installGlobalErrorObservers() {
  window.addEventListener(
    "error",
    event => {
      writeEvent(
        "WINDOW_ERROR",
        {
          message:
            sanitizeText(
              event?.message ??
              "window_error"
            ),

          source:
            sanitizeText(
              event?.filename ??
              ""
            ) ||
            null,

          line:
            event?.lineno ??
            null,

          column:
            event?.colno ??
            null
        }
      );
    }
  );

  window.addEventListener(
    "unhandledrejection",
    event => {
      writeError(
        "UNHANDLED_REJECTION",
        event?.reason
      );
    }
  );
}


/*
--------------------------------------------------
Surface lifecycle events
--------------------------------------------------
*/

function installSurfaceEventObservers() {
  const eventNames = [
    "unibridge:quote",
    "unibridge:auth",
    "unibridge:payment",
    "unibridge:funding",
    "unibridge:done"
  ];

  for (
    const eventName
    of eventNames
  ) {
    window.addEventListener(
      eventName,
      () => {
        writeEvent(
          "SURFACE_EVENT",
          {
            event:
              eventName
          }
        );
      }
    );
  }
}


/*
--------------------------------------------------
Visible status observer
--------------------------------------------------
*/

function installStatusObserver() {
  const statusBox =
    document.getElementById(
      "status"
    );

  if (!statusBox) {
    return;
  }

  const capture =
    () => {
      const text =
        sanitizeText(
          statusBox.textContent ??
          ""
        )
          .trim();

      if (
        !text ||
        text ===
          lastStatusText
      ) {
        return;
      }

      lastStatusText =
        text;

      writeEvent(
        "UI_STATUS",
        {
          text
        }
      );
    };

  const observer =
    new MutationObserver(
      capture
    );

  observer.observe(
    statusBox,
    {
      childList:
        true,

      subtree:
        true,

      characterData:
        true
    }
  );

  capture();
}


/*
--------------------------------------------------
Public debug interface

All data passed through this interface is recursively
sanitized before storage/rendering.

This allows later Stripe SDK checkpoints without
creating another debug subsystem:

window.UnibridgeStripeDebug.event(...)
--------------------------------------------------
*/

window.UnibridgeStripeDebug =
  Object.freeze({
    enabled:
      DEBUG_ENABLED,

    event:
      writeEvent,

    error:
      writeError,

    clear,

    snapshot:
      () =>
        entries.map(
          item =>
            sanitizeDebugData(
              item
            )
        )
  });


/*
--------------------------------------------------
Boot
--------------------------------------------------
*/

if (DEBUG_ENABLED) {
  mountPanel();

  installFetchObserver();
  installGlobalErrorObservers();
  installSurfaceEventObservers();
  installStatusObserver();

  writeEvent(
    "STRIPE_DEBUG_READY",
    {
      mode:
        "surface",

      observer:
        "safe"
    }
  );
}
