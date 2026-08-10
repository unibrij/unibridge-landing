// connect-app/src/flow/authorizedFundingTokens.js

export const POLYGON_CHAIN_ID =
  137;

export const AUTHORIZED_FUNDING_METHOD =
  Object.freeze({
    EIP3009_TRANSFER:
      "eip3009_transfer_with_authorization",

    POLYGON_NATIVE_META_TRANSACTION:
      "polygon_native_meta_transaction"
  });

const POLYGON_USDC_ADDRESS =
  "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359";

const POLYGON_USDT_ADDRESS =
  "0xc2132D05D31c914a87C6611C10748AEb04B58e8F";

const POLYGON_CHAIN_ID_SALT =
  "0x0000000000000000000000000000000000000000000000000000000000000089";

const TRANSFER_WITH_AUTHORIZATION_TYPES =
  Object.freeze([
    Object.freeze({
      name: "from",
      type: "address"
    }),
    Object.freeze({
      name: "to",
      type: "address"
    }),
    Object.freeze({
      name: "value",
      type: "uint256"
    }),
    Object.freeze({
      name: "validAfter",
      type: "uint256"
    }),
    Object.freeze({
      name: "validBefore",
      type: "uint256"
    }),
    Object.freeze({
      name: "nonce",
      type: "bytes32"
    })
  ]);

const META_TRANSACTION_TYPES =
  Object.freeze([
    Object.freeze({
      name: "nonce",
      type: "uint256"
    }),
    Object.freeze({
      name: "from",
      type: "address"
    }),
    Object.freeze({
      name: "functionSignature",
      type: "bytes"
    })
  ]);

const POLYGON_USDC =
  Object.freeze({
    asset:
      "USDC",

    network:
      "polygon",

    chain_id:
      POLYGON_CHAIN_ID,

    decimals:
      6,

    token_address:
      POLYGON_USDC_ADDRESS,

    authorization:
      Object.freeze({
        method:
          AUTHORIZED_FUNDING_METHOD
            .EIP3009_TRANSFER,

        primary_type:
          "TransferWithAuthorization",

        domain:
          Object.freeze({
            name:
              "USD Coin",

            version:
              "2",

            chainId:
              POLYGON_CHAIN_ID,

            verifyingContract:
              POLYGON_USDC_ADDRESS
          }),

        types:
          TRANSFER_WITH_AUTHORIZATION_TYPES
      })
  });

const POLYGON_USDT =
  Object.freeze({
    asset:
      "USDT",

    network:
      "polygon",

    chain_id:
      POLYGON_CHAIN_ID,

    decimals:
      6,

    token_address:
      POLYGON_USDT_ADDRESS,

    authorization:
      Object.freeze({
        method:
          AUTHORIZED_FUNDING_METHOD
            .POLYGON_NATIVE_META_TRANSACTION,

        primary_type:
          "MetaTransaction",

        domain:
          Object.freeze({
            name:
              "(PoS) Tether USD",

            version:
              "1",

            verifyingContract:
              POLYGON_USDT_ADDRESS,

            salt:
              POLYGON_CHAIN_ID_SALT
          }),

        types:
          META_TRANSACTION_TYPES
      })
  });

export const AUTHORIZED_FUNDING_TOKENS =
  Object.freeze({
    POLYGON:
      Object.freeze({
        USDC:
          POLYGON_USDC,

        USDT:
          POLYGON_USDT
      })
  });

function normalizeAsset(
  value
) {
  return String(
    value ||
    ""
  )
    .trim()
    .toUpperCase();
}

function normalizeChainId(
  value
) {
  const chainId =
    Number(
      value
    );

  return (
    Number.isInteger(
      chainId
    ) &&
    chainId > 0
  )
    ? chainId
    : null;
}

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

export function resolveAuthorizedFundingToken({
  chainId,
  asset,
  tokenAddress = null
} = {}) {
  const normalizedChainId =
    normalizeChainId(
      chainId
    );

  if (
    normalizedChainId !==
    POLYGON_CHAIN_ID
  ) {
    return null;
  }

  const normalizedAsset =
    normalizeAsset(
      asset
    );

  const token =
    AUTHORIZED_FUNDING_TOKENS
      .POLYGON[
        normalizedAsset
      ] ||
    null;

  if (!token) {
    return null;
  }

  const normalizedTokenAddress =
    normalizeAddress(
      tokenAddress
    );

  if (
    normalizedTokenAddress &&
    normalizedTokenAddress !==
      normalizeAddress(
        token.token_address
      )
  ) {
    return null;
  }

  return token;
}

export function isAuthorizedFundingToken(
  params = {}
) {
  return !!resolveAuthorizedFundingToken(
    params
  );
}

export default
  AUTHORIZED_FUNDING_TOKENS;
