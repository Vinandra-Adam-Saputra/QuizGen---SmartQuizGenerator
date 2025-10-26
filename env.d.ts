// src/env.d.ts
/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GEMINI_API_KEY?: string;
  // tambahkan variabel env lain di sini jika diperlukan, contoh:
  // readonly VITE_SUPABASE_URL?: string;
  // readonly VITE_SUPABASE_ANON_KEY?: string;

  // fallback untuk akses dinamis
  readonly [key: string]: string | undefined;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
