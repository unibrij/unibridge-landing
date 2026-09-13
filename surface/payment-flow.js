// unibridge-landing/surface/payment-flow.js

import {
  KYC_FLOW_OUTCOME
} from "/shared/pay/kyc/kycFlow.js";

import {
  runSurfaceKycFlow
} from "./js/kyc/surfaceKycFlow.js";

import {
  getFundingSelectedProvider
} from "./funding-context.js";

import {
  buildFundingReturnUrl,
  getSessionIdFromUrl,
  isFundingReturn,
  cleanupFundingReturnUrl
} from "./return-url.js";

import {
  persistSurfaceSettlement,
  getPersistedSurfaceSettlement
} from "./storage.js";


export function createPaymentFlow({
  state,
  elements,

  apiGet,
  apiPost,

  emit,
  setStatus,

  resetFlowState,
  resetUiToStart,
  resetStatusMemory,

  setCurrentFundingProvider,

  getActiveContinueButton,
  setContinueButtonMode,

  isPhilippinesDestination,
  buildDestinationPayload,
  buildKycPayload,
  getCoinsPhPicker,

  receiveBound = false,
  buildSettlementDestinationInput,

  handleSettlementStatus,
  normalizeNextAction,
  extractWidgetUrlFromFunding,
  isPostFundingSettlementStatus,

  quoteFlow
}) {
  const {
    continueBtn,
    signBtn
  } = elements;

  const {
    refreshAmountLimitUi,
    refreshLimitUi,
    syncRouteLimitContinueUi,
    assertCurrentRouteAmountAvailable,
    isCurrentRouteAmountAvailable,
    setAmountInputDisabled
  } = quoteFlow;


  /* =========================
     PERSISTENCE
  ========================= */

  function persistState(extra = {}) {
    const id =
      extra.id ||
      state.settlementId;

    if (!id) {
      return;
    }

    persistSurfaceSettlement({
      id,

      paymentStarted:
        extra.payment_started ??
        state.paymentStarted ??
        false
    });
  }


  function persistSettlement(id) {
    if (!id) {
      return;
    }

    state.settlementId =
      id;

    state.paymentStarted =
      false;

    persistState({
      id,
      payment_started:
        false
    });
  }


  function markPaymentStarted() {
    state.paymentStarted =
      true;

    persistState({
      payment_started:
        true
    });
  }


  /* =========================
     SETTLEMENT STATUS
  ========================= */

  async function refreshSettlementState() {
    if (!state.settlementId) {
      return null;
    }

    const status =
      await apiGet(
        "settlement/status",
        {
          settlement_id:
            state.settlementId
        }
      );

    setCurrentFundingProvider(
      getFundingSelectedProvider(
        status
      )
    );

    handleSettlementStatus({
      status,
      signBtn,

      continueBtn:
        getActiveContinueButton() ||
        continueBtn,

      emit,
      setStatus,

      clearState:
        resetFlowState
    });

    return status;
  }


  /* =========================
     SHARED KYC
  ========================= */

  async function awaitKycCompletion(
    result
  ) {
    if (!result?.completion) {
      return result;
    }

    if (
      result?.outcome ===
      KYC_FLOW_OUTCOME.CONFIRMATION_PENDING
    ) {
      setStatus(
        "Confirming your identity verification..."
      );
    }

    return result.completion;
  }


  async function requireSharedKyc() {
    let result =
      await runSurfaceKycFlow();

    result =
      await awaitKycCompletion(
        result
      );

    if (
      result?.outcome ===
      KYC_FLOW_OUTCOME.VERIFICATION_REQUIRED
    ) {
      result =
        await runSurfaceKycFlow();

      result =
        await awaitKycCompletion(
          result
        );
    }

    if (
      result?.outcome ===
      KYC_FLOW_OUTCOME.PASSED
    ) {
      return true;
    }

    if (
      result?.outcome ===
      KYC_FLOW_OUTCOME.CONFIRMATION_PENDING
    ) {
      setStatus(
        "Identity verification is still being processed. Tap Continue to check again."
      );

      return false;
    }

    if (
      result?.outcome ===
      KYC_FLOW_OUTCOME.VERIFICATION_CANCELLED
    ) {
      setStatus(
        "Identity verification was cancelled."
      );

      return false;
    }

    throw new Error(
      result?.outcome ||
      "kyc_not_completed"
    );
  }


  /* =========================
     FUNDING
  ========================= */

  async function loadFundingSession() {
    const funding =
      await apiPost(
        "funding/session",
        {
          settlement_id:
            state.settlementId
        }
      );

    const fundingProvider =
      getFundingSelectedProvider(
        funding
      );

    setCurrentFundingProvider(
      fundingProvider
    );

    state.currentNextAction =
      normalizeNextAction(
        funding?.next_action
      );

    state.pendingWidgetUrl =
      extractWidgetUrlFromFunding(
        funding
      );

    if (
      fundingProvider ===
        "transak" &&
      !state.currentNextAction &&
      !state.pendingWidgetUrl
    ) {
      const widget =
        await apiPost(
          "ramp/transak/widget",
          {
            settlement_id:
              state.settlementId
          }
        );

      state.pendingWidgetUrl =
        widget?.widget_url ||
        widget?.url ||
        null;

      if (
        !state.pendingWidgetUrl
      ) {
        throw new Error(
          "transak_missing_widget_url"
        );
      }
    }

    return funding;
  }


  function openRedirect(url) {
    if (!url) {
      throw new Error(
        "missing_redirect_url"
      );
    }

    state.pendingWidgetUrl =
      url;

    emit(
      "unibridge:quote"
    );

    emit(
      "unibridge:payment"
    );

    markPaymentStarted();

    setAmountInputDisabled(
      true
    );

    window.location.href =
      url;
  }


  async function processStepAction(
    action,
    activeContinueBtn
  ) {
    const isEmbeddedPayment =
      action?.step ===
      "mount_embedded_onramp";

    await window.UnibridgeRampFlow
      .processStepNextActions({
        emit,
        buildKycPayload,
        setStatus,

        setContinueDisabled(value) {
          if (activeContinueBtn) {
            activeContinueBtn.disabled =
              Boolean(value);
          }
        },

        setContinueMode(mode) {
          setContinueButtonMode(
            mode
          );
        },

        getSettlementId() {
          return state.settlementId;
        },

        getCurrentNextAction() {
          return state.currentNextAction;
        },

        setCurrentNextAction(value) {
          state.currentNextAction =
            value;
        },

        getPendingWidgetUrl() {
          return state.pendingWidgetUrl;
        },

        setPendingWidgetUrl(value) {
          state.pendingWidgetUrl =
            value ||
            null;

          if (
            state.pendingWidgetUrl
          ) {
            setContinueButtonMode(
              "open_payment"
            );
          }
        },

        getNextActionProcessing() {
          return state.nextActionProcessing;
        },

        setNextActionProcessing(value) {
          state.nextActionProcessing =
            Boolean(value);
        }
      });

    if (isEmbeddedPayment) {
      markPaymentStarted();

      setAmountInputDisabled(
        true
      );
    }
  }


  /* =========================
     CONTINUE
  ========================= */

  async function continueFlow() {
    if (state.processing) {
      return;
    }

    const activeContinueBtn =
      getActiveContinueButton() ||
      continueBtn;

    try {
      /*
      --------------------------------------------------
      Amount / route validation only matters before a
      settlement exists.

      Once the settlement has been created, its amount
      and route are already canonical server-side.
      This also allows a pre-funding settlement to
      resume safely after a page reload.
      --------------------------------------------------
      */

      if (
        !state.settlementId &&
        !state.pendingWidgetUrl
      ) {
        const limitCheck =
          refreshAmountLimitUi();

        if (
          limitCheck &&
          !limitCheck.ok
        ) {
          throw new Error(
            limitCheck.message
          );
        }

        assertCurrentRouteAmountAvailable();
      }

      if (
        state.pendingWidgetUrl
      ) {
        openRedirect(
          state.pendingWidgetUrl
        );

        return;
      }

      state.processing =
        true;

      if (activeContinueBtn) {
        activeContinueBtn.disabled =
          true;
      }


      /* -------------------------
         Session recovery
      ------------------------- */

      if (!state.sessionId) {
        const sessionIdFromUrl =
          getSessionIdFromUrl();

        if (sessionIdFromUrl) {
          state.sessionId =
            sessionIdFromUrl;
        }
      }


      /* -------------------------
         Settlement creation
      ------------------------- */

      if (!state.settlementId) {
        if (
          !state.sessionId ||
          !state.routeId
        ) {
          throw new Error(
            "missing_session_or_route"
          );
        }

        assertCurrentRouteAmountAvailable();

        if (
          typeof buildSettlementDestinationInput !==
          "function"
        ) {
          throw new Error(
            "settlement_destination_builder_missing"
          );
        }

        let destination;

        if (!receiveBound) {
          if (
            typeof buildDestinationPayload !==
            "function"
          ) {
            throw new Error(
              "destination_builder_missing"
            );
          }

          destination =
            buildDestinationPayload();
        }

        const destinationInput =
          buildSettlementDestinationInput({
            destination
          });

        const redirectUrl =
          buildFundingReturnUrl(
            state.sessionId
          );

        if (!redirectUrl) {
          throw new Error(
            "missing_redirect_url"
          );
        }

        const settlementCreateRoute =
          receiveBound
            ? "receive/settlement/create"
            : "settlement/create";

        const create =
          await apiPost(
            settlementCreateRoute,
            {
              session_id:
                state.sessionId,

              route_id:
                state.routeId,

              ...destinationInput,

              redirect_url:
                redirectUrl
            }
          );

        setCurrentFundingProvider(
          getFundingSelectedProvider(
            create
          )
        );

        persistSettlement(
          create.settlement_id
        );
      }


      /* -------------------------
         Settlement may already
         have progressed
      ------------------------- */

      const latestStatus =
        await refreshSettlementState();

      if (
        isPostFundingSettlementStatus(
          latestStatus?.status
        )
      ) {
        return;
      }


      /* -------------------------
         Shared KYC
      ------------------------- */

      if (!receiveBound) {
        const kycPassed =
          await requireSharedKyc();

        if (!kycPassed) {
          if (activeContinueBtn) {
            activeContinueBtn.disabled =
              false;
          }

          return;
        }
      }


      /* -------------------------
         Funding session
      ------------------------- */

      if (
        !state.currentNextAction &&
        !state.pendingWidgetUrl
      ) {
        await loadFundingSession();
      }

      const action =
        normalizeNextAction(
          state.currentNextAction
        );


      /* -------------------------
         Redirect
      ------------------------- */

      if (
        action?.type ===
        "redirect"
      ) {
        openRedirect(
          action.url ||
          state.pendingWidgetUrl
        );

        return;
      }


      /* -------------------------
         Await confirmation
      ------------------------- */

      if (
        action?.type ===
        "await_confirmation"
      ) {
        emit(
          "unibridge:quote"
        );

        emit(
          "unibridge:payment"
        );

        markPaymentStarted();

        setAmountInputDisabled(
          true
        );

        setStatus(
          action.label ||
          "Waiting for payment confirmation..."
        );

        if (activeContinueBtn) {
          activeContinueBtn.disabled =
            false;
        }

        return;
      }


      /* -------------------------
         Provider / legacy step
      ------------------------- */

      if (
        action?.type ===
        "step"
      ) {
        await processStepAction(
          action,
          activeContinueBtn
        );

        return;
      }


      /* -------------------------
         Legacy widget URL
      ------------------------- */

      if (
        state.pendingWidgetUrl
      ) {
        openRedirect(
          state.pendingWidgetUrl
        );

        return;
      }

      throw new Error(
        "no_funding_flow"
      );
    }
    catch (error) {
      setStatus(
        error,
        "error"
      );

      const limitCheck =
        refreshLimitUi();

      const canContinue =
        Boolean(
          state.settlementId ||
          (
            limitCheck?.ok &&
            state.sessionId &&
            state.routeId &&
            isCurrentRouteAmountAvailable()
          )
        );

      if (activeContinueBtn) {
        if (
          canContinue &&
          !receiveBound &&
          isPhilippinesDestination() &&
          !state.settlementId
        ) {
          getCoinsPhPicker()
            ?.updateContinueState();

          syncRouteLimitContinueUi();
        }
        else {
          activeContinueBtn.disabled =
            !canContinue;
        }
      }
    }
    finally {
      state.processing =
        false;

      syncRouteLimitContinueUi();
    }
  }


  /* =========================
     RESUME
  ========================= */

  async function resumeFlowFromState({
    allowPaymentResume = false
  } = {}) {
    if (
      !state.settlementId ||
      state.processing
    ) {
      return;
    }

    try {
      const status =
        await apiGet(
          "settlement/status",
          {
            settlement_id:
              state.settlementId
          }
        );

      setCurrentFundingProvider(
        getFundingSelectedProvider(
          status
        )
      );

      const activeContinueBtn =
        getActiveContinueButton() ||
        continueBtn;

      if (
        status?.status ===
        "waiting_ramp_payment"
      ) {
        setAmountInputDisabled(
          true
        );

        if (!allowPaymentResume) {
          return;
        }

        state.currentNextAction =
          null;

        state.pendingWidgetUrl =
          null;

        setContinueButtonMode(
          "prepare_payment"
        );

        if (activeContinueBtn) {
          activeContinueBtn.disabled =
            false;
        }

        setStatus(
          "Payment is still pending. Tap Continue to resume payment."
        );

        return;
      }

      setAmountInputDisabled(
        true
      );

      emit(
        "unibridge:quote"
      );

      handleSettlementStatus({
        status,
        signBtn,

        continueBtn:
          activeContinueBtn,

        emit,
        setStatus,

        clearState:
          resetFlowState
      });
    }
    catch (error) {
      setStatus(
        error,
        "error"
      );
    }
  }


  /* =========================
     INITIAL LOAD
  ========================= */

  async function handleInitialLoad() {
    const sessionIdFromUrl =
      getSessionIdFromUrl();

    const fundingReturn =
      isFundingReturn();

    if (
      sessionIdFromUrl &&
      fundingReturn
    ) {
      cleanupFundingReturnUrl();

      resetFlowState();
      resetUiToStart();
      resetStatusMemory();

      setStatus(
        ""
      );

      refreshLimitUi();

      return;
    }

    if (sessionIdFromUrl) {
      state.sessionId =
        sessionIdFromUrl;
    }

    const saved =
      getPersistedSurfaceSettlement();

    if (!saved) {
      resetFlowState();
      resetUiToStart();

      refreshLimitUi();

      return;
    }

    state.settlementId =
      saved.id;

    state.paymentStarted =
      Boolean(
        saved.payment_started
      );


    /*
    --------------------------------------------------
    Pre-funding settlement recovery

    The settlement may already exist while KYC is still
    incomplete. Do not discard it just because funding
    has not started yet.

    Continue will re-check the settlement, resume Shared
    KYC if needed, then proceed to funding.
    --------------------------------------------------
    */

    if (!state.paymentStarted) {
      state.currentNextAction =
        null;

      state.pendingWidgetUrl =
        null;

      setAmountInputDisabled(
        true
      );

      emit(
        "unibridge:quote"
      );

      setContinueButtonMode(
        "prepare_payment"
      );

      const activeContinueBtn =
        getActiveContinueButton() ||
        continueBtn;

      if (activeContinueBtn) {
        activeContinueBtn.disabled =
          false;
      }

      setStatus(
        "Payment setup is not finished. Tap Continue to resume."
      );

      return;
    }

    await resumeFlowFromState({
      allowPaymentResume:
        true
    });
  }


  /* =========================
     LIFECYCLE EVENTS
  ========================= */

  function bindLifecycleEvents() {
    window.addEventListener(
      "load",
      handleInitialLoad
    );

    window.addEventListener(
      "focus",
      async () => {
        if (
          !state.settlementId ||
          !state.paymentStarted
        ) {
          return;
        }

        await resumeFlowFromState();
      }
    );

    document.addEventListener(
      "visibilitychange",
      async () => {
        if (
          document.visibilityState !==
            "visible" ||
          !state.settlementId ||
          !state.paymentStarted
        ) {
          return;
        }

        await resumeFlowFromState();
      }
    );
  }


  return {
    continueFlow,
    refreshSettlementState,
    resumeFlowFromState,
    bindLifecycleEvents
  };
}
