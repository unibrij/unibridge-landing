// unibridge-landing/shared/coinsph/coinsph-picker.js

/*
--------------------------------------------------
CoinsPH picker shared orchestrator

Transport-free:
- caller must provide loadChannelOptions()
- usable by Surface, Bank Transfer, Pay Agent
--------------------------------------------------
*/

import {
  buildCoinsPhBankGroups,
  getOptionChannel,
  getOptionLabel,
  getOptionSubject,
  normalizeSearchText
} from "./coinsph-options.js";

import {
  buildCoinsPhDestination,
  validateCoinsPhDestinationInput
} from "./coinsph-destination.js";

import {
  clearCoinsPhRenderedSelection,
  renderCoinsPhSearchResults,
  renderCoinsPhSelectedBank,
  updateCoinsPhRecipientFieldsVisibility
} from "./coinsph-render.js";

export function createCoinsPhPicker({
  root,
  continueBtn,

  loadChannelOptions,

  onReady,
  onChange,
  onValid,
  onInvalid,
  onError,

  getDestinationCountryCode,

  isPhilippinesDestination,
  setContinueDisabled
} = {}) {
  let channelOptions = [];
  let bankGroups = [];
  let visibleBankGroups = [];
  let selectedBankGroup = null;
  let selectedChannelOption = null;

  let channelsLoaded = false;
  let channelsLoading = false;
  let eventsBound = false;
  let mounted = false;

  function call(fn, ...args) {
    if (typeof fn !== "function") {
      return null;
    }

    return fn(...args);
  }

  function resolveRoot() {
    if (!root) {
      return null;
    }

    if (typeof root === "string") {
      return document.getElementById(root);
    }

    return root;
  }

  function getElement(id) {
    const resolvedRoot =
      resolveRoot();

    return (
      resolvedRoot?.querySelector?.(`#${id}`) ||
      document.getElementById(id)
    );
  }

  const bankInput =
    getElement("coinsPhBank");

  const bankSearchInput =
    getElement("coinsPhBankSearch");

  const bankResults =
    getElement("coinsPhBankResults");

  const searchCount =
    getElement("coinsPhSearchCount");

  const selectedBank =
    getElement("coinsPhSelectedBank");

  const selectedBankLabel =
    getElement("coinsPhSelectedBankLabel");

  const selectedBankMeta =
    getElement("coinsPhSelectedBankMeta");

  const channelTabs =
    getElement("coinsPhChannelTabs");

  const channelNameInput =
    getElement("coinsPhChannelName");

  const channelSubjectInput =
    getElement("coinsPhChannelSubject");

  const recipientFields =
    getElement("coinsPhRecipientFields");

  const recipientNameInput =
    getElement("coinsPhRecipientName");

  const recipientAccountInput =
    getElement("coinsPhRecipientAccount");

  const recipientAddressInput =
    getElement("coinsPhRecipientAddress");

  const remarksInput =
    getElement("coinsPhRemarks");

  const hint =
    getElement("coinsPhHint");

  function getDestinationCountry() {
    if (typeof getDestinationCountryCode === "function") {
      return String(getDestinationCountryCode() || "")
        .toUpperCase()
        .trim();
    }

    return "";
  }

  function isActivePh() {
    if (typeof isPhilippinesDestination === "function") {
      return Boolean(isPhilippinesDestination());
    }

    const country =
      getDestinationCountry();

    return !country || country === "PH";
  }

  function setContinueStateDisabled(disabled) {
    const value =
      Boolean(disabled);

    if (continueBtn) {
      continueBtn.disabled =
        value;
    }

    call(
      setContinueDisabled,
      value
    );
  }

  function getSelectedChannelOption() {
    return selectedChannelOption || null;
  }

  function setHiddenSelection(option = {}) {
    const channelName =
      getOptionChannel(option);

    const channelSubject =
      getOptionSubject(option);

    if (bankInput) {
      bankInput.value =
        channelSubject;
    }

    if (channelNameInput) {
      channelNameInput.value =
        channelName;
    }

    if (channelSubjectInput) {
      channelSubjectInput.value =
        channelSubject;
    }
  }

  function clearSelection({
    clearSearch = false
  } = {}) {
    selectedBankGroup =
      null;

    selectedChannelOption =
      null;

    clearCoinsPhRenderedSelection({
      bankInput,
      channelNameInput,
      channelSubjectInput,
      bankSearchInput,
      selectedBank,
      selectedBankLabel,
      selectedBankMeta,
      channelTabs,
      recipientFields,
      clearSearch
    });

    updateContinueState();
  }

  function renderSelectedBank() {
    renderCoinsPhSelectedBank({
      selectedBank,
      selectedBankLabel,
      selectedBankMeta,
      channelTabs,
      selectedBankGroup,
      selectedChannelOption
    });
  }

  function updateRecipientFieldsVisibility() {
    updateCoinsPhRecipientFieldsVisibility({
      recipientFields,

      selectedChannelOption:
        getSelectedChannelOption()
    });
  }

  function selectChannelOption(option = {}) {
    if (!option || typeof option !== "object") {
      clearSelection();

      return;
    }

    selectedChannelOption =
      option;

    setHiddenSelection(option);
    renderSelectedBank();
    updateRecipientFieldsVisibility();
    notifyChange();
  }

  function selectBankGroup(group = {}) {
    if (!group || !Array.isArray(group.options)) {
      clearSelection();

      return;
    }

    selectedBankGroup =
      group;

    const preferred =
      group.options.find((option) => {
        return getOptionChannel(option)
          .toUpperCase() === "INSTAPAY";
      }) ||
      group.options[0];

    if (bankSearchInput) {
      bankSearchInput.value =
        group.label;
    }

    if (bankResults) {
      bankResults.classList.remove("active");
    }

    selectChannelOption(preferred);
  }

  function renderSearchResults(query = "") {
    visibleBankGroups =
      renderCoinsPhSearchResults({
        bankResults,
        searchCount,
        bankGroups,
        query,
        channelsLoaded,
        channelsLoading
      });
  }

  function renderBankOptions(options = []) {
    channelOptions =
      Array.isArray(options)
        ? options
        : [];

    bankGroups =
      buildCoinsPhBankGroups(
        channelOptions
      );

    visibleBankGroups = [];
    selectedBankGroup = null;
    selectedChannelOption = null;

    if (bankInput) {
      bankInput.value = "";
    }

    if (channelNameInput) {
      channelNameInput.value = "";
    }

    if (channelSubjectInput) {
      channelSubjectInput.value = "";
    }

    if (selectedBank) {
      selectedBank.classList.remove("active");
    }

    if (channelTabs) {
      channelTabs.innerHTML = "";
      channelTabs.classList.remove("active");
    }

    updateRecipientFieldsVisibility();

    renderSearchResults(
      bankSearchInput?.value || ""
    );
  }

  function validateDestinationInput() {
    return validateCoinsPhDestinationInput({
      isActivePh:
        isActivePh(),

      selectedOption:
        getSelectedChannelOption(),

      recipientNameInput,
      recipientAccountInput,
      recipientAddressInput,
      remarksInput
    });
  }

  function updateContinueState() {
    updateRecipientFieldsVisibility();

    if (!isActivePh()) {
      setContinueStateDisabled(true);
      call(onInvalid);

      return false;
    }

    if (channelsLoading || !channelsLoaded) {
      setContinueStateDisabled(true);
      call(onInvalid);

      return false;
    }

    const validation =
      validateDestinationInput();

    setContinueStateDisabled(
      !validation.ok
    );

    if (validation.ok) {
      call(
        onValid,
        validation
      );

      return true;
    }

    call(
      onInvalid,
      validation
    );

    return false;
  }

  function notifyChange() {
    call(onChange);
    updateContinueState();
  }

  async function load() {
    if (!isActivePh()) {
      reset();

      return false;
    }

    if (!bankSearchInput) {
      return false;
    }

    if (
      channelsLoaded &&
      channelOptions.length
    ) {
      renderSearchResults(
        bankSearchInput.value || ""
      );

      updateContinueState();
      call(onReady);

      return true;
    }

    if (typeof loadChannelOptions !== "function") {
      const error =
        new Error(
          "COINSPH_CHANNEL_OPTIONS_LOADER_MISSING"
        );

      call(
        onError,
        error
      );

      throw error;
    }

    channelsLoading =
      true;

    bankSearchInput.disabled =
      true;

    bankSearchInput.value =
      "";

    bankSearchInput.placeholder =
      "Loading payout institutions...";

    if (bankResults) {
      bankResults.innerHTML =
        "";

      bankResults.classList.remove(
        "active"
      );
    }

    if (searchCount) {
      searchCount.innerText =
        "Loading Philippines payout institutions...";
    }

    if (hint) {
      hint.innerText =
        "Loading Philippines payout institutions...";
    }

    updateRecipientFieldsVisibility();
    setContinueStateDisabled(true);

    try {
      const options =
        await loadChannelOptions();

      channelsLoaded =
        true;

      bankSearchInput.disabled =
        false;

      bankSearchInput.placeholder =
        "Search bank or payout institution";

      renderBankOptions(
        options
      );

      if (hint) {
        hint.innerText =
          bankGroups.length
            ? "Search for the receiving bank or wallet, select the payout channel, then enter recipient details."
            : "No payout institutions are currently available.";
      }

      updateContinueState();
      call(onReady);

      return true;
    } catch (err) {
      channelOptions = [];
      bankGroups = [];
      visibleBankGroups = [];
      selectedBankGroup = null;
      selectedChannelOption = null;
      channelsLoaded = false;

      bankSearchInput.disabled =
        true;

      bankSearchInput.placeholder =
        "Could not load payout institutions";

      if (bankResults) {
        bankResults.innerHTML =
          "";

        bankResults.classList.remove(
          "active"
        );
      }

      if (searchCount) {
        searchCount.innerText =
          "Could not load payout institutions.";
      }

      if (hint) {
        hint.innerText =
          "Could not load Philippines payout institutions. Please try again.";
      }

      call(
        onError,
        err
      );

      throw err;
    } finally {
      channelsLoading =
        false;

      updateContinueState();
    }
  }

  async function refresh() {
    return load();
  }

  function buildDestination() {
    return buildCoinsPhDestination({
      validation:
        validateDestinationInput(),

      getOptionChannel,
      getOptionSubject,
      getOptionLabel
    });
  }

  function reset() {
    channelOptions = [];
    bankGroups = [];
    visibleBankGroups = [];
    selectedBankGroup = null;
    selectedChannelOption = null;
    channelsLoaded = false;
    channelsLoading = false;

    if (bankInput) {
      bankInput.value = "";
    }

    if (bankSearchInput) {
      bankSearchInput.value = "";

      bankSearchInput.disabled =
        false;

      bankSearchInput.placeholder =
        "Search bank or payout institution";
    }

    if (channelNameInput) {
      channelNameInput.value = "";
    }

    if (channelSubjectInput) {
      channelSubjectInput.value = "";
    }

    if (bankResults) {
      bankResults.innerHTML =
        "";

      bankResults.classList.remove(
        "active"
      );
    }

    if (searchCount) {
      searchCount.innerText =
        "Search for the receiving bank.";
    }

    if (selectedBank) {
      selectedBank.classList.remove(
        "active"
      );
    }

    if (selectedBankLabel) {
      selectedBankLabel.innerText =
        "";
    }

    if (selectedBankMeta) {
      selectedBankMeta.innerText =
        "";
    }

    if (channelTabs) {
      channelTabs.innerHTML =
        "";

      channelTabs.classList.remove(
        "active"
      );
    }

    if (recipientFields) {
      recipientFields.classList.add(
        "hidden"
      );

      recipientFields.style.display =
        "none";
    }

    if (recipientNameInput) {
      recipientNameInput.value =
        "";
    }

    if (recipientAccountInput) {
      recipientAccountInput.value =
        "";
    }

    if (recipientAddressInput) {
      recipientAddressInput.value =
        "";
    }

    if (remarksInput) {
      remarksInput.value =
        "";
    }

    if (hint) {
      hint.innerText =
        "Search for the receiving bank or wallet, select the payout channel, then enter recipient details.";
    }

    setContinueStateDisabled(true);
  }

  function bindEvents() {
    if (eventsBound) {
      return true;
    }

    eventsBound =
      true;

    if (bankSearchInput) {
      bankSearchInput.addEventListener(
        "input",
        () => {
          selectedBankGroup =
            null;

          selectedChannelOption =
            null;

          if (bankInput) {
            bankInput.value =
              "";
          }

          if (channelNameInput) {
            channelNameInput.value =
              "";
          }

          if (channelSubjectInput) {
            channelSubjectInput.value =
              "";
          }

          if (selectedBank) {
            selectedBank.classList.remove(
              "active"
            );
          }

          updateRecipientFieldsVisibility();

          renderSearchResults(
            bankSearchInput.value || ""
          );

          notifyChange();
        }
      );

      bankSearchInput.addEventListener(
        "focus",
        () => {
          if (
            channelsLoaded &&
            normalizeSearchText(
              bankSearchInput.value
            )
          ) {
            renderSearchResults(
              bankSearchInput.value || ""
            );
          }
        }
      );
    }

    if (bankResults) {
      bankResults.addEventListener(
        "click",
        (event) => {
          const button =
            event.target.closest(
              "[data-group-index]"
            );

          if (!button) {
            return;
          }

          const index =
            Number(
              button.getAttribute(
                "data-group-index"
              )
            );

          if (!Number.isInteger(index)) {
            return;
          }

          const group =
            visibleBankGroups[index];

          if (!group) {
            return;
          }

          selectBankGroup(group);
        }
      );
    }

    if (channelTabs) {
      channelTabs.addEventListener(
        "click",
        (event) => {
          const button =
            event.target.closest(
              "[data-option-index]"
            );

          if (!button || !selectedBankGroup) {
            return;
          }

          const optionIndex =
            Number(
              button.getAttribute(
                "data-option-index"
              )
            );

          if (!Number.isInteger(optionIndex)) {
            return;
          }

          const option =
            selectedBankGroup.options.find((item) => {
              return (
                Number(item.__coinsPhIndex) ===
                optionIndex
              );
            });

          if (!option) {
            return;
          }

          selectChannelOption(option);
        }
      );
    }

    [
      recipientNameInput,
      recipientAccountInput,
      recipientAddressInput,
      remarksInput
    ].forEach((input) => {
      if (!input) {
        return;
      }

      input.addEventListener(
        "input",
        notifyChange
      );

      input.addEventListener(
        "blur",
        notifyChange
      );
    });

    return true;
  }

  function mount() {
    if (mounted) {
      return true;
    }

    mounted =
      true;

    bindEvents();

    if (isActivePh()) {
      load().catch((error) => {
        call(
          onError,
          error
        );
      });
    } else {
      reset();
    }

    return true;
  }

  return {
    mount,
    reset,
    refresh,
    load,
    bindEvents,
    updateContinueState,
    validateDestinationInput,
    buildDestination
  };
}

export default createCoinsPhPicker;
