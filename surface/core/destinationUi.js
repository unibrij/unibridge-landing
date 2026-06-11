// unibrij/unibridge-landing/surface/core/destinationUi.js

/*
--------------------------------------------------
Surface Destination UI

Purpose:
- keep destination form visibility outside app.js
- show Brazil PIX fields for BR
- show CoinsPH / GCash fields for PH
- keep unsupported destination handling isolated
- avoid payment/session/route logic here

Notes:
- This module does not build destination payloads.
- This module does not pick routes.
- This module does not create settlements.
- This module does not touch SmartPay / Brazil execution.
--------------------------------------------------
*/

function normalizeCountry(value) {
  return String(value || "")
    .toUpperCase()
    .trim();
}

function getElement(id) {
  if (!id) {
    return null;
  }

  return document.getElementById(id);
}

function resolveElement(value) {
  if (!value) {
    return null;
  }

  if (typeof value === "string") {
    return getElement(value);
  }

  return value;
}

function setDisplay(target, display) {
  const el =
    resolveElement(target);

  if (!el) {
    return false;
  }

  el.style.display =
    display;

  return true;
}

function setVisible(target, visible, {
  visibleDisplay = "",
  hiddenDisplay = "none"
} = {}) {
  return setDisplay(
    target,
    visible
      ? visibleDisplay
      : hiddenDisplay
  );
}

export function updateDestinationUi({
  destinationCountry,
  brazilBox,
  philippinesBox,
  unsupportedBox,
  coinsPhPicker,
  onBrazil,
  onPhilippines,
  onUnsupported
} = {}) {
  const country =
    normalizeCountry(destinationCountry);

  const isBrazil =
    country === "BR";

  const isPhilippines =
    country === "PH";

  setVisible(
    brazilBox,
    isBrazil
  );

  setVisible(
    philippinesBox,
    isPhilippines
  );

  setVisible(
    unsupportedBox,
    Boolean(country && !isBrazil && !isPhilippines)
  );

  if (
    isBrazil &&
    typeof onBrazil === "function"
  ) {
    onBrazil();
  }

  if (isPhilippines) {
    if (
      coinsPhPicker &&
      typeof coinsPhPicker.refresh === "function"
    ) {
      coinsPhPicker.refresh();
    }

    if (typeof onPhilippines === "function") {
      onPhilippines();
    }
  }

  if (
    country &&
    !isBrazil &&
    !isPhilippines &&
    typeof onUnsupported === "function"
  ) {
    onUnsupported(country);
  }

  return {
    country,
    isBrazil,
    isPhilippines,
    isUnsupported:
      Boolean(country && !isBrazil && !isPhilippines)
  };
}

export function setDestinationSectionsDisabled({
  disabled,
  inputs = []
} = {}) {
  const value =
    Boolean(disabled);

  inputs
    .map(resolveElement)
    .filter(Boolean)
    .forEach((input) => {
      input.disabled =
        value;
    });
}
