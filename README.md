# NitiFlow: Constituency Intelligence Platform

NitiFlow is an AI-powered constituency intelligence platform designed for Members of Parliament (MPs) and local government officials in India. It bridges the gap between citizens reporting on-the-ground issues and administrators allocating development budgets. By providing an accessible citizen portal that supports both voice and text inputs in multiple Indian languages, NitiFlow ensures every grievance is captured, regardless of a citizen's literacy or technical proficiency.

Under the hood, NitiFlow uses a custom "DNA Pipeline" to process, categorize, and cluster incoming complaints. It identifies chronic, recurring issues automatically and merges them with structured data extracted from local area development plans. The result is a unified, real-time MP Dashboard that dynamically ranks priorities based on mention volume, urgency, and demographic need-gaps (e.g., ward population, hospital distance)—allowing representatives to make data-driven decisions on where to deploy funds effectively.

## Built with Google Cloud AI

NitiFlow leverages several Google Cloud AI and API services to function seamlessly:
- **Google Gemini 2.0 Flash**: Acts as the core reasoning engine. It structures raw text, categorizes grievances, assigns urgency, extracts information from OCR documents, and powers the "Aria" Constituency AI assistant.
- **Google Cloud Speech-to-Text v2**: Enables the citizen voice portal. It transcribes multi-lingual audio recordings (Hindi, Kannada, Telugu, Tamil, English) into text for Gemini to process.
- **Google Cloud Document AI**: Powers the development plan import feature. It extracts text and layout information from uploaded government PDFs, which Gemini then parses into actionable project estimates.
- **Google Maps Platform (@react-google-maps/api)**: Visualizes the constituency at the ward level. It dynamically colors ward boundaries based on real-time priority scores to give MPs an immediate geospatial understanding of their district.

## Setup Instructions

### 1. Prerequisites
- Node.js (v18+)
- Supabase Account
- Google Cloud Project with the following APIs enabled: Speech-to-Text, Document AI, Maps JavaScript API.
- Gemini API Key

### 2. Clone and Install
```bash
git clone https://github.com/koushiksuresh27/NitiFlow.git
cd NitiFlow

# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install
```

### 3. Database Setup (Supabase)
1. Create a new Supabase project.
2. Run the SQL script located in `backend/db/schema.sql` in the Supabase SQL Editor.
3. Run the seed script located in `demo-assets/seed-complaints.sql` to populate initial demo data.
4. Ensure Supabase Realtime is enabled for the `complaint_clusters` table via the Supabase Dashboard (Database -> Publications).

### 4. Environment Variables
Create a `.env` file in the `backend/` directory:
```env
PORT=4000
SUPABASE_URL=your_supabase_project_url
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
GEMINI_API_KEY=your_gemini_api_key
GOOGLE_APPLICATION_CREDENTIALS=/path/to/your/gcp-service-account.json
DOCUMENT_AI_PROCESSOR_ID=your_doc_ai_processor_id
GOOGLE_CLOUD_PROJECT_ID=your_gcp_project_id
NEXT_PUBLIC_FRONTEND_URL=http://localhost:3000
```

Create a `.env.local` file in the `frontend/` directory:
```env
NEXT_PUBLIC_API_URL=http://localhost:4000
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_google_maps_api_key
```

### 5. Run Locally
Start the backend:
```bash
cd backend
npm run dev
```

Start the frontend:
```bash
cd frontend
npm run dev
```

### 6. Deployment
- **Backend (Render)**: Connect your repository to Render and use the provided `backend/render.yaml` configuration.
- **Frontend (Vercel)**: Connect your repository to Vercel. The `frontend/vercel.json` ensures it builds as a Next.js application. Add the frontend environment variables in the Vercel dashboard.

## Demo Path (For Judges)

1. **The MP Dashboard (`/dashboard`)**: Start here. Show the map rendering wards in different colors based on priority scores. Explain the feed on the right and the top stat pills.
2. **Citizen Submission (`/citizen`)**: Open this route. Select a ward and use the **Voice** feature to record a grievance (e.g., "There is a massive pothole causing accidents"). Submit it.
3. **Real-time Sync**: Switch immediately back to the MP Dashboard. Point out that the feed has automatically reshuffled and the map color might have changed without a page refresh, thanks to Supabase Realtime.
4. **Score Breakdown**: Click on a priority card in the feed. Show the slide-in ScorePanel. Explain how the total score is an aggregate of Mention Volume, Urgency, and Demographic Need Gap.
5. **Aria Chat**: Click "Ask Aria" on the bottom right. Ask a question like "Which issues are chronic?" to demonstrate Gemini's context-aware reasoning on live constituency data.
6. **Dev Plan Import**: Click "Import Dev Plan". Upload the `demo-assets/sample-dev-plan.txt` (or a PDF version of it). Show Document AI and Gemini extracting the structured projects and inserting them directly into the priority feed alongside citizen complaints.
