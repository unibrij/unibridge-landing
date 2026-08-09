// connect-app/src/flow/waitForWalletManagedFunding.js

const DEFAULT_POLL_INTERVAL_MS =
  1500;

const DEFAULT_TIMEOUT_MS =
  120000;

const STATUS_FAMILY_PENDING =
  1;

const STATUS_FAMILY_CONFIRMED =
  2;

const STATUS_FAMILY_OFFCHAIN_FAILURE =
  4;

const STATUS_FAMILY_CHAIN_FAILURE =
  5;

const STATUS_FAMILY_PARTIAL_CHAIN_FAILURE =
  6;

function sleep(
  ms
) {
  return new Promise(
    (
      resolve
    ) => {
      setTimeout(
        resolve,
        ms
      );
    }
  );
}

function normalizePositiveNumber(
  value,
  fallback
) {
  const numericValue =
    Number(
      value
    );

  if (
    !Number.isFinite(
      numericValue
    ) ||
    numericValue <= 0
  ) {
    return fallback;
  }

  return numericValue;
}

function normalizeCallsId(
  value
) {
  const normalized =
    String(
      value ||
      ""
    ).trim();

  return normalized ||
    null;
}

function normalizeStatus(
  value
) {
  const numericStatus =
    Number(
      value
    );

  return Number.isInteger(
    numericStatus
  )
    ? numericStatus
    : null;
}

function resolveStatusFamily(
  status
) {
  if (
    !Number.isInteger(
      status
    ) ||
    status < 100 ||
    status > 999
  ) {
    return null;
  }

  return Math.floor(
    status /
    100
  );
}

function normalizeReceiptStatus(
  value
) {
  if (
    value === undefined ||
    value === null
  ) {
    return null;
  }

  try {
    return Number(
      BigInt(
        value
      )
    );
  }
  catch {
    return null;
  }
}

function extractReceipts(
  result
) {
  if (
    !result ||
    typeof result !==
      "object" ||
    !Array.isArray(
      result.receipts
    )
  ) {
    return [];
  }

  return result.receipts;
}

function extractTransactionHashes(
  receipts
) {
  const seen =
    new Set();

  const hashes =
    [];

  for (
    const receipt of
      receipts
  ) {
    const hash =
      String(
        receipt
          ?.transactionHash ||
        ""
      ).trim();

    if (
      !hash ||
      seen.has(
        hash
      )
    ) {
      continue;
    }

    seen.add(
      hash
    );

    hashes.push(
      hash
    );
  }

  return hashes;
}

function validateConfirmedReceipts(
  receipts
) {
  if (
    !receipts.length
  ) {
    throw new Error(
      "wallet_getCallsStatus confirmed the batch without receipts"
    );
  }

  for (
    const receipt of
      receipts
  ) {
    const receiptStatus =
      normalizeReceiptStatus(
        receipt?.status
      );

    if (
      receiptStatus !==
        1
    ) {
      throw new Error(
        "Wallet-managed funding transaction was not successful"
      );
    }
  }
}

function buildFailureError({
  status,
  statusFamily,
  callsId
}) {
  if (
    statusFamily ===
      STATUS_FAMILY_OFFCHAIN_FAILURE
  ) {
    return new Error(
      `Wallet-managed funding failed before onchain execution with status ${status} (${callsId})`
    );
  }

  if (
    statusFamily ===
      STATUS_FAMILY_CHAIN_FAILURE
  ) {
    return new Error(
      `Wallet-managed funding reverted onchain with status ${status} (${callsId})`
    );
  }

  if (
    statusFamily ===
      STATUS_FAMILY_PARTIAL_CHAIN_FAILURE
  ) {
    return new Error(
      `Wallet-managed funding partially reverted onchain with status ${status} (${callsId})`
    );
  }

  return new Error(
    `Wallet-managed funding returned unsupported status ${status} (${callsId})`
  );
}

async function readCallsStatus({
  walletClient,
  callsId
}) {
  return walletClient.request({
    method:
      "wallet_getCallsStatus",

    params: [
      callsId
    ]
  });
}

