
 // unibridge-landing/receive/receive-qr.js

const QR_RENDER_SIZE =
  768;

const QR_DISPLAY_SIZE =
  230;

const QR_QUIET_ZONE_MODULES =
  4;

const QR_DARK_COLOR =
  "#0A3B8F";

const QR_LOGO_URL =
  "/public/icons/social/unibridge-android-icon-source-clean.png";

const QR_LOGO_SIZE_RATIO =
  0.18;

const QR_LOGO_CLEAR_RATIO =
  1.10;

const QR_LOGO_ALPHA_THRESHOLD =
  35;


/*
--------------------------------------------------
Canvas helpers
--------------------------------------------------
*/

function createCanvas(
  width,
  height = width
) {
  const canvas =
    document.createElement(
      "canvas"
    );

  canvas.width = width;
  canvas.height = height;

  return canvas;
}


function loadImage(src) {
  return new Promise(
    (resolve, reject) => {
      const image =
        new Image();

      image.onload =
        () => resolve(image);

      image.onerror =
        () => reject(
          new Error(
            "QR logo unavailable."
          )
        );

      image.src = src;
    }
  );
}


function getQrModuleCount(qrCode) {
  const count =
    Number(
      qrCode
        ?._oQRCode
        ?.getModuleCount
        ?.()
    );

  return (
    Number.isFinite(count) &&
    count > 0
  )
    ? count
    : null;
}


/*
--------------------------------------------------
Prepare UniBridge logo
--------------------------------------------------

- Transparent source
- Light U converted to navy
- Cyan orbit preserved
- Transparent padding cropped
- No circular or square badge
--------------------------------------------------
*/

function prepareQrLogo(image) {
  const width =
    image.naturalWidth ||
    image.width;

  const height =
    image.naturalHeight ||
    image.height;

  const canvas =
    createCanvas(
      width,
      height
    );

  const context =
    canvas.getContext(
      "2d",
      {
        willReadFrequently: true
      }
    );

  if (!context) {
    return null;
  }

  context.drawImage(
    image,
    0,
    0
  );

  const imageData =
    context.getImageData(
      0,
      0,
      width,
      height
    );

  const pixels =
    imageData.data;

  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (
    let y = 0;
    y < height;
    y++
  ) {
    for (
      let x = 0;
      x < width;
      x++
    ) {
      const i =
        (y * width + x) * 4;

      const r = pixels[i];
      const g = pixels[i + 1];
      const b = pixels[i + 2];
      const a = pixels[i + 3];

      if (
        a <
        QR_LOGO_ALPHA_THRESHOLD
      ) {
        pixels[i + 3] = 0;
        continue;
      }

      const maxColor =
        Math.max(
          r,
          g,
          b
        );

      const minColor =
        Math.min(
          r,
          g,
          b
        );

      const isLightNeutral =
        r > 175 &&
        g > 175 &&
        b > 175 &&
        maxColor - minColor < 65;

      if (isLightNeutral) {
        pixels[i] = 10;
        pixels[i + 1] = 59;
        pixels[i + 2] = 143;
      }

      minX =
        Math.min(minX, x);

      minY =
        Math.min(minY, y);

      maxX =
        Math.max(maxX, x);

      maxY =
        Math.max(maxY, y);
    }
  }

  if (
    maxX < minX ||
    maxY < minY
  ) {
    return null;
  }

  context.putImageData(
    imageData,
    0,
    0
  );

  const cropWidth =
    maxX - minX + 1;

  const cropHeight =
    maxY - minY + 1;

  const cropSize =
    Math.max(
      cropWidth,
      cropHeight
    );

  const output =
    createCanvas(
      cropSize
    );

  const outputContext =
    output.getContext(
      "2d"
    );

  if (!outputContext) {
    return null;
  }

  outputContext.drawImage(
    canvas,
    minX,
    minY,
    cropWidth,
    cropHeight,
    (cropSize - cropWidth) / 2,
    (cropSize - cropHeight) / 2,
    cropWidth,
    cropHeight
  );

  return output;
}


/*
--------------------------------------------------
Create expanded logo silhouette
--------------------------------------------------

The mask follows visible logo pixels.

Its edges are expanded by a small,
uniform radius.

This creates a genuine white clearance
around the U and cyan orbit.

No circle.
No square.
No transparent holes in the QR.
--------------------------------------------------
*/

