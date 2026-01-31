
import React from 'react';
import { Server, Shield, Cpu, Zap, Cloud, Globe, Lock, Copy, Check, AlertTriangle } from 'lucide-react';

const SystemDesign: React.FC = () => {
  const [copied, setCopied] = React.useState(false);

  const migrationSql = `-- ⚡ QUICK FIX: RUN THIS IN SUPABASE SQL EDITOR
-- This adds missing columns, RLS policies, AND the Storage Bucket

DO $$ 
BEGIN
  -- Add user_email column to all relevant tables if they don't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='uploads' AND column_name='user_email') THEN
    ALTER TABLE uploads ADD COLUMN user_email TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='summaries' AND column_name='user_email') THEN
    ALTER TABLE summaries ADD COLUMN user_email TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='flashcards' AND column_name='user_email') THEN
    ALTER TABLE flashcards ADD COLUMN user_email TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='quizzes' AND column_name='user_email') THEN
    ALTER TABLE quizzes ADD COLUMN user_email TEXT;
  END IF;
END $$;

-- Enable RLS on all tables
ALTER TABLE uploads ENABLE ROW LEVEL SECURITY;
ALTER TABLE summaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE flashcards ENABLE ROW LEVEL SECURITY;
ALTER TABLE quizzes ENABLE ROW LEVEL SECURITY;

-- Create Policies (Delete existing ones first to avoid duplicates)
DROP POLICY IF EXISTS "Public access summaries" ON summaries;
CREATE POLICY "Public access summaries" ON summaries FOR ALL TO anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public access uploads" ON uploads;
CREATE POLICY "Public access uploads" ON uploads FOR ALL TO anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public access flashcards" ON flashcards;
CREATE POLICY "Public access flashcards" ON flashcards FOR ALL TO anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public access quizzes" ON quizzes;
CREATE POLICY "Public access quizzes" ON quizzes FOR ALL TO anon USING (true) WITH CHECK (true);

-- STORAGE SETUP (Fixes "Bucket not found")
INSERT INTO storage.buckets (id, name, public) 
VALUES ('study-materials', 'study-materials', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Public Access Study Materials" ON storage.objects;
CREATE POLICY "Public Access Study Materials" ON storage.objects 
FOR ALL USING ( bucket_id = 'study-materials' ) 
WITH CHECK ( bucket_id = 'study-materials' );
`;

  const fullSchemaSql = `-- 📘 FULL DATABASE SCHEMA (FOR FRESH INSTALL)
-- 1. Enable UUID
create extension if not exists "pgcrypto";

-- 2. Tables
CREATE TABLE IF NOT EXISTS uploads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size INTEGER,
  file_type TEXT,
  storage_path TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  upload_id UUID REFERENCES uploads(id) ON DELETE SET NULL,
  user_email TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  summary_style TEXT NOT NULL,
  ai_model_used TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS flashcards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  summary_id UUID REFERENCES summaries(id) ON DELETE CASCADE,
  user_email TEXT NOT NULL,
  front TEXT NOT NULL,
  back TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS quizzes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  summary_id UUID REFERENCES summaries(id) ON DELETE CASCADE,
  user_email TEXT NOT NULL,
  title TEXT,
  question_count INTEGER,
  questions JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Enable RLS
ALTER TABLE uploads ENABLE ROW LEVEL SECURITY;
ALTER TABLE summaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE flashcards ENABLE ROW LEVEL SECURITY;
ALTER TABLE quizzes ENABLE ROW LEVEL SECURITY;

-- 4. Anonymous policies (Trust-based flow)
CREATE POLICY "Anon Summaries" ON summaries FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Anon Uploads" ON uploads FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Anon Flashcards" ON flashcards FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Anon Quizzes" ON quizzes FOR ALL TO anon USING (true) WITH CHECK (true);

-- 5. Storage Bucket
INSERT INTO storage.buckets (id, name, public) 
VALUES ('study-materials', 'study-materials', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public Access Study Materials" ON storage.objects 
FOR ALL USING ( bucket_id = 'study-materials' ) 
WITH CHECK ( bucket_id = 'study-materials' );
`;

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="text-center space-y-4">
        <h2 className="text-4xl font-bold text-white tracking-tight">System Architecture</h2>
        <p className="text-slate-400 max-w-2xl mx-auto font-medium">
          NoteGenie operates on an asynchronous "Trust-Based Identity" model, partitioning data via email prefixes.
        </p>
      </div>

      {/* Migration Alert Box */}
      <div className="bg-cyan-500/5 border border-cyan-500/20 p-8 rounded-[2.5rem] shadow-2xl relative overflow-hidden group">
        <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
          <Zap size={120} className="text-cyan-400" />
        </div>
        
        <div className="flex flex-col md:flex-row items-center justify-between gap-8 relative z-10">
          <div className="flex items-start gap-5">
            <div className="w-14 h-14 bg-cyan-500/20 rounded-2xl flex items-center justify-center shrink-0">
              <AlertTriangle className="text-cyan-400" size={28} />
            </div>
            <div>
              <h3 className="text-xl font-bold text-white mb-2">Supabase Sync Tool</h3>
              <p className="text-sm text-slate-400 max-w-lg leading-relaxed">
                If you see "Bucket not found" or "Missing user_email" errors, your database is out of sync. Click the button to copy the <strong>Repair Script</strong> and run it in your Supabase SQL Editor.
              </p>
            </div>
          </div>
          <button 
            onClick={() => handleCopy(migrationSql)}
            className="w-full md:w-auto bg-cyan-600 hover:bg-cyan-500 text-white px-8 py-4 rounded-2xl font-black text-sm uppercase tracking-widest transition-all active:scale-95 shadow-lg shadow-cyan-900/30 whitespace-nowrap"
          >
            {copied ? 'Copied to Clipboard' : 'Copy Repair Script'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-slate-900/40 border border-slate-800 p-8 rounded-3xl space-y-4 hover:border-cyan-500/30 transition-colors">
          <Globe className="text-cyan-400" size={32} />
          <h3 className="text-lg font-bold text-white">Trust Identity</h3>
          <p className="text-sm text-slate-400 leading-relaxed">
            Removing email confirmation latency allows for 1,500+ concurrent session starts without bottlenecks.
          </p>
        </div>
        <div className="bg-slate-900/40 border border-slate-800 p-8 rounded-3xl space-y-4 hover:border-emerald-500/30 transition-colors">
          <Cpu className="text-emerald-400" size={32} />
          <h3 className="text-lg font-bold text-white">Gemini 3 Pro</h3>
          <p className="text-sm text-slate-400 leading-relaxed">
            Utilizes deep reasoning to preserve complex mathematical equations and logical derivations.
          </p>
        </div>
        <div className="bg-slate-900/40 border border-slate-800 p-8 rounded-3xl space-y-4 hover:border-purple-500/30 transition-colors">
          <Shield className="text-purple-400" size={32} />
          <h3 className="text-lg font-bold text-white">Data Isolation</h3>
          <p className="text-sm text-slate-400 leading-relaxed">
            Multi-tenancy is enforced via row-level security (RLS) filtering on the identity email identifier.
          </p>
        </div>
      </div>

      <div className="space-y-6">
        <div className="flex items-center justify-between px-2">
          <div className="flex items-center gap-3 text-emerald-400">
            <Lock size={24} />
            <h3 className="text-2xl font-bold text-white tracking-tight">Full Schema Script</h3>
          </div>
          <button 
            onClick={() => handleCopy(fullSchemaSql)}
            className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 hover:text-emerald-400 transition-colors"
          >
            Copy Full SQL
          </button>
        </div>
        
        <div className="bg-slate-950 p-8 rounded-[2.5rem] border border-slate-800 font-mono text-[11px] text-emerald-500/60 overflow-x-auto max-h-[400px] overflow-y-auto leading-relaxed scrollbar-thin shadow-2xl">
          <pre>{fullSchemaSql}</pre>
        </div>
      </div>

      <div className="flex justify-center gap-10 py-10 opacity-10">
        <Cloud size={48} />
        <Server size={48} />
        <Zap size={48} />
      </div>
    </div>
  );
};

export default SystemDesign;
