import React, { useState, useCallback, useRef } from 'react';
import { motion } from 'motion/react';
import { UploadCloud, Image as ImageIcon, FileText, Search, Code, Copy, XCircle, Loader2, Check } from 'lucide-react';
import { GoogleGenAI, GenerateContentResponse, Type } from '@google/genai';

interface ImagePart {
  inlineData: {
    mimeType: string;
    data: string;
  };
}

enum AnalysisMode {
  VISUAL_DNA = 'visualDNA',
  TEXT_EXTRACTION = 'textExtraction',
  OBJECT_DETECTION = 'objectDetection',
}

enum TargetModel {
  REGULAR = 'Regular Prompt',
  BANANA_PRO = 'Banana Pro',
  FLUX = 'Flux',
  SEEDREAM = 'Seedream',
  DALL_E = 'Dall-E',
  MIDJOURNEY = 'Midjourney',
  STABLE_DIFFUSION = 'Stable Diffusion',
}

enum ModelType {
  FLASH = 'gemini-3-flash-preview',
  PRO = 'gemini-3.1-pro-preview',
}

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

const CopyButton = ({ text, title }: { text: string; title?: string }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleCopy}
      className={`flex items-center gap-2 px-2 py-1 rounded-lg transition-all border ${
        copied 
          ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-500' 
          : 'bg-white/5 border-white/10 text-gray-400 hover:border-accent/40 hover:text-accent hover:bg-accent/5'
      }`}
      title={title || 'Copy to clipboard'}
    >
      {copied ? <Check size={10} /> : <Copy size={10} />}
      <span className="text-[8px] uppercase tracking-widest font-bold">{copied ? 'Copied' : 'Copy'}</span>
    </button>
  );
};

