import React, { useRef } from 'react';
import { CloudFog, Crop, ImagePlus, MousePointer2 } from 'lucide-react';
import { useEditorStore } from '../../store/useEditorStore';
import { readLocalImageFile } from '../../utils/fileHelpers';

export const LeftToolRail: React.FC = () => {
  const { activeTool, setActiveTool, enterCropMode, insertImages, addFogLayer } =
    useEditorStore();
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
      <button
        onClick={() => setActiveTool('select')}
        title="Chọn & Di chuyển (V)"
        className={`w-9 h-9 rounded-lg flex items-center justify-center transition ${
          activeTool === 'select'
            ? 'bg-blue-600 text-white shadow'
            : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
        }`}
      >
        <MousePointer2 className="w-4 h-4" />
      </button>

      <button
        onClick={enterCropMode}
        title="Cắt khung ảnh - Crop (C)"
        className={`w-9 h-9 rounded-lg flex items-center justify-center transition ${
          activeTool === 'crop'
            ? 'bg-blue-600 text-white shadow'
            : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
        }`}
      >
        <Crop className="w-4 h-4" />
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
