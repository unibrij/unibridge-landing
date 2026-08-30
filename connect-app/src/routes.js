// connect-app/src/routes.js

export const FALLBACK_ROUTES = [
  {
    id: "br_pix",
    route_id: "br_pix",
    label: "Brazil PIX route",
    country: "BR",
    rail: "PIX",
    payout_rail: "pix",
    network: "polygon",
    asset: "USDT",
    assets: ["USDT", "USDC"],

    beneficiaryFields: [
      {
        name: "pix_key",
        label: "PIX key",
        type: "text",
        placeholder: "email, CPF, phone, or random key",
        required: true
      }
    ]
  }
];

const COMING_SOON_ROUTES = [
  {
    id: "mx_spei_coming_soon",
    route_id: "mx_spei_coming_soon",
    label: "Mexico SPEI — Coming soon",
    country: "MX",
    rail: "SPEI",
    payout_rail: "spei",
    network: "polygon",
    asset: "USDC",
    assets: ["USDC"],
    disabled: true,
    comingSoon: true,
    status: "coming_soon",
    beneficiaryFields: []
  },
  {
    id: "in_upi_coming_soon",
    route_id: "in_upi_coming_soon",
    label: "India UPI — Coming soon",
    country: "IN",
    rail: "UPI",
    payout_rail: "upi",
    network: "polygon",
    asset: "USDC",
    assets: ["USDC"],
    disabled: true,
    comingSoon: true,
    status: "coming_soon",
    beneficiaryFields: []
  }
];

export const ROUTES = [
  ...FALLBACK_ROUTES,
  ...COMING_SOON_ROUTES
];


function normalizeString(value) {
  return String(value || "").trim();
}


function normalizeUpper(value) {
  return normalizeString(
    value
  ).toUpperCase();
}


function normalizeLower(value) {
  return normalizeString(
    value
  ).toLowerCase();
}


function getRouteCountry(
  route = {}
) {
  return normalizeUpper(
    route.country ||
    route.destination_country ||
    route.destinationCountry
  );
}


function uniqueValues(
  values = []
) {
  return Array.from(
    new Set(
      values
        .map(
          value =>
            normalizeUpper(
              value
            )
        )
        .filter(Boolean)
    )
  );
}


function fallbackPlaceholder(
  field = {}
) {
  const name =
    normalizeLower(
      field.name
    );

  if (
    name.includes(
      "pix"
    )
  ) {
    return "email, CPF, phone, or random key";
  }

  if (
    name.includes(
      "recipient_identifier"
    )
  ) {
    return "phone, account, or wallet identifier";
  }

  if (
    name.includes(
      "recipient_institution"
    )
  ) {
    return "Search bank or wallet";
  }

  if (
    name.includes(
      "institution"
    )
  ) {
    return "Search bank or wallet";
  }

  if (
    name.includes(
      "channel"
    )
  ) {
    return "bank or payout channel";
  }

  return "";
}


function isBrazilPixRoute({
  id,
  label,
  country,
  rail,
  payoutRail
}) {
  const routeId =
    normalizeLower(
      id
    );

  const routeLabel =
    normalizeLower(
      label
    );

  const normalizedCountry =
    normalizeUpper(
      country
    );

  const normalizedRail =
    normalizeLower(
      rail
    );

  const normalizedPayoutRail =
    normalizeLower(
      payoutRail
    );

  return (
    normalizedCountry ===
      "BR" ||
    routeId.includes(
      "br_pix"
    ) ||
    routeId.includes(
      "brazil"
    ) ||
    routeLabel.includes(
      "brazil"
    ) ||
    routeLabel.includes(
      "pix"
    ) ||
    normalizedRail ===
      "pix" ||
    normalizedPayoutRail ===
      "pix"
  );
}


function isComingSoonRoute(
  route = {}
) {
  return Boolean(
    route.comingSoon ||
    route.coming_soon ||
    route.disabled ||
    route.status ===
      "coming_soon"
  );
}


function isConnectVisibleRoute(
  route = {}
) {
  const country =
    getRouteCountry(
      route
    );

  const payoutRail =
    normalizeLower(
      route.payout_rail ||
      route.payoutRail ||
      route.rail
    );

  if (
    country ===
      "PH" &&
    payoutRail ===
      "pesonet"
  ) {
    return false;
  }

  return true;
}


function hasRoute(
  routeId,
  routes = []
) {
  const normalizedRouteId =
    normalizeLower(
      routeId
    );

  return routes.some(
    route =>
      normalizeLower(
        route.id
      ) ===
        normalizedRouteId ||
      normalizeLower(
        route.route_id
      ) ===
        normalizedRouteId
  );
}


function appendComingSoonRoutes(
  routes = []
) {
  const result =
    [...routes];

  COMING_SOON_ROUTES.forEach(
    route => {
      if (
        !hasRoute(
          route.id,
          result
        )
      ) {
        result.push(
          route
        );
      }
    }
  );

  return result;
}


