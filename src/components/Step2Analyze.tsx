import React, { useState, useEffect } from 'react';
import { 
  Sparkles, 
  CheckCircle2, 
  Edit3, 
  Target, 
  Flame, 
  Award, 
  FileText, 
  Bot, 
  Settings, 
  Loader2, 
  Video, 
  Eye, 
  Scan, 
  Image as ImageIcon 
} from 'lucide-react';
import { ProjectData, ProductAnalysis, ProviderApiKeys } from '../types';
import { analyzeProductWithAI } from '../services/aiAnalysisService';
import { extractVideoKeyframes, ExtractedFrame } from '../services/videoFrameExtractor';

interface Step2AnalyzeProps {
  project: ProjectData;
  apiKeys: ProviderApiKeys;
  onUpdateProject: (updates: Partial<ProjectData>) => void;
  onOpenSettings: () => void;
  onNext: () => void;
  onPrev: () => void;
  onNotify: (type: 'success' | 'error' | 'info', title: string, message?: string) => void;
}

export const Step2Analyze: React.FC<Step2AnalyzeProps> = ({
  project,
  apiKeys,
  onUpdateProject,
  onOpenSettings,
  onNext,
  onPrev,
  onNotify,
}) => {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isExtractingFrames, setIsExtractingFrames] = useState(false);
  const [frames, setFrames] = useState<ExtractedFrame[]>([]);
  const [rawText, setRawText] = useState(project.productAnalysis.rawInputText || '');
  const [analysis, setAnalysis] = useState<ProductAnalysis>(project.productAnalysis);

  const activeAiProvider = apiKeys.ai_analysis.activeProvider;
  const getAiProviderName = () => {
    switch (activeAiProvider) {
      case 'gemini': return `Google Gemini Vision (${apiKeys.ai_analysis.geminiModel || '1.5 Flash'})`;
      case 'openai': return `OpenAI Vision (${apiKeys.ai_analysis.openaiModel || 'GPT-4o'})`;
      case 'anthropic': return `Claude Vision (${apiKeys.ai_analysis.anthropicModel || '3.5'})`;
      default: return 'Smart Heuristic AI ในตัว (ไม่ต้องใช้ Key)';
    }
  };

  // Automatically extract video keyframes when component loads
  useEffect(() => {
    let isMounted = true;

    async function loadFrames() {
      if (!project.videoUrl) return;
      setIsExtractingFrames(true);
      try {
        const extracted = await extractVideoKeyframes(project.videoUrl, 4);
        if (isMounted) {
          setFrames(extracted);
        }
      } catch (err) {
        console.warn('Failed to extract video keyframes:', err);
      } finally {
        if (isMounted) setIsExtractingFrames(false);
      }
    }

    loadFrames();

    return () => {
      isMounted = false;
    };
  }, [project.videoUrl]);

  const handleRunAnalysis = async () => {
    setIsAnalyzing(true);
    const textToAnalyze = rawText.trim() || project.title || project.videoFileName || '';

    try {
      let currentFrames = frames;
      if ((!currentFrames || currentFrames.length === 0) && project.videoUrl) {
        try {
          setIsExtractingFrames(true);
          currentFrames = await extractVideoKeyframes(project.videoUrl, 4);
          setFrames(currentFrames);
        } catch (e) {
          console.warn('Frame extraction fallback error:', e);
        } finally {
          setIsExtractingFrames(false);
        }
      }

      // Pass video frames for Multimodal Vision AI Analysis!
      const result = await analyzeProductWithAI(textToAnalyze, apiKeys.ai_analysis, currentFrames);
      setAnalysis(result);
      if (result.rawInputText) {
        setRawText(result.rawInputText);
      }
      onUpdateProject({
        productAnalysis: result,
        status: 'analyzed'
      });
      setIsAnalyzing(false);
      onNotify(
        'success', 
        'AI วิเคราะห์ภาพจากวิดีโอสำเร็จ!', 
        `สกัดชื่อสินค้า: "${result.productName}" เรียบร้อยแล้ว (${getAiProviderName()})`
      );
    } catch (err: any) {
      setIsAnalyzing(false);
      onNotify('error', 'วิเคราะห์สินค้าล้มเหลว', err.message || 'โปรดตรวจสอบการตั้งค่า API Key');
    }
  };

  const handleFieldChange = (field: keyof ProductAnalysis, value: any) => {
    const updated = { ...analysis, [field]: value };
    setAnalysis(updated);
    onUpdateProject({ productAnalysis: updated });
  };

  const handleFeatureChange = (index: number, value: string) => {
    const newFeatures = [...analysis.features];
    newFeatures[index] = value;
    const updated = { ...analysis, features: newFeatures };
    setAnalysis(updated);
    onUpdateProject({ productAnalysis: updated });
  };

  return (
    <div className="space-y-6">
      
      {/* Header Info */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold font-kanit text-white flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-lg bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center text-sm font-bold">
              2
            </span>
            Step 2: วิเคราะห์สินค้าอัตโนมัติจากวิดีโอ (AI Video Multimodal Analysis)
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            AI Vision จะสแกนภาพขวด ฉลากสินค้า และการสาธิตจากวิดีโอต้นฉบับเพื่อดึงจุดขายและ Pain Point
          </p>
        </div>

        <button
          type="button"
          onClick={handleRunAnalysis}
          disabled={isAnalyzing}
          className="flex items-center gap-2 px-6 py-3 rounded-2xl text-xs sm:text-sm font-bold text-white bg-gradient-to-r from-indigo-600 via-violet-600 to-cyan-500 hover:from-indigo-500 hover:to-cyan-400 shadow-xl shadow-indigo-500/30 transition-all self-start sm:self-auto disabled:opacity-50 transform hover:-translate-y-0.5"
        >
          {isAnalyzing ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin text-cyan-300" />
              <span>AI กำลังสแกนและวิเคราะห์ภาพในวิดีโอ...</span>
            </>
          ) : (
            <>
              <Scan className="w-4 h-4 text-cyan-300 animate-pulse" />
              <span>สแกน & วิเคราะห์สินค้าจากวิดีโอ</span>
            </>
          )}
        </button>
      </div>

      {/* Video Keyframes Snapshot Carousel & AI Provider Status */}
      <div className="p-5 rounded-2xl bg-slate-900/80 border border-indigo-500/30 shadow-xl space-y-4">
        
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
          <div className="flex items-center gap-2 text-xs">
            <Bot className="w-4 h-4 text-cyan-400" />
            <span className="text-slate-400">เอนจิน AI สแกนภาพวิดีโอ:</span>
            <span className="font-bold text-cyan-300 bg-cyan-950/60 px-2.5 py-0.5 rounded border border-cyan-800/40">
              {getAiProviderName()}
            </span>
          </div>

          <button
            type="button"
            onClick={onOpenSettings}
            className="flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 font-medium self-start sm:self-auto"
          >
            <Settings className="w-3.5 h-3.5" />
            <span>ตั้งค่า / เปลี่ยน API Key</span>
          </button>
        </div>

        {/* Keyframe Snapshots from Uploaded Video */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-300 flex items-center gap-1.5">
              <Eye className="w-4 h-4 text-indigo-400" />
              ภาพเฟรมที่สกัดจากวิดีโอสำหรับส่งให้ AI วิเคราะห์ (Video Keyframes):
            </span>
            {isExtractingFrames ? (
              <span className="text-slate-400 flex items-center gap-1">
                <Loader2 className="w-3 h-3 animate-spin" /> กำลังสกัดเฟรมภาพ...
              </span>
            ) : (
              <span className="text-emerald-400 text-[11px] font-medium">
                ✓ สกัดสำเร็จ {frames.length} เฟรมภาพ
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {frames.map((frame, idx) => (
              <div 
                key={idx} 
                className="relative group rounded-xl overflow-hidden border border-slate-800 bg-black aspect-[9/16] shadow-md hover:border-indigo-500/60 transition-all"
              >
                <img 
                  src={frame.dataUrl} 
                  alt={`Keyframe ${idx + 1}`} 
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
                <div className="absolute top-2 left-2 px-1.5 py-0.5 rounded bg-slate-950/80 backdrop-blur-sm border border-slate-700/80 text-[10px] font-mono text-cyan-300">
                  {frame.timestamp}s
                </div>
                <div className="absolute bottom-2 inset-x-2 px-1.5 py-0.5 rounded bg-slate-950/80 backdrop-blur-sm text-[10px] text-slate-300 text-center truncate">
                  เฟรมที่ {idx + 1}
                </div>

                {/* Scanning line animation during analysis */}
                {isAnalyzing && (
                  <div className="absolute inset-0 bg-gradient-to-b from-transparent via-cyan-400/30 to-transparent animate-pulse pointer-events-none" />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Optional Extra User Notes / Product Context */}
        <div className="pt-2">
          <label className="flex items-center justify-between text-xs font-semibold text-slate-300 mb-1.5">
            <span className="flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-indigo-400" />
              ข้อความเสริม / ลิงก์สินค้าเพิ่มเติม (ไม่บังคับ):
            </span>
            <span className="text-[11px] text-slate-400 font-normal">
              *หากต้องการระบุโปรโมชั่นหรือคำสั่งพิเศษเพิ่มเติม
            </span>
          </label>

          <input
            type="text"
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
            placeholder="เช่น ตอนนี้มีโปร 1 แถม 1 ราคา 390 บาท หรือเน้นกลุ่มวัยทำงาน..."
            className="w-full bg-slate-950/90 border border-slate-700/80 rounded-xl px-3 py-2 text-white text-xs sm:text-sm focus:outline-none focus:border-indigo-500 transition-colors"
          />
        </div>

      </div>

      {/* Analysis Form Output Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        
        {/* Product Name */}
        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2">
          <label className="flex items-center gap-2 text-xs font-semibold text-slate-300">
            <Edit3 className="w-4 h-4 text-indigo-400" />
            <span>1. ชื่อสินค้า / แบรนด์ (Product Name)</span>
          </label>
          <input
            type="text"
            value={analysis.productName}
            onChange={(e) => handleFieldChange('productName', e.target.value)}
            placeholder="เช่น Glow Vit-C 10% Brightening Serum"
            className="w-full bg-slate-950/80 border border-slate-700/80 rounded-lg px-3 py-2.5 text-white text-xs sm:text-sm focus:outline-none focus:border-indigo-500 transition-colors"
          />
        </div>

        {/* Target Audience */}
        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2">
          <label className="flex items-center gap-2 text-xs font-semibold text-slate-300">
            <Target className="w-4 h-4 text-cyan-400" />
            <span>2. กลุ่มเป้าหมาย (Target Audience)</span>
          </label>
          <input
            type="text"
            value={analysis.targetAudience}
            onChange={(e) => handleFieldChange('targetAudience', e.target.value)}
            placeholder="เช่น วัยทำงาน 20-35 ปี ที่มีปัญหารอยสิว ผิวหมองคล้ำ"
            className="w-full bg-slate-950/80 border border-slate-700/80 rounded-lg px-3 py-2.5 text-white text-xs sm:text-sm focus:outline-none focus:border-indigo-500 transition-colors"
          />
        </div>

        {/* Pain Point */}
        <div className="md:col-span-2 p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2">
          <label className="flex items-center gap-2 text-xs font-semibold text-rose-300">
            <Flame className="w-4 h-4 text-rose-400" />
            <span>3. Pain Point / ปัญหาที่ลูกค้าเจอ (นำไปใช้เป็น Hook เปิดคลิป)</span>
          </label>
          <textarea
            rows={2}
            value={analysis.painPoint}
            onChange={(e) => handleFieldChange('painPoint', e.target.value)}
            placeholder="เช่น หน้าหมองคล้ำ รอยสิวหายช้า แต่งหน้าไม่ติดทน หรือลองมาหลายตัวแล้วไม่ได้ผล"
            className="w-full bg-slate-950/80 border border-slate-700/80 rounded-lg px-3 py-2 text-white text-xs sm:text-sm focus:outline-none focus:border-indigo-500 transition-colors resize-none"
          />
        </div>

        {/* 3 Key Features */}
        <div className="md:col-span-2 p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-xs font-semibold text-amber-300">
              <CheckCircle2 className="w-4 h-4 text-amber-400" />
              <span>4. จุดเด่นและฟีเจอร์หลัก 3 ข้อที่ตรวจพบในคลิป (3 Key Features)</span>
            </label>
            <span className="text-[11px] text-slate-400">กระชับ เห็นภาพชัดเจน</span>
          </div>

          <div className="space-y-2">
            {[0, 1, 2].map((idx) => (
              <div key={idx} className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-md bg-slate-800 text-indigo-300 font-bold text-xs flex items-center justify-center shrink-0 border border-slate-700">
                  {idx + 1}
                </span>
                <input
                  type="text"
                  value={analysis.features[idx] || ''}
                  onChange={(e) => handleFeatureChange(idx, e.target.value)}
                  placeholder={`ฟีเจอร์เด่นข้อที่ ${idx + 1}...`}
                  className="flex-1 bg-slate-950/80 border border-slate-700/80 rounded-lg px-3 py-2 text-white text-xs sm:text-sm focus:outline-none focus:border-indigo-500 transition-colors"
                />
              </div>
            ))}
          </div>
        </div>

        {/* USP */}
        <div className="md:col-span-2 p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2">
          <label className="flex items-center gap-2 text-xs font-semibold text-emerald-300">
            <Award className="w-4 h-4 text-emerald-400" />
            <span>5. จุดขายเฉพาะตัวที่คู่แข่งไม่มี (Unique Selling Proposition - USP)</span>
          </label>
          <textarea
            rows={2}
            value={analysis.usp}
            onChange={(e) => handleFieldChange('usp', e.target.value)}
            placeholder="เช่น เห็นผลชัดเจนใน 7 วัน ผ่านการทดสอบแพทย์ผิวหนัง และราคาจับต้องได้ง่าย"
            className="w-full bg-slate-950/80 border border-slate-700/80 rounded-lg px-3 py-2 text-white text-xs sm:text-sm focus:outline-none focus:border-indigo-500 transition-colors resize-none"
          />
        </div>

      </div>

      {/* Bottom Step Navigation */}
      <div className="flex items-center justify-between pt-4 border-t border-slate-800">
        <button
          type="button"
          onClick={onPrev}
          className="px-5 py-2.5 rounded-xl font-medium text-xs sm:text-sm text-slate-300 hover:text-white hover:bg-slate-800 border border-slate-700 transition-colors"
        >
          ← ย้อนกลับ
        </button>

        <button
          type="button"
          onClick={onNext}
          className="flex items-center gap-2 px-6 py-2.5 rounded-xl font-semibold text-xs sm:text-sm text-white bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 shadow-lg shadow-indigo-500/25 transition-all"
        >
          <span>ถัดไป: เขียนบทรีวิว</span>
          <span className="font-bold">→</span>
        </button>
      </div>

    </div>
  );
};
