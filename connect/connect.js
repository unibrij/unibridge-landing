// connect/connect.js

const API_BASE =
  "https://unibridge-v2-vqia6yp7wq-uc.a.run.app/v2";

const container = document.getElementById("wallet-button");
const payoutForm = document.getElementById("payout-form");
const debugBox = document.getElementById("connect-debug");
const createPayoutIntentButton =
  document.getElementById("create-payout-intent");

if (container) {
  container.innerHTML = "<appkit-button></appkit-button>";
}

let activeConnectSession = null;
let activeWalletAddress = null;
let activeChainId = null;

let resolvedFingerprint = null;
let pendingFingerprint = null;
let connectRequestVersion = 0;

function safeJson(value) {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function writeDebug(label, value = {}) {
  if (!debugBox) return;

  debugBox.textContent =
    `${label}\n${safeJson(value)}`;
}

window.addEventListener("error", event => {
  writeDebug("Window error", {
    message: event.message,
    source: event.filename,
    line: event.lineno,
    column: event.colno
  });
});

window.addEventListener("unhandledrejection", event => {
  writeDebug("Unhandled promise rejection", {
    reason: String(
      event.reason?.message ||
      event.reason
    )
  });
});

function readAppKitState() {
  const appkit = window.appKit;

  if (!appkit) {
    return {
      appkit: null,
      account: null,
      network: null
    };
  }

  const account =
    typeof appkit.getAccount === "function"
      ? appkit.getAccount()
      : typeof appkit.getAddress === "function"
        ? { address: appkit.getAddress() }
        : null;

  const network =
    typeof appkit.getNetwork === "function"
      ? appkit.getNetwork()
      : null;

  return {
    appkit,
    account,
    network
  };
}

function cleanString(value) {
  if (typeof value !== "string") {
    return null;
  }

  return value.trim() || null;
}

function cleanAddress(value) {
  return cleanString(value)?.toLowerCase() || null;
}

function addressFromCaip(value) {
  const caipAddress = cleanString(value);

  if (!caipAddress) {
    return null;
  }

  return cleanAddress(
    caipAddress.split(":").pop()
  );
}

function cleanChainId(value) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

  const raw = String(value).trim();

  if (!raw) {
    return null;
  }

  const candidate =
    raw.includes(":")
      ? raw.split(":").pop()
      : raw;

  const chainId = Number(candidate);

  return Number.isInteger(chainId)
    ? chainId
    : null;
}

function getWalletAddress(account) {
  return (
    cleanAddress(account?.address) ||
    addressFromCaip(account?.caipAddress) ||
    cleanAddress(
      account?.allAccounts?.[0]?.address
    ) ||
    addressFromCaip(
      account?.allAccounts?.[0]?.caipAddress
    ) ||
    null
  );
}

function getChainId(network, account) {
  return (
    cleanChainId(network?.chainId) ||
    cleanChainId(network?.caipNetwork?.chainId) ||
    cleanChainId(network?.caipNetwork?.id) ||
    cleanChainId(network?.caipNetworkId) ||
    cleanChainId(account?.chainId) ||
    cleanChainId(
      account?.allAccounts?.[0]?.chainId
    ) ||
    137
  );
}

function mapAccount(account) {
  if (
    !account ||
    typeof account !== "object"
  ) {
    return null;
  }

  const address =
    cleanAddress(account.address) ||
    addressFromCaip(account.caipAddress);

  if (!address) {
    return null;
  }

  return {
    namespace:
      cleanString(account.namespace),

    address,

    chain_id:
      account.chainId ?? null,

    caip_address:
      cleanString(account.caipAddress),

    type:
      cleanString(account.type),

    public_key:
      cleanString(account.publicKey)
  };
}

function mapEmbeddedWallet(account) {
  const info = account?.embeddedWalletInfo;

  if (
    !info ||
    typeof info !== "object"
  ) {
    return null;
  }

  return {
    email:
      cleanString(info.user?.email),

    username:
      cleanString(info.user?.username),

    account_type:
      cleanString(info.accountType),

    auth_provider:
      cleanString(info.authProvider),

    is_smart_account_deployed:
      info.isSmartAccountDeployed === true
  };
}

function buildConnectPayload(account, network) {
  const accounts =
    Array.isArray(account?.allAccounts)
      ? account.allAccounts
          .map(mapAccount)
          .filter(Boolean)
      : [];

  return {
    source: "reown",

    // Legacy-compatible fields.
    wallet_address:
      getWalletAddress(account),

    chain_id:
      getChainId(network, account),

    caip_address:
      cleanString(account?.caipAddress),

    embedded_wallet:
      mapEmbeddedWallet(account),

    accounts
  };
}

