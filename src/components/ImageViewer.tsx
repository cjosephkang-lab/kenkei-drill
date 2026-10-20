import { imageViewerWidth } from "../lib/images";

export function ImageViewer({ src, naturalWidth, onClose }: { src: string; naturalWidth: number; onClose: () => void }) {
  return <div className="fixed inset-0 z-30 overflow-auto bg-black/90 p-4" role="dialog" aria-label="画像拡大表示"><button className="fixed right-4 top-4 z-10 rounded-full bg-white px-4 py-2 text-xl font-bold text-black shadow" onClick={onClose} aria-label="閉じる">×</button><div className="flex min-h-full min-w-max items-start justify-start"><img className="mt-12 h-auto max-w-none" style={{ width: imageViewerWidth(naturalWidth) }} src={src} alt="拡大画像" /></div></div>;
}
