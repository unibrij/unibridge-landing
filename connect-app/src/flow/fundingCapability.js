// connect-app/src/flow/fundingCapability.js

import {
  toHex
} from "viem";

const NATIVE_ASSET_ADDRESS =
  "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";

const DEFAULT_ERC20_GAS_LIMIT =
  100000n;

const GAS_COST_BUFFER_BPS =
  2000n;

const BPS_DENOMINATOR =
  10000n;

function normalizeAddress(
  value
) {
  return String(
    value ||
    ""
  )
    .trim()
    .toLowerCase();
}

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

function isCapabilitySupported(
  capability
) {
  if (!capability) {
    return false;
  }

  if (
    capability === true
  ) {
    return true;
  }

  return (
    typeof capability ===
      "object" &&
    capability.supported ===
      true
  );
}

function supportsNativeAuxiliaryFunds(
  capability
) {
  if (
    !isCapabilitySupported(
      capability
    )
  ) {
    return false;
  }

  const assets =
    Array.isArray(
      capability?.assets
    )
      ? capability.assets
      : null;

  /*
   * ERC-7682:
   *
   * If auxiliaryFunds is supported and the wallet
   * does not return an explicit assets list,
   * the application SHOULD assume auxiliary funds
   * are available for any asset.
   */

  if (!assets) {
    return true;
  }

  const nativeAsset =
    normalizeAddress(
      NATIVE_ASSET_ADDRESS
    );

  return assets.some(
    (
      asset
    ) =>
      normalizeAddress(
        asset
      ) ===
      nativeAsset
  );
}

function findCapabilitiesForChain({
  capabilities,
  chainId
}) {
  if (
    !capabilities ||
    typeof capabilities !==
      "object"
  ) {
    return null;
  }

  const expectedChainId =
    Number(
      chainId
    );

  if (
    !Number.isInteger(
      expectedChainId
    ) ||
    expectedChainId < 0
  ) {
    return null;
  }

  for (
    const [
      key,
      value
    ] of Object.entries(
      capabilities
    )
  ) {
    try {
      if (
        Number(
          BigInt(
            key
          )
        ) ===
        expectedChainId
      ) {
        return (
          value &&
          typeof value ===
            "object"
        )
          ? value
          : null;
      }
    }
    catch {
      continue;
    }
  }

  return null;
}

function pickChainCapabilities({
  capabilities,
  chainId
}) {
  if (
    !capabilities ||
    typeof capabilities !==
      "object"
  ) {
    return null;
  }

  /*
   * EIP-5792 allows capabilities that apply
   * across chains to be exposed under "0x0".
   *
   * Chain-specific values override global ones.
   */

  const globalCapabilities =
    findCapabilitiesForChain({
      capabilities,
      chainId:
        0
    }) ||
    {};

  const chainCapabilities =
    findCapabilitiesForChain({
      capabilities,
      chainId
    }) ||
    {};

  const mergedCapabilities = {
    ...globalCapabilities,
    ...chainCapabilities
  };

  return Object.keys(
    mergedCapabilities
  ).length
    ? mergedCapabilities
    : null;
}

async function readNativeBalance({
  walletClient,
  address
}) {
  const balance =
    await walletClient.request({
      method:
        "eth_getBalance",

      params: [
        address,
        "latest"
      ]
    });

  return parseRpcQuantity(
    balance
  );
}

async function estimateTransactionGas({
  walletClient,
  transaction
}) {
  const gas =
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
    gas
  );
}

async function readGasPrice({
  walletClient
}) {
  /*
   * Current Polygon preflight.
   *
   * This intentionally remains isolated here so
   * it can later be replaced by an EIP-1559-aware
   * fee estimator without changing the resolver
   * contract.
   */

  const gasPrice =
    await walletClient.request({
      method:
        "eth_gasPrice"
    });

  return parseRpcQuantity(
    gasPrice
  );
}

async function readWalletCapabilities({
  walletClient,
  address,
  chainHex
}) {
  try {
    return await walletClient.request({
      method:
        "wallet_getCapabilities",

      params: [
        address,
        [
          chainHex
        ]
      ]
    });
  }
  catch {
    /*
     * Capability discovery is optional.
     *
     * Wallets that do not implement EIP-5792
     * must degrade cleanly.
     */

    return null;
  }
}

function resolveWalletManagedCapability({
  chainCapabilities
}) {
  if (
    !chainCapabilities ||
    typeof chainCapabilities !==
      "object"
  ) {
    return null;
  }

  /*
   * IMPORTANT:
   *
   * This resolver does not execute the transaction.
   *
   * auxiliaryFunds only means the wallet has
   * declared access to additional funding.
   *
   * A consumer receiving mode "wallet_managed"
   * MUST use the EIP-5792 wallet_sendCalls path.
   * It must not fall back to eth_sendTransaction
   * and assume auxiliaryFunds will apply.
   */

  if (
    supportsNativeAuxiliaryFunds(
      chainCapabilities
        .auxiliaryFunds
    )
  ) {
    return {
      type:
        "auxiliary_funds",

      execution_method:
        "wallet_sendCalls",

      capability:
        chainCapabilities
          .auxiliaryFunds
    };
  }

  /*
   * paymasterService is deliberately NOT treated
   * as wallet-managed funding.
   *
   * ERC-7677 only tells us that the wallet can
   * communicate with a paymaster service supplied
   * by the application.
   *
   * UniBridge sponsorship will be implemented
   * later as its own explicit adapter.
   */

  return null;
}

