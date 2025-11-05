import React, { useState, useRef, useEffect } from 'react';
import { generateQuiz } from '../services/geminiService';
import { supabase } from '../supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import Loader from '../components/Loader';
import type { Quiz, Question, QuestionType } from '../types';

/* ---------------------------- TOPICS DATA ---------------------------- */
const TOPICS_GROUPED = {
  '📚 Grammar: Tenses': [
    'Simple Present Tense',
    'Present Continuous Tense',
    'Simple Past Tense',
    'Past Continuous Tense',
    'Simple Future Tense',
    'Present Perfect Tense',
    'Past Perfect Tense',
  ],
  
  '✏️ Grammar: Parts of Speech': [
    'Nouns (Singular, Plural, Countable, Uncountable)',
    'Pronouns (Subject, Object, Possessive)',
    'Adjectives',
    'Adverbs of Frequency',
    'Adverbs of Manner',
    'Articles (a, an, the)',
    'Prepositions of Place',
    'Prepositions of Time',
    'Conjunctions (and, but, or, because, so)',
  ],
  
  '🔧 Grammar: Sentence Structures': [
    'Comparative & Superlative Adjectives',
    'Modals (can, could, must, should, will, would, may, might)',
    'Question Words (5W+1H)',
    'Question Tags',
    'There is / There are',
    'Passive Voice',
    'Reported Speech',
    'Conditional Sentences',
  ],
  
  '💬 Expressions & Usage': [
    'Like & Likes (Don\'t Like, Doesn\'t Like)',
    'Quantifiers (some, any, much, many, a lot of)',
    'Degree of Comparison',
    'Too & Enough',
  ],
  
  '📖 Vocabulary Themes': [
    'Numbers, Colors, and Shapes',
    'Telling Time, Days, and Months',
    'Family Tree',
    'Food & Drink',
    'Clothes',
    'Hobbies',
    'Jobs & Occupations',
    'Animals (Pets, Wild, Farm)',
    'Body Parts',
    'Places in a City',
    'Things in the Classroom',
    'School Subjects',
    'Transportation',
    'Weather & Seasons',
    'House & Rooms',
    'Sports & Games',
    'Technology',
    'Nature & Environment',
  ],
  
  '📝 Text Types': [
    'Descriptive Text',
    'Narrative Text',
    'Procedure Text',
    'Recount Text',
    'Report Text',
    'News Item',
    'Exposition Text',
    'Review Text',
    'Explanation Text',
  ],
  
  '📄 Functional Texts': [
    'Advertisements',
    'Announcements',
    'Short Messages',
    'Invitations',
    'Greeting Cards',
    'Labels',
    'Captions',
  ],
  
  '🗣️ Conversations': [
    'Greetings & Introductions',
    'Asking & Giving Opinions',
    'Asking for & Giving Directions',
    'Giving Instructions/Commands',
    'Apologizing',
    'Thanking',
    'Making Requests',
    'Expressing Feelings',
    'Making Suggestions',
    'Complimenting',
    'Shopping & Bargaining',
    'Telephoning',
  ],
};

