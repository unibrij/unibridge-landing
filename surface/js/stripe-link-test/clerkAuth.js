// unibridge-landing/surface/js/stripe-link-test/clerkAuth.js

/*
--------------------------------------------------
Stripe diagnostic — Clerk authentication

Owns ONLY:

- binding this page lifetime to one Clerk session
- recovering that exact session if Clerk.session becomes null
- minting a fresh Clerk bearer token
- building authenticated JSON headers

Does NOT own:

- Stripe
- settlement state
- UI
- API requests
- flow state

Identity invariant:

Once this module boots, every authenticated UniBridge
request made by this diagnostic page must use the SAME
Clerk session ID.

Never fall back to:
- signedInSessions[0]
- another active session
- another user
--------------------------------------------------
*/


/*
--------------------------------------------------
Basic helpers
--------------------------------------------------
*/

function normalizeString(
  value
) {
  return String(
    value ?? ""
  ).trim();
}


function requireString(
  value,
  code
) {
  const normalized =
    normalizeString(
      value
    );

  if (!normalized) {
    throw new Error(
      code
    );
  }

  return normalized;
}


function isActiveSession(
  session
) {
  return Boolean(
    session &&
    normalizeString(
      session.status
    )
      .toLowerCase() ===
      "active" &&
    typeof session.getToken ===
      "function"
  );
}


function findSessionById(
  client,
  sessionId
) {
  const normalizedSessionId =
    normalizeString(
      sessionId
    );

  if (
    !normalizedSessionId
  ) {
    return null;
  }

  const sessions =
    Array.isArray(
      client?.signedInSessions
    )
      ? client.signedInSessions
      : [];

  return (
    sessions.find(
      (
        session
      ) =>
        normalizeString(
          session?.id
        ) ===
        normalizedSessionId
    ) ||
    null
  );
}


/*
--------------------------------------------------
Clerk access
--------------------------------------------------
*/

function requireClerk() {
  const clerk =
    window.Clerk;

  if (!clerk) {
    throw new Error(
      "clerk_not_available"
    );
  }

  return clerk;
}


/*
--------------------------------------------------
Refresh Client resource

This is intentionally best-effort during recovery.

The caller still performs strict identity validation
afterward.
--------------------------------------------------
*/

async function reloadClerkClient(
  clerk
) {
  const client =
    clerk?.client;

  if (
    !client ||
    typeof client.reload !==
      "function"
  ) {
    return (
      clerk?.client ||
      null
    );
  }

  try {
    const refreshedClient =
      await client.reload();

    return (
      refreshedClient ||
      clerk?.client ||
      client
    );
  } catch (
    error
  ) {
    console.warn(
      "CLERK_CLIENT_RELOAD_FAILED",
      {
        message:
          error?.message ??
          String(
            error
          )
      }
    );

    return (
      clerk?.client ||
      client
    );
  }
}


/*
--------------------------------------------------
Resolve initial Clerk session

Preferred source:
1. Clerk.session

Recovery source:
2. Client.lastActiveSessionId

Important:
- lastActiveSessionId identifies a specific session.
- We never select an arbitrary signed-in session.
--------------------------------------------------
*/

async function resolveInitialSession(
  clerk
) {
  const directSession =
    clerk.session;

  if (
    isActiveSession(
      directSession
    )
  ) {
    return directSession;
  }

  const client =
    await reloadClerkClient(
      clerk
    );

  /*
  --------------------------------------------------
  Reload may have repopulated Clerk.session.
  --------------------------------------------------
  */

  const reloadedDirectSession =
    clerk.session;

  if (
    isActiveSession(
      reloadedDirectSession
    )
  ) {
    return reloadedDirectSession;
  }

  /*
  --------------------------------------------------
  No active shortcut.

  Use only Clerk's explicit last-active session ID.

  Do NOT use signedInSessions[0].
  --------------------------------------------------
  */

  const lastActiveSessionId =
    normalizeString(
      client?.lastActiveSessionId
    );

  if (
    !lastActiveSessionId
  ) {
    throw new Error(
      "clerk_session_not_available"
    );
  }

  const candidate =
    findSessionById(
      client,
      lastActiveSessionId
    );

  if (
    !isActiveSession(
      candidate
    )
  ) {
    throw new Error(
      "clerk_session_not_available"
    );
  }

  /*
  --------------------------------------------------
  Restore the exact Clerk-selected last-active session.

  setActive accepts a session ID, so use the immutable
  identity instead of relying on an arbitrary array item.
  --------------------------------------------------
  */

  if (
    typeof clerk.setActive ===
      "function"
  ) {
    await clerk.setActive({
      session:
        lastActiveSessionId
    });
  }

  const restoredSession =
    clerk.session;

  if (
    isActiveSession(
      restoredSession
    ) &&
    normalizeString(
      restoredSession.id
    ) ===
      lastActiveSessionId
  ) {
    return restoredSession;
  }

  /*
  --------------------------------------------------
  The exact matching SessionResource itself is still
  safe to use if Clerk's shortcut has not updated yet.
  --------------------------------------------------
  */

  return candidate;
}


