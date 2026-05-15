// unibrij/unibridge-landing/surface/public/coinsph-picker.js

/*
--------------------------------------------------
CoinsPH picker

Purpose:
- keep CoinsPH PH payout institution search outside app.js
- load supported CoinsPH payout channels through Surface proxy
- render searchable bank / payout institution picker
- support multiple payout channels per institution
- validate recipient fields
- build destination payload for settlement/create

Important:
- do not pass amount to support-channel.
  Final payout amount may depend on ramp fill / USDC sold.
--------------------------------------------------
*/

export function createCoinsPhPicker({
  apiGet,
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

  function normalizeDigits(value) {
    return String(value || "")
      .replace(/[^\d]/g, "")
      .trim();
  }

  function normalizeOptionalText(value) {
    const normalized =
      String(value || "").trim();

    return normalized || null;
  }

  function normalizeSearchText(value) {
    return String(value || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim();
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function getChannelPriority(option = {}) {
    const channel =
      String(
        option.channelName ||
          option.transactionChannel ||
          ""
      )
        .toUpperCase()
        .trim();

    if (channel === "INSTAPAY") {
      return 1;
    }

    if (channel === "SWIFTPAY_PESONET") {
      return 2;
    }

    return 9;
  }

  function getOptionLabel(option = {}) {
    return String(
      option.label ||
        option.bankName ||
        option.channelSubject ||
        option.transactionSubject ||
        ""
    ).trim();
  }

  function getOptionSubject(option = {}) {
    return String(
      option.channelSubject ||
        option.transactionSubject ||
        ""
    ).trim();
  }

  function getOptionChannel(option = {}) {
    return String(
      option.channelName ||
        option.transactionChannel ||
        ""
    ).trim();
  }

  function buildBankGroups(options = []) {
    const map =
      new Map();

    options.forEach((option, index) => {
      if (
        !option ||
        typeof option !== "object"
      ) {
        return;
      }

      const label =
        getOptionLabel(option);

      if (!label) {
        return;
      }

      const key =
        normalizeSearchText(label);

      if (!map.has(key)) {
        map.set(key, {
          key,
          label,
          options: [],
          searchText: ""
        });
      }

      map.get(key).options.push({
        ...option,
        __coinsPhIndex:
          index
      });
    });

    return Array.from(map.values())
      .map((group) => {
        const sortedOptions =
          group.options
            .slice()
            .sort((a, b) => {
              const priorityDiff =
                getChannelPriority(a) -
                getChannelPriority(b);

              if (priorityDiff !== 0) {
                return priorityDiff;
              }

              return getOptionChannel(a)
                .localeCompare(
                  getOptionChannel(b)
                );
            });

        const searchParts = [
          group.label,
          ...sortedOptions.map(getOptionSubject),
          ...sortedOptions.map(getOptionChannel)
        ];

        return {
          ...group,
          options:
            sortedOptions,
          searchText:
            normalizeSearchText(
              searchParts.join(" ")
            )
        };
      })
      .sort((a, b) =>
        a.label.localeCompare(b.label)
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
        String(
          option.id ||
            channelSubject ||
            ""
        );
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

    if (
      clearSearch &&
      bankSearchInput
    ) {
      bankSearchInput.value = "";
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
      recipientFields.style.display = "none";
    }

    updateContinueState();
  }

  function renderSelectedBank() {
    if (
      !selectedBank ||
      !selectedBankGroup ||
      !selectedChannelOption
    ) {
      return;
    }

    const selectedChannel =
      getOptionChannel(
        selectedChannelOption
      );

    const selectedSubject =
      getOptionSubject(
        selectedChannelOption
      );

    selectedBank.classList.add("active");

    if (selectedBankLabel) {
      selectedBankLabel.innerText =
        selectedBankGroup.label;
    }

    if (selectedBankMeta) {
      selectedBankMeta.innerText =
        `${selectedChannel || "Selected channel"}${
          selectedSubject
            ? ` · ${selectedSubject}`
            : ""
        }`;
    }

    if (!channelTabs) {
      return;
    }

    const tabs =
      selectedBankGroup.options
        .map((option) => {
          const channel =
            getOptionChannel(option);

          const optionIndex =
            Number(option.__coinsPhIndex);

          const active =
            optionIndex ===
            Number(
              selectedChannelOption.__coinsPhIndex
            );

          return `
            <button
              type="button"
              class="coinsph-channel-tab${active ? " active" : ""}"
              data-option-index="${String(optionIndex)}"
            >
              ${escapeHtml(channel || "Channel")}
            </button>
          `;
        })
        .join("");

    channelTabs.innerHTML =
      tabs;

    if (selectedBankGroup.options.length > 1) {
      channelTabs.classList.add("active");
    } else {
      channelTabs.classList.remove("active");
    }
  }

  function selectChannelOption(option = {}) {
    if (
      !option ||
      typeof option !== "object"
    ) {
      clearSelection();
      return;
    }

    selectedChannelOption =
      option;

    setHiddenSelection(option);
    renderSelectedBank();
    updateContinueState();
  }

  function selectBankGroup(group = {}) {
    if (
      !group ||
      !Array.isArray(group.options)
    ) {
      clearSelection();
      return;
    }

    selectedBankGroup =
      group;

    const preferred =
      group.options.find((option) =>
        getOptionChannel(option)
          .toUpperCase() === "INSTAPAY"
      ) ||
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
    if (!bankResults) {
      return;
    }

    if (!channelsLoaded) {
      bankResults.innerHTML = "";
      bankResults.classList.remove("active");

      if (searchCount) {
        searchCount.innerText =
          channelsLoading
            ? "Loading payout institutions..."
            : "Search for the receiving bank.";
      }

      return;
    }

    const normalizedQuery =
      normalizeSearchText(query);

    /*
    --------------------------------------------------
    Do not show the full bank list by default.
    Surface should show count first, then results
    only after user starts typing.
    --------------------------------------------------
    */

    if (!normalizedQuery) {
      visibleBankGroups = [];

      bankResults.innerHTML = "";
      bankResults.classList.remove("active");

      if (searchCount) {
        searchCount.innerText =
          bankGroups.length
            ? `${bankGroups.length} payout institutions available. Start typing to search.`
            : "No payout institutions are currently available.";
      }

      return;
    }

    const filtered =
      bankGroups.filter((group) =>
        group.searchText.includes(
          normalizedQuery
        )
      );

    visibleBankGroups =
      filtered.slice(0, 40);

    if (searchCount) {
      searchCount.innerText =
        `${filtered.length} matching institution${
          filtered.length === 1 ? "" : "s"
        }.`;
    }

    if (!filtered.length) {
      bankResults.innerHTML =
        '<div class="coinsph-empty">No matching payout institution found.</div>';
      bankResults.classList.add("active");
      return;
    }

    const html =
      visibleBankGroups
        .map((group, index) => {
          const channels =
            group.options
              .map(getOptionChannel)
              .filter(Boolean)
              .join(" / ");

          const subject =
            getOptionSubject(
              group.options[0]
            );

          return `
            <button
              type="button"
              class="coinsph-result"
              data-group-index="${String(index)}"
            >
              <strong>${escapeHtml(group.label)}</strong>
              <span>${escapeHtml(channels)}${subject ? ` · ${escapeHtml(subject)}` : ""}</span>
            </button>
          `;
        })
        .join("");

    bankResults.innerHTML =
      html;

    bankResults.classList.add("active");
  }

  function renderBankOptions(options = []) {
    channelOptions =
      Array.isArray(options)
        ? options
        : [];

    bankGroups =
      buildBankGroups(
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

    if (recipientFields) {
      recipientFields.style.display = "none";
    }

    renderSearchResults(
      bankSearchInput?.value || ""
    );
  }

  async function load() {
    if (
      typeof isPhilippinesDestination === "function" &&
      !isPhilippinesDestination()
    ) {
      return;
    }

    if (!bankSearchInput) {
      return;
    }

    if (typeof apiGet !== "function") {
      throw new Error(
        "COINSPH_PICKER_API_GET_MISSING"
      );
    }

    if (
      channelsLoaded &&
      channelOptions.length
    ) {
      renderSearchResults(
        bankSearchInput.value || ""
      );

      updateContinueState();
      return;
    }

    channelsLoading = true;

    bankSearchInput.disabled = true;
    bankSearchInput.value = "";
    bankSearchInput.placeholder =
      "Loading payout institutions...";

    if (bankResults) {
      bankResults.innerHTML = "";
      bankResults.classList.remove("active");
    }

    if (searchCount) {
      searchCount.innerText =
        "Loading Philippines payout institutions...";
    }

    if (recipientFields) {
      recipientFields.style.display = "none";
    }

    if (typeof setContinueDisabled === "function") {
      setContinueDisabled(true);
    }

    if (hint) {
      hint.innerText =
        "Loading Philippines payout institutions...";
    }

    try {
      const response =
        await apiGet(
          "surface/options/coinsph/ph-payout-channels",
          {}
        );

      if (!response?.ok) {
        throw new Error(
          response?.error ||
          "COINSPH_CHANNELS_LOAD_FAILED"
        );
      }

      channelsLoaded = true;

      bankSearchInput.disabled = false;
      bankSearchInput.placeholder =
        "Search bank or payout institution";

      renderBankOptions(
        response.options || []
      );

      if (hint) {
        hint.innerText =
          response.count
            ? "Search for the receiving bank, select the payout channel, then enter recipient details."
            : "No payout institutions are currently available.";
      }

      updateContinueState();
    } catch (err) {
      channelOptions = [];
      bankGroups = [];
      visibleBankGroups = [];
      selectedBankGroup = null;
      selectedChannelOption = null;
      channelsLoaded = false;

      bankSearchInput.disabled = true;
      bankSearchInput.placeholder =
        "Could not load payout institutions";

      if (bankResults) {
        bankResults.innerHTML = "";
        bankResults.classList.remove("active");
      }

      if (searchCount) {
        searchCount.innerText =
          "Could not load payout institutions.";
      }

      if (hint) {
        hint.innerText =
          "Could not load Philippines payout institutions. Please try again.";
      }

      throw err;
    } finally {
      channelsLoading = false;
      updateContinueState();
    }
  }

  function updateRecipientFieldsVisibility() {
    if (!recipientFields) {
      return;
    }

    recipientFields.style.display =
      getSelectedChannelOption()
        ? "block"
        : "none";
  }

  function validateDestinationInput() {
    const selected =
      getSelectedChannelOption();

    if (!selected) {
      return {
        ok: false,
        error: "COINSPH_BANK_REQUIRED"
      };
    }

    const recipientName =
      normalizeOptionalText(
        recipientNameInput?.value
      );

    const recipientAccountNumber =
      normalizeDigits(
        recipientAccountInput?.value
      );

    const recipientAddress =
      normalizeOptionalText(
        recipientAddressInput?.value
      );

    const remarks =
      normalizeOptionalText(
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

    if (!recipientAccountNumber) {
      return {
        ok: false,
        error: "COINSPH_RECIPIENT_ACCOUNT_NUMBER_REQUIRED"
      };
    }

    if (recipientAccountNumber.length < 6) {
      return {
        ok: false,
        error: "COINSPH_RECIPIENT_ACCOUNT_NUMBER_TOO_SHORT"
      };
    }

    if (recipientAccountNumber.length > 30) {
      return {
        ok: false,
        error: "COINSPH_RECIPIENT_ACCOUNT_NUMBER_TOO_LONG"
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
      option: selected,
      recipientName,
      recipientAccountNumber,
      recipientAddress,
      remarks
    };
  }

  function updateContinueState() {
    updateRecipientFieldsVisibility();

    if (
      typeof isPhilippinesDestination === "function" &&
      !isPhilippinesDestination()
    ) {
      if (typeof setContinueDisabled === "function") {
        setContinueDisabled(true);
      }

      return;
    }

    if (channelsLoading) {
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

  function buildDestination() {
    const validation =
      validateDestinationInput();

    if (!validation.ok) {
      throw new Error(validation.error);
    }

    const {
      option,
      recipientName,
      recipientAccountNumber,
      recipientAddress,
      remarks
    } =
      validation;

    const channelName =
      getOptionChannel(option);

    const channelSubject =
      getOptionSubject(option);

    if (!channelName) {
      throw new Error(
        "COINSPH_CHANNEL_NAME_MISSING"
      );
    }

    if (!channelSubject) {
      throw new Error(
        "COINSPH_CHANNEL_SUBJECT_MISSING"
      );
    }

    const destination = {
      country:
        "PH",

      currency:
        "PHP",

      bankId:
        option.id || null,

      bankName:
        getOptionLabel(option) || null,

      bankCode:
        channelSubject,

      channelName,
      channelSubject,

      transactionChannel:
        option.transactionChannel ||
        channelName,

      transactionSubject:
        option.transactionSubject ||
        channelSubject,

      name:
        recipientName,

      account:
        recipientAccountNumber
    };

    if (recipientAddress) {
      destination.recipientAddress =
        recipientAddress;
    }

    if (remarks) {
      destination.remarks =
        remarks;
    }

    return destination;
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
      bankSearchInput.disabled = false;
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
      bankResults.innerHTML = "";
      bankResults.classList.remove("active");
    }

    if (searchCount) {
      searchCount.innerText =
        "Search for the receiving bank.";
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
        "Search for the receiving bank, select the payout channel, then enter the recipient details.";
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

    if (bankSearchInput) {
      bankSearchInput.addEventListener("input", () => {
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

        if (recipientFields) {
          recipientFields.style.display = "none";
        }

        renderSearchResults(
          bankSearchInput.value || ""
        );

        updateContinueState();
      });

      bankSearchInput.addEventListener("focus", () => {
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
      });
    }

    if (bankResults) {
      bankResults.addEventListener("click", (event) => {
        const button =
          event.target.closest("[data-group-index]");

        if (!button) {
          return;
        }

        const index =
          Number(
            button.getAttribute("data-group-index")
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
      });
    }

    if (channelTabs) {
      channelTabs.addEventListener("click", (event) => {
        const button =
          event.target.closest("[data-option-index]");

        if (
          !button ||
          !selectedBankGroup
        ) {
          return;
        }

        const optionIndex =
          Number(
            button.getAttribute("data-option-index")
          );

        if (!Number.isInteger(optionIndex)) {
          return;
        }

        const option =
          selectedBankGroup.options.find(
            (item) =>
              Number(item.__coinsPhIndex) ===
              optionIndex
          );

        if (!option) {
          return;
        }

        selectChannelOption(option);
      });
    }

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
