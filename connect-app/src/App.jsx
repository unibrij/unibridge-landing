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
  useSwitchChain,
  usePublicClient
} from "wagmi";

import {
  useAppKit
} from "@reown/appkit/react";

import {
  ROUTES,
  getRouteById
} from "./routes";

import {
  getRepeatPayoutSource
} from "./api";

import {
  readStoredFlow,
  storeFlowSnapshot,
  clearStoredFlow
} from "./flow/flowStorage";

import {
  PAYOUT_ATTEMPT_STATE
} from "./flow/payoutAttempt";

import {
  readPayoutAccessToken,
  readLastPayoutAccessToken
} from "./flow/payoutAccessTokenStorage";

import {
  readPayoutIntentFromUrl,
  buildEmptyForm
} from "./flow/routes";

import {
  readConnectUrlState,
  removeQueryParams
} from "./flow/urlState";

import useConnectSession
  from "./hooks/useConnectSession";

import useReturnedPayoutIntent
  from "./hooks/useReturnedPayoutIntent";

import useRouteFlow
  from "./hooks/useRouteFlow";

import useConnectRoutes
  from "./hooks/useConnectRoutes";

import usePayoutAttemptLifecycle
  from "./hooks/usePayoutAttemptLifecycle";

import useConnectPricingPreview
  from "./hooks/useConnectPricingPreview";

import useConnectAnalytics
  from "./hooks/useConnectAnalytics";

import usePwaInstall
  from "./hooks/usePwaInstall";

import PayoutForm
  from "./components/PayoutForm";

import HistoryPage
  from "./components/HistoryPage";

import PayoutReviewManager
  from "./components/PayoutReviewManager";

