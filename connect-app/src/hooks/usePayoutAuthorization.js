// connect-app/src/hooks/usePayoutAuthorization.js

import {
  useEffect,
  useState
} from "react";

import {
  useAppKitProvider
} from "@reown/appkit/react";

import {
  stringToHex
} from "viem";

import {
  requestAuthorizationMessage,
  submitAuthorization
} from "../api";

import {
  normalizeStatus
} from "../flow/routeFlowUtils";

import {
  readPayoutAccessToken,
  storePayoutAccessToken,
  clearPayoutAccessToken
} from "../flow/payoutAccessTokenStorage";

function normalizeAddress(value) {
  return String(
    value || ""
  )
    .trim()
    .toLowerCase();
}

export function usePayoutAuthorization({
  payoutIntentId,
  address,
  setWalletConfirmationPending,
  writeDebug
}) {
  const {
    walletProvider
  } = useAppKitProvider(
    "eip155"
  );

  const [
    payoutAccessToken,
    setPayoutAccessToken
  ] = useState(
    () =>
      readPayoutAccessToken(
        payoutIntentId
      )?.token ||
      null
  );

  useEffect(() => {
    setPayoutAccessToken(
      readPayoutAccessToken(
        payoutIntentId
      )?.token ||
      null
    );
  }, [
    payoutIntentId
  ]);

  function resetPayoutAccessToken(
    intentId = payoutIntentId
  ) {
    clearPayoutAccessToken(
      intentId
    );

    setPayoutAccessToken(
      null
    );
  }

  function requireStoredAccessToken(
    intentId
  ) {
    const stored =
      readPayoutAccessToken(
        intentId
      );

    if (!stored?.token) {
      throw new Error(
        "payout_access_token_missing_for_authorized_intent"
      );
    }

    setPayoutAccessToken(
      stored.token
    );

    return stored.token;
  }

  async function authorizeIntentWithWallet(
    intentId
  ) {
    if (!intentId) {
      throw new Error(
        "payout_intent_id_required"
      );
    }

    if (
      !walletProvider ||
      typeof walletProvider.request !==
        "function"
    ) {
      throw new Error(
        "wallet_provider_not_ready"
      );
    }

    if (!address) {
      throw new Error(
        "wallet_address_required"
      );
    }

    writeDebug(
      "Preparing wallet authorization...",
      {
        payout_intent_id:
          intentId
      }
    );

    const challenge =
      await requestAuthorizationMessage({
        payoutIntentId:
          intentId
      });

    const message =
      String(
        challenge?.message ||
        ""
      );

    const nonce =
      String(
        challenge?.nonce ||
        ""
      );

    if (!message) {
      throw new Error(
        "authorization_message_missing"
      );
    }

    if (!nonce) {
      throw new Error(
        "authorization_nonce_missing"
      );
    }

    const challengeAddress =
      normalizeAddress(
        challenge?.wallet_address
      );

    const connectedAddress =
      normalizeAddress(
        address
      );

    if (
      challengeAddress &&
      challengeAddress !==
        connectedAddress
    ) {
      throw new Error(
        "authorization_wallet_mismatch"
      );
    }

    setWalletConfirmationPending(
      true
    );

    try {
      writeDebug(
        "Confirm wallet authorization...",
        {
          payout_intent_id:
            intentId,

          wallet_address:
            address,

          signing_transport:
            "appkit_provider"
        }
      );

      const signature =
        await walletProvider.request({
          method:
            "personal_sign",

          params: [
            stringToHex(
              message
            ),

            address
          ]
        });

      if (
        typeof signature !==
          "string" ||
        !signature
      ) {
        throw new Error(
          "wallet_signature_missing"
        );
      }

      writeDebug(
        "Wallet authorization signature received.",
        {
          payout_intent_id:
            intentId,

          wallet_address:
            address,

          signing_transport:
            "appkit_provider"
        }
      );

      const authorization =
        await submitAuthorization({
          payoutIntentId:
            intentId,

          message,
          nonce,
          signature
        });

      const accessToken =
        String(
          authorization
            ?.payout_access_token ||
          ""
        ).trim();

      if (!accessToken) {
        throw new Error(
          "payout_access_token_missing"
        );
      }

      storePayoutAccessToken({
        payoutIntentId:
          intentId,

        token:
          accessToken,

        expiresAt:
          authorization
            ?.payout_access_token_expires_at ||
          null
      });

      setPayoutAccessToken(
        accessToken
      );

      writeDebug(
        "Wallet authorization completed.",
        {
          payout_intent_id:
            intentId,

          customer_id:
            authorization
              ?.customer_id ||
            null,

          customer_identity_id:
            authorization
              ?.customer_identity_id ||
            null,

          payout_access_token_expires_at:
            authorization
              ?.payout_access_token_expires_at ||
            null
        }
      );

      return authorization;
    }
    finally {
      setWalletConfirmationPending(
        false
      );
    }
  }

  async function ensureIntentAuthorized({
    intentId,
    authorizationStatus
  }) {
    if (
      normalizeStatus(
        authorizationStatus
      ) ===
      "signed"
    ) {
      return {
        payout_access_token:
          requireStoredAccessToken(
            intentId
          ),

        reused:
          true
      };
    }

    return authorizeIntentWithWallet(
      intentId
    );
  }

  return {
    payoutAccessToken,
    authorizeIntentWithWallet,
    ensureIntentAuthorized,
    resetPayoutAccessToken
  };
}

export default usePayoutAuthorization;
