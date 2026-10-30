import { useRef } from "react";
import {
  exportRecords,
  importRecords,
  RECORDS_BACKUP_KEY,
  RECORDS_KEY,
  type RecordsState,
} from "./records";

export function useRecordFiles(
  records: RecordsState,
  persist: (next: RecordsState) => boolean,
  onError: (message: string) => void,
) {
  const fileInput = useRef<HTMLInputElement>(null);
  const download = () => {
    const blob = new Blob([exportRecords(records)], {
      type: "application/json",
    });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "kenkei-drill-records.json";
    link.click();
    URL.revokeObjectURL(link.href);
  };
  const upload = async (file?: File) => {
    if (!file) return;
    let imported: RecordsState;
    try {
      imported = importRecords(await file.text());
    } catch {
      try {
        const old = localStorage.getItem(RECORDS_KEY);
        if (old) localStorage.setItem(RECORDS_BACKUP_KEY, old);
        onError("記録ファイルの形式が正しくありません");
      } catch {
        onError(
          "記録ファイルの形式が正しくありません。元の記録の退避にも失敗しました。記録を書き出してください",
        );
      }
      return;
    }
    if (persist(imported)) onError("");
  };
  return { fileInput, download, upload };
}
