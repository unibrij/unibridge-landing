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
  getRouteById,
  normalizeBackendRoutes
} from "./routes";

import { getConnectRoutes } from "./api";
import { readStoredFlow, clearStoredFlow } from "./flow/flowStorage";
import { readPayoutIntentFromUrl, buildEmptyForm } from "./flow/routes";

import useConnectSession from "./hooks/useConnectSession";
import useReturnedPayoutIntent from "./hooks/useReturnedPayoutIntent";
import useRouteFlow from "./hooks/useRouteFlow";

import PayoutForm from "./components/PayoutForm";
import HistoryPage from "./components/HistoryPage";
import PayoutReviewManager from "./components/PayoutReviewManager";
import RouteActions from "./components/RouteActions";
import ConnectFaq from "./components/ConnectFaq";
import { trackConnectEvent } from "./analytics/trackConnectEvent";

function getSettlementId(settlement) {
  return (
    settlement?.settlement_id ||
    settlement?.id ||
    settlement?.route_id ||
    "N/A"
  );
}

function hasRoute(routes = [], routeId) {
  return routes.some(route =>
    route.id === routeId ||
    route.route_id === routeId
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

  const [routes, setRoutes] = useState(ROUTES);

  const [selectedRouteId, setSelectedRouteId] = useState(
    storedFlow?.route_id || ROUTES[0]?.id || "br_pix"
  );

  const selectedRoute = useMemo(
    () => getRouteById(selectedRouteId, routes),
    [routes, selectedRouteId]
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

  const isHistoryPage =
    new URLSearchParams(window.location.search).get("view") === "history";

  useEffect(() => {
    let cancelled = false;

    async function loadRoutes() {
      try {
        const backendRoutes =
          await getConnectRoutes();

        if (cancelled) {
          return;
        }

        const normalized =
          normalizeBackendRoutes(backendRoutes);

        setRoutes(normalized);

        if (!hasRoute(normalized, selectedRouteId)) {
          const nextRoute =
            normalized[0] || ROUTES[0];

          setSelectedRouteId(nextRoute.id);

          if (!storedFlow?.form && !returnedPayoutIntentId) {
            setForm(buildEmptyForm(nextRoute));
          }
        }
      } catch {
        if (!cancelled) {
          setRoutes(ROUTES);
        }
      }
    }

    loadRoutes();

    return () => {
      cancelled = true;
    };
  }, [
    returnedPayoutIntentId,
    storedFlow?.form
  ]);

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
  }, [
    address,
    chainId,
    form.asset,
    isConnected,
    isHistoryPage,
    selectedRouteId
  ]);

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
  }, [
    address,
    form.asset,
    isHistoryPage,
    payoutIntentId,
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
    routes,
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
        "Open routes faster next time",
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
    writeDebug("Ready to start another payout.");
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
    const route =
      getRouteById(routeId, routes);

    setSelectedRouteId(route.id);
    setPayoutIntentId(null);
    setSettlement(null);
    setFundingTxHash(null);

    routeCreatedTrackedRef.current = false;

    resetConnectSession();
    setForm(buildEmptyForm(route));
    clearStoredFlow();
    writeDebug("Ready to start a new payout.");
  }

  if (isHistoryPage) {
    return <HistoryPage walletAddress={address} />;
  }

  return (
    <main className="connect-shell">
      <header className="connect-brandbar">
        <a
          href="/connect"
          className="connect-brandbar-logo-link"
          aria-label="Pay with UniBridge"
        >
          <img
            src="/public/icons/social/unibridge-orbit-lockup-white.png"
            className="connect-brandbar-logo"
            alt="UniBridge"
          />
        </a>
      </header>

      <h1>Pay with your wallet</h1>

      <p className="connect-rhythm">
        One rhythm. Every route.
      </p>

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
            routes={routes}
          />

          <RouteActions
            settlement={settlement}
            address={address}
            selectedRouteId={selectedRouteId}
            selectedRoute={selectedRoute}
            form={form}
            onUseAgain={handleUseRouteAgain}
          />

          <PayoutReviewManager
            settlement={settlement}
            payoutIntentId={payoutIntentId}
            routeId={selectedRouteId}
            amount={form.amount}
            asset={form.asset}
            walletAddress={address}
          />

          {settlement && !isStandalonePwa && canInstallPwa && (
            <button
              type="button"
              className="install-pwa-button"
              onClick={handleInstallPwa}
            >
              Open routes faster next time
            </button>
          )}
        </>
      )}

      <ConnectFaq />

      <footer className="connect-lite-footer">
        <span>© 2026 UniBridge Technologies Ltd.</span>

        <nav className="connect-lite-footer-links" aria-label="Footer links">
          <a href="/privacy.html">Privacy</a>
          <span aria-hidden="true">|</span>
          <a href="/legal.html">Terms</a>
        </nav>
      </footer>
    </main>
  );
}
