import { useState } from 'react';
import { motion } from 'motion/react';
import VisualExtractor from './components/VisualExtractor';
import VisualSuite from './components/VisualSuite';
import VisualFitLay from './components/VisualFitLay';


export default function App() {
  const [activeTab, setActiveTab] = useState('visualExtractor');

  return (
    <div className="min-h-screen bg-black text-white font-sans">
      <header className="container mx-auto px-4 py-16 flex justify-center">
        <h1 className="text-4xl md:text-6xl font-display text-accent drop-shadow-[0_0_25px_rgba(245,208,97,0.4)]">
          Bitech Visual
        </h1>
      </header>
      <nav className="container mx-auto px-4 py-4 border-b border-white/5 overflow-x-auto">
        <div className="flex justify-center space-x-8 md:space-x-12 min-w-max px-4">
          <button
            className={`px-8 md:px-12 py-3 rounded-full text-[10px] uppercase tracking-[0.3em] font-black transition-all duration-700 relative group
              ${activeTab === 'visualExtractor' ? 'text-accent' : 'text-gray-600 hover:text-gray-400'}`}
            onClick={() => setActiveTab('visualExtractor')}
          >
            Extractor
            {activeTab === 'visualExtractor' && (
              <motion.div 
                layoutId="activeTab"
                className="absolute inset-0 bg-accent/5 rounded-full border border-accent/20 shadow-[0_0_20px_rgba(245,208,97,0.15)]"
              />
            )}
          </button>
          <button
            className={`px-8 md:px-12 py-3 rounded-full text-[10px] uppercase tracking-[0.3em] font-black transition-all duration-700 relative group
              ${activeTab === 'visualFitLay' ? 'text-accent' : 'text-gray-600 hover:text-gray-400'}`}
            onClick={() => setActiveTab('visualFitLay')}
          >
            FitLay
            {activeTab === 'visualFitLay' && (
              <motion.div 
                layoutId="activeTab"
                className="absolute inset-0 bg-accent/5 rounded-full border border-accent/20 shadow-[0_0_20px_rgba(245,208,97,0.15)]"
              />
            )}
          </button>
          <button
            className={`px-8 md:px-12 py-3 rounded-full text-[10px] uppercase tracking-[0.3em] font-black transition-all duration-700 relative group
              ${activeTab === 'visualSuite' ? 'text-accent' : 'text-gray-600 hover:text-gray-400'}`}
            onClick={() => setActiveTab('visualSuite')}
          >
            Suite
            {activeTab === 'visualSuite' && (
              <motion.div 
                layoutId="activeTab"
                className="absolute inset-0 bg-accent/5 rounded-full border border-accent/20 shadow-[0_0_20px_rgba(245,208,97,0.15)]"
              />
            )}
          </button>
        </div>
      </nav>
      <main className="container mx-auto px-4 py-8">
        {activeTab === 'visualExtractor' && (
          <motion.div
            key="visualExtractor"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
          >
            <h2 className="text-[10px] uppercase tracking-[0.5em] font-black mb-12 text-accent/40 text-center">Neural Extraction Protocol</h2>
            <VisualExtractor />
          </motion.div>
        )}
        {activeTab === 'visualFitLay' && (
          <motion.div
            key="visualFitLay"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
          >
            <h2 className="text-[10px] uppercase tracking-[0.5em] font-black mb-12 text-accent/40 text-center">Fashion Decomposition Engine</h2>
            <VisualFitLay />
          </motion.div>
        )}
        {activeTab === 'visualSuite' && (
          <motion.div
            key="visualSuite"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
          >
            <h2 className="text-[10px] uppercase tracking-[0.5em] font-black mb-12 text-accent/40 text-center">Creative Synthesis Engine</h2>
            <VisualSuite />
          </motion.div>
        )}
      </main>
    </div>
  );
}
