// connect-app/src/components/payout-form/dynamicOptions.js

import {
  normalizeArray
} from "./routeUtils.js";

export const DYNAMIC_OPTION_ENDPOINTS = {
  coinsph_ph_payout_channels:
    "/surface/options/coinsph/ph-payout-channels"
};

function normalizeString(value) {
  return String(value || "").trim();
}

function normalizeUpper(value) {
  return normalizeString(value).toUpperCase();
}

export function normalizeDynamicOptions(payload) {
  if (Array.isArray(payload)) {
    return payload;
  }

  const data =
    normalizeArray(payload?.data);

  if (data.length > 0) {
    return data;
  }

  const channels =
    normalizeArray(payload?.channels);

  if (channels.length > 0) {
    return channels;
  }

  const options =
    normalizeArray(payload?.options);

  if (options.length > 0) {
    return options;
  }

  return [];
}

export function resolveRouteChannelName(route = {}) {
  return normalizeUpper(
    route.channelName ||
      route.channel_name ||
      route.transactionChannel ||
      route.transaction_channel
  );
}

export function resolveOptionValue(option = {}, field = {}) {
  return normalizeString(
    option?.[field.value_field] ||
      option?.value ||
      option?.transactionSubject ||
      option?.transaction_subject ||
      option?.channelSubject ||
      option?.channel_subject ||
      option?.id
  );
}

export function resolveOptionLabel(option = {}, field = {}) {
  return normalizeString(
    option?.[field.label_field] ||
      option?.label ||
      option?.transactionSubjectName ||
      option?.transaction_subject_name ||
      option?.name ||
      resolveOptionValue(option, field)
  );
}

export function resolveOptionChannel(option = {}, field = {}) {
  return normalizeUpper(
    option?.[field.channel_field] ||
      option?.transactionChannel ||
      option?.transaction_channel ||
      option?.channelName ||
      option?.channel_name
  );
}

export function filterFieldOptions({
  field = {},
  options = [],
  selectedRoute = {}
}) {
  const routeChannel =
    resolveRouteChannelName(selectedRoute);

  return normalizeArray(options)
    .filter(option => {
      const status =
        option?.status;

      if (
        status !== undefined &&
        status !== null &&
        String(status).trim() !== "1"
      ) {
        return false;
      }

      const optionChannel =
        resolveOptionChannel(option, field);

      if (
        routeChannel &&
        optionChannel &&
        optionChannel !== routeChannel
      ) {
        return false;
      }

      return Boolean(
        resolveOptionValue(option, field)
      );
    })
    .map(option => ({
      value:
        resolveOptionValue(option, field),

      label:
        resolveOptionLabel(option, field)
    }));
}
