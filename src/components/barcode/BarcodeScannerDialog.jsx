import React, { useRef, useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Camera, X, AlertCircle, CheckCircle, Maximize2 } from "lucide-react";

export default function BarcodeScannerDialog({ isOpen, onClose, onScan, title = "Scan Barcode" }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [error, setError] = useState(null);
  const [isScanning, setIsScanning] = useState(false);
  const [detectedBarcode, setDetectedBarcode] = useState(null);
  const [manualInput, setManualInput] = useState("");
  const streamRef = useRef(null);
  const scanIntervalRef = useRef(null);
  const [cameraStarted, setCameraStarted] = useState(false);
  const isPlayingRef = useRef(false);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    
    if (isOpen) {
      startCamera();
    } else {
      stopCamera();
    }

    return () => {
      isMountedRef.current = false;
      stopCamera();
    };
  }, [isOpen]);

  const startCamera = async () => {
    setError(null);
    setDetectedBarcode(null);
    setCameraStarted(false);
    isPlayingRef.current = false;
    
    try {
      // Request camera access with rear camera preference for mobile
      const constraints = {
        video: {
          facingMode: { ideal: "environment" }, // Prefer rear camera on mobile
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        }
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      
      // Check if component is still mounted
      if (!isMountedRef.current) {
        stream.getTracks().forEach(track => track.stop());
        return;
      }
      
      streamRef.current = stream;
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        
        // Wait for video metadata to load before playing
        videoRef.current.onloadedmetadata = async () => {
          if (!isMountedRef.current || !videoRef.current) return;
          
          try {
            // Only play if not already playing
            if (!isPlayingRef.current) {
              isPlayingRef.current = true;
              await videoRef.current.play();
              
              if (isMountedRef.current) {
                setCameraStarted(true);
                // Start barcode detection after video is playing
                startBarcodeDetection();
              }
            }
          } catch (playError) {
            // Handle play interruption gracefully
            if (playError.name === 'AbortError') {
              console.log('Play was aborted, this is normal during dialog transitions');
            } else if (playError.name === 'NotAllowedError') {
              setError("Camera playback not allowed. Please grant permissions.");
            } else {
              console.error("Video play error:", playError);
              setError(`Error starting video: ${playError.message}`);
            }
            isPlayingRef.current = false;
          }
        };

        // Handle video errors
        videoRef.current.onerror = (e) => {
          console.error("Video element error:", e);
          setError("Error loading video stream");
          isPlayingRef.current = false;
        };
      }
      
    } catch (err) {
      console.error("Camera access error:", err);
      if (err.name === 'NotAllowedError') {
        setError("Camera access denied. Please grant camera permissions in your browser settings, then click 'Retry Camera'.");
      } else if (err.name === 'NotFoundError') {
        setError("No camera found on this device. Please use manual entry below.");
      } else {
        setError(`Camera error: ${err.message}. Please use manual entry below.`);
      }
    }
  };

  const stopCamera = () => {
    // Stop scanning interval
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
    
    // Stop video stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    
    // Clear video element
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.srcObject = null;
      videoRef.current.onloadedmetadata = null;
      videoRef.current.onerror = null;
    }
    
    setIsScanning(false);
    setCameraStarted(false);
    isPlayingRef.current = false;
  };

  const startBarcodeDetection = async () => {
    // Check if BarcodeDetector API is available (Chrome/Edge on Android, limited desktop support)
    if ('BarcodeDetector' in window) {
      try {
        const barcodeDetector = new window.BarcodeDetector({
          formats: ['code_128', 'code_39', 'code_93', 'codabar', 'ean_13', 'ean_8', 'itf', 'upc_a', 'upc_e', 'qr_code', 'data_matrix', 'aztec', 'pdf417']
        });

        setIsScanning(true);

        scanIntervalRef.current = setInterval(async () => {
          if (!isMountedRef.current || !videoRef.current || videoRef.current.readyState !== videoRef.current.HAVE_ENOUGH_DATA) {
            return;
          }
          
          try {
            const barcodes = await barcodeDetector.detect(videoRef.current);
            if (barcodes.length > 0 && isMountedRef.current) {
              const barcode = barcodes[0].rawValue;
              setDetectedBarcode(barcode);
              setIsScanning(false);
              clearInterval(scanIntervalRef.current);
              
              // Auto-submit after brief delay to show success
              setTimeout(() => {
                if (isMountedRef.current) {
                  handleConfirm(barcode);
                }
              }, 1000);
            }
          } catch (err) {
            console.error("Detection error:", err);
          }
        }, 200); // Scan every 200ms
        
      } catch (err) {
        console.error("BarcodeDetector initialization error:", err);
        setError("Automatic barcode scanning not supported in this browser. Please use manual entry below.");
        setIsScanning(false);
      }
    } else {
      // Fallback message for browsers without BarcodeDetector API
      setError(
        "⚠️ Automatic barcode scanning is only supported in Chrome/Edge on Android. " +
        "You can use the camera view to help read the barcode, then enter it manually below."
      );
      setIsScanning(false);
    }
  };

  const handleConfirm = (barcode) => {
    const barcodeValue = barcode || detectedBarcode || manualInput;
    if (barcodeValue && barcodeValue.trim()) {
      onScan(barcodeValue.trim());
      handleClose();
    }
  };

  const handleClose = () => {
    stopCamera();
    setDetectedBarcode(null);
    setManualInput("");
    setError(null);
    onClose();
  };

  const handleManualSubmit = () => {
    if (manualInput.trim()) {
      handleConfirm(manualInput);
    }
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
            <Alert variant={error.includes('⚠️') ? 'default' : 'destructive'} className="bg-blue-50 border-blue-200">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-sm">{error}</AlertDescription>
            </Alert>
          )}

          {detectedBarcode && (
            <Alert className="bg-emerald-50 border-emerald-200">
              <CheckCircle className="h-4 w-4 text-emerald-600" />
              <AlertDescription className="text-emerald-900">
                <strong>✓ Barcode Detected:</strong> <span className="font-mono text-lg">{detectedBarcode}</span>
              </AlertDescription>
            </Alert>
          )}

          {/* Camera View */}
          <div className="relative bg-black rounded-lg overflow-hidden" style={{ aspectRatio: '16/9' }}>
            <video
              ref={videoRef}
              className="w-full h-full object-cover"
              playsInline
              muted
            />
            <canvas ref={canvasRef} className="hidden" />
            
            {/* Scanning frame overlay */}
            {isScanning && cameraStarted && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="relative">
                  {/* Scanning box */}
                  <div className="w-72 h-48 border-4 border-blue-500 rounded-lg relative bg-blue-500/10">
                    {/* Corner markers */}
                    <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-white"></div>
                    <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-white"></div>
                    <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-white"></div>
                    <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-white"></div>
                    
                    {/* Animated scanning line */}
                    <div className="absolute left-0 right-0 h-1 bg-blue-400 shadow-lg shadow-blue-400" 
                         style={{ animation: 'scan 2s ease-in-out infinite' }} />
                  </div>
                  <p className="text-white text-center mt-4 bg-black/70 px-4 py-2 rounded text-sm">
                    Position barcode within the frame
                  </p>
                </div>
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
          </div>

          {/* Helpful instructions */}
          <div className="text-sm text-slate-600 bg-blue-50 p-4 rounded-lg border border-blue-200">
            <p className="font-semibold mb-2 flex items-center gap-2">
              <Camera className="w-4 h-4" />
              📱 Scanning Instructions:
            </p>
            <ul className="list-disc list-inside space-y-1 text-xs ml-2">
              <li>Hold device steady about 6-10 inches from the barcode</li>
              <li>Ensure good lighting - avoid shadows and glare</li>
              <li>Keep the barcode flat and centered in the blue frame</li>
              <li>For 1D barcodes (lines), hold horizontally</li>
              <li>If auto-scan doesn't work, enter the code manually below</li>
            </ul>
          </div>

          {/* Manual Entry Fallback */}
          <div className="space-y-3 border-t pt-4">
            <Label className="text-sm font-semibold">Or Enter Code Manually:</Label>
            <div className="flex gap-2">
              <Input
                placeholder="Enter barcode or ID..."
                value={manualInput}
                onChange={(e) => setManualInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleManualSubmit()}
                className="flex-1"
              />
              <Button onClick={handleManualSubmit} disabled={!manualInput.trim()} className="bg-emerald-600 hover:bg-emerald-700">
                Submit
              </Button>
            </div>
          </div>
        </div>

        <DialogFooter className="flex justify-between">
          <div className="flex gap-2">
            {error && (
              <Button variant="outline" onClick={startCamera} className="text-blue-600 border-blue-600">
                <Camera className="w-4 h-4 mr-2" />
                Retry Camera
              </Button>
            )}
          </div>
          <Button variant="outline" onClick={handleClose}>
            <X className="w-4 h-4 mr-2" />
            Cancel
          </Button>
        </DialogFooter>

        <style>{`
          @keyframes scan {
            0%, 100% { top: 0; }
            50% { top: calc(100% - 4px); }
          }
        `}</style>
      </DialogContent>
    </Dialog>
  );
}