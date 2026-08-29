// unibridge-landing/receive/receive-qr.js

const QR_RENDER_SIZE =
  768;

const QR_DISPLAY_SIZE =
  230;

const QR_QUIET_ZONE_MODULES =
  4;

const QR_LOGO_URL =
  "/connect/icons/app/ub-app-icon-512.png";

const QR_LOGO_RATIO =
  0.18;

const QR_LOGO_CROP_RATIO =
  0.88;

const QR_LOGO_PADDING_RATIO =
  0.07;

const QR_LOGO_BACKGROUND_RADIUS_RATIO =
  0.22;


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

  const qrSize =
    Math.min(
      canvas.width,
      canvas.height
    );

  const logoSize =
    Math.round(
      qrSize *
      QR_LOGO_RATIO
    );

  const padding =
    Math.max(
      4,
      Math.round(
        logoSize *
        QR_LOGO_PADDING_RATIO
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


function getQrModuleCount(qrCode) {
  const moduleCount =
    Number(
      qrCode
        ?._oQRCode
        ?.getModuleCount
        ?.()
    );

  if (
    Number.isFinite(
      moduleCount
    ) &&
    moduleCount > 0
  ) {
    return moduleCount;
  }

  return null;
}


function addQrQuietZone(
  sourceCanvas,
  moduleCount
) {
  if (!sourceCanvas) {
    return null;
  }

  const sourceSize =
    Math.min(
      sourceCanvas.width,
      sourceCanvas.height
    );

  const quietZone =
    moduleCount
      ? Math.ceil(
          (
            sourceSize /
            moduleCount
          ) *
          QR_QUIET_ZONE_MODULES
        )
      : Math.ceil(
          sourceSize *
          0.10
        );

  const outputSize =
    sourceSize +
    quietZone * 2;

  const canvas =
    document.createElement(
      "canvas"
    );

  canvas.width =
    outputSize;

  canvas.height =
    outputSize;

  const context =
    canvas.getContext(
      "2d"
    );

  if (!context) {
    return null;
  }

  context.save();

  context.imageSmoothingEnabled =
    false;

  context.fillStyle =
    "#ffffff";

  context.fillRect(
    0,
    0,
    outputSize,
    outputSize
  );

  context.drawImage(
    sourceCanvas,
    quietZone,
    quietZone
  );

  context.restore();

  canvas.style.width =
    `${QR_DISPLAY_SIZE}px`;

  canvas.style.height =
    "auto";

  canvas.style.maxWidth =
    "100%";

  return canvas;
}


export async function renderReceiveQr({
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
      QR_RENDER_SIZE,

    height:
      QR_RENDER_SIZE,

    colorDark:
      "#000000",

    colorLight:
      "#ffffff"
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

  const qrCode =
    new window.QRCode(
      root,
      options
    );

  const sourceCanvas =
    root.querySelector(
      "canvas"
    );

  if (!sourceCanvas) {
    return;
  }

  try {
    const logo =
      await loadImage(
        QR_LOGO_URL
      );

    drawQrLogo(
      sourceCanvas,
      logo
    );
  }
  catch (error) {
    console.warn(
      "RECEIVE_QR_LOGO_FAILED",
      error
    );
  }

  const moduleCount =
    getQrModuleCount(
      qrCode
    );

  const finalCanvas =
    addQrQuietZone(
      sourceCanvas,
      moduleCount
    );

  if (!finalCanvas) {
    sourceCanvas.style.width =
      `${QR_DISPLAY_SIZE}px`;

    sourceCanvas.style.height =
      "auto";

    sourceCanvas.style.maxWidth =
      "100%";

    return;
  }

  root.innerHTML =
    "";

  root.appendChild(
    finalCanvas
  );
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


export async function buildReceiveQrShareFile(
  root
) {
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
