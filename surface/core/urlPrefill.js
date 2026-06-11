// unibrij/unibridge-landing/surface/core/urlPrefill.js

/*
--------------------------------------------------
Surface URL Prefill

Purpose:
- keep URL query parsing outside app.js
- support entry from /pay page
- prefill amount, source country, receiver country
- avoid throwing if fields are missing

Supported query params:
- amount
- source_country
- country

Example:
  /surface?source_country=US&country=PH&amount=5
--------------------------------------------------
*/

function normalizeString(value) {
  return String(value || "").trim();
}

function normalizeCountry(value) {
  return normalizeString(value)
    .toUpperCase();
}

function getUrl() {
  try {
    return new URL(
      window.location.href
    );
  } catch {
    return null;
  }
}

function getParam(param) {
  const url =
    getUrl();

  if (!url || !param) {
    return null;
  }

  const value =
    url.searchParams.get(param);

  return value && String(value).trim()
    ? String(value).trim()
    : null;
}

function getElement(id) {
  if (!id) {
    return null;
  }

  return document.getElementById(id);
}

function setElementValue({
  id,
  value
}) {
  const el =
    getElement(id);

  if (!el) {
    return false;
  }

  el.value =
    value;

  return true;
}

function setInputValueFromUrl({
  param,
  id,
  transform
}) {
  const raw =
    getParam(param);

  if (!raw) {
    return false;
  }

  const value =
    typeof transform === "function"
      ? transform(raw)
      : raw;

  return setElementValue({
    id,
    value
  });
}

export function applyUrlPrefill() {
  const result = {
    amount:
      false,

    source_country:
      false,

    country:
      false
  };

  result.amount =
    setInputValueFromUrl({
      param:
        "amount",

      id:
        "amount"
    });

  result.source_country =
    setInputValueFromUrl({
      param:
        "source_country",

      id:
        "source_country",

      transform:
        normalizeCountry
    });

  result.country =
    setInputValueFromUrl({
      param:
        "country",

      id:
        "country",

      transform:
        normalizeCountry
    });

  return result;
}

export function readSurfaceEntryParams() {
  return {
    amount:
      getParam("amount"),

    source_country:
      getParam("source_country"),

    country:
      getParam("country")
  };
}

export function hasSurfaceEntryParams() {
  const params =
    readSurfaceEntryParams();

  return Boolean(
    params.amount ||
      params.source_country ||
      params.country
  );
}