export default function App() {
  useAppKit();

  /*
   * Mutable identity of the payout attempt currently
   * owned by this frontend flow.
   *
   * Async lifecycle reads use this to reject stale
   * responses after the active intent changes.
   */
  const payoutIntentIdStateRef =
    useRef(null);

  const repeatInitializedRef =
    useRef(false);

  const {
    address,
    chainId,
    isConnected
  } = useAccount();

  const {
    data: walletClient
  } = useWalletClient();

  const publicClient =
    usePublicClient();

  const {
    switchChainAsync
  } = useSwitchChain();

  /*
   * URL state is read once for this mounted Connect
   * session.
   */
  const urlState =
    useMemo(
      () =>
        readConnectUrlState(),
      []
    );

  const {
    isHistoryPage,

    repeatSourcePayoutIntentId:
      repeatSourceFromUrl,

    repeatRouteId:
      repeatRouteIdFromUrl
  } = urlState;

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

  /*
   * Initial form construction must not depend on
   * remote route discovery.
   *
   * The bundled route catalog is sufficient for the
   * first render; useConnectRoutes replaces it with
   * Core routes when discovery succeeds.
   */
  const initialFormRoute =
    getRouteById(
      initialSelectedRouteId,
      ROUTES
    ) ||
    ROUTES[0];

  const initialPayoutIntentId =
    returnedPayoutIntentId ||
    storedFlow
      ?.payout_intent_id ||
    null;

  const [
    returnedFlowDismissed,
    setReturnedFlowDismissed
  ] = useState(false);

  const [
    repeatSourcePayoutIntentId,
    setRepeatSourcePayoutIntentId
  ] = useState(
    initialRepeatSourcePayoutIntentId
  );

  const [
    payoutIntentId,
    setPayoutIntentId
  ] = useState(
    initialPayoutIntentId
  );

  payoutIntentIdStateRef.current =
    payoutIntentId ||
    null;

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
        storedFlow
          ?.form
          ?.amount ||
        "",

      asset:
        storedFlow
          ?.form
          ?.asset ||
        initialFormRoute
          ?.assets
          ?.[0] ||
        "USDT",

      beneficiary:
        storedFlow
          ?.form
          ?.beneficiary ||
        buildEmptyForm(
          initialFormRoute
        ).beneficiary
    };
  });

  /*
   * Flow-specific token.
   *
   * Prefer the token belonging to the payout that
   * established the current flow when one is still
   * available.
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

  /*
   * Customer-auth fallback.
   *
   * History and repeat are customer-scoped by Core.
   * Prefer the most recently stored customer access
   * token because a source payout token may still be
   * present locally after it has expired.
   */
  const [
    fallbackAccessToken
  ] = useState(() => {
    return (
      readLastPayoutAccessToken()
        ?.token ||
      null
    );
  });

  const historyAccessToken =
    isHistoryPage
      ? (
          fallbackAccessToken ||
          flowAccessToken ||
          null
        )
      : null;

  const repeatAccessToken =
    repeatSourcePayoutIntentId
      ? (
          fallbackAccessToken ||
          flowAccessToken ||
          null
        )
      : null;

  const isReturnedFlow =
    Boolean(
      returnedFlowDismissed
        ? null
        : returnedPayoutIntentId
    );

  const isRepeatFlow =
    Boolean(
      repeatSourcePayoutIntentId
    );

  /*
   * Connect navigation belongs to an established
   * wallet / returned payout context.
   *
   * Before that boundary, the only primary action
   * should be wallet connection.
   */
  const canAccessConnectNavigation =
    isConnected ||
    isReturnedFlow;

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

  /*
   * Core route discovery owns only the route catalog
   * and selected route.
   *
   * If Core successfully proves that the initially
   * requested route disappeared, App owns the
   * cross-subsystem consequences.
   */
  const handleInitialRouteFallback =
    useCallback(
      fallbackRoute => {
        setRepeatSourcePayoutIntentId(
          null
        );

        if (
          !storedFlow?.form &&
          !returnedPayoutIntentId
        ) {
          setForm(
            buildEmptyForm(
              fallbackRoute
            )
          );
        }
      },
      [
        returnedPayoutIntentId,
        storedFlow
      ]
    );

  const {
    routes,
    selectedRouteId,
    setSelectedRouteId,
    selectedRoute
  } = useConnectRoutes({
    initialSelectedRouteId,

    onInitialRouteFallback:
      handleInitialRouteFallback
  });

  /*
   * Payout lifecycle ownership.
   *
   * Core is authoritative for whether a payout is
   * editable, resumable or requires recovery.
   */
  const {
    payoutAttemptState,
    settlementCreationStatus,

    refreshPayoutAttempt,
    resetPayoutAttemptLifecycle
  } = usePayoutAttemptLifecycle({
    payoutIntentId,
    payoutIntentIdStateRef,

    returnedPayoutIntentId,

    setPayoutIntentId,
    setSettlement,
    setFundingTxHash,
    setReturnedFlowDismissed
  });

  /*
   * Local in-flight work locks immediately.
   *
   * Once local work settles, the authoritative Core
   * lifecycle controls whether the transfer remains
   * immutable.
   */
  const isTransferLocked =
    isBusy ||
    payoutAttemptState !==
      PAYOUT_ATTEMPT_STATE
        .EDITABLE;

  /*
   * Repeat links hydrate their transfer specification
   * from the authenticated source payout.
   *
   * Core is authoritative for the source route,
   * amount, asset and beneficiary. No recipient data
   * is carried in the URL.
   */
  useEffect(() => {
    if (
      repeatInitializedRef.current ||
      !repeatSourceFromUrl ||
      !repeatAccessToken
    ) {
      return;
    }

    let cancelled =
      false;

    async function initializeRepeat() {
      try {
        setIsBusy(
          true
        );

        writeDebug(
          "Preparing repeat payout..."
        );

        const source =
          await getRepeatPayoutSource({
            sourcePayoutIntentId:
              repeatSourceFromUrl,

            accessToken:
              repeatAccessToken
          });

        if (cancelled) {
          return;
        }

        const sourceRouteId =
          String(
            source?.route_id ||
            repeatRouteIdFromUrl ||
            ""
          ).trim();

        const repeatRoute =
          getRouteById(
            sourceRouteId,
            routes
          );

        /*
         * Route discovery may still be replacing the
         * bundled catalog. Leave initialization open
         * so this effect can run again when routes
         * become available.
         */
        if (!repeatRoute) {
          writeDebug(
            "Repeat payout route is unavailable.",
            {
              route_id:
                sourceRouteId ||
                null
            }
          );

          return;
        }

        const emptyForm =
          buildEmptyForm(
            repeatRoute
          );

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

        resetPayoutAttemptLifecycle();

        setSettlement(
          null
        );

        setFundingTxHash(
          null
        );

        setForm({
          ...emptyForm,

          amount:
            source?.amount !==
              undefined &&
            source?.amount !==
              null
              ? String(
                  source.amount
                )
              : "",

          asset:
            String(
              source?.asset ||
              emptyForm?.asset ||
              repeatRoute
                ?.assets
                ?.[0] ||
              "USDT"
            ).trim(),

          beneficiary: {
            ...(
              emptyForm
                ?.beneficiary ||
              {}
            ),

            ...(
              source
                ?.beneficiary &&
              typeof source
                .beneficiary ===
                "object" &&
              !Array.isArray(
                source
                  .beneficiary
              )
                ? source
                    .beneficiary
                : {}
            )
          }
        });

        writeDebug(
          "Repeat payout ready.",
          {
            source_payout_intent_id:
              repeatSourceFromUrl,

            route_id:
              repeatRoute.id
          }
        );
      }
      catch (
        err
      ) {
        if (cancelled) {
          return;
        }

        writeDebug(
          "Unable to prepare repeat payout.",
          {
            error:
              err?.message ||
              "get_repeat_payout_source_failed"
          }
        );
      }
      finally {
        if (!cancelled) {
          setIsBusy(
            false
          );
        }
      }
    }

    initializeRepeat();

    return () => {
      cancelled =
        true;
    };
  }, [
    repeatAccessToken,
    repeatRouteIdFromUrl,
    repeatSourceFromUrl,
    resetPayoutAttemptLifecycle,
    routes,
    setSelectedRouteId,
    writeDebug
  ]);

  const {
    connectSessionId,
    resetConnectSession
  } = useConnectSession({
    isConnected,
    address,
    writeDebug
  });

  /*
   * Returned KYC / authorization flows may hydrate
   * route, form and payout intent from Core.
   */
  useReturnedPayoutIntent({
    returnedPayoutIntentId:
      returnedFlowDismissed
        ? null
        : returnedPayoutIntentId,

    routes,
    setSelectedRouteId,
    setPayoutIntentId,
    setForm,
    setIsBusy,
    writeDebug
  });

  /*
   * Editable standard payouts receive a debounced
   * route pricing preview.
   *
   * Returned, repeat and locked flows rely on their
   * backend-owned execution context instead.
   */
  const {
    pricingPreview,
    pricingPreviewStatus,
    pricingPreviewError,

    resetPricingPreview
  } = useConnectPricingPreview({
    enabled:
      !isHistoryPage &&
      !isReturnedFlow &&
      !isRepeatFlow &&
      !isTransferLocked,

    isConnected,
    address,
    connectSessionId,

    selectedRoute,

    amount:
      form.amount,

    asset:
      form.asset
  });

  /*
   * Route execution owns authorization, settlement
   * creation, funding and settlement polling.
   */
  const {
    handleSend,
    walletConfirmationPending,
    resetRouteFlowRuntime
  } = useRouteFlow({
    isConnected,
    address,
    chainId,
    walletClient,
    publicClient,
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

  /*
   * Analytics is intentionally separated from the
   * product flows it observes.
   */
  const {
    trackWalletConnectStarted,
    trackRouteStarted,
    trackInstallClicked,

    resetRouteCreatedTracking
  } = useConnectAnalytics({
    isHistoryPage,

    isConnected,
    address,
    chainId,

    selectedRouteId,

    asset:
      form.asset,

    isReturnedFlow,
    isRepeatFlow,

    settlement,
    payoutIntentId,
    repeatSourcePayoutIntentId
  });

  /*
   * PWA lifecycle is independent from payout
   * execution. Analytics is injected rather than
   * owned by the PWA hook.
   */
  const {
    canInstallPwa,
    isStandalonePwa,
    handleInstallPwa
  } = usePwaInstall({
    onInstallClicked:
      trackInstallClicked,

    writeDebug
  });

  /*
   * User-driven payout execution.
   *
   * Every completed attempt triggers an authoritative
   * lifecycle refresh, regardless of success or
   * failure.
   */
  const trackedHandleSend =
    useCallback(
      async () => {
        await trackRouteStarted({
          amount:
            form.amount
        });

        try {
          return await handleSend();
        }
        finally {
          refreshPayoutAttempt();
        }
      },
      [
        form.amount,
        handleSend,
        refreshPayoutAttempt,
        trackRouteStarted
      ]
    );

  /*
   * Explicit user action.
   *
   * Detach the frontend from the current payout
   * without mutating or cancelling the old backend
   * attempt.
   *
   * New payout also acts as the user's escape hatch
   * from a pre-funding flow whose local runtime is
   * still busy or waiting for wallet confirmation.
   */
  const handleNewPayout =
    useCallback(
      () => {
        resetRouteFlowRuntime();

        payoutIntentIdStateRef.current =
          null;

        setPayoutIntentId(
          null
        );

        resetPayoutAttemptLifecycle();

        setSettlement(
          null
        );

        setFundingTxHash(
          null
        );

        setRepeatSourcePayoutIntentId(
          null
        );

        repeatInitializedRef.current =
          false;

        setReturnedFlowDismissed(
          true
        );

        resetPricingPreview();

        resetRouteCreatedTracking();

        /*
         * Preserve route and transfer details as the
         * editable draft for the next payout.
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
        resetPayoutAttemptLifecycle,
        resetPricingPreview,
        resetRouteCreatedTracking,
        resetRouteFlowRuntime,
        selectedRouteId,
        writeDebug
      ]
    );

  /*
   * Guard transfer-spec mutation at the parent
   * boundary.
   *
   * PayoutForm also disables the corresponding
   * controls visually.
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

  const updateBeneficiaryField =
    useCallback(
      (
        name,
        value
      ) => {
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
      },
      [
        isRepeatFlow,
        isTransferLocked
      ]
    );

  /*
   * Explicit route change starts a clean payout
   * draft.
   *
   * This action is unavailable once the active
   * payout specification has crossed its lock
   * boundary.
   */
  const changeRoute =
    useCallback(
      routeId => {
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

        repeatInitializedRef.current =
          false;

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

        resetPayoutAttemptLifecycle();

        setSettlement(
          null
        );

        setFundingTxHash(
          null
        );

        resetPricingPreview();

        resetRouteCreatedTracking();

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
      },
      [
        isTransferLocked,
        payoutAttemptState,
        payoutIntentId,
        resetConnectSession,
        resetPayoutAttemptLifecycle,
        resetPricingPreview,
        resetRouteCreatedTracking,
        routes,
        setSelectedRouteId,
        writeDebug
      ]
    );

  /*
   * History remains behind the same usable-session
   * boundary as the Connect navigation.
   */
  if (
    isHistoryPage &&
    canAccessConnectNavigation
  ) {
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

      {canAccessConnectNavigation && (
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
      )}

      {!isReturnedFlow && (
        <div
          className="wallet-connect-row"
          onClick={
            () => {
              trackWalletConnectStarted();
            }
          }
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
            settlementCreationStatus={
              settlementCreationStatus
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
              settlement
                ?.pricing ??
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
