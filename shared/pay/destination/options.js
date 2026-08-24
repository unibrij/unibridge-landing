// shared/pay/destination/options.js


const optionCache =
  new Map();


function normalizeString(
  value
) {
  return String(
    value ??
    ""
  ).trim();
}


function normalizeComparable(
  value
) {
  return normalizeString(
    value
  ).toLowerCase();
}


function normalizeArray(
  value
) {
  return Array.isArray(
    value
  )
    ? value
    : [];
}


function isObject(
  value
) {
  return Boolean(
    value &&
    typeof value ===
      "object" &&
    !Array.isArray(
      value
    )
  );
}


/*
--------------------------------------------------
Endpoint
--------------------------------------------------
*/

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
      "/api/proxy?"
    )
  ) {
    return normalized;
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
  }
  else if (
    normalized.startsWith(
      "v2/"
    )
  ) {
    normalized =
      normalized.slice(
        "v2/".length
      );
  }
  else {
    normalized =
      normalized.replace(
        /^\/+/,
        ""
      );
  }


  return normalized;
}


function buildProxyEndpoint(
  endpoint
) {
  const normalized =
    normalizeBackendEndpoint(
      endpoint
    );


  if (!normalized) {
    return "";
  }


  if (
    normalized.startsWith(
      "/api/proxy?"
    )
  ) {
    return normalized;
  }


  const [
    path,
    queryString = ""
  ] =
    normalized.split(
      "?"
    );


  const normalizedPath =
    normalizeString(
      path
    );


  if (!normalizedPath) {
    return "";
  }


  const proxyParams =
    new URLSearchParams();


  proxyParams.set(
    "endpoint",
    normalizedPath
  );


  if (queryString) {
    const sourceParams =
      new URLSearchParams(
        queryString
      );


    for (
      const [
        key,
        value
      ] of
        sourceParams.entries()
    ) {
      proxyParams.append(
        key,
        value
      );
    }
  }


  return (
    `/api/proxy?${proxyParams.toString()}`
  );
}


export function resolveDynamicOptionEndpoint(
  field = {}
) {
  const options =
    isObject(
      field.options
    )
      ? field.options
      : {};


  const source =
    isObject(
      field.options_source
    )
      ? field.options_source
      : isObject(
          field.optionsSource
        )
        ? field.optionsSource
        : {};


  const endpoint =
    normalizeString(
      options.endpoint
    ) ||
    normalizeString(
      field.options_endpoint
    ) ||
    normalizeString(
      field.optionsEndpoint
    ) ||
    normalizeString(
      source.endpoint
    ) ||
    normalizeString(
      source.url
    );


  if (!endpoint) {
    return "";
  }


  return buildProxyEndpoint(
    endpoint
  );
}


/*
--------------------------------------------------
Field metadata
--------------------------------------------------
*/

function resolveFieldValueKey(
  field = {}
) {
  const options =
    isObject(
      field.options
    )
      ? field.options
      : {};


  return normalizeString(
    options.value_field ||
    options.valueField ||
    field.value_field ||
    field.valueField
  );
}


function resolveFieldLabelKey(
  field = {}
) {
  const options =
    isObject(
      field.options
    )
      ? field.options
      : {};


  return normalizeString(
    options.label_field ||
    options.labelField ||
    field.label_field ||
    field.labelField
  );
}


function resolveFieldChannelKey(
  field = {}
) {
  const options =
    isObject(
      field.options
    )
      ? field.options
      : {};


  return normalizeString(
    options.channel_field ||
    options.channelField ||
    field.channel_field ||
    field.channelField
  );
}


export function resolveFieldSchemaKey(
  field = {}
) {
  const options =
    isObject(
      field.options
    )
      ? field.options
      : {};


  return normalizeString(
    options.field_schema_field ||
    options.fieldSchemaField ||
    field.field_schema_field ||
    field.fieldSchemaField
  );
}


/*
--------------------------------------------------
Payload normalization
--------------------------------------------------
*/

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


  if (!isObject(payload)) {
    return [];
  }


  const candidates = [
    payload.data,
    payload.options,
    payload.items,
    payload.results,
    payload.channels,
    payload.banks
  ];


  for (
    const candidate of
      candidates
  ) {
    if (
      Array.isArray(
        candidate
      )
    ) {
      return candidate;
    }
  }


  return [];
}


/*
--------------------------------------------------
Option values
--------------------------------------------------
*/

export function resolveOptionValue(
  option = {},
  field = {}
) {
  if (
    !isObject(
      option
    )
  ) {
    return normalizeString(
      option
    );
  }


  const valueField =
    resolveFieldValueKey(
      field
    );


  if (
    valueField &&
    option[
      valueField
    ] !== undefined
  ) {
    return normalizeString(
      option[
        valueField
      ]
    );
  }


  return normalizeString(
    option.value ??
    option.id ??
    option.code ??
    option.key ??
    option.name
  );
}


