import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';

const HomePage: React.FC = () => {
  const [link, setLink] = useState('');
  const navigate = useNavigate();

  const handleLinkSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // Try parsing as a full URL first
      const url = new URL(link);
      const path = url.hash.substring(1); // Remove the '#'
      if (path.startsWith('/quiz/')) {
        navigate(path);
      } else {
        alert('Invalid quiz link format.');
      }
    } catch (error) {
      // If not a full URL, check if it's a valid path/hash
      let path = link.trim();
      if (path.startsWith('#')) {
          path = path.substring(1);
      }
      
      if (path.startsWith('/quiz/')) {
        navigate(path);
      } else {
        alert('Please paste a valid quiz link.');
      }
    }
  };

  return (
    <div className="flex items-center justify-center py-12">
      <div className="w-full max-w-xl p-8 space-y-8 bg-gray-800 rounded-2xl shadow-2xl text-center">
        <h1 className="text-4xl font-extrabold text-white">Welcome, Student!</h1>
        <p className="mt-2 text-gray-400">Have a quiz link from your teacher? Paste it below to begin.</p>
        <form onSubmit={handleLinkSubmit} className="flex flex-col sm:flex-row gap-4">
          <input
            type="text"
            value={link}
            onChange={(e) => setLink(e.target.value)}
            placeholder="Paste your quiz link here..."
            className="flex-grow bg-gray-700 border-gray-600 rounded-md shadow-sm focus:ring-brand-secondary focus:border-brand-secondary sm:text-sm text-white p-3"
            aria-label="Quiz Link Input"
          />
          <button
            type="submit"
            className="px-6 py-3 font-medium text-white bg-brand-primary rounded-lg hover:bg-brand-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-brand-secondary transition-all duration-300 ease-in-out transform hover:scale-105"
          >
            Start Quiz
          </button>
        </form>
        <div className="mt-6 pt-6 border-t border-gray-700">
            <Link to="/login" className="text-sm text-gray-400 hover:text-brand-secondary underline">
                Are you a teacher? Log in here.
            </Link>
        </div>
      </div>
    </div>
  );
};

export default HomePage;
