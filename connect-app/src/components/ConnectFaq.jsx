import { useState } from "react";

const FAQS = [
  {
    question: "Can I use MetaMask with UniBridge?",
    answer:
      "Yes. You can connect MetaMask to UniBridge Connect and use it to fund supported payout routes."
  },
  {
    question: "Can I use Trust Wallet with UniBridge?",
    answer:
      "Yes. You can connect Trust Wallet to UniBridge Connect when Trust Wallet supports the selected route network."
  },
  {
    question: "Is UniBridge a wallet?",
    answer:
      "No. UniBridge is not a wallet. You connect the wallet you already use."
  },
  {
    question: "Does UniBridge take custody of my funds?",
    answer:
      "No. UniBridge does not take custody of customer funds. UniBridge coordinates the payout route."
  },
  {
    question: "Can I pay Brazil by PIX from USDC?",
    answer:
      "Yes. UniBridge supports routes where users can fund a Brazil PIX payout with supported stablecoins such as USDC or USDT."
  },
  {
    question: "Can I reuse a payout route?",
    answer:
      "Yes. You can reuse saved payout route details when reuse is supported by the selected route."
  },
  {
    question: "What is a payout route?",
    answer:
      "A payout route is a ready path that connects funding, settlement, execution, and local payout delivery."
  }
];

export default function ConnectFaq() {
  const [openIndex, setOpenIndex] = useState(null);

  function toggleItem(index) {
    setOpenIndex(current => (current === index ? null : index));
  }

  return (
    <section className="connect-faq" aria-labelledby="connect-faq-title">
      <p className="connect-faq-eyebrow">FAQ</p>
      <h2 id="connect-faq-title">UniBridge Connect FAQ</h2>

      <div className="connect-faq-list">
        {FAQS.map((item, index) => {
          const isOpen = openIndex === index;
          const panelId = `connect-faq-panel-${index}`;

          return (
            <div
              key={item.question}
              className={`connect-faq-item ${isOpen ? "is-open" : ""}`}
            >
              <button
                type="button"
                className="connect-faq-question"
                aria-expanded={isOpen}
                aria-controls={panelId}
                onClick={() => toggleItem(index)}
              >
                <span>{item.question}</span>
                <span className="connect-faq-icon" aria-hidden="true">
                  +
                </span>
              </button>

              <div
                id={panelId}
                className="connect-faq-answer"
                hidden={!isOpen}
              >
                <p>{item.answer}</p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
