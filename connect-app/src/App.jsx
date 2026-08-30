// connect-app/src/App.jsx

import {
  useCallback,
  useMemo,
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
  readStoredFlow,
  clearStoredFlow
} from "./flow/flowStorage";

import {
  PAYOUT_ATTEMPT_STATE
} from "./flow/payoutAttempt";

import {
  readPayoutIntentFromUrl,
  buildEmptyForm
} from "./flow/routes";

import {
  readConnectUrlState,
  removeQueryParams
} from "./flow/urlState";

import {
  resolveConnectEntry
} from "./flow/connectEntryPolicy";

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

import useRepeatPayoutFlow
  from "./hooks/useRepeatPayoutFlow";

import useConnectReceiveContext
  from "./hooks/useConnectReceiveContext";

import useReceivePayoutForm
  from "./hooks/useReceivePayoutForm";

import useConnectFlowState
  from "./hooks/useConnectFlowState";

import useConnectFlowAccess
  from "./hooks/useConnectFlowAccess";

import useConnectPayoutActions
  from "./hooks/useConnectPayoutActions";

import PayoutForm
  from "./components/PayoutForm";

import HistoryPage
  from "./components/HistoryPage";

import PayoutReviewManager
  from "./components/PayoutReviewManager";


export default function App() {
  useAppKit();

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
   * URL state belongs to this mounted Connect entry.
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

  /*
   * Stored flow is captured once at entry.
   */
  const storedFlow =
    useMemo(
      () =>
        readStoredFlow(),
      []
    );

  const returnedPayoutIntentId =
    useMemo(
      () =>
        readPayoutIntentFromUrl(),
      []
    );

  /*
   * Browser-safe Receive context.
   *
   * Raw beneficiary data never enters App.
   */
  const {
    receiveBound,
    receiveProfileId,

    destinationCountry:
      receiveDestinationCountry,

    payoutRail:
      receivePayoutRail,

    recipient:
      receiveRecipient,

    clearReceiveContext
  } = useConnectReceiveContext();

  /*
   * Entry policy is resolved exactly once.
   *
   * Precedence:
   *
   * Returned URL
   * → Repeat URL
   * → Receive context
   * → Stored Repeat
   * → Stored Standard
   */
  const [
    entry
  ] = useState(
    () =>
      resolveConnectEntry({
        returnedPayoutIntentId,
        repeatSourceFromUrl,
        repeatRouteIdFromUrl,

        storedFlow,

        receiveBound,
        receiveProfileId,

        defaultRouteId:
          ROUTES[0]?.id ||
          "br_pix"
      })
  );

  /*
   * Initial form construction needs only a
   * synchronous bundled route.
   *
   * Receive route discovery remains owned by
   * useConnectRoutes.
   */
  const initialFormRoute =
    useMemo(
      () =>
        getRouteById(
          entry
            ?.initialSelectedRouteId,
          ROUTES
        ) ||
        ROUTES[0],
      [
        entry
      ]
    );

  /*
   * Flow state ownership.
   */
  const {
    payoutIntentIdStateRef,
    repeatInitializedRef,

    returnedFlowDismissed,
    setReturnedFlowDismissed,

    repeatSourcePayoutIntentId,
    setRepeatSourcePayoutIntentId,

    payoutIntentId,
    setPayoutIntentId,

    settlement,
    setSettlement,

    fundingTxHash,
    setFundingTxHash,

    isBusy,
    setIsBusy,

    debug,
    setDebug,

    form,
    setForm
  } = useConnectFlowState({
    entry,
    storedFlow,
    initialFormRoute
  });

  /*
   * Runtime flow precedence.
   *
   * Entry policy owns how the App entered.
   * Runtime state owns transitions after entry.
   */
  const isReturnedFlow =
    Boolean(
      entry?.kind ===
        "returned" &&
      !returnedFlowDismissed &&
      entry
        ?.returnedPayoutIntentId
    );

  const isRepeatFlow =
    Boolean(
      !isReturnedFlow &&
      repeatSourcePayoutIntentId
    );

  const isReceiveFlow =
    Boolean(
      entry?.kind ===
        "receive" &&
      !isReturnedFlow &&
      !isRepeatFlow &&
      receiveBound &&
      receiveProfileId
    );

  const activeReceiveProfileId =
    isReceiveFlow
      ? receiveProfileId
      : null;

  /*
   * Token ownership and customer-auth fallback.
   */
  const {
    historyAccessToken,
    repeatAccessToken
  } = useConnectFlowAccess({
    entry,
    isHistoryPage,
    repeatSourcePayoutIntentId
  });

  /*
   * Connect navigation belongs to an established
   * wallet / returned payout context.
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
      [
        setDebug
      ]
    );

  /*
   * Wallet-backed Connect session.
   */
  const {
    connectSessionId,
    resetConnectSession
  } = useConnectSession({
    isConnected,
    address,
    writeDebug
  });

  /*
   * Authoritative payout-attempt lifecycle.
   *
   * This is initialized before route reconciliation
   * so an invalid restored route can cleanly detach
   * from its old payout attempt.
   */
  const {
    payoutAttemptState,
    settlementCreationStatus,

    refreshPayoutAttempt,
    resetPayoutAttemptLifecycle
  } = usePayoutAttemptLifecycle({
    payoutIntentId,
    payoutIntentIdStateRef,

    returnedPayoutIntentId:
      entry
        ?.returnedPayoutIntentId ||
      null,

    setPayoutIntentId,
    setSettlement,
    setFundingTxHash,
    setReturnedFlowDismissed
  });

  /*
   * Local work locks immediately.
   *
   * Core lifecycle remains authoritative after local
   * work settles.
   */
  const isTransferLocked =
    isBusy ||
    payoutAttemptState !==
      PAYOUT_ATTEMPT_STATE
        .EDITABLE;

  /*
   * Successful Core discovery may prove that an
   * initial Standard / Repeat route saved by the
   * browser is no longer selectable.
   *
   * That is an entry reconciliation event, not a
   * normal user route change.
   *
   * Returned and Receive remain owned by their own
   * authoritative hydration / binding flows.
   */
  const handleInitialRouteFallback =
    useCallback(
      fallbackRoute => {
        if (
          entry?.kind ===
            "returned" ||
          entry?.kind ===
            "receive"
        ) {
          return;
        }

        payoutIntentIdStateRef.current =
          null;

        setPayoutIntentId(
          null
        );

        resetPayoutAttemptLifecycle();

        setRepeatSourcePayoutIntentId(
          null
        );

        repeatInitializedRef.current =
          false;

        setSettlement(
          null
        );

        setFundingTxHash(
          null
        );

        setForm(
          buildEmptyForm(
            fallbackRoute
          )
        );

        clearStoredFlow();

        removeQueryParams([
          "payout_intent_id",
          "repeat_source_payout_intent_id",
          "route_id"
        ]);

        resetConnectSession();

        writeDebug(
          "Stored payout route is unavailable. A current route was selected.",
          {
            route_id:
              fallbackRoute?.id ||
              fallbackRoute
                ?.route_id ||
              null
          }
        );
      },
      [
        entry,
        payoutIntentIdStateRef,
        repeatInitializedRef,
        resetConnectSession,
        resetPayoutAttemptLifecycle,
        setFundingTxHash,
        setForm,
        setPayoutIntentId,
        setRepeatSourcePayoutIntentId,
        setSettlement,
        writeDebug
      ]
    );

  /*
   * Core route discovery owns the route catalog and
   * selected route.
   *
   * Receive matching remains isolated inside the
   * Receive route policy.
   */
  const {
    routes,
    selectedRouteId,
    setSelectedRouteId,
    selectedRoute
  } = useConnectRoutes({
    initialSelectedRouteId:
      entry
        ?.initialSelectedRouteId,

    onInitialRouteFallback:
      handleInitialRouteFallback,

    receiveBound:
      isReceiveFlow,

    receiveDestinationCountry,
    receivePayoutRail
  });

  /*
   * Receive-specific form ownership.
   */
  useReceivePayoutForm({
    enabled:
      isReceiveFlow,

    receiveProfileId:
      activeReceiveProfileId,

    selectedRoute,
    setForm
  });

  /*
   * Repeat hydration from Core.
   *
   * Use the effective runtime repeat source so
   * locally restored repeat flows also hydrate.
   */
  useRepeatPayoutFlow({
    repeatInitializedRef,

    repeatSourceFromUrl:
      repeatSourcePayoutIntentId,

    repeatRouteIdFromUrl,
    repeatAccessToken,

    routes,
    setSelectedRouteId,

    setRepeatSourcePayoutIntentId,

    payoutIntentIdStateRef,
    setPayoutIntentId,

    resetPayoutAttemptLifecycle,

    setSettlement,
    setFundingTxHash,
    setForm,
    setIsBusy,

    writeDebug
  });

  /*
   * Returned KYC / authorization hydration.
   */
  useReturnedPayoutIntent({
    returnedPayoutIntentId:
      isReturnedFlow
        ? entry
            ?.returnedPayoutIntentId
        : null,

    routes,
    setSelectedRouteId,
    setPayoutIntentId,
    setForm,
    setIsBusy,
    writeDebug
  });

  /*
   * Editable Standard / Receive pricing preview.
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
      form.asset,

    receiveProfileId:
      activeReceiveProfileId
  });

  /*
   * Route execution owns authorization, settlement,
   * funding and polling.
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

    receiveProfileId:
      activeReceiveProfileId,

    writeDebug
  });

  /*
   * Analytics observes product flows without owning
   * them.
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
   * PWA lifecycle.
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
   * User commands are isolated from App.
   */
  const {
    handleNewPayout,
    setEditableForm,
    updateBeneficiaryField,
    changeRoute
  } = useConnectPayoutActions({
    isReceiveFlow,
    isRepeatFlow,
    isTransferLocked,

    payoutAttemptState,
    payoutIntentId,

    connectSessionId,

    routes,
    selectedRouteId,
    setSelectedRouteId,

    form,
    setForm,

    payoutIntentIdStateRef,
    repeatInitializedRef,

    setPayoutIntentId,
    setRepeatSourcePayoutIntentId,
    setReturnedFlowDismissed,

    setSettlement,
    setFundingTxHash,

    clearReceiveContext,

    resetRouteFlowRuntime,
    resetPayoutAttemptLifecycle,
    resetPricingPreview,
    resetRouteCreatedTracking,
    resetConnectSession,

    writeDebug
  });

  /*
   * Analytics wrapper around user-driven execution.
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
   * History remains behind the same usable-session
   * boundary as Connect navigation.
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
          href="/pay"
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

            receiveBound={
              isReceiveFlow
            }
            receiveProfileId={
              activeReceiveProfileId
            }
            receiveDestinationCountry={
              isReceiveFlow
                ? receiveDestinationCountry
                : null
            }
            receivePayoutRail={
              isReceiveFlow
                ? receivePayoutRail
                : null
            }
            receiveRecipient={
              isReceiveFlow
                ? receiveRecipient
                : null
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
