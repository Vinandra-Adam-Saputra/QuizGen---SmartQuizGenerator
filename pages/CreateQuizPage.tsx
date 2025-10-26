import React, { useState, useRef, useEffect } from 'react';
import { generateQuiz } from '../services/geminiService';
import { supabase } from '../supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import Loader from '../components/Loader';
import type { Quiz, Question, QuestionType } from '../types';

/* ---------------------------- INPUT FIELD ---------------------------- */
type InputFieldProps = {
  label: string;
  name: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;
  type?: string;
  placeholder?: string;
  required?: boolean;
};

const InputField: React.FC<InputFieldProps> = ({
  label,
  name,
  value,
  onChange,
  type = 'text',
  placeholder,
  required = true,
}) => (
  <div>
    <label htmlFor={name} className="block text-sm font-medium text-gray-300">
      {label}
    </label>
    <input
      type={type}
      name={name}
      id={name}
      value={value}
      onChange={onChange as React.ChangeEventHandler<HTMLInputElement>}
      required={required}
      placeholder={placeholder}
      className="mt-1 block w-full bg-gray-700 border-gray-600 rounded-md shadow-sm focus:ring-brand-secondary focus:border-brand-secondary sm:text-sm text-white p-2"
      autoComplete="off"
    />
  </div>
);

/* ---------------------------- SELECT FIELD ---------------------------- */
const SelectField: React.FC<{
  label: string;
  name: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement>) => void;
  options?: string[];
  searchable?: boolean;
}> = ({ label, name, value, onChange, options = [], searchable = false }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const filteredOptions = options.filter((opt) =>
    opt.toLowerCase().includes(searchTerm.toLowerCase())
  );

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!searchable) {
    return (
      <div>
        <label htmlFor={name} className="block text-sm font-medium text-gray-300">
          {label}
        </label>
        <select
          id={name}
          name={name}
          value={value}
          onChange={onChange as any}
          className="mt-1 block w-full bg-gray-700 border-gray-600 rounded-md shadow-sm focus:ring-brand-secondary focus:border-brand-secondary sm:text-sm text-white p-2"
        >
          {options.map((opt, i) => (
            <option key={i}>{opt}</option>
          ))}
        </select>
      </div>
    );
  }

  return (
    <div ref={dropdownRef} className="relative">
      <label className="block text-sm font-medium text-gray-300 mb-1">{label}</label>
      <div
        className="bg-gray-700 border border-gray-600 rounded-md p-2 cursor-pointer text-white"
        onClick={() => setIsOpen((prev) => !prev)}
      >
        {value || 'Select topic...'}
      </div>

      {isOpen && (
        <div className="absolute mt-1 w-full bg-gray-800 border border-gray-700 rounded-md z-10 max-h-60 overflow-y-auto shadow-lg">
          <input
            type="text"
            placeholder="Search topic..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-gray-700 text-white p-2 border-b border-gray-600 outline-none"
          />
          {filteredOptions.length > 0 ? (
            filteredOptions.map((opt, i) => (
              <div
                key={i}
                onClick={() => {
                  const fakeEvent = { target: { name, value: opt } } as unknown as React.ChangeEvent<HTMLInputElement>;
                  onChange(fakeEvent);
                  setIsOpen(false);
                  setSearchTerm('');
                }}
                className={`p-2 hover:bg-gray-600 cursor-pointer text-sm ${
                  opt === value ? 'bg-gray-600' : ''
                }`}
              >
                {opt}
              </div>
            ))
          ) : (
            <div className="p-2 text-gray-400 text-sm text-center">No topics found</div>
          )}
        </div>
      )}
    </div>
  );
};

