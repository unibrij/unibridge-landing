// fiat/bank-transfer/js/exthandBankSelector.js

import { startExthandBankPayment, refreshExthandBankPayment } from "./api.js";
import { createDestinationSelect } from "../../../shared/pay/destination/selectRenderer.js";

const ATTEMPT_PREFIX = "ub_exthand_attempt:";
const SEPA_COUNTRIES = {
  AT:"Austria",BE:"Belgium",BG:"Bulgaria",HR:"Croatia",
  CY:"Cyprus",CZ:"Czechia",DK:"Denmark",EE:"Estonia",
  FI:"Finland",FR:"France",DE:"Germany",GR:"Greece",
  HU:"Hungary",IE:"Ireland",IT:"Italy",LV:"Latvia",
  LT:"Lithuania",LU:"Luxembourg",MT:"Malta",
  NL:"Netherlands",PL:"Poland",PT:"Portugal",
  RO:"Romania",SK:"Slovakia",SI:"Slovenia",
  ES:"Spain",SE:"Sweden",GB:"United Kingdom",
  CH:"Switzerland",NO:"Norway",IS:"Iceland",
  LI:"Liechtenstein"
};
const str = v => String(v ?? "").trim();
const lower = v => str(v).toLowerCase();
const upper = v => str(v).toUpperCase();

function resolveInstructions(f) {
  return [
    f?.source_deposit_instructions,
    f?.next_action?.instructions,
    f?.deposit_instructions,
    f?.bank_instructions,
    f?.instructions
  ].find(v => v && typeof v === "object" && !Array.isArray(v)) || null;
}

function resolveEligibility(f) {
  const provider = lower(f?.provider || f?.next_action?.provider);
  if (provider !== "bridge" ||
      (f?.sender_id && lower(f.sender_id) !== "bridge_bank_transfer") ||
      !str(f?.bridge_transfer_id)) return null;
  const i = resolveInstructions(f);
  if (!i) return null;
  const rail = lower(f.source_rail || f.next_action?.source_rail ||
    i.source_rail || i.payment_rail);
  const currency = upper(f.source_currency ||
    f.next_action?.source_currency || i.currency || i.source_currency);
  if (rail === "sepa" && currency === "EUR" && str(i.iban))
    return { rail };
  if (rail === "faster_payments" && currency === "GBP" &&
      str(i.bank_account_number || i.account_number || i.bacs?.account) &&
      str(i.sort_code || i.bacs?.sort_code)) return { rail };
  return null;
}

