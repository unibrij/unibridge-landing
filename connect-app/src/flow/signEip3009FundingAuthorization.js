// connect-app/src/flow/signEip3009FundingAuthorization.js

import {
  bytesToHex,
  getAddress,
  parseUnits
} from "viem";

import {
  AUTHORIZED_FUNDING_METHOD,
  POLYGON_CHAIN_ID,
  resolveAuthorizedFundingToken
} from "./authorizedFundingTokens.js";

const AUTHORIZATION_LIFETIME_SECONDS =
  5 * 60;

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

function createAuthorizationNonce() {
  if (
    typeof globalThis.crypto
      ?.getRandomValues !==
    "function"
  ) {
    throw new Error(
      "authorized_funding_secure_random_unavailable"
    );
  }

  const bytes =
    new Uint8Array(
      32
    );

  globalThis.crypto
    .getRandomValues(
      bytes
    );

  return bytesToHex(
    bytes
  );
}

function resolveCurrentUnixTime() {
  const milliseconds =
    Date.now();

  if (
    !Number.isFinite(
      milliseconds
    ) ||
    milliseconds <= 0
  ) {
    throw new Error(
      "authorized_funding_clock_invalid"
    );
  }

  return Math.floor(
    milliseconds / 1000
  );
}

export async function signEip3009FundingAuthorization({
  walletClient,
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
        .EIP3009_TRANSFER
  ) {
    throw new Error(
      "authorized_funding_eip3009_token_unsupported"
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

  const now =
    resolveCurrentUnixTime();

  /*
  --------------------------------------------------
  Short-lived authorization

  validAfter = 0 keeps the authorization immediately
  usable and avoids client/server/block-clock skew.

  validBefore is deliberately short-lived.
  --------------------------------------------------
  */

  const validAfter =
    0n;

  const validBefore =
    BigInt(
      now +
      AUTHORIZATION_LIFETIME_SECONDS
    );

  const nonce =
    createAuthorizationNonce();

  const authorization = {
    from,
    to,
    value,
    validAfter,
    validBefore,
    nonce
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
          TransferWithAuthorization:
            tokenConfig
              .authorization
              .types
        },

        message:
          authorization
      });

  return {
    authorization: {
      nonce,

      validAfter:
        validAfter
          .toString(),

      validBefore:
        validBefore
          .toString()
    },

    signature
  };
}

export default
  signEip3009FundingAuthorization;
