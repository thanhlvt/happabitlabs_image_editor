import React, { useRef } from 'react';
import {
  BoxSelect,
  CloudFog,
  Crop,
  Hand,
  ImagePlus,
  MousePointer2,
  Wand2,
} from 'lucide-react';
import { useEditorStore } from '../../store/useEditorStore';
import { readLocalImageFile } from '../../utils/fileHelpers';

export const LeftToolRail: React.FC = () => {
  const {
    canvasMode,
    activeTool,
    setCanvasMode,
    setActiveTool,
    enterCropMode,
    insertImages,
    addFogLayer,
  } = useEditorStore();
  const insertInputRef = useRef<HTMLInputElement | null>(null);

  const handleInsertFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    const loaded = await Promise.all(files.map(readLocalImageFile));
    insertImages(loaded);
    e.target.value = '';
  };

  return (
    <aside className="w-[52px] bg-[#161920] border-r border-slate-800 flex flex-col items-center py-3 gap-2 shrink-0">
      {/* View / Pan Mode */}
      <button
        onClick={() => setCanvasMode(canvasMode === 'view' ? 'edit' : 'view')}
        title="Chế độ View — Kéo để di chuyển vùng nhìn, Scroll để Zoom (H)"
        aria-pressed={canvasMode === 'view'}
        className={`w-9 h-9 rounded-lg flex items-center justify-center transition ${
          canvasMode === 'view'
            ? 'bg-amber-500 text-slate-950 shadow'
            : 'text-slate-400 hover:bg-slate-800 hover:text-amber-300'
        }`}
      >
        <Hand className="w-4 h-4" />
      </button>

      {/* Edit / Select Object */}
      <button
        onClick={() => {
          setCanvasMode('edit');
          setActiveTool('select');
        }}
        title="Chế độ Edit — Chọn & Di chuyển đối tượng (V)"
        className={`w-9 h-9 rounded-lg flex items-center justify-center transition ${
          canvasMode === 'edit' && activeTool === 'select'
            ? 'bg-blue-600 text-white shadow'
            : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
        }`}
      >
        <MousePointer2 className="w-4 h-4" />
      </button>

      {/* Marquee Region Select */}
      <button
        onClick={() => {
          setCanvasMode('edit');
          setActiveTool(activeTool === 'marquee' ? 'select' : 'marquee');
        }}
        title="Chọn vùng (Chữ nhật, Vuông, Tròn, Elip, Free Form) (M)"
        className={`w-9 h-9 rounded-lg flex items-center justify-center transition ${
          canvasMode === 'edit' && activeTool === 'marquee'
            ? 'bg-sky-600 text-white shadow'
            : 'text-slate-400 hover:bg-slate-800 hover:text-sky-300'
        }`}
      >
        <BoxSelect className="w-4 h-4" />
      </button>

      <button
        onClick={() => {
          setCanvasMode('edit');
          enterCropMode();
        }}
        title="Cắt khung ảnh - Crop (C)"
        className={`w-9 h-9 rounded-lg flex items-center justify-center transition ${
          canvasMode === 'edit' && activeTool === 'crop'
            ? 'bg-blue-600 text-white shadow'
            : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
        }`}
      >
        <Crop className="w-4 h-4" />
      </button>

      <button
        onClick={() => {
          setCanvasMode('edit');
          setActiveTool(activeTool === 'magic-eraser' ? 'select' : 'magic-eraser');
        }}
        title="Magic Background Eraser (E)"
        className={`w-9 h-9 rounded-lg flex items-center justify-center transition ${
          canvasMode === 'edit' && activeTool === 'magic-eraser'
            ? 'bg-cyan-600 text-white shadow'
            : 'text-slate-400 hover:bg-slate-800 hover:text-cyan-300'
        }`}
      >
        <Wand2 className="w-4 h-4" />
      </button>

      <div className="w-6 border-t border-slate-800 my-1" />

      <button
        onClick={() => insertInputRef.current?.click()}
        title="Chèn ảnh khác vào canvas"
        className="w-9 h-9 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-800 hover:text-emerald-300 transition"
      >
        <ImagePlus className="w-4 h-4" />
      </button>
      <input
        ref={insertInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleInsertFiles}
        className="hidden"
      />

      <button
        onClick={() => addFogLayer('white-mist')}
        title="Thêm Object Sương làm mờ nền"
        className="w-9 h-9 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-800 hover:text-cyan-300 transition"
      >
        <CloudFog className="w-4 h-4" />
      </button>
    </aside>
  );
};
