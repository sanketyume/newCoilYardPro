import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Package, CheckCircle, Layers, ArrowUp, Camera } from "lucide-react";
import BarcodeScannerDialog from "../barcode/BarcodeScannerDialog";

export default function StackView({ location, coils, onAssignCoil, onRemoveCoil, isProcessing }) {
  const [coilBarcode, setCoilBarcode] = useState('');
  const [selectedLayer, setSelectedLayer] = useState('');
  const [showBarcodeScanner, setShowBarcodeScanner] = useState(false);

  const stack = location.stack || [];
  const maxLayers = location.max_layers || 3;

  // Get list of empty layers
  const emptyLayers = [];
  for (let i = 1; i <= maxLayers; i++) {
    const isOccupied = stack.some(item => item.level === i);
    if (!isOccupied) {
      emptyLayers.push(i);
    }
  }

  // Set default selected layer when empty layers change
  React.useEffect(() => {
    if (emptyLayers.length > 0 && !selectedLayer) {
      setSelectedLayer(emptyLayers[0].toString());
    }
  }, [emptyLayers, selectedLayer]);

  const renderLayer = (level) => {
    const coilInLayer = stack.find(item => item.level === level);
    const coilData = coilInLayer ? coils.find(c => c.barcode === coilInLayer.coil_barcode) : null;
    
    // Find the highest occupied level to determine which coil can be removed
    const highestOccupiedLevel = stack.reduce((max, item) => Math.max(max, item.level), 0);

    const layerStyle = {
      transform: `translateZ(${(level - 1) * -40}px) translateY(${(level - 1) * -20}px)`,
      zIndex: level,
    };

    return (
      <div
        key={level}
        style={layerStyle}
        className="absolute w-full h-full transition-transform duration-500"
      >
        <div className={`
          group relative w-56 h-24 mx-auto border-2 rounded-xl
          transition-all duration-300 flex items-center justify-center
          ${coilInLayer ? 'bg-blue-200 border-blue-400 shadow-md' :
            'bg-slate-100 border-slate-300'
          }
        `}>
          {coilInLayer && coilData ? (
            <div className="text-center">
              <Package className="w-6 h-6 text-blue-800 mx-auto mb-1" />
              <p className="font-bold text-blue-900 text-sm">{coilData.barcode}</p>
              <p className="text-xs text-slate-600">{coilData.weight} tons</p>
              <Button
                size="xs"
                variant="destructive"
                className="absolute -top-2 -right-2 w-6 h-6 p-0 opacity-0 group-hover:opacity-100"
                onClick={() => onRemoveCoil({ location, level })}
                disabled={isProcessing || level !== highestOccupiedLevel}
                title={level !== highestOccupiedLevel ? "Can only remove the top coil" : "Remove Coil"}
              >
                ×
              </Button>
            </div>
          ) : (
            <div className="text-center">
              <Layers className="w-6 h-6 text-slate-400 mx-auto mb-1" />
              <p className="text-xs text-slate-500">Level {level}</p>
              <p className="text-xs text-slate-400">(Empty)</p>
            </div>
          )}
        </div>
      </div>
    );
  };

  const stackWeight = stack.reduce((sum, item) => {
    const coil = coils.find(c => c.barcode === item.coil_barcode);
    return sum + (coil?.weight || 0);
  }, 0);

  const handleBarcodeScanned = (barcode) => {
    setCoilBarcode(barcode);
    setShowBarcodeScanner(false);
  };

  const handleAssign = () => {
    if (!coilBarcode.trim() || !selectedLayer) return;
    onAssignCoil({ location, level: parseInt(selectedLayer, 10), coilBarcode });
    setCoilBarcode('');
    setSelectedLayer('');
  };

  return (
    <>
      <div className="flex flex-col lg:flex-row gap-8 items-start">
        {/* 3D Stack visualization */}
        <div className="flex-1 flex items-center justify-center min-h-[350px] lg:min-h-[400px]">
          <div
            className="relative w-56 h-24"
            style={{ perspective: '800px', transformStyle: 'preserve-3d', transform: 'rotateX(20deg)' }}
          >
            {[...Array(maxLayers)].map((_, i) => renderLayer(maxLayers - i))}
          </div>
        </div>

        {/* Info and Input */}
        <div className="w-full lg:w-80 space-y-6">
          <Card>
            <CardContent className="p-4">
              <h3 className="text-md font-bold text-slate-900 mb-3">Location Details</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-600">Location:</span>
                  <span className="font-bold font-mono">{location.location_code}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Stack:</span>
                  <span className="font-bold">{stack.length} / {maxLayers} Coils</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-600">Weight:</span>
                  <span className="font-bold">{stackWeight.toFixed(2)} / {location.capacity_tons}t</span>
                </div>
                <div className="w-full bg-slate-200 rounded-full h-2 mt-1">
                  <div
                    className="bg-blue-600 h-2 rounded-full"
                    style={{ width: `${(stackWeight / location.capacity_tons) * 100}%` }}
                  ></div>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <h3 className="text-md font-bold text-slate-900 mb-3">Assign New Coil</h3>
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Coil Barcode</Label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Scan or enter barcode..."
                      value={coilBarcode}
                      onChange={(e) => setCoilBarcode(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && handleAssign()}
                      className="h-10 flex-grow"
                    />
                    <Button
                      variant="outline"
                      onClick={() => setShowBarcodeScanner(true)}
                      className="h-10 px-3 border-2 border-blue-600 text-blue-600 hover:bg-blue-50"
                      title="Scan with camera"
                    >
                      <Camera className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Select Layer</Label>
                  <Select value={selectedLayer} onValueChange={setSelectedLayer}>
                    <SelectTrigger className="h-10">
                      <SelectValue placeholder="Choose empty layer..." />
                    </SelectTrigger>
                    <SelectContent>
                      {emptyLayers.length > 0 ? (
                        emptyLayers.map(layer => (
                          <SelectItem key={layer} value={layer.toString()}>
                            Layer {layer}
                          </SelectItem>
                        ))
                      ) : (
                        <SelectItem value="none" disabled>No empty layers</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>

                <Button
                  onClick={handleAssign}
                  disabled={!coilBarcode.trim() || !selectedLayer || isProcessing || emptyLayers.length === 0}
                  className="w-full bg-emerald-600 hover:bg-emerald-700"
                >
                  <ArrowUp className="w-4 h-4 mr-2" />
                  Assign to Layer {selectedLayer || '...'}
                </Button>
                
                {emptyLayers.length === 0 && (
                  <p className="text-xs text-slate-500 text-center">
                    Stack is full ({maxLayers}/{maxLayers} layers occupied)
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <BarcodeScannerDialog
        isOpen={showBarcodeScanner}
        onClose={() => setShowBarcodeScanner(false)}
        onScan={handleBarcodeScanned}
        title="Scan Coil Barcode"
      />
    </>
  );
}