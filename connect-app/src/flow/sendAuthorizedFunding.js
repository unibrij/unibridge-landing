// connect-app/src/flow/sendAuthorizedFunding.js

import {
  authorizeFunding
} from "../api";

import {
  AUTHORIZED_FUNDING_METHOD,
  POLYGON_CHAIN_ID,
  resolveAuthorizedFundingToken
} from "./authorizedFundingTokens";

import {
  signEip3009FundingAuthorization
} from "./signEip3009FundingAuthorization";

import {
  signPolygonNativeMetaTransactionFunding
} from "./signPolygonNativeMetaTransactionFunding";

function normalizeString(
  value
) {
  return String(
    value ??
    ""
  ).trim();
}

function normalizeUpper(
  value
) {
  return normalizeString(
    value
  ).toUpperCase();
}

export async function sendAuthorizedFunding({
  walletClient,
  publicClient,

  wallet,
  depositAddress,
  amount,
  token,

  settlementId,
  accessToken
} = {}) {
  const normalizedSettlementId =
    normalizeString(
      settlementId
    );

  if (
    !normalizedSettlementId
  ) {
    throw new Error(
      "missing_authorized_funding_identity"
    );
  }

  const asset =
    normalizeUpper(
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

  if (!tokenConfig) {
    throw new Error(
      "authorized_funding_token_unsupported"
    );
  }

  let signed;

  const method =
    tokenConfig
      .authorization
      .method;

  if (
    method ===
    AUTHORIZED_FUNDING_METHOD
      .EIP3009_TRANSFER
  ) {
    signed =
      await signEip3009FundingAuthorization({
        walletClient,
        wallet,
        depositAddress,
        amount,
        token
      });
  }
  else if (
    method ===
    AUTHORIZED_FUNDING_METHOD
      .POLYGON_NATIVE_META_TRANSACTION
  ) {
    signed =
      await signPolygonNativeMetaTransactionFunding({
        walletClient,
        publicClient,
        wallet,
        depositAddress,
        amount,
        token
      });
  }
  else {
    throw new Error(
      "authorized_funding_method_unsupported"
    );
  }

  const result =
    await authorizeFunding({
      settlementId:
        normalizedSettlementId,

      authorization:
        signed.authorization,

      signature:
        signed.signature,

      accessToken
    });

  return {
    mode:
      result.mode,

    txHash:
      result.tx_hash,

    chainId:
      result.chain_id
  };
}

export default
  sendAuthorizedFunding;
