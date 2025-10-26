import React, { createContext, useContext, useState, ReactNode, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import type { Quiz } from '../types';
import { useAuth } from './AuthContext';

interface QuizWithData extends Quiz {
  created_at: string;
}

interface QuizContextType {
  quizzes: QuizWithData[];
  loading: boolean;
  error: string | null;
  fetchQuizzes: () => Promise<void>;
  deleteQuiz: (id: string) => Promise<void>;
  getQuizById: (id: string) => Promise<any>;
  removeQuizFromState: (id: string) => void; // helper untuk update UI langsung
}

const QuizContext = createContext<QuizContextType | undefined>(undefined);

export const QuizProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [quizzes, setQuizzes] = useState<QuizWithData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  const fetchQuizzes = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase
        .from('quizzes')
        .select('id, created_at, quiz_data')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const formattedQuizzes = data.map((item: any) => ({
        ...item.quiz_data,
        id: item.id,
        created_at: item.created_at,
      }));
      setQuizzes(formattedQuizzes);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch quizzes.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  const getQuizById = async (id: string) => {
    try {
      const { data, error } = await supabase
        .from('quizzes')
        .select('id, created_at, quiz_data')
        .eq('id', id)
        .single();

      if (error) throw error;
      return {
        id: data.id,
        created_at: data.created_at,
        ...data.quiz_data,
      };
    } catch (err: any) {
      console.error('Error fetching quiz:', err);
      throw err;
    }
  };

  // deleteQuiz: hapus di DB — melempar error jika gagal
  const deleteQuiz = async (id: string) => {
    if (!user) throw new Error('User not authenticated');

    try {
      const { error } = await supabase
        .from('quizzes')
        .delete()
        .eq('id', id)
        .select();
        

      if (error) throw error;
      // jika tidak ada error, sukses — caller akan update state lokal
      return;
    setQuizzes((prev) => prev.filter((q) => q.id !== id));
  } catch (err: any) {
    console.error('Error deleting quiz:', err);
    alert('Failed to delete quiz. Please try again.');
  }
};

  // helper untuk update state lokal (optimistic UI)
  const removeQuizFromState = (id: string) => {
    setQuizzes((prev) => prev.filter((q) => q.id !== id));
  };

  useEffect(() => {
    if (user) {
      fetchQuizzes();
    } else {
      setQuizzes([]); // Clear on logout
    }
  }, [user, fetchQuizzes]);

  const value: QuizContextType = {
    quizzes,
    loading,
    error,
    fetchQuizzes,
    deleteQuiz,
    getQuizById,
    removeQuizFromState,
  };

  return <QuizContext.Provider value={value}>{children}</QuizContext.Provider>;
};

export const useQuiz = () => {
  const context = useContext(QuizContext);
  if (context === undefined) {
    throw new Error('useQuiz must be used within a QuizProvider');
  }
  return context;
};
