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

import {
  useAppKit
} from "@reown/appkit/react";

import {
  ROUTES,
  getRouteById,
  normalizeBackendRoutes
} from "./routes";

import {
  getConnectRoutes,
  previewConnectRoute
} from "./api";

import {
  readStoredFlow,
  clearStoredFlow
} from "./flow/flowStorage";

import {
  readPayoutAccessToken
} from "./flow/payoutAccessTokenStorage";

import {
  readPayoutIntentFromUrl,
  buildEmptyForm
} from "./flow/routes";

import useConnectSession from "./hooks/useConnectSession";
import useReturnedPayoutIntent from "./hooks/useReturnedPayoutIntent";
import useRouteFlow from "./hooks/useRouteFlow";

import PayoutForm from "./components/PayoutForm";
import HistoryPage from "./components/HistoryPage";
import PayoutReviewManager from "./components/PayoutReviewManager";

import {
  trackConnectEvent
} from "./analytics/trackConnectEvent";

function normalizeString(
  value
) {
  return String(
    value ??
    ""
  ).trim();
}

function hasRoute(
  routes = [],
  routeId
) {
  return routes.some(
    route =>
      route.id === routeId ||
      route.route_id === routeId
  );
}

export default function App() {
  useAppKit();

  const pageViewTrackedRef =
    useRef(false);

  const walletConnectedTrackedRef =
    useRef(false);

  const routeCreatedTrackedRef =
    useRef(false);

  const repeatInitializedRef =
    useRef(false);

  const [
    installPrompt,
    setInstallPrompt
  ] = useState(null);

  const [
    canInstallPwa,
    setCanInstallPwa
  ] = useState(false);

  const [
    isStandalonePwa,
    setIsStandalonePwa
  ] = useState(false);

  const {
    address,
    chainId,
    isConnected
  } = useAccount();

  const {
    data: walletClient
  } = useWalletClient();

  const {
    switchChainAsync
  } = useSwitchChain();

  const searchParams =
    useMemo(
      () =>
        new URLSearchParams(
          window.location.search
        ),
      []
    );

  const isHistoryPage =
    searchParams.get(
      "view"
    ) ===
    "history";

  const repeatSourceFromUrl =
    normalizeString(
      searchParams.get(
        "repeat_source_payout_intent_id"
      )
    ) ||
    null;

  const repeatRouteIdFromUrl =
    normalizeString(
      searchParams.get(
        "route_id"
      )
    ) ||
    null;

  const storedFlow =
    useMemo(
      () =>
        readStoredFlow(),
      []
    );

  const returnedPayoutIntentId =
    readPayoutIntentFromUrl();

  const initialRepeatSourcePayoutIntentId =
    repeatSourceFromUrl ||
    storedFlow
      ?.repeat_source_payout_intent_id ||
    null;

  const initialSelectedRouteId =
    repeatRouteIdFromUrl ||
    storedFlow?.route_id ||
    ROUTES[0]?.id ||
    "br_pix";

  const [
    repeatSourcePayoutIntentId,
    setRepeatSourcePayoutIntentId
  ] = useState(
    initialRepeatSourcePayoutIntentId
  );

  const [
    routes,
    setRoutes
  ] = useState(
    ROUTES
  );

  const [
    selectedRouteId,
    setSelectedRouteId
  ] = useState(
    initialSelectedRouteId
  );

  const selectedRoute =
    useMemo(
      () =>
        getRouteById(
          selectedRouteId,
          routes
        ),
      [
        routes,
        selectedRouteId
      ]
    );

  const initialFormRoute =
    selectedRoute ||
    ROUTES[0];

  const [
    payoutIntentId,
    setPayoutIntentId
  ] = useState(
    returnedPayoutIntentId ||
      storedFlow
        ?.payout_intent_id ||
      null
  );

  /*
   * Repeat always uses the source payout token.
   *
   * This keeps authentication stable before and after
   * a KYC redirect.
   *
   * Normal flows fall back to the returned/current payout.
   */
  const [
    flowAccessToken
  ] = useState(() => {
    const accessPayoutIntentId =
      repeatSourceFromUrl ||
      storedFlow
        ?.repeat_source_payout_intent_id ||
      returnedPayoutIntentId ||
      storedFlow
        ?.payout_intent_id ||
      null;

    if (
      !accessPayoutIntentId
    ) {
      return null;
    }

    return (
      readPayoutAccessToken(
        accessPayoutIntentId
      )?.token ||
      null
    );
  });

  const historyAccessToken =
    isHistoryPage
      ? flowAccessToken
      : null;

  const repeatAccessToken =
    repeatSourcePayoutIntentId
      ? flowAccessToken
      : null;

  const [
    settlement,
    setSettlement
  ] = useState(null);

  const [
    fundingTxHash,
    setFundingTxHash
  ] = useState(null);

  const [
    isBusy,
    setIsBusy
  ] = useState(false);

  const [
    pricingPreview,
    setPricingPreview
  ] = useState(null);

  const [
    pricingPreviewStatus,
    setPricingPreviewStatus
  ] = useState("idle");

  const [
    pricingPreviewError,
    setPricingPreviewError
  ] = useState(null);

  const [
    debug,
    setDebug
  ] = useState(
    returnedPayoutIntentId
      ? "Loading payout route..."
      : initialRepeatSourcePayoutIntentId
        ? "Preparing repeat payout..."
        : "Waiting for wallet connection..."
  );

  const [
    form,
    setForm
  ] = useState(() => {
    if (
      initialRepeatSourcePayoutIntentId
    ) {
      return {
        ...buildEmptyForm(
          initialFormRoute
        ),

        amount:
          ""
      };
    }

    return {
      amount:
        storedFlow?.form?.amount ||
        "",

      asset:
        storedFlow?.form?.asset ||
        initialFormRoute.assets[0],

      beneficiary:
        storedFlow
          ?.form
          ?.beneficiary ||
        buildEmptyForm(
          initialFormRoute
        ).beneficiary
    };
  });

  const isReturnedFlow =
    Boolean(
      returnedPayoutIntentId
    );

  const isRepeatFlow =
    Boolean(
      repeatSourcePayoutIntentId
    );

  useEffect(() => {
    let cancelled =
      false;

    async function loadRoutes() {
      try {
        const backendRoutes =
          await getConnectRoutes();

        if (cancelled) {
          return;
        }

        const normalized =
          normalizeBackendRoutes(
            backendRoutes
          );

        setRoutes(
          normalized
        );

        if (
          hasRoute(
            normalized,
            initialSelectedRouteId
          )
        ) {
          return;
        }

        const nextRoute =
          normalized[0] ||
          ROUTES[0];

        setSelectedRouteId(
          nextRoute.id
        );

        setRepeatSourcePayoutIntentId(
          null
        );

        if (
          !storedFlow?.form &&
          !returnedPayoutIntentId
        ) {
          setForm(
            buildEmptyForm(
              nextRoute
            )
          );
        }
      }
      catch {
        if (!cancelled) {
          setRoutes(
            ROUTES
          );
        }
      }
    }

    void loadRoutes();

    return () => {
      cancelled =
        true;
    };
  }, [
    initialSelectedRouteId,
    returnedPayoutIntentId,
    storedFlow
  ]);

  useEffect(() => {
    if (
      repeatInitializedRef.current ||
      !repeatSourceFromUrl ||
      !repeatRouteIdFromUrl
    ) {
      return;
    }

    const repeatRoute =
      getRouteById(
        repeatRouteIdFromUrl,
        routes
      );

    if (!repeatRoute) {
      return;
    }

    repeatInitializedRef.current =
      true;

    setRepeatSourcePayoutIntentId(
      repeatSourceFromUrl
    );

    setSelectedRouteId(
      repeatRoute.id
    );

    setPayoutIntentId(
      null
    );

    setSettlement(
      null
    );

    setFundingTxHash(
      null
    );

    setPricingPreview(
      null
    );

    setPricingPreviewStatus(
      "idle"
    );

    setPricingPreviewError(
      null
    );

    setForm({
      ...buildEmptyForm(
        repeatRoute
      ),

      amount:
        ""
    });
  }, [
    repeatRouteIdFromUrl,
    repeatSourceFromUrl,
    routes
  ]);

  useEffect(() => {
    const standalone =
      window
        .matchMedia(
          "(display-mode: standalone)"
        )
        .matches ||
      window.navigator
        .standalone === true;

    setIsStandalonePwa(
      standalone
    );

    function handleBeforeInstallPrompt(
      event
    ) {
      event.preventDefault();

      setInstallPrompt(
        event
      );

      setCanInstallPwa(
        true
      );
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
    if (isHistoryPage) {
      return;
    }

    if (
      pageViewTrackedRef.current
    ) {
      return;
    }

    pageViewTrackedRef.current =
      true;

    trackConnectEvent(
      "page_view",
      {
        route_id:
          selectedRouteId,

        asset:
          form.asset,

        metadata: {
          returned_flow:
            isReturnedFlow,

          repeat_flow:
            isRepeatFlow
        }
      }
    );
  }, [
    form.asset,
    isHistoryPage,
    isRepeatFlow,
    isReturnedFlow,
    selectedRouteId
  ]);

  useEffect(() => {
    if (isHistoryPage) {
      return;
    }

    if (
      !isConnected ||
      !address
    ) {
      return;
    }

    if (
      walletConnectedTrackedRef
        .current
    ) {
      return;
    }

    walletConnectedTrackedRef
      .current = true;

    trackConnectEvent(
      "wallet_connected",
      {
        wallet_address:
          address,

        route_id:
          selectedRouteId,

        asset:
          form.asset,

        metadata: {
          chain_id:
            chainId
        }
      }
    );
  }, [
    address,
    chainId,
    form.asset,
    isConnected,
    isHistoryPage,
    selectedRouteId
  ]);

  useEffect(() => {
    if (isHistoryPage) {
      return;
    }

    if (!settlement) {
      return;
    }

    if (
      routeCreatedTrackedRef
        .current
    ) {
      return;
    }

    routeCreatedTrackedRef
      .current = true;

    trackConnectEvent(
      "route_created",
      {
        wallet_address:
          address,

        route_id:
          selectedRouteId,

        asset:
          form.asset,

        metadata: {
          settlement_id:
            settlement
              ?.settlement_id ||
            settlement?.id ||
            null,

          payout_intent_id:
            payoutIntentId,

          repeat_source_payout_intent_id:
            repeatSourcePayoutIntentId
        }
      }
    );
  }, [
    address,
    form.asset,
    isHistoryPage,
    payoutIntentId,
    repeatSourcePayoutIntentId,
    selectedRouteId,
    settlement
  ]);

  const writeDebug =
    useCallback(
      (
        label,
        value = {}
      ) => {
        setDebug(
          `${label}\n${JSON.stringify(
            value,
            null,
            2
          )}`
        );
      },
      []
    );

  const {
    connectSessionId,
    resetConnectSession
  } = useConnectSession({
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

  useEffect(() => {
    let cancelled =
      false;

    const amount =
      normalizeString(
        form.amount
      );

    const numericAmount =
      Number(
        amount
      );

    const canLoadPreview =
      !isHistoryPage &&
      !isReturnedFlow &&
      !isRepeatFlow &&
      isConnected &&
      Boolean(
        address
      ) &&
      Boolean(
        connectSessionId
      ) &&
      Boolean(
        selectedRoute
      ) &&
      Boolean(
        form.asset
      ) &&
      amount !== "" &&
      Number.isFinite(
        numericAmount
      ) &&
      numericAmount > 0;

    if (!canLoadPreview) {
      setPricingPreview(
        null
      );

      setPricingPreviewStatus(
        "idle"
      );

      setPricingPreviewError(
        null
      );

      return undefined;
    }

    setPricingPreview(
      null
    );

    setPricingPreviewStatus(
      "loading"
    );

    setPricingPreviewError(
      null
    );

    const timeoutId =
      window.setTimeout(
        async () => {
          try {
            const response =
              await previewConnectRoute({
                connectSessionId,

                walletAddress:
                  address,

                route:
                  selectedRoute,

                amount,

                asset:
                  form.asset
              });

            if (cancelled) {
              return;
            }

            setPricingPreview(
              response
                .pricing_preview
            );

            setPricingPreviewStatus(
              "ready"
            );
          }
          catch (
            error
          ) {
            if (cancelled) {
              return;
            }

            setPricingPreview(
              null
            );

            setPricingPreviewStatus(
              "error"
            );

            setPricingPreviewError(
              error?.message ||
              "connect_pricing_preview_failed"
            );
          }
        },
        300
      );

    return () => {
      cancelled =
        true;

      window.clearTimeout(
        timeoutId
      );
    };
  }, [
    address,
    connectSessionId,
    form.amount,
    form.asset,
    isConnected,
    isHistoryPage,
    isRepeatFlow,
    isReturnedFlow,
    selectedRoute
  ]);

  const {
    handleSend,
    walletConfirmationPending
  } = useRouteFlow({
    isConnected,
    address,
    chainId,
    walletClient,
    switchChainAsync,

    connectSessionId,
    selectedRoute,
    form,
    pricingPreview,

    payoutIntentId,
    setPayoutIntentId,
    settlement,
    setSettlement,
    setFundingTxHash,
    setIsBusy,

    isReturnedFlow,

    repeatSourcePayoutIntentId,
    repeatAccessToken,

    writeDebug
  });

  const trackedHandleSend =
    useCallback(
      async () => {
        await trackConnectEvent(
          "route_started",
          {
            wallet_address:
              address,

            route_id:
              selectedRouteId,

            asset:
              form.asset,

            metadata: {
              amount:
                form.amount,

              payout_intent_id:
                payoutIntentId,

              repeat_source_payout_intent_id:
                repeatSourcePayoutIntentId
            }
          }
        );

        return handleSend();
      },
      [
        address,
        form.amount,
        form.asset,
        handleSend,
        payoutIntentId,
        repeatSourcePayoutIntentId,
        selectedRouteId
      ]
    );

  const handleInstallPwa =
    useCallback(
      async () => {
        await trackConnectEvent(
          "add_to_home_screen_clicked",
          {
            wallet_address:
              address,

            route_id:
              selectedRouteId,

            asset:
              form.asset,

            metadata: {
              has_install_prompt:
                Boolean(
                  installPrompt
                )
            }
          }
        );

        if (!installPrompt) {
          writeDebug(
            "Save UniBridge",
            {
              instruction:
                "Use your browser menu and choose Add to Home Screen."
            }
          );

          return;
        }

        installPrompt.prompt();

        const choice =
          await installPrompt
            .userChoice;

        setInstallPrompt(
          null
        );

        setCanInstallPwa(
          false
        );

        writeDebug(
          "Home screen install prompt completed.",
          {
            outcome:
              choice?.outcome ||
              null
          }
        );
      },
      [
        address,
        form.asset,
        installPrompt,
        selectedRouteId,
        writeDebug
      ]
    );

  function updateBeneficiaryField(
    name,
    value
  ) {
    if (isRepeatFlow) {
      return;
    }

    setForm(
      current => ({
        ...current,

        beneficiary: {
          ...current
            .beneficiary,

          [name]:
            value
        }
      })
    );
  }

  function changeRoute(
    routeId
  ) {
    const route =
      getRouteById(
        routeId,
        routes
      );

    if (!route) {
      writeDebug(
        "Selected payout route is unavailable.",
        {
          route_id:
            routeId ||
            null
        }
      );

      return;
    }

    setRepeatSourcePayoutIntentId(
      null
    );

    setSelectedRouteId(
      route.id
    );

    setPayoutIntentId(
      null
    );

    setSettlement(
      null
    );

    setFundingTxHash(
      null
    );

    setPricingPreview(
      null
    );

    setPricingPreviewStatus(
      "idle"
    );

    setPricingPreviewError(
      null
    );

    routeCreatedTrackedRef
      .current = false;

    resetConnectSession();

    setForm(
      buildEmptyForm(
        route
      )
    );

    clearStoredFlow();

    writeDebug(
      "Ready to start a new payout."
    );
  }

  if (isHistoryPage) {
    return (
      <HistoryPage
        accessToken={
          historyAccessToken
        }
      />
    );
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

        <a
          href="/"
          className="connect-domain-pill"
          aria-label="UniBridge website"
        >
          Unibrij.io
        </a>
      </header>

      <h1 className="sr-only">
        Pay with wallet
      </h1>

      <p className="connect-eyebrow">
        {isRepeatFlow
          ? "Send again"
          : "Pay with wallet"}
      </p>

      <nav
        className="connect-tabs"
        aria-label="Connect navigation"
      >
        <span
          className="connect-tab is-active"
          aria-current="page"
        >
          New payout
        </span>

        <a
          href="/connect/?view=history"
          className="connect-tab"
        >
          History
        </a>
      </nav>

      {!isReturnedFlow && (
        <div
          className="wallet-connect-row"
          onClick={() => {
            trackConnectEvent(
              "wallet_connect_started",
              {
                route_id:
                  selectedRouteId,

                asset:
                  form.asset
              }
            );
          }}
        >
          <appkit-button />
        </div>
      )}

      {(isConnected ||
        isReturnedFlow) && (
        <>
          <PayoutForm
            selectedRouteId={
              selectedRouteId
            }
            selectedRoute={
              selectedRoute
            }
            form={
              form
            }
            setForm={
              setForm
            }
            isBusy={
              isBusy
            }
            isReturnedFlow={
              isReturnedFlow
            }
            isRepeatFlow={
              isRepeatFlow
            }
            settlement={
              settlement
            }
            fundingTxHash={
              fundingTxHash
            }
            walletConfirmationPending={
              walletConfirmationPending
            }
            payoutIntentId={
              payoutIntentId
            }
            pricingPreview={
              pricingPreview
            }
            executionPricing={
              settlement?.pricing ??
              null
            }
            pricingPreviewStatus={
              pricingPreviewStatus
            }
            pricingPreviewError={
              pricingPreviewError
            }
            debug={
              debug
            }
            handleSend={
              trackedHandleSend
            }
            changeRoute={
              changeRoute
            }
            updateBeneficiaryField={
              updateBeneficiaryField
            }
            routes={
              routes
            }
          />

          <PayoutReviewManager
            settlement={
              settlement
            }
            payoutIntentId={
              payoutIntentId
            }
            routeId={
              selectedRouteId
            }
            amount={
              form.amount
            }
            asset={
              form.asset
            }
            walletAddress={
              address
            }
          />

          {settlement &&
            !isStandalonePwa &&
            canInstallPwa && (
              <button
                type="button"
                className="install-pwa-button"
                onClick={
                  handleInstallPwa
                }
              >
                Save UniBridge
              </button>
            )}
        </>
      )}

      <footer className="connect-lite-footer">
        <span>
          © 2026 UniBridge Technologies Ltd.
        </span>

        <nav
          className="connect-lite-footer-links"
          aria-label="Footer links"
        >
          <a href="/privacy.html">
            Privacy
          </a>

          <span aria-hidden="true">
            |
          </span>

          <a href="/legal.html">
            Terms
          </a>
        </nav>
      </footer>
    </main>
  );
}
