
/* fiat/bank-transfer/js/exthandBankSelector.js */

import {
  startExthandBankPayment,
  refreshExthandBankPayment
} from "./api.js";

import {
  createDestinationSelect
} from "../../../shared/pay/destination/selectRenderer.js";

const ATTEMPT_PREFIX = "ub_exthand_attempt:";

const SEPA_COUNTRIES = {
  AT: "Austria",
  BE: "Belgium",
  BG: "Bulgaria",
  HR: "Croatia",
  CY: "Cyprus",
  CZ: "Czechia",
  DK: "Denmark",
  EE: "Estonia",
  FI: "Finland",
  FR: "France",
  DE: "Germany",
  GR: "Greece",
  HU: "Hungary",
  IE: "Ireland",
  IT: "Italy",
  LV: "Latvia",
  LT: "Lithuania",
  LU: "Luxembourg",
  MT: "Malta",
  NL: "Netherlands",
  PL: "Poland",
  PT: "Portugal",
  RO: "Romania",
  SK: "Slovakia",
  SI: "Slovenia",
  ES: "Spain",
  SE: "Sweden",
  GB: "United Kingdom",
  CH: "Switzerland",
  NO: "Norway",
  IS: "Iceland",
  LI: "Liechtenstein"
};

const str = value => String(value ?? "").trim();
const lower = value => str(value).toLowerCase();
const upper = value => str(value).toUpperCase();

function resolveInstructions(funding) {
  return [
    funding?.source_deposit_instructions,
    funding?.next_action?.instructions,
    funding?.deposit_instructions,
    funding?.bank_instructions,
    funding?.instructions
  ].find(value =>
    value &&
    typeof value === "object" &&
    !Array.isArray(value)
  ) || null;
}

function resolveEligibility(funding) {
  const provider = lower(
    funding?.provider ||
    funding?.next_action?.provider
  );

  if (
    provider !== "bridge" ||
    (
      funding?.sender_id &&
      lower(funding.sender_id) !== "bridge_bank_transfer"
    ) ||
    !str(funding?.bridge_transfer_id)
  ) {
    return null;
  }

  const instructions = resolveInstructions(funding);
  if (!instructions) return null;

  const rail = lower(
    funding.source_rail ||
    funding.next_action?.source_rail ||
    instructions.source_rail ||
    instructions.payment_rail
  );

  const currency = upper(
    funding.source_currency ||
    funding.next_action?.source_currency ||
    instructions.currency ||
    instructions.source_currency
  );

  if (rail === "sepa") {
    if (
      currency !== "EUR" ||
      !str(instructions.iban)
    ) {
      return null;
    }
  } else if (rail === "faster_payments") {
    if (
      currency !== "GBP" ||
      !str(
        instructions.bank_account_number ||
        instructions.account_number ||
        instructions.bacs?.account
      ) ||
      !str(
        instructions.sort_code ||
        instructions.bacs?.sort_code
      )
    ) {
      return null;
    }
  } else {
    return null;
  }

  return { rail };
}

function normalizeBanks(response) {
  const items = Array.isArray(response)
    ? response
    : Array.isArray(response?.banks)
      ? response.banks
      : Array.isArray(response?.data?.banks)
        ? response.data.banks
        : Array.isArray(response?.data)
          ? response.data
          : [];

  const seen = new Set();

  return items.map(item => ({
    id: Number(
      item?.connectorId ??
      item?.connectorID ??
      item?.connector_id ??
      item?.id
    ),
    name: str(
      item?.fullname ||
      item?.name ||
      item?.bankName ||
      item?.bank_name ||
      item?.displayName
    )
  })).filter(item => {
    if (
      !Number.isSafeInteger(item.id) ||
      item.id <= 0 ||
      !item.name ||
      seen.has(item.id)
    ) {
      return false;
    }

    seen.add(item.id);
    return true;
  }).sort((a, b) => a.name.localeCompare(b.name));
}

function safeUrl(value) {
  try {
    const url = new URL(str(value));

    return url.protocol === "https:"
      ? url.href
      : null;
  } catch {
    return null;
  }
}

function isTerminalFlow(flow = {}) {
  return (
    flow.payment?.terminal === true ||
    flow.flow_state === "done" ||
    flow.flow_state === "error" ||
    flow.payment?.state === "failed"
  );
}

