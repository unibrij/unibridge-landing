// connect-app/src/App.jsx

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
import {
  useAccount,
  useWalletClient,
  useSwitchChain
} from "wagmi";
import { useAppKit } from "@reown/appkit/react";

import {
  ROUTES,
  getRouteById
} from "./routes";

import {
  readStoredFlow,
  clearStoredFlow
} from "./flow/flowStorage";

import {
  readPayoutIntentFromUrl,
  buildEmptyForm
} from "./flow/routes";

import useConnectSession from "./hooks/useConnectSession";
import useReturnedPayoutIntent from "./hooks/useReturnedPayoutIntent";
import useRouteFlow from "./hooks/useRouteFlow";

import PayoutForm from "./components/PayoutForm";

import {
  trackConnectEvent
} from "./analytics/trackConnectEvent";

export default function App() {
  useAppKit();

  const pageViewTrackedRef = useRef(false);
  const walletConnectedTrackedRef = useRef(false);
  const routeCreatedTrackedRef = useRef(false);

  const { address, chainId, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();
  const { switchChainAsync } = useSwitchChain();

  const storedFlow = readStoredFlow();
  const returnedPayoutIntentId = readPayoutIntentFromUrl();

  const [selectedRouteId, setSelectedRouteId] = useState(
    storedFlow?.route_id || "br_pix"
  );

  const selectedRoute = useMemo(
    () => getRouteById(selectedRouteId),
    [selectedRouteId]
  );

  const [payoutIntentId, setPayoutIntentId] = useState(
    returnedPayoutIntentId ||
      storedFlow?.payout_intent_id ||
      null
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
    asset:
      storedFlow?.form?.asset ||
      selectedRoute.assets[0],
    beneficiary:
      storedFlow?.form?.beneficiary ||
      buildEmptyForm(selectedRoute).beneficiary
  }));

  const isReturnedFlow =
    Boolean(returnedPayoutIntentId);

  useEffect(() => {
    if (pageViewTrackedRef.current) return;

    pageViewTrackedRef.current = true;

    trackConnectEvent("page_view", {
      route_id: selectedRouteId,
      asset: form.asset,
      metadata: {
        returned_flow: isReturnedFlow
      }
    });
  }, [form.asset, isReturnedFlow, selectedRouteId]);

  useEffect(() => {
    if (!isConnected || !address) return;
    if (walletConnectedTrackedRef.current) return;

    walletConnectedTrackedRef.current = true;

    trackConnectEvent("wallet_connected", {
      wallet_address: address,
      route_id: selectedRouteId,
      asset: form.asset,
      metadata: {
        chain_id: chainId
      }
    });
  }, [address, chainId, form.asset, isConnected, selectedRouteId]);

  useEffect(() => {
    if (!settlement) return;
    if (routeCreatedTrackedRef.current) return;

    routeCreatedTrackedRef.current = true;

    trackConnectEvent("route_created", {
      wallet_address: address,
      route_id: selectedRouteId,
      asset: form.asset,
      metadata: {
        settlement_id:
          settlement?.settlement_id ||
          settlement?.id ||
          null,
        payout_intent_id: payoutIntentId
      }
    });
  }, [address, form.asset, payoutIntentId, selectedRouteId, settlement]);

  const writeDebug = useCallback((label, value = {}) => {
    setDebug(
      `${label}\n${JSON.stringify(value, null, 2)}`
    );
  }, []);

  const {
    connectSessionId,
    resetConnectSession
  } =
    useConnectSession({
      isConnected,
      address,
      writeDebug
    });

  useReturnedPayoutIntent({
    returnedPayoutIntentId,
    setSelectedRouteId,
    setPayoutIntentId,
    setForm,
    setIsBusy,
    writeDebug
  });

  const {
    handleSend,
    walletConfirmationPending
  } =
    useRouteFlow({
      isConnected,
      address,
      chainId,
      walletClient,
      switchChainAsync,

      connectSessionId,
      selectedRoute,
      form,

      payoutIntentId,
      setPayoutIntentId,
      settlement,
      setSettlement,
      setFundingTxHash,
      setIsBusy,

      isReturnedFlow,
      writeDebug
    });

  const trackedHandleSend = useCallback(async () => {
    await trackConnectEvent("route_started", {
      wallet_address: address,
      route_id: selectedRouteId,
      asset: form.asset,
      metadata: {
        amount: form.amount,
        payout_intent_id: payoutIntentId
      }
    });

    return handleSend();
  }, [
    address,
    form.amount,
    form.asset,
    handleSend,
    payoutIntentId,
    selectedRouteId
  ]);

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
      getRouteById(routeId);

    setSelectedRouteId(route.id);
    setPayoutIntentId(null);
    setSettlement(null);
    setFundingTxHash(null);

    routeCreatedTrackedRef.current = false;

    resetConnectSession();

    setForm(buildEmptyForm(route));

    clearStoredFlow();
    writeDebug("Ready to start a new route.");
  }

  return (
    <main className="connect-shell">
      <img
        src="/connect/icons/social/Ub.png"
        className="logo"
        alt="UniBridge"
      />

      <h1>Connect your wallet</h1>

      <div className="motion-lines" aria-label="Fund. Pay. Save.">
        <div className="motion-line">
          <strong>Fund</strong>
          <span>with stablecoins</span>
        </div>

        <div className="motion-line">
          <strong>Pay</strong>
          <span>back home</span>
        </div>

        <div className="motion-line">
          <strong>Save</strong>
          <span>for next time</span>
        </div>
      </div>

      {!isReturnedFlow && (
        <div
          className="wallet-connect-row"
          onClick={() => {
            trackConnectEvent("wallet_connect_started", {
              route_id: selectedRouteId,
              asset: form.asset
            });
          }}
        >
          <appkit-button />
        </div>
      )}

      {(isConnected || isReturnedFlow) && (
        <PayoutForm
          selectedRouteId={selectedRouteId}
          selectedRoute={selectedRoute}
          form={form}
          setForm={setForm}
          isBusy={isBusy}
          isReturnedFlow={isReturnedFlow}
          settlement={settlement}
          fundingTxHash={fundingTxHash}
          walletConfirmationPending={walletConfirmationPending}
          payoutIntentId={payoutIntentId}
          debug={debug}
          handleSend={trackedHandleSend}
          changeRoute={changeRoute}
          updateBeneficiaryField={updateBeneficiaryField}
          routes={ROUTES}
        />
      )}
    </main>
  );
}
