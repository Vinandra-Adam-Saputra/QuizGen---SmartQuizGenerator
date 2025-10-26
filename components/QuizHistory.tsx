import React, { useState, useEffect } from 'react';
import { useQuiz } from '../contexts/QuizContext';
import Loader from './Loader';
import { generateQuestionImage } from '../services/geminiService';

type Toast = {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
};

interface QuestionWithImage {
  type: string;
  question_text: string;
  image_description?: string;
  image_url?: string;
  imageLoading?: boolean;
  imageError?: boolean;
  options?: string[];
  correct_answer: string;
  explanation?: string;
}

const QuizHistory: React.FC = () => {
  const { quizzes, loading, error, fetchQuizzes, deleteQuiz, getQuizById, removeQuizFromState } = useQuiz();
  const [reviewQuiz, setReviewQuiz] = useState<any | null>(null);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [imageLoadingStates, setImageLoadingStates] = useState<{ [key: number]: boolean }>({});

  // simple toast system (you already had this approach)
  const [toasts, setToasts] = useState<Toast[]>([]);
  const pushToast = (t: Omit<Toast, 'id'>, ttl = 3500) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const toast: Toast = { id, ...t };
    setToasts((s) => [toast, ...s]);
    setTimeout(() => {
      setToasts((s) => s.filter((x) => x.id !== id));
    }, ttl);
  };

  useEffect(() => {
    // optional: you may fetch on mount but typically provider already fetched
    // if quizzes are empty and user expects auto load, uncomment:
    // if (!loading && quizzes.length === 0) fetchQuizzes();
  }, []); // eslint-disable-line

  const handleRefresh = async () => {
    try {
      await fetchQuizzes();
      pushToast({ type: 'success', message: 'Quiz history refreshed.' });
    } catch (err: any) {
      console.error(err);
      pushToast({ type: 'error', message: 'Failed to refresh quizzes.' });
    }
  };

  const handleReview = async (quizId: string) => {
    setReviewLoading(true);
    setImageLoadingStates({});
    try {
      const data = await getQuizById(quizId);
      if (!data) {
        pushToast({ type: 'error', message: 'Quiz data not found.' });
      } else {
        setReviewQuiz(data);
        // Generate images in background
        generateImagesForReview(data);
      }
    } catch (err) {
      console.error(err);
      pushToast({ type: 'error', message: 'Failed to load quiz details.' });
    } finally {
      setReviewLoading(false);
    }
  };

  // Generate images for review modal
  const generateImagesForReview = async (quizData: any) => {
    if (!quizData.questions) return;

    const questionsNeedingImages = quizData.questions
      .map((q: any, idx: number) => ({ question: q, index: idx }))
      .filter(({ question }: any) => question.image_description && question.image_description.trim());

    if (questionsNeedingImages.length === 0) return;

    // Set loading states
    const loadingStates: { [key: number]: boolean } = {};
    questionsNeedingImages.forEach(({ index }: any) => {
      loadingStates[index] = true;
    });
    setImageLoadingStates(loadingStates);

    // Generate images concurrently
    const imagePromises = questionsNeedingImages.map(async ({ question, index }: any) => {
      try {
        console.log(`🎨 Generating preview image for question ${index + 1}`);
        const imageUrl = await generateQuestionImage(question.image_description);
        
        if (imageUrl) {
          console.log(`✅ Preview image generated for question ${index + 1}`);
          return { index, imageUrl, success: true };
        } else {
          console.warn(`⚠️ No preview image URL returned for question ${index + 1}`);
          return { index, imageUrl: '', success: false };
        }
      } catch (err) {
        console.error(`❌ Failed to generate preview image for question ${index + 1}:`, err);
        return { index, imageUrl: '', success: false };
      }
    });

    // Wait for all images to complete
    const results = await Promise.allSettled(imagePromises);

    // Update quiz with generated images
    setReviewQuiz((prevQuiz: any) => {
      if (!prevQuiz) return prevQuiz;

      const updatedQuestions = [...prevQuiz.questions];
      
      results.forEach((result, idx) => {
        if (result.status === 'fulfilled' && result.value) {
          const { index, imageUrl, success } = result.value;
          updatedQuestions[index] = {
            ...updatedQuestions[index],
            image_url: imageUrl,
            imageError: !success,
          };
        }
      });

      return { ...prevQuiz, questions: updatedQuestions };
    });

    // Clear loading states
    setImageLoadingStates({});
  };

  // confirmation modal state (ganti window.confirm)
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; title?: string } | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDeleteConfirm = (quizId: string, title?: string) => {
    setConfirmDelete({ id: quizId, title });
  };

  const performDelete = async () => {
    if (!confirmDelete) return;
    const id = confirmDelete.id;
    try {
      setDeletingId(id);
      await deleteQuiz(id); // hapus di DB (akan throw jika gagal)
      removeQuizFromState(id); // update state lokal (langsung hilang di UI)
      pushToast({ type: 'success', message: 'Quiz deleted.' });
    } catch (err: any) {
      console.error('Delete failed', err);
      pushToast({ type: 'error', message: err?.message || 'Failed to delete quiz.' });
    } finally {
      setDeletingId(null);
      setConfirmDelete(null);
    }
  };

  const getShareableLink = (quizId: string) => {
    const url = new URL(window.location.href);
    const adminPathIndex = url.hash.indexOf('/admin');
    if (adminPathIndex !== -1) {
      url.hash = url.hash.substring(0, adminPathIndex);
    }
    url.hash = `/quiz/${quizId}`;
    return url.href;
  };

  const copyToClipboard = (quizId: string) => {
    const link = getShareableLink(quizId);
    if (!link) {
      pushToast({ type: 'error', message: 'No link available.' });
      return;
    }

    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      navigator.clipboard
        .writeText(link)
        .then(() => pushToast({ type: 'success', message: 'Link copied to clipboard!' }))
        .catch((err) => {
          console.error('Clipboard API failed', err);
          fallbackCopy(link);
        });
    } else {
      fallbackCopy(link);
    }
  };

  const fallbackCopy = (text: string) => {
    try {
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.opacity = '0';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      pushToast({ type: 'success', message: 'Link copied to clipboard!' });
    } catch (err) {
      console.error('Fallback copy failed:', err);
      pushToast({ type: 'error', message: 'Copy failed.' });
    }
  };

  return (
    <div className="bg-gray-800 p-6 rounded-xl shadow-lg relative">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold text-white">My Quizzes</h2>
        <button
          onClick={handleRefresh}
          disabled={loading}
          className="px-4 py-2 bg-brand-secondary text-white rounded-md hover:bg-blue-500 transition-colors font-semibold text-sm disabled:bg-gray-600"
        >
          {loading ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {loading && quizzes.length === 0 && (
        <div className="flex justify-center">
          <Loader message="Loading quiz history..." />
        </div>
      )}

      {error && <p className="text-red-400 bg-red-500/10 p-3 rounded-md">{error}</p>}

      {!loading && quizzes.length === 0 && !error && (
        <div className="text-center py-8 px-4 bg-gray-900 rounded-lg">
          <p className="text-gray-400">You haven't created any quizzes yet.</p>
          <p className="text-sm text-gray-500 mt-1">Use the form above to generate your first one!</p>
        </div>
      )}

      {quizzes.length > 0 && (
        <div className="space-y-4">
          {quizzes.map((quiz) => (
            <div
              key={quiz.id}
              className="bg-gray-900 p-4 rounded-lg flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2"
            >
              <div className="flex-grow">
                <h3 className="font-semibold text-white">{quiz.title}</h3>
                <p className="text-xs text-gray-400">
                  Created on: {new Date(quiz.created_at).toLocaleDateString()}
                </p>
              </div>

              <div className="flex gap-2 flex-shrink-0">
                <button
                  onClick={() => copyToClipboard(quiz.id)}
                  className="px-3 py-1 bg-brand-primary text-white rounded-md hover:bg-brand-dark transition-colors text-sm"
                >
                  Copy Link
                </button>

                <button
                  onClick={() => handleReview(quiz.id)}
                  className="px-3 py-1 bg-yellow-600 text-white rounded-md hover:bg-yellow-700 transition-colors text-sm"
                >
                  Review
                </button>

                <button
                  onClick={() => handleDeleteConfirm(quiz.id, quiz.title)}
                  className="px-3 py-1 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors text-sm"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Review Quiz */}
      {reviewQuiz && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto relative">
            <button
              onClick={() => {
                setReviewQuiz(null);
                setImageLoadingStates({});
              }}
              className="sticky top-0 right-0 float-right text-2xl text-gray-400 hover:text-white bg-gray-800 rounded-full w-8 h-8 flex items-center justify-center z-10"
            >
              ✕
            </button>

            <h3 className="text-2xl font-bold text-white mb-2">{reviewQuiz.title}</h3>
            <p className="text-sm text-gray-400 mb-6">
              {reviewQuiz.questions?.length || 0} question(s)
            </p>

            {reviewLoading ? (
              <Loader message="Loading quiz details..." />
            ) : (
              <div className="space-y-6">
                {/* Reading Passage Section */}
                {reviewQuiz.passage && (
                  <div className="bg-gradient-to-br from-blue-900/30 to-purple-900/20 p-6 rounded-lg border-2 border-blue-500/30 shadow-lg">
                    <div className="flex items-center gap-2 mb-4">
                      <span className="text-2xl">📖</span>
                      <h4 className="text-lg font-bold text-blue-300">Reading Passage</h4>
                    </div>
                    <div className="bg-gray-800/50 p-4 rounded-lg">
                      <p className="text-gray-200 whitespace-pre-wrap leading-relaxed text-sm">
                        {reviewQuiz.passage}
                      </p>
                    </div>
                    <p className="text-xs text-gray-400 mt-3 italic">
                      💡 Questions below are based on this passage
                    </p>
                  </div>
                )}

                {/* Questions Section */}
                {reviewQuiz.questions && reviewQuiz.questions.length > 0 ? (
                  reviewQuiz.questions.map((q: QuestionWithImage, i: number) => {
                    const isImageLoading = imageLoadingStates[i];

                    return (
                      <div key={i} className="bg-gray-800 p-5 rounded-lg shadow-md border border-gray-700">
                        {/* Question Number & Type Badge */}
                        <div className="flex items-start justify-between mb-3">
                          <span className="text-brand-secondary font-bold text-lg">
                            Question {i + 1}
                          </span>
                          <span className={`text-xs px-2 py-1 rounded-full ${
                            q.type === 'multiple-choice' ? 'bg-green-600/20 text-green-300' :
                            q.type === 'fill-in-the-blank' ? 'bg-blue-600/20 text-blue-300' :
                            'bg-purple-600/20 text-purple-300'
                          }`}>
                            {q.type === 'multiple-choice' ? '📝 Multiple Choice' :
                             q.type === 'fill-in-the-blank' ? '✏️ Fill in the Blank' :
                             '📄 Essay'}
                          </span>
                        </div>

                        {/* Image Display Section */}
                        {q.image_description && (
                          <div className="mb-4">
                            {isImageLoading ? (
                              <div className="p-4 border-2 border-dashed border-gray-600 rounded-lg bg-gray-700/30">
                                <div className="flex flex-col items-center justify-center space-y-2">
                                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-secondary"></div>
                                  <p className="text-xs text-gray-400">Generating image...</p>
                                </div>
                              </div>
                            ) : q.image_url ? (
                              <div className="p-3 border-2 border-gray-600 rounded-lg bg-gray-700/20">
                                <img 
                                  src={q.image_url} 
                                  alt={`Question ${i + 1} illustration`}
                                  className="mx-auto max-h-64 w-auto object-contain rounded-lg shadow-lg"
                                  onError={(e) => {
                                    console.error(`Failed to load preview image for question ${i + 1}`);
                                    e.currentTarget.style.display = 'none';
                                  }}
                                />
                                <p className="text-xs text-gray-400 italic mt-2 text-center">
                                  📝 {q.image_description}
                                </p>
                              </div>
                            ) : (
                              <div className="p-3 border-2 border-dashed border-yellow-600/50 rounded-lg bg-yellow-900/10">
                                <div className="flex items-start gap-2">
                                  <span className="text-xl">🖼️</span>
                                  <div>
                                    <p className="text-xs font-semibold text-yellow-300 mb-1">
                                      Visual Reference:
                                    </p>
                                    <p className="text-xs text-gray-300 italic">
                                      {q.image_description}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Question Text */}
                        <p className="text-white font-semibold mb-3 text-base">
                          {q.question_text}
                        </p>

                        {/* Render by type */}
                        {q.type === 'multiple-choice' && q.options && (
                          <div className="mb-3">
                            <p className="text-xs text-gray-400 mb-2 font-semibold">Options:</p>
                            <ul className="space-y-1.5">
                              {q.options.map((opt: string, j: number) => {
                                const isCorrect = opt.toLowerCase().trim() === q.correct_answer.toLowerCase().trim();
                                return (
                                  <li 
                                    key={j} 
                                    className={`pl-4 py-1.5 rounded text-sm ${
                                      isCorrect 
                                        ? 'bg-green-600/20 text-green-300 border-l-4 border-green-500' 
                                        : 'text-gray-300 bg-gray-700/30 border-l-4 border-gray-600'
                                    }`}
                                  >
                                    {String.fromCharCode(65 + j)}. {opt}
                                    {isCorrect && <span className="ml-2 text-xs">✓</span>}
                                  </li>
                                );
                              })}
                            </ul>
                          </div>
                        )}

                        {q.type === 'fill-in-the-blank' && (
                          <div className="mb-3 p-3 bg-gray-700/30 rounded-md border-l-4 border-blue-500">
                            <p className="text-xs text-gray-400 mb-1">Expected Answer:</p>
                            <p className="text-blue-300 font-mono text-sm">
                              {q.correct_answer}
                            </p>
                          </div>
                        )}

                        {q.type === 'essay' && (
                          <div className="mb-3 p-3 bg-purple-900/10 rounded-md border-l-4 border-purple-500">
                            <p className="text-xs text-purple-300 mb-1">Model/Expected Answer:</p>
                            <p className="text-gray-300 text-sm italic leading-relaxed">
                              {q.correct_answer}
                            </p>
                          </div>
                        )}

                        {/* Correct Answer (for non-essay) */}
                        {q.type !== 'essay' && (
                          <div className="mb-2 p-2 bg-green-600/10 rounded-md">
                            <p className="text-green-400 text-xs">
                              ✅ <strong>Correct Answer:</strong> {q.correct_answer}
                            </p>
                          </div>
                        )}

                        {/* Explanation */}
                        {q.explanation && (
                          <div className="mt-3 pt-3 border-t border-gray-700">
                            <p className="text-gray-400 text-xs leading-relaxed">
                              <span className="text-yellow-300 font-semibold">💡 Explanation:</span>{' '}
                              {q.explanation}
                            </p>
                          </div>
                        )}
                      </div>
                    );
                  })
                ) : (
                  <p className="text-gray-400 text-center py-8">No question data available.</p>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Confirm Delete Modal */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-gray-900 rounded-lg p-6 w-[90%] max-w-sm">
            <h3 className="text-lg font-bold text-white mb-2">Delete quiz?</h3>
            <p className="text-gray-300 mb-4">
              Are you sure you want to delete{' '}
              <span className="font-semibold">{confirmDelete.title || 'this quiz'}</span>? 
              This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button 
                onClick={() => setConfirmDelete(null)} 
                className="px-4 py-2 bg-gray-700 text-white rounded-md hover:bg-gray-600"
              >
                Cancel
              </button>
              <button
                onClick={performDelete}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
                disabled={deletingId === confirmDelete.id}
              >
                {deletingId === confirmDelete.id ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast container */}
      <div className="fixed right-4 bottom-4 z-[60] flex flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`min-w-[220px] max-w-sm px-4 py-2 rounded-md shadow-lg transform transition-all ${
              t.type === 'success'
                ? 'bg-green-600 text-white'
                : t.type === 'error'
                ? 'bg-red-600 text-white'
                : 'bg-gray-700 text-white'
            }`}
            role="status"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm">{t.message}</span>
              <button
                onClick={() => setToasts((s) => s.filter((x) => x.id !== t.id))}
                className="text-xs opacity-80 hover:opacity-100"
              >
                ✕
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default QuizHistory;