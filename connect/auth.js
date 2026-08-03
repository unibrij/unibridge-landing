// connect/auth.js

import {
  createConnectSession,
  createSiwxChallenge,
  verifySiwxChallenge
} from "./api.js";

import {
  cleanAddress,
  cleanChainId,
  cleanString,
  signSiwxMessage
} from "./wallet.js";

const POLYGON_CHAIN_ID =
  137;

function assertConnectPayload(
  payload
) {
  const walletAddress =
    cleanAddress(
      payload?.wallet_address
    );

  const chainId =
    cleanChainId(
      payload?.chain_id
    );

  if (!walletAddress) {
    throw new Error(
      "reown_wallet_address_missing"
    );
  }

  if (chainId === null) {
    throw new Error(
      "wallet_chain_missing"
    );
  }

  if (
    chainId !==
    POLYGON_CHAIN_ID
  ) {
    throw new Error(
      "polygon_network_required"
    );
  }

  return {
    walletAddress,
    chainId
  };
}

function readConnectSession(
  session,
  payload
) {
  const connectSessionId =
    cleanString(
      session
        ?.connect_session_id
    );

  const connectSessionSecret =
    cleanString(
      session
        ?.connect_session_secret
    );

  if (
    !connectSessionId ||
    !connectSessionSecret
  ) {
    throw new Error(
      "connect_session_credential_missing"
    );
  }

  const walletAddress =
    cleanAddress(
      session?.wallet_address
    ) ||
    cleanAddress(
      payload?.wallet_address
    );

  const chainId =
    cleanChainId(
      session?.chain_id
    ) ??
    cleanChainId(
      payload?.chain_id
    );

  if (!walletAddress) {
    throw new Error(
      "connect_session_wallet_missing"
    );
  }

  if (chainId === null) {
    throw new Error(
      "connect_session_chain_missing"
    );
  }

  if (
    chainId !==
    POLYGON_CHAIN_ID
  ) {
    throw new Error(
      "polygon_network_required"
    );
  }

  return {
    connectSessionId,
    connectSessionSecret,
    walletAddress,
    chainId
  };
}

function readChallenge(
  challenge
) {
  const challengeId =
    cleanString(
      challenge?.challenge_id
    );

  const message =
    typeof challenge?.message ===
      "string" &&
    challenge.message
      ? challenge.message
      : null;

  if (!challengeId) {
    throw new Error(
      "siwx_challenge_id_missing"
    );
  }

  if (!message) {
    throw new Error(
      "siwx_challenge_message_missing"
    );
  }

  return {
    challengeId,
    message
  };
}

function readVerification(
  verification,
  {
    walletAddress,
    chainId
  }
) {
  if (
    verification?.auth_status !==
    "authenticated"
  ) {
    throw new Error(
      "siwx_authentication_failed"
    );
  }

  const authenticatedWalletAddress =
    cleanAddress(
      verification
        ?.wallet_address
    ) ||
    walletAddress;

  const authenticatedChainId =
    cleanChainId(
      verification?.chain_id
    ) ??
    chainId;

  const customerId =
    cleanString(
      verification?.customer_id
    );

  const customerIdentityId =
    cleanString(
      verification
        ?.customer_identity_id
    );

  if (
    authenticatedWalletAddress !==
    walletAddress
  ) {
    throw new Error(
      "authenticated_wallet_mismatch"
    );
  }

  if (
    authenticatedChainId !==
    POLYGON_CHAIN_ID
  ) {
    throw new Error(
      "authenticated_chain_mismatch"
    );
  }

  if (
    !customerId ||
    !customerIdentityId
  ) {
    throw new Error(
      "authenticated_customer_context_missing"
    );
  }

  return {
    authStatus:
      "authenticated",

    walletAddress:
      authenticatedWalletAddress,

    chainId:
      authenticatedChainId,

    customerId,

    customerIdentityId,

    authExpiresAt:
      verification
        ?.auth_expires_at ||
      null
  };
}

export async function authenticateConnect({
  appkit,
  payload,
  onChallenge
}) {
  const claimed =
    assertConnectPayload(
      payload
    );

  const session =
    await createConnectSession(
      payload
    );

  const credentials =
    readConnectSession(
      session,
      payload
    );

  if (
    credentials.walletAddress !==
    claimed.walletAddress
  ) {
    throw new Error(
      "connect_session_wallet_mismatch"
    );
  }

  if (
    credentials.chainId !==
    claimed.chainId
  ) {
    throw new Error(
      "connect_session_chain_mismatch"
    );
  }

  const challenge =
    await createSiwxChallenge({
      connectSessionId:
        credentials
          .connectSessionId,

      connectSessionSecret:
        credentials
          .connectSessionSecret,

      address:
        credentials
          .walletAddress,

      chainId:
        credentials.chainId
    });

  const {
    challengeId,
    message
  } =
    readChallenge(
      challenge
    );

  if (
    typeof onChallenge ===
    "function"
  ) {
    onChallenge({
      walletAddress:
        credentials
          .walletAddress,

      chainId:
        credentials.chainId,

      expiresAt:
        challenge?.expires_at ||
        null
    });
  }

  const signature =
    await signSiwxMessage({
      appkit,

      address:
        credentials
          .walletAddress,

      message
    });

  const verification =
    await verifySiwxChallenge({
      connectSessionId:
        credentials
          .connectSessionId,

      connectSessionSecret:
        credentials
          .connectSessionSecret,

      challengeId,

      message,

      signature
    });

  const authenticated =
    readVerification(
      verification,
      credentials
    );

  return {
    connectSessionId:
      credentials
        .connectSessionId,

    connectSessionSecret:
      credentials
        .connectSessionSecret,

    ...authenticated
  };
}
