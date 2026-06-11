// unibrij/unibridge-landing/surface/coinsph-picker.js

/*
--------------------------------------------------
CoinsPH fixed GCash / InstaPay picker

Purpose:
- Surface Card Payment PH route should match Connect PH
- no dynamic bank search for this flow
- collect only:
  - recipient legal name
  - mobile wallet / phone number
- build destination payload compatible with backend CoinsPH
  executor, which expects recipientAccountNumber internally
--------------------------------------------------
*/

export function createCoinsPhPicker({
  isPhilippinesDestination,
  setContinueDisabled
} = {}) {
  let eventsBound = false;
  let loaded = false;

  const bankInput =
    document.getElementById("coinsPhBank");

  const bankSearchInput =
    document.getElementById("coinsPhBankSearch");

  const bankResults =
    document.getElementById("coinsPhBankResults");

  const searchCount =
    document.getElementById("coinsPhSearchCount");

  const selectedBank =
    document.getElementById("coinsPhSelectedBank");

  const selectedBankLabel =
    document.getElementById("coinsPhSelectedBankLabel");

  const selectedBankMeta =
    document.getElementById("coinsPhSelectedBankMeta");

  const channelTabs =
    document.getElementById("coinsPhChannelTabs");

  const channelNameInput =
    document.getElementById("coinsPhChannelName");

  const channelSubjectInput =
    document.getElementById("coinsPhChannelSubject");

  const recipientFields =
    document.getElementById("coinsPhRecipientFields");

  const recipientNameInput =
    document.getElementById("coinsPhRecipientName");

  const recipientAccountInput =
    document.getElementById("coinsPhRecipientAccount");

  const recipientAddressInput =
    document.getElementById("coinsPhRecipientAddress");

  const remarksInput =
    document.getElementById("coinsPhRemarks");

  const hint =
    document.getElementById("coinsPhHint");

  function normalizeText(value) {
    return String(value || "").trim();
  }

  function normalizePhone(value) {
    return String(value || "")
      .replace(/[^\d+]/g, "")
      .trim();
  }

  function normalizePhoneDigits(value) {
    return String(value || "")
      .replace(/[^\d]/g, "")
      .trim();
  }

  function isActivePh() {
    return typeof isPhilippinesDestination === "function"
      ? isPhilippinesDestination()
      : true;
  }

  function setHiddenFixedRoute() {
    if (bankInput) {
      bankInput.value = "gcash";
    }

    if (channelNameInput) {
      channelNameInput.value = "INSTAPAY";
    }

    if (channelSubjectInput) {
      channelSubjectInput.value = "gcash";
    }
  }

  function renderFixedRoute() {
    setHiddenFixedRoute();

    if (bankSearchInput) {
      bankSearchInput.value = "GCash / InstaPay";
      bankSearchInput.disabled = true;
      bankSearchInput.placeholder = "GCash / InstaPay";
    }

    if (bankResults) {
      bankResults.innerHTML = "";
      bankResults.classList.remove("active");
    }

    if (searchCount) {
      searchCount.innerText =
        "GCash / InstaPay payout route selected.";
    }

    if (selectedBank) {
      selectedBank.classList.add("active");
    }

    if (selectedBankLabel) {
      selectedBankLabel.innerText =
        "GCash / InstaPay";
    }

    if (selectedBankMeta) {
      selectedBankMeta.innerText =
        "INSTAPAY · gcash";
    }

    if (channelTabs) {
      channelTabs.innerHTML = "";
      channelTabs.classList.remove("active");
    }

    if (recipientFields) {
      recipientFields.classList.remove("hidden");
      recipientFields.style.display = "grid";
    }

    if (hint) {
      hint.innerText =
        "Enter the recipient name and GCash mobile number.";
    }
  }

  function validateDestinationInput() {
    if (!isActivePh()) {
      return {
        ok: false,
        error: "COINSPH_NOT_ACTIVE_DESTINATION"
      };
    }

    const recipientName =
      normalizeText(
        recipientNameInput?.value
      );

    const phoneRaw =
      normalizePhone(
        recipientAccountInput?.value
      );

    const phoneDigits =
      normalizePhoneDigits(
        phoneRaw
      );

    const recipientAddress =
      normalizeText(
        recipientAddressInput?.value
      );

    const remarks =
      normalizeText(
        remarksInput?.value
      );

    if (!recipientName) {
      return {
        ok: false,
        error: "COINSPH_RECIPIENT_NAME_REQUIRED"
      };
    }

    if (recipientName.length < 2) {
      return {
        ok: false,
        error: "COINSPH_RECIPIENT_NAME_TOO_SHORT"
      };
    }

    if (recipientName.length > 80) {
      return {
        ok: false,
        error: "COINSPH_RECIPIENT_NAME_TOO_LONG"
      };
    }

    if (!phoneDigits) {
      return {
        ok: false,
        error: "COINSPH_RECIPIENT_PHONE_REQUIRED"
      };
    }

    if (phoneDigits.length < 10) {
      return {
        ok: false,
        error: "COINSPH_RECIPIENT_PHONE_TOO_SHORT"
      };
    }

    if (phoneDigits.length > 15) {
      return {
        ok: false,
        error: "COINSPH_RECIPIENT_PHONE_TOO_LONG"
      };
    }

    if (
      recipientAddress &&
      recipientAddress.length > 160
    ) {
      return {
        ok: false,
        error: "COINSPH_RECIPIENT_ADDRESS_TOO_LONG"
      };
    }

    if (
      remarks &&
      remarks.length > 120
    ) {
      return {
        ok: false,
        error: "COINSPH_REMARKS_TOO_LONG"
      };
    }

    return {
      ok: true,
      recipientName,
      phone:
        phoneDigits,
      recipientAddress:
        recipientAddress || null,
      remarks:
        remarks || null
    };
  }

  function updateContinueState() {
    if (!isActivePh()) {
      if (typeof setContinueDisabled === "function") {
        setContinueDisabled(true);
      }

      return;
    }

    if (!loaded) {
      if (typeof setContinueDisabled === "function") {
        setContinueDisabled(true);
      }

      return;
    }

    const validation =
      validateDestinationInput();

    if (typeof setContinueDisabled === "function") {
      setContinueDisabled(!validation.ok);
    }
  }

  async function load() {
    if (!isActivePh()) {
      return;
    }

    loaded = true;

    renderFixedRoute();
    updateContinueState();
  }

  function buildDestination() {
    const validation =
      validateDestinationInput();

    if (!validation.ok) {
      throw new Error(validation.error);
    }

    const {
      recipientName,
      phone,
      recipientAddress,
      remarks
    } =
      validation;

    const destination = {
      country:
        "PH",

      currency:
        "PHP",

      bankId:
        "gcash",

      bankName:
        "GCash",

      bankCode:
        "gcash",

      channelName:
        "INSTAPAY",

      channelSubject:
        "gcash",

      transactionChannel:
        "INSTAPAY",

      transactionSubject:
        "gcash",

      payout_channel:
        "INSTAPAY",

      payoutChannel:
        "INSTAPAY",

      name:
        recipientName,

      recipientName,

      recipient_name:
        recipientName,

      account:
        phone,

      account_number:
        phone,

      accountNumber:
        phone,

      recipientAccountNumber:
        phone,

      recipient_account_number:
        phone,

      phone,

      mobile:
        phone,

      wallet:
        phone,

      wallet_number:
        phone,

      walletNumber:
        phone
    };

    if (recipientAddress) {
      destination.recipientAddress =
        recipientAddress;

      destination.recipient_address =
        recipientAddress;

      destination.address =
        recipientAddress;
    }

    if (remarks) {
      destination.remarks =
        remarks;

      destination.note =
        remarks;
    }

    return destination;
  }

  function reset() {
    loaded = false;

    if (bankInput) {
      bankInput.value = "";
    }

    if (channelNameInput) {
      channelNameInput.value = "";
    }

    if (channelSubjectInput) {
      channelSubjectInput.value = "";
    }

    if (bankSearchInput) {
      bankSearchInput.value = "";
      bankSearchInput.disabled = false;
      bankSearchInput.placeholder =
        "GCash / InstaPay";
    }

    if (bankResults) {
      bankResults.innerHTML = "";
      bankResults.classList.remove("active");
    }

    if (searchCount) {
      searchCount.innerText =
        "GCash / InstaPay payout route.";
    }

    if (selectedBank) {
      selectedBank.classList.remove("active");
    }

    if (selectedBankLabel) {
      selectedBankLabel.innerText = "";
    }

    if (selectedBankMeta) {
      selectedBankMeta.innerText = "";
    }

    if (channelTabs) {
      channelTabs.innerHTML = "";
      channelTabs.classList.remove("active");
    }

    if (recipientFields) {
      recipientFields.classList.add("hidden");
      recipientFields.style.display = "none";
    }

    if (recipientNameInput) {
      recipientNameInput.value = "";
    }

    if (recipientAccountInput) {
      recipientAccountInput.value = "";
    }

    if (recipientAddressInput) {
      recipientAddressInput.value = "";
    }

    if (remarksInput) {
      remarksInput.value = "";
    }

    if (hint) {
      hint.innerText =
        "Enter the recipient name and GCash mobile number.";
    }

    if (typeof setContinueDisabled === "function") {
      setContinueDisabled(true);
    }
  }

  function bindEvents() {
    if (eventsBound) {
      return;
    }

    eventsBound = true;

    [
      recipientNameInput,
      recipientAccountInput,
      recipientAddressInput,
      remarksInput
    ].forEach((input) => {
      input?.addEventListener("input", () => {
        updateContinueState();
      });

      input?.addEventListener("blur", () => {
        updateContinueState();
      });
    });
  }

  return {
    reset,
    load,
    bindEvents,
    updateContinueState,
    validateDestinationInput,
    buildDestination
  };
}

export default createCoinsPhPicker;
