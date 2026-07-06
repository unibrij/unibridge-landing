// partner-portal/js/partnerExecutionGuideView.js

export function renderIntegrationGuidePanel({
  state
} = {}) {
  if (!state.application) {
    return "";
  }

  const apiBaseUrl =
    "https://unibridge-v2-1066944028362.us-central1.run.app";

  return `
    <section class="portal-card">
      <h2>Integration guide</h2>

      <p>
        Use your pilot API key to integrate with the
        Partner Execution API.
      </p>

      <h3>1. Register session</h3>

      <pre class="code-block"><code>curl -X POST ${apiBaseUrl}/v2/integrations/execution/session/register \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_PILOT_API_KEY" \\
  -d '{
    "receiver_country": "BR",
    "source_country": "US",
    "source_currency": "USD",
    "amount": 25,
    "partner_reference": "demo-session-001"
  }'</code></pre>

      <p>
        Save the returned
        <code>session_id</code>.
      </p>

      <h3>2. Resolve session</h3>

      <pre class="code-block"><code>curl -X POST ${apiBaseUrl}/v2/integrations/execution/session/resolve \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_PILOT_API_KEY" \\
  -d '{
    "session_id": "SESSION_ID"
  }'</code></pre>

      <h3>3. Quote</h3>

      <pre class="code-block"><code>curl -X POST ${apiBaseUrl}/v2/integrations/execution/session/quote \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_PILOT_API_KEY" \\
  -d '{
    "session_id": "SESSION_ID",
    "amount": 25
  }'</code></pre>

      <p>
        Save the returned
        <code>route_id</code>.
      </p>

      <h3>4. Create settlement</h3>

      <pre class="code-block"><code>curl -X POST ${apiBaseUrl}/v2/integrations/execution/settlement/create \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_PILOT_API_KEY" \\
  -d '{
    "session_id": "SESSION_ID",
    "route_id": "ROUTE_ID_FROM_QUOTE",
    "destination": {
      "pix": "receiver@example.com"
    },
    "redirect_url": "https://partner.example.com/return"
  }'</code></pre>

      <p>
        Save the returned
        <code>settlement_id</code> and
        <code>funding_session_id</code>.
      </p>

      <h3>5. Create funding</h3>

      <pre class="code-block"><code>curl -X POST ${apiBaseUrl}/v2/integrations/execution/funding/create \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_PILOT_API_KEY" \\
  -d '{
    "settlement_id": "SETTLEMENT_ID",
    "redirect_url": "https://partner.example.com/return"
  }'</code></pre>

      <h3>6. Create or refresh funding session</h3>

      <pre class="code-block"><code>curl -X POST ${apiBaseUrl}/v2/integrations/execution/funding/session \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_PILOT_API_KEY" \\
  -d '{
    "settlement_id": "SETTLEMENT_ID",
    "redirect_url": "https://partner.example.com/return"
  }'</code></pre>

      <p>
        Save the returned
        <code>funding_session_id</code>
        if returned.
      </p>

      <h3>7. Check funding address state</h3>

      <pre class="code-block"><code>curl -X POST ${apiBaseUrl}/v2/integrations/execution/funding/address-state \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_PILOT_API_KEY" \\
  -d '{
    "settlement_id": "SETTLEMENT_ID"
  }'</code></pre>

      <h3>8. Recover funding session</h3>

      <pre class="code-block"><code>curl -X POST ${apiBaseUrl}/v2/integrations/execution/funding/recover \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_PILOT_API_KEY" \\
  -d '{
    "settlement_id": "SETTLEMENT_ID"
  }'</code></pre>

      <h3>9. Confirm settlement</h3>

      <pre class="code-block"><code>curl -X POST ${apiBaseUrl}/v2/integrations/execution/settlement/confirm \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_PILOT_API_KEY" \\
  -d '{
    "settlement_id": "SETTLEMENT_ID"
  }'</code></pre>

      <h3>10. Check settlement status</h3>

      <pre class="code-block"><code>curl "${apiBaseUrl}/v2/integrations/execution/settlement/status?settlement_id=SETTLEMENT_ID" \\
  -H "Authorization: Bearer YOUR_PILOT_API_KEY"</code></pre>

      <pre class="code-block"><code>curl "${apiBaseUrl}/v2/integrations/execution/settlement/status?session_id=SESSION_ID" \\
  -H "Authorization: Bearer YOUR_PILOT_API_KEY"</code></pre>

      <p>
        Destination fields depend on the selected route.
        For BR PIX use:
        <code>{ "pix": "receiver@example.com" }</code>.
      </p>
    </section>
  `;
}
