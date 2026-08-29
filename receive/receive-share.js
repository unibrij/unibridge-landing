// unibridge-landing/receive/receive-share.js

import {
  buildReceiveUrl
} from "/shared/receive/receive.js";

import {
  renderReceiveQr,
  buildReceiveQrShareFile
} from "/receive/receive-qr.js";


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


function extractCreatedToken(payload) {
  return normalizeString(
    payload?.token ??
    payload?.receive_token ??
    payload?.public_token
  );
}


function buildAbsoluteReceiveUrl(token) {
  const receiveUrl =
    buildReceiveUrl(token);

  return new URL(
    receiveUrl,
    window.location.origin
  ).toString();
}


function canShareFile(file) {
  if (
    !file ||
    typeof navigator.canShare !==
      "function"
  ) {
    return false;
  }

  try {
    return navigator.canShare({
      files: [
        file
      ]
    });
  }
  catch {
    return false;
  }
}


export function createReceiveShareFlow({
  els,
  showOnly
} = {}) {
  let eventsBound =
    false;


  function reset() {
    if (els?.shareUrl) {
      els.shareUrl.value =
        "";
    }

    if (els?.qrCode) {
      els.qrCode.innerHTML =
        "";
    }

    setHidden(
      els?.shareButton,
      true
    );
  }


  async function showCreated(payload) {
    const token =
      extractCreatedToken(
        payload
      );

    if (!token) {
      throw new Error(
        "Receive token missing."
      );
    }

    const url =
      buildAbsoluteReceiveUrl(
        token
      );

    if (els?.shareUrl) {
      els.shareUrl.value =
        url;
    }

    await renderReceiveQr({
      root:
        els?.qrCode,

      value:
        url
    });

    setHidden(
      els?.shareButton,
      typeof navigator.share !==
        "function"
    );

    showOnly?.(
      "receiveCreatedView"
    );

    return {
      token,
      url
    };
  }


  async function copyLink() {
    const url =
      normalizeString(
        els?.shareUrl?.value
      );

    if (!url) {
      return;
    }

    if (
      !navigator.clipboard ||
      typeof navigator.clipboard
        .writeText !==
        "function"
    ) {
      throw new Error(
        "Copy is not available in this browser."
      );
    }

    await navigator.clipboard
      .writeText(
        url
      );

    if (!els?.copyButton) {
      return;
    }

    const originalText =
      els.copyButton
        .textContent;

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


  async function shareLink() {
    const url =
      normalizeString(
        els?.shareUrl?.value
      );

    if (
      !url ||
      typeof navigator.share !==
        "function"
    ) {
      return;
    }

    const qrFile =
      await buildReceiveQrShareFile(
        els?.qrCode
      );

    if (
      qrFile &&
      canShareFile(
        qrFile
      )
    ) {
      await navigator.share({
        title:
          "Receive with UniBridge",

        text:
          `Pay me with UniBridge.\n${url}`,

        files: [
          qrFile
        ]
      });

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


  function bind({
    onCreateAnother
  } = {}) {
    if (eventsBound) {
      return;
    }

    eventsBound =
      true;

    els?.copyButton
      ?.addEventListener(
        "click",
        () => {
          copyLink()
            .catch(error => {
              console.error(
                "RECEIVE_COPY_FAILED",
                error
              );
            });
        }
      );

    els?.shareButton
      ?.addEventListener(
        "click",
        () => {
          shareLink()
            .catch(error => {
              if (
                error?.name ===
                "AbortError"
              ) {
                return;
              }

              console.error(
                "RECEIVE_SHARE_FAILED",
                error
              );
            });
        }
      );

    els?.createAnotherButton
      ?.addEventListener(
        "click",
        () => {
          reset();

          if (
            typeof onCreateAnother ===
            "function"
          ) {
            onCreateAnother();
          }
        }
      );
  }


  return {
    bind,
    reset,
    showCreated
  };
}
