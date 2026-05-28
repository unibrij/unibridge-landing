// connect-app/src/hooks/useRouteFlow.js

import { parseUnits } from "viem";

import {
  createPayoutIntent,
  startKyc,
  createSettlement
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
    clearStoredFlow();

    writeDebug("Funding route ready. Send from wallet.", result);
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

    try {
      writeDebug("Opening wallet transfer...", {
        asset,
        amount,
        deposit_address: depositAddress,
        token_contract: token.address,
        gas_limit: "100000"
      });

      const hash =
        await walletClient.writeContract({
          account: address,
          address: token.address,
          abi: ERC20_TRANSFER_ABI,
          functionName: "transfer",
          args: [
            depositAddress,
            parseUnits(String(amount), token.decimals)
          ],
          gas: 100000n
        });

      setFundingTxHash(hash);

      writeDebug("Wallet transaction submitted.", {
        tx_hash: hash,
        status: "wallet_submitted_only",
        asset,
        amount,
        deposit_address: depositAddress,
        token_contract: token.address
      });
    } catch (err) {
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
    handleSend
  };
}

export default useRouteFlow;
