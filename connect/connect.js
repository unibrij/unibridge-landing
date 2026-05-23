// connect/connect.js

const API_BASE =
  "https://unibridge-v2-vqia6yp7wq-uc.a.run.app/v2";

const container =
  document.getElementById("wallet-button");

const payoutForm =
  document.getElementById("payout-form");

const debugBox =
  document.getElementById("connect-debug");

const createPayoutIntentButton =
  document.getElementById("create-payout-intent");

if (container) {
  container.innerHTML =
    "<appkit-button></appkit-button>";
}

let activeConnectSession = null;
let activeWalletAddress = null;
let activeChainId = null;

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
    `${label}\n` + safeJson(value);
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
    reason: String(event.reason?.message || event.reason)
  });
});

function getAccountSafe(appkit) {
  if (!appkit) return null;

  if (typeof appkit.getAccount === "function") {
    return appkit.getAccount();
  }

  if (typeof appkit.getAddress === "function") {
    return {
      address: appkit.getAddress()
    };
  }

  return null;
}

function getNetworkSafe(appkit) {
  if (!appkit) return null;

  if (typeof appkit.getNetwork === "function") {
    return appkit.getNetwork();
  }

  return null;
}

function getWalletAddress(account) {
  return (
    account?.address ||
    account?.caipAddress?.split(":").pop() ||
    account?.allAccounts?.[0]?.address ||
    account?.allAccounts?.[0]?.caipAddress?.split(":").pop() ||
    null
  );
}

function getChainId(network) {
  return (
    network?.chainId ||
    network?.caipNetwork?.id ||
    network?.caipNetworkId?.split(":").pop() ||
    137
  );
}

function showPayoutForm() {
  if (payoutForm) {
    payoutForm.classList.remove("hidden");
  }
}

async function createBackendConnectSession(address, chainId) {
  writeDebug("Sending connect session", {
    wallet_address: address,
    chain_id: chainId
  });

  const response =
    await fetch(
      `${API_BASE}/connect/session`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          wallet_address: address,
          chain_id: Number(chainId),
          source: "reown"
        })
      }
    );

  const data =
    await response.json();

  if (!response.ok || !data?.ok) {
    throw new Error(data?.error || "connect_session_failed");
  }

  activeConnectSession =
    data.connect_session_id;

  activeWalletAddress =
    data.wallet_address || address;

  activeChainId =
    data.chain_id || Number(chainId);

  showPayoutForm();

  writeDebug("Connect session ready", data);

  return data;
}

async function createPayoutIntent() {
  try {
    if (!activeConnectSession) {
      writeDebug("Missing connect session", {});
      return;
    }

    const amount =
      document.getElementById("payout-amount")?.value;

    const asset =
      document.getElementById("payout-asset")?.value;

    const recipientName =
      document.getElementById("recipient-name")?.value;

    const pixKey =
      document.getElementById("recipient-pix")?.value;

    const response =
      await fetch(
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

            country:
              "BR",

            rail:
              "PIX",

            amount,

            asset,

            network:
              "polygon",

            beneficiary: {
              name:
                recipientName,

              rail:
                "PIX",

              country:
                "BR",

              pix_key:
                pixKey
            }
          })
        }
      );

    const data =
      await response.json();

    if (!response.ok || !data?.ok) {
      throw new Error(data?.error || "payout_intent_failed");
    }

    writeDebug("Payout intent created", data);
  } catch (err) {
    writeDebug("Create payout intent failed", {
      message: err.message
    });
  }
}

createPayoutIntentButton
  ?.addEventListener(
    "click",
    createPayoutIntent
  );

setInterval(() => {
  const appkit =
    window.appKit;

  if (!appkit) {
    writeDebug("Waiting for window.appKit", {
      hasWindowAppKit: false
    });
    return;
  }

  const account =
    getAccountSafe(appkit);

  const network =
    getNetworkSafe(appkit);

  const address =
    getWalletAddress(account);

  const chainId =
    getChainId(network);

  if (
    address &&
    !window.__ub_connect_sent
  ) {
    window.__ub_connect_sent = true;

    createBackendConnectSession(
      address,
      chainId
    ).catch(err => {
      writeDebug("connect session failed", {
        message: err.message
      });
    });

    return;
  }

  if (!activeConnectSession) {
    writeDebug("Waiting for wallet connection", {
      address,
      chainId,
      sent: Boolean(window.__ub_connect_sent)
    });
  }
}, 3000);
