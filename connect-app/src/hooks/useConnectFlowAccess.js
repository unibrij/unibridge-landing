// connect-app/src/hooks/useConnectFlowAccess.js

import {
  useState
} from "react";

import {
  readPayoutAccessToken,
  readLastPayoutAccessToken
} from "../flow/payoutAccessTokenStorage";


export default function useConnectFlowAccess({
  entry,
  isHistoryPage,
  repeatSourcePayoutIntentId
}) {
  /*
   * Token belonging to the flow that established
   * this mounted Connect entry.
   *
   * Entry policy already resolved precedence:
   *
   * Returned
   * → Repeat
   * → Receive
   * → Standard
   */
  const [
    flowAccessToken
  ] = useState(() => {
    const accessPayoutIntentId =
      entry
        ?.accessPayoutIntentId ||
      null;

    if (
      !accessPayoutIntentId
    ) {
      return null;
    }

    return (
      readPayoutAccessToken(
        accessPayoutIntentId
      )?.token ||
      null
    );
  });

  /*
   * Customer-auth fallback.
   *
   * History and repeat are customer-scoped by Core.
   * Prefer the most recently stored customer token
   * when available.
   */
  const [
    fallbackAccessToken
  ] = useState(() => {
    return (
      readLastPayoutAccessToken()
        ?.token ||
      null
    );
  });

  const historyAccessToken =
    isHistoryPage
      ? (
          fallbackAccessToken ||
          flowAccessToken ||
          null
        )
      : null;

  const repeatAccessToken =
    repeatSourcePayoutIntentId
      ? (
          fallbackAccessToken ||
          flowAccessToken ||
          null
        )
      : null;

  return {
    flowAccessToken,
    fallbackAccessToken,

    historyAccessToken,
    repeatAccessToken
  };
}