function paymentMessage(result) {
  const flow = result?.flow || {};
  const payment = flow.payment || {};

  if (payment.state === "accepted") {
    return (
      "Bank payment accepted. Waiting for Bridge " +
      "to confirm receipt of funds."
    );
  }

  if (
    payment.state === "failed" ||
    flow.flow_state === "error"
  ) {
    return (
      "The bank payment did not complete. " +
      "Check its status before taking further action."
    );
  }

  if (flow.flow_state === "decoupled") {
    return (
      "Approve the payment in your banking app, " +
      "then check its status."
    );
  }

  if (flow.flow_state === "unsupported_interaction") {
    return (
      "This bank requires an unsupported interaction. " +
      "Do not initiate another payment."
    );
  }

  if (result?.started === false) {
    return (
      "A previous bank payment attempt exists. " +
      "Check its status before taking further action."
    );
  }

  return (
    "Bank payment is pending or its outcome is " +
    "not yet confirmed. Check payment status."
  );
}

function createSelector(field, options) {
  return createDestinationSelect({
    field,
    options,
    applyCommonAttributes(select) {
      select.name = field.name;
    }
  });
}

function closeSelector(selector) {
  if (!selector?.element.classList.contains("is-open")) {
    return;
  }

  selector.element
    .querySelector(".destination-select-trigger")
    ?.click();
}

