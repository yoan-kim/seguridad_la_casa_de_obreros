import React, { useRef, useState, useEffect } from 'react';
import { Camera, Upload, Trash2, RefreshCw, CheckCircle2, X, SwitchCamera, Maximize2 } from 'lucide-react';
import { Language, PhotoSlotData, TRANSLATIONS } from '../i18n';
import { compressImageFile } from '../utils/imageCompression';

interface PhotoUploadSlotProps {
  slotNumber: 1 | 2 | 3;
  title: string;
  subtitle: string;
  lang: Language;
  photo: PhotoSlotData | null;
  onPhotoChange: (photo: PhotoSlotData | null) => void;
  onPreviewImage: (dataUrl: string, title: string) => void;
}

export const PhotoUploadSlot: React.FC<PhotoUploadSlotProps> = ({
  slotNumber,
  title,
  subtitle,
  lang,
  photo,
  onPhotoChange,
  onPreviewImage,
}) => {
  const t = TRANSLATIONS[lang];
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const galleryInputRef = useRef<HTMLInputElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const [isCompressing, setIsCompressing] = useState(false);
  const [isLiveCameraOpen, setIsLiveCameraOpen] = useState(false);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [stream, setStream] = useState<MediaStream | null>(null);

  // Stop camera stream on unmount or modal close
  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [stream]);

  const stopLiveCamera = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
    setIsLiveCameraOpen(false);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsCompressing(true);
    try {
      const compressed = await compressImageFile(file);
      onPhotoChange(compressed);
    } catch (err) {
      console.error('Failed to process photo:', err);
    } finally {
      setIsCompressing(false);
      e.target.value = '';
    }
  };

  /**
   * Direct camera button handler:
   * - On mobile/tablet devices with native camera app, triggers `<input type="file" accept="image/*" capture="environment">`
   *   which opens the phone camera directly and uploads straight into this slot upon taking the photo.
   * - On desktop/laptop browsers where `capture` falls back to file explorer, opens live WebRTC camera modal if available.
   */
  const handleDirectCameraClick = async () => {
    const isTouchMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
    if (isTouchMobile) {
      cameraInputRef.current?.click();
      return;
    }

    // Try WebRTC camera stream for desktop or instant preview; fallback to camera input
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      try {
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: facingMode }, width: { ideal: 1280 }, height: { ideal: 960 } },
          audio: false,
        });
        setStream(mediaStream);
        setIsLiveCameraOpen(true);
        setTimeout(() => {
          if (videoRef.current) {
            videoRef.current.srcObject = mediaStream;
            videoRef.current.play().catch(() => {});
          }
        }, 60);
        return;
      } catch {
        // Fallback to native file input with capture="environment"
        cameraInputRef.current?.click();
      }
    } else {
      cameraInputRef.current?.click();
    }
  };

  const switchCameraFacing = async () => {
    const nextFacing = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(nextFacing);
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
    }
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: nextFacing } },
        audio: false,
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        videoRef.current.play().catch(() => {});
      }
    } catch {
      stopLiveCamera();
      cameraInputRef.current?.click();
    }
  };

  const captureFromLiveVideo = async () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 960;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    stopLiveCamera();
    setIsCompressing(true);

    canvas.toBlob(
      async (blob) => {
        if (blob) {
          try {
            const compressed = await compressImageFile(blob);
            onPhotoChange(compressed);
          } finally {
            setIsCompressing(false);
          }
        } else {
          setIsCompressing(false);
        }
      },
      'image/jpeg',
      0.85
    );
  };

  return (
    <div
      className={`rounded-2xl border transition-colors p-5 ${
        photo
          ? 'bg-white border-emerald-300 shadow-xs'
          : 'bg-white border-slate-200 hover:border-slate-300'
      }`}
    >
      {/* Hidden inputs for direct mobile camera capture vs gallery upload */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileChange}
        className="hidden"
      />
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
      />

      {/* Header row */}
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <div className="flex items-center gap-2">
            <span
              className={`inline-flex items-center justify-center w-6 h-6 rounded-md text-xs font-mono-tabular font-semibold ${
                photo ? 'bg-emerald-600 text-white' : 'bg-slate-900 text-white'
              }`}
            >
              0{slotNumber}
            </span>
            <h3 className="text-base font-bold text-slate-900">{title}</h3>
          </div>
          <p className="text-xs text-slate-500 mt-1">{subtitle}</p>
        </div>

        {/* Unboxed status text per zero-pill discipline */}
        <div className="flex items-center gap-1.5 text-xs font-medium shrink-0">
          {photo ? (
            <span className="flex items-center gap-1 text-emerald-700">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{t.photoUploadedStatus}</span>
            </span>
          ) : (
            <span className="text-amber-700">{t.photoPendingStatus}</span>
          )}
        </div>
      </div>

      {/* Main Content Area: Either Uploaded Preview or Camera/Upload Action Buttons */}
      {isCompressing ? (
        <div className="h-48 rounded-xl border border-dashed border-slate-300 bg-slate-50 flex flex-col items-center justify-center gap-2 p-4">
          <RefreshCw className="w-6 h-6 text-blue-600 animate-spin" />
          <span className="text-xs font-medium text-slate-600">{t.compressingPhoto}</span>
        </div>
      ) : photo ? (
        <div className="space-y-3">
          <div className="relative group rounded-xl overflow-hidden border border-slate-200 bg-slate-950 aspect-4/3 max-h-60 w-full flex items-center justify-center">
            <img
              src={photo.dataUrl}
              alt={title}
              className="w-full h-full object-cover cursor-pointer"
              onClick={() => onPreviewImage(photo.dataUrl, title)}
            />
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-3 flex items-center justify-between text-white text-xs">
              <div className="font-mono-tabular flex items-center gap-2">
                <span>{photo.timestamp}</span>
                <span aria-hidden="true">·</span>
                <span>
                  {photo.width}×{photo.height}
                </span>
                <span aria-hidden="true">·</span>
                <span>{photo.sizeKb} KB</span>
              </div>
              <button
                type="button"
                onClick={() => onPreviewImage(photo.dataUrl, title)}
                className="p-1.5 rounded-lg bg-white/20 hover:bg-white/30 text-white transition-colors"
                title="Zoom"
              >
                <Maximize2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Retake / Gallery / Remove Controls */}
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={handleDirectCameraClick}
              className="min-h-[44px] px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap"
            >
              <Camera className="w-4 h-4 shrink-0" />
              <span>{t.btnRetakePhoto}</span>
            </button>
            <button
              type="button"
              onClick={() => galleryInputRef.current?.click()}
              className="min-h-[44px] px-3 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap"
            >
              <Upload className="w-4 h-4 shrink-0" />
              <span>{t.btnUploadGallery}</span>
            </button>
            <button
              type="button"
              onClick={() => onPhotoChange(null)}
              className="min-h-[44px] px-3 py-2 rounded-xl border border-rose-200 hover:bg-rose-50 text-rose-700 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap"
            >
              <Trash2 className="w-4 h-4 shrink-0" />
              <span>{t.btnRemovePhoto}</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/70 p-4 flex flex-col items-center justify-center gap-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full">
            {/* Primary Direct Camera Capture Button */}
            <button
              type="button"
              onClick={handleDirectCameraClick}
              className="min-h-[52px] px-4 py-3 rounded-xl bg-blue-700 hover:bg-blue-800 active:scale-[0.99] text-white text-sm font-semibold flex items-center justify-center gap-2 shadow-xs transition-all cursor-pointer whitespace-nowrap"
            >
              <Camera className="w-5 h-5 shrink-0" />
              <span>{t.btnTakePhoto}</span>
            </button>

            {/* Secondary Gallery Upload Button */}
            <button
              type="button"
              onClick={() => galleryInputRef.current?.click()}
              className="min-h-[52px] px-4 py-3 rounded-xl bg-white hover:bg-slate-100 border border-slate-300 text-slate-800 text-sm font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer whitespace-nowrap"
            >
              <Upload className="w-4 h-4 shrink-0 text-slate-600" />
              <span>{t.btnUploadGallery}</span>
            </button>
          </div>
          <p className="text-[11px] text-slate-500 text-center">{t.cameraFallbackHint}</p>
        </div>
      )}

      {/* Live WebRTC Camera Modal (for desktop/laptop or web preview testing) */}
      {isLiveCameraOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 text-white">
              <div className="flex items-center gap-2">
                <Camera className="w-4 h-4 text-blue-400" />
                <span className="text-sm font-semibold">
                  {t.cameraModalTitle} — {title}
                </span>
              </div>
              <button
                type="button"
                onClick={stopLiveCamera}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="relative bg-black aspect-4/3 w-full flex items-center justify-center">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />
            </div>

            <div className="p-4 flex items-center justify-between gap-3 bg-slate-900">
              <button
                type="button"
                onClick={switchCameraFacing}
                className="min-h-[44px] px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5"
              >
                <SwitchCamera className="w-4 h-4" />
                <span>{t.cameraSwitchBtn}</span>
              </button>

              <button
                type="button"
                onClick={captureFromLiveVideo}
                className="flex-1 min-h-[48px] px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold flex items-center justify-center gap-2"
              >
                <Camera className="w-5 h-5" />
                <span>{t.cameraCaptureBtn}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
