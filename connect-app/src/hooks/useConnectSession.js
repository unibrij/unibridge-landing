// connect-app/src/hooks/useConnectSession.js

import { useEffect, useState } from "react";

import {
  createConnectSession
} from "../api";

import {
  REQUIRED_CHAIN_ID
} from "../flow/funding";

export function useConnectSession({
  isConnected,
  address,
  writeDebug
}) {
  const [connectSessionId, setConnectSessionId] =
    useState(null);

  const [connectSessionWallet, setConnectSessionWallet] =
    useState(null);

  useEffect(() => {
    if (isConnected) {
      return;
    }

    setConnectSessionId(null);
    setConnectSessionWallet(null);
  }, [isConnected]);

  useEffect(() => {
    if (
      !isConnected ||
      !address ||
      connectSessionWallet === address
    ) {
      return;
    }

    async function prepareConnectSession() {
      const data =
        await createConnectSession({
          walletAddress: address,
          chainId: REQUIRED_CHAIN_ID,
          source: "reown"
        });

      setConnectSessionId(data.connect_session_id);
      setConnectSessionWallet(address);

      writeDebug("Connect session ready", data);
    }

    prepareConnectSession().catch(err => {
      setConnectSessionId(null);
      setConnectSessionWallet(null);

      writeDebug("Connect session failed", {
        message: err.message
      });
    });
  }, [
    isConnected,
    address,
    connectSessionWallet,
    writeDebug
  ]);

  function resetConnectSession() {
    setConnectSessionId(null);
    setConnectSessionWallet(null);
  }

  return {
    connectSessionId,
    connectSessionWallet,
    resetConnectSession
  };
}

export default useConnectSession;