function normalizeBanks(response) {
  const items = Array.isArray(response) ? response :
    Array.isArray(response?.banks) ? response.banks :
    Array.isArray(response?.data?.banks) ? response.data.banks :
    Array.isArray(response?.data) ? response.data : [];
  const seen = new Set();
  return items.map(item => ({
    id: Number(item?.connectorId ?? item?.connectorID ??
      item?.connector_id ?? item?.id),
    name: str(item?.fullname || item?.name || item?.bankName ||
      item?.bank_name || item?.displayName)
  })).filter(item => {
    if (!Number.isSafeInteger(item.id) || item.id <= 0 ||
        !item.name || seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  }).sort((a,b) => a.name.localeCompare(b.name));
}

function safeUrl(value) {
  try {
    const u = new URL(str(value));
    return u.protocol === "https:" && !u.username && !u.password
      ? u.href : null;
  } catch { return null; }
}

function getDiscovery(r) {
  const d = r?.account_discovery || r?.discovery;
  return d && typeof d === "object" && !Array.isArray(d) ? d : null;
}
function discoveryStatus(r) {
  return str(getDiscovery(r)?.status || r?.discovery_status);
}
function isDiscovery(r) {
  return Boolean(discoveryStatus(r) || [
    "account_discovery_started","account_discovery_already_started",
    "account_discovery_status","account_discovery_already_completed",
    "account_discovery_updated"
  ].includes(r?.outcome));
}
function discoveryReady(r) {
  return discoveryStatus(r) === "accounts_ready" &&
    getDiscovery(r)?.account_ready === true;
}
function needsSelection(r) {
  return discoveryStatus(r) === "accounts_selection_required";
}
function safeToRetry(r) {
  const s = r?.connected_bank_submission;
  const cleanSubmission = s == null ||
    (typeof s === "object" && !Array.isArray(s) &&
      Object.keys(s).length === 0);
  return r?.outcome === "payment_not_started" &&
    r?.initiation_safe_to_retry === true &&
    !isDiscovery(r) && cleanSubmission;
}
function terminalFlow(f = {}) {
  return f.payment?.terminal === true ||
    ["done","error"].includes(f.flow_state) ||
    f.payment?.state === "failed";
}

function paymentMessage(r) {
  if (r?.outcome === "payment_not_started")
    return "Select your bank to continue.";
  if (needsSelection(r))
    return "Bank authorization completed. Account selection is required before continuing with payment.";
  if (discoveryReady(r))
    return "Bank account authorization completed. Continue to initiate your bank payment.";
  if (isDiscovery(r)) {
    const s = discoveryStatus(r);
    if (s === "redirect")
      return "Complete bank authorization, then check its status.";
    if (s === "decoupled")
      return "Approve access in your banking app, then check its status.";
    if (["initiation_unknown","finalization_unknown",
         "initiating","finalizing"].includes(s))
      return "Bank authorization outcome is not yet confirmed. Do not start another attempt.";
    if (["initiation_rejected","error"].includes(s))
      return "Bank authorization could not be completed. Check its status before taking further action.";
    if (s === "interaction_required")
      return "This bank requires an unsupported authorization interaction.";
    if (s === "retry")
      return "Bank authorization requires continuation. Check its status before taking further action.";
    return "Bank authorization is in progress. Check its status.";
  }
  const f = r?.flow || {}, p = f.payment || {};
  if (p.state === "accepted")
    return "Bank payment accepted. Waiting for Bridge to confirm receipt of funds.";
  if (p.state === "failed" || f.flow_state === "error")
    return "The bank payment did not complete. Check its status before taking further action.";
  if (f.flow_state === "decoupled")
    return "Approve the payment in your banking app, then check its status.";
  if (f.flow_state === "unsupported_interaction")
    return "This bank requires an unsupported interaction. Do not initiate another payment.";
  if (r?.started === false)
    return "A previous bank payment attempt exists. Check its status before taking further action.";
  return "Bank payment is pending or its outcome is not yet confirmed. Check payment status.";
}

function createSelector(field, options) {
  return createDestinationSelect({
    field, options,
    applyCommonAttributes(select) { select.name = field.name; }
  });
}
function closeSelector(s) {
  if (s?.element.classList.contains("is-open"))
    s.element.querySelector(".destination-select-trigger")?.click();
}
function disableSelector(s, disabled) {
  if (!s) return;
  s.input.disabled = disabled;
  if (disabled) closeSelector(s);
  const trigger = s.element.querySelector(".destination-select-trigger");
  if (trigger) trigger.disabled = disabled;
}

export function createExthandBankSelector({
  instructionsBox, getSettlementId, getFunding, loadBanks
} = {}) {
  if (!instructionsBox || typeof getSettlementId !== "function")
    throw new Error("exthand_selector_context_missing");

  let destroyed = false, revision = 0, cleanupSelectors = null;
  let currentStatusCheck = null;
  const attempted = new Set(), pendingStarts = new Set();

  function hasAttempt(id) {
    if (attempted.has(id)) return true;
    try { return window.localStorage.getItem(ATTEMPT_PREFIX + id) === "1"; }
    catch { return false; }
  }
  function rememberAttempt(id) {
    attempted.add(id);
    try { window.localStorage.setItem(ATTEMPT_PREFIX + id, "1"); }
    catch { /* In-memory lock remains. */ }
  }
  function forgetAttempt(id) {
    attempted.delete(id);
    try { window.localStorage.removeItem(ATTEMPT_PREFIX + id); }
    catch { /* Backend verification remains authoritative. */ }
  }

  function mount(funding) {
    if (cleanupSelectors) cleanupSelectors();
    cleanupSelectors = null;
    currentStatusCheck = null;
    const current = ++revision;
    const element = instructionsBox.querySelector("[data-exthand-mount]");
    const eligibility = resolveEligibility(funding);
    if (!element || !eligibility || typeof loadBanks !== "function") return;
    const id = str(getSettlementId());
    if (!id) return;

    const countries = eligibility.rail === "faster_payments"
      ? { GB: "United Kingdom" } : SEPA_COUNTRIES;
    let checking = false, paymentAbsent = false;
    let ready = false, selectionRequired = false, activeDiscovery = null;
    let requestSequence = 0, deferredCheck = false;
    const isCurrent = () => !destroyed && current === revision &&
      instructionsBox.querySelector("[data-exthand-mount]") === element;

    element.innerHTML = `
      <h4>Pay directly from your bank</h4>
      <p>Choose your bank and authorize your payment securely.</p>
      <div class="destination-field">
        <label class="destination-field-label">Bank country</label>
        <div data-bank-country-slot></div>
      </div>
      <div class="destination-field">
        <label class="destination-field-label">Your bank</label>
        <div data-bank-select-slot></div>
      </div>
      <button type="button" data-bank-pay disabled>Continue to bank</button>
      <button type="button" data-bank-refresh>Check payment status</button>
      <p data-bank-message role="status" aria-live="polite"></p>
      <div data-bank-next></div>
      <p>You can also use the manual transfer instructions above.
      Do not pay twice.</p>
    `;

    const find = s => element.querySelector(s);
    const countrySlot = find("[data-bank-country-slot]");
    const bankSlot = find("[data-bank-select-slot]");
    const pay = find("[data-bank-pay]");
    const refresh = find("[data-bank-refresh]");
    const message = find("[data-bank-message]");
    const next = find("[data-bank-next]");

    const countrySelector = createSelector({
      name:"exthand_bank_country", label:"Bank country",
      placeholder:"Select country", searchable:false
    }, Object.entries(countries).map(([code,name]) => ({
      value:code, label:name
    })));
    countrySlot.append(countrySelector.element);

    let bankSelector = null, availableBankCount = 0;
    const country = countrySelector.input;
    const getBank = () => bankSelector?.input;
    const busy = () => checking || pendingStarts.has(id);
    const canStartNew = () => paymentAbsent && !hasAttempt(id);
    const setMessage = value => {
      if (isCurrent()) message.textContent = value;
    };

    function canContinueDiscovery() {
      if (!ready || selectionRequired || !activeDiscovery) return false;
      const connectorId = Number(activeDiscovery.connector_id);
      const bankCountry = upper(activeDiscovery.bank_country);
      return Number.isSafeInteger(connectorId) && connectorId > 0 &&
        Object.prototype.hasOwnProperty.call(countries, bankCountry);
    }
    function updatePayButton() {
      if (!isCurrent()) return;
      const newAllowed = canStartNew() && Boolean(country.value) &&
        Boolean(getBank()?.value);
      const continuing = canContinueDiscovery();
      pay.disabled = busy() || !(newAllowed || continuing);
      pay.textContent = continuing
        ? "Continue bank payment" : "Continue to bank";
    }
    function syncSelectors() {
      if (!isCurrent()) return;
      const enabled = !busy() && canStartNew();
      disableSelector(countrySelector, !enabled);
      disableSelector(bankSelector, !enabled || !availableBankCount);
      updatePayButton();
    }
    function replaceBankSelector(banks = []) {
      closeSelector(bankSelector);
      availableBankCount = banks.length;
      bankSelector = createSelector({
        name:"exthand_bank", label:"Bank",
        placeholder:"Select bank", searchable:true
      }, banks.map(b => ({ value:String(b.id), label:b.name })));
      bankSlot.replaceChildren(bankSelector.element);
      bankSelector.input.addEventListener("change", updatePayButton);
      syncSelectors();
    }
    cleanupSelectors = () => {
      closeSelector(countrySelector);
      closeSelector(bankSelector);
    };

    function renderResult(result) {
      if (!isCurrent()) return;
      setMessage(paymentMessage(result));
      next.replaceChildren();
      const flow = result?.flow || {};
      if (terminalFlow(flow)) return;
      const action = flow.next_action || getDiscovery(result)?.next_action;
      if (action?.type !== "redirect") return;
      const url = safeUrl(action.url);
      if (!url) {
        setMessage("Invalid bank authorization link. Do not retry payment.");
        return;
      }
      const link = document.createElement("a");
      link.href = url;
      link.textContent = "Open your bank to approve payment";
      link.rel = "noopener noreferrer";
      next.append(link);
    }

    function applyStatus(result, fromStart = false) {
      if (!isCurrent()) return;
      paymentAbsent = false;
      ready = false;
      selectionRequired = false;
      activeDiscovery = null;

      if (result?.outcome === "payment_not_started") {
        if (safeToRetry(result) &&
            (!pendingStarts.has(id) || fromStart)) {
          forgetAttempt(id);
          paymentAbsent = true;
        }
      } else if (isDiscovery(result)) {
        rememberAttempt(id);
        activeDiscovery = {
          connector_id:result?.connector_id,
          bank_country:result?.bank_country
        };
        ready = discoveryReady(result);
        selectionRequired = needsSelection(result);
      } else {
        rememberAttempt(id);
      }

      renderResult(result);
      if (result?.outcome === "payment_not_started" && !paymentAbsent)
        setMessage("A previous attempt could not be confirmed. Do not retry automatically.");
      syncSelectors();
    }

    async function checkStatus() {
      if (!isCurrent()) return;
      if (checking || pendingStarts.has(id)) {
        deferredCheck = true;
        return;
      }
      deferredCheck = false;
      checking = true;
      paymentAbsent = false;
      ready = false;
      refresh.disabled = true;
      syncSelectors();
      setMessage("Checking bank payment status…");
      try {
        const result = await refreshExthandBankPayment({
          settlement_id:id
        });
        if (isCurrent()) applyStatus(result);
      } catch {
        if (isCurrent())
          setMessage("Unable to verify payment status. Bank payment remains disabled.");
      } finally {
        checking = false;
        if (isCurrent()) {
          refresh.disabled = false;
          syncSelectors();
          if (deferredCheck && !pendingStarts.has(id))
            void checkStatus();
        }
      }
    }
    currentStatusCheck = { id, run:checkStatus };

    async function confirmSafeFailure(error) {
      if (error?.body?.initiation_safe_to_retry !== true)
        return false;
      try {
        const result = await refreshExthandBankPayment({
          settlement_id:id
        });
        return isCurrent() && safeToRetry(result);
      } catch { return false; }
    }

    replaceBankSelector();

    country.addEventListener("change", async () => {
      const request = ++requestSequence;
      const countryCode = country.value;
      replaceBankSelector();
      if (!countryCode) return;
      setMessage("Loading banks…");
      try {
        const banks = normalizeBanks(await loadBanks({
          countryCode, rail:eligibility.rail
        }));
        if (!isCurrent() || request !== requestSequence) return;
        replaceBankSelector(banks);
        setMessage(banks.length
          ? "Select your bank to continue."
          : "No banks available for this country.");
      } catch {
        if (isCurrent() && request === requestSequence)
          setMessage("Bank list unavailable. Manual transfer is still available.");
      }
    });

    async function refreshExistingPayment() {
      try {
        const result = await refreshExthandBankPayment({
          settlement_id:id
        });
        if (isCurrent()) applyStatus(result, true);
      } catch {
        if (isCurrent())
          setMessage("A previous payment exists, but its status is unavailable. Do not retry.");
      }
    }

    pay.addEventListener("click", async () => {
      if (!isCurrent()) return;
      const continuing = canContinueDiscovery();
      const connectorId = continuing
        ? Number(activeDiscovery.connector_id) : Number(getBank()?.value);
      const bankCountry = continuing
        ? upper(activeDiscovery.bank_country) : country.value;
      const hadAttempt = hasAttempt(id);

      if (busy() || (!continuing && (!paymentAbsent || hadAttempt)) ||
          !Number.isSafeInteger(connectorId) || connectorId <= 0 ||
          !Object.prototype.hasOwnProperty.call(countries, bankCountry))
        return;

      const ownsAttempt = !continuing && !hadAttempt;
      rememberAttempt(id);
      pendingStarts.add(id);
      paymentAbsent = false;
      ready = false;
      syncSelectors();
      setMessage(continuing
        ? "Continuing bank payment…" : "Contacting your bank…");

      try {
        const result = await startExthandBankPayment({
          settlement_id:id, connector_id:connectorId,
          bank_country:bankCountry
        });
        if (!isCurrent()) return;
        if (result?.started === false)
          await refreshExistingPayment();
        else
          applyStatus(result, true);
      } catch (error) {
        const retry = ownsAttempt && await confirmSafeFailure(error);
        if (!isCurrent()) return;
        if (retry) {
          forgetAttempt(id);
          paymentAbsent = true;
          ready = false;
          activeDiscovery = null;
          selectionRequired = false;
          setMessage("Bank payment could not be started. You may select another bank.");
        } else {
          setMessage("Payment initiation could not be confirmed. Do not retry. Use Check payment status.");
        }
      } finally {
        pendingStarts.delete(id);
        if (isCurrent()) {
          syncSelectors();
          if (deferredCheck) void checkStatus();
        } else if (currentStatusCheck?.id === id) {
          void currentStatusCheck.run();
        }
      }
    });

    refresh.addEventListener("click", checkStatus);
    element.classList.remove("hidden");
    void checkStatus();
  }

  function onInstructionsReady(event) {
    mount(event.detail?.funding);
  }
  instructionsBox.addEventListener(
    "unibridge:exthand:instructions-ready", onInstructionsReady
  );
  if (typeof getFunding === "function") {
    const existing = getFunding();
    if (existing) mount(existing);
  }
  return {
    destroy() {
      destroyed = true;
      ++revision;
      currentStatusCheck = null;
      if (cleanupSelectors) cleanupSelectors();
      cleanupSelectors = null;
      instructionsBox.removeEventListener(
        "unibridge:exthand:instructions-ready", onInstructionsReady
      );
    }
  };
}
