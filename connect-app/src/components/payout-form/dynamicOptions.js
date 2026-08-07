// connect-app/src/components/payout-form/dynamicOptions.js

import {
  normalizeArray
} from "./routeUtils.js";

export const DYNAMIC_OPTION_ENDPOINTS = {
  coinsph_ph_payout_channels:
    `/api/proxy?endpoint=${encodeURIComponent(
      "options/coinsph/ph-payout-channels"
    )}`
};

function normalizeString(value) {
  return String(
    value ||
    ""
  ).trim();
}

function normalizeUpper(value) {
  return normalizeString(
    value
  ).toUpperCase();
}

function normalizeBackendEndpoint(
  endpoint
) {
  let normalized =
    normalizeString(
      endpoint
    );

  if (!normalized) {
    return "";
  }

  if (
    normalized.startsWith(
      "/v2/"
    )
  ) {
    normalized =
      normalized.slice(
        "/v2/".length
      );
  } else if (
    normalized.startsWith(
      "v2/"
    )
  ) {
    normalized =
      normalized.slice(
        "v2/".length
      );
  } else if (
    normalized.startsWith(
      "/"
    )
  ) {
    normalized =
      normalized.slice(
        1
      );
  }

  return normalized;
}

function buildProxyEndpoint(
  endpoint
) {
  const normalizedEndpoint =
    normalizeBackendEndpoint(
      endpoint
    );

  if (!normalizedEndpoint) {
    return "";
  }

  return (
    `/api/proxy?endpoint=${encodeURIComponent(
      normalizedEndpoint
    )}`
  );
}

export function resolveDynamicOptionEndpoint(
  field = {}
) {
  const schemaEndpoint =
    normalizeString(
      field?.options?.endpoint
    );

  if (schemaEndpoint) {
    return buildProxyEndpoint(
      schemaEndpoint
    );
  }

  const source =
    normalizeString(
      field.source
    );

  if (!source) {
    return "";
  }

  return (
    DYNAMIC_OPTION_ENDPOINTS[
      source
    ] ||
    ""
  );
}

function resolveFieldValueKey(
  field = {}
) {
  return normalizeString(
    field?.options?.value_field ||
      field.value_field
  );
}

function resolveFieldLabelKey(
  field = {}
) {
  return normalizeString(
    field?.options?.label_field ||
      field.label_field
  );
}

function resolveFieldChannelKey(
  field = {}
) {
  return normalizeString(
    field?.options?.channel_field ||
      field.channel_field
  );
}

export function resolveFieldSchemaKey(
  field = {}
) {
  return normalizeString(
    field
      ?.options
      ?.field_schema_field ||
      field.field_schema_field
  );
}

function uniqueByValue(
  options = []
) {
  const map =
    new Map();

  options.forEach(option => {
    if (!option?.value) {
      return;
    }

    if (
      !map.has(
        option.value
      )
    ) {
      map.set(
        option.value,
        option
      );
    }
  });

  return Array.from(
    map.values()
  );
}

export function normalizeDynamicOptions(
  payload
) {
  if (
    Array.isArray(
      payload
    )
  ) {
    return payload;
  }

  const data =
    normalizeArray(
      payload?.data
    );

  if (data.length > 0) {
    return data;
  }

  const channels =
    normalizeArray(
      payload?.channels
    );

  if (
    channels.length >
    0
  ) {
    return channels;
  }

  const options =
    normalizeArray(
      payload?.options
    );

  if (
    options.length >
    0
  ) {
    return options;
  }

  return [];
}

export function resolveRouteChannelName(
  route = {}
) {
  return normalizeUpper(
    route.channelName ||
      route.channel_name ||
      route.transactionChannel ||
      route.transaction_channel ||
      route.rail ||
      route.payout_rail ||
      route.payoutRail
  );
}

export function resolveOptionValue(
  option = {},
  field = {}
) {
  const valueField =
    resolveFieldValueKey(
      field
    );

  return normalizeString(
    (
      valueField
        ? option?.[
            valueField
          ]
        : null
    ) ||
      option?.value ||
      option?.transactionSubject ||
      option?.transaction_subject ||
      option?.channelSubject ||
      option?.channel_subject ||
      option?.bankId ||
      option?.bank_id ||
      option?.bankCode ||
      option?.bank_code ||
      option?.institution_code ||
      option?.id
  );
}

export function resolveOptionLabel(
  option = {},
  field = {}
) {
  const labelField =
    resolveFieldLabelKey(
      field
    );

  return normalizeString(
    (
      labelField
        ? option?.[
            labelField
          ]
        : null
    ) ||
      option?.label ||
      option?.bankName ||
      option?.bank_name ||
      option?.transactionSubjectName ||
      option?.transaction_subject_name ||
      option?.channelSubjectName ||
      option?.channel_subject_name ||
      option?.name ||
      resolveOptionValue(
        option,
        field
      )
  );
}

export function resolveOptionChannel(
  option = {},
  field = {}
) {
  const channelField =
    resolveFieldChannelKey(
      field
    );

  return normalizeUpper(
    (
      channelField
        ? option?.[
            channelField
          ]
        : null
    ) ||
      option?.transactionChannel ||
      option?.transaction_channel ||
      option?.channelName ||
      option?.channel_name
  );
}

function optionMatchesRouteChannel({
  option,
  field,
  routeChannel
}) {
  if (!routeChannel) {
    return true;
  }

  const optionChannel =
    resolveOptionChannel(
      option,
      field
    );

  if (!optionChannel) {
    return true;
  }

  if (
    optionChannel ===
    routeChannel
  ) {
    return true;
  }

  if (
    routeChannel.includes(
      "INSTAPAY"
    ) &&
    optionChannel.includes(
      "INSTAPAY"
    )
  ) {
    return true;
  }

  if (
    routeChannel.includes(
      "PESONET"
    ) &&
    optionChannel.includes(
      "PESONET"
    )
  ) {
    return true;
  }

  return false;
}

export function filterFieldOptions({
  field = {},
  options = [],
  selectedRoute = {}
}) {
  const routeChannel =
    resolveRouteChannelName(
      selectedRoute
    );

  const rawOptions =
    normalizeArray(
      options
    );

  const availableOptions =
    rawOptions.filter(
      option => {
        const status =
          option?.status;

        if (
          status !==
            undefined &&
          status !==
            null &&
          String(
            status
          ).trim() !==
            "1"
        ) {
          return false;
        }

        return Boolean(
          resolveOptionValue(
            option,
            field
          )
        );
      }
    );

  const channelFilteredOptions =
    availableOptions.filter(
      option =>
        optionMatchesRouteChannel({
          option,
          field,
          routeChannel
        })
    );

  const finalOptions =
    channelFilteredOptions
      .length >
    0
      ? channelFilteredOptions
      : availableOptions;

  return uniqueByValue(
    finalOptions.map(
      option => ({
        value:
          resolveOptionValue(
            option,
            field
          ),

        label:
          resolveOptionLabel(
            option,
            field
          ),

        raw:
          option
      })
    )
  );
}
