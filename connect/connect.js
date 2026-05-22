// connect/connect.js

const container =
  document.getElementById("wallet-button");

if (container) {
  container.innerHTML =
    "<appkit-button></appkit-button>";
}

async function createBackendConnectSession() {
  try {
    const appkit =
      window.appKit;

    if (!appkit) {
      return;
    }

    const account =
      appkit.getAccount();

    const network =
      appkit.getNetwork();

    if (!account?.address) {
      return;
    }

    const response =
      await fetch(
        "https://api.unibrij.io/v2/connect/session",
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

    console.log(
      "UniBridge connect session:",
      data
    );
  } catch (err) {
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
    return;
  }

  const account =
    appkit.getAccount();

  if (
    account?.address &&
    !window.__ub_connect_sent
  ) {
    window.__ub_connect_sent = true;
    createBackendConnectSession();
  }
}, 1000);
