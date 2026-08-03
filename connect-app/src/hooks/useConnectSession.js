// connect-app/src/hooks/useConnectSession.js

import {
  useCallback,
  useEffect,
  useState
} from "react";

import {
  createConnectSession,
  createSiwxChallenge,
  verifySiwxChallenge
} from "../api";

import {
  REQUIRED_CHAIN_ID
} from "../flow/funding";

function normalizeAddress(
  value
) {
  return String(
    value || ""
  )
    .trim()
    .toLowerCase();
}

export function useConnectSession({
  isConnected,
  address,
  chainId,
  walletClient,
  writeDebug
}) {
  const [
    connectSessionId,
    setConnectSessionId
  ] = useState(null);

  const [
    connectSessionSecret,
    setConnectSessionSecret
  ] = useState(null);

  const [
    connectSessionWallet,
    setConnectSessionWallet
  ] = useState(null);

  const [
    connectSessionStatus,
    setConnectSessionStatus
  ] = useState("idle");

  const [
    connectSessionError,
    setConnectSessionError
  ] = useState(null);

  const [
    retryVersion,
    setRetryVersion
  ] = useState(0);

  const clearConnectSession =
    useCallback(() => {
      setConnectSessionId(
        null
      );

      setConnectSessionSecret(
        null
      );

      setConnectSessionWallet(
        null
      );

      setConnectSessionStatus(
        "idle"
      );

      setConnectSessionError(
        null
      );
    }, []);

  const resetConnectSession =
    useCallback(() => {
      clearConnectSession();

      setRetryVersion(
        current =>
          current + 1
      );
    }, [
      clearConnectSession
    ]);

  const retryConnectSession =
    useCallback(() => {
      resetConnectSession();
    }, [
      resetConnectSession
    ]);

  useEffect(() => {
    if (isConnected) {
      return;
    }

    clearConnectSession();
  }, [
    clearConnectSession,
    isConnected
  ]);

  useEffect(() => {
    if (
      !isConnected ||
      !address ||
      !walletClient ||
      chainId === null ||
      chainId === undefined
    ) {
      return undefined;
    }

    let cancelled =
      false;

    const normalizedAddress =
      normalizeAddress(
        address
      );

    async function authenticateWallet() {
      clearConnectSession();

      if (
        Number(
          chainId
        ) !==
        Number(
          REQUIRED_CHAIN_ID
        )
      ) {
        throw new Error(
          `switch_to_chain_${REQUIRED_CHAIN_ID}`
        );
      }

      setConnectSessionStatus(
        "creating_session"
      );

      const session =
        await createConnectSession({
          walletAddress:
            address,

          chainId,

          source:
            "reown"
        });

      if (cancelled) {
        return;
      }

      setConnectSessionStatus(
        "requesting_signature"
      );

      const challenge =
        await createSiwxChallenge({
          connectSessionId:
            session
              .connect_session_id,

          connectSessionSecret:
            session
              .connect_session_secret,

          address,

          chainId
        });

      if (cancelled) {
        return;
      }

      const signature =
        await walletClient
          .signMessage({
            account:
              address,

            message:
              challenge.message
          });

      if (cancelled) {
        return;
      }

      setConnectSessionStatus(
        "verifying"
      );

      const verification =
        await verifySiwxChallenge({
          connectSessionId:
            session
              .connect_session_id,

          connectSessionSecret:
            session
              .connect_session_secret,

          challengeId:
            challenge
              .challenge_id,

          message:
            challenge.message,

          signature
        });

      if (cancelled) {
        return;
      }

      const verifiedAddress =
        verification
          .wallet_address ||
        verification
          .address ||
        address;

      if (
        normalizeAddress(
          verifiedAddress
        ) !==
        normalizedAddress
      ) {
        throw new Error(
          "authenticated_wallet_mismatch"
        );
      }

      setConnectSessionId(
        session
          .connect_session_id
      );

      setConnectSessionSecret(
        session
          .connect_session_secret
      );

      setConnectSessionWallet(
        address
      );

      setConnectSessionStatus(
        "authenticated"
      );

      setConnectSessionError(
        null
      );

      writeDebug(
        "Wallet authenticated",
        {
          connect_session_id:
            session
              .connect_session_id,

          wallet_address:
            address,

          chain_id:
            chainId,

          customer_id:
            verification
              .customer_id ||
            null,

          customer_identity_id:
            verification
              .customer_identity_id ||
            null
        }
      );
    }

    authenticateWallet()
      .catch(error => {
        if (cancelled) {
          return;
        }

        const message =
          error?.message ||
          "wallet_authentication_failed";

        setConnectSessionId(
          null
        );

        setConnectSessionSecret(
          null
        );

        setConnectSessionWallet(
          null
        );

        setConnectSessionStatus(
          "error"
        );

        setConnectSessionError(
          message
        );

        writeDebug(
          "Wallet authentication failed",
          {
            message
          }
        );
      });

    return () => {
      cancelled =
        true;
    };
  }, [
    address,
    chainId,
    clearConnectSession,
    isConnected,
    retryVersion,
    walletClient,
    writeDebug
  ]);

  return {
    connectSessionId,
    connectSessionSecret,
    connectSessionWallet,
    connectSessionStatus,
    connectSessionError,
    retryConnectSession,
    resetConnectSession
  };
}

export default useConnectSession;
