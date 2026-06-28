// unibridge-landing/surface/coinsph/coinsph-render.js

import {
  escapeHtml,
  getOptionChannel,
  getOptionSubject,
  normalizeSearchText
} from "./coinsph-options.js";

export function renderCoinsPhSelectedBank({
  selectedBank,
  selectedBankLabel,
  selectedBankMeta,
  channelTabs,
  selectedBankGroup,
  selectedChannelOption
} = {}) {
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
      .map(option => {
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

export function updateCoinsPhRecipientFieldsVisibility({
  recipientFields,
  selectedChannelOption
} = {}) {
  if (!recipientFields) {
    return;
  }

  if (selectedChannelOption) {
    recipientFields.classList.remove("hidden");
    recipientFields.style.display = "grid";
    return;
  }

  recipientFields.classList.add("hidden");
  recipientFields.style.display = "none";
}

export function renderCoinsPhSearchResults({
  bankResults,
  searchCount,
  bankGroups = [],
  visibleBankGroups = [],
  setVisibleBankGroups,
  query = "",
  channelsLoaded,
  channelsLoading
} = {}) {
  if (!bankResults) {
    return [];
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

    if (typeof setVisibleBankGroups === "function") {
      setVisibleBankGroups([]);
    }

    return [];
  }

  const normalizedQuery =
    normalizeSearchText(query);

  if (!normalizedQuery) {
    bankResults.innerHTML = "";
    bankResults.classList.remove("active");

    if (searchCount) {
      searchCount.innerText =
        bankGroups.length
          ? `${bankGroups.length} payout institutions available. Start typing to search.`
          : "No payout institutions are currently available.";
    }

    if (typeof setVisibleBankGroups === "function") {
      setVisibleBankGroups([]);
    }

    return [];
  }

  const filtered =
    bankGroups.filter(group =>
      group.searchText.includes(
        normalizedQuery
      )
    );

  const nextVisibleBankGroups =
    filtered.slice(0, 40);

  if (typeof setVisibleBankGroups === "function") {
    setVisibleBankGroups(
      nextVisibleBankGroups
    );
  }

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

    return [];
  }

  const html =
    nextVisibleBankGroups
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

  return nextVisibleBankGroups;
}

export function clearCoinsPhRenderedSelection({
  bankInput,
  channelNameInput,
  channelSubjectInput,
  bankSearchInput,
  selectedBank,
  selectedBankLabel,
  selectedBankMeta,
  channelTabs,
  recipientFields,
  clearSearch = false
} = {}) {
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

  updateCoinsPhRecipientFieldsVisibility({
    recipientFields,
    selectedChannelOption:
      null
  });
}
