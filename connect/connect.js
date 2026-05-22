// connect/connect.js

const container =
  document.getElementById("wallet-button");

if (container) {
  container.innerHTML =
    "<appkit-button></appkit-button>";
}

const debugBox =
  document.createElement("pre");

debugBox.style.cssText =
  "margin-top:16px;max-width:520px;white-space:pre-wrap;font-size:12px;line-height:1.4;color:rgba(255,255,255,.78);text-align:left;";

debugBox.textContent =
  "Connect debug: script loaded";

document.querySelector(".connect-shell")
  ?.appendChild(debugBox);

function safeJson(value) {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function writeDebug(label, value = {}) {
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

async function createBackendConnectSession(address, chainId) {
  try {
    writeDebug("Sending connect session", {
      wallet_address: address,
      chain_id: chainId
    });

    const response =
      await fetch(
        "https://unibridge-v2-vqia6yp7wq-uc.a.run.app/v2/connect/session",
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

    writeDebug("UniBridge connect session response", data);
  } catch (err) {
    writeDebug("connect session failed", {
      message: err.message
    });
  }
}

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

  writeDebug("Polling AppKit", {
    account,
    network,
    address,
    chainId,
    sent: Boolean(window.__ub_connect_sent)
  });

  if (
    address &&
    !window.__ub_connect_sent
  ) {
    window.__ub_connect_sent = true;
    createBackendConnectSession(address, chainId);
  }
}, 3000);
