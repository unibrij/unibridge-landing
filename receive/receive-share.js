// unibridge-landing/receive/receive-share.js

import {
  buildReceiveUrl
} from "/shared/receive/receive.js";


const QR_SIZE =
  210;

const QR_LOGO_URL =
  "/connect/icons/app/ub-app-icon-512.png";

const QR_LOGO_RATIO =
  0.27;

const QR_LOGO_CROP_RATIO =
  0.88;

const QR_LOGO_BACKGROUND_RADIUS_RATIO =
  0.22;


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


function loadImage(src) {
  return new Promise(
    (resolve, reject) => {
      const image =
        new Image();

      image.onload =
        () => {
          resolve(image);
        };

      image.onerror =
        () => {
          reject(
            new Error(
              "QR logo unavailable."
            )
          );
        };

      image.src =
        src;
    }
  );
}


function drawRoundedRect(
  context,
  x,
  y,
  width,
  height,
  radius
) {
  const safeRadius =
    Math.min(
      radius,
      width / 2,
      height / 2
    );

  context.beginPath();

  context.moveTo(
    x + safeRadius,
    y
  );

  context.lineTo(
    x + width - safeRadius,
    y
  );

  context.quadraticCurveTo(
    x + width,
    y,
    x + width,
    y + safeRadius
  );

  context.lineTo(
    x + width,
    y + height - safeRadius
  );

  context.quadraticCurveTo(
    x + width,
    y + height,
    x + width - safeRadius,
    y + height
  );

  context.lineTo(
    x + safeRadius,
    y + height
  );

  context.quadraticCurveTo(
    x,
    y + height,
    x,
    y + height - safeRadius
  );

  context.lineTo(
    x,
    y + safeRadius
  );

  context.quadraticCurveTo(
    x,
    y,
    x + safeRadius,
    y
  );

  context.closePath();
}


function drawQrLogo(
  canvas,
  image
) {
  if (
    !canvas ||
    !image
  ) {
    return;
  }

  const context =
    canvas.getContext(
      "2d"
    );

  if (!context) {
    return;
  }

  const logoSize =
    Math.round(
      Math.min(
        canvas.width,
        canvas.height
      ) *
      QR_LOGO_RATIO
    );

  const padding =
    Math.max(
      3,
      Math.round(
        logoSize * 0.08
      )
    );

  const backgroundSize =
    logoSize +
    padding * 2;

  const backgroundX =
    Math.round(
      (
        canvas.width -
        backgroundSize
      ) /
      2
    );

  const backgroundY =
    Math.round(
      (
        canvas.height -
        backgroundSize
      ) /
      2
    );

  const backgroundRadius =
    Math.round(
      backgroundSize *
      QR_LOGO_BACKGROUND_RADIUS_RATIO
    );

  const imageWidth =
    image.naturalWidth ||
    image.width;

  const imageHeight =
    image.naturalHeight ||
    image.height;

  const sourceSize =
    Math.round(
      Math.min(
        imageWidth,
        imageHeight
      ) *
      QR_LOGO_CROP_RATIO
    );

  const sourceX =
    Math.round(
      (
        imageWidth -
        sourceSize
      ) /
      2
    );

  const sourceY =
    Math.round(
      (
        imageHeight -
        sourceSize
      ) /
      2
    );

  const logoX =
    Math.round(
      (
        canvas.width -
        logoSize
      ) /
      2
    );

  const logoY =
    Math.round(
      (
        canvas.height -
        logoSize
      ) /
      2
    );

  context.save();

  context.fillStyle =
    "#ffffff";

  drawRoundedRect(
    context,
    backgroundX,
    backgroundY,
    backgroundSize,
    backgroundSize,
    backgroundRadius
  );

  context.fill();

  context.drawImage(
    image,
    sourceX,
    sourceY,
    sourceSize,
    sourceSize,
    logoX,
    logoY,
    logoSize,
    logoSize
  );

  context.restore();
}


async function renderQrCode({
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

  const options = {
    text:
      value,

    width:
      QR_SIZE,

    height:
      QR_SIZE
  };

  if (
    window.QRCode
      ?.CorrectLevel
      ?.H !==
    undefined
  ) {
    options.correctLevel =
      window.QRCode
        .CorrectLevel
        .H;
  }

  new window.QRCode(
    root,
    options
  );

  const canvas =
    root.querySelector(
      "canvas"
    );

  if (!canvas) {
    return;
  }

  try {
    const logo =
      await loadImage(
        QR_LOGO_URL
      );

    drawQrLogo(
      canvas,
      logo
    );
  }
  catch (error) {
    console.warn(
      "RECEIVE_QR_LOGO_FAILED",
      error
    );
  }
}


function canvasToBlob(canvas) {
  return new Promise(resolve => {
    if (
      !canvas ||
      typeof canvas.toBlob !==
        "function"
    ) {
      resolve(null);
      return;
    }

    canvas.toBlob(
      blob => {
        resolve(
          blob ||
          null
        );
      },
      "image/png"
    );
  });
}


async function buildQrShareFile(root) {
  const canvas =
    root?.querySelector?.(
      "canvas"
    );

  if (!canvas) {
    return null;
  }

  const blob =
    await canvasToBlob(
      canvas
    );

  if (!blob) {
    return null;
  }

  return new File(
    [blob],
    "unibridge-receive-qr.png",
    {
      type:
        "image/png"
    }
  );
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

    await renderQrCode({
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
      await buildQrShareFile(
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
