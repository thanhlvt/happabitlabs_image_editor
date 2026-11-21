import React, { useEffect, useState } from 'react';
import { Download, X } from 'lucide-react';
import type { ExportFormat } from '../../types/editor';
import { useEditorStore } from '../../store/useEditorStore';
import { exportCanvasToDataUrl } from '../../utils/exportCanvas';
import { downloadDataUrl } from '../../utils/fileHelpers';

interface ExportModalProps {
  open: boolean;
  onClose: () => void;
}

export const ExportModal: React.FC<ExportModalProps> = ({ open, onClose }) => {
  const { canvas, layers, projectName, lastExportName, setLastExportName } =
    useEditorStore();
  const [filename, setFilename] = useState(
    lastExportName ?? (projectName.trim() || 'edited-image')
  );
  const [format, setFormat] = useState<ExportFormat>('image/png');
  const [scale, setScale] = useState<1 | 2>(1);
  const [quality, setQuality] = useState(0.92);
  const [pngCompression, setPngCompression] = useState(8);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (open) {
      setFilename(lastExportName ?? (projectName.trim() || 'edited-image'));
    }
  }, [open, lastExportName, projectName]);

  if (!open) return null;

  const ext = format === 'image/png' ? 'png' : format === 'image/webp' ? 'webp' : 'jpg';

  const handleExport = async (e: React.FormEvent) => {
    e.preventDefault();
    setExporting(true);
    try {
      const dataUrl = await exportCanvasToDataUrl(
        canvas,
        layers,
        format,
        quality,
        scale,
        pngCompression
      );
      const finalName = filename.trim() || projectName.trim() || 'edited-image';
      setLastExportName(finalName);
      downloadDataUrl(dataUrl, `${finalName}.${ext}`);
      onClose();
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-[#181b22] border border-slate-700/80 rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-800">
          <h2 className="text-sm font-semibold text-slate-100">Xuất ảnh (Export)</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-200">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleExport} className="p-5 space-y-4 text-xs">
          <div>
            <label className="block text-slate-400 mb-1">Tên file</label>
            <div className="flex items-center bg-[#0f1115] border border-slate-700 rounded-lg overflow-hidden">
              <input
                type="text"
                value={filename}
                onChange={(e) => setFilename(e.target.value)}
                className="flex-1 bg-transparent px-3 py-2 text-slate-100 focus:outline-none"
              />
              <span className="px-3 text-slate-400 font-mono">.{ext}</span>
            </div>
          </div>

          <div>
            <label className="block text-slate-400 mb-1.5">Định dạng</label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setFormat('image/png')}
                className={`p-2 rounded-lg border text-center ${
                  format === 'image/png'
                    ? 'bg-blue-600/20 border-blue-500 text-blue-200'
                    : 'bg-[#0f1115] border-slate-800 text-slate-300'
                }`}
              >
                <div className="font-semibold">PNG</div>
                <div className="text-[10px] text-emerald-400">Có kênh Alpha</div>
              </button>
              <button
                type="button"
                onClick={() => setFormat('image/webp')}
                className={`p-2 rounded-lg border text-center ${
                  format === 'image/webp'
                    ? 'bg-blue-600/20 border-blue-500 text-blue-200'
                    : 'bg-[#0f1115] border-slate-800 text-slate-300'
                }`}
              >
                <div className="font-semibold">WebP</div>
                <div className="text-[10px] text-emerald-400">Nhẹ + Alpha</div>
              </button>
              <button
                type="button"
                onClick={() => setFormat('image/jpeg')}
                className={`p-2 rounded-lg border text-center ${
                  format === 'image/jpeg'
                    ? 'bg-blue-600/20 border-blue-500 text-blue-200'
                    : 'bg-[#0f1115] border-slate-800 text-slate-300'
                }`}
              >
                <div className="font-semibold">JPEG</div>
                <div className="text-[10px] text-slate-400">Không Alpha</div>
              </button>
            </div>
          </div>

          <div>
            <label className="block text-slate-400 mb-1.5">Độ phân giải xuất</label>
            <div className="grid grid-cols-2 gap-2">
              {([1, 2] as const).map((s) => (
                <button
                  type="button"
                  key={s}
                  onClick={() => setScale(s)}
                  className={`py-2 px-3 rounded-lg border ${
                    scale === s
                      ? 'bg-blue-600/20 border-blue-500 text-blue-200'
                      : 'bg-[#0f1115] border-slate-800 text-slate-300'
                  }`}
                >
                  {s}x ({canvas.width * s} × {canvas.height * s} px)
                </button>
              ))}
            </div>
          </div>

          {format === 'image/png' ? (
            <div>
              <div className="flex justify-between text-slate-400 mb-1">
                <span>Độ nén PNG</span>
                <span className="font-mono text-cyan-300">{pngCompression}/10</span>
              </div>
              <input
                type="range"
                aria-label="Độ nén PNG"
                min={1}
                max={10}
                step={1}
                value={pngCompression}
                onChange={(e) => setPngCompression(Number(e.target.value))}
                className="w-full accent-cyan-400"
              />
              <p className="text-[11px] text-slate-500 mt-1">
                {pngCompression <= 3
                  ? 'Lossless RGBA (không mất dữ liệu, file lớn hơn)'
                  : 'Nén thông minh giữ kênh Alpha (mức cao giúp giảm dung lượng mạnh)'}
              </p>
            </div>
          ) : (
            <div>
              <div className="flex justify-between text-slate-400 mb-1">
                <span>Chất lượng nén</span>
                <span>{Math.round(quality * 100)}%</span>
              </div>
              <input
                type="range"
                min={0.1}
                max={1}
                step={0.05}
                value={quality}
                onChange={(e) => setQuality(Number(e.target.value))}
                className="w-full accent-blue-500"
              />
            </div>
          )}

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
              disabled={exporting}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-medium"
            >
              <Download className="w-3.5 h-3.5" />
              {exporting ? 'Đang xuất...' : 'Tải ảnh xuống'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
