// unibridge-landing/receive/app.js

import {
  buildReceiveUrl,
  extractReceiveToken
} from "/shared/receive/receive.js";

import {
  loadReceiveCatalog,
  createReceiveProfile
} from "./receive-api.js";

import {
  buildReceiveCatalog,
  railsForCountry,
  findReceiveRoute,
  formatRailLabel,
  renderReceiveFields,
  collectReceiveBeneficiary
} from "./receive-form.js";

import {
  createReceivePublicFlow
} from "./receive-public.js";


const els = {
  createView:
    document.getElementById(
      "receiveCreateView"
    ),

  createdView:
    document.getElementById(
      "receiveCreatedView"
    ),

  publicView:
    document.getElementById(
      "receivePublicView"
    ),

  destinationCountry:
    document.getElementById(
      "receiveDestinationCountry"
    ),

  railSection:
    document.getElementById(
      "receiveRailSection"
    ),

  payoutRail:
    document.getElementById(
      "receivePayoutRail"
    ),

  beneficiarySection:
    document.getElementById(
      "receiveBeneficiarySection"
    ),

  beneficiaryFields:
    document.getElementById(
      "receiveBeneficiaryFields"
    ),

  createError:
    document.getElementById(
      "receiveCreateError"
    ),

  createButton:
    document.getElementById(
      "createReceiveProfileButton"
    ),

  qrCode:
    document.getElementById(
      "receiveQrCode"
    ),

  shareUrl:
    document.getElementById(
      "receiveShareUrl"
    ),

  copyButton:
    document.getElementById(
      "copyReceiveLinkButton"
    ),

  shareButton:
    document.getElementById(
      "shareReceiveLinkButton"
    ),

  createAnotherButton:
    document.getElementById(
      "createAnotherReceiveButton"
    )
};


let catalog =
  [];

let selectedRoute =
  null;

let fieldRenderVersion =
  0;


function normalizeString(
  value
) {
  return String(
    value ??
    ""
  ).trim();
}


function normalizeUpper(
  value
) {
  return normalizeString(
    value
  ).toUpperCase();
}


function setHidden(
  element,
  hidden
) {
  if (!element) {
    return;
  }

  element.hidden =
    Boolean(
      hidden
    );
}


function showOnly(
  activeId
) {
  const views = [
    els.createView,
    els.createdView,
    els.publicView
  ];

  for (const view of views) {
    if (!view) {
      continue;
    }

    view.hidden =
      view.id !== activeId;
  }
}


function clearCreateError() {
  if (!els.createError) {
    return;
  }

  els.createError.textContent =
    "";

  setHidden(
    els.createError,
    true
  );
}


function showCreateError(
  message
) {
  if (!els.createError) {
    return;
  }

  els.createError.textContent =
    normalizeString(
      message
    ) ||
    "Something went wrong.";

  setHidden(
    els.createError,
    false
  );
}


function resetBeneficiary() {
  fieldRenderVersion +=
    1;

  selectedRoute =
    null;

  if (els.beneficiaryFields) {
    els.beneficiaryFields.innerHTML =
      "";
  }

  setHidden(
    els.beneficiarySection,
    true
  );
}


function resetRail() {
  if (els.payoutRail) {
    els.payoutRail.innerHTML =
      "";
  }

  setHidden(
    els.railSection,
    true
  );

  resetBeneficiary();
}


async function handleRailChange() {
  clearCreateError();
  resetBeneficiary();

  const country =
    normalizeUpper(
      els.destinationCountry?.value
    );

  const rail =
    normalizeString(
      els.payoutRail?.value
    );

  selectedRoute =
    findReceiveRoute(
      catalog,
      {
        country,
        rail
      }
    );

  if (!selectedRoute) {
    return;
  }

  const route =
    selectedRoute;

  const renderVersion =
    ++fieldRenderVersion;

  try {
    await renderReceiveFields({
      root:
        els.beneficiaryFields,

      route
    });

    if (
      renderVersion !==
        fieldRenderVersion ||
      selectedRoute !==
        route
    ) {
      return;
    }

    setHidden(
      els.beneficiarySection,
      false
    );
  }
  catch (error) {
    if (
      renderVersion !==
      fieldRenderVersion
    ) {
      return;
    }

    showCreateError(
      error?.message ||
      "Unable to load receiving details."
    );
  }
}


async function handleCountryChange() {
  clearCreateError();
  resetRail();

  const country =
    normalizeUpper(
      els.destinationCountry?.value
    );

  if (
    !country ||
    !els.payoutRail
  ) {
    return;
  }

  const rails =
    railsForCountry(
      catalog,
      country
    );

  if (!rails.length) {
    return;
  }

  const placeholder =
    document.createElement(
      "option"
    );

  placeholder.value =
    "";

  placeholder.textContent =
    "Choose receiving method";

  els.payoutRail.appendChild(
    placeholder
  );

  for (
    const rail
    of rails
  ) {
    const option =
      document.createElement(
        "option"
      );

    option.value =
      rail;

    option.textContent =
      formatRailLabel(
        rail
      );

    els.payoutRail.appendChild(
      option
    );
  }

  setHidden(
    els.railSection,
    false
  );

  if (
    rails.length === 1
  ) {
    els.payoutRail.value =
      rails[0];

    await handleRailChange();
  }
}


