// pages/QuizPage.tsx
import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import type { Quiz, StudentAnswer, QuizResult, Question } from '../types';
import Loader from '../components/Loader';
import { generateQuestionImage } from '../services/geminiService';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

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
  const resultsRef = useRef<HTMLDivElement>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [pdfBlob, setPdfBlob] = useState<Blob | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string>('');

  const generatePDFBlob = async (): Promise<Blob | null> => {
    if (!resultsRef.current) return null;
    
    try {
      const element = resultsRef.current;
      
      // Clone element untuk styling khusus PDF
      const clone = element.cloneNode(true) as HTMLElement;
      
      // Setup clone for PDF rendering
      clone.style.position = 'fixed';
      clone.style.left = '0';
      clone.style.top = '0';
      clone.style.width = '210mm'; // A4 width
      clone.style.backgroundColor = 'white';
      clone.style.padding = '20px';
      clone.style.zIndex = '-9999';
      
      // Force all text to black and backgrounds to white
      const allElements = clone.querySelectorAll('*');
      allElements.forEach((el: any) => {
        el.style.color = 'black';
        el.style.backgroundColor = 'white';
        el.style.borderColor = '#d1d5db';
      });
      
      // Hide interactive elements
      const hideElements = clone.querySelectorAll('.no-pdf, .print\\:hidden');
      hideElements.forEach((el: any) => {
        el.remove();
      });
      
      // Append to body
      document.body.appendChild(clone);
      
      // Wait for render
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Capture with html2canvas
      const canvas = await html2canvas(clone, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        width: clone.scrollWidth,
        height: clone.scrollHeight,
        windowWidth: clone.scrollWidth,
        windowHeight: clone.scrollHeight
      });
      
      // Remove clone
      document.body.removeChild(clone);
      
      // Convert canvas to PDF
      const imgData = canvas.toDataURL('image/jpeg', 0.95);
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
        compress: true
      });
      
      // Calculate dimensions to fit A4
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;
      const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight);
      const imgX = (pdfWidth - imgWidth * ratio) / 2;
      const imgY = 10;
      
      // Add image to PDF
      pdf.addImage(
        imgData, 
        'JPEG', 
        imgX, 
        imgY, 
        imgWidth * ratio, 
        imgHeight * ratio,
        undefined,
        'FAST'
      );
      
      // Get blob
      const blob = pdf.output('blob');
      
      console.log('✅ PDF Generated - Size:', blob.size, 'bytes');
      
      return blob;
      
    } catch (error) {
      console.error('❌ PDF generation failed:', error);
      return null;
    }
  };

  const handlePreviewPDF = async () => {
    setIsDownloading(true);
    
    try {
      const blob = await generatePDFBlob();
      
      if (!blob) {
        alert('Failed to generate PDF preview.');
        return;
      }
      
      // Create blob URL for preview
      const url = URL.createObjectURL(blob);
      setPdfBlob(blob);
      setPdfUrl(url);
      setShowPreview(true);
      
    } catch (error) {
      console.error('PDF preview failed:', error);
      alert('Failed to generate PDF preview. Please try again.');
    } finally {
      setIsDownloading(false);
    }
  };

  const handleDownloadFromPreview = () => {
    if (!pdfBlob) return;
    
    // Create download link
    const url = URL.createObjectURL(pdfBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${quiz.title.replace(/[^a-z0-9]/gi, '_')}_Results.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // Cleanup
    URL.revokeObjectURL(url);
    setShowPreview(false);
  };

  const handleClosePreview = () => {
    if (pdfUrl) {
      URL.revokeObjectURL(pdfUrl);
    }
    setShowPreview(false);
    setPdfBlob(null);
    setPdfUrl('');
  };

  return (
    <div ref={resultsRef} className="max-w-4xl mx-auto p-4 sm:p-8 bg-gray-800 rounded-xl shadow-2xl pdf-content">
      {/* Back Button - Top */}
      <div className="mb-6 print:hidden no-pdf">
        <Link 
          to="/"
          className="inline-flex items-center gap-2 text-gray-400 hover:text-brand-secondary transition-colors group"
        >
          <span className="text-xl group-hover:translate-x-[-4px] transition-transform">←</span>
          <span className="font-medium">Back to Home</span>
        </Link>
      </div>

      <h1 className="text-4xl font-extrabold text-center mb-4 text-white">Quiz Results</h1>
      
      {/* Quiz Title for PDF */}
      <div className="text-center mb-2">
        <p className="text-lg text-gray-300 font-semibold">{quiz.title}</p>
        <p className="text-sm text-gray-400">Generated: {new Date().toLocaleDateString()}</p>
      </div>
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
      <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center items-center print:hidden no-pdf">
        <Link
          to="/"
          className="px-8 py-3 bg-brand-primary text-white font-semibold rounded-lg hover:bg-brand-dark transition-all duration-300 shadow-lg hover:shadow-xl flex items-center gap-2"
        >
          <span>🏠</span>
          <span>Back to Home</span>
        </Link>
        <button
          onClick={handlePreviewPDF}
          disabled={isDownloading}
          className="px-8 py-3 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 transition-all duration-300 shadow-lg hover:shadow-xl flex items-center gap-2 disabled:bg-gray-600 disabled:cursor-not-allowed"
        >
          {isDownloading ? (
            <>
              <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span>Generating Preview...</span>
            </>
          ) : (
            <>
              <span>📄</span>
              <span>Download PDF</span>
            </>
          )}
        </button>
      </div>

      {/* PDF Preview Modal */}
      {showPreview && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-gray-900 rounded-xl w-full max-w-5xl h-[90vh] flex flex-col shadow-2xl border border-gray-700">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-700">
              <div>
                <h3 className="text-xl font-bold text-white">PDF Preview</h3>
                <p className="text-sm text-gray-400">{quiz.title}</p>
              </div>
              <button
                onClick={handleClosePreview}
                className="text-gray-400 hover:text-white transition-colors p-2 hover:bg-gray-800 rounded-lg"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* PDF Viewer */}
            <div className="flex-1 overflow-hidden bg-gray-800">
              {pdfUrl ? (
                <iframe
                  src={pdfUrl}
                  className="w-full h-full border-0"
                  title="PDF Preview"
                />
              ) : (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <svg className="animate-spin h-12 w-12 text-brand-secondary mx-auto mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <p className="text-gray-400">Loading preview...</p>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between p-4 border-t border-gray-700 bg-gray-900">
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>Preview your results before downloading</span>
              </div>
              
              <div className="flex gap-3">
                <button
                  onClick={handleClosePreview}
                  className="px-6 py-2.5 bg-gray-700 text-white font-semibold rounded-lg hover:bg-gray-600 transition-all duration-200"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDownloadFromPreview}
                  className="px-6 py-2.5 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 transition-all duration-200 shadow-lg flex items-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  <span>Download PDF</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PDF Styling */}
      <style>{`
        @media print {
          .no-pdf { display: none !important; }
        }
      `}</style>
    </div>
  );
};

export default QuizPage;