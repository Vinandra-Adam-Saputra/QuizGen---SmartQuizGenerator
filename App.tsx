import React from 'react';
import { HashRouter, Routes, Route, Outlet } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { QuizProvider } from './contexts/QuizContext';

import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import CreateQuizPage from './pages/CreateQuizPage';
import QuizPage from './pages/QuizPage';
import ProtectedRoute from './components/ProtectedRoute';
import QuizHistory from './components/QuizHistory';
import SupabaseSetup from './components/SupabaseSetup';
import Header from './components/Header'; // ✅ Tambahan

const AdminLayout: React.FC = () => {
  const { user, logout } = useAuth();
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <header className="flex justify-between items-center py-4 border-b border-gray-700">
        <h1 className="text-xl font-bold text-white">Teacher Dashboard</h1>
        {user && (
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-400">{user.email}</span>
            <button
              onClick={() => logout()}
              className="px-3 py-1 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors text-sm font-semibold"
            >
              Log Out
            </button>
          </div>
        )}
      </header>
      <main className="py-8">
        <SupabaseSetup />
        <Outlet />
      </main>
    </div>
  );
};

const AdminDashboard: React.FC = () => (
  <div>
    <CreateQuizPage />
    <div className="mt-12">
      <QuizHistory />
    </div>
  </div>
);

const App: React.FC = () => {
  return (
    <AuthProvider>
      <QuizProvider>
        <HashRouter>
          <div className="bg-gray-900 text-white min-h-screen font-sans">
            <Header />

            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/quiz/:quizId" element={<QuizPage />} />

              <Route
                path="/admin"
                element={
                  <ProtectedRoute>
                    <AdminLayout />
                  </ProtectedRoute>
                }
              >
                <Route index element={<AdminDashboard />} />
              </Route>
            </Routes>
          </div>
        </HashRouter>
      </QuizProvider>
    </AuthProvider>
  );
};

export default App;
