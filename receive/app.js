// unibridge-landing/receive/app.js

import {
  extractReceiveToken
} from "/shared/receive/receive.js";

import {
  createReceiveCreateFlow
} from "./receive-create.js";

import {
  createReceiveShareFlow
} from "./receive-share.js";

import {
  createReceivePublicFlow
} from "./receive-public.js";


const els = {
  createView:
    document.getElementById("receiveCreateView"),

  createdView:
    document.getElementById("receiveCreatedView"),

  publicView:
    document.getElementById("receivePublicView"),

  destinationCountry:
    document.getElementById("receiveDestinationCountry"),

  railSection:
    document.getElementById("receiveRailSection"),

  payoutRail:
    document.getElementById("receivePayoutRail"),

  beneficiarySection:
    document.getElementById("receiveBeneficiarySection"),

  beneficiaryFields:
    document.getElementById("receiveBeneficiaryFields"),

  authSection:
    document.getElementById("receiveAuthSection"),

  createError:
    document.getElementById("receiveCreateError"),

  createButton:
    document.getElementById("createReceiveProfileButton"),

  qrCode:
    document.getElementById("receiveQrCode"),

  shareUrl:
    document.getElementById("receiveShareUrl"),

  copyButton:
    document.getElementById("copyReceiveLinkButton"),

  shareButton:
    document.getElementById("shareReceiveLinkButton"),

  createAnotherButton:
    document.getElementById("createAnotherReceiveButton")
};


function normalizeString(value) {
  return String(value ?? "").trim();
}


function setHidden(element, hidden) {
  if (!element) {
    return;
  }

  element.hidden =
    Boolean(hidden);
}


function showOnly(activeId) {
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

  els.createError.textContent = "";

  setHidden(
    els.createError,
    true
  );
}


function showCreateError(message) {
  if (!els.createError) {
    return;
  }

  els.createError.textContent =
    normalizeString(message) ||
    "Something went wrong.";

  setHidden(
    els.createError,
    false
  );
}


async function initCreateMode() {
  const shareFlow =
    createReceiveShareFlow({
      els,
      showOnly
    });

  const createFlow =
    createReceiveCreateFlow({
      els,
      showOnly,
      clearCreateError,
      showCreateError,

      onCreated:
        result =>
          shareFlow.showCreated(
            result
          )
    });

  shareFlow.bind({
    onCreateAnother:
      () =>
        createFlow.reset()
  });

  await createFlow.init();
}


async function initPublicMode(token) {
  const publicFlow =
    createReceivePublicFlow({
      showOnly
    });

  await publicFlow.init(
    token
  );
}


async function init(token) {
  if (token) {
    await initPublicMode(
      token
    );

    return;
  }

  await initCreateMode();
}


const initialToken =
  extractReceiveToken();


init(initialToken)
  .catch(error => {
    console.error(
      initialToken
        ? "RECEIVE_PUBLIC_INIT_FAILED"
        : "RECEIVE_INIT_FAILED",
      error
    );

    if (!initialToken) {
      showCreateError(
        error?.message ||
        "Unable to initialize Receive."
      );
    }
  });
