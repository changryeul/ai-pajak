'use client';

interface UploadBoxProps {
  label: string;
  onFile: (file: File) => void;
  accept?: string;
  multiple?: boolean;
  disabled?: boolean;
}

export function UploadBox({ label, onFile, accept, multiple = false, disabled = false }: UploadBoxProps) {
  return (
    <label
      className={`block w-full cursor-pointer rounded border border-slate-200 p-2 text-xs text-center transition-colors ${
        disabled ? 'bg-slate-50 text-slate-400 cursor-not-allowed' : 'hover:bg-slate-50 hover:border-slate-300'
      }`}
    >
      {label}
      <input
        type="file"
        className="hidden"
        accept={accept}
        multiple={multiple}
        disabled={disabled}
        onChange={(e) => {
          const files = e.target.files;
          if (!files) return;
          if (multiple) {
            Array.from(files).forEach(onFile);
          } else {
            const f = files[0];
            if (f) onFile(f);
          }
          // reset so same file can be re-uploaded
          e.target.value = '';
        }}
      />
    </label>
  );
}
