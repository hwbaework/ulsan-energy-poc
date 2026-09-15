'use client';

import { useRef, useState, useEffect, useCallback } from 'react';
import { Check, Pen, Type, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';

type SignMethod = 'draw' | 'type';

interface ContractSignatureProps {
  contractTitle: string;
  contractSummary: string[];
  signerName: string;
  onSign: (signatureData: { method: SignMethod; image?: string; typedName?: string }) => void;
  loading?: boolean;
}

export function ContractSignature({
  contractTitle,
  contractSummary,
  signerName,
  onSign,
  loading,
}: ContractSignatureProps) {
  const [agreed, setAgreed] = useState(false);
  const [method, setMethod] = useState<SignMethod>('draw');
  const [typedName, setTypedName] = useState(signerName);
  const [signed, setSigned] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawing = useRef(false);

  const clearCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#0d1520';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#e2e8f0';
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(20, canvas.height - 30);
    ctx.lineTo(canvas.width - 20, canvas.height - 30);
    ctx.stroke();
    ctx.setLineDash([]);
    setSigned(false);
  }, []);

  // 캔버스는 agreed 체크 후 method==='draw'일 때 마운트되므로, 그 시점에 초기화되도록 의존성에 포함
  useEffect(() => {
    if (agreed && method === 'draw') clearCanvas();
  }, [clearCanvas, agreed, method]);

  const getPos = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    // 표시 크기(CSS px) → 캔버스 내부 해상도(400x150)로 좌표 보정
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const clientX = 'touches' in e ? (e as React.TouchEvent).touches[0]!.clientX : (e as React.MouseEvent).clientX;
    const clientY = 'touches' in e ? (e as React.TouchEvent).touches[0]!.clientY : (e as React.MouseEvent).clientY;
    return { x: (clientX - rect.left) * scaleX, y: (clientY - rect.top) * scaleY };
  };

  const startDraw = (e: React.MouseEvent | React.TouchEvent) => {
    isDrawing.current = true;
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const pos = getPos(e);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing.current) return;
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const pos = getPos(e);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    setSigned(true);
  };

  const endDraw = () => {
    isDrawing.current = false;
  };

  const handleSign = () => {
    if (method === 'draw') {
      const image = canvasRef.current?.toDataURL('image/png');
      onSign({ method: 'draw', image });
    } else {
      onSign({ method: 'type', typedName });
    }
  };

  const canSign = agreed && (method === 'type' ? typedName.trim().length > 0 : signed);

  return (
    <div className="space-y-5">
      <div className="rounded-xl bg-[#0d1520] ring-1 ring-white/[0.08] p-5">
        <h3 className="text-sm font-semibold text-white mb-3">{contractTitle}</h3>
        <div className="space-y-2 max-h-40 overflow-y-auto">
          {contractSummary.map((line, i) => (
            <p key={i} className="text-xs text-slate-400 leading-relaxed">
              {line}
            </p>
          ))}
        </div>
      </div>

      <label className="flex items-start gap-3 cursor-pointer group">
        <input
          type="checkbox"
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
          className="mt-0.5 h-4 w-4 rounded border-white/20 bg-white/[0.04] text-sky-500 focus:ring-sky-500/30"
        />
        <span className="text-xs text-slate-300 group-hover:text-white transition-colors">
          위 계약 내용을 확인하였으며, 전자서명에 동의합니다. 본 전자서명은 서면 서명과 동일한 법적 효력을 가집니다.
        </span>
      </label>

      {agreed && (
        <>
          <div className="flex gap-2">
            <button
              onClick={() => setMethod('draw')}
              className={cn(
                'flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-medium transition-colors border',
                method === 'draw'
                  ? 'bg-sky-500/10 text-sky-400 border-sky-500/30'
                  : 'bg-white/[0.03] text-slate-400 border-white/[0.06] hover:bg-white/[0.06]',
              )}
            >
              <Pen size={14} /> 직접 서명
            </button>
            <button
              onClick={() => setMethod('type')}
              className={cn(
                'flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-medium transition-colors border',
                method === 'type'
                  ? 'bg-sky-500/10 text-sky-400 border-sky-500/30'
                  : 'bg-white/[0.03] text-slate-400 border-white/[0.06] hover:bg-white/[0.06]',
              )}
            >
              <Type size={14} /> 이름 입력
            </button>
          </div>

          {method === 'draw' ? (
            <div className="space-y-2">
              <div className="relative rounded-lg overflow-hidden ring-1 ring-white/[0.08]">
                <canvas
                  ref={canvasRef}
                  width={400}
                  height={150}
                  className="w-full cursor-crosshair touch-none"
                  onMouseDown={startDraw}
                  onMouseMove={draw}
                  onMouseUp={endDraw}
                  onMouseLeave={endDraw}
                  onTouchStart={startDraw}
                  onTouchMove={draw}
                  onTouchEnd={endDraw}
                />
                {!signed && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <span className="text-xs text-slate-600">마우스 또는 터치로 서명하세요</span>
                  </div>
                )}
              </div>
              <button
                onClick={clearCanvas}
                className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-300"
              >
                <RotateCcw size={12} /> 다시 그리기
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <input
                type="text"
                value={typedName}
                onChange={(e) => setTypedName(e.target.value)}
                placeholder="서명자 이름을 입력하세요"
                className="w-full px-4 py-3 bg-white/[0.04] border border-white/[0.08] rounded-lg text-sm text-slate-200 focus:outline-none focus:border-sky-500/50"
              />
              {typedName.trim() && (
                <div className="flex items-center justify-center py-6 bg-[#0d1520] rounded-lg ring-1 ring-white/[0.08]">
                  <span
                    className="text-2xl text-white"
                    style={{ fontFamily: "'Nanum Pen Script', 'Gaegu', cursive", letterSpacing: '0.05em' }}
                  >
                    {typedName}
                  </span>
                </div>
              )}
            </div>
          )}

          <Button className="w-full" onClick={handleSign} disabled={!canSign || loading}>
            <Check size={14} className="mr-1" />
            {loading ? '서명 처리 중...' : '전자서명 완료'}
          </Button>
        </>
      )}
    </div>
  );
}