function extractCreatedToken(
  payload
) {
  return normalizeString(
    payload?.token ??
    payload?.receive_token ??
    payload?.public_token
  );
}


function renderQrCode({
  root,
  value
}) {
  if (!root) {
    return;
  }

  root.innerHTML =
    "";

  if (
    typeof window.QRCode !==
    "function"
  ) {
    root.textContent =
      "QR unavailable";

    return;
  }

  new window.QRCode(
    root,
    {
      text:
        value,

      width:
        210,

      height:
        210
    }
  );
}


async function handleCreate() {
  clearCreateError();

  if (!selectedRoute) {
    showCreateError(
      "Choose a receiving method."
    );

    return;
  }

  let beneficiary;

  try {
    beneficiary =
      collectReceiveBeneficiary(
        els.beneficiaryFields
      );
  }
  catch (error) {
    showCreateError(
      error?.message
    );

    return;
  }

  if (!els.createButton) {
    return;
  }

  const originalText =
    els.createButton.textContent;

  els.createButton.disabled =
    true;

  els.createButton.textContent =
    "Creating…";

  try {
    const result =
      await createReceiveProfile({
        routeId:
          selectedRoute.route_id,

        beneficiary
      });

    const token =
      extractCreatedToken(
        result
      );

    if (!token) {
      throw new Error(
        "Receive token missing."
      );
    }

    const url =
      buildReceiveUrl(
        token
      );

    if (els.shareUrl) {
      els.shareUrl.value =
        url;
    }

    showOnly(
      "receiveCreatedView"
    );

    renderQrCode({
      root:
        els.qrCode,

      value:
        url
    });

    if (
      els.shareButton &&
      navigator.share
    ) {
      setHidden(
        els.shareButton,
        false
      );
    }
  }
  catch (error) {
    showCreateError(
      error?.message ||
      "Unable to create receive link."
    );
  }
  finally {
    els.createButton.disabled =
      false;

    els.createButton.textContent =
      originalText;
  }
}


async function copyReceiveLink() {
  const value =
    normalizeString(
      els.shareUrl?.value
    );

  if (!value) {
    return;
  }

  await navigator.clipboard.writeText(
    value
  );

  if (!els.copyButton) {
    return;
  }

  const originalText =
    els.copyButton.textContent;

  els.copyButton.textContent =
    "Copied";

  window.setTimeout(
    () => {
      els.copyButton.textContent =
        originalText;
    },
    1200
  );
}


async function shareReceiveLink() {
  const url =
    normalizeString(
      els.shareUrl?.value
    );

  if (
    !url ||
    !navigator.share
  ) {
    return;
  }

  await navigator.share({
    title:
      "Receive with UniBridge",

    text:
      "Pay me with UniBridge.",

    url
  });
}


function resetCreateView() {
  clearCreateError();

  selectedRoute =
    null;

  if (els.destinationCountry) {
    els.destinationCountry.value =
      "";
  }

  if (els.shareUrl) {
    els.shareUrl.value =
      "";
  }

  if (els.qrCode) {
    els.qrCode.innerHTML =
      "";
  }

  resetRail();

  showOnly(
    "receiveCreateView"
  );
}


function bindCreateEvents() {
  els.destinationCountry
    ?.addEventListener(
      "change",
      () => {
        handleCountryChange()
          .catch(
            showCreateError
          );
      }
    );

  els.payoutRail
    ?.addEventListener(
      "change",
      () => {
        handleRailChange()
          .catch(
            showCreateError
          );
      }
    );

  els.createButton
    ?.addEventListener(
      "click",
      handleCreate
    );

  els.copyButton
    ?.addEventListener(
      "click",
      () => {
        copyReceiveLink()
          .catch(
            () => {}
          );
      }
    );

  els.shareButton
    ?.addEventListener(
      "click",
      () => {
        shareReceiveLink()
          .catch(
            () => {}
          );
      }
    );

  els.createAnotherButton
    ?.addEventListener(
      "click",
      resetCreateView
    );
}


async function initCreateMode() {
  showOnly(
    "receiveCreateView"
  );

  bindCreateEvents();

  const payload =
    await loadReceiveCatalog();

  catalog =
    buildReceiveCatalog(
      payload
    );

  if (!catalog.length) {
    throw new Error(
      "No receive routes are currently available."
    );
  }

  await handleCountryChange();
}


async function init() {
  const token =
    extractReceiveToken();

  if (token) {
    const publicFlow =
      createReceivePublicFlow({
        showOnly
      });

    await publicFlow.init(
      token
    );

    return;
  }

  await initCreateMode();
}


init().catch(
  error => {
    console.error(
      "RECEIVE_INIT_FAILED",
      error
    );

    showCreateError(
      error?.message ||
      "Unable to initialize Receive."
    );
  }
);