/*
--------------------------------------------------
Factory

Binding happens ONCE.

The resulting session ID becomes immutable for the
lifetime of this diagnostic page.
--------------------------------------------------
*/

export async function createClerkAuth() {
  const clerk =
    requireClerk();

  const initialSession =
    await resolveInitialSession(
      clerk
    );

  const boundSessionId =
    requireString(
      initialSession?.id,
      "clerk_session_id_missing"
    );


  /*
  --------------------------------------------------
  Resolve the exact bound session later

  Recovery sequence:

  1. Current Clerk.session, only if IDs match.
  2. Reload Client.
  3. Re-check Clerk.session.
  4. Find exact bound ID in signedInSessions.
  5. Restore exact bound ID through setActive().
  6. Re-check.
  7. If shortcut still lags, use exact matching resource.

  Never substitute another session.
  --------------------------------------------------
  */

  async function resolveBoundSession() {
    const currentClerk =
      requireClerk();

    const directSession =
      currentClerk.session;

    if (
      isActiveSession(
        directSession
      ) &&
      normalizeString(
        directSession.id
      ) ===
        boundSessionId
    ) {
      return directSession;
    }

    const client =
      await reloadClerkClient(
        currentClerk
      );

    /*
    --------------------------------------------------
    Reload may restore the exact shortcut.
    --------------------------------------------------
    */

    const reloadedSession =
      currentClerk.session;

    if (
      isActiveSession(
        reloadedSession
      ) &&
      normalizeString(
        reloadedSession.id
      ) ===
        boundSessionId
    ) {
      console.log(
        "CLERK_BOUND_SESSION_RECOVERED",
        {
          strategy:
            "client_reload"
        }
      );

      return reloadedSession;
    }

    /*
    --------------------------------------------------
    Find ONLY the session captured at boot.
    --------------------------------------------------
    */

    const boundSession =
      findSessionById(
        client,
        boundSessionId
      );

    if (
      !boundSession
    ) {
      throw new Error(
        "clerk_bound_session_not_found"
      );
    }

    if (
      !isActiveSession(
        boundSession
      )
    ) {
      throw new Error(
        "clerk_bound_session_not_active"
      );
    }

    /*
    --------------------------------------------------
    Restore this exact session as active.

    A currently active DIFFERENT Clerk session is never
    accepted for authentication by this page.
    --------------------------------------------------
    */

    if (
      typeof currentClerk.setActive ===
        "function"
    ) {
      try {
        await currentClerk.setActive({
          session:
            boundSessionId
        });
      } catch (
        error
      ) {
        console.warn(
          "CLERK_BOUND_SESSION_SET_ACTIVE_FAILED",
          {
            message:
              error?.message ??
              String(
                error
              )
          }
        );
      }
    }

    const restoredSession =
      currentClerk.session;

    if (
      isActiveSession(
        restoredSession
      ) &&
      normalizeString(
        restoredSession.id
      ) ===
        boundSessionId
    ) {
      console.log(
        "CLERK_BOUND_SESSION_RECOVERED",
        {
          strategy:
            "set_active"
        }
      );

      return restoredSession;
    }

    /*
    --------------------------------------------------
    setActive may not have propagated to Clerk.session
    synchronously.

    We may still safely mint from boundSession because:
    - its exact ID matches the boot-bound ID
    - its status is active
    - it came from Clerk's signed-in session collection
    --------------------------------------------------
    */

    console.log(
      "CLERK_BOUND_SESSION_RECOVERED",
      {
        strategy:
          "exact_session_resource"
      }
    );

    return boundSession;
  }


  /*
  --------------------------------------------------
  Fresh bearer token

  Never:
  - log token
  - return token metadata
  - persist token
  --------------------------------------------------
  */

  async function getBearerToken() {
    const session =
      await resolveBoundSession();

    const resolvedSessionId =
      requireString(
        session?.id,
        "clerk_session_id_missing"
      );

    /*
    --------------------------------------------------
    Final identity guard immediately before token mint.
    --------------------------------------------------
    */

    if (
      resolvedSessionId !==
        boundSessionId
    ) {
      throw new Error(
        "clerk_session_identity_mismatch"
      );
    }

    if (
      typeof session.getToken !==
        "function"
    ) {
      throw new Error(
        "clerk_get_token_not_available"
      );
    }

    const token =
      await session.getToken({
        skipCache:
          true
      });

    return requireString(
      token,
      "missing_clerk_bearer_token"
    );
  }


  /*
  --------------------------------------------------
  Authenticated JSON headers

  This is the only public helper needed by the
  diagnostic settlement / Stripe funding modules.
  --------------------------------------------------
  */

  async function buildAuthenticatedJsonHeaders() {
    const token =
      await getBearerToken();

    return {
      "Content-Type":
        "application/json",

      Accept:
        "application/json",

      Authorization:
        `Bearer ${token}`
    };
  }


  /*
  --------------------------------------------------
  Public contract
  --------------------------------------------------
  */

  return {
    buildAuthenticatedJsonHeaders
  };
}
