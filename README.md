# ResolveAI — AI Customer Service Resolution Copilot

ResolveAI is an AI-powered customer service resolution copilot for banking and financial services (BFSI). It helps customer service agents investigate complaints, retrieve relevant policies, review supporting evidence, and prepare resolution recommendations.

The goal is to make customer complaint investigations more structured, evidence-based, and efficient while keeping a human agent in control of the final decision.

## The Problem

Banking customer service agents may need to consult multiple policies, review transaction records, check related banking information, and prepare customer responses before resolving a complaint.

ResolveAI explores how generative AI, retrieval-augmented generation (RAG), and tool calling can bring these investigation steps into one workflow.

## How It Works

1. **Understand the complaint** — Classify the customer's message and identify the investigation type.
2. **Retrieve relevant policies** — Use semantic similarity to find relevant policy documentation.
3. **Investigate supporting data** — Call approved tools to retrieve relevant information from synthetic banking datasets.
4. **Organize the evidence** — Normalize tool results into structured evidence for review.
5. **Generate a recommendation** — Produce a recommended action, agent explanation, customer response draft, risk level, and escalation indicator.
6. **Support human review** — Present the investigation output to an agent for review.

## Key Features

- AI-assisted complaint classification and routing
- Policy retrieval using embeddings and semantic similarity
- Gemini function calling for banking-data investigation
- Tool access controlled by investigation-specific policies
- Structured evidence collection and normalization
- Structured resolution output using a defined schema
- Agent-facing interface for reviewing recommendations and customer response drafts

## Technology Stack

| Component | Technology |
|---|---|
| Frontend | Next.js, React, TypeScript |
| Backend | Python, FastAPI |
| Generative AI | Google Gemini |
| Embeddings | `gemini-embedding-001` |
| Retrieval | Semantic similarity and policy embeddings |
| Tool integration | Gemini function calling and Python tool registry |
| Data | Synthetic banking records and fictional policy documents |

## Architecture

```text
Customer Complaint
       |
       v
Next.js Agent Interface
       |
       v
FastAPI Backend
       |
       v
Complaint Routing
       |
       v
Policy Retrieval (RAG)
       |
       v
Approved Investigation Tools
       |
       v
Structured Evidence
       |
       v
AI Resolution Recommendation
       |
       v
Agent Review
```

## Repository Structure

This repository contains the ResolveAI frontend.

```text
resolveai-frontend/
├── public/
├── src/
│   └── app/
│       ├── globals.css
│       ├── layout.tsx
│       └── page.tsx
├── .gitignore
├── package.json
├── package-lock.json
├── next.config.ts
└── README.md
```

The Python backend is maintained separately.

## Run the Frontend Locally

### Prerequisites

- Node.js and npm
- The ResolveAI FastAPI backend running locally

### Setup

Clone the repository:

```bash
git clone https://github.com/apurwas/resolveai-frontend.git
cd resolveai-frontend
```

Install dependencies:

```bash
npm install
```

Start the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

The frontend currently expects the backend at `http://127.0.0.1:8000`. The backend must be running for end-to-end complaint investigation.

## Safety and Data

ResolveAI is a portfolio prototype using synthetic banking data and fictional policy documents. It is not a production banking system and should not be used to make real customer decisions.

The Gemini API key belongs in the backend environment configuration and must never be committed to the repository or exposed in frontend code.

## Current Status

The initial frontend MVP is implemented and integrated with the local FastAPI backend. Public deployment, investigation reliability improvements, and evidence UI enhancements are planned next.

## Project Focus

This project explores practical AI product engineering: combining LLM orchestration, retrieval, tool calling, structured outputs, evidence presentation, and human-in-the-loop review into a domain-specific application.