export default function VisualExtractor() {
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [analysisMode, setAnalysisMode] = useState<AnalysisMode | null>(null);
  const [modelType, setModelType] = useState<ModelType>(ModelType.FLASH);
  const [targetModel, setTargetModel] = useState<TargetModel>(TargetModel.REGULAR);
  const [result, setResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<React.ReactNode | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (file: File) => {
    if (file && file.size <= MAX_FILE_SIZE && ['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setImageFile(file);
      setImagePreviewUrl(URL.createObjectURL(file));
      setError(null);
      setResult(null);
    } else {
      setError('Invalid file: Max 5MB, JPG, PNG, or WEBP only.');
    }
  };

  const handleDrop = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (event.dataTransfer.files && event.dataTransfer.files[0]) {
      handleFileChange(event.dataTransfer.files[0]);
    }
  }, []);

  const handleDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
  }, []);

  const handleRemoveImage = () => {
    setImageFile(null);
    setImagePreviewUrl(null);
    setResult(null);
    setError(null);
    setAnalysisMode(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleAnalyze = async () => {
    if (!imageFile) {
      setError('Please upload an image first.');
      return;
    }
    if (!analysisMode) {
      setError('Please select an analysis mode.');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const base64Data = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
        reader.readAsDataURL(imageFile);
      });

      const imagePart: ImagePart = {
        inlineData: {
          mimeType: imageFile.type,
          data: base64Data,
        },
      };

      const apiKey = (process.env as any).API_KEY || process.env.GEMINI_API_KEY;
      const ai = new GoogleGenAI({ apiKey: apiKey as string });

      if (modelType === ModelType.PRO) {
        if (!(await window.aistudio.hasSelectedApiKey())) {
          setError(
            <div className="p-4 bg-accent/10 border border-accent/20 rounded-xl">
              <p className="text-sm text-accent mb-3">
                Analisis tingkat lanjut (Pro) memerlukan API Key berbayar.
              </p>
              <button
                onClick={async () => {
                  await window.aistudio.openSelectKey();
                  setError(null);
                }}
                className="px-4 py-2 bg-accent text-black text-[10px] uppercase tracking-widest font-black rounded-lg"
              >
                Pilih API Key
              </button>
            </div>
          );
          setLoading(false);
          return;
        }
      }
      let prompt = '';
      let responseMimeType: string | undefined = undefined;
      let responseSchema: any = undefined;

      switch (analysisMode) {
        case AnalysisMode.VISUAL_DNA:
          const isRegular = targetModel === TargetModel.REGULAR;
          prompt = `AI bertindak sebagai pengamat ahli. Lakukan analisis DNA visual dari gambar ini dalam Bahasa Indonesia.
PENTING: JANGAN memberikan kalimat pembuka atau penutup seperti "Berikut adalah analisis...". Langsung mulai dari header "----- ANALISA DNA -----".

Gunakan struktur output yang sangat spesifik seperti di bawah ini:

----- ANALISA DNA -----
SUBJECT: [Deskripsikan subjek utama secara detail. Sebutkan etnis, Usia, fitur detil wajah, detil mata, detil bibir].
HAIR STYLE: [Deskripsikan dengan detail gaya rambut pada subject.]
OUTFIT: [Deskripsikan Model pakaian dan bahan kain dari pakaian yang digunakan, termasuk aksesoris yang digunakan].
PHYSIQUE: [Deskripsikan Tinggi badan secara spesifik dengan skala cm, Frame/Build, Body Type, Shoulder, Bust Shape & Breast Size harus spesifik berupa angka, Waist, Hip, Thigh, Collarbone].
POSE: [Jelaskan posisi tubuh, gestur tangan, dan arah pandangan, Ekspresi Wajah.]
SETTING: [Deskripsikan latar belakang, setting tempat, objek di sekitar, dan suasana lingkungan.]
LIGHTING: [Jelaskan jenis pencahayaan (natural/artificial), arah cahaya, bayangan, dan mood yang dihasilkan.]
COMPOSITION: [Jelaskan tipe shot (close-up, wide, etc), sudut kamera, dan depth of field.]
ART STYLE: [Sebutkan gaya visual (misal: Hyper-realistic, Cinematic, Digital Painting, 8k resolution).]

----- FINAL PROMPT -----
${isRegular 
  ? '[Gabungkan narasi dari hasil semua elemen diatas menjadi satu paragraf utuh yang detail dan natural dalam bahasa inggris yang disebut C-DNA. Tampilkan C-DNA ini sebagai output akhir di bagian ini.]' 
  : `[Gabungkan narasi dari hasil semua elemen diatas menjadi satu paragraf utuh yang detail dan natural dalam bahasa inggris yang disebut C-DNA. JANGAN TAMPILKAN C-DNA. Gunakan C-DNA tersebut sebagai dasar untuk membuat Formula Smart Prompt yang dioptimalkan khusus untuk model: ${targetModel}. Tampilkan HANYA Formula Smart Prompt tersebut di bagian ini, diakhiri dengan tag kualitas seperti '8k, masterpiece, ultra-detailed'.]`
}

----- Tips Konsistensi -----
[Berikan 2-3 tips teknis secara random untuk mempertahankan konsistensi wajah dan lekuk tubuh saat menggunakan model ${targetModel}.]`;
          break;
        case AnalysisMode.TEXT_EXTRACTION:
          prompt = 'Menyalin seluruh teks yang terlihat di dalam gambar (OCR). Berikan output teks mentah.';
          break;
        case AnalysisMode.OBJECT_DETECTION:
          prompt = 'Identifikasi berbagai benda fisik di dalam gambar dan mendaftar posisinya (misal: "kiri atas", "tengah", "latar belakang").';
          break;

        default:
          prompt = 'Analyze the image.';
      }

      const requestConfig: any = {
        model: modelType,
        contents: { parts: [imagePart, { text: prompt }] },
        config: {
          temperature: 0.4,
          topP: 0.8,
          topK: 40,
        },
      };

      if (responseMimeType) {
        requestConfig.config.responseMimeType = responseMimeType;
      }
      if (responseSchema) {
        requestConfig.config.responseSchema = responseSchema;
      }

      const response: GenerateContentResponse = await ai.models.generateContent(requestConfig);
      const textResult = response.text;
      setResult(textResult);

    } catch (err: any) {
      console.error('Gemini API Error:', err);
      const errorMessage = err.message || '';
      if (errorMessage.includes('403') || errorMessage.includes('permission') || errorMessage.includes('Requested entity was not found')) {
        setError(
          <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-center">
            <p className="text-sm text-red-500 mb-3 font-bold">AKSES DITOLAK (403)</p>
            <p className="text-xs text-red-400 mb-4 leading-relaxed">
              Kunci API Anda tidak memiliki izin untuk model ini atau kuota telah habis. 
              Pastikan Anda menggunakan API Key dari project Google Cloud berbayar.
            </p>
            <button
              onClick={async () => {
                await window.aistudio.openSelectKey();
                setError(null);
              }}
              className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white text-[10px] uppercase tracking-widest font-black rounded-lg transition-all"
            >
              Ganti API Key
            </button>
          </div>
        );
      } else {
        setError(`Neural Error: ${err.message || 'Unknown signal interference'}.`);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCopyResult = () => {
    if (result) {
      navigator.clipboard.writeText(result);
    }
  };

  return (
    <div className="flex flex-col lg:flex-row gap-10 relative">
      {/* Left Panel: Image Upload & Analysis Modes */}
      <div className="lg:w-1/3 p-8 glass-panel rounded-3xl shadow-2xl">
        <div className="flex items-center justify-between mb-8">
          <h3 className="text-[10px] uppercase tracking-[0.3em] font-black text-accent/60">Source Image</h3>
        </div>
        <div
          className="border border-dashed border-white/10 rounded-2xl p-8 text-center cursor-pointer hover:border-accent/50 transition-all duration-500 bg-white/[0.01] group relative"
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onClick={() => fileInputRef.current?.click()}
        >
          {imagePreviewUrl ? (
            <div className="relative w-full h-56 flex items-center justify-center">
              <img src={imagePreviewUrl} alt="Preview" className="max-h-full max-w-full object-contain rounded-xl shadow-2xl" referrerPolicy="no-referrer" />
              <button
                onClick={(e) => { e.stopPropagation(); handleRemoveImage(); }}
                className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1.5 hover:bg-red-600 transition-all shadow-lg hover:scale-110"
              >
                <XCircle size={18} />
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-56">
              <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-6 group-hover:bg-accent/10 transition-colors">
                <UploadCloud size={32} className="text-gray-700 group-hover:text-accent transition-colors" />
              </div>
              <p className="text-gray-400 text-sm font-medium tracking-wide">Drop image or click to browse</p>
              <p className="text-gray-600 text-[10px] uppercase tracking-widest mt-3">JPG, PNG, WEBP • MAX 5MB</p>
            </div>
          )}
          <input
            type="file"
            ref={fileInputRef}
            className="hidden"
            onChange={(e) => e.target.files && handleFileChange(e.target.files[0])}
            accept=".jpg,.jpeg,.png,.webp"
          />
        </div>
        {error && <div className="mt-4 text-center">{error}</div>}

        <h3 className="text-[10px] uppercase tracking-[0.3em] font-black mt-12 mb-8 text-accent/60">Analysis Protocol</h3>
        <div className="space-y-3">
          <button
            className={`w-full flex items-center justify-between px-6 py-4 rounded-2xl text-left transition-all duration-500 border
              ${analysisMode === AnalysisMode.VISUAL_DNA ? 'bg-accent/10 border-accent/40 text-accent shadow-[0_0_25px_rgba(245,208,97,0.2)]' : 'bg-white/[0.01] border-white/5 text-gray-600 hover:border-white/20 hover:text-gray-400'}`}
            onClick={() => setAnalysisMode(AnalysisMode.VISUAL_DNA)}
          >
            <div className="flex items-center gap-4">
              <ImageIcon size={18} /> 
              <span className="text-xs font-bold uppercase tracking-widest">Visual DNA</span>
            </div>
          </button>
          {analysisMode === AnalysisMode.VISUAL_DNA && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="pl-4 py-2 space-y-4"
            >
              <div className="p-4 rounded-xl bg-accent/5 border border-accent/10">
                <p className="text-[9px] uppercase tracking-widest text-accent/60 font-bold mb-2">Intelligence Engine</p>
                <select
                  className="w-full bg-transparent text-xs text-gray-300 outline-none cursor-pointer"
                  value={modelType}
                  onChange={(e) => setModelType(e.target.value as ModelType)}
                >
                  {Object.values(ModelType).map((model) => (
                    <option key={model} value={model} className="bg-black">
                      {model.replace(/([A-Z])/g, ' $1').trim()}
                    </option>
                  ))}
                </select>
              </div>
              <div className="p-4 rounded-xl bg-accent/5 border border-accent/10">
                <p className="text-[9px] uppercase tracking-widest text-accent/60 font-bold mb-2">Target Model Prompt</p>
                <select
                  className="w-full bg-transparent text-xs text-gray-300 outline-none cursor-pointer"
                  value={targetModel}
                  onChange={(e) => setTargetModel(e.target.value as TargetModel)}
                >
                  {Object.values(TargetModel).map((model) => (
                    <option key={model} value={model} className="bg-black">
                      {model}
                    </option>
                  ))}
                </select>
              </div>
            </motion.div>
          )}
          <button
            className={`w-full flex items-center justify-between px-6 py-4 rounded-2xl text-left transition-all duration-500 border
              ${analysisMode === AnalysisMode.TEXT_EXTRACTION ? 'bg-accent/10 border-accent/40 text-accent shadow-[0_0_25px_rgba(245,208,97,0.2)]' : 'bg-white/[0.01] border-white/5 text-gray-600 hover:border-white/20 hover:text-gray-400'}`}
            onClick={() => setAnalysisMode(AnalysisMode.TEXT_EXTRACTION)}
          >
            <div className="flex items-center gap-4">
              <FileText size={18} />
              <span className="text-xs font-bold uppercase tracking-widest">Text Extraction</span>
            </div>
          </button>
          <button
            className={`w-full flex items-center justify-between px-6 py-4 rounded-2xl text-left transition-all duration-500 border
              ${analysisMode === AnalysisMode.OBJECT_DETECTION ? 'bg-accent/10 border-accent/40 text-accent shadow-[0_0_25px_rgba(245,208,97,0.2)]' : 'bg-white/[0.01] border-white/5 text-gray-600 hover:border-white/20 hover:text-gray-400'}`}
            onClick={() => setAnalysisMode(AnalysisMode.OBJECT_DETECTION)}
          >
            <div className="flex items-center gap-4">
              <Search size={18} />
              <span className="text-xs font-bold uppercase tracking-widest">Object Detection</span>
            </div>
          </button>

        </div>

        <motion.button
          layout
          className="w-full mt-12 py-5 bg-accent text-black text-[10px] uppercase tracking-[0.3em] font-black rounded-2xl shadow-[0_10px_40px_rgba(255,94,0,0.2)] hover:shadow-[0_15px_50px_rgba(255,94,0,0.4)] transition-all duration-500 flex items-center justify-center gap-3 disabled:opacity-10 disabled:grayscale"
          onClick={handleAnalyze}
          disabled={loading || !imageFile || !analysisMode}
          whileHover={{ scale: 1.02, y: -2 }}
          whileTap={{ scale: 0.98 }}
        >
          {loading ? <Loader2 size={18} className="animate-spin" /> : 'Initiate Analysis'}
        </motion.button>
      </div>

      {/* Right Panel: Analysis Result */}
      <div className="lg:w-2/3 p-8 glass-panel rounded-3xl shadow-2xl flex flex-col">
        <div className="flex items-center justify-between mb-8">
          <h3 className="text-[10px] uppercase tracking-[0.3em] font-black text-accent/60">Intelligence Report</h3>
          {result && (
            <div className="flex gap-3">
              <button
                className="p-3 bg-white/5 hover:bg-accent/10 text-gray-600 hover:text-accent rounded-xl transition-all border border-white/5"
                onClick={handleCopyResult}
                title="Copy Results"
              >
                <Copy size={14} />
              </button>
              <button
                className="p-3 bg-white/5 hover:bg-red-500/10 text-gray-600 hover:text-red-500 rounded-xl transition-all border border-white/5"
                onClick={handleRemoveImage}
                title="Clear All"
              >
                <XCircle size={14} />
              </button>
            </div>
          )}
        </div>
        <div className="bg-black/40 border border-white/5 rounded-2xl min-h-[500px] flex flex-col overflow-hidden">
          {loading && (
            <div className="flex flex-col items-center justify-center flex-grow text-gray-600">
                <div className="relative mb-8">
                  <Loader2 size={64} className="animate-spin text-accent/10" />
                  <Loader2 size={64} className="animate-spin text-accent absolute top-0 left-0 [animation-delay:-0.5s]" />
                </div>
                <p className="text-[10px] uppercase tracking-[0.5em] font-black text-accent/40">Neural Processing In Progress</p>
            </div>
          )}
          {error && !loading && (
            <div className="flex flex-col items-center justify-center flex-grow text-red-500">
              <XCircle size={48} className="mb-4" />
              <div className="text-center">{error}</div>
            </div>
          )}
          {result && !loading && analysisMode === AnalysisMode.VISUAL_DNA && (
            <div className="flex-grow overflow-auto p-6 space-y-10">
              <div className="space-y-6">
                <div className="flex items-center gap-3">
                  <div className="h-[1px] flex-grow bg-white/10"></div>
                  <h4 className="text-[10px] uppercase tracking-[0.4em] font-black text-white/30">Analisa DNA</h4>
                  <div className="h-[1px] flex-grow bg-white/10"></div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {(result.split('----- ANALISA DNA -----')[1]?.split('----- FINAL PROMPT -----')[0] || '').split('\n').filter(line => line.includes(':')).map((line, index) => {
                    const [key, value] = line.split(':', 2);
                    return (
                      <div key={index} className="bg-white/[0.01] border border-white/5 p-6 rounded-2xl hover:bg-white/[0.03] transition-all duration-500 group relative">
                        <div className="flex justify-between items-start mb-3">
                          <p className="text-[9px] uppercase tracking-[0.2em] font-black text-accent/40 group-hover:text-accent/60 transition-colors">{key.trim()}</p>
                          <CopyButton text={value?.trim() || ''} title={`Copy ${key.trim()}`} />
                        </div>
                        <p className="text-sm text-gray-400 leading-relaxed font-medium">{value?.trim()}</p>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-6">
                <div className="flex items-center gap-3">
                  <div className="h-[1px] flex-grow bg-white/5"></div>
                  <h4 className="text-[10px] uppercase tracking-[0.5em] font-black text-white/20">Final Prompt</h4>
                  <div className="h-[1px] flex-grow bg-white/5"></div>
                </div>
                <div className="bg-accent/[0.02] border border-accent/10 p-8 rounded-3xl relative group overflow-hidden">
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-accent/20 to-transparent"></div>
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-[10px] uppercase tracking-[0.3em] font-black text-accent">{targetModel}</p>
                    <CopyButton text={result.split('----- FINAL PROMPT -----')[1]?.split('----- Tips Konsistensi -----')[0].trim() || ''} title="Copy Final Prompt" />
                  </div>
                  <p className="text-sm text-gray-300 leading-relaxed font-mono selection:bg-accent selection:text-black">
                    {result.split('----- FINAL PROMPT -----')[1]?.split('----- Tips Konsistensi -----')[0].trim()}
                  </p>
                </div>
              </div>

              <div className="space-y-6">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3 flex-grow">
                    <div className="h-[1px] flex-grow bg-white/10"></div>
                    <h4 className="text-[10px] uppercase tracking-[0.4em] font-black text-white/30">Tips Konsistensi</h4>
                    <div className="h-[1px] flex-grow bg-white/10"></div>
                  </div>
                  <div className="ml-4">
                    <CopyButton text={result.split('----- Tips Konsistensi -----')[1]?.trim() || ''} title="Copy Tips" />
                  </div>
                </div>
                <div className="bg-white/[0.02] border border-white/5 p-8 rounded-3xl italic font-serif text-gray-400 leading-loose">
                  {result.split('----- Tips Konsistensi -----')[1]?.trim()}
                </div>
              </div>
            </div>
          )}
          {result && !loading && analysisMode !== AnalysisMode.VISUAL_DNA && (
            <div className="flex-grow overflow-auto p-8 relative group">
              <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                <CopyButton text={result} title="Copy Result" />
              </div>
              <pre className="whitespace-pre-wrap font-mono text-sm text-gray-300 leading-relaxed selection:bg-gold/30">{result}</pre>
            </div>
          )}
          {!loading && !error && !result && (
            <div className="flex flex-col items-center justify-center flex-grow text-gray-700">
              <div className="w-12 h-12 rounded-full border border-white/5 flex items-center justify-center mb-6">
                <ImageIcon size={20} className="opacity-20" />
              </div>
              <p className="text-[10px] uppercase tracking-[0.2em] font-bold opacity-40">Awaiting Input Signal</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
