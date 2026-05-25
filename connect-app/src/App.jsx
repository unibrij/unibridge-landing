// connect-app/src/App.jsx

import { useEffect, useMemo, useState } from "react";
import {
  useAccount,
  useWalletClient,
  useSwitchChain
} from "wagmi";
import { useAppKit } from "@reown/appkit/react";
import { parseUnits } from "viem";

import {
  ROUTES,
  getRouteById,
  getInitialBeneficiary
} from "./routes";

import { validateRouteForm } from "./form";

import {
  createConnectSession,
  createPayoutIntent,
  startKyc,
  createSettlement,
  getPayoutIntent
} from "./api";

const FLOW_STORAGE_KEY = "unibridge_connect_flow";
const REQUIRED_CHAIN_ID = 137;

const POLYGON_TOKENS = {
  USDT: {
    address: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F",
    decimals: 6
  },
  USDC: {
    address: "0x3c499c542cef5e3811e1192ce70d8cc03d5c3359",
    decimals: 6
  },
  "USDC.e": {
    address: "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174",
    decimals: 6
  }
};

const ERC20_TRANSFER_ABI = [
  {
    type: "function",
    name: "transfer",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" }
    ],
    outputs: [{ name: "", type: "bool" }]
  }
];

function readPayoutIntentFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get("payout_intent_id");
}

function readStoredFlow() {
  try {
    return JSON.parse(localStorage.getItem(FLOW_STORAGE_KEY) || "null");
  } catch {
    return null;
  }
}

function storeFlowSnapshot(snapshot) {
  localStorage.setItem(FLOW_STORAGE_KEY, JSON.stringify(snapshot));
}

function clearStoredFlow() {
  localStorage.removeItem(FLOW_STORAGE_KEY);
}

function resolveRouteIdFromIntent(intent = {}) {
  const rail = String(intent.rail || "").toUpperCase();
  const country = String(intent.country || "").toUpperCase();

  const route =
    ROUTES.find(item =>
      String(item.rail || "").toUpperCase() === rail &&
      String(item.country || "").toUpperCase() === country
    ) || ROUTES[0];

  return route.id;
}

function buildFormFromIntent(intent = {}, fallbackRoute = ROUTES[0]) {
  return {
    amount: intent.amount ?? "",
    asset: intent.asset || fallbackRoute.assets[0],
    beneficiary:
      intent.beneficiary ||
      getInitialBeneficiary(fallbackRoute)
  };
}

function pickFundingAsset(funding = {}) {
  return String(
    funding.asset ||
      funding.currency ||
      funding.token ||
      ""
  ).trim();
}

function pickFundingAmount(funding = {}) {
  return (
    funding.amount ??
    funding.expected_amount ??
    funding.required_amount ??
    ""
  );
}

function pickFundingDepositAddress(funding = {}) {
  return String(
    funding.deposit_address ||
      funding.address ||
      funding.to_address ||
      funding.target_address ||
      ""
  ).trim();
}

