
 // unibridge-landing/receive/receive-analytics.js

/*
--------------------------------------------------
Receive Analytics

Tracks visits to the Receive entry page.

- No authentication required.
- Excludes public QR links.
- Uses a persistent browser visitor ID.
- Backend deduplicates visits per UTC day.
- Never blocks the Receive experience.
--------------------------------------------------
*/

const VISITOR_KEY =
  "ub_receive_analytics_visitor_id_v1";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;


/*
--------------------------------------------------
Resolve persistent visitor identity
--------------------------------------------------
*/

function getVisitorId() {
  try {
    const stored =
      window.localStorage.getItem(
        VISITOR_KEY
      );

    if (
      stored &&
      UUID_PATTERN.test(stored)
    ) {
      return stored;
    }

    const visitorId =
      window.crypto?.randomUUID?.();

    if (
      !visitorId ||
      !UUID_PATTERN.test(visitorId)
    ) {
      return null;
    }

    window.localStorage.setItem(
      VISITOR_KEY,
      visitorId
    );

    return visitorId;
  } catch {
    // Do not generate unstable visitor identities
    // when browser storage is unavailable.
    return null;
  }
}


/*
--------------------------------------------------
Validate Receive entry route

/receive          -> tracked
/receive/         -> tracked
/receive/:token   -> excluded
--------------------------------------------------
*/

function isReceiveEntryPage() {
  return /^\/receive\/?$/.test(
    window.location.pathname
  );
}


/*
--------------------------------------------------
Track Receive entry

POST /api/proxy?endpoint=receive%2Fevents

The Landing proxy signs the request with HMAC.
The Backend performs daily deduplication.
--------------------------------------------------
*/

export async function trackReceiveEntry() {
  if (
    !isReceiveEntryPage()
  ) {
    return false;
  }

  const visitorId =
    getVisitorId();

  if (
    !visitorId
  ) {
    return false;
  }

  try {
    const response =
      await fetch(
        "/api/proxy?endpoint=receive%2Fevents",
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",

            Accept:
              "application/json"
          },

          credentials:
            "same-origin",

          keepalive:
            true,

          body:
            JSON.stringify({
              visitor_id:
                visitorId
            })
        }
      );

    return response.ok;
  } catch {
    // Analytics must never block
    // Receive authentication,
    // profile creation or navigation.
    return false;
  }
}
