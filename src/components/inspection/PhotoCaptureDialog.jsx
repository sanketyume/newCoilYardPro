import React, { useRef, useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Camera, X, AlertCircle, CheckCircle, RotateCcw } from "lucide-react";

export default function PhotoCaptureDialog({ isOpen, onClose, onCapture, title = "Capture Photo" }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [error, setError] = useState(null);
  const [capturedImage, setCapturedImage] = useState(null);
  const streamRef = useRef(null);
  const [cameraStarted, setCameraStarted] = useState(false);

  useEffect(() => {
    if (isOpen) {
      startCamera();
    } else {
      stopCamera();
    }

    return () => {
      stopCamera();
    };
  }, [isOpen]);

  const startCamera = async () => {
    setError(null);
    setCapturedImage(null);
    setCameraStarted(false);
    
    try {
      const constraints = {
        video: {
          facingMode: { ideal: "environment" }, // Prefer rear camera on mobile
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        }
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setCameraStarted(true);
      }
      
    } catch (err) {
      console.error("Camera access error:", err);
      if (err.name === 'NotAllowedError') {
        setError("Camera access denied. Please grant camera permissions in your browser settings.");
      } else if (err.name === 'NotFoundError') {
        setError("No camera found on this device.");
      } else {
        setError(`Camera error: ${err.message}`);
      }
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    
    setCameraStarted(false);
    setCapturedImage(null);
  };

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    // Set canvas dimensions to match video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    // Draw current video frame to canvas
    const context = canvas.getContext('2d');
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    // Convert canvas to blob/file
    canvas.toBlob((blob) => {
      if (blob) {
        const imageUrl = URL.createObjectURL(blob);
        setCapturedImage(imageUrl);
        
        // Pause the video stream
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.enabled = false);
        }
      }
    }, 'image/jpeg', 0.95);
  };

  const retake = () => {
    setCapturedImage(null);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.enabled = true);
    }
  };

  const handleConfirm = () => {
    if (!capturedImage || !canvasRef.current) return;
    
    canvasRef.current.toBlob((blob) => {
      if (blob) {
        // Create a File object from the blob
        const file = new File([blob], `inspection_${Date.now()}.jpg`, { type: 'image/jpeg' });
        onCapture(file);
        handleClose();
      }
    }, 'image/jpeg', 0.95);
  };

  const handleClose = () => {
    stopCamera();
    setCapturedImage(null);
    setError(null);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Camera className="w-5 h-5" />
            {title}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Camera/Captured Image View */}
          <div className="relative bg-black rounded-lg overflow-hidden" style={{ aspectRatio: '4/3' }}>
            {!capturedImage ? (
              <>
                <video
                  ref={videoRef}
                  className="w-full h-full object-cover"
                  playsInline
                  muted
                  autoPlay
                />
                
                {/* Grid overlay for composition */}
                {cameraStarted && (
                  <div className="absolute inset-0 pointer-events-none">
                    <svg className="w-full h-full opacity-30">
                      <line x1="33%" y1="0" x2="33%" y2="100%" stroke="white" strokeWidth="1"/>
                      <line x1="66%" y1="0" x2="66%" y2="100%" stroke="white" strokeWidth="1"/>
                      <line x1="0" y1="33%" x2="100%" y2="33%" stroke="white" strokeWidth="1"/>
                      <line x1="0" y1="66%" x2="100%" y2="66%" stroke="white" strokeWidth="1"/>
                    </svg>
                  </div>
                )}

                {/* Loading indicator */}
                {!cameraStarted && !error && (
                  <div className="absolute inset-0 flex items-center justify-center bg-slate-900/50">
                    <div className="text-center text-white">
                      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
                      <p>Starting camera...</p>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <img src={capturedImage} alt="Captured" className="w-full h-full object-contain" />
            )}
            
            <canvas ref={canvasRef} className="hidden" />
          </div>

          {/* Instructions */}
          {!capturedImage && (
            <div className="text-sm text-slate-600 bg-blue-50 p-4 rounded-lg border border-blue-200">
              <p className="font-semibold mb-2 flex items-center gap-2">
                <Camera className="w-4 h-4" />
                📸 Photo Tips:
              </p>
              <ul className="list-disc list-inside space-y-1 text-xs ml-2">
                <li>Hold device steady and ensure good lighting</li>
                <li>Frame the subject clearly - avoid clutter in background</li>
                <li>Use the grid lines to compose your shot</li>
                <li>Capture any defects, damages, or notable features</li>
                <li>You can retake if not satisfied with the result</li>
              </ul>
            </div>
          )}

          {/* Capture success message */}
          {capturedImage && (
            <Alert className="bg-emerald-50 border-emerald-200">
              <CheckCircle className="h-4 w-4 text-emerald-600" />
              <AlertDescription className="text-emerald-900">
                <strong>✓ Photo Captured!</strong> Review the image and confirm, or retake if needed.
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter className="flex justify-between">
          <div className="flex gap-2">
            {capturedImage ? (
              <Button variant="outline" onClick={retake} className="text-orange-600 border-orange-600">
                <RotateCcw className="w-4 h-4 mr-2" />
                Retake
              </Button>
            ) : (
              <Button 
                onClick={capturePhoto} 
                disabled={!cameraStarted}
                className="bg-blue-600 hover:bg-blue-700"
              >
                <Camera className="w-4 h-4 mr-2" />
                Capture Photo
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            {capturedImage && (
              <Button onClick={handleConfirm} className="bg-emerald-600 hover:bg-emerald-700">
                <CheckCircle className="w-4 h-4 mr-2" />
                Use This Photo
              </Button>
            )}
            <Button variant="outline" onClick={handleClose}>
              <X className="w-4 h-4 mr-2" />
              Cancel
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}