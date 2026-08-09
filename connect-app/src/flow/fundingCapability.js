// connect-app/src/flow/fundingCapability.js

import {
  toHex
} from "viem";

const GAS_COST_BUFFER_BPS =
  2000n;

const BPS_DENOMINATOR =
  10000n;

function normalizeChainId(
  chainId
) {
  const normalized =
    Number(
      chainId
    );

  if (
    !Number.isInteger(
      normalized
    ) ||
    normalized <= 0
  ) {
    return null;
  }

  return normalized;
}

function parseRpcQuantity(
  value
) {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return null;
  }

  try {
    return BigInt(
      value
    );
  }
  catch {
    return null;
  }
}

async function readNativeBalance({
  walletClient,
  address
}) {
  const value =
    await walletClient.request({
      method:
        "eth_getBalance",

      params: [
        address,
        "latest"
      ]
    });

  return parseRpcQuantity(
    value
  );
}

async function estimateTransactionGas({
  walletClient,
  transaction
}) {
  const value =
    await walletClient.request({
      method:
        "eth_estimateGas",

      params: [
        {
          from:
            transaction.from,

          to:
            transaction.to,

          data:
            transaction.data,

          ...(
            transaction.value !==
              undefined &&
            transaction.value !==
              null
              ? {
                  value:
                    toHex(
                      transaction.value
                    )
                }
              : {}
          )
        }
      ]
    });

  return parseRpcQuantity(
    value
  );
}

async function readGasPrice({
  walletClient
}) {
  const value =
    await walletClient.request({
      method:
        "eth_gasPrice"
    });

  return parseRpcQuantity(
    value
  );
}

function addGasCostBuffer(
  gasCost
) {
  return (
    gasCost *
    (
      BPS_DENOMINATOR +
      GAS_COST_BUFFER_BPS
    )
  ) /
    BPS_DENOMINATOR;
}

function buildResult({
  mode,
  reason,
  nativeBalance,
  estimatedGas,
  gasPrice,
  estimatedGasCost,
  bufferedGasCost,
  requiredNativeAmount
}) {
  return {
    mode,
    reason,

    native_balance:
      nativeBalance,

    estimated_gas:
      estimatedGas,

    gas_price:
      gasPrice,

    estimated_gas_cost:
      estimatedGasCost,

    buffered_gas_cost:
      bufferedGasCost,

    required_native_amount:
      requiredNativeAmount,

    gas_cost_buffer_bps:
      Number(
        GAS_COST_BUFFER_BPS
      )
  };
}

export async function resolveFundingCapability({
  walletClient,
  address,
  chainId,
  transaction
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

  const normalizedChainId =
    normalizeChainId(
      chainId
    );

  if (!normalizedChainId) {
    throw new Error(
      "Valid chainId is required"
    );
  }

  const normalizedTransaction = {
    from:
      address,

    to:
      transaction.to,

    data:
      transaction.data ||
      "0x",

    value:
      transaction.value ??
      0n
  };

  const [
    balanceResult,
    gasEstimateResult,
    gasPriceResult
  ] =
    await Promise.allSettled([
      readNativeBalance({
        walletClient,
        address
      }),

      estimateTransactionGas({
        walletClient,

        transaction:
          normalizedTransaction
      }),

      readGasPrice({
        walletClient
      })
    ]);

  const nativeBalance =
    balanceResult.status ===
      "fulfilled"
      ? balanceResult.value
      : null;

  const estimatedGas =
    gasEstimateResult.status ===
      "fulfilled"
      ? gasEstimateResult.value
      : null;

  const gasPrice =
    gasPriceResult.status ===
      "fulfilled"
      ? gasPriceResult.value
      : null;

  /*
   * Zero native balance is definitive.
   *
   * A normal Polygon transaction cannot pay
   * network gas when the account has zero POL.
   */

  if (
    nativeBalance ===
      0n
  ) {
    return buildResult({
      mode:
        "insufficient_gas",

      reason:
        "native_balance_zero",

      nativeBalance,

      estimatedGas,

      gasPrice,

      estimatedGasCost:
        null,

      bufferedGasCost:
        null,

      requiredNativeAmount:
        null
    });
  }

  /*
   * Native execution is allowed only when the
   * required preflight data is actually available.
   *
   * Unknown preflight state must not silently
   * fall through to sendTransaction.
   */

  if (
    nativeBalance ===
      null
  ) {
    return buildResult({
      mode:
        "preflight_unavailable",

      reason:
        "native_balance_unavailable",

      nativeBalance:
        null,

      estimatedGas,

      gasPrice,

      estimatedGasCost:
        null,

      bufferedGasCost:
        null,

      requiredNativeAmount:
        null
    });
  }

  if (
    estimatedGas ===
      null
  ) {
    return buildResult({
      mode:
        "preflight_unavailable",

      reason:
        "gas_estimate_unavailable",

      nativeBalance,

      estimatedGas:
        null,

      gasPrice,

      estimatedGasCost:
        null,

      bufferedGasCost:
        null,

      requiredNativeAmount:
        null
    });
  }

  if (
    gasPrice ===
      null
  ) {
    return buildResult({
      mode:
        "preflight_unavailable",

      reason:
        "gas_price_unavailable",

      nativeBalance,

      estimatedGas,

      gasPrice:
        null,

      estimatedGasCost:
        null,

      bufferedGasCost:
        null,

      requiredNativeAmount:
        null
    });
  }

  const estimatedGasCost =
    estimatedGas *
    gasPrice;

  const bufferedGasCost =
    addGasCostBuffer(
      estimatedGasCost
    );

  const requiredNativeAmount =
    bufferedGasCost +
    normalizedTransaction
      .value;

  if (
    nativeBalance >=
      requiredNativeAmount
  ) {
    return buildResult({
      mode:
        "native",

      reason:
        "native_gas_sufficient",

      nativeBalance,

      estimatedGas,

      gasPrice,

      estimatedGasCost,

      bufferedGasCost,

      requiredNativeAmount
    });
  }

  return buildResult({
    mode:
      "insufficient_gas",

    reason:
      "native_gas_insufficient",

    nativeBalance,

    estimatedGas,

    gasPrice,

    estimatedGasCost,

    bufferedGasCost,

    requiredNativeAmount
  });
}

export default resolveFundingCapability;