function addGasCostBuffer(
  gasCost
) {
  if (
    typeof gasCost !==
      "bigint"
  ) {
    return null;
  }

  return (
    gasCost +
    (
      gasCost *
      GAS_COST_BUFFER_BPS
    ) /
      BPS_DENOMINATOR
  );
}

function buildResult({
  mode,
  reason,
  nativeBalance,
  estimatedGas,
  estimatedGasSource,
  gasPrice,
  estimatedGasCost,
  bufferedGasCost,
  requiredNativeAmount,
  chainCapabilities = null,
  walletManagedCapability = null
}) {
  return {
    mode,
    reason,

    native_balance:
      nativeBalance,

    estimated_gas:
      estimatedGas,

    estimated_gas_source:
      estimatedGasSource,

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
      ),

    wallet_capabilities:
      chainCapabilities,

    wallet_managed_capability:
      walletManagedCapability
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

  const chainHex =
    buildChainHex(
      normalizedChainId
    );

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

  /*
   * Each preflight component is independent.
   *
   * A failure in eth_estimateGas must not erase
   * a successfully-read native balance or gas price.
   */

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

  const rpcEstimatedGas =
    gasEstimateResult.status ===
      "fulfilled"
      ? gasEstimateResult.value
      : null;

  const gasPrice =
    gasPriceResult.status ===
      "fulfilled"
      ? gasPriceResult.value
      : null;

  const estimatedGas =
    rpcEstimatedGas ??
    DEFAULT_ERC20_GAS_LIMIT;

  const estimatedGasSource =
    rpcEstimatedGas !==
      null
      ? "rpc"
      : "fallback";

  /*
   * If native balance itself cannot be read,
   * we cannot safely declare gas insufficient.
   *
   * Preserve the existing native execution path.
   */

  if (
    nativeBalance ===
      null
  ) {
    return buildResult({
      mode:
        "native",

      reason:
        "native_balance_unavailable",

      nativeBalance:
        null,

      estimatedGas,

      estimatedGasSource,

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
   * If gas price is unavailable and the account
   * has some native balance, we cannot make a
   * reliable sufficiency decision.
   *
   * Keep the legacy native path.
   *
   * A zero native balance is different: an ERC-20
   * transfer cannot pay normal Polygon gas with
   * zero POL, so capability resolution remains useful.
   */

  if (
    gasPrice ===
      null &&
    nativeBalance >
      0n
  ) {
    return buildResult({
      mode:
        "native",

      reason:
        "gas_price_unavailable",

      nativeBalance,

      estimatedGas,

      estimatedGasSource,

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

  let estimatedGasCost =
    null;

  let bufferedGasCost =
    null;

  let requiredNativeAmount =
    null;

  if (
    gasPrice !==
      null
  ) {
    estimatedGasCost =
      estimatedGas *
      gasPrice;

    bufferedGasCost =
      addGasCostBuffer(
        estimatedGasCost
      );

    requiredNativeAmount =
      (
        bufferedGasCost ??
        estimatedGasCost
      ) +
      normalizedTransaction
        .value;
  }

  /*
   * Native execution.
   *
   * RPC estimate:
   *   definitive preflight result.
   *
   * Fallback estimate:
   *   preserve native execution, but report only
   *   probable sufficiency because eth_estimateGas
   *   itself did not succeed.
   */

  if (
    requiredNativeAmount !==
      null &&
    nativeBalance >=
      requiredNativeAmount
  ) {
    return buildResult({
      mode:
        "native",

      reason:
        estimatedGasSource ===
          "rpc"
          ? "native_gas_sufficient"
          : "native_gas_probably_sufficient",

      nativeBalance,

      estimatedGas,

      estimatedGasSource,

      gasPrice,

      estimatedGasCost,

      bufferedGasCost,

      requiredNativeAmount
    });
  }

  /*
   * At this point:
   *
   * - native balance is zero, or
   * - calculated native gas is insufficient.
   *
   * Only now ask the wallet whether it exposes
   * a compatible EIP-5792 capability.
   */

  const walletCapabilities =
    await readWalletCapabilities({
      walletClient,
      address,
      chainHex
    });

  const chainCapabilities =
    pickChainCapabilities({
      capabilities:
        walletCapabilities,

      chainId:
        normalizedChainId
    });

  const walletManagedCapability =
    resolveWalletManagedCapability({
      chainCapabilities
    });

  if (
    walletManagedCapability
  ) {
    return buildResult({
      mode:
        "wallet_managed",

      reason:
        walletManagedCapability
          .type,

      nativeBalance,

      estimatedGas,

      estimatedGasSource,

      gasPrice,

      estimatedGasCost,

      bufferedGasCost,

      requiredNativeAmount,

      chainCapabilities,

      walletManagedCapability
    });
  }

  /*
   * No compatible wallet-managed funding path.
   *
   * UniBridge-sponsored execution is intentionally
   * not inferred here.
   *
   * When sponsorship is introduced it will be an
   * explicit resolver/adapter step between
   * wallet_managed and insufficient_gas.
   */

  return buildResult({
    mode:
      "insufficient_gas",

    reason:
      nativeBalance ===
        0n
        ? "native_balance_zero"
        : estimatedGasSource ===
            "rpc"
          ? "native_gas_insufficient"
          : "native_gas_probably_insufficient",

    nativeBalance,

    estimatedGas,

    estimatedGasSource,

    gasPrice,

    estimatedGasCost,

    bufferedGasCost,

    requiredNativeAmount,

    chainCapabilities
  });
}

export default resolveFundingCapability;
