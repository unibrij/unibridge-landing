// connect-app/src/flow/sendWalletManagedFunding.js

import {
  toHex
} from "viem";

function normalizeChainId(
  chainId
) {
  const numericChainId =
    Number(
      chainId
    );

  if (
    !Number.isInteger(
      numericChainId
    ) ||
    numericChainId <= 0
  ) {
    return null;
  }

  return numericChainId;
}

function buildChainHex(
  chainId
) {
  const normalizedChainId =
    normalizeChainId(
      chainId
    );

  if (!normalizedChainId) {
    return null;
  }

  return toHex(
    normalizedChainId
  );
}

function normalizeCallValue(
  value
) {
  if (
    value === undefined ||
    value === null
  ) {
    return "0x0";
  }

  if (
    typeof value ===
      "bigint"
  ) {
    return toHex(
      value
    );
  }

  try {
    return toHex(
      BigInt(
        value
      )
    );
  }
  catch {
    throw new Error(
      "Invalid transaction value"
    );
  }
}

function validateWalletManagedCapability(
  walletManagedCapability
) {
  if (
    !walletManagedCapability ||
    typeof walletManagedCapability !==
      "object"
  ) {
    throw new Error(
      "walletManagedCapability is required"
    );
  }

  if (
    walletManagedCapability.type !==
      "auxiliary_funds"
  ) {
    throw new Error(
      "Unsupported wallet-managed funding capability"
    );
  }

  if (
    walletManagedCapability
      .execution_method !==
      "wallet_sendCalls"
  ) {
    throw new Error(
      "Wallet-managed funding must use wallet_sendCalls"
    );
  }
}

export async function sendWalletManagedFunding({
  walletClient,
  address,
  chainId,
  transaction,
  walletManagedCapability
}) {
  if (!walletClient) {
    throw new Error(
      "walletClient is required"
    );
  }

  if (!address) {
    throw new Error(
      "address is required"
    );
  }

  if (
    !transaction?.to
  ) {
    throw new Error(
      "transaction.to is required"
    );
  }

  validateWalletManagedCapability(
    walletManagedCapability
  );

  const normalizedChainId =
    normalizeChainId(
      chainId
    );

  if (!normalizedChainId) {
    throw new Error(
      "Valid chainId is required"
    );
  }

  const chainHex =
    buildChainHex(
      normalizedChainId
    );

  /*
   * wallet-managed execution deliberately uses
   * EIP-5792 wallet_sendCalls.
   *
   * auxiliaryFunds was already discovered through
   * wallet_getCapabilities by fundingCapability.js.
   *
   * We intentionally do not send an auxiliaryFunds
   * capability object here because UniBridge is not
   * supplying requiredAssets or any other extended
   * ERC-7682 execution parameters.
   */

  const request = {
    version:
      "2.0.0",

    from:
      address,

    chainId:
      chainHex,

    /*
     * UniBridge currently sends one ERC-20 transfer.
     * Atomic execution is therefore not required.
     */

    atomicRequired:
      false,

    calls: [
      {
        to:
          transaction.to,

        data:
          transaction.data ||
          "0x",

        value:
          normalizeCallValue(
            transaction.value
          )
      }
    ]
  };

  const result =
    await walletClient.request({
      method:
        "wallet_sendCalls",

      params: [
        request
      ]
    });

  /*
   * EIP-5792 v2 wallet_sendCalls returns:
   *
   * {
   *   id: string,
   *   capabilities?: { ... }
   * }
   *
   * The id is a calls/batch identifier.
   * It is NOT a transaction hash.
   */

  const callsId =
    result &&
    typeof result ===
      "object" &&
    typeof result.id ===
      "string" &&
    result.id.trim()
      ? result.id.trim()
      : null;

  if (!callsId) {
    throw new Error(
      "wallet_sendCalls returned an invalid calls id"
    );
  }

  const responseCapabilities =
    result &&
    typeof result ===
      "object" &&
    result.capabilities &&
    typeof result.capabilities ===
      "object"
      ? result.capabilities
      : null;

  return {
    type:
      "wallet_calls",

    calls_id:
      callsId,

    chain_id:
      normalizedChainId,

    capability:
      walletManagedCapability
        .type,

    response_capabilities:
      responseCapabilities
  };
}

export default sendWalletManagedFunding;
