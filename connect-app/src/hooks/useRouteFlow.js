// connect-app/src/hooks/useRouteFlow.js

import {
  useRef,
  useState
} from "react";

import {
  encodeFunctionData,
  parseUnits
} from "viem";

import {
  createPayoutIntent,
  startKyc,
  createSettlement,
  getPayoutIntent
} from "../api";

import {
  validateRouteForm
} from "../form";

import {
  storeFlowSnapshot,
  clearStoredFlow
} from "../flow/flowStorage";

import {
  isKycAlreadyPassed,
  isMissingKycUrlError
} from "../flow/kyc";

import {
  REQUIRED_CHAIN_ID,
  POLYGON_TOKENS,
  ERC20_TRANSFER_ABI,
  pickFundingAsset,
  pickFundingAmount,
  pickFundingDepositAddress
} from "../flow/funding";

import {
  saveRouteHistoryItem
} from "../history/routeHistory";

const STATUS_POLL_INTERVAL_MS = 4000;
const STATUS_POLL_MAX_ATTEMPTS = 24;

function sleep(ms) {
  return new Promise(resolve => {
    window.setTimeout(resolve, ms);
  });
}

function normalizeStatus(status = "") {
  return String(status || "")
    .trim()
    .toLowerCase();
}

function isCompletedStatus(status = "") {
  return [
    "payout_completed"
  ].includes(normalizeStatus(status));
}

function isTerminalFailureStatus(status = "") {
  return [
    "failed",
    "failure",
    "cancelled",
    "canceled",
    "expired",
    "rejected",
    "payout_failed",
    "execution_failed"
  ].includes(normalizeStatus(status));
}

function getSettlementId(settlement) {
  return (
    settlement?.settlement_id ||
    settlement?.id ||
    settlement?.route_id ||
    "N/A"
  );
}

function pickSettlementLike(intent) {
  return {
    ...intent,
    settlement_id:
      intent?.settlement_id ||
      null,
    status:
      intent?.public_route_status ||
      intent?.live_settlement_status ||
      intent?.settlement_status ||
      intent?.status ||
      null,
    live_settlement_status:
      intent?.live_settlement_status ||
      null,
    public_route_status:
      intent?.public_route_status ||
      null
  };
}

