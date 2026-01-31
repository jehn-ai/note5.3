
import React from 'react';
import { BibleVerse } from './types';

export const BIBLE_VERSES: BibleVerse[] = [
  { text: "Commit your work to the Lord, and your plans will be established.", reference: "Proverbs 16:3" },
  { text: "Whatever you do, work heartily, as for the Lord and not for men.", reference: "Colossians 3:23" },
  { text: "If any of you lacks wisdom, let him ask God, who gives generously to all.", reference: "James 1:5" },
  { text: "Trust in the Lord with all your heart, and do not lean on your own understanding.", reference: "Proverbs 3:5" },
  { text: "The heart of the discerning acquires knowledge, for the ears of the wise seek it out.", reference: "Proverbs 18:15" }
];

export const SYSTEM_ARCHITECTURE_DESCRIPTION = `
### Production Tech Stack
- **Frontend**: React 18 / TypeScript / Tailwind CSS / Framer Motion
- **Backend / Auth**: Supabase (PostgreSQL, Auth, Storage, Edge Functions)
- **AI Models**: 
  - Gemini 3 Pro Preview (Mathematical Reasoning & High-fidelity analysis)
  - Gemini 3 Flash Preview (OCR, Fast Summarization, Quiz Generation)
- **Infrastructure**: Vercel (Frontend), Supabase (Global Edge Deployment)
- **Queueing**: Supabase Edge Functions + pg_net or Redis/Upstash for job management

### Scaling Strategy
- **Concurrency**: 3,000 concurrent users handled via horizontally scaled Edge Functions.
- **Failover**: Multi-model fallback (Pro -> Flash -> Flash Lite).
- **Security**: RLS (Row Level Security) enforced at DB level. AES-256 for file encryption at rest.
`;