export default function App() {
  useAppKit();

  const { address, chainId, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();
  const { switchChainAsync } = useSwitchChain();

  const returnedPayoutIntentId = readPayoutIntentFromUrl();
  const storedFlow = readStoredFlow();

  const [selectedRouteId, setSelectedRouteId] = useState(
    storedFlow?.route_id || "br_pix"
  );

  const selectedRoute = useMemo(
    () => getRouteById(selectedRouteId),
    [selectedRouteId]
  );

  const [connectSessionId, setConnectSessionId] = useState(null);
  const [connectSessionWallet, setConnectSessionWallet] = useState(null);

  const [payoutIntentId, setPayoutIntentId] = useState(
    returnedPayoutIntentId || storedFlow?.payout_intent_id || null
  );

  const [settlement, setSettlement] = useState(null);
  const [fundingTxHash, setFundingTxHash] = useState(null);
  const [isBusy, setIsBusy] = useState(false);

  const [debug, setDebug] = useState(
    returnedPayoutIntentId
      ? "Loading payout route..."
      : "Waiting for wallet connection..."
  );

  const [form, setForm] = useState(() => ({
    amount: storedFlow?.form?.amount || "",
    asset: storedFlow?.form?.asset || ROUTES[0].assets[0],
    beneficiary:
      storedFlow?.form?.beneficiary ||
      getInitialBeneficiary(ROUTES[0])
  }));

  const isReturnedFlow = Boolean(returnedPayoutIntentId);

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
    setSettlement(null);
    setFundingTxHash(null);
    setConnectSessionId(null);
    setConnectSessionWallet(null);

    setForm({
      amount: "",
      asset: route.assets[0],
      beneficiary: getInitialBeneficiary(route)
    });

    clearStoredFlow();
  }

  useEffect(() => {
    if (!returnedPayoutIntentId) {
      return;
    }

    async function loadReturnedIntent() {
      try {
        setIsBusy(true);

        const intent = await getPayoutIntent({
          payoutIntentId: returnedPayoutIntentId
        });

        const routeId = resolveRouteIdFromIntent(intent);
        const route = getRouteById(routeId);
        const rebuiltForm = buildFormFromIntent(intent, route);

        setSelectedRouteId(routeId);
        setPayoutIntentId(intent.payout_intent_id);
        setForm(rebuiltForm);

        storeFlowSnapshot({
          payout_intent_id: intent.payout_intent_id,
          route_id: routeId,
          form: rebuiltForm
        });

        writeDebug(
          "Verification complete. Ready to prepare funding.",
          intent
        );
      } catch (err) {
        writeDebug("Load payout intent failed", {
          message: err.message
        });
      } finally {
        setIsBusy(false);
      }
    }

    loadReturnedIntent();
  }, [returnedPayoutIntentId]);

  useEffect(() => {
    if (isConnected) {
      return;
    }

    setConnectSessionId(null);
    setConnectSessionWallet(null);
  }, [isConnected]);

  useEffect(() => {
    if (
      !isConnected ||
      !address ||
      connectSessionWallet === address
    ) {
      return;
    }

    async function prepareConnectSession() {
      const data = await createConnectSession({
        walletAddress: address,
        chainId: REQUIRED_CHAIN_ID,
        source: "reown"
      });

      setConnectSessionId(data.connect_session_id);
      setConnectSessionWallet(address);

      writeDebug("Connect session ready", data);
    }

    prepareConnectSession().catch(err => {
      setConnectSessionId(null);
      setConnectSessionWallet(null);

      writeDebug("Connect session failed", {
        message: err.message
      });
    });
  }, [isConnected, address, connectSessionWallet]);

  async function startNewFlow() {
    if (!isConnected) {
      writeDebug("Connect your wallet first.");
      return;
    }

    if (chainId && Number(chainId) !== REQUIRED_CHAIN_ID) {
      writeDebug("Wallet network notice", {
        message:
          "This route uses Polygon. Your wallet may be asked to switch networks before funding.",
        expected_chain_id: REQUIRED_CHAIN_ID,
        current_chain_id: chainId
      });
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

    storeFlowSnapshot({
      payout_intent_id: intent.payout_intent_id,
      route_id: selectedRoute.id,
      form
    });

    writeDebug("Starting verification...", {
      payout_intent_id: intent.payout_intent_id
    });

    const kyc = await startKyc({
      payoutIntentId: intent.payout_intent_id
    });

    if (kyc.skipped) {
      writeDebug("Verification already completed. Preparing funding...", {
        payout_intent_id: intent.payout_intent_id
      });

      await continueAfterKyc(intent.payout_intent_id);
      return;
    }

    window.location.href = kyc.url;
  }

  async function continueAfterKyc(intentId = payoutIntentId) {
    if (!intentId) {
      writeDebug("Missing payout intent");
      return;
    }

    setIsBusy(true);

    writeDebug("Preparing funding...", {
      payout_intent_id: intentId
    });

    const result = await createSettlement({
      payoutIntentId: intentId
    });

    setSettlement(result);
    setFundingTxHash(null);
    clearStoredFlow();

    writeDebug("Funding route ready. Send from wallet.", result);
  }

  async function ensurePolygonNetwork() {
    if (!chainId || Number(chainId) === REQUIRED_CHAIN_ID) {
      return true;
    }

    if (!switchChainAsync) {
      writeDebug("Wallet network switch unavailable", {
        message:
          "Your wallet is on the wrong network and automatic switching is unavailable.",
        expected_chain_id: REQUIRED_CHAIN_ID,
        current_chain_id: chainId
      });

      return false;
    }

    try {
      writeDebug("Switching wallet network to Polygon...", {
        expected_chain_id: REQUIRED_CHAIN_ID,
        current_chain_id: chainId
      });

      await switchChainAsync({
        chainId: REQUIRED_CHAIN_ID
      });

      return true;
    } catch (err) {
      writeDebug("Wallet network switch failed", {
        message: err.message,
        expected_chain_id: REQUIRED_CHAIN_ID,
        current_chain_id: chainId
      });

      return false;
    }
  }

  async function sendFundingTransaction() {
    if (!settlement?.funding) {
      writeDebug("Missing funding instructions");
      return;
    }

    if (!walletClient) {
      writeDebug("Wallet not ready");
      return;
    }

    const isNetworkReady =
      await ensurePolygonNetwork();

    if (!isNetworkReady) {
      return;
    }

    const funding = settlement.funding;

    const asset = pickFundingAsset(funding);
    const amount = pickFundingAmount(funding);
    const depositAddress = pickFundingDepositAddress(funding);

    const token = POLYGON_TOKENS[asset];

    if (!token) {
      writeDebug("Unsupported funding token", {
        asset,
        supported_assets: Object.keys(POLYGON_TOKENS)
      });
      return;
    }

    if (!depositAddress) {
      writeDebug("Missing deposit address");
      return;
    }

    if (!amount || Number(amount) <= 0) {
      writeDebug("Invalid funding amount", {
        amount
      });
      return;
    }

    setIsBusy(true);

    try {
      writeDebug("Opening wallet transfer...", {
        asset,
        amount,
        deposit_address: depositAddress,
        token_contract: token.address
      });

      const hash = await walletClient.writeContract({
        address: token.address,
        abi: ERC20_TRANSFER_ABI,
        functionName: "transfer",
        args: [
          depositAddress,
          parseUnits(String(amount), token.decimals)
        ]
      });

      setFundingTxHash(hash);

      writeDebug("Funding transaction submitted", {
        tx_hash: hash,
        asset,
        amount,
        deposit_address: depositAddress,
        token_contract: token.address
      });
    } catch (err) {
      writeDebug("Funding transaction failed", {
        message: err.message
      });
    } finally {
      setIsBusy(false);
    }
  }

  async function handleSend() {
    try {
      if (settlement?.funding) {
        await sendFundingTransaction();
        return;
      }

      if (isReturnedFlow) {
        await continueAfterKyc();
      } else {
        await startNewFlow();
      }
    } catch (err) {
      writeDebug("Send failed", {
        message: err.message
      });
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <main className="connect-shell">
      <img
        src="/connect/icons/social/Ub.png"
        className="logo"
        alt="UniBridge"
      />

      <h1>Connect your wallet</h1>

      <p>Use your wallet to fund verified payout routes.</p>

      {!isReturnedFlow && (
        <div className="wallet-connect-row">
          <appkit-button />
        </div>
      )}

      {(isConnected || isReturnedFlow) && (
        <section className="payout-form">
          <label>
            Route
            <select
              value={selectedRouteId}
              onChange={e => changeRoute(e.target.value)}
              disabled={isBusy || isReturnedFlow}
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
              disabled={isBusy || isReturnedFlow}
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
              disabled={isBusy || isReturnedFlow}
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
                disabled={isBusy || isReturnedFlow}
                value={form.beneficiary[field.name] || ""}
                onChange={e =>
                  updateBeneficiaryField(field.name, e.target.value)
                }
              />
            </label>
          ))}

          <button onClick={handleSend} disabled={isBusy}>
            {isBusy
              ? "Preparing..."
              : settlement?.funding
                ? "Send funding"
                : "Continue"}
          </button>

          <p className="connect-note">
            This route uses Polygon USDT only.
          </p>

          {payoutIntentId ? (
            <p className="connect-note">
              Route reference: {payoutIntentId}
            </p>
          ) : null}

          {fundingTxHash ? (
            <p className="connect-note">
              Funding transaction submitted: {fundingTxHash}
            </p>
          ) : null}

          {settlement?.funding ? (
            <>
              <pre className="connect-debug">
                {JSON.stringify(settlement.funding, null, 2)}
              </pre>

              <pre className="connect-debug">{debug}</pre>
            </>
          ) : (
            <pre className="connect-debug">{debug}</pre>
          )}
        </section>
      )}
    </main>
  );
}
