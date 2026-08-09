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
  getPayoutIntent,
  previewConnectRoute
} from "./api";

import {
  readStoredFlow,
  storeFlowSnapshot,
  clearStoredPayoutIntent,
  clearStoredFlow
} from "./flow/flowStorage";

import {
  PAYOUT_ATTEMPT_STATE,
  resolvePayoutAttemptState,
  resolveSettlementCreationStatus
} from "./flow/payoutAttempt";

import {
  readPayoutAccessToken,
  readLastPayoutAccessToken
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

function removeQueryParams(
  names = []
) {
  if (
    typeof window ===
    "undefined"
  ) {
    return;
  }

  try {
    const url =
      new URL(
        window.location.href
      );

    let changed =
      false;

    for (
      const name
      of names
    ) {
      if (
        !url.searchParams.has(
          name
        )
      ) {
        continue;
      }

      url.searchParams.delete(
        name
      );

      changed =
        true;
    }

    if (!changed) {
      return;
    }

    const nextUrl =
      `${url.pathname}${url.search}${url.hash}`;

    window.history.replaceState(
      window.history.state,
      "",
      nextUrl
    );
  }
  catch {
    // URL cleanup is non-critical.
  }
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

  /*
   * Tracks the currently active payout intent
   * independently from async lifecycle reads.
   */
  const payoutIntentIdStateRef =
    useRef(null);

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

  const [
    returnedFlowDismissed,
    setReturnedFlowDismissed
  ] = useState(false);

  const effectiveReturnedPayoutIntentId =
    returnedFlowDismissed
      ? null
      : returnedPayoutIntentId;

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

  const initialPayoutIntentId =
    returnedPayoutIntentId ||
    storedFlow
      ?.payout_intent_id ||
    null;

  const [
    payoutIntentId,
    setPayoutIntentId
  ] = useState(
    initialPayoutIntentId
  );

  payoutIntentIdStateRef.current =
    payoutIntentId ||
    null;

  /*
   * Existing attempts begin conservatively locked
   * until Core confirms their lifecycle.
   */
  const [
    payoutAttemptState,
    setPayoutAttemptState
  ] = useState(
    initialPayoutIntentId
      ? PAYOUT_ATTEMPT_STATE
          .LOCKED_RECOVERY
      : PAYOUT_ATTEMPT_STATE
          .EDITABLE
  );

  /*
   * Explicit lifecycle refresh trigger after
   * user-driven payout actions.
   */
  const [
    attemptRefreshNonce,
    setAttemptRefreshNonce
  ] = useState(0);

  /*
   * Current / repeat flow access token.
   *
   * Repeat always uses the source payout token.
   * Never fall back to an unrelated last token.
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

  const [
    historyFallbackAccessToken
  ] = useState(() => {
    if (!isHistoryPage) {
      return null;
    }

    return (
      readLastPayoutAccessToken()
        ?.token ||
      null
    );
  });

  const historyAccessToken =
    isHistoryPage
      ? (
          flowAccessToken ||
          historyFallbackAccessToken ||
          null
        )
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

  /*
   * Local in-flight work locks immediately.
   *
   * Once the request settles, Core lifecycle is the
   * authoritative source for whether the transfer
   * remains locked.
   */
  const isTransferLocked =
    isBusy ||
    payoutAttemptState !==
      PAYOUT_ATTEMPT_STATE
        .EDITABLE;

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
      effectiveReturnedPayoutIntentId
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

    payoutIntentIdStateRef.current =
      null;

    setPayoutIntentId(
      null
    );

    setPayoutAttemptState(
      PAYOUT_ATTEMPT_STATE
        .EDITABLE
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
    returnedPayoutIntentId:
      effectiveReturnedPayoutIntentId,

    routes,
    setSelectedRouteId,
    setPayoutIntentId,
    setForm,
    setIsBusy,
    writeDebug
  });

  /*
   * Authoritative payout-attempt lifecycle restore.
   *
   * Unknown lifecycle stays conservatively locked.
   * Safe pre-side-effect failure is detached so the
   * next Continue creates a new payout intent.
   */
  useEffect(() => {
    let cancelled =
      false;

    const intentId =
      normalizeString(
        payoutIntentId
      );

    payoutIntentIdStateRef.current =
      intentId ||
      null;

    if (!intentId) {
      setPayoutAttemptState(
        PAYOUT_ATTEMPT_STATE
          .EDITABLE
      );

      return () => {
        cancelled =
          true;
      };
    }

    async function restoreAttemptState() {
      try {
        const intent =
          await getPayoutIntent({
            payoutIntentId:
              intentId
          });

        if (
          cancelled ||
          payoutIntentIdStateRef
            .current !== intentId
        ) {
          return;
        }

        const attemptState =
          resolvePayoutAttemptState(
            intent
          );

        const creationStatus =
          resolveSettlementCreationStatus(
            intent
          );

        /*
         * Safe failure:
         *
         * FAILED + reserved/prepared resolves to
         * EDITABLE. Retire that intent locally.
         */
        if (
          creationStatus ===
            "failed" &&
          attemptState ===
            PAYOUT_ATTEMPT_STATE
              .EDITABLE
        ) {
          const cameFromReturnedUrl =
            normalizeString(
              returnedPayoutIntentId
            ) ===
            intentId;

          clearStoredPayoutIntent();

          payoutIntentIdStateRef.current =
            null;

          setPayoutIntentId(
            current =>
              current === intentId
                ? null
                : current
          );

          setPayoutAttemptState(
            PAYOUT_ATTEMPT_STATE
              .EDITABLE
          );

          setSettlement(
            null
          );

          setFundingTxHash(
            null
          );

          if (
            cameFromReturnedUrl
          ) {
            setReturnedFlowDismissed(
              true
            );

            removeQueryParams([
              "payout_intent_id"
            ]);
          }

          return;
        }

        setPayoutAttemptState(
          attemptState
        );
      }
      catch (
        error
      ) {
        if (
          cancelled ||
          payoutIntentIdStateRef
            .current !== intentId
        ) {
          return;
        }

        /*
         * A missing locally restored intent can be
         * safely detached.
         */
        if (
          error?.message ===
          "payout_intent_not_found"
        ) {
          const cameFromReturnedUrl =
            normalizeString(
              returnedPayoutIntentId
            ) ===
            intentId;

          clearStoredPayoutIntent();

          payoutIntentIdStateRef.current =
            null;

          setPayoutIntentId(
            current =>
              current === intentId
                ? null
                : current
          );

          setPayoutAttemptState(
            PAYOUT_ATTEMPT_STATE
              .EDITABLE
          );

          setSettlement(
            null
          );

          setFundingTxHash(
            null
          );

          if (
            cameFromReturnedUrl
          ) {
            setReturnedFlowDismissed(
              true
            );

            removeQueryParams([
              "payout_intent_id"
            ]);
          }

          return;
        }

        /*
         * Failed lifecycle read:
         * never guess that mutation is safe.
         */
        setPayoutAttemptState(
          PAYOUT_ATTEMPT_STATE
            .LOCKED_RECOVERY
        );
      }
    }

    void restoreAttemptState();

    return () => {
      cancelled =
        true;
    };
  }, [
    attemptRefreshNonce,
    payoutIntentId,
    returnedPayoutIntentId
  ]);

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
      !isTransferLocked &&
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
    isTransferLocked,
    selectedRoute
  ]);

  const {
    handleSend,
    walletConfirmationPending,
    resetRouteFlowRuntime
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

        try {
          return await handleSend();
        }
        finally {
          /*
           * Re-read Core lifecycle after every
           * user-driven payout attempt.
           */
          setAttemptRefreshNonce(
            current =>
              current + 1
          );
        }
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

  /*
   * Explicit user action.
   *
   * Detaches the current attempt locally without
   * cancelling or mutating the old backend payout.
   */
  const handleNewPayout =
    useCallback(
      () => {
        /*
         * Do not detach while an authorization,
         * creation or funding request is still active.
         *
         * resetRouteFlowRuntime can cancel polling,
         * but it cannot cancel an already-running
         * settlement creation request.
         */
        if (isBusy) {
          return;
        }

        resetRouteFlowRuntime();

        payoutIntentIdStateRef.current =
          null;

        setPayoutIntentId(
          null
        );

        setPayoutAttemptState(
          PAYOUT_ATTEMPT_STATE
            .EDITABLE
        );

        setSettlement(
          null
        );

        setFundingTxHash(
          null
        );

        setRepeatSourcePayoutIntentId(
          null
        );

        setReturnedFlowDismissed(
          true
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

        /*
         * Keep route + transfer details as the draft
         * for the next payout.
         */
        storeFlowSnapshot({
          connect_session_id:
            connectSessionId,

          payout_intent_id:
            null,

          repeat_source_payout_intent_id:
            null,

          route_id:
            selectedRouteId ||
            null,

          transfer_fingerprint:
            null,

          form,

          pricing_preview:
            null
        });

        removeQueryParams([
          "payout_intent_id",
          "repeat_source_payout_intent_id",
          "route_id"
        ]);

        writeDebug(
          "Ready to start a new payout."
        );
      },
      [
        connectSessionId,
        form,
        isBusy,
        resetRouteFlowRuntime,
        selectedRouteId,
        writeDebug
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

  /*
   * Guard form mutation at the parent boundary.
   *
   * Individual controls will also be visually
   * disabled by PayoutForm.
   */
  const setEditableForm =
    useCallback(
      nextValue => {
        if (isTransferLocked) {
          return;
        }

        setForm(
          nextValue
        );
      },
      [
        isTransferLocked
      ]
    );

  function updateBeneficiaryField(
    name,
    value
  ) {
    if (
      isRepeatFlow ||
      isTransferLocked
    ) {
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
    if (isTransferLocked) {
      writeDebug(
        "This payout is locked. Start a new payout to change the route.",
        {
          payout_intent_id:
            payoutIntentId,

          payout_attempt_state:
            payoutAttemptState
        }
      );

      return;
    }

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

    setReturnedFlowDismissed(
      true
    );

    setSelectedRouteId(
      route.id
    );

    payoutIntentIdStateRef.current =
      null;

    setPayoutIntentId(
      null
    );

    setPayoutAttemptState(
      PAYOUT_ATTEMPT_STATE
        .EDITABLE
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

    removeQueryParams([
      "payout_intent_id",
      "repeat_source_payout_intent_id",
      "route_id"
    ]);

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
              setEditableForm
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
            payoutAttemptState={
              payoutAttemptState
            }
            isTransferLocked={
              isTransferLocked
            }
            onNewPayout={
              handleNewPayout
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
