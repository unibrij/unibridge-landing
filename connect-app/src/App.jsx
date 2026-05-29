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

import { ROUTES, getRouteById } from "./routes";
import { readStoredFlow, clearStoredFlow } from "./flow/flowStorage";
import { readPayoutIntentFromUrl, buildEmptyForm } from "./flow/routes";

import useConnectSession from "./hooks/useConnectSession";
import useReturnedPayoutIntent from "./hooks/useReturnedPayoutIntent";
import useRouteFlow from "./hooks/useRouteFlow";

import PayoutForm from "./components/PayoutForm";
import HistoryPage from "./components/HistoryPage";
import { trackConnectEvent } from "./analytics/trackConnectEvent";

const SUPPORT_WHATSAPP_NUMBER = "5541996608113";

function hashWallet(address) {
  if (!address) return "not connected";
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function getSettlementId(settlement) {
  return (
    settlement?.settlement_id ||
    settlement?.id ||
    settlement?.route_id ||
    "N/A"
  );
}

function saveRouteHistoryItem(item) {
  try {
    const raw = window.localStorage.getItem("unibridge_route_history");
    const current = JSON.parse(raw || "[]");
    const list = Array.isArray(current) ? current : [];

    const next = [
      {
        id: item.id,
        route_id: item.route_id,
        corridor: item.corridor,
        asset: item.asset,
        status: item.status,
        created_at: new Date().toISOString()
      },
      ...list.filter(existing => existing.id !== item.id)
    ].slice(0, 20);

    window.localStorage.setItem(
      "unibridge_route_history",
      JSON.stringify(next)
    );
  } catch {
    // ignore local history failures
  }
}

function buildSupportUrl({
  settlement,
  address,
  selectedRouteId,
  selectedRoute,
  form
}) {
  const message = `
Hi UniBridge Support,

I need help with my route.

Route ID: ${getSettlementId(settlement)}
Wallet: ${hashWallet(address)}
Corridor: ${selectedRoute?.label || selectedRouteId || "N/A"}
Asset: ${form?.asset || "N/A"}
Status: ${settlement?.status || "created"}
`.trim();

  return `https://wa.me/${SUPPORT_WHATSAPP_NUMBER}?text=${encodeURIComponent(
    message
  )}`;
}

function RouteActions({
  settlement,
  address,
  selectedRouteId,
  selectedRoute,
  form,
  onUseAgain
}) {
  if (!settlement) return null;

  const supportUrl = buildSupportUrl({
    settlement,
    address,
    selectedRouteId,
    selectedRoute,
    form
  });

  return (
    <div className="route-actions">
      <button type="button" onClick={onUseAgain}>
        Use this route again
      </button>

      <a href="/connect/history" className="route-action-link">
        View route history
      </a>

      <a
        href={supportUrl}
        target="_blank"
        rel="noreferrer"
        className="route-action-link"
      >
        Contact support
      </a>
    </div>
  );
}

export default function App() {
  useAppKit();

  const pageViewTrackedRef = useRef(false);
  const walletConnectedTrackedRef = useRef(false);
  const routeCreatedTrackedRef = useRef(false);

  const [installPrompt, setInstallPrompt] = useState(null);
  const [canInstallPwa, setCanInstallPwa] = useState(false);
  const [isStandalonePwa, setIsStandalonePwa] = useState(false);

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
    asset: storedFlow?.form?.asset || selectedRoute.assets[0],
    beneficiary:
      storedFlow?.form?.beneficiary ||
      buildEmptyForm(selectedRoute).beneficiary
  }));

  const isReturnedFlow = Boolean(returnedPayoutIntentId);
  const isHistoryPage = window.location.pathname === "/connect/history";

  useEffect(() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      window.navigator.standalone === true;

    setIsStandalonePwa(standalone);

    function handleBeforeInstallPrompt(event) {
      event.preventDefault();
      setInstallPrompt(event);
      setCanInstallPwa(true);
    }

    window.addEventListener(
      "beforeinstallprompt",
      handleBeforeInstallPrompt
    );

    return () => {
      window.removeEventListener(
        "beforeinstallprompt",
        handleBeforeInstallPrompt
      );
    };
  }, []);

  useEffect(() => {
    if (isHistoryPage) return;
    if (pageViewTrackedRef.current) return;

    pageViewTrackedRef.current = true;

    trackConnectEvent("page_view", {
      route_id: selectedRouteId,
      asset: form.asset,
      metadata: {
        returned_flow: isReturnedFlow
      }
    });
  }, [form.asset, isHistoryPage, isReturnedFlow, selectedRouteId]);

  useEffect(() => {
    if (isHistoryPage) return;
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
  }, [address, chainId, form.asset, isConnected, isHistoryPage, selectedRouteId]);

  useEffect(() => {
    if (isHistoryPage) return;
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

    saveRouteHistoryItem({
      id: getSettlementId(settlement),
      route_id: getSettlementId(settlement),
      corridor: selectedRoute?.label || selectedRouteId,
      asset: form.asset,
      status: settlement?.status || "created"
    });
  }, [
    address,
    form.asset,
    isHistoryPage,
    payoutIntentId,
    selectedRoute,
    selectedRouteId,
    settlement
  ]);

  const writeDebug = useCallback((label, value = {}) => {
    setDebug(`${label}\n${JSON.stringify(value, null, 2)}`);
  }, []);

  const { connectSessionId, resetConnectSession } =
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

  const { handleSend, walletConfirmationPending } =
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

  const handleInstallPwa = useCallback(async () => {
    await trackConnectEvent("add_to_home_screen_clicked", {
      wallet_address: address,
      route_id: selectedRouteId,
      asset: form.asset,
      metadata: {
        has_install_prompt: Boolean(installPrompt)
      }
    });

    if (!installPrompt) {
      writeDebug(
        "Add to Home Screen",
        {
          instruction:
            "Use your browser menu and choose Add to Home Screen."
        }
      );
      return;
    }

    installPrompt.prompt();

    const choice = await installPrompt.userChoice;

    setInstallPrompt(null);
    setCanInstallPwa(false);

    writeDebug("Home screen install prompt completed.", {
      outcome: choice?.outcome || null
    });
  }, [
    address,
    form.asset,
    installPrompt,
    selectedRouteId,
    writeDebug
  ]);

  const handleUseRouteAgain = useCallback(async () => {
    await trackConnectEvent("use_route_again_clicked", {
      wallet_address: address,
      route_id: selectedRouteId,
      asset: form.asset,
      metadata: {
        previous_settlement_id: getSettlementId(settlement)
      }
    });

    setPayoutIntentId(null);
    setSettlement(null);
    setFundingTxHash(null);
    setIsBusy(false);

    routeCreatedTrackedRef.current = false;

    resetConnectSession();

    setForm(current => ({
      ...current,
      amount: "",
      asset: current.asset || selectedRoute.assets[0],
      beneficiary:
        current.beneficiary ||
        buildEmptyForm(selectedRoute).beneficiary
    }));

    clearStoredFlow();
    writeDebug("Ready to use this route again.");
  }, [
    address,
    form.asset,
    resetConnectSession,
    selectedRoute,
    selectedRouteId,
    settlement,
    writeDebug
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
    const route = getRouteById(routeId);

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

  if (isHistoryPage) {
    return <HistoryPage />;
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
        <>
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

          <RouteActions
            settlement={settlement}
            address={address}
            selectedRouteId={selectedRouteId}
            selectedRoute={selectedRoute}
            form={form}
            onUseAgain={handleUseRouteAgain}
          />

          {settlement && !isStandalonePwa && canInstallPwa && (
            <button
              type="button"
              className="install-pwa-button"
              onClick={handleInstallPwa}
            >
              Add UniBridge to Home Screen
            </button>
          )}
        </>
      )}
    </main>
  );
}