export async function waitForWalletManagedFunding({
  walletClient,
  callsId,
  pollIntervalMs =
    DEFAULT_POLL_INTERVAL_MS,
  timeoutMs =
    DEFAULT_TIMEOUT_MS
}) {
  if (!walletClient) {
    throw new Error(
      "walletClient is required"
    );
  }

  const normalizedCallsId =
    normalizeCallsId(
      callsId
    );

  if (!normalizedCallsId) {
    throw new Error(
      "callsId is required"
    );
  }

  const normalizedPollIntervalMs =
    normalizePositiveNumber(
      pollIntervalMs,
      DEFAULT_POLL_INTERVAL_MS
    );

  const normalizedTimeoutMs =
    normalizePositiveNumber(
      timeoutMs,
      DEFAULT_TIMEOUT_MS
    );

  const startedAt =
    Date.now();

  while (
    Date.now() -
      startedAt <
    normalizedTimeoutMs
  ) {
    const result =
      await readCallsStatus({
        walletClient,

        callsId:
          normalizedCallsId
      });

    if (
      !result ||
      typeof result !==
        "object"
    ) {
      throw new Error(
        "wallet_getCallsStatus returned an invalid response"
      );
    }

    const status =
      normalizeStatus(
        result.status
      );

    if (
      status ===
        null
    ) {
      throw new Error(
        "wallet_getCallsStatus returned an invalid status"
      );
    }

    const statusFamily =
      resolveStatusFamily(
        status
      );

    if (
      statusFamily ===
        null
    ) {
      throw new Error(
        `wallet_getCallsStatus returned an unsupported status ${status}`
      );
    }

    /*
     * EIP-5792:
     *
     * 1xx = pending
     */

    if (
      statusFamily ===
        STATUS_FAMILY_PENDING
    ) {
      await sleep(
        normalizedPollIntervalMs
      );

      continue;
    }

    /*
     * EIP-5792:
     *
     * 2xx = confirmed.
     *
     * Confirmation alone is not enough for our
     * funding flow. Verify the returned receipts
     * and extract the real transaction hash.
     */

    if (
      statusFamily ===
        STATUS_FAMILY_CONFIRMED
    ) {
      const receipts =
        extractReceipts(
          result
        );

      validateConfirmedReceipts(
        receipts
      );

      const transactionHashes =
        extractTransactionHashes(
          receipts
        );

      if (
        !transactionHashes.length
      ) {
        throw new Error(
          "Confirmed wallet-managed funding has no transaction hash"
        );
      }

      /*
       * UniBridge currently sends one funding call,
       * but EIP-5792 does not guarantee that a call
       * batch always maps to exactly one underlying
       * transaction.
       *
       * Preserve all hashes while exposing the first
       * one as tx_hash for compatibility with the
       * existing UniBridge funding lifecycle.
       */

      return {
        type:
          "wallet_calls_confirmed",

        calls_id:
          normalizedCallsId,

        status,

        atomic:
          result.atomic ===
            true,

        tx_hash:
          transactionHashes[
            0
          ],

        transaction_hashes:
          transactionHashes,

        receipts,

        response_capabilities:
          (
            result.capabilities &&
            typeof result
              .capabilities ===
              "object"
          )
            ? result.capabilities
            : null
      };
    }

    /*
     * EIP-5792 failure families:
     *
     * 4xx = offchain failure
     * 5xx = chain rules failure
     * 6xx = partial chain rules failure
     */

    if (
      statusFamily ===
        STATUS_FAMILY_OFFCHAIN_FAILURE ||
      statusFamily ===
        STATUS_FAMILY_CHAIN_FAILURE ||
      statusFamily ===
        STATUS_FAMILY_PARTIAL_CHAIN_FAILURE
    ) {
      throw buildFailureError({
        status,
        statusFamily,

        callsId:
          normalizedCallsId
      });
    }

    /*
     * Never interpret an unknown status family
     * as success.
     */

    throw buildFailureError({
      status,
      statusFamily,

      callsId:
        normalizedCallsId
    });
  }

  throw new Error(
    `Timed out waiting for wallet-managed funding (${normalizedCallsId})`
  );
}

export default waitForWalletManagedFunding;
