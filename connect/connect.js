// connect/connect.js

import {
  createPayoutIntent as requestPayoutIntent
} from "./api.js";

import {
  authenticateConnect
} from "./auth.js";

import {
  buildConnectPayload,
  createFingerprint,
  isUserRejectedError,
  readAppKitState
} from "./wallet.js";

const elements = {
  walletButton:
    document.getElementById(
      "wallet-button"
    ),

  payoutForm:
    document.getElementById(
      "payout-form"
    ),

  debug:
    document.getElementById(
      "connect-debug"
    ),

  retry:
    document.getElementById(
      "retry-connect"
    ),

  createPayoutIntent:
    document.getElementById(
      "create-payout-intent"
    )
};

if (elements.walletButton) {
  elements.walletButton.innerHTML =
    "<appkit-button></appkit-button>";
}

const state = {
  requestVersion:
    0,

  pendingFingerprint:
    null,

  resolvedFingerprint:
    null,

  failedFingerprint:
    null,

  failedReason:
    null,

  connectSessionId:
    null,

  connectSessionSecret:
    null,

  walletAddress:
    null,

  chainId:
    null,

  payoutIntentPending:
    false
};

function safeJson(
  value
) {
  try {
    return JSON.stringify(
      value,
      null,
      2
    );
  } catch {
    return String(
      value
    );
  }
}

function writeDebug(
  label,
  value = {}
) {
  if (!elements.debug) {
    return;
  }

  elements.debug.textContent =
    `${label}\n${safeJson(value)}`;
}

function showPayoutForm(
  visible
) {
  elements.payoutForm
    ?.classList
    .toggle(
      "hidden",
      !visible
    );
}

function showRetry(
  visible
) {
  elements.retry
    ?.classList
    .toggle(
      "hidden",
      !visible
    );
}

function setPayoutIntentPending(
  pending
) {
  state.payoutIntentPending =
    pending;

  if (
    elements.createPayoutIntent
  ) {
    elements.createPayoutIntent.disabled =
      pending;
  }
}

function clearAuthenticatedState() {
  state.connectSessionId =
    null;

  state.connectSessionSecret =
    null;

  state.walletAddress =
    null;

  state.chainId =
    null;

  state.resolvedFingerprint =
    null;

  showPayoutForm(
    false
  );
}

function clearFailure() {
  state.failedFingerprint =
    null;

  state.failedReason =
    null;

  showRetry(
    false
  );
}

function resetConnectState() {
  state.requestVersion +=
    1;

  state.pendingFingerprint =
    null;

  clearAuthenticatedState();
  clearFailure();
}

function isCurrentRequest(
  requestVersion
) {
  return (
    requestVersion ===
    state.requestVersion
  );
}

function currentWalletSnapshot() {
  const {
    appkit,
    account,
    network
  } =
    readAppKitState();

  const payload =
    buildConnectPayload(
      account,
      network
    );

  const isConnected =
    Boolean(
      appkit
    ) &&
    account?.isConnected !==
      false &&
    Boolean(
      payload.wallet_address
    );

  return {
    appkit,
    account,
    payload,
    isConnected,

    fingerprint:
      isConnected
        ? createFingerprint(
            payload
          )
        : null
  };
}

function isSameWalletSnapshot(
  fingerprint
) {
  const snapshot =
    currentWalletSnapshot();

  return (
    snapshot.isConnected &&
    snapshot.fingerprint ===
      fingerprint
  );
}

async function startAuthentication(
  snapshot
) {
  const {
    appkit,
    payload,
    fingerprint
  } =
    snapshot;

  if (
    !fingerprint ||
    state.pendingFingerprint
  ) {
    return;
  }

  const requestVersion =
    ++state.requestVersion;

  state.pendingFingerprint =
    fingerprint;

  clearAuthenticatedState();
  clearFailure();

  writeDebug(
    "Creating authenticated connect session",
    {
      wallet_address:
        payload.wallet_address,

      chain_id:
        payload.chain_id
    }
  );

  try {
    const result =
      await authenticateConnect({
        appkit,
        payload,

        onChallenge: ({
          walletAddress,
          chainId,
          expiresAt
        }) => {
          if (
            !isCurrentRequest(
              requestVersion
            ) ||
            !isSameWalletSnapshot(
              fingerprint
            )
          ) {
            return;
          }

          writeDebug(
            "Confirm wallet signature",
            {
              wallet_address:
                walletAddress,

              chain_id:
                chainId,

              expires_at:
                expiresAt
            }
          );
        }
      });

    if (
      !isCurrentRequest(
        requestVersion
      ) ||
      !isSameWalletSnapshot(
        fingerprint
      )
    ) {
      return;
    }

    state.connectSessionId =
      result.connectSessionId;

    state.connectSessionSecret =
      result.connectSessionSecret;

    state.walletAddress =
      result.walletAddress;

    state.chainId =
      result.chainId;

    state.resolvedFingerprint =
      fingerprint;

    clearFailure();

    showPayoutForm(
      true
    );

    writeDebug(
      "Connect authenticated",
      {
        connect_session_id:
          result.connectSessionId,

        wallet_address:
          result.walletAddress,

        chain_id:
          result.chainId,

        customer_id:
          result.customerId,

        customer_identity_id:
          result.customerIdentityId,

        auth_expires_at:
          result.authExpiresAt
      }
    );
  } catch (error) {
    if (
      !isCurrentRequest(
        requestVersion
      )
    ) {
      return;
    }

    clearAuthenticatedState();

    state.failedFingerprint =
      fingerprint;

    state.failedReason =
      isUserRejectedError(
        error
      )
        ? "rejected"
        : "failed";

    showRetry(
      true
    );

    writeDebug(
      state.failedReason ===
        "rejected"
        ? "Wallet signature rejected"
        : "Connect authentication failed",
      {
        message:
          error?.message ||
          String(
            error
          ),

        next_step:
          "Retry when ready."
      }
    );
  } finally {
    if (
      isCurrentRequest(
        requestVersion
      ) &&
      state.pendingFingerprint ===
        fingerprint
    ) {
      state.pendingFingerprint =
        null;
    }
  }
}

