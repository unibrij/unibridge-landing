// connect-app/src/hooks/useFundingTransaction.js

import {
  encodeFunctionData,
  parseUnits
} from "viem";

import {
  clearStoredFlow
} from "../flow/flowStorage";

import {
  resolveFundingCapability
} from "../flow/fundingCapability";

import {
  REQUIRED_CHAIN_ID,
  POLYGON_TOKENS,
  ERC20_TRANSFER_ABI,
  pickFundingAsset,
  pickFundingAmount,
  pickFundingDepositAddress
} from "../flow/funding";

const GAS_LIMIT_BUFFER_BPS =
  2000n;

const BPS_DENOMINATOR =
  10000n;

function bigintToString(
  value
) {
  return typeof value ===
    "bigint"
    ? value.toString()
    : value ??
        null;
}

function addGasLimitBuffer(
  gasLimit
) {
  if (
    typeof gasLimit !==
      "bigint"
  ) {
    return null;
  }

  return (
    gasLimit *
    (
      BPS_DENOMINATOR +
      GAS_LIMIT_BUFFER_BPS
    )
  ) /
    BPS_DENOMINATOR;
}

export function useFundingTransaction({
  address,
  chainId,
  walletClient,
  switchChainAsync,

  settlement,
  payoutIntentId,
  payoutIntentIdRef,

  setFundingTxHash,
  setIsBusy,
  setWalletConfirmationPending,

  pollSettlementAfterFunding,
  writeDebug
}) {
  async function ensurePolygonNetwork() {
    if (
      !chainId ||
      Number(
        chainId
      ) ===
        REQUIRED_CHAIN_ID
    ) {
      return true;
    }

    if (!switchChainAsync) {
      writeDebug(
        "Wallet network switch unavailable",
        {
          message:
            "Your wallet is on the wrong network and automatic switching is unavailable.",

          expected_chain_id:
            REQUIRED_CHAIN_ID,

          current_chain_id:
            chainId
        }
      );

      return false;
    }

    try {
      writeDebug(
        "Switching wallet network to Polygon...",
        {
          expected_chain_id:
            REQUIRED_CHAIN_ID,

          current_chain_id:
            chainId
        }
      );

      await switchChainAsync({
        chainId:
          REQUIRED_CHAIN_ID
      });

      writeDebug(
        "Wallet network switched. Press Send funding again.",
        {
          expected_chain_id:
            REQUIRED_CHAIN_ID
        }
      );

      return false;
    }
    catch (
      err
    ) {
      writeDebug(
        "Wallet network switch failed",
        {
          message:
            err?.message ||
            String(
              err
            ),

          expected_chain_id:
            REQUIRED_CHAIN_ID,

          current_chain_id:
            chainId
        }
      );

      return false;
    }
  }

  async function sendFundingTransaction() {
    if (!settlement?.funding) {
      writeDebug(
        "Missing funding instructions"
      );

      return;
    }

    if (!walletClient) {
      writeDebug(
        "Wallet not ready"
      );

      return;
    }

    if (!address) {
      writeDebug(
        "Wallet address missing"
      );

      return;
    }

    const isNetworkReady =
      await ensurePolygonNetwork();

    if (!isNetworkReady) {
      return;
    }

    const funding =
      settlement.funding;

    const asset =
      pickFundingAsset(
        funding
      );

    const amount =
      pickFundingAmount(
        funding
      );

    const depositAddress =
      pickFundingDepositAddress(
        funding
      );

    const token =
      POLYGON_TOKENS[
        asset
      ];

    if (!token) {
      writeDebug(
        "Unsupported funding token",
        {
          asset,

          supported_assets:
            Object.keys(
              POLYGON_TOKENS
            )
        }
      );

      return;
    }

    if (!depositAddress) {
      writeDebug(
        "Missing deposit address"
      );

      return;
    }

    if (
      !amount ||
      Number(
        amount
      ) <= 0
    ) {
      writeDebug(
        "Invalid funding amount",
        {
          amount
        }
      );

      return;
    }

    setIsBusy(
      true
    );

    try {
      const transferData =
        encodeFunctionData({
          abi:
            ERC20_TRANSFER_ABI,

          functionName:
            "transfer",

          args: [
            depositAddress,

            parseUnits(
              String(
                amount
              ),
              token.decimals
            )
          ]
        });

      const transaction = {
        to:
          token.address,

        data:
          transferData,

        value:
          0n
      };

      writeDebug(
        "Checking funding gas availability...",
        {
          asset,
          amount,

          chain_id:
            REQUIRED_CHAIN_ID,

          deposit_address:
            depositAddress,

          token_contract:
            token.address
        }
      );

      const fundingCapability =
        await resolveFundingCapability({
          walletClient,
          address,

          chainId:
            REQUIRED_CHAIN_ID,

          transaction
        });

      writeDebug(
        "Funding gas availability resolved",
        {
          mode:
            fundingCapability
              .mode,

          reason:
            fundingCapability
              .reason,

          native_balance:
            bigintToString(
              fundingCapability
                .native_balance
            ),

          estimated_gas:
            bigintToString(
              fundingCapability
                .estimated_gas
            ),

          gas_price:
            bigintToString(
              fundingCapability
                .gas_price
            ),

          estimated_gas_cost:
            bigintToString(
              fundingCapability
                .estimated_gas_cost
            ),

          buffered_gas_cost:
            bigintToString(
              fundingCapability
                .buffered_gas_cost
            ),

          required_native_amount:
            bigintToString(
              fundingCapability
                .required_native_amount
            )
        }
      );

      if (
        fundingCapability.mode ===
          "insufficient_gas"
      ) {
        /*
         * UniBridge sponsorship will be inserted
         * here.
         *
         * Until that adapter exists, do not open
         * the wallet with a transaction that we
         * already know cannot pay network gas.
         */

        writeDebug(
          "Insufficient POL for network fee",
          {
            message:
              "Your wallet does not have enough POL to pay the Polygon network fee.",

            status:
              "insufficient_gas",

            reason:
              fundingCapability
                .reason,

            native_balance:
              bigintToString(
                fundingCapability
                  .native_balance
              ),

            required_native_amount:
              bigintToString(
                fundingCapability
                  .required_native_amount
              ),

            asset,
            amount,

            deposit_address:
              depositAddress,

            token_contract:
              token.address
          }
        );

        return;
      }

      if (
        fundingCapability.mode ===
          "preflight_unavailable"
      ) {
        /*
         * Unknown gas state must not fall through
         * to native execution.
         *
         * This will also become a sponsorship
         * candidate once that adapter exists.
         */

        writeDebug(
          "Funding gas preflight unavailable",
          {
            message:
              "Unable to verify the Polygon network fee requirements.",

            status:
              "preflight_unavailable",

            reason:
              fundingCapability
                .reason,

            native_balance:
              bigintToString(
                fundingCapability
                  .native_balance
              ),

            estimated_gas:
              bigintToString(
                fundingCapability
                  .estimated_gas
              ),

            gas_price:
              bigintToString(
                fundingCapability
                  .gas_price
              ),

            asset,
            amount,

            deposit_address:
              depositAddress,

            token_contract:
              token.address
          }
        );

        return;
      }

      if (
        fundingCapability.mode !==
          "native"
      ) {
        throw new Error(
          `Unsupported funding capability mode: ${String(
            fundingCapability.mode
          )}`
        );
      }

      if (
        typeof fundingCapability
          .estimated_gas !==
        "bigint"
      ) {
        throw new Error(
          "Native funding selected without a valid gas estimate"
        );
      }

      const nativeGasLimit =
        addGasLimitBuffer(
          fundingCapability
            .estimated_gas
        );

      if (
        typeof nativeGasLimit !==
          "bigint"
      ) {
        throw new Error(
          "Unable to build native gas limit"
        );
      }

      const executionMode =
        "send_transaction_encoded_transfer";

      setWalletConfirmationPending(
        true
      );

      writeDebug(
        "Opening wallet transfer...",
        {
          mode:
            executionMode,

          status:
            "wallet_confirmation_pending",

          capability_reason:
            fundingCapability
              .reason,

          asset,
          amount,

          deposit_address:
            depositAddress,

          token_contract:
            token.address,

          estimated_gas:
            fundingCapability
              .estimated_gas
              .toString(),

          gas_limit:
            nativeGasLimit
              .toString()
        }
      );

      const hash =
        await walletClient
          .sendTransaction({
            account:
              address,

            to:
              token.address,

            data:
              transferData,

            gas:
              nativeGasLimit
          });

      setWalletConfirmationPending(
        false
      );

      if (!hash) {
        throw new Error(
          "Funding execution completed without a transaction hash"
        );
      }

      setFundingTxHash(
        hash
      );

      clearStoredFlow();

      writeDebug(
        "Wallet transaction submitted.",
        {
          tx_hash:
            hash,

          status:
            "wallet_submitted",

          mode:
            executionMode,

          asset,
          amount,

          deposit_address:
            depositAddress,

          token_contract:
            token.address
        }
      );

      const activeIntentId =
        payoutIntentIdRef.current ||
        payoutIntentId ||
        null;

      void pollSettlementAfterFunding({
        intentId:
          activeIntentId,

        txHash:
          hash,

        asset,
        amount
      });
    }
    catch (
      err
    ) {
      setWalletConfirmationPending(
        false
      );

      writeDebug(
        "Funding transaction failed",
        {
          message:
            err?.message ||
            String(
              err
            )
        }
      );
    }
    finally {
      setIsBusy(
        false
      );
    }
  }

  return {
    ensurePolygonNetwork,
    sendFundingTransaction
  };
}

export default useFundingTransaction;
