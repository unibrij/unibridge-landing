// unibridge-landing/shared/coinsph/coinsph-options.js

export const COINSPH_PAYOUT_CHANNELS_ENDPOINT =
  "surface/options/coinsph/ph-payout-channels";

export const COINSPH_PAYOUT_CHANNELS_FETCH_URL =
  "/surface/options/coinsph/ph-payout-channels";

export function normalizeText(value) {
  return String(value || "").trim();
}

export function normalizeSearchText(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

export function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function normalizeOptionsPayload(payload) {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (Array.isArray(payload?.options)) {
    return payload.options;
  }

  if (Array.isArray(payload?.channels)) {
    return payload.channels;
  }

  if (Array.isArray(payload?.data)) {
    return payload.data;
  }

  return [];
}

export async function fetchCoinsPhChannelOptions({
  apiGet
} = {}) {
  if (typeof apiGet === "function") {
    const response =
      await apiGet(
        COINSPH_PAYOUT_CHANNELS_ENDPOINT,
        {}
      );

    if (!response?.ok) {
      throw new Error(
        response?.error ||
          "COINSPH_CHANNELS_LOAD_FAILED"
      );
    }

    return normalizeOptionsPayload(response);
  }

  const response =
    await fetch(
      COINSPH_PAYOUT_CHANNELS_FETCH_URL
    );

  if (!response.ok) {
    throw new Error(
      "COINSPH_CHANNELS_LOAD_FAILED"
    );
  }

  const payload =
    await response.json();

  return normalizeOptionsPayload(payload);
}

export function getChannelPriority(option = {}) {
  const channel =
    String(
      option.channelName ||
        option.transactionChannel ||
        option.transaction_channel ||
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

export function getOptionLabel(option = {}) {
  return normalizeText(
    option.label ||
      option.bankName ||
      option.transactionSubjectName ||
      option.transaction_subject_name ||
      option.channelSubjectName ||
      option.channel_subject_name ||
      option.channelSubject ||
      option.transactionSubject
  );
}

export function getOptionSubject(option = {}) {
  return normalizeText(
    option.channelSubject ||
      option.channel_subject ||
      option.transactionSubject ||
      option.transaction_subject
  );
}

export function getOptionChannel(option = {}) {
  return normalizeText(
    option.channelName ||
      option.channel_name ||
      option.transactionChannel ||
      option.transaction_channel
  );
}

export function isOptionAvailable(option = {}) {
  const status =
    option.status;

  return (
    status === undefined ||
    status === null ||
    String(status).trim() === "1"
  );
}

export function buildCoinsPhBankGroups(options = []) {
  const map =
    new Map();

  options
    .filter(isOptionAvailable)
    .forEach((option, index) => {
      if (!option || typeof option !== "object") {
        return;
      }

      const label =
        getOptionLabel(option);

      const subject =
        getOptionSubject(option);

      const channel =
        getOptionChannel(option);

      if (!label || !subject || !channel) {
        return;
      }

      const key =
        normalizeSearchText(
          subject || label
        );

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
    .map(group => {
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