function pollWallet() {
  const snapshot =
    currentWalletSnapshot();

  if (!snapshot.appkit) {
    writeDebug(
      "Waiting for window.appKit",
      {
        hasWindowAppKit:
          false
      }
    );

    return;
  }

  if (!snapshot.isConnected) {
    if (
      state.connectSessionId ||
      state.pendingFingerprint ||
      state.resolvedFingerprint ||
      state.failedFingerprint
    ) {
      resetConnectState();
    }

    writeDebug(
      "Waiting for wallet connection",
      {
        status:
          snapshot.account?.status ||
          "disconnected"
      }
    );

    return;
  }

  const {
    fingerprint
  } =
    snapshot;

  if (
    state.resolvedFingerprint &&
    state.resolvedFingerprint !==
      fingerprint
  ) {
    resetConnectState();

    startAuthentication(
      snapshot
    );

    return;
  }

  if (
    state.pendingFingerprint &&
    state.pendingFingerprint !==
      fingerprint
  ) {
    resetConnectState();

    startAuthentication(
      snapshot
    );

    return;
  }

  if (
    state.failedFingerprint &&
    state.failedFingerprint !==
      fingerprint
  ) {
    clearFailure();
  }

  const isResolved =
    fingerprint ===
    state.resolvedFingerprint;

  const isPending =
    fingerprint ===
    state.pendingFingerprint;

  const hasFailed =
    fingerprint ===
    state.failedFingerprint;

  if (
    !isResolved &&
    !isPending &&
    !hasFailed
  ) {
    startAuthentication(
      snapshot
    );

    return;
  }

  if (
    !state.connectSessionId &&
    !hasFailed
  ) {
    writeDebug(
      "Waiting for connect authentication",
      {
        address:
          snapshot
            .payload
            .wallet_address,

        chain_id:
          snapshot
            .payload
            .chain_id,

        caip_address:
          snapshot
            .payload
            .caip_address,

        pending:
          isPending
      }
    );
  }
}

async function createPayoutIntent() {
  if (
    state.payoutIntentPending
  ) {
    return;
  }

  const snapshot =
    currentWalletSnapshot();

  if (
    !state.connectSessionId ||
    !state.connectSessionSecret ||
    !state.resolvedFingerprint
  ) {
    writeDebug(
      "Missing authenticated connect session"
    );

    return;
  }

  if (
    !snapshot.isConnected ||
    snapshot.fingerprint !==
      state.resolvedFingerprint ||
    snapshot.payload.wallet_address !==
      state.walletAddress
  ) {
    resetConnectState();

    writeDebug(
      "Wallet changed. Authenticate again."
    );

    return;
  }

  setPayoutIntentPending(
    true
  );

  try {
    const data =
      await requestPayoutIntent({
        connect_session_id:
          state.connectSessionId,

        connect_session_secret:
          state.connectSessionSecret,

        wallet_address:
          state.walletAddress,

        country:
          "BR",

        rail:
          "PIX",

        amount:
          document.getElementById(
            "payout-amount"
          )?.value,

        asset:
          document.getElementById(
            "payout-asset"
          )?.value,

        network:
          "polygon",

        beneficiary: {
          name:
            document.getElementById(
              "recipient-name"
            )?.value,

          rail:
            "PIX",

          country:
            "BR",

          pix_key:
            document.getElementById(
              "recipient-pix"
            )?.value
        }
      });

    writeDebug(
      "Payout intent created",
      data
    );
  } catch (error) {
    writeDebug(
      "Create payout intent failed",
      {
        message:
          error?.message ||
          String(
            error
          )
      }
    );
  } finally {
    setPayoutIntentPending(
      false
    );
  }
}

elements.createPayoutIntent
  ?.addEventListener(
    "click",
    createPayoutIntent
  );

elements.retry
  ?.addEventListener(
    "click",
    () => {
      if (
        state.pendingFingerprint
      ) {
        return;
      }

      const snapshot =
        currentWalletSnapshot();

      if (
        !snapshot.isConnected
      ) {
        writeDebug(
          "Connect a wallet before retrying"
        );

        return;
      }

      clearFailure();

      startAuthentication(
        snapshot
      );
    }
  );

window.addEventListener(
  "error",
  event => {
    writeDebug(
      "Window error",
      {
        message:
          event.message,

        source:
          event.filename,

        line:
          event.lineno,

        column:
          event.colno
      }
    );
  }
);

window.addEventListener(
  "unhandledrejection",
  event => {
    writeDebug(
      "Unhandled promise rejection",
      {
        reason:
          String(
            event.reason?.message ||
            event.reason
          )
      }
    );
  }
);

showPayoutForm(
  false
);

showRetry(
  false
);

setPayoutIntentPending(
  false
);

pollWallet();

setInterval(
  pollWallet,
  3000
);
