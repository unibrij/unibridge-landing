// connect-app/src/flow/signPolygonNativeMetaTransactionFunding.js

import {
  encodeFunctionData,
  getAddress,
  parseUnits
} from "viem";

import {
  AUTHORIZED_FUNDING_METHOD,
  POLYGON_CHAIN_ID,
  resolveAuthorizedFundingToken
} from "./authorizedFundingTokens.js";

const GET_NONCE_ABI =
  Object.freeze([
    {
      type:
        "function",

      name:
        "getNonce",

      stateMutability:
        "view",

      inputs: [
        {
          name:
            "user",

          type:
            "address"
        }
      ],

      outputs: [
        {
          name:
            "",

          type:
            "uint256"
        }
      ]
    }
  ]);

const ERC20_TRANSFER_ABI =
  Object.freeze([
    {
      type:
        "function",

      name:
        "transfer",

      stateMutability:
        "nonpayable",

      inputs: [
        {
          name:
            "to",

          type:
            "address"
        },

        {
          name:
            "value",

          type:
            "uint256"
        }
      ],

      outputs: [
        {
          name:
            "",

          type:
            "bool"
        }
      ]
    }
  ]);

function normalizeString(
  value
) {
  return String(
    value ??
    ""
  ).trim();
}

function normalizeAsset(
  value
) {
  return normalizeString(
    value
  ).toUpperCase();
}

export async function signPolygonNativeMetaTransactionFunding({
  walletClient,
  publicClient,
  wallet,
  depositAddress,
  amount,
  token
} = {}) {
  if (
    !walletClient ||
    typeof walletClient
      .signTypedData !==
      "function"
  ) {
    throw new Error(
      "authorized_funding_wallet_client_invalid"
    );
  }

  if (
    !publicClient ||
    typeof publicClient
      .readContract !==
      "function"
  ) {
    throw new Error(
      "authorized_funding_public_client_invalid"
    );
  }

  let from;

  try {
    from =
      getAddress(
        normalizeString(
          wallet
        )
      );
  }
  catch {
    throw new Error(
      "authorized_funding_wallet_invalid"
    );
  }

  let to;

  try {
    to =
      getAddress(
        normalizeString(
          depositAddress
        )
      );
  }
  catch {
    throw new Error(
      "authorized_funding_target_invalid"
    );
  }

  const asset =
    normalizeAsset(
      token?.asset ||
      token?.symbol ||
      token
    );

  const tokenAddress =
    normalizeString(
      token?.address ||
      token?.token_address
    );

  const tokenConfig =
    resolveAuthorizedFundingToken({
      chainId:
        POLYGON_CHAIN_ID,

      asset,

      tokenAddress:
        tokenAddress ||
        null
    });

  if (
    !tokenConfig ||
    tokenConfig.authorization
      ?.method !==
      AUTHORIZED_FUNDING_METHOD
        .POLYGON_NATIVE_META_TRANSACTION
  ) {
    throw new Error(
      "authorized_funding_meta_transaction_token_unsupported"
    );
  }

  const normalizedAmount =
    normalizeString(
      amount
    );

  if (!normalizedAmount) {
    throw new Error(
      "authorized_funding_amount_invalid"
    );
  }

  let value;

  try {
    value =
      parseUnits(
        normalizedAmount,
        tokenConfig.decimals
      );
  }
  catch {
    throw new Error(
      "authorized_funding_amount_invalid"
    );
  }

  if (
    value <= 0n
  ) {
    throw new Error(
      "authorized_funding_amount_invalid"
    );
  }

  let nonce;

  try {
    nonce =
      await publicClient
        .readContract({
          address:
            tokenConfig
              .token_address,

          abi:
            GET_NONCE_ABI,

          functionName:
            "getNonce",

          args: [
            from
          ]
        });
  }
  catch {
    throw new Error(
      "authorized_funding_meta_transaction_nonce_unavailable"
    );
  }

  if (
    typeof nonce !==
      "bigint" ||
    nonce < 0n
  ) {
    throw new Error(
      "authorized_funding_meta_transaction_nonce_invalid"
    );
  }

  /*
  --------------------------------------------------
  Canonical inner transfer

  functionSignature is used only to build the signed
  MetaTransaction typed data.

  It is never returned to the backend.
  --------------------------------------------------
  */

  const functionSignature =
    encodeFunctionData({
      abi:
        ERC20_TRANSFER_ABI,

      functionName:
        "transfer",

      args: [
        to,
        value
      ]
    });

  const message = {
    nonce,
    from,
    functionSignature
  };

  const signature =
    await walletClient
      .signTypedData({
        account:
          from,

        domain:
          tokenConfig
            .authorization
            .domain,

        primaryType:
          tokenConfig
            .authorization
            .primary_type,

        types: {
          MetaTransaction:
            tokenConfig
              .authorization
              .types
        },

        message
      });

  return {
    authorization: {
      nonce:
        nonce.toString()
    },

    signature
  };
}

export default
  signPolygonNativeMetaTransactionFunding;