/* ------------------------- CREATE QUIZ PAGE ------------------------- */
const CreateQuizPage: React.FC = () => {
  const [formData, setFormData] = useState({
    quizTitle: 'Adjectives Exercise 1',
    classLevel: 'Kelas 4',
    topic: 'Adjectives',
    questionCount: '5',
    quizCategory: 'multiple-choice' as QuestionType | 'mixed',
    description: '',
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generatedQuiz, setGeneratedQuiz] = useState<Quiz | null>(null);
  const { user } = useAuth();

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user) return setError('You must be logged in to create a quiz.');
    if (!formData.quizTitle.trim()) return setError('Please enter a Quiz Title.');

    setLoading(true);
    setError(null);
    setGeneratedQuiz(null);

    try {
      const quizData = await generateQuiz(
        formData.quizTitle,
        formData.classLevel,
        formData.topic,
        parseInt(formData.questionCount, 10),
        formData.quizCategory
      );

      const { data, error: insertError } = await supabase
        .from('quizzes')
        .insert({
          quiz_data: quizData,
          user_id: user.id,
          description: formData.description,
          type: formData.quizCategory,
        })
        .select()
        .single();

      if (insertError) throw insertError;

      setGeneratedQuiz({ ...quizData, id: data.id });
    } catch (err: any) {
      console.error('Quiz creation failed:', err);
      setError(`Error: ${err.message || 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  /* ---------------------------- FORM UI ---------------------------- */
  if (loading) return <Loader message="Generating your quiz with AI..." />;

  return (
    <div className="max-w-2xl mx-auto p-8 bg-gray-800 rounded-xl shadow-lg">
      <h1 className="text-3xl font-bold mb-6 text-center text-white">Create a New Quiz</h1>

      {error && <pre className="text-red-400 bg-red-500/10 p-3 rounded-md mb-4">{error}</pre>}

      <form onSubmit={handleSubmit} className="space-y-6">
        <InputField label="Quiz Title" name="quizTitle" value={formData.quizTitle} onChange={handleInputChange} />
        <SelectField
          label="Class Level"
          name="classLevel"
          value={formData.classLevel}
          onChange={handleInputChange}
          options={[
            'Kelas 1', 'Kelas 2', 'Kelas 3', 'Kelas 4', 'Kelas 5', 'Kelas 6',
            'Kelas 7 (SMP)', 'Kelas 8 (SMP)', 'Kelas 9 (SMP)'
          ]}
        />
        <SelectField
          label="Topic"
          name="topic"
          value={formData.topic}
          onChange={handleInputChange}
          searchable
          options={[
            'Adjectives', 'Articles (a, an, the)', 'Nouns (Singular, Plural, Countable, Uncountable)',
            'Pronouns (Subject, Object, Possessive)', 'Comparative & Superlative Adjectives',
            'Conjunctions (and, but, or, because, so)', 'Modals (can, must, should, will)',
            'Question Words (5W+1H)', 'Simple Present Tense', 'Present Continuous Tense',
            'Simple Past Tense', 'Past Continuous Tense', 'Simple Future Tense',
            'Present Perfect Tense', 'Numbers, Colors, and Shapes', 'Telling Time, Days, and Months',
            'Family Tree', 'Food & Drink', 'Clothes', 'Hobbies', 'Jobs & Occupations',
            'Animals (Pets, Wild, Farm)', 'Body Parts', 'Places in a City', 'Things in the Classroom',
            'School Subjects', 'Descriptive Text', 'Narrative Text', 'Procedure Text', 'Recount Text',
            'Report Text', 'News Item', 'Exposition Text', 'Advertisements', 'Announcements',
            'Short Messages', 'Greetings & Introductions', 'Asking & Giving Opinions',
            'Asking for & Giving Directions', 'Giving Instructions/Commands', 'Invitations', 'Prepositions of Place'
          ]}
        />
        <SelectField
          label="Quiz Type"
          name="quizCategory"
          value={formData.quizCategory}
          onChange={handleInputChange}
          options={['multiple-choice', 'essay', 'fill-in-the-blank', 'mixed']}
        />
        <InputField
          label="Description (Optional)"
          name="description"
          value={formData.description}
          onChange={handleInputChange}
          placeholder="e.g. Only about colors questions, not numbers or shapes."
          required={false}
        />
        <InputField
          label="Number of Questions"
          name="questionCount"
          type="number"
          value={formData.questionCount}
          onChange={handleInputChange}
        />

        <button
          type="submit"
          className="w-full py-3 px-4 bg-brand-primary text-white font-bold rounded-lg hover:bg-brand-dark transition-transform transform hover:scale-105 shadow-md"
        >
          Generate & Save Quiz
        </button>
      </form>

      {/* ✅ Quiz Preview muncul di bawah form */}
      {generatedQuiz && (
        <div className="mt-8 bg-gray-700 p-4 rounded-lg text-white">
          <h2 className="text-xl font-semibold mb-2">Preview: {generatedQuiz.title}</h2>
          {generatedQuiz.questions.map((q, i) => (
            <div key={i} className="border-b border-gray-600 py-2">
              <p className="font-medium">{i + 1}. {q.question_text}</p>
              {q.options ? (
                <ul className="list-disc ml-6">
                  {q.options.map((opt, j) => (
                    <li key={j}>{opt}</li>
                  ))}
                </ul>
              ) : (
                <p className="italic text-gray-300">Answer: {q.correct_answer}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default CreateQuizPage;
