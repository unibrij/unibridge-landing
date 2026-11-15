// fiat/bank-transfer/js/exthandBankSelector.js

import {
  startExthandBankPayment,
  refreshExthandBankPayment
} from "./api.js";

import {
  resolveEligibility,
  getEligibleBankCountries
} from "./eligibility.js";

import {
  validConnectorId,
  isDiscovery,
  discoveryReady,
  needsSelection,
  safeToRetry
} from "./paymentRules.js";

import {
  createBankSelectorView,
  normalizeBanks
} from "./bankSelectorView.js";

const ATTEMPT_PREFIX = "ub_exthand_attempt:";

const str = value =>
  String(value ?? "").trim();

const upper = value =>
  str(value).toUpperCase();

export function createExthandBankSelector({
  instructionsBox,
  getSettlementId,
  getFunding,
  loadBanks
} = {}) {
  if (
    !instructionsBox ||
    typeof getSettlementId !== "function"
  ) {
    throw new Error(
      "exthand_selector_context_missing"
    );
  }

  let destroyed = false;
  let revision = 0;
  let cleanupSelectors = null;
  let currentStatusCheck = null;

  const attempted = new Set();
  const pendingStarts = new Set();

  function hasAttempt(id) {
    if (attempted.has(id)) return true;

    try {
      return window.localStorage.getItem(
        ATTEMPT_PREFIX + id
      ) === "1";
    } catch {
      return false;
    }
  }

  function rememberAttempt(id) {
    attempted.add(id);

    try {
      window.localStorage.setItem(
        ATTEMPT_PREFIX + id,
        "1"
      );
    } catch {
      // In-memory protection remains active.
    }
  }

  function forgetAttempt(id) {
    attempted.delete(id);

    try {
      window.localStorage.removeItem(
        ATTEMPT_PREFIX + id
      );
    } catch {
      // Backend remains authoritative.
    }
  }

  function mount(funding) {
    const current = ++revision;

    if (cleanupSelectors) {
      cleanupSelectors();
    }

    cleanupSelectors = null;
    currentStatusCheck = null;

    const element = instructionsBox.querySelector(
      "[data-exthand-mount]"
    );

    const eligibility = resolveEligibility(funding);

    if (
      !element ||
      !eligibility ||
      typeof loadBanks !== "function"
    ) {
      return;
    }

    const id = str(getSettlementId());

    if (!id) return;

    const countries = getEligibleBankCountries(
      eligibility.rail
    );

    let checking = false;
    let paymentAbsent = false;
    let ready = false;
    let selectionRequired = false;
    let activeDiscovery = null;

    let requestSequence = 0;
    let bankLoading = false;
    let deferredCheck = false;

    const isCurrent = () =>
      !destroyed &&
      current === revision &&
      str(getSettlementId()) === id &&
      instructionsBox.querySelector(
        "[data-exthand-mount]"
      ) === element;

    const busy = () =>
      checking || pendingStarts.has(id);

    const canStartNew = () =>
      paymentAbsent && !hasAttempt(id);

    function canContinueDiscovery() {
      if (
        !ready ||
        selectionRequired ||
        !activeDiscovery
      ) {
        return false;
      }

      const connectorId = validConnectorId(
        activeDiscovery.connector_id
      );

      const bankCountry = upper(
        activeDiscovery.bank_country
      );

      return (
        connectorId !== null &&
        Object.prototype.hasOwnProperty.call(
          countries,
          bankCountry
        )
      );
    }

    const view = createBankSelectorView({
      element,
      countries,
      isCurrent,
      onBankChange: updatePayButton
    });

    const {
      country,
      pay,
      refresh
    } = view;

    const setMessage = value =>
      view.setMessage(value);

    function updatePayButton() {
      if (!isCurrent()) return;

      const newAllowed =
        canStartNew() &&
        !bankLoading &&
        Object.prototype.hasOwnProperty.call(
          countries,
          upper(country.value)
        ) &&
        view.selectedBankValid();

      const continuing = canContinueDiscovery();

      view.setPayButton({
        disabled:
          busy() ||
          !(newAllowed || continuing),
        continuing
      });
    }

    function syncSelectors() {
      if (!isCurrent()) return;

      view.setSelectorsDisabled(
        busy() ||
        !canStartNew() ||
        bankLoading
      );

      updatePayButton();
    }

    function invalidateBankRequests() {
      ++requestSequence;
      bankLoading = false;
    }

    function clearPaymentPermission() {
      paymentAbsent = false;
      ready = false;
      selectionRequired = false;
      activeDiscovery = null;
    }

    function applyStatus(result) {
      if (!isCurrent()) return;

      clearPaymentPermission();

      if (safeToRetry(result)) {
        // A confirmed retry is applied only after
        // any pending local start has finished.
        if (!pendingStarts.has(id)) {
          forgetAttempt(id);
          paymentAbsent = true;
        }
      } else if (isDiscovery(result)) {
        rememberAttempt(id);

        const discovery =
          result?.account_discovery ||
          result?.discovery ||
          {};

        activeDiscovery = {
          connector_id:
            result?.connector_id ??
            discovery?.connector_id,
          bank_country:
            result?.bank_country ??
            discovery?.bank_country
        };

        ready = discoveryReady(result);
        selectionRequired = needsSelection(result);
      } else {
        // Unknown and payment states stay locked.
        rememberAttempt(id);
      }

      view.renderResult(result);

      if (
        result?.outcome === "payment_not_started" &&
        !paymentAbsent
      ) {
        setMessage(
          "Payment status is not yet confirmed. Do not retry automatically."
        );
      }

      syncSelectors();
    }

    async function checkStatus() {
      if (!isCurrent()) return;

      if (busy()) {
        deferredCheck = true;
        return;
      }

      deferredCheck = false;
      checking = true;

      clearPaymentPermission();

      refresh.disabled = true;
      syncSelectors();

      setMessage(
        "Checking bank payment status…"
      );

      try {
        const result =
          await refreshExthandBankPayment({
            settlement_id: id
          });

        if (isCurrent()) {
          applyStatus(result);
        }
      } catch {
        if (isCurrent()) {
          setMessage(
            "Unable to verify payment status. Bank payment remains disabled."
          );
        }
      } finally {
        checking = false;

        if (isCurrent()) {
          refresh.disabled = false;
          syncSelectors();

          if (deferredCheck) {
            void checkStatus();
          }
        }
      }
    }

    currentStatusCheck = {
      id,
      run: checkStatus
    };

    async function confirmSafeFailure(error) {
      if (
        error?.body?.initiation_safe_to_retry !== true
      ) {
        return null;
      }

      try {
        const result =
          await refreshExthandBankPayment({
            settlement_id: id
          });

        return isCurrent() && safeToRetry(result)
          ? result
          : null;
      } catch {
        return null;
      }
    }

    async function loadCountryBanks() {
      if (!isCurrent()) return;

      const request = ++requestSequence;
      const countryCode = upper(country.value);

      bankLoading = Boolean(countryCode);

      view.replaceBankSelector();
      syncSelectors();

      if (!countryCode) return;

      if (canStartNew() && !busy()) {
        setMessage("Loading banks…");
      }

      try {
        const response = await loadBanks({
          countryCode,
          rail: eligibility.rail
        });

        if (
          !isCurrent() ||
          request !== requestSequence ||
          upper(country.value) !== countryCode
        ) {
          return;
        }

        const banks = normalizeBanks(response);

        bankLoading = false;

        view.replaceBankSelector(banks);
        syncSelectors();

        if (canStartNew() && !busy()) {
          setMessage(
            banks.length
              ? "Select your bank to continue."
              : "No banks available for this country."
          );
        }
      } catch {
        if (
          !isCurrent() ||
          request !== requestSequence
        ) {
          return;
        }

        bankLoading = false;
        syncSelectors();

        if (canStartNew() && !busy()) {
          setMessage(
            "Bank list unavailable. Manual transfer is still available."
          );
        }
      }
    }

    async function startPayment() {
      if (!isCurrent()) return;

      const continuing = canContinueDiscovery();

      const connectorId = continuing
        ? validConnectorId(
            activeDiscovery.connector_id
          )
        : view.selectedBankId();

      const bankCountry = continuing
        ? upper(activeDiscovery.bank_country)
        : upper(country.value);

      if (
        busy() ||
        (
          !continuing &&
          (
            !canStartNew() ||
            bankLoading ||
            !view.selectedBankValid()
          )
        ) ||
        connectorId === null ||
        !Object.prototype.hasOwnProperty.call(
          countries,
          bankCountry
        )
      ) {
        return;
      }

      const ownsAttempt =
        !continuing && !hasAttempt(id);

      rememberAttempt(id);
      pendingStarts.add(id);

      invalidateBankRequests();
      clearPaymentPermission();
      syncSelectors();

      setMessage(
        continuing
          ? "Continuing bank payment…"
          : "Contacting your bank…"
      );

      let resultToApply = null;
      let failureMessage = null;

      try {
        const result =
          await startExthandBankPayment({
            settlement_id: id,
            connector_id: connectorId,
            bank_country: bankCountry
          });

        if (result?.started === false) {
          // An existing attempt must be checked,
          // never started again automatically.
          resultToApply =
            await refreshExthandBankPayment({
              settlement_id: id
            });
        } else {
          resultToApply = result;
        }
      } catch (error) {
        const safeResult = ownsAttempt
          ? await confirmSafeFailure(error)
          : null;

        if (safeResult) {
          resultToApply = safeResult;
          failureMessage =
            "Bank payment could not be started. You may select another bank.";
        } else {
          failureMessage =
            "Payment initiation could not be confirmed. Do not retry. Use Check payment status.";
        }
      } finally {
        pendingStarts.delete(id);

        if (isCurrent()) {
          if (resultToApply) {
            // The local lock is now released.
            // Apply the backend result exactly once.
            applyStatus(resultToApply);

            if (
              failureMessage &&
              safeToRetry(resultToApply)
            ) {
              setMessage(failureMessage);
            }
          } else {
            clearPaymentPermission();
            syncSelectors();

            setMessage(
              failureMessage ||
              "Payment status is unavailable. Check payment status before taking further action."
            );
          }

          if (deferredCheck) {
            void checkStatus();
          }
        } else if (
          currentStatusCheck?.id === id
        ) {
          void currentStatusCheck.run();
        }
      }
    }

    view.replaceBankSelector();
    syncSelectors();

    country.addEventListener(
      "change",
      loadCountryBanks
    );

    pay.addEventListener(
      "click",
      startPayment
    );

    refresh.addEventListener(
      "click",
      checkStatus
    );

    cleanupSelectors = () => {
      country.removeEventListener(
        "change",
        loadCountryBanks
      );

      pay.removeEventListener(
        "click",
        startPayment
      );

      refresh.removeEventListener(
        "click",
        checkStatus
      );

      invalidateBankRequests();
      view.destroy();
    };

    element.classList.remove("hidden");

    void checkStatus();
  }

  function onInstructionsReady(event) {
    mount(event.detail?.funding);
  }

  instructionsBox.addEventListener(
    "unibridge:exthand:instructions-ready",
    onInstructionsReady
  );

  if (typeof getFunding === "function") {
    const existing = getFunding();

    if (existing) {
      mount(existing);
    }
  }

  return {
    destroy() {
      if (destroyed) return;

      destroyed = true;
      ++revision;
      currentStatusCheck = null;

      if (cleanupSelectors) {
        cleanupSelectors();
      }

      cleanupSelectors = null;

      instructionsBox.removeEventListener(
        "unibridge:exthand:instructions-ready",
        onInstructionsReady
      );
    }
  };
}
