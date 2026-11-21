import React, { useState } from 'react';
import { X } from 'lucide-react';
import { CANVAS_SIZE_PRESETS } from '../../utils/fogPresets';
import { useEditorStore } from '../../store/useEditorStore';

interface NewCanvasModalProps {
  open: boolean;
  onClose: () => void;
}

export const NewCanvasModal: React.FC<NewCanvasModalProps> = ({ open, onClose }) => {
  const newCanvas = useEditorStore((s) => s.newCanvas);
  const [width, setWidth] = useState(1920);
  const [height, setHeight] = useState(1080);
  const [transparent, setTransparent] = useState(true);
  const [bgColor, setBgColor] = useState('#111827');

  if (!open) return null;

  const widePresets = CANVAS_SIZE_PRESETS.filter((p) => p.category === 'wide');
  const squarePresets = CANVAS_SIZE_PRESETS.filter((p) => p.category === 'square');

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    newCanvas(width, height, transparent ? null : bgColor);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-[#181b22] border border-slate-700/80 rounded-xl shadow-2xl w-full max-w-lg overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-800">
          <h2 className="text-sm font-semibold text-slate-100">Tạo ảnh mới (New Canvas)</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-200">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleCreate} className="p-5 space-y-4 text-xs">
          {/* Custom W x H */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-400 mb-1">Chiều rộng (Width px)</label>
              <input
                type="number"
                min={1}
                max={8000}
                value={width}
                onChange={(e) => setWidth(Math.max(1, Number(e.target.value) || 1))}
                className="w-full bg-[#0f1115] border border-slate-700 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-slate-400 mb-1">Chiều cao (Height px)</label>
              <input
                type="number"
                min={1}
                max={8000}
                value={height}
                onChange={(e) => setHeight(Math.max(1, Number(e.target.value) || 1))}
                className="w-full bg-[#0f1115] border border-slate-700 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {/* Presets */}
          <div>
            <p className="text-slate-400 mb-1.5 font-medium">Banner / Wide Presets</p>
            <div className="grid grid-cols-3 gap-1.5">
              {widePresets.map((p) => (
                <button
                  type="button"
                  key={p.label}
                  onClick={() => {
                    setWidth(p.width);
                    setHeight(p.height);
                  }}
                  className={`px-2.5 py-1.5 rounded-md border text-center transition ${
                    width === p.width && height === p.height
                      ? 'bg-blue-600/20 border-blue-500 text-blue-300'
                      : 'bg-[#0f1115] border-slate-800 text-slate-300 hover:border-slate-600'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-slate-400 mb-1.5 font-medium">Square / Icon Presets</p>
            <div className="grid grid-cols-4 gap-1.5">
              {squarePresets.map((p) => (
                <button
                  type="button"
                  key={p.label}
                  onClick={() => {
                    setWidth(p.width);
                    setHeight(p.height);
                  }}
                  className={`px-2 py-1.5 rounded-md border text-center transition ${
                    width === p.width && height === p.height
                      ? 'bg-blue-600/20 border-blue-500 text-blue-300'
                      : 'bg-[#0f1115] border-slate-800 text-slate-300 hover:border-slate-600'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Background */}
          <div className="pt-1 border-t border-slate-800">
            <label className="block text-slate-400 mb-2">Nền Canvas</label>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setTransparent(true)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${
                  transparent
                    ? 'border-blue-500 bg-blue-600/15 text-blue-200'
                    : 'border-slate-700 bg-[#0f1115] text-slate-300'
                }`}
              >
                <span className="w-4 h-4 rounded-xs checker-sm border border-slate-500" />
                Trong suốt (Alpha)
              </button>
              <button
                type="button"
                onClick={() => setTransparent(false)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${
                  !transparent
                    ? 'border-blue-500 bg-blue-600/15 text-blue-200'
                    : 'border-slate-700 bg-[#0f1115] text-slate-300'
                }`}
              >
                <span
                  className="w-4 h-4 rounded-xs border border-slate-500"
                  style={{ backgroundColor: bgColor }}
                />
                Màu đơn sắc
              </button>
              {!transparent && (
                <input
                  type="color"
                  value={bgColor}
                  onChange={(e) => setBgColor(e.target.value)}
                  className="h-8 w-12 bg-transparent cursor-pointer rounded border border-slate-700"
                />
              )}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
            >
              Hủy
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium"
            >
              Tạo Canvas
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
