import React, { useState, useCallback, useRef } from 'react';
import { motion } from 'motion/react';
import { UploadCloud, Image as ImageIcon, Sparkles, XCircle, Loader2, Download } from 'lucide-react';
import { GoogleGenAI, GenerateContentResponse } from '@google/genai';

interface ImagePart {
  inlineData: {
    mimeType: string;
    data: string;
  };
}

enum AspectRatio {
  ORIGINAL = 'Original',
  PORTRAIT = '9:16',
  LANDSCAPE = '16:9',
  SQUARE = '1:1',
  WIDE = '21:9',
}

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

export default function VisualSuite() {
  const [prompt, setPrompt] = useState('bersihkan gambar');
  const [negativePrompt, setNegativePrompt] = useState('');
  const [referenceImages, setReferenceImages] = useState<File[]>([]);
  const [referenceImageUrls, setReferenceImageUrls] = useState<string[]>([]);
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>(AspectRatio.SQUARE);
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null);
  const [imageToEdit, setImageToEdit] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<React.ReactNode | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (files: FileList | null) => {
    if (files) {
      const newFiles = Array.from(files).filter(file =>
        file.size <= MAX_FILE_SIZE && ['image/jpeg', 'image/png', 'image/webp'].includes(file.type)
      );

      if (newFiles.length + referenceImages.length > 2) {
        setError('You can upload a maximum of 2 reference images.');
        return;
      }

      setReferenceImages(prev => [...prev, ...newFiles]);
      setReferenceImageUrls(prev => [...prev, ...newFiles.map(file => URL.createObjectURL(file))]);
      setError(null);
    }
  };

  const handleDrop = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (event.dataTransfer.files) {
      handleFileChange(event.dataTransfer.files);
    }
  }, [referenceImages]);

  const handleDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
  }, []);

  const handleRemoveReferenceImage = (index: number) => {
    setReferenceImages(prev => prev.filter((_, i) => i !== index));
    setReferenceImageUrls(prev => prev.filter((_, i) => i !== index));
  };

  const handleGenerateImage = async () => {
    if (!prompt && referenceImages.length === 0) {
      setError('Please provide a prompt or at least one reference image.');
      return;
    }

    setLoading(true);
    setError(null);
    setGeneratedImageUrl(null);

    try {
      // Create GoogleGenAI instance right before API call to ensure latest API key is used
      const parts: (ImagePart | { text: string })[] = [];

      for (const file of referenceImages) {
        const base64Data = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
          reader.readAsDataURL(file);
        });
        parts.push({
          inlineData: {
            mimeType: file.type,
            data: base64Data,
          },
        });
      }

      let fullPrompt = prompt;
      if (negativePrompt) {
        fullPrompt += ` --exclude ${negativePrompt}`;
      }
      parts.push({ text: fullPrompt });

      const requestConfig: any = {
        model: 'gemini-2.5-flash-image', // Default model, can be upgraded based on user selection if implemented
        contents: { parts: parts },
        config: {
          imageConfig: {
            ...(aspectRatio !== AspectRatio.ORIGINAL && { aspectRatio: aspectRatio }),
          },
        },
      };

      const apiKey = (process.env as any).API_KEY || process.env.GEMINI_API_KEY;
      const ai = new GoogleGenAI({ apiKey: apiKey as string });

      // Check for API key if using a paid model (e.g., gemini-3-pro-image-preview)
      // For now, we assume 'gemini-3-pro-image-preview' is the only paid model that needs this check here.
      if (requestConfig.model === 'gemini-3-pro-image-preview') {
        if (!(await window.aistudio.hasSelectedApiKey())) {
          setError(
            <div className="p-4 bg-accent/10 border border-accent/20 rounded-xl">
              <p className="text-sm text-accent mb-3">
                Please select an API key for paid Gemini models (e.g., Gemini 3 Pro Image Preview).
              </p>
              <button
                onClick={async () => {
                  await window.aistudio.openSelectKey();
                  setError(null); // Clear error after user attempts to select key
                }}
                className="px-4 py-2 bg-accent text-black text-[10px] uppercase tracking-widest font-black rounded-lg"
              >
                Select API Key
              </button>
              <a
                href="https://ai.google.dev/gemini-api/docs/billing"
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent/40 hover:underline text-[9px] mt-2 block uppercase tracking-widest"
              >
                Learn more about billing for Gemini API
              </a>
            </div>
          );
          setLoading(false);
          return;
        }
      }

      // Upgrade model to gemini-3-pro-image-preview if higher quality or specific features are requested
      // For now, we'll assume gemini-2.5-flash-image is sufficient unless explicitly changed by user.
      // If a model selection dropdown is added, this logic would be dynamic.
      // For example, if user selects 'High Quality' option:
      // requestConfig.model = 'gemini-3-pro-image-preview';

      const response: GenerateContentResponse = await ai.models.generateContent(requestConfig);

      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
          const mimeType = part.inlineData.mimeType;
          const base64Data = part.inlineData.data;
          const imageUrl = `data:${mimeType};base64,${base64Data}`;
          setGeneratedImageUrl(imageUrl);

          // Convert base64 to File object for editing
          const response = await fetch(imageUrl);
          const blob = await response.blob();
          const file = new File([blob], `generated_image_${Date.now()}.${mimeType.split('/')[1]}`, { type: mimeType });
          setImageToEdit(file);
          break;
        }
      }
    } catch (err: any) {
      console.error('Gemini API Error:', err);
      const errorMessage = err.message || '';
      if (errorMessage.includes('403') || errorMessage.includes('permission') || errorMessage.includes('Requested entity was not found')) {
        setError(
          <div className="p-4 bg-accent/10 border border-accent/20 rounded-xl">
            <p className="text-sm text-accent mb-3">
              The selected API key might be invalid or not configured for this model. Please select a valid API key from a paid project.
            </p>
            <button
              onClick={async () => {
                await window.aistudio.openSelectKey();
                setError(null);
              }}
              className="px-4 py-2 bg-accent text-black text-[10px] uppercase tracking-widest font-black rounded-lg"
            >
              Select API Key
            </button>
            <a
              href="https://ai.google.dev/gemini-api/docs/billing"
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent/40 hover:underline text-[9px] mt-2 block uppercase tracking-widest"
            >
              Learn more about billing for Gemini API
            </a>
          </div>
        );
      } else {
        setError(`Failed to generate image: ${err.message || 'Unknown error'}. Please check your API key and try again.`);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadImage = () => {
    if (generatedImageUrl) {
      const link = document.createElement('a');
      link.href = generatedImageUrl;
      link.download = `bitech_visual_${Date.now()}.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const handleEditImage = () => {
    if (imageToEdit) {
      setReferenceImages([imageToEdit]);
      setReferenceImageUrls([URL.createObjectURL(imageToEdit)]);
      setPrompt('');
      setNegativePrompt('');
      setGeneratedImageUrl(null);
      setImageToEdit(null);
      setError(null);
    }
  };

  return (
    <div className="flex flex-col lg:flex-row gap-10 relative">
      {/* Left Panel: Controls */}
      <div className="lg:w-1/3 p-8 glass-panel rounded-3xl shadow-2xl">
        <div className="flex items-center justify-between mb-8">
          <h3 className="text-[10px] uppercase tracking-[0.3em] font-black text-accent/60">Synthesis Parameters</h3>
        </div>

        <h3 className="text-[10px] uppercase tracking-[0.3em] font-black mb-4 text-accent/60">Reference Assets</h3>
        <div
          className="border border-dashed border-white/10 rounded-2xl p-8 text-center cursor-pointer hover:border-accent/50 transition-all duration-500 bg-white/[0.01] group relative mb-4"
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onClick={() => fileInputRef.current?.click()}
        >
          <div className="flex flex-col items-center justify-center">
            <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mb-4 group-hover:bg-accent/10 transition-colors">
              <UploadCloud size={24} className="text-gray-700 group-hover:text-accent transition-colors" />
            </div>
            <p className="text-gray-500 text-[10px] uppercase tracking-widest font-bold">Upload Reference</p>
          </div>
          <input
            type="file"
            ref={fileInputRef}
            className="hidden"
            onChange={(e) => e.target.files && handleFileChange(e.target.files)}
            accept=".jpg,.jpeg,.png,.webp"
            multiple
          />
        </div>

        {referenceImageUrls.length > 0 && (
          <div className="grid grid-cols-2 gap-4 mb-8">
            {referenceImageUrls.map((url, index) => (
              <div key={index} className="relative group">
                <img src={url} alt={`Reference ${index + 1}`} className="w-full h-32 object-cover rounded-2xl border border-white/10 shadow-2xl" referrerPolicy="no-referrer" />
                <button
                  onClick={(e) => { 
                    e.preventDefault();
                    e.stopPropagation(); 
                    handleRemoveReferenceImage(index); 
                  }}
                  className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1.5 hover:bg-red-600 transition-all shadow-lg z-30 flex items-center justify-center"
                  title="Remove image"
                >
                  <XCircle size={14} />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="mb-8">
          <label htmlFor="prompt" className="block text-[10px] uppercase tracking-[0.3em] font-black text-white/20 mb-3">Neural Prompt</label>
          <textarea
            id="prompt"
            className="w-full p-5 rounded-2xl bg-white/[0.01] border border-white/5 text-gray-300 focus:ring-accent/30 focus:border-accent/30 min-h-[140px] text-sm leading-relaxed transition-all placeholder:text-gray-800 outline-none"
            placeholder="Describe the visual concept..."
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
          ></textarea>
        </div>

        <div className="mb-10">
          <label htmlFor="negativePrompt" className="block text-[10px] uppercase tracking-[0.3em] font-black text-white/20 mb-3">Negative Constraints</label>
          <input
            type="text"
            id="negativePrompt"
            className="w-full p-4 rounded-2xl bg-white/[0.01] border border-white/5 text-gray-300 focus:ring-accent/30 focus:border-accent/30 text-sm transition-all placeholder:text-gray-800 outline-none"
            placeholder="Elements to exclude..."
            value={negativePrompt}
            onChange={(e) => setNegativePrompt(e.target.value)}
          />
        </div>

        <div className="mb-10">
          <label htmlFor="aspectRatio" className="block text-[10px] uppercase tracking-[0.3em] font-black text-white/20 mb-3">Frame Configuration</label>
          <select
            id="aspectRatio"
            className="w-full p-4 rounded-2xl bg-white/[0.01] border border-white/5 text-gray-300 focus:ring-accent/30 focus:border-accent/30 text-sm transition-all appearance-none cursor-pointer"
            value={aspectRatio}
            onChange={(e) => setAspectRatio(e.target.value as AspectRatio)}
          >
            {Object.values(AspectRatio).map((ratio) => (
              <option key={ratio} value={ratio}>
                {ratio.replace(':', ' : ')}
              </option>
            ))}
          </select>
        </div>

        <motion.button
          layout
          className="w-full mt-12 py-5 bg-accent text-black text-[10px] uppercase tracking-[0.3em] font-black rounded-2xl shadow-[0_10px_40px_rgba(245,208,97,0.2)] hover:shadow-[0_15px_50px_rgba(245,208,97,0.4)] transition-all duration-500 flex items-center justify-center gap-3 disabled:opacity-10 disabled:grayscale"
          onClick={handleGenerateImage}
          disabled={loading || (!prompt && referenceImages.length === 0)}
          whileHover={{ scale: 1.02, y: -2 }}
          whileTap={{ scale: 0.98 }}
        >
          {loading ? <Loader2 size={18} className="animate-spin" /> : 'Initiate Synthesis'}
        </motion.button>
      </div>

      {/* Right Panel: Generated Image */}
      <div className="lg:w-2/3 p-8 glass-panel rounded-3xl shadow-2xl flex flex-col items-center justify-center">
        <div className="w-full flex items-center justify-between mb-8">
          <h3 className="text-[10px] uppercase tracking-[0.3em] font-black text-accent/60">Output Canvas</h3>
          {generatedImageUrl && (
            <div className="flex gap-3">
              <button
                className="flex items-center gap-2 px-4 py-2 bg-accent/10 hover:bg-accent/20 text-accent rounded-xl transition-all border border-accent/20 group"
                onClick={handleDownloadImage}
              >
                <Download size={14} className="group-hover:translate-y-0.5 transition-transform" />
                <span className="text-[9px] uppercase tracking-widest font-black">Download Image</span>
              </button>
              <button
                className="p-2.5 bg-white/5 hover:bg-accent/10 text-gray-600 hover:text-accent rounded-xl transition-all border border-white/5"
                onClick={handleEditImage}
                title="Use as Reference"
              >
                <Sparkles size={14} />
              </button>
            </div>
          )}
        </div>
        <div className="flex-grow w-full flex items-center justify-center bg-black/40 border border-white/5 rounded-2xl min-h-[500px] relative overflow-hidden">
          {loading && (
            <div className="flex flex-col items-center justify-center text-gray-600">
              <div className="relative mb-8">
                <Loader2 size={64} className="animate-spin text-accent/10" />
                <Loader2 size={64} className="animate-spin text-accent absolute top-0 left-0 [animation-delay:-0.5s]" />
              </div>
              <p className="text-[10px] uppercase tracking-[0.5em] font-black text-accent/40">Synthesizing Neural Pixels</p>
            </div>
          )}
          {error && !loading && (
            <div className="flex flex-col items-center justify-center text-red-500">
              <XCircle size={48} className="mb-4" />
              <div className="text-center px-6">{error}</div>
            </div>
          )}
          {generatedImageUrl && !loading && (
            <img src={generatedImageUrl} alt="Generated" className="max-w-full max-h-full object-contain rounded-xl shadow-2xl" referrerPolicy="no-referrer" />
          )}
          {!loading && !error && !generatedImageUrl && (
            <div className="flex flex-col items-center justify-center text-gray-700">
              <div className="w-12 h-12 rounded-full border border-white/5 flex items-center justify-center mb-6">
                <Sparkles size={20} className="opacity-20" />
              </div>
              <p className="text-[10px] uppercase tracking-[0.2em] font-bold opacity-40">Ready for Synthesis</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
