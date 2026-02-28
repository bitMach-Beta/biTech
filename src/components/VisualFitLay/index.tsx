import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Upload, Wand2, Trash2, Terminal, Download, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { GoogleGenAI } from "@google/genai";

export default function VisualFitLay() {
  const [sourceImage, setSourceImage] = useState<string | null>(null);
  const [sourceMime, setSourceMime] = useState<string>("image/png");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [logs, setLogs] = useState<{ id: number; msg: string; type: 'info' | 'success' | 'error' | 'system' }[]>([]);
  const [extractedItems, setExtractedItems] = useState<any[]>([]);
  const [itemVisuals, setItemVisuals] = useState<Record<number, string>>({});
  const [processingItems, setProcessingItems] = useState<Record<number, boolean>>({});
  const [failedItems, setFailedItems] = useState<Record<number, boolean>>({});
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const logEndRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const addLog = (msg: string, type: 'info' | 'success' | 'error' | 'system' = 'info') => {
    setLogs(prev => [...prev, { id: Date.now() + Math.random(), msg, type }]);
  };

  useEffect(() => {
    if (logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs]);

  const handleFile = (file: File) => {
    if (!file || !file.type.startsWith('image/')) {
      addLog("Invalid file type. Please upload an image.", "error");
      return;
    }
    setSourceMime(file.type);
    const reader = new FileReader();
    reader.onload = (e) => {
      setSourceImage(e.target?.result as string);
      addLog(`Image loaded: ${file.name}`, "success");
    };
    reader.readAsDataURL(file);
  };

  const reset = () => {
    if (abortControllerRef.current) abortControllerRef.current.abort();
    setSourceImage(null);
    setExtractedItems([]);
    setItemVisuals({});
    setProcessingItems({});
    setFailedItems({});
    setIsAnalyzing(false);
    setLogs([{ id: Date.now(), msg: "System reset. Ready for new input.", type: 'system' }]);
  };

  const downloadAsJpg = (dataUrl: string, filename: string) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
      const jpgDataUrl = canvas.toDataURL('image/jpeg', 0.9);
      const link = document.createElement('a');
      link.href = jpgDataUrl;
      link.download = `${filename.replace(/\s+/g, '_')}.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      addLog(`Downloaded: ${filename}`, "success");
    };
    img.src = dataUrl;
  };

  const processImage = async () => {
    if (!sourceImage) return;
    
    setIsAnalyzing(true);
    setExtractedItems([]);
    setItemVisuals({});
    setProcessingItems({});
    setFailedItems({});
    addLog("Initiating neural analysis...", "system");

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
    const base64Data = sourceImage.split(',')[1];

    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [{
          role: "user",
          parts: [
            { text: "Look at this fashion model. Identify all separate clothing items and accessories. Return a JSON object with an 'items' array. Each item MUST have 'name', 'type', 'color', and 'description'." },
            { inlineData: { mimeType: sourceMime, data: base64Data } }
          ]
        }],
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: "OBJECT" as any,
            properties: {
              items: {
                type: "ARRAY" as any,
                items: {
                  type: "OBJECT" as any,
                  properties: {
                    name: { type: "STRING" as any },
                    type: { type: "STRING" as any },
                    color: { type: "STRING" as any },
                    description: { type: "STRING" as any }
                  },
                  required: ["name", "type", "color", "description"]
                }
              }
            }
          }
        }
      });

      const data = JSON.parse(response.text || "{}");
      const items = data.items || [];
      
      setExtractedItems(items);
      setIsAnalyzing(false);
      addLog(`Detected ${items.length} fashion elements. Starting visual synthesis...`, "success");

      // Process each item visually
      items.forEach((item: any, index: number) => {
        extractItemVisual(item, index, base64Data, ai);
      });

    } catch (error: any) {
      console.error(error);
      addLog(`Analysis failed: ${error.message}`, "error");
      setIsAnalyzing(false);
    }
  };

  const extractItemVisual = async (item: any, index: number, base64Data: string, ai: any) => {
    setProcessingItems(prev => ({ ...prev, [index]: true }));
    addLog(`Synthesizing visual for: ${item.name}...`);

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: {
          parts: [
            { text: `Extract the ${item.name} from the image. Show ONLY this item as a professional product flat lay on a solid white background. High resolution, clean edges.` },
            { inlineData: { mimeType: sourceMime, data: base64Data } }
          ]
        }
      });

      const imagePart = response.candidates?.[0]?.content?.parts?.find((p: any) => p.inlineData);
      if (imagePart?.inlineData?.data) {
        const imageUrl = `data:image/png;base64,${imagePart.inlineData.data}`;
        setItemVisuals(prev => ({ ...prev, [index]: imageUrl }));
        addLog(`Visual ready: ${item.name}`, "success");
      } else {
        throw new Error("No image data returned");
      }
    } catch (error: any) {
      console.error(error);
      setFailedItems(prev => ({ ...prev, [index]: true }));
      addLog(`Failed to extract ${item.name}`, "error");
    } finally {
      setProcessingItems(prev => ({ ...prev, [index]: false }));
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
      {/* Left Panel */}
      <div className="lg:col-span-4 space-y-6">
        <div className="glass-panel p-6 rounded-3xl border-white/10">
          <h3 className="text-sm font-black uppercase tracking-[0.3em] mb-6 flex items-center gap-2 text-accent">
            <Upload size={16} />
            Input Source
          </h3>

          {!sourceImage ? (
            <div 
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('border-accent/50', 'bg-accent/5'); }}
              onDragLeave={(e) => { e.preventDefault(); e.currentTarget.classList.remove('border-accent/50', 'bg-accent/5'); }}
              onDrop={(e) => { e.preventDefault(); handleFile(e.dataTransfer.files[0]); }}
              className="border-2 border-dashed border-white/10 rounded-2xl p-12 text-center cursor-pointer hover:border-accent/30 hover:bg-white/5 transition-all group"
            >
              <input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                accept="image/*"
                onChange={(e) => e.target.files && handleFile(e.target.files[0])}
              />
              <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                <Upload className="text-white/20 group-hover:text-accent transition-colors" />
              </div>
              <p className="text-xs font-bold text-white/40 uppercase tracking-widest">Drop model photo</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="relative rounded-2xl overflow-hidden border border-white/10 group">
                <img src={sourceImage} alt="Source" className="w-full h-auto" />
                <button 
                  onClick={reset}
                  className="absolute top-3 right-3 w-10 h-10 bg-black/60 backdrop-blur-md rounded-full flex items-center justify-center text-white/60 hover:text-red-400 hover:bg-black transition-all"
                >
                  <Trash2 size={18} />
                </button>
              </div>
              <button 
                onClick={processImage}
                disabled={isAnalyzing}
                className="w-full py-4 bg-accent text-black font-black text-[10px] uppercase tracking-[0.3em] rounded-xl hover:bg-accent-dark transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 shadow-[0_0_20px_rgba(245,208,97,0.2)]"
              >
                {isAnalyzing ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <Wand2 size={16} />
                    Extract Fashion
                  </>
                )}
              </button>
            </div>
          )}
        </div>

        {/* Activity Log */}
        <div className="bg-black/40 border border-white/5 rounded-3xl p-6 overflow-hidden">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-accent/60 flex items-center gap-2">
              <Terminal size={12} />
              Activity Log
            </h4>
            <div className="flex gap-1">
              <div className="w-1.5 h-1.5 rounded-full bg-red-500/50"></div>
              <div className="w-1.5 h-1.5 rounded-full bg-yellow-500/50"></div>
              <div className="w-1.5 h-1.5 rounded-full bg-green-500/50"></div>
            </div>
          </div>
          <div className="h-48 overflow-y-auto space-y-2 font-mono text-[10px] pr-2 scrollbar-thin scrollbar-thumb-white/10">
            {logs.length === 0 && <div className="text-white/20 italic">Waiting for input...</div>}
            {logs.map(log => (
              <div key={log.id} className={`flex gap-2 ${
                log.type === 'success' ? 'text-emerald-400' : 
                log.type === 'error' ? 'text-red-400' : 
                log.type === 'system' ? 'text-accent' : 'text-white/40'
              }`}>
                <span className="opacity-30">[{new Date(log.id).toLocaleTimeString([], { hour12: false })}]</span>
                <span>{log.msg}</span>
              </div>
            ))}
            <div ref={logEndRef} />
          </div>
        </div>
      </div>

      {/* Right Panel */}
      <div className="lg:col-span-8">
        <AnimatePresence mode="wait">
          {extractedItems.length === 0 && !isAnalyzing ? (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="h-full min-h-[500px] flex flex-col items-center justify-center border-2 border-dashed border-white/5 rounded-[2.5rem] bg-white/[0.02] text-center p-12"
            >
              <div className="w-24 h-24 bg-white/5 rounded-full flex items-center justify-center mb-8">
                <Wand2 size={40} className="text-white/10" />
              </div>
              <h3 className="text-xl font-display text-accent/40 mb-4">FitLay Synthesis</h3>
              <p className="text-xs text-white/30 max-w-xs leading-relaxed uppercase tracking-widest font-bold">
                Upload a model photo to decompose fashion elements into high-quality visual assets.
              </p>
            </motion.div>
          ) : isAnalyzing ? (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="h-full min-h-[500px] flex flex-col items-center justify-center glass-panel rounded-[2.5rem] border-white/10"
            >
              <div className="relative">
                <Loader2 size={48} className="text-accent animate-spin mb-6" />
                <div className="absolute inset-0 blur-xl bg-accent/20 animate-pulse"></div>
              </div>
              <h3 className="text-xl font-display text-accent mb-2">Neural Mapping</h3>
              <p className="text-[10px] text-white/40 uppercase tracking-[0.3em] font-black">Analyzing garment structure...</p>
            </motion.div>
          ) : (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-8"
            >
              <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-white/5 pb-8">
                <div>
                  <h3 className="text-2xl font-display text-accent mb-1">Extracted Assets</h3>
                  <p className="text-[10px] text-white/40 uppercase tracking-widest font-bold">Automated flat-lay synthesis complete.</p>
                </div>
                <div className="bg-accent/10 border border-accent/20 px-6 py-2 rounded-full">
                  <span className="text-[10px] font-black text-accent uppercase tracking-[0.2em]">{extractedItems.length} Elements</span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {extractedItems.map((item, idx) => (
                  <motion.div 
                    key={idx}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: idx * 0.1 }}
                    className="glass-panel rounded-3xl overflow-hidden border-white/5 group hover:border-accent/20 transition-all flex flex-col"
                  >
                    <div className="aspect-square bg-white/[0.03] relative flex items-center justify-center p-12 overflow-hidden">
                      {processingItems[idx] ? (
                        <div className="flex flex-col items-center gap-4">
                          <Loader2 className="text-accent/40 animate-spin" size={32} />
                          <span className="text-[8px] font-black text-white/20 uppercase tracking-[0.2em]">Synthesizing...</span>
                        </div>
                      ) : failedItems[idx] ? (
                        <div className="flex flex-col items-center gap-4 text-red-400/40">
                          <AlertCircle size={32} />
                          <span className="text-[8px] font-black uppercase tracking-[0.2em]">Extraction Failed</span>
                        </div>
                      ) : itemVisuals[idx] ? (
                        <>
                          <img 
                            src={itemVisuals[idx]} 
                            alt={item.name} 
                            className="w-full h-full object-contain mix-blend-lighten transition-transform duration-700 group-hover:scale-110"
                          />
                          <button 
                            onClick={() => downloadAsJpg(itemVisuals[idx], item.name)}
                            className="absolute bottom-4 right-4 w-12 h-12 bg-accent text-black rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all translate-y-4 group-hover:translate-y-0 shadow-xl"
                          >
                            <Download size={20} />
                          </button>
                        </>
                      ) : null}
                    </div>
                    
                    <div className="p-6 flex-grow flex flex-col">
                      <div className="flex gap-2 mb-4">
                        <span className="text-[8px] font-black uppercase tracking-tighter bg-accent/10 text-accent px-2 py-1 rounded">{item.type}</span>
                        <span className="text-[8px] font-black uppercase tracking-tighter border border-white/10 text-white/40 px-2 py-1 rounded">{item.color}</span>
                      </div>
                      <h4 className="text-sm font-bold text-white mb-2">{item.name}</h4>
                      <p className="text-[11px] text-white/40 leading-relaxed mb-6 flex-grow">{item.description}</p>
                      
                      {itemVisuals[idx] && (
                        <button 
                          onClick={() => downloadAsJpg(itemVisuals[idx], item.name)}
                          className="w-full py-3 rounded-xl border border-white/10 text-[9px] font-black uppercase tracking-[0.2em] text-white/40 hover:bg-accent hover:text-black hover:border-accent transition-all flex items-center justify-center gap-2"
                        >
                          <Download size={14} />
                          Download Asset
                        </button>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
