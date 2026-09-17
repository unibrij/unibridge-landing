// unibridge-landing/surface/js/stripe-link-test/clerkAuth.js

/*
--------------------------------------------------
Stripe diagnostic — Clerk authentication

Owns ONLY:

- resolving an existing Clerk session
- opening Clerk Sign-In when no session exists
- binding this page lifetime to one exact Clerk session
- recovering that exact session if Clerk.session becomes null
- minting a fresh Clerk bearer token
- building authenticated JSON headers

Does NOT own:

- Stripe
- settlement state
- UniBridge page UI
- API requests
- flow state

Identity invariant:

Before binding:
- if no active Clerk session exists, interactive sign-in
  may establish one.

After binding:
- every authenticated UniBridge request made by this
  diagnostic page must use the SAME Clerk session ID.

Never fall back to:
- signedInSessions[0]
- another arbitrary session
- another active user after binding
--------------------------------------------------
*/


/*
--------------------------------------------------
Constants
--------------------------------------------------
*/

const CLERK_SIGN_IN_TIMEOUT_MS =
  180000;


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
Refresh Clerk Client

Best-effort only.

All identity decisions are still validated afterward.
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
Interactive Clerk Sign-In

Used ONLY before this diagnostic page has bound itself
to a Clerk session.

Flow:

1. Register Clerk state listener.
2. Re-check Clerk.session to close setup race.
3. Open Clerk Sign-In overlay.
4. Wait until Clerk reports an active session.
5. Return that exact SessionResource.
6. createClerkAuth() binds its ID permanently.

The request that triggered authentication remains pending
and continues automatically after sign-in succeeds.

Timeout prevents an abandoned sign-in overlay from locking
the diagnostic forever.
--------------------------------------------------
*/

async function waitForInteractiveSignIn(
  clerk
) {
  if (
    typeof clerk.addListener !==
      "function"
  ) {
    throw new Error(
      "clerk_listener_not_available"
    );
  }

  if (
    typeof clerk.openSignIn !==
      "function"
  ) {
    throw new Error(
      "clerk_open_sign_in_not_available"
    );
  }

  return new Promise(
    (
      resolve,
      reject
    ) => {
      let settled =
        false;

      let unsubscribe =
        null;

      let timeoutId =
        null;


      function cleanup() {
        if (
          timeoutId !==
            null
        ) {
          clearTimeout(
            timeoutId
          );

          timeoutId =
            null;
        }

        if (
          typeof unsubscribe ===
            "function"
        ) {
          try {
            unsubscribe();
          } catch {
            // Best-effort listener cleanup.
          }

          unsubscribe =
            null;
        }
      }


      function finishSuccess(
        session
      ) {
        if (
          settled
        ) {
          return;
        }

        if (
          !isActiveSession(
            session
          )
        ) {
          return;
        }

        settled =
          true;

        cleanup();

        /*
        --------------------------------------------------
        Sign-In normally closes itself after successful
        completion.

        closeSignIn() is best-effort only.
        --------------------------------------------------
        */

        if (
          typeof clerk.closeSignIn ===
            "function"
        ) {
          try {
            clerk.closeSignIn();
          } catch {
            // No-op.
          }
        }

        resolve(
          session
        );
      }


      function finishError(
        error
      ) {
        if (
          settled
        ) {
          return;
        }

        settled =
          true;

        cleanup();

        reject(
          error
        );
      }


      try {
        /*
        --------------------------------------------------
        skipInitialEmit avoids a synchronous initial
        callback racing with assignment of unsubscribe.

        We perform our own direct-session check below.
        --------------------------------------------------
        */

        unsubscribe =
          clerk.addListener(
            (
              emission
            ) => {
              const emittedSession =
                emission?.session;

              if (
                isActiveSession(
                  emittedSession
                )
              ) {
                finishSuccess(
                  emittedSession
                );

                return;
              }

              /*
              --------------------------------------------------
              Some Clerk updates may expose the active shortcut
              before/after the emission object is populated.
              Re-check the authoritative Clerk shortcut too.
              --------------------------------------------------
              */

              const currentSession =
                clerk.session;

              if (
                isActiveSession(
                  currentSession
                )
              ) {
                finishSuccess(
                  currentSession
                );
              }
            },
            {
              skipInitialEmit:
                true
            }
          );


        /*
        --------------------------------------------------
        Close the race between initial resolution and
        listener registration.
        --------------------------------------------------
        */

        const currentSession =
          clerk.session;

        if (
          isActiveSession(
            currentSession
          )
        ) {
          finishSuccess(
            currentSession
          );

          return;
        }


        timeoutId =
          setTimeout(
            () => {
              finishError(
                new Error(
                  "clerk_sign_in_timeout"
                )
              );
            },
            CLERK_SIGN_IN_TIMEOUT_MS
          );


        console.log(
          "CLERK_INTERACTIVE_SIGN_IN_REQUIRED"
        );

        clerk.openSignIn();
      } catch (
        error
      ) {
        finishError(
          error
        );
      }
    }
  );
}


