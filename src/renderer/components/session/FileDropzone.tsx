import { useState, useRef, type DragEvent } from "react";
import { UploadCloud } from "lucide-react";

interface FileDropzoneProps {
  isConnected: boolean;
  isChannelReady?: boolean;
  onSendFiles: (files: FileList | File[]) => void;
}

export function FileDropzone({
  isConnected,
  isChannelReady = true,
  onSendFiles,
}: FileDropzoneProps): JSX.Element {
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragEnter = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onSendFiles(e.dataTransfer.files);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onSendFiles(e.target.files);
      e.target.value = "";
    }
  };

  return (
    <div
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={() => fileInputRef.current?.click()}
      style={{
        border: isDragOver
          ? "2px dashed var(--accent-primary)"
          : "2px dashed rgba(255, 140, 26, 0.3)",
        backgroundColor: isDragOver
          ? "rgba(255, 122, 0, 0.12)"
          : "rgba(20, 10, 6, 0.55)",
        borderRadius: "16px",
        padding: "1.75rem 1.25rem",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        cursor: isConnected ? "pointer" : "not-allowed",
        transition: "all 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
        boxShadow: isDragOver ? "0 0 25px rgba(255, 122, 0, 0.25)" : "none",
      }}
    >
      <input
        ref={fileInputRef}
        type="file"
        multiple
        onChange={handleFileInputChange}
        style={{ display: "none" }}
        disabled={!isConnected}
      />

      <div
        style={{
          width: 48,
          height: 48,
          borderRadius: "50%",
          backgroundColor: "rgba(255, 122, 0, 0.15)",
          border: "1px solid rgba(255, 140, 26, 0.3)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: "0.75rem",
        }}
      >
        <UploadCloud size={24} color="var(--accent-primary)" />
      </div>

      <div style={{ textAlign: "center" }}>
        <span
          style={{
            fontSize: "0.95rem",
            fontWeight: 700,
            color: "var(--text-primary)",
          }}
        >
          Arraste e solte arquivos aqui
        </span>
        <p
          style={{
            margin: "0.25rem 0 0 0",
            fontSize: "0.8rem",
            color: "rgba(255, 220, 195, 0.6)",
          }}
        >
          ou clique para selecionar do seu computador (suporte a múltiplos
          arquivos)
        </p>
      </div>

      {!isChannelReady && (
        <span
          style={{
            marginTop: "0.65rem",
            fontSize: "0.75rem",
            color: "#f59e0b",
            backgroundColor: "rgba(245, 158, 11, 0.12)",
            padding: "2px 10px",
            borderRadius: "8px",
          }}
        >
          Aguardando canal P2P de arquivos...
        </span>
      )}
    </div>
  );
}
