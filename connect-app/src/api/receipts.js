// connect-app/src/api/receipts.js

import {
  API_BASE,
  parseJson,
  resolveErrorMessage
} from "./client.js";


function normalizeString(
  value
) {
  return String(
    value ||
    ""
  ).trim();
}


export async function downloadReceiptPdf({
  receiptId,
  walletAddress
}) {
  const normalizedReceiptId =
    normalizeString(
      receiptId
    );

  const normalizedWalletAddress =
    normalizeString(
      walletAddress
    );

  if (!normalizedReceiptId) {
    throw new Error(
      "receipt_id_required"
    );
  }

  if (!normalizedWalletAddress) {
    throw new Error(
      "connect_wallet_address_required"
    );
  }

  const response =
    await fetch(
      `${API_BASE}/connect/receipts/${encodeURIComponent(
        normalizedReceiptId
      )}/pdf`,
      {
        method:
          "GET",

        headers: {
          "x-unibridge-wallet-address":
            normalizedWalletAddress
        }
      }
    );

  if (!response.ok) {
    const data =
      await parseJson(
        response
      );

    throw new Error(
      resolveErrorMessage(
        data,
        "receipt_download_failed"
      )
    );
  }

  const contentType =
    String(
      response.headers.get(
        "content-type"
      ) ||
      ""
    ).toLowerCase();

  if (
    !contentType.includes(
      "application/pdf"
    )
  ) {
    throw new Error(
      "receipt_pdf_response_invalid"
    );
  }

  const blob =
    await response.blob();

  if (!blob.size) {
    throw new Error(
      "receipt_pdf_empty"
    );
  }

  const contentDisposition =
    String(
      response.headers.get(
        "content-disposition"
      ) ||
      ""
    );

  const filenameMatch =
    contentDisposition.match(
      /filename\*?=(?:UTF-8''|")?([^";]+)/i
    );

  let filename =
    `unibridge-receipt-${normalizedReceiptId}.pdf`;

  if (filenameMatch?.[1]) {
    try {
      filename =
        decodeURIComponent(
          filenameMatch[1]
            .replace(
              /^"|"$/g,
              ""
            )
            .trim()
        );
    }
    catch {
      filename =
        filenameMatch[1]
          .replace(
            /^"|"$/g,
            ""
          )
          .trim() ||
        filename;
    }
  }

  return {
    blob,
    filename
  };
}