function setSelectorDisabled(selector, disabled) {
  if (!selector) return;

  selector.input.disabled = disabled;

  const trigger = selector.element.querySelector(
    ".destination-select-trigger"
  );

  if (disabled) {
    closeSelector(selector);
  }

  if (trigger) {
    trigger.disabled = disabled;
  }
}

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
    throw new Error("exthand_selector_context_missing");
  }

  let destroyed = false;
  let revision = 0;
  let cleanupSelectors = null;

  const attempted = new Set();
  const pendingStarts = new Set();

  function hasAttempt(settlementId) {
    if (attempted.has(settlementId)) {
      return true;
    }

    try {
      return window.localStorage.getItem(
        ATTEMPT_PREFIX + settlementId
      ) === "1";
    } catch {
      return false;
    }
  }

  function rememberAttempt(settlementId) {
    attempted.add(settlementId);

    try {
      window.localStorage.setItem(
        ATTEMPT_PREFIX + settlementId,
        "1"
      );
    } catch {
      // Keep the in-memory lock.
    }
  }

  function forgetAttempt(settlementId) {
    attempted.delete(settlementId);

    try {
      window.localStorage.removeItem(
        ATTEMPT_PREFIX + settlementId
      );
    } catch {
      // In-memory lock already cleared.
    }
  }

  function mount(funding) {
    if (cleanupSelectors) {
      cleanupSelectors();
      cleanupSelectors = null;
    }

    const current = ++revision;

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

    const settlementId = str(getSettlementId());
    if (!settlementId) return;

    const countries =
      eligibility.rail === "faster_payments"
        ? { GB: "United Kingdom" }
        : SEPA_COUNTRIES;

    let checking = false;
    let paymentAbsent = false;
    let requestSequence = 0;

    const isCurrent = () =>
      !destroyed &&
      current === revision &&
      instructionsBox.querySelector(
        "[data-exthand-mount]"
      ) === element;

    element.innerHTML = `
      <h4>Pay directly from your bank</h4>

      <p>
        Choose your bank and authorize your
        payment securely.
      </p>

      <div class="destination-field">
        <label class="destination-field-label">
          Bank country
        </label>
        <div data-bank-country-slot></div>
      </div>

      <div class="destination-field">
        <label class="destination-field-label">
          Your bank
        </label>
        <div data-bank-select-slot></div>
      </div>

      <button type="button" data-bank-pay disabled>
        Continue to bank
      </button>

      <button type="button" data-bank-refresh>
        Check payment status
      </button>

      <p data-bank-message role="status"
        aria-live="polite"></p>

      <div data-bank-next></div>

      <p>
        You can also use the manual transfer
        instructions above. Do not pay twice.
      </p>
    `;

    const find = selector =>
      element.querySelector(selector);

    const countrySlot = find(
      "[data-bank-country-slot]"
    );

    const bankSlot = find(
      "[data-bank-select-slot]"
    );

    const pay = find("[data-bank-pay]");
    const refresh = find("[data-bank-refresh]");
    const message = find("[data-bank-message]");
    const next = find("[data-bank-next]");

    const countrySelector = createSelector(
      {
        name: "exthand_bank_country",
        label: "Bank country",
        placeholder: "Select country",
        searchable: false
      },
      Object.entries(countries).map(
        ([code, name]) => ({
          value: code,
          label: name
        })
      )
    );

    countrySlot.append(countrySelector.element);

    let bankSelector = null;
    let availableBankCount = 0;

    function replaceBankSelector(banks = []) {
      closeSelector(bankSelector);

      availableBankCount = banks.length;

      const selector = createSelector(
        {
          name: "exthand_bank",
          label: "Bank",
          placeholder: "Select bank",
          searchable: true
        },
        banks.map(item => ({
          value: String(item.id),
          label: item.name
        }))
      );

      bankSelector = selector;
      bankSlot.replaceChildren(selector.element);

      selector.input.addEventListener(
        "change",
        updatePayButton
      );

      setSelectorDisabled(
        selector,
        availableBankCount === 0
      );

      updatePayButton();
    }

    cleanupSelectors = () => {
      closeSelector(countrySelector);
      closeSelector(bankSelector);
    };

    const country = countrySelector.input;

    const getBank = () => bankSelector?.input;

    function setMessage(value) {
      if (isCurrent()) {
        message.textContent = value;
      }
    }

    function updatePayButton() {
      if (!isCurrent()) return;

      pay.disabled =
        checking ||
        pendingStarts.has(settlementId) ||
        !paymentAbsent ||
        hasAttempt(settlementId) ||
        !country.value ||
        !getBank()?.value;
    }

    function renderResult(result) {
      if (!isCurrent()) return;

      setMessage(paymentMessage(result));
      next.replaceChildren();

      const flow = result?.flow || {};

      if (isTerminalFlow(flow)) return;

      const action = flow.next_action;
      if (action?.type !== "redirect") return;

      const url = safeUrl(action.url);

      if (!url) {
        setMessage(
          "Invalid bank authorization link. " +
          "Do not retry payment."
        );
        return;
      }

      const link = document.createElement("a");
      link.href = url;
      link.textContent =
        "Open your bank to approve payment";
      link.rel = "noopener noreferrer";

      next.append(link);
    }

    /*
     * Backend is authoritative.
     * Unknown outcomes remain locked.
     */
    async function checkStatus() {
      if (
        checking ||
        pendingStarts.has(settlementId) ||
        !isCurrent()
      ) {
        return;
      }

      checking = true;
      paymentAbsent = false;

      refresh.disabled = true;
      updatePayButton();

      setMessage("Checking bank payment status…");

      try {
        const result =
          await refreshExthandBankPayment({
            settlement_id: settlementId
          });

        if (!isCurrent()) return;

        rememberAttempt(settlementId);
        renderResult(result);
      } catch (error) {
        if (!isCurrent()) return;

        if (
          error?.code ===
          "exthand_submission_missing"
        ) {
          paymentAbsent = true;

          setMessage(
            hasAttempt(settlementId)
              ? (
                  "A previous payment attempt could " +
                  "not be confirmed. Do not retry."
                )
              : "Select your bank to continue."
          );
        } else {
          setMessage(
            "Unable to verify payment status. " +
            "Bank payment remains disabled."
          );
        }
      } finally {
        checking = false;

        if (isCurrent()) {
          refresh.disabled = false;
          updatePayButton();
        }
      }
    }

    /*
     * A pre-initiation rejection alone does not
     * prove absence of an older payment attempt.
     *
     * Require both:
     * 1. Explicit safe-to-retry from /start.
     * 2. Fresh /refresh confirming no submission.
     *
     * Any unknown result keeps the attempt lock.
     */
    async function confirmSafePreInitiationFailure(error) {
      if (
        error?.body?.initiation_safe_to_retry !== true
      ) {
        return false;
      }

      try {
        await refreshExthandBankPayment({
          settlement_id: settlementId
        });

        // A stored submission exists.
        return false;
      } catch (refreshError) {
        return (
          refreshError?.code ===
          "exthand_submission_missing"
        );
      }
    }

    replaceBankSelector();

    country.addEventListener("change", async () => {
      const request = ++requestSequence;
      const countryCode = country.value;

      replaceBankSelector();

      if (!countryCode) return;

      setMessage("Loading banks…");

      try {
        const banks = normalizeBanks(
          await loadBanks({
            countryCode,
            rail: eligibility.rail
          })
        );

        if (
          !isCurrent() ||
          request !== requestSequence
        ) {
          return;
        }

        replaceBankSelector(banks);

        setMessage(
          banks.length
            ? "Select your bank to continue."
            : "No banks available for this country."
        );
      } catch {
        if (
          isCurrent() &&
          request === requestSequence
        ) {
          setMessage(
            "Bank list unavailable. " +
            "Manual transfer is still available."
          );
        }
      }
    });

    pay.addEventListener("click", async () => {
      const connectorId = Number(getBank()?.value);
      const bankCountry = country.value;

      /*
       * Capture the lock state BEFORE creating
       * this invocation's attempt.
       *
       * A pre-existing lock must never be
       * cleared by this handler.
       */
      const hadAttemptBeforeStart =
        hasAttempt(settlementId);

      if (
        !isCurrent() ||
        checking ||
        pendingStarts.has(settlementId) ||
        !paymentAbsent ||
        hadAttemptBeforeStart ||
        !Number.isSafeInteger(connectorId) ||
        connectorId <= 0 ||
        !Object.prototype.hasOwnProperty.call(
          countries,
          bankCountry
        )
      ) {
        return;
      }

      /*
       * This handler owns the new local lock.
       * Lock before the non-idempotent request.
       */
      const ownsCurrentAttempt =
        !hadAttemptBeforeStart;

      rememberAttempt(settlementId);
      pendingStarts.add(settlementId);

      paymentAbsent = false;

      pay.disabled = true;

      setSelectorDisabled(countrySelector, true);
      setSelectorDisabled(bankSelector, true);

      setMessage("Contacting your bank…");

      try {
        const result =
          await startExthandBankPayment({
            settlement_id: settlementId,
            connector_id: connectorId,
            bank_country: bankCountry
          });

        if (!isCurrent()) return;

        if (result?.started === false) {
          await refreshExistingPayment();
          return;
        }

        renderResult(result);
      } catch (error) {
        /*
         * Only an attempt created in this
         * handler can become eligible for
         * local lock release.
         */
        const safeToRetry =
          ownsCurrentAttempt &&
          await confirmSafePreInitiationFailure(
            error
          );

        if (!isCurrent()) return;

        if (safeToRetry) {
          /*
           * /start confirmed a pre-initiation
           * rejection, and /refresh found no
           * stored Exthand submission.
           *
           * Clear only this invocation's lock.
           */
          forgetAttempt(settlementId);

          paymentAbsent = true;

          setSelectorDisabled(
            countrySelector,
            false
          );

          setSelectorDisabled(
            bankSelector,
            availableBankCount === 0
          );

          setMessage(
            "Bank payment could not be started. " +
            "You may select another bank."
          );
        } else {
          setMessage(
            "Payment initiation could not be " +
            "confirmed. Do not retry. " +
            "Use Check payment status."
          );
        }
      } finally {
        pendingStarts.delete(settlementId);

        if (isCurrent()) {
          updatePayButton();
        }
      }
    });

    async function refreshExistingPayment() {
      try {
        const result =
          await refreshExthandBankPayment({
            settlement_id: settlementId
          });

        renderResult(result);
      } catch {
        setMessage(
          "A previous payment exists, but its " +
          "status is unavailable. Do not retry."
        );
      }
    }

    refresh.addEventListener("click", checkStatus);

    element.classList.remove("hidden");
    checkStatus();
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

    if (existing) mount(existing);
  }

  return {
    destroy() {
      destroyed = true;
      ++revision;

      if (cleanupSelectors) {
        cleanupSelectors();
        cleanupSelectors = null;
      }

      instructionsBox.removeEventListener(
        "unibridge:exthand:instructions-ready",
        onInstructionsReady
      );
    }
  };
}
