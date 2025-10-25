
import React, { useState, useMemo, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { MapPin, Eye, X, Search, AlertCircle, Camera, Layers } from "lucide-react";
import { groupBy } from 'lodash';
import { Alert, AlertDescription } from "@/components/ui/alert";
import BarcodeScannerDialog from "../components/barcode/BarcodeScannerDialog";
import { getCoilIdFromBarcode } from '../components/utils/barcodeParser';
import LayeredStackVisualization from "../components/stacking/LayeredStackVisualization";

export default function YardLayout() {
  const [selectedBayName, setSelectedBayName] = useState(null);
  const [selectedZoneName, setSelectedZoneName] = useState(null);
  const [selectedLocationForStack, setSelectedLocationForStack] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showBarcodeScanner, setShowBarcodeScanner] = useState(false);
  const [highlightedLocationId, setHighlightedLocationId] = useState(null);
  const [searchMessage, setSearchMessage] = useState(null);
  const highlightedRef = useRef(null);

  useEffect(() => {
    const size = localStorage.getItem('placeholderSize') || '96';
    document.documentElement.style.setProperty('--placeholder-size', `${size}px`);
  }, []);

  const { data: locations = [] } = useQuery({
    queryKey: ['locations'],
    queryFn: () => base44.entities.StorageLocation.list(),
  });

  const { data: stackingPositions = [] } = useQuery({
    queryKey: ['stackingPositions'],
    queryFn: () => base44.entities.StackingPosition.list(),
  });

  const { data: coils = [] } = useQuery({
    queryKey: ['coils'],
    queryFn: () => base44.entities.Coil.list(),
  });

  useEffect(() => {
    if (highlightedLocationId && highlightedRef.current) {
        highlightedRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [highlightedLocationId, selectedBayName, selectedZoneName]);

  const handleBarcodeScanned = (barcode) => {
    setSearchQuery(barcode);
    setShowBarcodeScanner(false);
    setTimeout(() => {
      handleSearchWithBarcode(barcode);
    }, 100);
  };

  const handleSearchWithBarcode = (barcodeToSearch = null) => {
    const queryToSearch = barcodeToSearch || searchQuery;
    setSearchMessage(null);
    setHighlightedLocationId(null);
    if (!queryToSearch.trim()) return;

    // Extract core coil ID from barcode or use as-is if it's already just an ID
    const coreCoilId = getCoilIdFromBarcode(queryToSearch);

    // Find stacking position containing this coil
    const foundPosition = stackingPositions.find(pos => 
      pos.coil_barcode === coreCoilId && pos.is_active && pos.is_visible
    );

    if (foundPosition) {
      setHighlightedLocationId(foundPosition.primary_ground_location_id);
      setSelectedBayName(foundPosition.bay);
      setSelectedZoneName(foundPosition.zone);
      setSearchMessage({ 
        type: 'success', 
        text: `✓ Coil "${coreCoilId}" found at ${foundPosition.placeholder_id}` 
      });
    } else {
      setSearchMessage({ 
        type: 'error', 
        text: `Coil "${coreCoilId}" not found in any active or visible location.` 
      });
    }
  };

  const handleSearch = () => handleSearchWithBarcode();

  const locationsByBay = useMemo(() => groupBy(locations.filter(l => l.is_visible), 'bay'), [locations]);
  const zonesByBay = useMemo(() => {
    const result = {};
    for (const bayName in locationsByBay) {
      result[bayName] = groupBy(locationsByBay[bayName], 'zone');
    }
    return result;
  }, [locationsByBay]);

  const getBayStats = (bayName) => {
    const bayLocations = locationsByBay[bayName] || [];
    const bayPositions = stackingPositions.filter(pos => 
      pos.bay === bayName && pos.is_active && pos.is_visible
    );
    const occupied = bayPositions.filter(pos => pos.coil_barcode).length;
    const total = bayPositions.length;
    return { occupied, total, percentage: total > 0 ? (occupied / total * 100) : 0 };
  };

  const getLocationStyle = (location) => {
    if (!location || !location.is_active) return 'bg-slate-100 border-slate-300 opacity-50';
    
    // Count stacking positions for this location
    const relatedPositions = stackingPositions.filter(pos =>
      pos.primary_ground_location_id === location.id && pos.is_active
    );
    const occupiedCount = relatedPositions.filter(pos => pos.coil_barcode).length;
    const totalCount = relatedPositions.length;

    if (totalCount === 0 || occupiedCount === 0) return 'bg-emerald-50 border-emerald-300 hover:border-emerald-500';
    if (occupiedCount >= totalCount) return 'bg-red-200 border-red-400';
    return 'bg-yellow-100 border-yellow-400';
  };
  
  const getTopCoilBarcode = (location) => {
    // Get all positions for this location
    const relatedPositions = stackingPositions.filter(pos =>
      pos.primary_ground_location_id === location.id && pos.coil_barcode
    );
    
    if (relatedPositions.length === 0) return null;
    
    // Find the position with the highest layer
    const topPosition = relatedPositions.reduce((top, current) => {
      if (!top) return current;
      return current.layer > top.layer ? current : top;
    }, null);
    
    return topPosition ? topPosition.coil_barcode : null;
  };

  const getLocationOccupancyCount = (location) => {
    const relatedPositions = stackingPositions.filter(pos =>
      pos.primary_ground_location_id === location.id && pos.is_active && pos.coil_barcode
    );
    return relatedPositions.length;
  };

  // Get all coils for a location to display
  const getLocationCoilIds = (location) => {
    const relatedPositions = stackingPositions.filter(pos =>
      pos.primary_ground_location_id === location.id && pos.is_active && pos.coil_barcode
    ).sort((a, b) => a.layer - b.layer); // Sort by layer
    
    return relatedPositions.map(pos => pos.coil_barcode);
  };

  const renderLocationGrid = (zoneLocations) => {
    if (!zoneLocations || zoneLocations.length === 0) {
      return <p className="p-4 text-sm text-slate-500">No locations configured for this zone.</p>;
    }
    
    const maxRow = Math.max(...zoneLocations.map(l => l.row_num || 0));
    const maxCol = Math.max(...zoneLocations.map(l => l.col_num || 0));

    if (maxRow === 0 || maxCol === 0) {
      return <p className="text-sm text-slate-500 p-4">Locations in this zone do not have row/column data. Please configure them in the Masters page.</p>;
    }

    const grid = Array(maxRow).fill(null).map(() => Array(maxCol).fill(null));
    zoneLocations.forEach(loc => {
      if(loc.row_num > 0 && loc.col_num > 0 && loc.row_num <= maxRow && loc.col_num <= maxCol) {
        grid[loc.row_num - 1][loc.col_num - 1] = loc;
      }
    });

    return (
      <div className="grid gap-1.5 p-2 overflow-x-auto" style={{gridTemplateColumns: `repeat(${maxCol}, var(--placeholder-size, 6rem))`}}>
        {grid.flat().map((loc, index) => {
          const topCoil = loc ? getTopCoilBarcode(loc) : null; // Keep if needed elsewhere, but replaced visually
          const occupancyCount = loc ? getLocationOccupancyCount(loc) : 0;
          const coilIds = loc ? getLocationCoilIds(loc) : [];
          
          return (
            <div
              key={loc?.id || `empty-${index}`}
              ref={loc?.id === highlightedLocationId ? highlightedRef : null}
              className={`
                relative aspect-square rounded border-2 flex items-center justify-center text-xs
                transition-all duration-200
                ${loc && loc.is_active ? 'cursor-pointer' : 'cursor-not-allowed'}
                ${getLocationStyle(loc)}
                ${loc?.id === highlightedLocationId ? 'ring-4 ring-indigo-500 shadow-xl z-10 scale-105' : ''}
              `}
              onClick={() => loc && loc.is_active && setSelectedLocationForStack(loc)}
              title={loc?.location_code}
            >
              {loc && (
                <>
                  <div className="flex flex-col items-center justify-center p-1 text-center w-full">
                    <span className="font-bold text-slate-800 break-all text-[10px]">{loc.location_code}</span>
                    {coilIds.length > 0 && (
                      <div className="mt-1 w-full space-y-0.5">
                        {coilIds.map((coilId, idx) => (
                          <div 
                            key={idx}
                            className="text-[8px] text-blue-800 font-mono break-all bg-blue-100 px-1 rounded"
                          >
                            {coilId}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  {occupancyCount > 0 && (
                    <div className="absolute -top-1.5 -right-1.5 flex items-center justify-center w-5 h-5 bg-blue-900 text-white text-[10px] rounded-full shadow font-bold">
                      {occupancyCount}
                    </div>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="p-6 lg:p-8 bg-slate-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900">Yard Layout - Eagle Eye View</h1>
          <p className="text-slate-600 mt-2">Complete visual map of all storage bays and stacking positions</p>
        </div>

        {/* Coil Search Section */}
        <Card className="mb-8 shadow-lg border-none">
            <CardHeader>
                <CardTitle className="flex items-center gap-2"><Search className="w-5 h-5 text-slate-700"/> Find a Coil</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="flex flex-col sm:flex-row gap-4">
                    <Input
                        placeholder='Scan barcode or enter Coil ID (e.g., "24AC40001" or full barcode)'
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                        className="flex-grow"
                    />
                    <div className="flex gap-2">
                        <Button 
                          onClick={() => setShowBarcodeScanner(true)} 
                          variant="outline"
                          className="w-full sm:w-auto border-2 border-blue-600 text-blue-600 hover:bg-blue-50"
                        >
                          <Camera className="w-4 h-4 mr-2"/> Scan Barcode
                        </Button>
                        <Button onClick={handleSearch} className="bg-blue-900 hover:bg-blue-800 w-full sm:w-auto">
                            <Search className="w-4 h-4 mr-2"/> Search
                        </Button>
                        <Button variant="outline" onClick={() => { setSearchQuery(''); setHighlightedLocationId(null); setSearchMessage(null); setSelectedBayName(null); setSelectedZoneName(null); }} className="w-full sm:w-auto">
                            Clear
                        </Button>
                    </div>
                </div>
                {searchMessage && (
                     <Alert variant={searchMessage.type === 'error' ? 'destructive' : 'default'} className="mt-4">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>{searchMessage.text}</AlertDescription>
                    </Alert>
                )}
            </CardContent>
        </Card>

        {/* Eagle Eye View - All Bays */}
        <div className="grid lg:grid-cols-3 gap-6 mb-8">
          {Object.keys(locationsByBay).sort().map((bayName) => {
            const stats = getBayStats(bayName);
            return (
              <Card
                key={bayName}
                className="cursor-pointer hover:shadow-xl transition-all duration-300 border-none overflow-hidden"
                onClick={() => {
                  setSelectedBayName(bayName);
                  setSelectedZoneName(null);
                  setHighlightedLocationId(null);
                }}
              >
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-xl">{bayName}</CardTitle>
                    <Eye className="w-5 h-5 text-slate-400" />
                  </div>
                </CardHeader>
               <CardContent>
                  <div className="flex items-center gap-4 mt-1">
                    <div className="text-sm">
                      <span className="text-slate-500">Occupied Positions:</span>
                      <span className="ml-2 font-bold text-slate-900">{stats.occupied}/{stats.total}</span>
                    </div>
                  </div>
                   <div className="flex-1 mt-2">
                      <div className="w-full bg-slate-200 rounded-full h-2.5">
                        <div
                          className={`bg-blue-800 h-2.5 rounded-full transition-all duration-300`}
                          style={{ width: `${stats.percentage}%` }}
                        />
                      </div>
                    </div>
                </CardContent>
                <CardContent className="space-y-3">
                  {Object.keys(zonesByBay[bayName] || {}).sort().map((zoneName) => (
                    <div
                      key={zoneName}
                      className="flex items-center justify-between p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedBayName(bayName);
                        setSelectedZoneName(zoneName);
                        setHighlightedLocationId(null);
                      }}
                    >
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-slate-400" />
                        <span className="text-sm font-medium text-slate-700">{zoneName}</span>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            );
          })}
        </div>
        
        {/* Legend */}
        <Card className="mt-6 shadow-lg border-none">
          <CardHeader><CardTitle>Legend</CardTitle></CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-x-6 gap-y-3">
              <div className="flex items-center gap-2"><div className="w-5 h-5 bg-emerald-50 border-2 border-emerald-300 rounded"></div><span className="text-sm text-slate-600">Empty (All positions available)</span></div>
              <div className="flex items-center gap-2"><div className="w-5 h-5 bg-yellow-100 border-2 border-yellow-400 rounded"></div><span className="text-sm text-slate-600">Partially Filled</span></div>
              <div className="flex items-center gap-2"><div className="w-5 h-5 bg-red-200 border-2 border-red-400 rounded"></div><span className="text-sm text-slate-600">Full (All positions occupied)</span></div>
               <div className="flex items-center gap-2"><div className="w-5 h-5 bg-slate-100 border-2 border-slate-300 rounded opacity-50"></div><span className="text-sm text-slate-600">Not Configured / Inactive</span></div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Bay View Dialog */}
      <Dialog open={!!selectedBayName && !selectedZoneName} onOpenChange={() => {setSelectedBayName(null); setHighlightedLocationId(null); setSearchMessage(null);}}>
        <DialogContent className="max-w-7xl max-h-[90vh] overflow-y-auto">
           <DialogHeader>
            <DialogTitle className="text-2xl">{selectedBayName}</DialogTitle>
            <Button variant="ghost" size="icon" className="absolute top-4 right-4" onClick={() => {setSelectedBayName(null); setHighlightedLocationId(null); setSearchMessage(null);}}>
              <X className="h-6 w-6"/>
            </Button>
          </DialogHeader>
          <div className="space-y-6 p-4">
            {selectedBayName && zonesByBay[selectedBayName] && Object.entries(zonesByBay[selectedBayName]).map(([zoneName, zoneLocations]) => (
              <Card key={zoneName} className="shadow-md border-none">
                <CardHeader>
                  <CardTitle>{zoneName}</CardTitle>
                </CardHeader>
                <CardContent>
                  {renderLocationGrid(zoneLocations)}
                </CardContent>
              </Card>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Detailed Zone View Dialog */}
      <Dialog open={!!selectedZoneName} onOpenChange={() => {setSelectedZoneName(null); setHighlightedLocationId(null); setSearchMessage(null);}}>
        <DialogContent className="max-w-7xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl">
              {selectedZoneName}
              <span className="ml-3 text-sm font-normal text-slate-500">
                ({selectedBayName})
              </span>
            </DialogTitle>
            <Button variant="ghost" size="icon" className="absolute top-4 right-4" onClick={() => {setSelectedZoneName(null); setHighlightedLocationId(null); setSearchMessage(null);}}>
              <X className="h-6 w-6"/>
            </Button>
          </DialogHeader>
          <div className="p-6 bg-slate-50 rounded-lg">
            {selectedZoneName && selectedBayName && zonesByBay[selectedBayName] && zonesByBay[selectedBayName][selectedZoneName] && renderLocationGrid(zonesByBay[selectedBayName][selectedZoneName])}
          </div>
        </DialogContent>
      </Dialog>
      
      {/* Enhanced Stack View Dialog */}
      <Dialog open={!!selectedLocationForStack} onOpenChange={() => setSelectedLocationForStack(null)}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Layers className="w-5 h-5" />
              Stacking Positions for: {selectedLocationForStack?.location_code}
            </DialogTitle>
          </DialogHeader>
          {selectedLocationForStack && (
            <LayeredStackVisualization
              groundLocation={selectedLocationForStack}
              allStackingPositions={stackingPositions}
              allGroundLocations={locations}
              coils={coils}
              isReadOnly={true}
            />
          )}
        </DialogContent>
      </Dialog>

      <BarcodeScannerDialog
        isOpen={showBarcodeScanner}
        onClose={() => setShowBarcodeScanner(false)}
        onScan={handleBarcodeScanned}
        title="Scan Coil to Find Location"
      />
    </div>
  );
}