/*
--------------------------------------------------
Resolve initial Clerk session

Preferred:

1. Clerk.session
2. Reload Client and re-check Clerk.session
3. Client.lastActiveSessionId, exact match only
4. Interactive Clerk Sign-In

Before the page is bound, a newly authenticated session
is valid because that is the explicit identity chosen by
the user.

After this function returns, createClerkAuth() binds that
exact session ID permanently.
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
  Try ONLY Clerk's explicitly selected last-active ID.

  Never use signedInSessions[0].
  --------------------------------------------------
  */

  const lastActiveSessionId =
    normalizeString(
      client?.lastActiveSessionId
    );

  if (
    lastActiveSessionId
  ) {
    const candidate =
      findSessionById(
        client,
        lastActiveSessionId
      );

    if (
      isActiveSession(
        candidate
      )
    ) {
      if (
        typeof clerk.setActive ===
          "function"
      ) {
        try {
          await clerk.setActive({
            session:
              lastActiveSessionId
          });
        } catch (
          error
        ) {
          console.warn(
            "CLERK_INITIAL_SET_ACTIVE_FAILED",
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
      The exact matching SessionResource is still safe if
      Clerk.session has not propagated yet.
      --------------------------------------------------
      */

      return candidate;
    }
  }


  /*
  --------------------------------------------------
  No usable existing session.

  Ask the user to authenticate through Clerk.

  The session returned here becomes the immutable bound
  identity immediately afterward.
  --------------------------------------------------
  */

  return waitForInteractiveSignIn(
    clerk
  );
}


/*
--------------------------------------------------
Factory

Binding happens exactly ONCE.

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

  if (
    !isActiveSession(
      initialSession
    )
  ) {
    throw new Error(
      "clerk_session_not_available"
    );
  }

  const boundSessionId =
    requireString(
      initialSession?.id,
      "clerk_session_id_missing"
    );

  console.log(
    "CLERK_SESSION_BOUND",
    {
      sessionId:
        boundSessionId
    }
  );


  /*
  --------------------------------------------------
  Resolve exact bound session later

  Recovery sequence:

  1. Current Clerk.session, only if IDs match.
  2. Reload Client.
  3. Re-check Clerk.session.
  4. Find exact bound ID in signedInSessions.
  5. Restore exact bound ID through setActive().
  6. Re-check.
  7. If Clerk.session still lags, use exact matching
     SessionResource.

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
    Find ONLY the session captured at binding time.
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

    A different currently active Clerk session is never
    accepted by this page after binding.
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
    setActive() may not have propagated to Clerk.session
    synchronously.

    The exact SessionResource remains safe because:
    - its ID exactly matches boundSessionId
    - it is active
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
  - persist token
  - expose token metadata
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
    Final identity guard immediately before minting.
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
