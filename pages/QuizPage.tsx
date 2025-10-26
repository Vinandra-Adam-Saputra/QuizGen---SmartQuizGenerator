// pages/QuizPage.tsx
import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import type { Quiz, StudentAnswer, QuizResult, Question } from '../types';
import Loader from '../components/Loader';
import { generateQuestionImage } from '../services/geminiService';

// Extended Question type with optional image_url
interface QuestionWithImage extends Question {
  image_url?: string;
  imageLoading?: boolean;
  imageError?: boolean;
}

const QuizPage: React.FC = () => {
  const { quizId } = useParams<{ quizId: string }>();
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [answers, setAnswers] = useState<StudentAnswer>({});
  const [result, setResult] = useState<QuizResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [imageLoadingStates, setImageLoadingStates] = useState<{ [key: number]: boolean }>({});

  useEffect(() => {
    const fetchQuiz = async () => {
      if (!quizId) {
        setError('No quiz ID provided.');
        setIsLoading(false);
        return;
      }
      try {
        const { data, error } = await supabase
          .from('quizzes')
          .select('id, quiz_data')
          .eq('id', quizId)
          .single();

        if (error) throw error;

        if (data) {
          const fetchedQuiz: Omit<Quiz, 'id'> = data.quiz_data;
          const quizWithId: Quiz = { ...fetchedQuiz, id: data.id };

          // Set quiz first (so UI renders immediately)
          setQuiz(quizWithId);
          setIsLoading(false);

          // Then generate images in background (non-blocking)
          generateImagesForQuestions(quizWithId);
        } else {
          setError('Quiz not found.');
          setIsLoading(false);
        }
      } catch (err: any) {
        setError(err.message || 'Failed to fetch quiz.');
        setIsLoading(false);
      }
    };

    fetchQuiz();
  }, [quizId]);

  // Generate images in background without blocking UI
  const generateImagesForQuestions = async (quizData: Quiz) => {
    const questionsNeedingImages = quizData.questions
      .map((q, idx) => ({ question: q, index: idx }))
      .filter(({ question }) => question.image_description && question.image_description.trim());

    if (questionsNeedingImages.length === 0) return;

    // Set loading states
    const loadingStates: { [key: number]: boolean } = {};
    questionsNeedingImages.forEach(({ index }) => {
      loadingStates[index] = true;
    });
    setImageLoadingStates(loadingStates);

    // Generate images concurrently
    const imagePromises = questionsNeedingImages.map(async ({ question, index }) => {
      try {
        console.log(`🎨 Generating image for question ${index + 1}:`, question.image_description);
        const imageUrl = await generateQuestionImage(question.image_description!);
        
        if (imageUrl) {
          console.log(`✅ Image generated for question ${index + 1}`);
          return { index, imageUrl, success: true };
        } else {
          console.warn(`⚠️ No image URL returned for question ${index + 1}`);
          return { index, imageUrl: '', success: false };
        }
      } catch (err) {
        console.error(`❌ Failed to generate image for question ${index + 1}:`, err);
        return { index, imageUrl: '', success: false };
      }
    });

    // Wait for all images to complete
    const results = await Promise.allSettled(imagePromises);

    // Update quiz with generated images
    setQuiz((prevQuiz) => {
      if (!prevQuiz) return prevQuiz;

      const updatedQuestions = [...prevQuiz.questions];
      
      results.forEach((result, idx) => {
        if (result.status === 'fulfilled' && result.value) {
          const { index, imageUrl, success } = result.value;
          updatedQuestions[index] = {
            ...updatedQuestions[index],
            image_url: imageUrl,
            imageError: !success,
          } as QuestionWithImage;
        }
      });

      return { ...prevQuiz, questions: updatedQuestions };
    });

    // Clear loading states
    setImageLoadingStates({});
  };

  const handleInputChange = (questionIndex: number, value: string) => {
    setAnswers((prev) => ({
      ...prev,
      [questionIndex]: value,
    }));
  };

  const handleSubmit = () => {
    if (!quiz) return;
    let score = 0;
    let gradableQuestions = 0;
    quiz.questions.forEach((q, index) => {
      if (q.type === 'multiple-choice' || q.type === 'fill-in-the-blank') {
        gradableQuestions++;
        const userAnswer = (answers[index] || '').trim().toLowerCase();
        const correctAnswer = (q.correct_answer || '').trim().toLowerCase();
        if (userAnswer === correctAnswer) {
          score++;
        }
      }
    });
    setResult({
      score,
      total: quiz.questions.length,
      answers,
      gradableQuestions,
    });
    window.scrollTo(0, 0);
  };

  if (isLoading) {
    return (
      <div className="flex justify-center pt-10">
        <Loader message="Loading Quiz..." />
      </div>
    );
  }

  if (error || !quiz) {
    return (
      <div className="text-center p-8 bg-gray-800 rounded-lg">
        <h2 className="text-3xl font-bold text-red-500 mb-4">Error</h2>
        <p className="text-gray-300">{error || "The quiz you're looking for doesn't exist or the link has expired."}</p>
        <Link to="/" className="mt-6 inline-block px-6 py-2 bg-brand-secondary text-white rounded-md hover:bg-blue-500">
          Go Home
        </Link>
      </div>
    );
  }

  if (result) {
    return <ResultsView quiz={quiz} result={result} />;
  }

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-8 bg-gray-800 rounded-xl shadow-2xl">
      <h1 className="text-4xl font-extrabold text-center mb-2 text-white">{quiz.title}</h1>
      <p className="text-center text-gray-400 mb-8">Answer all the questions below.</p>

      {quiz.passage && (
        <div className="mb-10 p-6 bg-gray-900 rounded-lg shadow-inner">
          <h2 className="text-xl font-bold text-brand-secondary mb-3">Read the passage below to answer the questions:</h2>
          <p className="text-gray-300 whitespace-pre-wrap leading-relaxed">{quiz.passage}</p>
        </div>
      )}

      <div className="space-y-8">
        {quiz.questions.map((q, index) => {
          const questionWithImage = q as QuestionWithImage;
          const isImageLoading = imageLoadingStates[index];

          return (
            <div key={index} className="bg-gray-900 p-6 rounded-lg shadow-lg">
              {/* Image Display Section */}
              {q.image_description && (
                <div className="mb-4">
                  {isImageLoading ? (
                    // Loading state
                    <div className="p-6 border-2 border-dashed border-gray-600 rounded-lg bg-gray-800/50">
                      <div className="flex flex-col items-center justify-center space-y-3">
                        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-brand-secondary"></div>
                        <p className="text-sm text-gray-400">Generating image...</p>
                        <p className="text-xs text-gray-500 italic text-center max-w-md">"{q.image_description}"</p>
                      </div>
                    </div>
                  ) : questionWithImage.image_url ? (
                    // Image loaded successfully
                    <div className="p-4 border-2 border-gray-600 rounded-lg bg-gray-800/30 overflow-hidden">
                      <div className="relative group">
                        <img 
                          src={questionWithImage.image_url} 
                          alt={`Illustration for question ${index + 1}`}
                          className="mx-auto max-h-80 w-auto object-contain rounded-lg shadow-lg transition-transform group-hover:scale-105"
                          onError={(e) => {
                            console.error(`Failed to load image for question ${index + 1}`);
                            // If image fails to load, show description instead
                            e.currentTarget.style.display = 'none';
                          }}
                        />
                        {q.image_description && (
                          <p className="text-xs text-gray-400 italic mt-3 text-center bg-gray-900/50 p-2 rounded">
                            📝 {q.image_description}
                          </p>
                        )}
                      </div>
                    </div>
                  ) : questionWithImage.imageError ? (
                    // Image generation failed - show description
                    <div className="p-4 border-2 border-dashed border-yellow-600/50 rounded-lg bg-yellow-900/10">
                      <div className="flex items-start space-x-3">
                        <span className="text-2xl">🖼️</span>
                        <div className="flex-1">
                          <p className="text-sm font-semibold text-yellow-300 mb-1">Image for this question:</p>
                          <p className="text-gray-300 italic text-sm leading-relaxed">"{q.image_description}"</p>
                          <p className="text-xs text-gray-500 mt-2">💡 Imagine this scene while answering</p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    // Default description display
                    <div className="p-4 border-2 border-dashed border-gray-600 rounded-lg bg-gray-800/30">
                      <div className="flex items-start space-x-3">
                        <span className="text-2xl">🖼️</span>
                        <div className="flex-1">
                          <p className="text-sm font-semibold text-gray-400 mb-1">Image for this question:</p>
                          <p className="text-gray-300 italic text-sm">"{q.image_description}"</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Question Text */}
              <p className="text-lg font-semibold text-gray-200 mb-4">
                {index + 1}. {q.question_text.replace(/___+/g, '_____')}
              </p>

              {/* Multiple Choice Options */}
              {q.type === 'multiple-choice' && q.options && (
                <div className="space-y-3">
                  {q.options.map((option, optIndex) => (
                    <label
                      key={optIndex}
                      className={`flex items-center p-3 rounded-md cursor-pointer transition-all duration-200 ${
                        answers[index] === option 
                          ? 'bg-brand-dark ring-2 ring-brand-secondary' 
                          : 'bg-gray-800 hover:bg-gray-700'
                      }`}
                    >
                      <input
                        type="radio"
                        name={`question-${index}`}
                        value={option}
                        checked={answers[index] === option}
                        onChange={(e) => handleInputChange(index, e.target.value)}
                        className="h-4 w-4 text-brand-secondary bg-gray-700 border-gray-600 focus:ring-brand-secondary"
                      />
                      <span className="ml-3 text-gray-300">{option}</span>
                    </label>
                  ))}
                </div>
              )}

              {/* Fill in the Blank */}
              {q.type === 'fill-in-the-blank' && (
                <input
                  type="text"
                  name={`question-${index}`}
                  value={answers[index] || ''}
                  onChange={(e) => handleInputChange(index, e.target.value)}
                  className="mt-1 block w-full bg-gray-700 border-gray-600 rounded-md shadow-sm focus:ring-brand-secondary focus:border-brand-secondary sm:text-sm text-white p-2"
                  placeholder="Type your answer here"
                />
              )}

              {/* Essay */}
              {q.type === 'essay' && (
                <textarea
                  name={`question-${index}`}
                  value={answers[index] || ''}
                  onChange={(e) => handleInputChange(index, e.target.value)}
                  rows={5}
                  className="mt-1 block w-full bg-gray-700 border-gray-600 rounded-md shadow-sm focus:ring-brand-secondary focus:border-brand-secondary sm:text-sm text-white p-2"
                  placeholder="Type your essay answer here..."
                />
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-10 text-center">
        <button
          onClick={handleSubmit}
          className="px-12 py-4 bg-green-600 text-white font-bold text-xl rounded-lg hover:bg-green-700 transition-transform transform hover:scale-105 shadow-xl"
        >
          Submit Quiz
        </button>
      </div>
    </div>
  );
};

const ResultsView: React.FC<{ quiz: Quiz; result: QuizResult }> = ({ quiz, result }) => {
  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-8 bg-gray-800 rounded-xl shadow-2xl">
      {/* Back Button - Top */}
      <div className="mb-6">
        <Link 
          to="/"
          className="inline-flex items-center gap-2 text-gray-400 hover:text-brand-secondary transition-colors group"
        >
          <span className="text-xl group-hover:translate-x-[-4px] transition-transform">←</span>
          <span className="font-medium">Back to Home</span>
        </Link>
      </div>

      <h1 className="text-4xl font-extrabold text-center mb-4 text-white">Quiz Results</h1>
      <div className="text-center mb-8 p-6 bg-brand-primary/30 rounded-lg">
        <p className="text-2xl text-gray-300">Your Score:</p>
        <p className="text-6xl font-bold text-brand-secondary">{result.score} / {result.gradableQuestions}</p>
        {result.gradableQuestions < result.total && (
          <p className="text-gray-400 mt-2">
            ({result.total - result.gradableQuestions} essay questions require manual review)
          </p>
        )}
      </div>

      <h2 className="text-2xl font-bold mb-6 text-gray-200">Review Your Answers:</h2>
      <div className="space-y-6">
        {quiz.questions.map((q, index) => {
          const userAnswer = result.answers[index] || "Not Answered";
          let isCorrect = false;
          let needsReview = false;

          if (q.type === 'multiple-choice' || q.type === 'fill-in-the-blank') {
            isCorrect = (userAnswer || '').trim().toLowerCase() === q.correct_answer.trim().toLowerCase();
          } else if (q.type === 'essay') {
            needsReview = true;
          }

          const getResultClass = () => {
            if (needsReview) return 'border-blue-500 bg-blue-500/10';
            return isCorrect ? 'border-green-500 bg-green-500/10' : 'border-red-500 bg-red-500/10';
          };

          return (
            <div key={index} className={`p-5 rounded-lg border-2 ${getResultClass()}`}>
              <p className="text-lg font-semibold text-gray-200 mb-2">
                {index + 1}. {q.question_text}
              </p>

              <div className="mb-3">
                <p className="text-sm font-bold text-gray-400">Your Answer:</p>
                <p className={`text-sm p-2 rounded bg-gray-900/50 ${
                  isCorrect ? 'text-green-300' : needsReview ? 'text-blue-300' : 'text-red-300'
                }`}>
                  {userAnswer}
                </p>
              </div>

              {!isCorrect && !needsReview && (
                <div className="mb-3">
                  <p className="text-sm font-bold text-gray-400">Correct Answer:</p>
                  <p className="text-sm text-green-300 p-2 rounded bg-gray-900/50">
                    {q.correct_answer}
                  </p>
                </div>
              )}

              <div className="mt-3 pt-3 border-t border-gray-700">
                <p className="text-sm text-yellow-300/80">
                  <span className="font-bold">
                    {q.type === 'essay' ? 'Model Answer/Rubric:' : 'Explanation:'}
                  </span>{' '}
                  {q.explanation}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Bottom Action Buttons */}
      <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center items-center">
        <Link
          to="/"
          className="px-8 py-3 bg-brand-primary text-white font-semibold rounded-lg hover:bg-brand-dark transition-all duration-300 shadow-lg hover:shadow-xl flex items-center gap-2"
        >
          <span>🏠</span>
          <span>Back to Home</span>
        </Link>
        <button
          onClick={() => window.print()}
          className="px-8 py-3 bg-gray-700 text-white font-semibold rounded-lg hover:bg-gray-600 transition-all duration-300 shadow-lg hover:shadow-xl flex items-center gap-2"
        >
          <span>🖨️</span>
          <span>Print Results</span>
        </button>
      </div>
    </div>
  );
};

export default QuizPage;