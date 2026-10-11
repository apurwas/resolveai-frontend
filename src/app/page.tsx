"use client";

import { useState } from "react";

type Evidence = {
  transactions?: any[];
  upi_profile?: any;
  accounts?: any[];
  cards?: any[];
  refunds?: any[];
  disputes?: any[];
  loans?: any[];
  emi_history?: any[];
  fees?: any[];
  statements?: any[];
  beneficiaries?: any[];
  service_requests?: any[];
  tool_calls?: any[];
};

type AnalysisResult = {
  intent?: string;
  requires_customer_data?: boolean;
  investigation_type?: string;
  policy?: string;
  similarity?: number;
  recommended_action?: string;
  agent_explanation?: string;
  customer_response?: string;
  risk_level?: string;
  escalation_required?: boolean;
  status?: string;
  evidence?: Evidence;
};

export default function Home() {
  const [customerId, setCustomerId] = useState("CUST-1001");

  const [customerMessage, setCustomerMessage] = useState(
    "My Amazon UPI payment of ₹33,003.69 on 18 May failed and the money was debited. Please check."
  );

  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function analyzeCase() {
    setLoading(true);
    setError("");
    setResult(null);

    try {
      const response = await fetch("http://127.0.0.1:8000/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          customer_id: customerId,
          message: customerMessage,
        }),
      });

      if (!response.ok) {
        throw new Error(`API request failed: ${response.status}`);
      }

      const data = await response.json();

      setResult(data);
    } catch (err) {
      console.error(err);

      setError(
        "Unable to connect to ResolveAI backend. Make sure FastAPI is running on http://127.0.0.1:8000."
      );
    } finally {
      setLoading(false);
    }
  }

  function clearCase() {
    setResult(null);
    setError("");
  }

  function formatValue(value: any) {
    if (value === null || value === undefined || value === "") {
      return "—";
    }

    if (typeof value === "boolean") {
      return value ? "Yes" : "No";
    }

    if (typeof value === "number") {
      return value.toLocaleString("en-IN");
    }

    return String(value);
  }

  function statusClass(status?: string) {
    const value = status?.toLowerCase() || "";

    if (
      value.includes("approved") ||
      value.includes("resolved") ||
      value.includes("success")
    ) {
      return "green";
    }

    if (
      value.includes("review") ||
      value.includes("pending") ||
      value.includes("processing")
    ) {
      return "amber";
    }

    if (
      value.includes("escalat") ||
      value.includes("failed") ||
      value.includes("high")
    ) {
      return "red";
    }

    return "blue";
  }

  function getPrimaryTransaction(): any | null {
    const transactions = result?.evidence?.transactions || [];

    if (!transactions.length) {
      return null;
    }

    const message = customerMessage.toLowerCase();

    const amountMatch = message.match(
      /(?:₹|rs\.?\s*)?([\d,]+(?:\.\d{1,2})?)/
    );

    const requestedAmount = amountMatch
      ? Number(amountMatch[1].replace(/,/g, ""))
      : null;

    const merchantWords = [
      "amazon",
      "flipkart",
      "swiggy",
      "zomato",
      "bigbasket",
      "myntra",
      "uber",
    ];

    const requestedMerchant = merchantWords.find((merchant) =>
      message.includes(merchant)
    );

    const matchingTransaction = transactions.find((transaction) => {
      const amountMatches =
        requestedAmount === null ||
        Number(transaction.amount) === requestedAmount;

      const merchantMatches =
        !requestedMerchant ||
        String(transaction.merchant || "")
          .toLowerCase()
          .includes(requestedMerchant);

      return amountMatches && merchantMatches;
    });

    return matchingTransaction || transactions[0];
  }

  function getVerifiedFacts(): string[] {
    const transaction = getPrimaryTransaction();

    if (!transaction) {
      return [
        "No specific transaction was returned by the banking evidence layer.",
      ];
    }

    const facts: string[] = [];

    if (transaction.transaction_id) {
      facts.push(`Transaction ${transaction.transaction_id} was identified.`);
    }

    if (transaction.amount !== undefined) {
      facts.push(
        `Amount: ${transaction.currency || "INR"} ${Number(
          transaction.amount
        ).toLocaleString("en-IN", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}.`
      );
    }

    if (transaction.merchant) {
      facts.push(`Merchant: ${transaction.merchant}.`);
    }

    if (transaction.status) {
      facts.push(`Transaction status: ${transaction.status}.`);
    }

    if (transaction.beneficiary_credited !== undefined) {
      facts.push(
        transaction.beneficiary_credited
          ? "The beneficiary is recorded as credited."
          : "The beneficiary is recorded as not credited."
      );
    }

    if (transaction.reference_number) {
      facts.push(`Reference: ${transaction.reference_number}.`);
    }

    if (transaction.date) {
      facts.push(`Transaction date: ${transaction.date}.`);
    }

    return facts;
  }

  function getGroundedCustomerResponse(): string {
    const transaction = getPrimaryTransaction();

    if (!transaction) {
      return (
        result?.customer_response ||
        "We are reviewing the details of your transaction. Please do not make another payment while the transaction is being verified."
      );
    }

    const merchant = transaction.merchant || "the merchant";

    const amount =
      transaction.amount !== undefined
        ? `₹${Number(transaction.amount).toLocaleString("en-IN", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}`
        : "the reported amount";

    const reference = transaction.reference_number
      ? ` Reference number: ${transaction.reference_number}.`
      : "";

    if (
      String(transaction.status).toUpperCase() === "FAILED" &&
      transaction.beneficiary_credited === false
    ) {
      return (
        `Dear Customer, our records show that your ${merchant} payment of ${amount} ` +
        `was marked as FAILED and the beneficiary was not credited.${reference} ` +
        `We are reviewing the transaction outcome. Please do not make another payment ` +
        `while this is being verified.`
      );
    }

    if (
      String(transaction.status).toUpperCase() === "REVERSED"
    ) {
      return (
        `Dear Customer, our records show that your ${merchant} payment of ${amount} ` +
        `was marked as REVERSED.${reference} ` +
        `Please contact support if the corresponding amount has not been restored.`
      );
    }

    if (
      String(transaction.status).toUpperCase() === "SUCCESS"
    ) {
      return (
        `Dear Customer, our records show that your ${merchant} payment of ${amount} ` +
        `was marked as SUCCESS.${reference} ` +
        `If the recipient has not received the funds, we can investigate the recipient-side outcome.`
      );
    }

    return (
      result?.customer_response ||
      "We are reviewing the transaction details. Please do not make another payment while the transaction is being verified."
    );
  }

  function getGroundedRecommendation(): string {
    const transaction = getPrimaryTransaction();

    if (!transaction) {
      return (
        result?.recommended_action ||
        "Verify the relevant transaction and investigate the customer-specific outcome."
      );
    }

    if (
      String(transaction.status).toUpperCase() === "FAILED" &&
      transaction.beneficiary_credited === false
    ) {
      return (
        "Verify the failed transaction, acknowledge the recorded transaction outcome, " +
        "and investigate the recipient-side outcome. Do not claim that a reversal or refund " +
        "is already in progress unless the banking evidence explicitly confirms it."
      );
    }

    return (
      result?.recommended_action ||
      "Review the verified transaction evidence and follow the applicable approved policy."
    );
  }

  function getGroundedExplanation(): string {
    const transaction = getPrimaryTransaction();

    if (
      transaction &&
      String(transaction.status).toUpperCase() === "FAILED" &&
      transaction.beneficiary_credited === false
    ) {
      return (
        `The banking evidence identifies transaction ${transaction.transaction_id || ""} ` +
        `as ${transaction.status}. The beneficiary is recorded as not credited. ` +
        `These facts support further investigation, but they do not establish that a ` +
        `reversal or refund is currently being processed. ResolveAI therefore keeps the ` +
        `case in agent review and separates verified transaction facts from policy guidance.`
      );
    }

    return (
      result?.agent_explanation ||
      "The recommendation is based on the available customer evidence and retrieved policy."
    );
  }

  function renderObject(obj: any) {
    if (!obj || typeof obj !== "object") {
      return formatValue(obj);
    }

    return Object.entries(obj).map(([key, value]) => (
      <div className="evidence-row" key={key}>
        <span className="evidence-key">
          {key.replaceAll("_", " ")}
        </span>

        <span className="evidence-value">
          {formatValue(value)}
        </span>
      </div>
    ));
  }

  return (
    <main className="app-shell">
      <style jsx global>{`
        * {
          box-sizing: border-box;
        }

        html,
        body {
          margin: 0;
          padding: 0;
          background: #f4f6f8;
          color: #17212b;
          font-family:
            Inter,
            ui-sans-serif,
            system-ui,
            -apple-system,
            BlinkMacSystemFont,
            "Segoe UI",
            sans-serif;
        }

        button,
        input,
        textarea {
          font: inherit;
        }

        button {
          cursor: pointer;
        }

        .app-shell {
          min-height: 100vh;
          background: #f4f6f8;
        }

        .topbar {
          height: 68px;
          background: #ffffff;
          border-bottom: 1px solid #dfe4e8;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 30px;
          position: sticky;
          top: 0;
          z-index: 20;
        }

        .brand {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .brand-mark {
          width: 34px;
          height: 34px;
          border-radius: 9px;
          background: #123b63;
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 15px;
          font-weight: 800;
        }

        .brand-name {
          font-size: 18px;
          font-weight: 750;
          color: #13283d;
        }

        .brand-subtitle {
          font-size: 12px;
          color: #7a8793;
        }

        .topbar-right {
          display: flex;
          align-items: center;
          gap: 16px;
        }

        .system-status {
          display: flex;
          align-items: center;
          gap: 7px;
          color: #566574;
          font-size: 12px;
        }

        .status-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #2e9b61;
        }

        .agent-pill {
          border: 1px solid #dce2e7;
          background: #fafbfc;
          border-radius: 20px;
          padding: 7px 12px;
          font-size: 12px;
          color: #475767;
        }

        .page {
          max-width: 1500px;
          margin: 0 auto;
          padding: 26px 30px 50px;
        }

        .page-heading {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          margin-bottom: 22px;
        }

        .heading-left h1 {
          margin: 0;
          font-size: 26px;
          line-height: 1.15;
          color: #14283c;
          letter-spacing: -0.7px;
        }

        .heading-left p {
          margin: 7px 0 0;
          color: #73808d;
          font-size: 13px;
        }

        .case-label {
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.9px;
          color: #87939d;
          font-weight: 700;
        }

        .workspace {
          display: grid;
          grid-template-columns: 390px minmax(0, 1fr);
          gap: 20px;
          align-items: start;
        }

        .panel,
        .content-card,
        .evidence-card,
        .grounding-card {
          background: white;
          border: 1px solid #dfe4e8;
          border-radius: 10px;
          box-shadow: 0 1px 2px rgba(15, 23, 42, 0.03);
        }

        .panel-header,
        .content-card-header,
        .grounding-header {
          padding: 14px 17px;
          border-bottom: 1px solid #e8ecef;
        }

        .panel-title,
        .grounding-title {
          font-size: 14px;
          font-weight: 750;
          color: #203449;
        }

        .panel-subtitle,
        .grounding-subtitle {
          font-size: 11px;
          color: #87939e;
          margin-top: 3px;
        }

        .panel-body {
          padding: 18px;
        }

        .field {
          margin-bottom: 17px;
        }

        .field-label {
          display: block;
          margin-bottom: 7px;
          color: #536372;
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.65px;
        }

        .input,
        .textarea {
          width: 100%;
          border: 1px solid #d7dee4;
          border-radius: 7px;
          background: #fff;
          color: #1d2b39;
          outline: none;
        }

        .input {
          height: 40px;
          padding: 0 12px;
          font-size: 13px;
        }

        .textarea {
          min-height: 150px;
          resize: vertical;
          padding: 11px 12px;
          line-height: 1.55;
          font-size: 13px;
        }

        .input:focus,
        .textarea:focus {
          border-color: #467aa7;
          box-shadow: 0 0 0 3px rgba(70, 122, 167, 0.1);
        }

        .button-row {
          display: flex;
          gap: 9px;
          margin-top: 19px;
        }

        .primary-button {
          flex: 1;
          height: 42px;
          border: 0;
          border-radius: 7px;
          background: #123b63;
          color: white;
          font-size: 13px;
          font-weight: 700;
        }

        .primary-button:disabled {
          opacity: 0.65;
          cursor: not-allowed;
        }

        .secondary-button {
          height: 42px;
          padding: 0 15px;
          border: 1px solid #d7dee4;
          border-radius: 7px;
          background: white;
          color: #526273;
          font-size: 12px;
          font-weight: 650;
        }

        .helper {
          margin-top: 10px;
          color: #8a959e;
          font-size: 11px;
          line-height: 1.45;
        }

        .error-box {
          margin-top: 15px;
          padding: 11px 12px;
          border: 1px solid #f0c6c6;
          background: #fff6f6;
          color: #a33131;
          border-radius: 7px;
          font-size: 12px;
        }

        .right-column {
          min-width: 0;
        }

        .empty-state,
        .loading-state {
          min-height: 550px;
          display: flex;
          align-items: center;
          justify-content: center;
          text-align: center;
          padding: 50px;
        }

        .empty-icon {
          width: 52px;
          height: 52px;
          margin: 0 auto 16px;
          border-radius: 12px;
          background: #edf3f8;
          color: #315f86;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 23px;
          font-weight: 700;
        }

        .empty-state h2 {
          margin: 0;
          font-size: 17px;
          color: #25394c;
        }

        .empty-state p {
          max-width: 450px;
          margin: 8px auto 0;
          color: #84909a;
          font-size: 12px;
          line-height: 1.6;
        }

        .result-stack {
          display: flex;
          flex-direction: column;
          gap: 15px;
        }

        .result-overview {
          padding: 17px 18px;
        }

        .overview-top {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 20px;
        }

        .result-heading h2 {
          margin: 0;
          color: #182d42;
          font-size: 17px;
        }

        .result-heading p {
          margin: 5px 0 0;
          color: #7b8792;
          font-size: 12px;
        }

        .badges {
          display: flex;
          flex-wrap: wrap;
          justify-content: flex-end;
          gap: 7px;
        }

        .badge {
          display: inline-flex;
          align-items: center;
          border-radius: 5px;
          padding: 6px 9px;
          font-size: 10px;
          font-weight: 750;
          text-transform: uppercase;
          letter-spacing: 0.45px;
        }

        .badge.blue {
          background: #edf4fa;
          color: #2c5f88;
        }

        .badge.green {
          background: #edf8f1;
          color: #27764b;
        }

        .badge.amber {
          background: #fff7e9;
          color: #9a6a15;
        }

        .badge.red {
          background: #fff0f0;
          color: #a33737;
        }

        .metrics {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          border-top: 1px solid #edf0f2;
          margin-top: 18px;
          padding-top: 16px;
        }

        .metric {
          padding: 0 15px;
          border-right: 1px solid #edf0f2;
        }

        .metric:first-child {
          padding-left: 0;
        }

        .metric:last-child {
          border-right: 0;
        }

        .metric-label {
          font-size: 10px;
          color: #8a959e;
          text-transform: uppercase;
          letter-spacing: 0.55px;
          font-weight: 700;
          margin-bottom: 5px;
        }

        .metric-value {
          font-size: 13px;
          font-weight: 700;
          color: #263b50;
          word-break: break-word;
        }

        .two-column {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 15px;
        }

        .content-card {
          overflow: hidden;
        }

        .content-card-header {
          font-size: 12px;
          font-weight: 750;
          color: #31465a;
          background: #fcfdfd;
        }

        .content-card-body {
          padding: 15px 16px;
        }

        .content-text {
          color: #4b5c6b;
          font-size: 12px;
          line-height: 1.65;
          white-space: pre-wrap;
        }

        .action-box {
          border-left: 3px solid #315f86;
          background: #f5f8fa;
          padding: 12px 13px;
          border-radius: 4px;
          color: #344a5f;
          font-size: 12px;
          line-height: 1.6;
        }

        .policy-box {
          background: #fafbfc;
          border: 1px solid #e7ebee;
          padding: 12px 13px;
          border-radius: 6px;
          color: #566674;
          font-size: 11px;
          line-height: 1.6;
          white-space: pre-wrap;
        }

        .grounding-card {
          overflow: hidden;
        }

        .grounding-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 0;
        }

        .grounding-block {
          padding: 16px;
          border-right: 1px solid #edf0f2;
        }

        .grounding-block:last-child {
          border-right: 0;
        }

        .grounding-label {
          font-size: 10px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.7px;
          margin-bottom: 9px;
        }

        .grounding-label.verified {
          color: #27764b;
        }

        .grounding-label.policy {
          color: #315f86;
        }

        .grounding-facts {
          margin: 0;
          padding-left: 17px;
          color: #4b5c6b;
          font-size: 11px;
          line-height: 1.7;
        }

        .recommendation-box {
          margin: 0 16px 16px;
          padding: 12px 13px;
          border: 1px solid #e0e6ea;
          background: #fafbfc;
          border-radius: 6px;
        }

        .recommendation-label {
          color: #8a959e;
          font-size: 10px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.65px;
          margin-bottom: 7px;
        }

        .recommendation-text {
          color: #3b5063;
          font-size: 12px;
          line-height: 1.6;
        }

        .evidence-card {
          overflow: hidden;
        }

        .evidence-section {
          border-bottom: 1px solid #edf0f2;
        }

        .evidence-section:last-child {
          border-bottom: 0;
        }

        .evidence-section-title {
          padding: 12px 16px;
          background: #fafbfc;
          color: #405365;
          font-size: 11px;
          font-weight: 750;
          text-transform: uppercase;
          letter-spacing: 0.55px;
        }

        .evidence-items {
          padding: 0 16px;
        }

        .evidence-item {
          padding: 13px 0;
          border-bottom: 1px solid #f0f2f4;
        }

        .evidence-item:last-child {
          border-bottom: 0;
        }

        .evidence-row {
          display: flex;
          justify-content: space-between;
          gap: 20px;
          padding: 4px 0;
          font-size: 11px;
        }

        .evidence-key {
          color: #89949d;
          text-transform: capitalize;
        }

        .evidence-value {
          color: #3a4d5f;
          text-align: right;
          font-weight: 600;
          word-break: break-word;
        }

        .no-evidence {
          padding: 16px;
          color: #8a959e;
          font-size: 11px;
        }

        .loading-state {
          color: #71808d;
        }

        .spinner {
          width: 30px;
          height: 30px;
          border: 3px solid #e1e7eb;
          border-top-color: #315f86;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
          margin-bottom: 15px;
        }

        .loading-title {
          color: #3b5063;
          font-size: 13px;
          font-weight: 700;
        }

        .loading-text {
          margin-top: 5px;
          font-size: 11px;
          color: #8a969f;
        }

        .footer-note {
          color: #9aa3ab;
          font-size: 10px;
          line-height: 1.5;
          text-align: right;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        @media (max-width: 1050px) {
          .workspace {
            grid-template-columns: 1fr;
          }

          .two-column,
          .grounding-grid {
            grid-template-columns: 1fr;
          }

          .grounding-block {
            border-right: 0;
            border-bottom: 1px solid #edf0f2;
          }

          .grounding-block:last-child {
            border-bottom: 0;
          }
        }

        @media (max-width: 700px) {
          .topbar {
            padding: 0 15px;
          }

          .page {
            padding: 18px 15px 35px;
          }

          .brand-subtitle,
          .system-status {
            display: none;
          }

          .page-heading {
            display: block;
          }

          .case-label {
            display: block;
            margin-top: 10px;
          }

          .metrics {
            grid-template-columns: 1fr 1fr;
            row-gap: 15px;
          }

          .overview-top {
            display: block;
          }

          .badges {
            justify-content: flex-start;
            margin-top: 12px;
          }
        }
      `}</style>

      <header className="topbar">
        <div className="brand">
          <div className="brand-mark">R</div>

          <div>
            <div className="brand-name">ResolveAI</div>

            <div className="brand-subtitle">
              Customer Service Resolution Copilot
            </div>
          </div>
        </div>

        <div className="topbar-right">
          <div className="system-status">
            <span className="status-dot" />
            AI services operational
          </div>

          <div className="agent-pill">
            Agent Console
          </div>
        </div>
      </header>

      <div className="page">
        <div className="page-heading">
          <div className="heading-left">
            <h1>Case Resolution Workspace</h1>

            <p>
              Investigate customer cases using grounded policy and banking
              evidence.
            </p>
          </div>

          <div className="case-label">
            Human-in-the-loop · BFSI Support
          </div>
        </div>

        <div className="workspace">
          <section className="panel">
            <div className="panel-header">
              <div>
                <div className="panel-title">
                  Customer Case
                </div>

                <div className="panel-subtitle">
                  Provide the customer context for investigation
                </div>
              </div>
            </div>

            <div className="panel-body">
              <div className="field">
                <label className="field-label">
                  Customer ID
                </label>

                <input
                  className="input"
                  value={customerId}
                  onChange={(e) =>
                    setCustomerId(e.target.value)
                  }
                  placeholder="e.g. CUST-1001"
                />
              </div>

              <div className="field">
                <label className="field-label">
                  Customer Message
                </label>

                <textarea
                  className="textarea"
                  value={customerMessage}
                  onChange={(e) =>
                    setCustomerMessage(e.target.value)
                  }
                  placeholder="Enter the customer's issue..."
                />
              </div>

              <div className="button-row">
                <button
                  className="primary-button"
                  onClick={analyzeCase}
                  disabled={
                    loading ||
                    !customerId ||
                    !customerMessage
                  }
                >
                  {loading
                    ? "Investigating..."
                    : "Analyze Case"}
                </button>

                {result && (
                  <button
                    className="secondary-button"
                    onClick={clearCase}
                  >
                    Clear
                  </button>
                )}
              </div>

              <div className="helper">
                ResolveAI will classify the case, retrieve relevant
                policy, investigate approved banking data, and generate
                a grounded resolution recommendation.
              </div>

              {error && (
                <div className="error-box">
                  {error}
                </div>
              )}
            </div>
          </section>

          <section className="right-column">
            {!result && !loading && (
              <div className="panel empty-state">
                <div>
                  <div className="empty-icon">
                    R
                  </div>

                  <h2>
                    Ready for investigation
                  </h2>

                  <p>
                    Enter a customer case on the left and select
                    <strong> Analyze Case</strong>. The resolution
                    workflow will appear here.
                  </p>
                </div>
              </div>
            )}

            {loading && (
              <div className="panel loading-state">
                <div>
                  <div className="spinner" />

                  <div className="loading-title">
                    Investigating customer case
                  </div>

                  <div className="loading-text">
                    Routing intent · retrieving policy · checking
                    banking evidence · generating recommendation
                  </div>
                </div>
              </div>
            )}

            {result && !loading && (
              <div className="result-stack">
                <section className="panel result-overview">
                  <div className="overview-top">
                    <div className="result-heading">
                      <h2>
                        Investigation Result
                      </h2>

                      <p>
                        Customer{" "}
                        <strong>
                          {customerId}
                        </strong>{" "}
                        · AI-assisted resolution analysis
                      </p>
                    </div>

                    <div className="badges">
                      {result.status && (
                        <span
                          className={`badge ${statusClass(
                            result.status
                          )}`}
                        >
                          {result.status}
                        </span>
                      )}

                      {result.risk_level && (
                        <span
                          className={`badge ${statusClass(
                            result.risk_level
                          )}`}
                        >
                          Risk: {result.risk_level}
                        </span>
                      )}

                      {result.escalation_required !==
                        undefined && (
                        <span
                          className={`badge ${
                            result.escalation_required
                              ? "red"
                              : "green"
                          }`}
                        >
                          {result.escalation_required
                            ? "Escalation Required"
                            : "No Escalation"}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="metrics">
                    <div className="metric">
                      <div className="metric-label">
                        Intent
                      </div>

                      <div className="metric-value">
                        {formatValue(
                          result.intent
                        )}
                      </div>
                    </div>

                    <div className="metric">
                      <div className="metric-label">
                        Investigation
                      </div>

                      <div className="metric-value">
                        {formatValue(
                          result.investigation_type
                        )}
                      </div>
                    </div>

                    <div className="metric">
                      <div className="metric-label">
                        Policy Match
                      </div>

                      <div className="metric-value">
                        {result.similarity !==
                        undefined
                          ? `${(
                              result.similarity *
                              100
                            ).toFixed(1)}%`
                          : "—"}
                      </div>
                    </div>

                    <div className="metric">
                      <div className="metric-label">
                        Customer Data
                      </div>

                      <div className="metric-value">
                        {result.requires_customer_data
                          ? "Required"
                          : "Not required"}
                      </div>
                    </div>
                  </div>
                </section>

                <section className="grounding-card">
                  <div className="grounding-header">
                    <div className="grounding-title">
                      Grounding & Decision Basis
                    </div>

                    <div className="grounding-subtitle">
                      ResolveAI separates verified customer facts from
                      policy guidance and AI recommendations.
                    </div>
                  </div>

                  <div className="grounding-grid">
                    <div className="grounding-block">
                      <div className="grounding-label verified">
                        Verified Facts
                      </div>

                      <ul className="grounding-facts">
                        {getVerifiedFacts().map(
                          (fact, index) => (
                            <li key={index}>
                              {fact}
                            </li>
                          )
                        )}
                      </ul>
                    </div>

                    <div className="grounding-block">
                      <div className="grounding-label policy">
                        Policy Guidance
                      </div>

                      <div className="content-text">
                        {result.policy
                          ? `Approved policy retrieved: ${result.policy}`
                          : "Approved policy was retrieved for this case."}
                      </div>
                    </div>
                  </div>

                  <div className="recommendation-box">
                    <div className="recommendation-label">
                      AI Recommendation
                    </div>

                    <div className="recommendation-text">
                      {getGroundedRecommendation()}
                    </div>
                  </div>
                </section>

                <div className="two-column">
                  <section className="content-card">
                    <div className="content-card-header">
                      Recommended Action
                    </div>

                    <div className="content-card-body">
                      <div className="action-box">
                        {getGroundedRecommendation()}
                      </div>
                    </div>
                  </section>

                  <section className="content-card">
                    <div className="content-card-header">
                      Agent Explanation
                    </div>

                    <div className="content-card-body">
                      <div className="content-text">
                        {getGroundedExplanation()}
                      </div>
                    </div>
                  </section>
                </div>

                <section className="content-card">
                  <div className="content-card-header">
                    Customer Response Draft
                  </div>

                  <div className="content-card-body">
                    <div className="content-text">
                      {getGroundedCustomerResponse()}
                    </div>
                  </div>
                </section>

                <section className="content-card">
                  <div className="content-card-header">
                    Retrieved Policy
                  </div>

                  <div className="content-card-body">
                    <div className="policy-box">
                      {formatValue(result.policy)}
                    </div>
                  </div>
                </section>

                <section className="evidence-card">
                  <div className="panel-header">
                    <div>
                      <div className="panel-title">
                        Investigation Evidence
                      </div>

                      <div className="panel-subtitle">
                        Structured evidence returned by the banking
                        tool layer
                      </div>
                    </div>
                  </div>

                  {result.evidence &&
                  Object.entries(result.evidence).some(
                    ([key, value]) =>
                      key !== "tool_calls" &&
                      Array.isArray(value) &&
                      value.length > 0
                  ) ? (
                    Object.entries(
                      result.evidence
                    ).map(
                      ([
                        sectionName,
                        sectionData,
                      ]) => {
                        if (
                          sectionName ===
                          "tool_calls"
                        ) {
                          return null;
                        }

                        if (
                          !Array.isArray(
                            sectionData
                          ) ||
                          sectionData.length === 0
                        ) {
                          return null;
                        }

                        return (
                          <div
                            className="evidence-section"
                            key={sectionName}
                          >
                            <div className="evidence-section-title">
                              {sectionName.replaceAll(
                                "_",
                                " "
                              )}
                            </div>

                            <div className="evidence-items">
                              {sectionData.map(
                                (
                                  item: any,
                                  index: number
                                ) => (
                                  <div
                                    className="evidence-item"
                                    key={`${sectionName}-${index}`}
                                  >
                                    {renderObject(
                                      item
                                    )}
                                  </div>
                                )
                              )}
                            </div>
                          </div>
                        );
                      }
                    )
                  ) : (
                    <div className="no-evidence">
                      No structured evidence was returned.
                    </div>
                  )}
                </section>

                <div className="footer-note">
                  ResolveAI is an agent-assist system. Final customer
                  actions remain subject to human review, authorization,
                  bank policy and operational controls.
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}