function createLogoClearanceMask(
  logoCanvas,
  logoSize,
  clearanceRadius
) {
  const padding =
    Math.ceil(
      clearanceRadius
    );

  const maskSize =
    logoSize +
    padding * 2;

  const source =
    createCanvas(
      maskSize
    );

  const sourceContext =
    source.getContext(
      "2d",
      {
        willReadFrequently: true
      }
    );

  if (!sourceContext) {
    return null;
  }

  sourceContext.imageSmoothingEnabled =
    true;

  sourceContext.imageSmoothingQuality =
    "high";

  sourceContext.drawImage(
    logoCanvas,
    padding,
    padding,
    logoSize,
    logoSize
  );

  const sourceData =
    sourceContext.getImageData(
      0,
      0,
      maskSize,
      maskSize
    );

  const sourcePixels =
    sourceData.data;

  const mask =
    createCanvas(
      maskSize
    );

  const maskContext =
    mask.getContext(
      "2d"
    );

  if (!maskContext) {
    return null;
  }

  const maskData =
    maskContext.createImageData(
      maskSize,
      maskSize
    );

  const outputPixels =
    maskData.data;

  const radius =
    Math.max(
      1,
      Math.ceil(
        clearanceRadius
      )
    );

  const radiusSquared =
    radius * radius;

  const offsets = [];

  for (
    let dy = -radius;
    dy <= radius;
    dy++
  ) {
    for (
      let dx = -radius;
      dx <= radius;
      dx++
    ) {
      if (
        dx * dx +
        dy * dy <=
        radiusSquared
      ) {
        offsets.push([
          dx,
          dy
        ]);
      }
    }
  }

  for (
    let y = 0;
    y < maskSize;
    y++
  ) {
    for (
      let x = 0;
      x < maskSize;
      x++
    ) {
      const index =
        (
          y * maskSize +
          x
        ) * 4;

      const alpha =
        sourcePixels[
          index + 3
        ];

      if (
        alpha <
        QR_LOGO_ALPHA_THRESHOLD
      ) {
        continue;
      }

      for (
        const [dx, dy]
        of offsets
      ) {
        const targetX =
          x + dx;

        const targetY =
          y + dy;

        if (
          targetX < 0 ||
          targetY < 0 ||
          targetX >= maskSize ||
          targetY >= maskSize
        ) {
          continue;
        }

        const targetIndex =
          (
            targetY *
            maskSize +
            targetX
          ) * 4;

        outputPixels[
          targetIndex
        ] = 255;

        outputPixels[
          targetIndex + 1
        ] = 255;

        outputPixels[
          targetIndex + 2
        ] = 255;

        outputPixels[
          targetIndex + 3
        ] = 255;
      }
    }
  }

  maskContext.putImageData(
    maskData,
    0,
    0
  );

  return {
    canvas:
      mask,

    padding
  };
}


/*
--------------------------------------------------
Draw UniBridge logo into QR
--------------------------------------------------

1. Generate a real silhouette clearance.
2. Paint clearance white over QR modules.
3. Draw the transparent UniBridge logo.

The QR canvas remains opaque.

The quiet zone and QR corners are untouched.
--------------------------------------------------
*/

function drawQrLogo(
  qrCanvas,
  logoCanvas
) {
  if (
    !qrCanvas ||
    !logoCanvas
  ) {
    return false;
  }

  const context =
    qrCanvas.getContext(
      "2d"
    );

  if (!context) {
    return false;
  }

  const qrSize =
    Math.min(
      qrCanvas.width,
      qrCanvas.height
    );

  const logoSize =
    Math.round(
      qrSize *
      QR_LOGO_SIZE_RATIO
    );

  const logoX =
    Math.round(
      (
        qrCanvas.width -
        logoSize
      ) / 2
    );

  const logoY =
    Math.round(
      (
        qrCanvas.height -
        logoSize
      ) / 2
    );

  const clearanceRadius =
    Math.max(
      2,
      Math.round(
        logoSize *
        (
          QR_LOGO_CLEAR_RATIO -
          1
        ) / 2
      )
    );

  const clearance =
    createLogoClearanceMask(
      logoCanvas,
      logoSize,
      clearanceRadius
    );

  if (!clearance) {
    return false;
  }

  context.save();

  context.imageSmoothingEnabled =
    true;

  context.imageSmoothingQuality =
    "high";

  /*
  Draw white only where the expanded
  logo silhouette is present.
  */

  context.drawImage(
    clearance.canvas,
    logoX -
      clearance.padding,
    logoY -
      clearance.padding
  );

  /*
  Draw the colored UniBridge logo.
  */

  context.drawImage(
    logoCanvas,
    logoX,
    logoY,
    logoSize,
    logoSize
  );

  context.restore();

  return true;
}


/*
--------------------------------------------------
Add QR quiet zone
--------------------------------------------------
*/

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
    createCanvas(
      outputSize
    );

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


/*
--------------------------------------------------
Render Receive QR
--------------------------------------------------

Logo placement requires error correction H.

If H is unavailable, generate a plain QR
without a logo.
--------------------------------------------------
*/

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

  const correctLevelH =
    window.QRCode
      ?.CorrectLevel
      ?.H;

  const supportsHighCorrection =
    typeof correctLevelH ===
    "number";

  const options = {
    text:
      value,

    width:
      QR_RENDER_SIZE,

    height:
      QR_RENDER_SIZE,

    colorDark:
      QR_DARK_COLOR,

    colorLight:
      "#ffffff"
  };

  if (
    supportsHighCorrection
  ) {
    options.correctLevel =
      correctLevelH;
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

  const moduleCount =
    getQrModuleCount(
      qrCode
    );

  /*
  Never cover QR modules when error
  correction H is unavailable.
  */

  if (
    supportsHighCorrection &&
    moduleCount
  ) {
    try {
      const image =
        await loadImage(
          QR_LOGO_URL
        );

      const logo =
        prepareQrLogo(
          image
        );

      if (logo) {
        drawQrLogo(
          sourceCanvas,
          logo
        );
      }
    }
    catch (error) {
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

  root.appendChild(
    finalCanvas
  );
}


/*
--------------------------------------------------
Export QR as PNG
--------------------------------------------------
*/

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
      type:
        "image/png"
    }
  );
}
