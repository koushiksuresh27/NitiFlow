# Extracted Features Overview

This directory contains `extracted-features.js`, which encapsulates 5 independent, reusable feature pipelines from the original codebase.

## 1. VOICE COMPLAINT PIPELINE
**Purpose:** Accepts an uploaded audio file, uses Sarvam AI to transcribe it, and uses a Groq LLM prompt to categorize the complaint (Category, Priority, Confidence).
- **Environment Variables:**
  - `SARVAM_API_KEY` (For speech-to-text API)
  - `GROQ_API_KEY_1` (For the Groq SDK)
- **External Packages:** `fs`, `groq-sdk` (Assuming `upload.single` is `multer`, `FormData`/`fetch`/`Blob` are native in Node 18+)
- **Database Schema:** None. The endpoints just return JSON.
- **Dependencies:** Requires a standard Express `app` object and a configured Groq client (`groqClients[0]`). Note: Extract your category enums in the `/ai/suggest` prompt if adapting to a new project.

## 2. DNA PIPELINE (Clustering & Chronic Detection)
**Purpose:** Hashes a complaint into an asset-fault "fingerprint" using Groq, groups identical fingerprints by day into "clusters", and flags them as "chronic issues" when a frequency threshold is met.
- **Environment Variables:**
  - `GROQ_API_KEY_1` (For fingerprint generation)
  - `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (Implied for Supabase admin client)
- **External Packages:** `@supabase/supabase-js`, `groq-sdk`
- **Database Schema (Postgres):**
  - **`complaint_fingerprints`**: `complaint_id` (uuid), `society_id` (uuid), `asset_type` (text), `fault_type` (text), `location` (text), `fingerprint` (text)
  - **`incident_clusters`**: `society_id` (uuid), `fingerprint` (text), `cluster_date` (date), `complaint_ids` (uuid array), `complaint_count` (int), `is_single_incident` (bool)
  - **`chronic_issues`**: `society_id` (uuid), `asset_type` (text), `fault_type` (text), `location` (text), `fingerprint` (text), `occurrence_count` (int), `first_reported` (timestamp), `last_reported` (timestamp), `status` (text), `severity` (text), `estimated_cost_saved` (numeric)
  - **`complaints`**: Assumes columns `is_chronic` (bool), `chronic_issue_id` (uuid), `incident_cluster_id` (uuid), `fingerprint` (text)
  - **`root_cause_tickets`**: `chronic_issue_id` (uuid), `society_id` (uuid), `title` (text), `description` (text), `status` (text), `amc_notified` (bool)
- **Dependencies:** Requires a `SEVERITY_CONFIG` object defining thresholds (e.g., `window_days`, `threshold`), and `supabaseAdmin` client. Triggered synchronously in the code, but best offloaded to a background queue.

## 3. DOCUMENT INTELLIGENCE OCR PIPELINE
**Purpose:** Uploads a document (PDF/Image) to Sarvam AI for Document Intelligence to extract markdown text, then uses Groq to structure the unstructured text into standardized JSON records (e.g. Vendors).
- **Environment Variables:**
  - `SARVAM_API_KEY`
  - `GROQ_API_KEY_1`
- **External Packages:** `sarvamai`, `adm-zip`, `fs`, `path`, `os`, `groq-sdk`
- **Database Schema:** None inherently required for the extraction itself. Returns JSON output directly to the API response.
- **Dependencies:** Requires Express app with `multer` (`upload.single('file')`), and `groqClients`.

## 4. ARIA CHAT (AI ASSISTANT)
**Purpose:** Proactive, data-aware chatbot backend. Injects real-time DB context into the system prompt and uses a strict persona to answer queries.
- **Environment Variables:**
  - `GROQ_API_KEY_1`
- **External Packages:** `groq-sdk`
- **Database Schema:** Depends entirely on the `getProactiveContext()` data-fetching layer (which reads complaints, SLA, and equipment tables).
- **Dependencies:** Needs your own function to fetch live context (`getProactiveContext`).

## 5. AUTO-ASSIGNMENT TRIGGER PATTERN
**Purpose:** PostgreSQL trigger to automatically assign new tasks/complaints to the best available technician based on skill matching (`specializations`) and workload (`count(*)` open tasks).
- **Environment Variables:** None (runs purely inside Postgres).
- **External Packages:** None.
- **Database Schema (Postgres):**
  - **`complaints`**: `assigned_tech_id` (uuid), `status` (text), `category` (text), `society_id` (uuid)
  - **`technicians`**: `id` (uuid), `user_id` (uuid), `society_id` (uuid), `is_available` (bool), `specializations` (text array), `performance_score` (numeric)
- **Dependencies:** Standard PostgreSQL database. Trigger binds `before insert` on the `complaints` table.
