import React, { useEffect, useState } from 'react';
import { Lock, Unlock, X } from 'lucide-react';
import { useEditorStore } from '../../store/useEditorStore';
import { computeAspectDimensions } from '../../utils/geometry';

interface ResizeModalProps {
  open: boolean;
  onClose: () => void;
}

export const ResizeModal: React.FC<ResizeModalProps> = ({ open, onClose }) => {
  const canvas = useEditorStore((s) => s.canvas);
  const resizeCanvas = useEditorStore((s) => s.resizeCanvas);

  const [width, setWidth] = useState(canvas.width);
  const [height, setHeight] = useState(canvas.height);
  const [lockRatio, setLockRatio] = useState(true);
  const [scaleContent, setScaleContent] = useState(true);

  useEffect(() => {
    if (open) {
      setWidth(canvas.width);
      setHeight(canvas.height);
    }
  }, [open, canvas.width, canvas.height]);

  if (!open) return null;

  const aspect = canvas.width / Math.max(1, canvas.height);

  const handleWidthChange = (val: number) => {
    if (lockRatio) {
      const next = computeAspectDimensions('width', val, aspect);
      setWidth(next.width);
      setHeight(next.height);
    } else {
      setWidth(Math.max(1, Math.round(val)));
    }
  };

  const handleHeightChange = (val: number) => {
    if (lockRatio) {
      const next = computeAspectDimensions('height', val, aspect);
      setWidth(next.width);
      setHeight(next.height);
    } else {
      setHeight(Math.max(1, Math.round(val)));
    }
  };

  const handleApply = (e: React.FormEvent) => {
    e.preventDefault();
    resizeCanvas(width, height, scaleContent);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-[#181b22] border border-slate-700/80 rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-800">
          <h2 className="text-sm font-semibold text-slate-100">Đổi kích thước (Resize Canvas)</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-200">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleApply} className="p-5 space-y-4 text-xs">
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <label className="block text-slate-400 mb-1">Chiều rộng (px)</label>
              <input
                type="number"
                min={1}
                max={8000}
                value={width}
                onChange={(e) => handleWidthChange(Number(e.target.value) || 1)}
                className="w-full bg-[#0f1115] border border-slate-700 rounded-lg px-3 py-2 text-slate-100"
              />
            </div>

            <button
              type="button"
              onClick={() => setLockRatio(!lockRatio)}
              title={lockRatio ? 'Đang khóa tỉ lệ' : 'Tự do tỉ lệ'}
              className={`p-2 rounded-lg border mb-0.5 ${
                lockRatio
                  ? 'bg-blue-600/20 border-blue-500 text-blue-300'
                  : 'bg-[#0f1115] border-slate-700 text-slate-400'
              }`}
            >
              {lockRatio ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
            </button>

            <div className="flex-1">
              <label className="block text-slate-400 mb-1">Chiều cao (px)</label>
              <input
                type="number"
                min={1}
                max={8000}
                value={height}
                onChange={(e) => handleHeightChange(Number(e.target.value) || 1)}
                className="w-full bg-[#0f1115] border border-slate-700 rounded-lg px-3 py-2 text-slate-100"
              />
            </div>
          </div>

          <div className="space-y-2 pt-1">
            <label className="block text-slate-400">Chế độ Resize</label>
            <label className="flex items-center gap-2.5 p-2.5 rounded-lg border border-slate-800 bg-[#0f1115] cursor-pointer">
              <input
                type="radio"
                checked={scaleContent}
                onChange={() => setScaleContent(true)}
                className="accent-blue-500"
              />
              <div>
                <div className="text-slate-200 font-medium">Scale toàn bộ nội dung</div>
                <div className="text-slate-400 text-[11px]">
                  Co giãn tất cả ảnh và object sương theo kích thước mới
                </div>
              </div>
            </label>
            <label className="flex items-center gap-2.5 p-2.5 rounded-lg border border-slate-800 bg-[#0f1115] cursor-pointer">
              <input
                type="radio"
                checked={!scaleContent}
                onChange={() => setScaleContent(false)}
                className="accent-blue-500"
              />
              <div>
                <div className="text-slate-200 font-medium">Chỉ đổi kích thước khung Canvas</div>
                <div className="text-slate-400 text-[11px]">
                  Giữ nguyên kích thước gốc của các object bên trong
                </div>
              </div>
            </label>
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
              Áp dụng Resize
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