export function resolveOptionLabel(
  option = {},
  field = {}
) {
  if (
    !isObject(
      option
    )
  ) {
    return normalizeString(
      option
    );
  }


  const labelField =
    resolveFieldLabelKey(
      field
    );


  if (
    labelField &&
    option[
      labelField
    ] !== undefined
  ) {
    return (
      normalizeString(
        option[
          labelField
        ]
      ) ||
      resolveOptionValue(
        option,
        field
      )
    );
  }


  return (
    normalizeString(
      option.label ??
      option.title ??
      option.display_name ??
      option.displayName ??
      option.name
    ) ||
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
  if (
    !isObject(
      option
    )
  ) {
    return "";
  }


  const channelField =
    resolveFieldChannelKey(
      field
    );


  if (!channelField) {
    return "";
  }


  return normalizeComparable(
    option[
      channelField
    ]
  );
}


/*
--------------------------------------------------
Route channel
--------------------------------------------------
*/

function resolveRouteChannel(
  route = {}
) {
  return normalizeComparable(
    route.channel ||
    route.channel_name ||
    route.channelName ||
    route.payout_rail ||
    route.payoutRail ||
    route.rail
  );
}


/*
--------------------------------------------------
Option normalization
--------------------------------------------------
*/

function normalizeFieldOption(
  option,
  field
) {
  const value =
    resolveOptionValue(
      option,
      field
    );


  if (!value) {
    return null;
  }


  return {
    value,

    label:
      resolveOptionLabel(
        option,
        field
      ) ||
      value,

    raw:
      option
  };
}


function uniqueByValue(
  options = []
) {
  const map =
    new Map();


  for (
    const option of
      options
  ) {
    if (
      !option?.value ||
      map.has(
        option.value
      )
    ) {
      continue;
    }


    map.set(
      option.value,
      option
    );
  }


  return Array.from(
    map.values()
  );
}


/*
--------------------------------------------------
Filtering
--------------------------------------------------
*/

export function filterFieldOptions({
  field = {},
  options = [],
  route = {},
  selectedRoute = null
} = {}) {
  const resolvedRoute =
    selectedRoute ||
    route ||
    {};


  const routeChannel =
    resolveRouteChannel(
      resolvedRoute
    );


  const channelField =
    resolveFieldChannelKey(
      field
    );


  const normalized =
    normalizeArray(
      options
    )
      .map(
        option => ({
          raw:
            option,

          normalized:
            normalizeFieldOption(
              option,
              field
            )
        })
      )
      .filter(
        item =>
          Boolean(
            item.normalized
          )
      );


  /*
  ------------------------------------------------
  No channel metadata on the field means there is
  no frontend filtering contract.

  Return backend options as provided.
  ------------------------------------------------
  */

  if (
    !channelField ||
    !routeChannel
  ) {
    return uniqueByValue(
      normalized.map(
        item =>
          item.normalized
      )
    );
  }


  /*
  ------------------------------------------------
  Channel filtering is strict.

  If the route declares a channel and the field
  declares which option property contains that
  channel, only exact normalized matches survive.

  No fallback to unrelated options.
  ------------------------------------------------
  */

  const filtered =
    normalized.filter(
      item => {
        const optionChannel =
          resolveOptionChannel(
            item.raw,
            field
          );


        if (!optionChannel) {
          return false;
        }


        return (
          optionChannel ===
          routeChannel
        );
      }
    );


  return uniqueByValue(
    filtered.map(
      item =>
        item.normalized
    )
  );
}


/*
--------------------------------------------------
HTTP
--------------------------------------------------
*/

async function fetchDynamicOptions(
  endpoint
) {
  const response =
    await fetch(
      endpoint,
      {
        method:
          "GET",

        headers: {
          Accept:
            "application/json"
        }
      }
    );


  if (!response.ok) {
    throw new Error(
      `dynamic_options_failed:${response.status}`
    );
  }


  const payload =
    await response.json();


  return normalizeDynamicOptions(
    payload
  );
}


/*
--------------------------------------------------
Load
--------------------------------------------------
*/

export async function loadDynamicOptions({
  field = {},
  route = {},
  force = false
} = {}) {
  const endpoint =
    resolveDynamicOptionEndpoint(
      field
    );


  if (!endpoint) {
    return [];
  }


  let promise =
    optionCache.get(
      endpoint
    );


  if (
    !promise ||
    force
  ) {
    promise =
      fetchDynamicOptions(
        endpoint
      )
        .catch(
          error => {
            optionCache.delete(
              endpoint
            );

            throw error;
          }
        );


    optionCache.set(
      endpoint,
      promise
    );
  }


  const rawOptions =
    await promise;


  return filterFieldOptions({
    field,
    options:
      rawOptions,
    route
  });
}


/*
--------------------------------------------------
Renderer adapter
--------------------------------------------------
*/

export function createDestinationOptionsResolver({
  route = {}
} = {}) {
  return async function resolveOptions({
    field,
    values
  } = {}) {
    /*
    ------------------------------------------------
    values is intentionally part of the shared
    resolver contract.

    Current catalog endpoints do not require it.
    Future dependent endpoints may consume it
    without changing fieldRenderer.js.
    ------------------------------------------------
    */

    void values;


    return loadDynamicOptions({
      field,
      route
    });
  };
}


/*
--------------------------------------------------
Cache
--------------------------------------------------
*/

export function clearDestinationOptionsCache(
  endpoint = null
) {
  const normalized =
    normalizeString(
      endpoint
    );


  if (!normalized) {
    optionCache.clear();

    return;
  }


  optionCache.delete(
    normalized
  );
}
