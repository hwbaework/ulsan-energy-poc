import { useRef, useState, useCallback, type ChangeEvent, type KeyboardEvent, type DragEvent } from 'react';
import { Upload, X, File } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FileUploadProps {
  accept?: string;
  multiple?: boolean;
  maxSizeMB?: number;
  onChange: (files: File[]) => void;
  error?: string;
  className?: string;
  /** false로 설정하면 내부 파일 목록을 숨깁니다. 부모가 직접 파일 목록을 관리할 때 사용하세요. */
  showList?: boolean;
}

export function FileUpload({
  accept,
  multiple = false,
  maxSizeMB = 10,
  onChange,
  error,
  className,
  showList = true,
}: FileUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [dragOver, setDragOver] = useState(false);
  // dragenter/dragleave는 자식 요소를 오가며 중복 발생하므로 카운터로 관리
  const dragCounter = useRef(0);

  const handleFiles = useCallback(
    (incoming: FileList | null) => {
      if (!incoming || incoming.length === 0) return;
      const valid = Array.from(incoming).filter((f) => f.size <= maxSizeMB * 1024 * 1024);
      if (valid.length === 0) return;
      const next = multiple ? [...files, ...valid] : valid.slice(0, 1);
      setFiles(next);
      // 새로 추가된 파일만 전달 (이전 파일 재업로드 방지)
      onChange(multiple ? valid : next);
    },
    [files, maxSizeMB, multiple, onChange],
  );

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    handleFiles(e.target.files);
    e.target.value = '';
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      inputRef.current?.click();
    }
  }

  function handleDragEnter(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current += 1;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setDragOver(true);
    }
  }

  function handleDragLeave(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current -= 1;
    if (dragCounter.current === 0) {
      setDragOver(false);
    }
  }

  function handleDragOver(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();
  }

  function handleDrop(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    dragCounter.current = 0;
    handleFiles(e.dataTransfer.files);
    e.dataTransfer.clearData();
  }

  function removeFile(index: number) {
    const next = files.filter((_, i) => i !== index);
    setFiles(next);
    onChange(next);
  }

  return (
    <div className={className}>
      <div
        role="button"
        tabIndex={0}
        aria-label={`파일 업로드. 최대 ${maxSizeMB}MB`}
        className={cn(
          'flex flex-col items-center justify-center gap-2 rounded border-2 border-dashed px-4 py-8 cursor-pointer transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50',
          dragOver ? 'border-primary bg-primary/5' : 'border-accent/30 hover:border-accent/50',
          error && 'border-semantic-red',
        )}
        onClick={() => inputRef.current?.click()}
        onKeyDown={handleKeyDown}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        <Upload size={24} className="text-accent/40" aria-hidden="true" />
        <p className="text-sm text-accent">클릭하거나 파일을 드래그하세요</p>
        <p className="text-xs text-accent/40">최대 {maxSizeMB}MB</p>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        onChange={handleChange}
        className="hidden"
        tabIndex={-1}
        aria-hidden="true"
      />
      {showList && files.length > 0 && (
        <ul className="mt-2 space-y-1">
          {files.map((file, i) => (
            <li
              key={`${file.name}-${i}`}
              className="flex items-center gap-2 rounded bg-surface-elevated px-3 py-2 text-sm text-white"
            >
              <File size={14} className="shrink-0 text-accent" aria-hidden="true" />
              <span className="flex-1 truncate">{file.name}</span>
              <span className="text-xs text-accent">{(file.size / 1024).toFixed(0)}KB</span>
              <button
                onClick={() => removeFile(i)}
                className="text-accent hover:text-semantic-red"
                aria-label={`${file.name} 삭제`}
              >
                <X size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}
      {error && (
        <p className="mt-1 text-xs text-semantic-red" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
