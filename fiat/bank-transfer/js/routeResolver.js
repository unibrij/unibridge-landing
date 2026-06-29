// fiat/bank-transfer/js/routeResolver.js

function normalizeString(value) {
  return String(value || "").trim();
}

function normalizeLower(value) {
  return normalizeString(value).toLowerCase();
}

function normalizeUpper(value) {
  return normalizeString(value).toUpperCase();
}

function firstNonEmpty(...values) {
  for (const value of values) {
    const normalized =
      normalizeString(value);

    if (normalized) {
      return normalized;
    }
  }

  return "";
}

function uniqueOptions(options = []) {
  const seen =
    new Set();

  return options.filter((option) => {
    if (
      !option ||
      typeof option !== "object"
    ) {
      return false;
    }

    const key =
      JSON.stringify([
        option.route_id,
        option.id,
        option.executor,
        option.execution_provider,
        option.provider,
        option.sender,
        option.payout_rail,
        option.rail,
        option.channelName,
        option.channel_name,
        option.channelSubject,
        option.channel_subject
      ]);

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);

    return true;
  });
}

function pickSchemaCandidate(value = {}) {
  if (
    !value ||
    typeof value !== "object"
  ) {
    return null;
  }

  return (
    value.instruction_schema ||
    value.destination_schema ||
    value.beneficiary_schema ||
    value.recipient_schema ||
    value.required_destination_fields ||
    value.destination_fields ||
    value.beneficiary_fields ||
    value.connect_beneficiary_fields ||
    value.recipient_fields ||
    value.fields ||
    value.schema ||
    value.destination?.instruction_schema ||
    value.destination?.schema ||
    value.destination?.fields ||
    null
  );
}

export function normalizeField(field = {}, fallbackName = "") {
  const name =
    normalizeString(
      field.name ||
      field.key ||
      field.id ||
      fallbackName
    );

  if (!name) {
    return null;
  }

  return {
    name,

    label:
      normalizeString(field.label) ||
      normalizeString(field.title) ||
      name,

    type:
      normalizeString(field.type) ||
      "text",

    required:
      field.required !== false
  };
}

export function normalizeFieldsFromCandidate(candidate) {
  if (!candidate) {
    return [];
  }

  if (Array.isArray(candidate)) {
    return candidate
      .map((field) => normalizeField(field))
      .filter(Boolean);
  }

  if (
    typeof candidate === "object" &&
    Array.isArray(candidate.fields)
  ) {
    return candidate.fields
      .map((field) => normalizeField(field))
      .filter(Boolean);
  }

  if (
    typeof candidate === "object" &&
    candidate.properties &&
    typeof candidate.properties === "object"
  ) {
    return Object.entries(candidate.properties)
      .map(([name, field]) => {
        const required =
          Array.isArray(candidate.required)
            ? candidate.required.includes(name)
            : field?.required;

        return normalizeField(
          {
            ...field,
            required
          },
          name
        );
      })
      .filter(Boolean);
  }

  if (typeof candidate === "object") {
    return Object.entries(candidate)
      .filter(([, value]) => {
        return (
          value &&
          typeof value === "object" &&
          !Array.isArray(value)
        );
      })
      .map(([name, field]) => normalizeField(field, name))
      .filter(Boolean);
  }

  return [];
}

export function resolveRouteFields(route = {}) {
  const candidates = [
    route.required_destination_fields,
    route.destination_fields,
    route.beneficiary_fields,
    route.connect_beneficiary_fields,
    route.recipient_fields,
    route.fields,
    route.destination_schema,
    route.beneficiary_schema,
    route.recipient_schema,
    route.instruction_schema,
    route.schema,
    route.destination?.fields,
    route.destination?.schema
  ];

  for (const candidate of candidates) {
    const fields =
      normalizeFieldsFromCandidate(candidate);

    if (fields.length) {
      return fields;
    }
  }

  return [];
}

export function resolveRouteCountry(route = {}, context = {}) {
  return normalizeUpper(
    route.receiver_country ||
    route.destination_country ||
    route.destination?.country ||
    route.country ||
    context.receiver_country
  );
}

export function resolveRouteRail(route = {}) {
  return normalizeLower(
    route.payout_rail ||
    route.expected_payout_rail ||
    route.destination_rail ||
    route.destination?.rail ||
    route.rail
  );
}

function resolveRouteExecutor(route = {}) {
  return normalizeLower(
    route.executor ||
    route.execution_provider ||
    route.provider ||
    route.sender
  );
}

