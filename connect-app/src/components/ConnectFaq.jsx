const UNIBRIDGE_GUIDE_URL =
  "https://chatgpt.com/g/g-6a2bbad960e08191b39185eafbc55948-unibridge-official-guide";

const POPULAR_QUESTIONS = [
  "What fees apply?",
  "Which countries are supported?",
  "Does UniBridge hold my funds?"
];

function openGuide() {
  window.open(
    UNIBRIDGE_GUIDE_URL,
    "_blank",
    "noopener,noreferrer"
  );
}

export default function ConnectFaq() {
  return (
    <section className="connect-guide" aria-labelledby="connect-guide-title">
      <div className="connect-guide-heading-row">
        <span className="connect-guide-icon" aria-hidden="true">
          ✦
        </span>

        <span className="connect-guide-badge">
          Guide
        </span>
      </div>

      <h2 id="connect-guide-title">UniBridge Guide</h2>

      <p className="connect-guide-copy">
        Ask the official guide about wallet payments, fees, supported
        countries, delivery status, and safety.
      </p>

      <button
        type="button"
        className="connect-guide-full"
        onClick={openGuide}
      >
        Ask the UniBridge Guide →
      </button>

      <div className="connect-guide-popular" aria-label="Popular questions">
        <p>Popular questions</p>

        {POPULAR_QUESTIONS.map(question => (
          <button
            key={question}
            type="button"
            className="connect-guide-question"
            onClick={openGuide}
          >
            <span>{question}</span>
            <span aria-hidden="true">›</span>
          </button>
        ))}
      </div>
    </section>
  );
}
