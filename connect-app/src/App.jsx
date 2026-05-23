// connect-app/src/App.jsx

import { useEffect, useState } from "react";
import { useAccount, useSignMessage } from "wagmi";
import { useAppKit } from "@reown/appkit/react";

const API_BASE =
  "https://unibridge-v2-vqia6yp7wq-uc.a.run.app/v2";

export default function App() {
  const { open } = useAppKit();
  const { address, chainId, isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();

  const [connectSessionId, setConnectSessionId] = useState(null);
  const [payoutIntentId, setPayoutIntentId] = useState(null);
  const [debug, setDebug] = useState("Waiting for wallet connection...");
  const [form, setForm] = useState({
    amount: "",
    asset: "USDT",
    recipientName: "",
    pixKey: ""
  });

  function writeDebug(label, value = {}) {
    setDebug(`${label}\n${JSON.stringify(value, null, 2)}`);
  }

  useEffect(() => {
    if (!isConnected || !address || connectSessionId) {
      return;
    }

    async function createConnectSession() {
      const response = await fetch(`${API_BASE}/connect/session`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          wallet_address: address,
          chain_id: chainId || 137,
          source: "reown"
        })
      });

      const data = await response.json();

      if (!response.ok || !data?.ok) {
        throw new Error(data?.error || "connect_session_failed");
      }

      setConnectSessionId(data.connect_session_id);
      writeDebug("Connect session ready", data);
    }

    createConnectSession().catch(err => {
      writeDebug("Connect session failed", {
        message: err.message
      });
    });
  }, [isConnected, address, chainId, connectSessionId]);

  async function createPayoutIntent() {
    try {
      if (!connectSessionId) {
        writeDebug("Missing connect session");
        return;
      }

      const response = await fetch(`${API_BASE}/connect/payout-intent`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          connect_session_id: connectSessionId,
          wallet_address: address,
          country: "BR",
          rail: "PIX",
          amount: form.amount,
          asset: form.asset,
          network: "polygon",
          beneficiary: {
            name: form.recipientName,
            rail: "PIX",
            country: "BR",
            pix_key: form.pixKey
          }
        })
      });

      const data = await response.json();

      if (!response.ok || !data?.ok) {
        throw new Error(data?.error || "payout_intent_failed");
      }

      setPayoutIntentId(data.payout_intent_id);
      writeDebug("Payout intent created", data);
    } catch (err) {
      writeDebug("Create payout intent failed", {
        message: err.message
      });
    }
  }

  async function authorizeRoute() {
    try {
      if (!payoutIntentId) {
        writeDebug("Missing payout intent");
        return;
      }

      const messageResponse = await fetch(
        `${API_BASE}/connect/payout-authorize/message`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            payout_intent_id: payoutIntentId
          })
        }
      );

      const messageData = await messageResponse.json();

      if (!messageResponse.ok || !messageData?.ok) {
        throw new Error(
          messageData?.error || "authorization_message_failed"
        );
      }

      const signature = await signMessageAsync({
        message: messageData.message
      });

      const submitResponse = await fetch(
        `${API_BASE}/connect/payout-authorize/submit`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            payout_intent_id: payoutIntentId,
            message: messageData.message,
            nonce: messageData.nonce,
            signature
          })
        }
      );

      const submitData = await submitResponse.json();

      if (!submitResponse.ok || !submitData?.ok) {
        throw new Error(
          submitData?.error || "authorization_submit_failed"
        );
      }

      writeDebug("Route authorized", submitData);
    } catch (err) {
      writeDebug("Authorize route failed", {
        message: err.message
      });
    }
  }

  return (
    <main className="connect-shell">
      <img
        src="/public/icons/social/Ub.png"
        className="logo"
        alt="UniBridge"
      />

      <h1>Connect your wallet</h1>

      <p>Use your wallet to fund verified payout routes.</p>

      <button className="wallet-button" onClick={() => open()}>
        {isConnected ? "Wallet connected" : "Connect Wallet"}
      </button>

      {isConnected && (
        <section className="payout-form">
          <div className="route-label">Brazil PIX route</div>

          <label>
            Amount
            <input
              type="number"
              min="1"
              placeholder="100"
              value={form.amount}
              onChange={e =>
                setForm({ ...form, amount: e.target.value })
              }
            />
          </label>

          <label>
            Asset
            <select
              value={form.asset}
              onChange={e =>
                setForm({ ...form, asset: e.target.value })
              }
            >
              <option value="USDT">USDT</option>
              <option value="USDC">USDC</option>
            </select>
          </label>

          <label>
            Recipient name
            <input
              type="text"
              placeholder="Recipient name"
              value={form.recipientName}
              onChange={e =>
                setForm({ ...form, recipientName: e.target.value })
              }
            />
          </label>

          <label>
            PIX key
            <input
              type="text"
              placeholder="email, CPF, phone, or random key"
              value={form.pixKey}
              onChange={e =>
                setForm({ ...form, pixKey: e.target.value })
              }
            />
          </label>

          <button onClick={createPayoutIntent}>
            Create payout intent
          </button>

          {payoutIntentId && (
            <button className="secondary-action" onClick={authorizeRoute}>
              Authorize route
            </button>
          )}

          <pre className="connect-debug">{debug}</pre>
        </section>
      )}
    </main>
  );
}