export function useRouteFlow({
  isConnected,
  address,
  chainId,
  walletClient,
  switchChainAsync,

  connectSessionId,
  selectedRoute,
  form,

  payoutIntentId,
  setPayoutIntentId,
  settlement,
  setSettlement,
  setFundingTxHash,
  setIsBusy,

  isReturnedFlow,
  writeDebug
}) {
  const [
    walletConfirmationPending,
    setWalletConfirmationPending
  ] = useState(false);

  const statusPollTokenRef = useRef(null);

  async function continueAfterKyc(intentId = payoutIntentId) {
    if (!intentId) {
      writeDebug("Missing payout intent");
      return;
    }

    setIsBusy(true);

    writeDebug("Preparing funding...", {
      payout_intent_id: intentId
    });

    const result =
      await createSettlement({
        payoutIntentId: intentId
      });

    setSettlement(result);
    setFundingTxHash(null);
    setWalletConfirmationPending(false);
    clearStoredFlow();

    writeDebug("Funding route ready. Send from wallet.", result);
  }

  async function pollSettlementAfterFunding({
    intentId,
    txHash,
    asset,
    amount
  }) {
    if (!intentId) {
      writeDebug("Wallet submitted. Waiting for route update.", {
        tx_hash: txHash,
        reason: "missing_payout_intent_id"
      });
      return;
    }

    const pollToken =
      `${intentId}:${txHash}:${Date.now()}`;

    statusPollTokenRef.current = pollToken;

    writeDebug("Wallet submitted. Checking route status...", {
      payout_intent_id: intentId,
      tx_hash: txHash,
      polling_interval_ms: STATUS_POLL_INTERVAL_MS,
      max_attempts: STATUS_POLL_MAX_ATTEMPTS
    });

    for (
      let attempt = 1;
      attempt <= STATUS_POLL_MAX_ATTEMPTS;
      attempt += 1
    ) {
      if (statusPollTokenRef.current !== pollToken) {
        return;
      }

      await sleep(STATUS_POLL_INTERVAL_MS);

      try {
        const intent =
          await getPayoutIntent({
            payoutIntentId: intentId
          });

        const refreshed =
          pickSettlementLike(intent);

        if (statusPollTokenRef.current !== pollToken) {
          return;
        }

        setSettlement(refreshed);

        if (isCompletedStatus(refreshed?.status)) {
          saveRouteHistoryItem({
            id: getSettlementId(refreshed),
            route_id: getSettlementId(refreshed),
            payout_intent_id: intentId,
            corridor: selectedRoute?.label || selectedRoute?.id || "—",
            amount: form.amount || amount || "",
            asset: form.asset || asset || "",
            status: refreshed?.status || "payout_completed"
          });

          writeDebug("Payout completed.", {
            payout_intent_id: intentId,
            settlement_id: getSettlementId(refreshed),
            tx_hash: txHash,
            status: refreshed?.status,
            live_settlement_status:
              refreshed?.live_settlement_status || null,
            public_route_status:
              refreshed?.public_route_status || null
          });

          return;
        }

        if (isTerminalFailureStatus(refreshed?.status)) {
          writeDebug("Payout did not complete.", {
            payout_intent_id: intentId,
            settlement_id: getSettlementId(refreshed),
            tx_hash: txHash,
            status: refreshed?.status,
            live_settlement_status:
              refreshed?.live_settlement_status || null,
            public_route_status:
              refreshed?.public_route_status || null
          });

          return;
        }
      } catch (err) {
        writeDebug("Route status check failed", {
          payout_intent_id: intentId,
          tx_hash: txHash,
          attempt,
          message: err.message
        });
      }
    }

    writeDebug("Wallet submitted. Route completion still pending.", {
      payout_intent_id: intentId,
      tx_hash: txHash,
      status: "still_waiting"
    });
  }

  async function startNewFlow() {
    if (!isConnected) {
      writeDebug("Connect your wallet first.");
      return;
    }

    if (chainId && Number(chainId) !== REQUIRED_CHAIN_ID) {
      writeDebug("Wallet network notice", {
        message:
          "This route uses Polygon. Your wallet may be asked to switch networks before funding.",
        expected_chain_id: REQUIRED_CHAIN_ID,
        current_chain_id: chainId
      });
    }

    if (!connectSessionId) {
      writeDebug("Connect session is still preparing. Try again in a moment.");
      return;
    }

    validateRouteForm({
      form,
      route: selectedRoute
    });

    setIsBusy(true);
    setSettlement(null);
    setFundingTxHash(null);
    setWalletConfirmationPending(false);

    statusPollTokenRef.current = null;

    writeDebug("Preparing payout route...");

    const intent =
      await createPayoutIntent({
        connectSessionId,
        walletAddress: address,
        route: selectedRoute,
        form
      });

    setPayoutIntentId(intent.payout_intent_id);

    storeFlowSnapshot({
      payout_intent_id: intent.payout_intent_id,
      route_id: selectedRoute.id,
      form
    });

    if (isKycAlreadyPassed(intent)) {
      writeDebug("Verification already completed. Preparing funding...", {
        payout_intent_id: intent.payout_intent_id,
        kyc_status: intent.kyc_status || null,
        verification_status: intent.verification_status || null,
        next_step: intent.next_step || null
      });

      await continueAfterKyc(intent.payout_intent_id);
      return;
    }

    writeDebug("Starting verification...", {
      payout_intent_id: intent.payout_intent_id
    });

    try {
      const kyc =
        await startKyc({
          payoutIntentId: intent.payout_intent_id
        });

      if (kyc.skipped || isKycAlreadyPassed(kyc)) {
        writeDebug("Verification already completed. Preparing funding...", {
          payout_intent_id: intent.payout_intent_id,
          kyc_status: kyc.kyc_status || null,
          verification_status: kyc.verification_status || null,
          next_step: kyc.next_step || null
        });

        await continueAfterKyc(intent.payout_intent_id);
        return;
      }

      if (!kyc.url) {
        writeDebug("No KYC URL returned. Preparing funding...", {
          payout_intent_id: intent.payout_intent_id
        });

        await continueAfterKyc(intent.payout_intent_id);
        return;
      }

      window.location.href = kyc.url;
    } catch (err) {
      if (isMissingKycUrlError(err)) {
        writeDebug("Verification already completed. Preparing funding...", {
          payout_intent_id: intent.payout_intent_id
        });

        await continueAfterKyc(intent.payout_intent_id);
        return;
      }

      throw err;
    }
  }

  async function ensurePolygonNetwork() {
    if (!chainId || Number(chainId) === REQUIRED_CHAIN_ID) {
      return true;
    }

    if (!switchChainAsync) {
      writeDebug("Wallet network switch unavailable", {
        message:
          "Your wallet is on the wrong network and automatic switching is unavailable.",
        expected_chain_id: REQUIRED_CHAIN_ID,
        current_chain_id: chainId
      });

      return false;
    }

    try {
      writeDebug("Switching wallet network to Polygon...", {
        expected_chain_id: REQUIRED_CHAIN_ID,
        current_chain_id: chainId
      });

      await switchChainAsync({
        chainId: REQUIRED_CHAIN_ID
      });

      writeDebug(
        "Wallet network switched. Press Send funding again.",
        {
          expected_chain_id: REQUIRED_CHAIN_ID
        }
      );

      return false;
    } catch (err) {
      writeDebug("Wallet network switch failed", {
        message: err.message,
        expected_chain_id: REQUIRED_CHAIN_ID,
        current_chain_id: chainId
      });

      return false;
    }
  }

  async function sendFundingTransaction() {
    if (!settlement?.funding) {
      writeDebug("Missing funding instructions");
      return;
    }

    if (!walletClient) {
      writeDebug("Wallet not ready");
      return;
    }

    if (!address) {
      writeDebug("Wallet address missing");
      return;
    }

    const isNetworkReady =
      await ensurePolygonNetwork();

    if (!isNetworkReady) {
      return;
    }

    const funding = settlement.funding;

    const asset = pickFundingAsset(funding);
    const amount = pickFundingAmount(funding);
    const depositAddress = pickFundingDepositAddress(funding);

    const token = POLYGON_TOKENS[asset];

    if (!token) {
      writeDebug("Unsupported funding token", {
        asset,
        supported_assets: Object.keys(POLYGON_TOKENS)
      });
      return;
    }

    if (!depositAddress) {
      writeDebug("Missing deposit address");
      return;
    }

    if (!amount || Number(amount) <= 0) {
      writeDebug("Invalid funding amount", {
        amount
      });
      return;
    }

    setIsBusy(true);
    setWalletConfirmationPending(true);

    try {
      const transferData =
        encodeFunctionData({
          abi: ERC20_TRANSFER_ABI,
          functionName: "transfer",
          args: [
            depositAddress,
            parseUnits(String(amount), token.decimals)
          ]
        });

      writeDebug("Opening wallet transfer...", {
        mode: "send_transaction_encoded_transfer",
        status: "wallet_confirmation_pending",
        asset,
        amount,
        deposit_address: depositAddress,
        token_contract: token.address,
        gas_limit: "100000"
      });

      const hash =
        await walletClient.sendTransaction({
          account: address,
          to: token.address,
          data: transferData,
          gas: 100000n
        });

      setFundingTxHash(hash);
      setWalletConfirmationPending(false);

      writeDebug("Wallet transaction submitted.", {
        tx_hash: hash,
        status: "wallet_submitted",
        mode: "send_transaction_encoded_transfer",
        asset,
        amount,
        deposit_address: depositAddress,
        token_contract: token.address
      });

      pollSettlementAfterFunding({
        intentId: payoutIntentId,
        txHash: hash,
        asset,
        amount
      });
    } catch (err) {
      setWalletConfirmationPending(false);

      writeDebug("Funding transaction failed", {
        message: err.message
      });
    } finally {
      setIsBusy(false);
    }
  }

  async function handleSend() {
    try {
      if (settlement?.funding) {
        await sendFundingTransaction();
        return;
      }

      if (isReturnedFlow) {
        await continueAfterKyc();
      } else {
        await startNewFlow();
      }
    } catch (err) {
      setWalletConfirmationPending(false);

      writeDebug("Send failed", {
        message: err.message
      });
    } finally {
      setIsBusy(false);
    }
  }

  return {
    startNewFlow,
    continueAfterKyc,
    sendFundingTransaction,
    handleSend,
    walletConfirmationPending
  };
}

export default useRouteFlow;
