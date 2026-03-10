# 📚 AI-Powered Knowledge Base

### Full-Stack SaaS Architecture with AI-Enhanced Document Retrieval

A production-oriented full-stack web application that enables users to\
**upload documents, process them into searchable chunks, and query them
using AI-powered retrieval.**

This project emphasizes clean architecture, secure multi-tenant design,
structured document ingestion, and scalable API-driven workflows, with
AI serving as an integrated feature --- not the sole focus.

------------------------------------------------------------------------

## 🎯 Project Purpose

Modern SaaS products increasingly require structured document handling
combined with intelligent querying.

This application demonstrates how to design a system that:

-   Accepts user-scoped document uploads
-   Processes documents into structured, searchable chunks
-   Stores embeddings for semantic retrieval
-   Executes secure, user-isolated similarity queries
-   Generates AI-assisted responses grounded strictly in retrieved data

The system reflects real-world SaaS architecture patterns, including
separation of concerns, authentication boundaries, and production-minded
backend design.

------------------------------------------------------------------------

## 🚀 Core Features

### Document Management

-   Secure file upload via Supabase Storage
-   Text-note ingestion (no file required)
-   Status lifecycle (PENDING, PROCESSING, PROCESSED)
-   Document detail view with chunk inspection
-   User-scoped document isolation

### Processing Pipeline

-   Server-side PDF extraction (pdfjs)
-   Token-aware chunk segmentation
-   Embedding generation per chunk
-   Structured chunk persistence
-   Deterministic vector search via Postgres RPC

### Retrieval & AI Integration

-   Semantic similarity search across documents
-   Optional single-document scoping
-   Similarity threshold filtering
-   Context assembly from top matches
-   AI-generated answers constrained to retrieved sources
-   Transparent source citation format

---------------------------------------------------------------------

---

## 🌐 Live Demo

- **Live App:** https://ai-powered-knowledge-base-eight.vercel.app
- **Backend:** Next.js API routes (serverless functions on Vercel)
- **Database & Auth:** Supabase (Postgres + RLS + Storage)
- **LLM Inference:** Hugging Face API

> ⚠️ Note: This is a portfolio deployment. Cold starts may occur depending on hosting tier.

---

## 🖼️ Screenshots (Recommended Order)

Add screenshots to a folder like `views/` (or `public/screenshots/`) and update paths below.

### 1️⃣ Ask Interface (Answer + Sources)

![Ask Interface](views/Screenshot%202026-03-10%20043626.png)

### 2️⃣ Documents List (Statuses + Actions)

![Documents List](views/Screenshot%202026-03-10%20043656.png)

### 3️⃣ Document Detail (Chunks)

![Document Detail](views/Screenshot%202026-03-10%20043740.png)

### 4️⃣ Upload Document

![Upload Document](views/Screenshot%202026-03-10%20043803.png)

### 5️⃣ Auth / New Note (Optional)

![Auth](views/Screenshot%202026-03-10%20043811.png)
![New Note](views/Screenshot%202026-03-10%20043811.png)

---

## 🏗️ Architecture Overview

The application follows a layered client--server architecture:

### Client Layer (Next.js App Router)

-   Server + Client Components
-   Structured loading & empty states
-   Focus-visible accessibility patterns
-   Clear separation between UI and data logic

### API Layer (Next.js API Routes)

Handles document creation, ingestion, embedding generation, vector
similarity search, and retrieval-augmented answer generation.

### Data Layer (Supabase)

-   PostgreSQL for document metadata & chunks
-   Vector similarity via RPC function
-   Supabase Storage for raw file handling
-   Row-level user isolation

This mirrors real SaaS systems where AI is layered on top of structured
backend services.

------------------------------------------------------------------------

## 🗄️ Database Design Highlights

-   documents table (metadata + lifecycle state)
-   document_chunks table (text + embeddings)
-   Indexed retrieval queries
-   Overload-free RPC signature for deterministic vector search
-   User-scoped filtering enforced at query level

------------------------------------------------------------------------

## 🔒 Security & Production Considerations

-   Supabase Auth integration
-   Server-side validation for ingestion routes
-   User-isolated data access
-   Environment variables excluded from version control
-   Secure credential handling (no secrets exposed client-side)

------------------------------------------------------------------------

## 🛠️ Tech Stack

### Frontend

-   Next.js (App Router)
-   React
-   Tailwind CSS
-   Component-based UI system

### Backend

-   Next.js API Routes
-   Supabase (PostgreSQL + Storage + Auth)
-   Vector similarity search via Postgres RPC
-   HuggingFace Inference API (embeddings + LLM)

------------------------------------------------------------------------

## ▶️ Running Locally

### Install dependencies

``` bash
npm install
```

### Configure environment variables

Create `.env.local`:

``` env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
HF_API_KEY=
```

### Start development server

``` bash
npm run dev
```

Application runs on:

    http://localhost:3000

------------------------------------------------------------------------

## 🌱 Future Improvements

-   Background job queue for document processing
-   Embedding batching for performance
-   Streaming AI responses
-   Chunk pagination for large datasets
-   Usage analytics dashboard

------------------------------------------------------------------------

## 👤 Author Note

Built with a production mindset, focusing on scalable SaaS architecture
and structured backend design, with AI integrated as a feature layer
rather than a standalone gimmick.

This project demonstrates practical full-stack engineering applied to
document-driven workflows.