function normalizePhilippinesBeneficiaryField({
  route = {},
  field = {}
} = {}) {
  const country =
    getRouteCountry(
      route
    );

  const name =
    normalizeLower(
      field.name
    );

  if (
    country !==
      "PH" ||
    name !==
      "recipient_institution"
  ) {
    return field;
  }

  return {
    ...field,

    type:
      "select",

    source:
      field.source ||
      "coinsph_ph_payout_channels",

    value_field:
      field.value_field ||
      "channelSubject",

    label_field:
      field.label_field ||
      "label",

    channel_field:
      field.channel_field ||
      "channelName",

    placeholder:
      field.placeholder ||
      "Search bank or wallet"
  };
}


function normalizeBeneficiaryFields(
  route = {}
) {
  if (
    isComingSoonRoute(
      route
    )
  ) {
    return [];
  }

  const backendFields =
    Array.isArray(
      route.beneficiary_fields
    )
      ? route.beneficiary_fields
      : Array.isArray(
          route.beneficiaryFields
        )
        ? route.beneficiaryFields
        : [];

  return backendFields.map(
    rawField => {
      const field =
        normalizePhilippinesBeneficiaryField({
          route,
          field:
            rawField
        });

      return {
        ...field,

        name:
          field.name,

        label:
          field.label ||
          field.name,

        type:
          field.type ||
          "text",

        placeholder:
          field.placeholder ||
          fallbackPlaceholder(
            field
          ),

        required:
          Boolean(
            field.required
          ),

        source:
          field.source ||
          null,

        value_field:
          field.value_field ||
          null,

        label_field:
          field.label_field ||
          null,

        channel_field:
          field.channel_field ||
          null
      };
    }
  );
}


export function normalizeBackendRoute(
  route = {}
) {
  const asset =
    normalizeUpper(
      route.asset
    );

  const backendAssets =
    Array.isArray(
      route.assets
    )
      ? route.assets
      : Array.isArray(
          route.supported_assets
        )
        ? route.supported_assets
        : Array.isArray(
            route.supportedAssets
          )
          ? route.supportedAssets
          : [];

  const sourceCountry =
    route.country ||
    route.destination_country ||
    route.destinationCountry;

  const id =
    route.route_id ||
    route.id ||
    [
      sourceCountry,
      route.rail,
      route.network,
      asset
    ]
      .map(
        part =>
          normalizeLower(
            part
          )
      )
      .filter(Boolean)
      .join("_");

  const label =
    route.label ||
    id;

  const country =
    normalizeUpper(
      sourceCountry
    );

  const rail =
    normalizeUpper(
      route.rail
    );

  const payoutRail =
    normalizeLower(
      route.payout_rail ||
      route.payoutRail ||
      route.rail
    );

  const network =
    normalizeLower(
      route.network
    );

  const isBrazilPix =
    isBrazilPixRoute({
      id,
      label,
      country,
      rail,
      payoutRail
    });

  const assets =
    isBrazilPix
      ? uniqueValues([
          ...backendAssets,
          asset,
          "USDT",
          "USDC"
        ])
      : uniqueValues([
          ...backendAssets,
          asset
        ]);

  const normalizedAsset =
    asset ||
    assets[0] ||
    "";

  const normalizedRoute = {
    ...route,

    id,

    route_id:
      route.route_id ||
      id,

    label,

    country,

    rail,

    payout_rail:
      payoutRail,

    network,

    asset:
      normalizedAsset,

    assets
  };

  return {
    ...normalizedRoute,

    beneficiaryFields:
      normalizeBeneficiaryFields(
        normalizedRoute
      )
  };
}


export function normalizeBackendRoutes(
  routes = []
) {
  const normalized =
    Array.isArray(
      routes
    )
      ? routes.map(
          normalizeBackendRoute
        )
      : [];

  const visible =
    normalized.filter(
      isConnectVisibleRoute
    );

  /*
   * A successful backend response is authoritative.
   *
   * Do not inject FALLBACK_ROUTES when Core returns
   * no live routes. Local fallbacks belong to the
   * route-discovery failure path only.
   */
  return appendComingSoonRoutes(
    visible
  );
}


export function getRouteById(
  routeId,
  routes = ROUTES
) {
  return (
    routes.find(
      route =>
        route.id ===
          routeId ||
        route.route_id ===
          routeId
    ) ||
    routes.find(
      route =>
        !isComingSoonRoute(
          route
        )
    ) ||
    routes[0] ||
    FALLBACK_ROUTES[0]
  );
}


export function getInitialBeneficiary(
  route
) {
  const fields =
    route?.beneficiaryFields ||
    [];

  return fields.reduce(
    (
      acc,
      field
    ) => {
      acc[field.name] =
        "";

      return acc;
    },
    {}
  );
}
