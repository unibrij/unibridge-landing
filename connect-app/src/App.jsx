// connect-app/src/App.jsx

import { useEffect, useMemo, useState } from "react";
import { useAccount, useSignMessage } from "wagmi";
import { useAppKit } from "@reown/appkit/react";

const API_BASE =
  "https://unibridge-v2-vqia6yp7wq-uc.a.run.app/v2";

const ROUTES = [
  {
    id: "br_pix",
    label: "Brazil PIX route",
    country: "BR",
    rail: "PIX",
    network: "polygon",
    assets: ["USDT", "USDC"],
    beneficiaryFields: [
      {
        name: "pix_key",
        label: "PIX key",
        type: "text",
        placeholder: "email, CPF, phone, or random key",
        required: true
      }
    ]
  }
];

function getInitialBeneficiary(route) {
  return route.beneficiaryFields.reduce((acc, field) => {
    acc[field.name] = "";
    return acc;
  }, {});
}

export default function App() {
  const { open } = useAppKit();
  const { address, chainId, isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();

  const [selectedRouteId, setSelectedRouteId] = useState("br_pix");
  const selectedRoute = useMemo(
    () => ROUTES.find(route => route.id === selectedRouteId) || ROUTES[0],
    [selectedRouteId]
  );

  const [connectSessionId, setConnectSessionId] = useState(null);
  const [payoutIntentId, setPayoutIntentId] = useState(null);
  const [debug, setDebug] = useState("Waiting for wallet connection...");

  const [form, setForm] = useState(() => ({
    amount: "",
    asset: ROUTES[0].assets[0],
    beneficiary: getInitialBeneficiary(ROUTES[0])
  }));

  function writeDebug(label, value = {}) {
    setDebug(`${label}\n${JSON.stringify(value, null, 2)}`);
  }

  function updateBeneficiaryField(name, value) {
    setForm(current => ({
      ...current,
      beneficiary: {
        ...current.beneficiary,
        [name]: value
      }
    }));
  }

  function changeRoute(routeId) {
    const route =
      ROUTES.find(item => item.id === routeId) || ROUTES[0];

    setSelectedRouteId(route.id);
    setPayoutIntentId(null);

    setForm({
      amount: "",
      asset: route.assets[0],
      beneficiary: getInitialBeneficiary(route)
    });
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
          country: selectedRoute.country,
          rail: selectedRoute.rail,
          amount: form.amount,
          asset: form.asset,
          network: selectedRoute.network,
          beneficiary: {
            rail: selectedRoute.rail,
            country: selectedRoute.country,
            ...form.beneficiary
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
          <label>
            Route
            <select
              value={selectedRouteId}
              onChange={e => changeRoute(e.target.value)}
            >
              {ROUTES.map(route => (
                <option key={route.id} value={route.id}>
                  {route.label}
                </option>
              ))}
            </select>
          </label>

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
              {selectedRoute.assets.map(asset => (
                <option key={asset} value={asset}>
                  {asset}
                </option>
              ))}
            </select>
          </label>

          {selectedRoute.beneficiaryFields.map(field => (
            <label key={field.name}>
              {field.label}
              <input
                type={field.type || "text"}
                placeholder={field.placeholder}
                required={field.required}
                value={form.beneficiary[field.name] || ""}
                onChange={e =>
                  updateBeneficiaryField(field.name, e.target.value)
                }
              />
            </label>
          ))}

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