function resolveOptionCountry(option = {}) {
  return normalizeUpper(
    option.receiver_country ||
    option.destination_country ||
    option.destination?.country ||
    option.country
  );
}

function resolveOptionRail(option = {}) {
  return normalizeLower(
    option.payout_rail ||
    option.expected_payout_rail ||
    option.destination_rail ||
    option.destination?.rail ||
    option.rail
  );
}

function resolveOptionExecutor(option = {}) {
  return normalizeLower(
    option.executor ||
    option.execution_provider ||
    option.provider ||
    option.sender
  );
}

function resolveChannelName(value = {}) {
  return normalizeLower(
    value.channelName ||
    value.channel_name ||
    value.transactionChannel ||
    value.transaction_channel
  );
}

function resolveChannelSubject(value = {}) {
  return normalizeLower(
    value.channelSubject ||
    value.channel_subject ||
    value.transactionSubject ||
    value.transaction_subject
  );
}

function flattenExecutionOptions(execution = {}) {
  if (Array.isArray(execution)) {
    return execution.filter((item) => {
      return item && typeof item === "object";
    });
  }

  if (
    !execution ||
    typeof execution !== "object"
  ) {
    return [];
  }

  return Object.values(execution)
    .flatMap((value) => {
      if (Array.isArray(value)) {
        return value;
      }

      if (
        value &&
        typeof value === "object"
      ) {
        return [value];
      }

      return [];
    })
    .filter((item) => {
      return item && typeof item === "object";
    });
}

export function resolveExecutionOptions(resolved = {}, route = {}) {
  const execution =
    resolved?.delivery_options?.execution ||
    resolved?.execution ||
    {};

  const payoutRail =
    resolveRouteRail(route);

  const allOptions =
    flattenExecutionOptions(execution);

  if (
    !payoutRail ||
    !execution ||
    typeof execution !== "object" ||
    Array.isArray(execution)
  ) {
    return uniqueOptions(allOptions);
  }

  const direct =
    execution[payoutRail];

  const directOptions =
    Array.isArray(direct)
      ? direct
      : direct && typeof direct === "object"
        ? [direct]
        : [];

  const matchingKey =
    Object.keys(execution).find((key) => {
      return normalizeLower(key) === payoutRail;
    });

  const matchingValue =
    matchingKey
      ? execution[matchingKey]
      : null;

  const matchingKeyOptions =
    Array.isArray(matchingValue)
      ? matchingValue
      : matchingValue && typeof matchingValue === "object"
        ? [matchingValue]
        : [];

  return uniqueOptions([
    ...directOptions,
    ...matchingKeyOptions,
    ...allOptions
  ]);
}

function optionHasSchema(option = {}) {
  return Boolean(
    normalizeFieldsFromCandidate(
      pickSchemaCandidate(option)
    ).length
  );
}

function matchByRouteId(option = {}, route = {}) {
  const routeId =
    firstNonEmpty(
      route.route_id,
      route.id
    );

  const optionRouteId =
    firstNonEmpty(
      option.route_id,
      option.id
    );

  return Boolean(
    routeId &&
    optionRouteId &&
    routeId === optionRouteId
  );
}

function matchByRailAndCountry(option = {}, route = {}, context = {}) {
  const routeRail =
    resolveRouteRail(route);

  const optionRail =
    resolveOptionRail(option);

  const routeCountry =
    resolveRouteCountry(route, context);

  const optionCountry =
    resolveOptionCountry(option);

  return Boolean(
    routeRail &&
    optionRail &&
    routeRail === optionRail &&
    (
      !routeCountry ||
      !optionCountry ||
      routeCountry === optionCountry
    )
  );
}

function matchByChannel(option = {}, route = {}) {
  const routeChannelName =
    resolveChannelName(route);

  const optionChannelName =
    resolveChannelName(option);

  const routeChannelSubject =
    resolveChannelSubject(route);

  const optionChannelSubject =
    resolveChannelSubject(option);

  if (
    routeChannelName &&
    optionChannelName &&
    routeChannelName !== optionChannelName
  ) {
    return false;
  }

  if (
    routeChannelSubject &&
    optionChannelSubject &&
    routeChannelSubject !== optionChannelSubject
  ) {
    return false;
  }

  return Boolean(
    (
      routeChannelName &&
      optionChannelName
    ) ||
    (
      routeChannelSubject &&
      optionChannelSubject
    )
  );
}

