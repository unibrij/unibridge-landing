// connect-app/src/App.jsx

import { useEffect, useMemo, useState } from "react";
import { useAccount, useSignMessage } from "wagmi";
import { useAppKit } from "@reown/appkit/react";

import {
  ROUTES,
  getRouteById,
  getInitialBeneficiary
} from "./routes";

import { validateRouteForm } from "./form";

import {
  createConnectSession,
  createPayoutIntent,
  requestAuthorizationMessage,
  submitAuthorization,
  startKyc
} from "./api";

function readPayoutIntentFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get("payout_intent_id");
}

export default function App() {
  const { open } = useAppKit();
  const { address, chainId, isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();

  const [selectedRouteId, setSelectedRouteId] = useState("br_pix");

  const selectedRoute = useMemo(
    () => getRouteById(selectedRouteId),
    [selectedRouteId]
  );

  const [connectSessionId, setConnectSessionId] = useState(null);

  const [payoutIntentId, setPayoutIntentId] = useState(
    () => readPayoutIntentFromUrl() || null
  );

  const [isBusy, setIsBusy] = useState(false);
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
    const route = getRouteById(routeId);

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

    async function prepareConnectSession() {
      const data = await createConnectSession({
        walletAddress: address,
        chainId,
        source: "reown"
      });

      setConnectSessionId(data.connect_session_id);
      writeDebug("Connect session ready", data);
    }

    prepareConnectSession().catch(err => {
      writeDebug("Connect session failed", {
        message: err.message
      });
    });
  }, [isConnected, address, chainId, connectSessionId]);

  async function authorizePayoutIntent(nextPayoutIntentId) {
    const messageData = await requestAuthorizationMessage({
      payoutIntentId: nextPayoutIntentId
    });

    const signature = await signMessageAsync({
      message: messageData.message
    });

    return submitAuthorization({
      payoutIntentId: nextPayoutIntentId,
      message: messageData.message,
      nonce: messageData.nonce,
      signature
    });
  }

  async function reviewAndContinue() {
    try {
      if (!isConnected) {
        await open();
        return;
      }

      if (!connectSessionId) {
        writeDebug("Connect session is still preparing. Try again in a moment.");
        return;
      }

      validateRouteForm({
        form,
        route: selectedRoute
      });

      setIsBusy(true);
      writeDebug("Preparing payout route...");

      const intent = await createPayoutIntent({
        connectSessionId,
        walletAddress: address,
        route: selectedRoute,
        form
      });

      setPayoutIntentId(intent.payout_intent_id);

      writeDebug("Requesting route authorization...", {
        payout_intent_id: intent.payout_intent_id
      });

      const authorization = await authorizePayoutIntent(
        intent.payout_intent_id
      );

      writeDebug("Route authorized. Starting verification...", authorization);

      const kyc = await startKyc({
        payoutIntentId: intent.payout_intent_id
      });

      window.location.href = kyc.url;
    } catch (err) {
      writeDebug("Review and continue failed", {
        message: err.message
      });
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <main className="connect-shell">
      <img
        src="./icons/social/Ub.png"
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
              disabled={isBusy}
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
              disabled={isBusy}
              onChange={e =>
                setForm({
                  ...form,
                  amount: e.target.value
                })
              }
            />
          </label>

          <label>
            Asset
            <select
              value={form.asset}
              disabled={isBusy}
              onChange={e =>
                setForm({
                  ...form,
                  asset: e.target.value
                })
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
                disabled={isBusy}
                value={form.beneficiary[field.name] || ""}
                onChange={e =>
                  updateBeneficiaryField(field.name, e.target.value)
                }
              />
            </label>
          ))}

          <button onClick={reviewAndContinue} disabled={isBusy}>
            {isBusy ? "Preparing route..." : "Review & continue"}
          </button>

          {payoutIntentId ? (
            <p className="connect-note">
              Route reference: {payoutIntentId}
            </p>
          ) : null}

          <pre className="connect-debug">{debug}</pre>
        </section>
      )}
    </main>
  );
}