// Flatten all topics for search
const ALL_TOPICS = Object.values(TOPICS_GROUPED).flat();

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
        className="bg-gray-700 border border-gray-600 rounded-md p-2 cursor-pointer text-white hover:bg-gray-600 transition-colors"
        onClick={() => setIsOpen((prev) => !prev)}
      >
        {value || 'Select topic...'}
      </div>

      {isOpen && (
        <div className="absolute mt-1 w-full bg-gray-800 border border-gray-700 rounded-md z-10 max-h-96 overflow-y-auto shadow-xl">
          <div className="sticky top-0 bg-gray-800 p-2 border-b border-gray-600 z-10">
            <input
              type="text"
              placeholder="🔍 Search topic..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-gray-700 text-white p-2 rounded-md outline-none focus:ring-2 focus:ring-brand-secondary"
              autoFocus
            />
          </div>
          
          {searchTerm ? (
            // Show filtered flat list when searching
            filteredOptions.length > 0 ? (
              <div className="p-1">
                {filteredOptions.map((opt, i) => (
                  <div
                    key={i}
                    onClick={() => {
                      const fakeEvent = { target: { name, value: opt } } as unknown as React.ChangeEvent<HTMLInputElement>;
                      onChange(fakeEvent);
                      setIsOpen(false);
                      setSearchTerm('');
                    }}
                    className={`p-2 hover:bg-brand-primary hover:text-white cursor-pointer text-sm rounded transition-colors ${
                      opt === value ? 'bg-brand-primary text-white' : 'text-gray-300'
                    }`}
                  >
                    {opt}
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-4 text-gray-400 text-sm text-center">
                <div className="text-2xl mb-2">🔍</div>
                No topics found for "{searchTerm}"
              </div>
            )
          ) : (
            // Show grouped list when not searching
            Object.entries(TOPICS_GROUPED).map(([category, topics]) => (
              <div key={category} className="border-b border-gray-700 last:border-0">
                <div className="bg-gray-750 px-3 py-2 text-xs font-semibold text-gray-400 sticky top-[52px] z-5">
                  {category}
                </div>
                <div className="p-1">
                  {topics.map((topic, i) => (
                    <div
                      key={i}
                      onClick={() => {
                        const fakeEvent = { target: { name, value: topic } } as unknown as React.ChangeEvent<HTMLInputElement>;
                        onChange(fakeEvent);
                        setIsOpen(false);
                      }}
                      className={`p-2 hover:bg-brand-primary hover:text-white cursor-pointer text-sm rounded transition-colors ${
                        topic === value ? 'bg-brand-primary text-white' : 'text-gray-300'
                      }`}
                    >
                      {topic}
                    </div>
                  ))}
                </div>
              </div>
            ))
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

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    console.log(`📝 Form field changed: ${name} = "${value}"`); // DEBUG
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
      // DEBUG: Log what we're sending
      console.log('🔍 Sending to AI:', {
        title: formData.quizTitle,
        classLevel: formData.classLevel,
        topic: formData.topic,
        count: parseInt(formData.questionCount, 10),
        type: formData.quizCategory,
        description: formData.description, // CHECK IF THIS HAS VALUE
      });

      const quizData = await generateQuiz(
        formData.quizTitle,
        formData.classLevel,
        formData.topic,
        parseInt(formData.questionCount, 10),
        formData.quizCategory,
        formData.description // MAKE SURE THIS IS PASSED
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
      
      {/* Topic Count Badge */}
      <div className="mb-6 text-center">
        <span className="inline-block px-3 py-1 text-xs font-semibold bg-brand-secondary/20 text-brand-secondary rounded-full border border-brand-secondary/30">
          📚 {ALL_TOPICS.length}+ Topics Available
        </span>
      </div>

      {error && <pre className="text-red-400 bg-red-500/10 p-3 rounded-md mb-4 text-sm overflow-auto">{error}</pre>}

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
          options={ALL_TOPICS}
        />
        
        <SelectField
          label="Quiz Type"
          name="quizCategory"
          value={formData.quizCategory}
          onChange={handleInputChange}
          options={['multiple-choice', 'essay', 'fill-in-the-blank', 'mixed']}
        />
        
        <div>
          <label htmlFor="description" className="block text-sm font-medium text-gray-300 mb-1">
            Description (Optional) - Specific Instructions for Quiz Generation
          </label>
          <textarea
            name="description"
            id="description"
            value={formData.description}
            onChange={handleInputChange}
            placeholder="e.g., 'Only questions about colors (red, blue, green). NO numbers or shapes.'"
            rows={3}
            className="mt-1 block w-full bg-gray-700 border-gray-600 rounded-md shadow-sm focus:ring-brand-secondary focus:border-brand-secondary sm:text-sm text-white p-2 resize-none"
          />
          <p className="mt-1 text-xs text-gray-400">
            💡 Tip: Be specific! Use ALL CAPS for emphasis. Example: "ONLY 'a' and 'an', NO 'the'"
          </p>
        </div>
        
        <InputField
          label="Number of Questions"
          name="questionCount"
          type="number"
          value={formData.questionCount}
          onChange={handleInputChange}
        />

        <button
          type="submit"
          className="w-full py-3 px-4 bg-gradient-to-r from-brand-primary to-brand-secondary text-white font-bold rounded-lg hover:shadow-lg hover:shadow-brand-secondary/30 transition-all transform hover:scale-[1.02] shadow-md"
        >
          ✨ Generate & Save Quiz
        </button>
      </form>

      {/* Quiz Preview */}
      {generatedQuiz && (
        <div className="mt-8 bg-gradient-to-br from-green-900/20 to-blue-900/20 p-6 rounded-lg border border-green-500/30 text-white">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-2xl">✅</span>
            <h2 className="text-xl font-bold">Quiz Generated Successfully!</h2>
          </div>
          
          <div className="bg-gray-800/50 p-4 rounded-lg mb-4">
            <h3 className="font-semibold text-lg text-brand-secondary mb-2">{generatedQuiz.title}</h3>
            <p className="text-sm text-gray-400">
              {generatedQuiz.questions.length} questions • {formData.quizCategory}
            </p>
          </div>

          <div className="space-y-3 max-h-96 overflow-y-auto">
            {generatedQuiz.questions.map((q, i) => (
              <div key={i} className="bg-gray-800/50 p-4 rounded-lg border border-gray-700">
                <p className="font-medium text-gray-200 mb-2">
                  {i + 1}. {q.question_text}
                </p>
                {q.options ? (
                  <ul className="ml-6 space-y-1 text-sm text-gray-400">
                    {q.options.map((opt, j) => (
                      <li key={j} className="flex items-center gap-2">
                        <span className="text-brand-secondary">•</span>
                        {opt}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-green-400 ml-4">
                    ✓ Answer: {q.correct_answer}
                  </p>
                )}
              </div>
            ))}
          </div>

          <div className="mt-4 p-3 bg-blue-500/10 rounded-lg border border-blue-500/30">
            <p className="text-sm text-blue-300">
              💡 Quiz saved! Go to "My Quizzes" to copy the link and share with students.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default CreateQuizPage;