function createFingerprint(payload) {
  const accounts = [...payload.accounts]
    .sort((left, right) => {
      const leftKey =
        `${left.namespace || ""}:${left.address}:${left.chain_id ?? ""}`;

      const rightKey =
        `${right.namespace || ""}:${right.address}:${right.chain_id ?? ""}`;

      return leftKey.localeCompare(rightKey);
    });

  return JSON.stringify({
    wallet_address:
      payload.wallet_address,

    chain_id:
      payload.chain_id,

    caip_address:
      payload.caip_address,

    embedded_wallet:
      payload.embedded_wallet,

    accounts
  });
}

function setPayoutFormVisible(visible) {
  payoutForm?.classList.toggle(
    "hidden",
    !visible
  );
}

function clearConnectState() {
  connectRequestVersion += 1;

  activeConnectSession = null;
  activeWalletAddress = null;
  activeChainId = null;

  resolvedFingerprint = null;
  pendingFingerprint = null;

  setPayoutFormVisible(false);
}

async function readJson(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

async function createBackendConnectSession(
  payload,
  fingerprint
) {
  if (!payload.wallet_address) {
    throw new Error(
      "reown_wallet_address_missing"
    );
  }

  const requestVersion =
    ++connectRequestVersion;

  pendingFingerprint = fingerprint;

  /*
   * Do not allow a payout through the old
   * session while resolving a changed account.
   */
  activeConnectSession = null;
  activeWalletAddress = null;
  activeChainId = null;
  resolvedFingerprint = null;

  setPayoutFormVisible(false);

  writeDebug(
    "Sending connect session",
    payload
  );

  try {
    const response = await fetch(
      `${API_BASE}/connect/session`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      }
    );

    const data = await readJson(response);

    if (
      !response.ok ||
      !data?.ok
    ) {
      throw new Error(
        data?.error ||
        "connect_session_failed"
      );
    }

    /*
     * Ignore a response belonging to an
     * account that is no longer current.
     */
    if (
      requestVersion !==
      connectRequestVersion
    ) {
      return null;
    }

    activeConnectSession =
      data.connect_session_id;

    activeWalletAddress =
      data.wallet_address ||
      payload.wallet_address;

    activeChainId =
      data.chain_id ??
      payload.chain_id;

    resolvedFingerprint =
      fingerprint;

    setPayoutFormVisible(true);

    writeDebug(
      "Connect session ready",
      data
    );

    return data;
  } finally {
    if (
      requestVersion ===
        connectRequestVersion &&
      pendingFingerprint === fingerprint
    ) {
      pendingFingerprint = null;
    }
  }
}

async function createPayoutIntent() {
  try {
    if (!activeConnectSession) {
      writeDebug(
        "Missing connect session"
      );

      return;
    }

    const amount =
      document.getElementById(
        "payout-amount"
      )?.value;

    const asset =
      document.getElementById(
        "payout-asset"
      )?.value;

    const recipientName =
      document.getElementById(
        "recipient-name"
      )?.value;

    const pixKey =
      document.getElementById(
        "recipient-pix"
      )?.value;

    const response = await fetch(
      `${API_BASE}/connect/payout-intent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          connect_session_id:
            activeConnectSession,

          wallet_address:
            activeWalletAddress,

          country: "BR",
          rail: "PIX",
          amount,
          asset,
          network: "polygon",

          beneficiary: {
            name: recipientName,
            rail: "PIX",
            country: "BR",
            pix_key: pixKey
          }
        })
      }
    );

    const data = await readJson(response);

    if (
      !response.ok ||
      !data?.ok
    ) {
      throw new Error(
        data?.error ||
        "payout_intent_failed"
      );
    }

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
          String(error)
      }
    );
  }
}

createPayoutIntentButton?.addEventListener(
  "click",
  createPayoutIntent
);

setInterval(() => {
  const {
    appkit,
    account,
    network
  } = readAppKitState();

  if (!appkit) {
    writeDebug(
      "Waiting for window.appKit",
      {
        hasWindowAppKit: false
      }
    );

    return;
  }

  const payload =
    buildConnectPayload(
      account,
      network
    );

  const isConnected =
    account?.isConnected !== false &&
    Boolean(payload.wallet_address);

  if (!isConnected) {
    if (
      activeConnectSession ||
      resolvedFingerprint ||
      pendingFingerprint
    ) {
      clearConnectState();
    }

    writeDebug(
      "Waiting for wallet connection",
      {
        status:
          account?.status ||
          "disconnected"
      }
    );

    return;
  }

  const fingerprint =
    createFingerprint(payload);

  const isResolved =
    fingerprint ===
    resolvedFingerprint;

  const isPending =
    fingerprint ===
    pendingFingerprint;

  if (!isResolved && !isPending) {
    createBackendConnectSession(
      payload,
      fingerprint
    ).catch(error => {
      writeDebug(
        "Connect session failed",
        {
          message:
            error?.message ||
            String(error)
        }
      );
    });

    return;
  }

  if (!activeConnectSession) {
    writeDebug(
      "Waiting for connect session",
      {
        address:
          payload.wallet_address,

        chain_id:
          payload.chain_id,

        caip_address:
          payload.caip_address,

        pending:
          isPending
      }
    );
  }
}, 3000);
