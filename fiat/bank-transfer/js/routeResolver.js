// fiat/bank-transfer/js/routeResolver.js

function normalizeString(value) {
  return String(value || "").trim();
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
      .map((field) => {
        return normalizeField(field);
      })
      .filter(Boolean);
  }

  if (
    typeof candidate === "object" &&
    Array.isArray(candidate.fields)
  ) {
    return candidate.fields
      .map((field) => {
        return normalizeField(field);
      })
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
      .map(([name, field]) => {
        return normalizeField(field, name);
      })
      .filter(Boolean);
  }

  return [];
}

export function resolveRouteFields(route = {}) {
  const candidates = [
    route.required_destination_fields,
    route.destination_fields,
    route.destination_schema,
    route.instruction_schema,
    route.schema
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
  return normalizeString(
    route.receiver_country ||
    route.destination_country ||
    route.destination?.country ||
    route.country ||
    context.receiver_country
  ).toUpperCase();
}

export function resolveRouteRail(route = {}) {
  return normalizeString(
    route.payout_rail ||
    route.expected_payout_rail ||
    route.destination_rail ||
    route.destination?.rail ||
    route.rail
  ).toLowerCase();
}

export function resolveExecutionOptions(resolved = {}, route = {}) {
  const execution =
    resolved?.delivery_options?.execution ||
    resolved?.execution ||
    {};

  const payoutRail =
    resolveRouteRail(route);

  if (Array.isArray(execution)) {
    return execution;
  }

  if (execution && typeof execution === "object") {
    const direct =
      execution[payoutRail];

    if (Array.isArray(direct)) {
      return direct;
    }

    if (direct && typeof direct === "object") {
      return [direct];
    }

    const matchingKey =
      Object.keys(execution).find((key) => {
        return key.toLowerCase() === payoutRail;
      });

    if (matchingKey) {
      const value =
        execution[matchingKey];

      if (Array.isArray(value)) {
        return value;
      }

      if (value && typeof value === "object") {
        return [value];
      }
    }
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
    });
}

export function resolveInstructionSchemaFromResolved(route = {}, resolved = {}) {
  const options =
    resolveExecutionOptions(
      resolved,
      route
    );

  const routeId =
    normalizeString(
      route.route_id ||
      route.id
    );

  const executor =
    normalizeString(
      route.executor ||
      route.execution_provider ||
      route.provider
    ).toLowerCase();

  const matched =
    options.find((option) => {
      return (
        routeId &&
        normalizeString(
          option.route_id ||
          option.id
        ) === routeId
      );
    }) ||
    options.find((option) => {
      if (!executor) {
        return false;
      }

      return [
        option.executor,
        option.execution_provider,
        option.provider,
        option.sender
      ]
        .map((value) => {
          return normalizeString(value).toLowerCase();
        })
        .includes(executor);
    }) ||
    options[0];

  return (
    matched?.instruction_schema ||
    matched?.destination_schema ||
    matched?.required_destination_fields ||
    matched?.destination_fields ||
    matched?.schema ||
    null
  );
}

export function formatRouteLabel(route = {}) {
  const receiverCountry =
    resolveRouteCountry(route);

  const payoutRail =
    resolveRouteRail(route);

  if (
    receiverCountry === "BR" &&
    payoutRail === "pix"
  ) {
    return "Brazil · PIX";
  }

  if (receiverCountry === "BR") {
    return payoutRail
      ? `Brazil · ${payoutRail.toUpperCase()}`
      : "Brazil";
  }

  if (receiverCountry === "PH") {
    return payoutRail
      ? `Philippines · ${payoutRail.toUpperCase()}`
      : "Philippines";
  }

  if (receiverCountry && payoutRail) {
    return `${receiverCountry} · ${payoutRail.toUpperCase()}`;
  }

  if (receiverCountry) {
    return receiverCountry;
  }

  if (payoutRail) {
    return payoutRail.toUpperCase();
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
      resolved
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
