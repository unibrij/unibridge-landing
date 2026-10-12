// unibridge-landing/receive/receive-qr.js

const QR_RENDER_SIZE = 768;
const QR_DISPLAY_SIZE = 230;
const QR_QUIET_ZONE_MODULES = 4;

const QR_DARK_COLOR = "#0A3B8F";
const QR_LOGO_URL =
  "/icons/social/unibridge-android-icon-source-clean.png";

const QR_CENTER_RESERVE_RATIO = 0.20;
const QR_LOGO_CROP_RATIO = 1;
const QR_LOGO_INSET_RATIO = 0.04;


function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();

    image.onload = () => {
      resolve(image);
    };

    image.onerror = () => {
      reject(
        new Error("QR logo unavailable.")
      );
    };

    image.src = src;
  });
}


function getQrModuleCount(qrCode) {
  const moduleCount = Number(
    qrCode
      ?._oQRCode
      ?.getModuleCount
      ?.()
  );

  if (
    Number.isFinite(moduleCount) &&
    moduleCount > 0
  ) {
    return moduleCount;
  }

  return null;
}


function getCenterReservation(
  canvas,
  moduleCount
) {
  if (
    !canvas ||
    !moduleCount
  ) {
    return null;
  }

  let reserveModules = Math.floor(
    moduleCount *
    QR_CENTER_RESERVE_RATIO
  );

  if (
    reserveModules % 2 === 0
  ) {
    reserveModules -= 1;
  }

  reserveModules = Math.max(
    5,
    reserveModules
  );

  const startModule = Math.floor(
    (
      moduleCount -
      reserveModules
    ) / 2
  );

  const endModule =
    startModule +
    reserveModules;

  const x1 = Math.round(
    canvas.width *
    startModule /
    moduleCount
  );

  const y1 = Math.round(
    canvas.height *
    startModule /
    moduleCount
  );

  const x2 = Math.round(
    canvas.width *
    endModule /
    moduleCount
  );

  const y2 = Math.round(
    canvas.height *
    endModule /
    moduleCount
  );

  return {
    x: x1,
    y: y1,
    width: x2 - x1,
    height: y2 - y1
  };
}


function reserveQrCenter(
  canvas,
  moduleCount
) {
  const reservation =
    getCenterReservation(
      canvas,
      moduleCount
    );

  if (!reservation) {
    return null;
  }

  const context =
    canvas.getContext("2d");

  if (!context) {
    return null;
  }

  context.save();

  context.fillStyle =
    "#ffffff";

  context.fillRect(
    reservation.x,
    reservation.y,
    reservation.width,
    reservation.height
  );

  context.restore();

  return reservation;
}


function drawQrLogo(
  canvas,
  image,
  reservation
) {
  if (
    !canvas ||
    !image ||
    !reservation
  ) {
    return;
  }

  const context =
    canvas.getContext("2d");

  if (!context) {
    return;
  }

  const reservationSize = Math.min(
    reservation.width,
    reservation.height
  );

  const inset = Math.max(
    2,
    Math.round(
      reservationSize *
      QR_LOGO_INSET_RATIO
    )
  );

  const logoSize = Math.max(
    1,
    reservationSize -
    inset * 2
  );

  const logoX = Math.round(
    reservation.x +
    (reservation.width - logoSize) / 2
  );

  const logoY = Math.round(
    reservation.y +
    (reservation.height - logoSize) / 2
  );

  const imageWidth =
    image.naturalWidth ||
    image.width;

  const imageHeight =
    image.naturalHeight ||
    image.height;

  const sourceSize = Math.round(
    Math.min(
      imageWidth,
      imageHeight
    ) *
    QR_LOGO_CROP_RATIO
  );

  const sourceX = Math.round(
    (
      imageWidth -
      sourceSize
    ) / 2
  );

  const sourceY = Math.round(
    (
      imageHeight -
      sourceSize
    ) / 2
  );

  context.save();

  context.imageSmoothingEnabled =
    true;

  context.imageSmoothingQuality =
    "high";

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


function addQrQuietZone(
  sourceCanvas,
  moduleCount
) {
  if (!sourceCanvas) {
    return null;
  }

  const sourceSize = Math.min(
    sourceCanvas.width,
    sourceCanvas.height
  );

  const quietZone = moduleCount
    ? Math.ceil(
        (
          sourceSize /
          moduleCount
        ) *
        QR_QUIET_ZONE_MODULES
      )
    : Math.ceil(
        sourceSize * 0.10
      );

  const outputSize =
    sourceSize +
    quietZone * 2;

  const canvas =
    document.createElement(
      "canvas"
    );

  canvas.width = outputSize;
  canvas.height = outputSize;

  const context =
    canvas.getContext("2d");

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

  root.innerHTML = "";

  if (
    typeof window.QRCode !==
    "function"
  ) {
    root.textContent =
      "QR unavailable";
    return;
  }

  const options = {
    text: value,
    width: QR_RENDER_SIZE,
    height: QR_RENDER_SIZE,
    colorDark: QR_DARK_COLOR,
    colorLight: "#ffffff"
  };

  if (
    window.QRCode
      ?.CorrectLevel
      ?.H !== undefined
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
    root.querySelector("canvas");

  if (!sourceCanvas) {
    return;
  }

  const moduleCount =
    getQrModuleCount(qrCode);

  if (moduleCount) {
    try {
      const logo =
        await loadImage(
          QR_LOGO_URL
        );

      const reservation =
        reserveQrCenter(
          sourceCanvas,
          moduleCount
        );

      if (reservation) {
        drawQrLogo(
          sourceCanvas,
          logo,
          reservation
        );
      }
    } catch (error) {
      console.warn(
        "RECEIVE_QR_LOGO_FAILED",
        error
      );
    }
  }

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

  root.innerHTML = "";
  root.appendChild(finalCanvas);
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
          blob || null
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
      type: "image/png"
    }
  );
}
