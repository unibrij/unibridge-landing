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
  "margin-top:16px;max-width:420px;white-space:pre-wrap;font-size:12px;line-height:1.4;color:rgba(255,255,255,.75);text-align:left;";

debugBox.textContent =
  "Connect debug: waiting...";

document.querySelector(".connect-shell")
  ?.appendChild(debugBox);

function writeDebug(label, value) {
  debugBox.textContent =
    `${label}\n` +
    JSON.stringify(value, null, 2);
}

async function createBackendConnectSession() {
  try {
    const appkit =
      window.appKit;

    if (!appkit) {
      writeDebug("No appKit", {});
      return;
    }

    const account =
      appkit.getAccount();

    const network =
      appkit.getNetwork();

    writeDebug("Detected account/network", {
      account,
      network
    });

    if (!account?.address) {
      return;
    }

    const response =
      await fetch(
        "https://unibridge-v2-vqia6yp7wq-uc.a.run.app/v2/connect/session",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            wallet_address: account.address,
            chain_id: network?.chainId || 137,
            source: "reown"
          })
        }
      );

    const data =
      await response.json();

    writeDebug("UniBridge connect session response", data);

    console.log(
      "UniBridge connect session:",
      data
    );
  } catch (err) {
    writeDebug("connect session failed", {
      message: err.message
    });

    console.error(
      "connect session failed",
      err
    );
  }
}

/*
-----------------------------------------
Wait for wallet address
-----------------------------------------
*/

setInterval(() => {
  const appkit =
    window.appKit;

  if (!appkit) {
    writeDebug("Waiting for window.appKit", {});
    return;
  }

  const account =
    appkit.getAccount();

  const network =
    appkit.getNetwork();

  writeDebug("Polling AppKit", {
    account,
    network,
    sent: Boolean(window.__ub_connect_sent)
  });

  if (
    account?.address &&
    !window.__ub_connect_sent
  ) {
    window.__ub_connect_sent = true;
    createBackendConnectSession();
  }
}, 3000);
