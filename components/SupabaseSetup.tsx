import React, { useState } from 'react';

const SupabaseSetup: React.FC = () => {
  const [showInstructions, setShowInstructions] = useState(false);
  const [isDismissed, setIsDismissed] = useState(localStorage.getItem('supabaseSetupDismissed') === 'true');

  const createTableScript = `
-- Create the 'quizzes' table to store all generated quiz data
CREATE TABLE public.quizzes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  user_id uuid NULL,
  quiz_data jsonb NULL,
  CONSTRAINT quizzes_pkey PRIMARY KEY (id),
  CONSTRAINT quizzes_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);
  `.trim();

  const rlsScript = `
-- 1. Enable Row Level Security (RLS) on the quizzes table
-- This ensures that users can only access their own data.
ALTER TABLE public.quizzes ENABLE ROW LEVEL SECURITY;

-- 2. Create a policy for inserting quizzes
-- This allows any authenticated user to insert a new quiz linked to their ID.
CREATE POLICY "Allow authenticated users to insert quizzes"
ON public.quizzes FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- 3. Create a policy for selecting quizzes
-- This allows anyone to read a quiz, which is necessary for students to take them.
CREATE POLICY "Allow public read access to quizzes"
ON public.quizzes FOR SELECT
TO public
USING (true);
  `.trim();


  const handleDismiss = () => {
    localStorage.setItem('supabaseSetupDismissed', 'true');
    setIsDismissed(true);
  };

  if (isDismissed) {
    return null;
  }

  return (
    <div className="bg-blue-900/50 border border-blue-700 text-blue-200 px-4 py-3 rounded-lg relative mb-6 shadow-lg" role="alert">
      <div className="flex justify-between items-center">
        <div>
          <strong className="font-bold">First-Time Setup Guide</strong>
          <span className="block sm:inline ml-2">Need to save quizzes? You may need to set up your database table.</span>
        </div>
        <div>
          <button onClick={() => setShowInstructions(!showInstructions)} className="border border-blue-500 hover:bg-blue-800 text-white font-bold py-1 px-3 rounded text-sm transition-colors">
            {showInstructions ? 'Hide Instructions' : 'Show Instructions'}
          </button>
          <button onClick={handleDismiss} className="ml-2 font-bold text-lg leading-none" aria-label="Dismiss">
            &times;
          </button>
        </div>
      </div>


      {showInstructions && (
        <div className="mt-4 pt-4 border-t border-blue-700">
          <p className="mb-2">Run the following SQL scripts in your Supabase project's SQL Editor to get started.</p>
          <p className="mb-2 text-sm text-blue-300">Navigate to: <a href="https://supabase.com/dashboard" target="_blank" rel="noopener noreferrer" className="underline font-semibold">Your Project</a> → SQL Editor → New Query</p>

          <h3 className="font-bold mt-4 mb-2">Step 1: Create the Quizzes Table</h3>
          <p className="text-sm mb-2 text-blue-300">This script creates the table where your quizzes will be saved. Run this first.</p>
          <pre className="bg-gray-900 text-white p-3 rounded-md text-xs overflow-x-auto">
            <code>{createTableScript}</code>
          </pre>

          <h3 className="font-bold mt-4 mb-2">Step 2: Set Up Security Policies</h3>
          <p className="text-sm mb-2 text-blue-300">These "Row Level Security" policies protect your data. Run this after creating the table.</p>
          <pre className="bg-gray-900 text-white p-3 rounded-md text-xs overflow-x-auto">
            <code>{rlsScript}</code>
          </pre>
          
          <p className="mt-4 text-sm">Once you've run these scripts, you should be able to generate and save quizzes without errors.</p>
        </div>
      )}
    </div>
  );
};

export default SupabaseSetup;