function matchByExecutor(option = {}, route = {}) {
  const routeExecutor =
    resolveRouteExecutor(route);

  const optionExecutor =
    resolveOptionExecutor(option);

  return Boolean(
    routeExecutor &&
    optionExecutor &&
    routeExecutor === optionExecutor
  );
}

export function resolveInstructionSchemaFromResolved(
  route = {},
  resolved = {},
  context = {}
) {
  const options =
    resolveExecutionOptions(
      resolved,
      route
    );

  const matchers = [
    (option) => matchByRouteId(option, route),
    (option) => matchByRailAndCountry(option, route, context),
    (option) => matchByChannel(option, route),
    (option) => matchByExecutor(option, route),
    (option) => optionHasSchema(option)
  ];

  for (const matcher of matchers) {
    const matched =
      options.find((option) => {
        return (
          option &&
          typeof option === "object" &&
          matcher(option) &&
          optionHasSchema(option)
        );
      });

    if (matched) {
      return pickSchemaCandidate(matched);
    }
  }

  return null;
}

function formatCountryLabel(route = {}) {
  return firstNonEmpty(
    route.receiver_country_name,
    route.destination_country_name,
    route.country_name,
    route.destination?.country_name,
    route.receiver_country_label,
    route.destination_country_label,
    route.country_label,
    resolveRouteCountry(route)
  );
}

function formatRailLabel(route = {}) {
  const raw =
    firstNonEmpty(
      route.payout_rail_name,
      route.destination_rail_name,
      route.rail_name,
      route.payout_method_name,
      route.destination?.rail_name,
      route.payout_rail_label,
      route.destination_rail_label,
      route.rail_label,
      route.payout_method_label,
      resolveRouteRail(route)
    );

  return raw.length <= 8
    ? raw.toUpperCase()
    : raw;
}

export function formatRouteLabel(route = {}) {
  const country =
    formatCountryLabel(route);

  const rail =
    formatRailLabel(route);

  if (country && rail) {
    return `${country} · ${rail}`;
  }

  if (country) {
    return country;
  }

  if (rail) {
    return rail;
  }

  return "Payout route";
}

export function normalizeRoute(route = {}, resolved = {}, context = {}) {
  const routeId =
    normalizeString(
      route.route_id ||
      route.id
    );

  if (!routeId) {
    return null;
  }

  const instructionSchema =
    resolveInstructionSchemaFromResolved(
      route,
      resolved,
      context
    );

  const enrichedRoute = {
    ...route,

    instruction_schema:
      route.instruction_schema ||
      instructionSchema
  };

  const receiverCountry =
    resolveRouteCountry(
      enrichedRoute,
      context
    );

  const payoutRail =
    resolveRouteRail(
      enrichedRoute
    );

  const normalizedRoute = {
    ...enrichedRoute,

    route_id:
      routeId,

    receiver_country:
      receiverCountry,

    payout_rail:
      payoutRail
  };

  return {
    ...normalizedRoute,

    label:
      normalizeString(route.label) ||
      normalizeString(route.name) ||
      normalizeString(route.display_name) ||
      formatRouteLabel(normalizedRoute),

    required_destination_fields:
      resolveRouteFields(normalizedRoute)
  };
}

function resolveRawRoutes(payload = {}, resolved = {}) {
  if (Array.isArray(payload.routes)) {
    return payload.routes;
  }

  if (Array.isArray(payload.data)) {
    return payload.data;
  }

  if (Array.isArray(payload.available_routes)) {
    return payload.available_routes;
  }

  if (Array.isArray(payload.delivery_options?.routes)) {
    return payload.delivery_options.routes;
  }

  if (Array.isArray(resolved.routes)) {
    return resolved.routes;
  }

  if (Array.isArray(resolved.data)) {
    return resolved.data;
  }

  if (Array.isArray(resolved.available_routes)) {
    return resolved.available_routes;
  }

  if (Array.isArray(resolved.delivery_options?.routes)) {
    return resolved.delivery_options.routes;
  }

  return [];
}

export function resolveRoutesPayload(payload = {}, resolved = {}, context = {}) {
  const rawRoutes =
    resolveRawRoutes(
      payload,
      resolved
    );

  return rawRoutes
    .map((route) => {
      return normalizeRoute(
        route,
        resolved,
        context
      );
    })
    .filter(Boolean)
    .filter((route) => route.enabled !== false);
}
