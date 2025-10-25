
import React, { useState, useMemo, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MapPin, Package, Layers, AlertCircle, Search, Camera, X } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { groupBy } from 'lodash';
import BarcodeScannerDialog from "../components/barcode/BarcodeScannerDialog";
import { getCoilIdFromBarcode } from '../components/utils/barcodeParser';
import LayeredStackVisualization from "../components/stacking/LayeredStackVisualization";

export default function StorageAssignment() {
  const queryClient = useQueryClient();
  const [selectedGroundLocation, setSelectedGroundLocation] = useState(null);
  const [message, setMessage] = useState(null);
  const [selectedBay, setSelectedBay] = useState(null);
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
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    onError: (error) => {
      console.error('Error loading locations:', error);
    }
  });

  const { data: stackingPositions = [] } = useQuery({
    queryKey: ['stackingPositions'],
    queryFn: () => base44.entities.StackingPosition.list(),
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    onError: (error) => {
      console.error('Error loading stacking positions:', error);
    }
  });

  const { data: coils = [] } = useQuery({
    queryKey: ['coils'],
    queryFn: () => base44.entities.Coil.list(),
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    onError: (error) => {
      console.error('Error loading coils:', error);
    }
  });

  useEffect(() => {
    if (highlightedLocationId && highlightedRef.current) {
      highlightedRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [highlightedLocationId, selectedBay]);

  const handleBarcodeScanned = (barcode) => {
    setSearchQuery(barcode);
    setShowBarcodeScanner(false);
    setTimeout(() => {
      handleSearchWithBarcode(barcode);
    }, 100);
  };

  const handleSearchWithBarcode = (barcode) => {
    const queryToSearch = barcode || searchQuery;
    setSearchMessage(null);
    setHighlightedLocationId(null);
    if (!queryToSearch.trim()) return;

    // Extract core coil ID from barcode or use as-is if it's already just an ID
    const coreCoilId = getCoilIdFromBarcode(queryToSearch.trim());
    
    // Find stacking position containing this coil
    const foundPosition = stackingPositions.find(pos => pos.coil_barcode === coreCoilId);
    
    if (foundPosition) {
      setHighlightedLocationId(foundPosition.primary_ground_location_id);
      setSelectedBay(foundPosition.bay);
      setSearchMessage({ 
        type: 'success', 
        text: `✓ Coil "${coreCoilId}" found in position: ${foundPosition.placeholder_id}` 
      });
    } else {
      setSearchMessage({ 
        type: 'error', 
        text: `Coil "${coreCoilId}" not found in any stacking position.` 
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

  const bayNames = useMemo(() => Object.keys(zonesByBay).sort(), [zonesByBay]);

  useEffect(() => {
    if (bayNames.length > 0 && !selectedBay) {
      setSelectedBay(bayNames[0]);
    }
  }, [bayNames, selectedBay]);

  const assignCoilMutation = useMutation({
    mutationFn: async ({ stackingPosition, coilBarcode }) => {
      const coreCoilId = getCoilIdFromBarcode(coilBarcode);
      
      // Find the coil
      const coilResults = await base44.entities.Coil.filter({ barcode: coreCoolId });
      if (coilResults.length === 0) throw new Error(`Coil ${coreCoilId} not found.`);
      const coil = coilResults[0];

      // Check if coil is already placed somewhere
      if (coil.current_stacking_position_id) {
        const currentPos = stackingPositions.find(p => p.id === coil.current_stacking_position_id);
        throw new Error(`Coil ${coreCoilId} is already in position ${currentPos?.placeholder_id || 'unknown'}. Please shuffle it first.`);
      }

      // Check if position is already occupied
      if (stackingPosition.coil_barcode) {
        throw new Error(`Position ${stackingPosition.placeholder_id} is already occupied by coil ${stackingPosition.coil_barcode}.`);
      }

      // Validate layer dependencies (bridging positions need lower layers filled)
      if (stackingPosition.layer > 1) {
        const supportingPositions = stackingPositions.filter(pos => 
          stackingPosition.supported_by_ground_location_ids.includes(pos.primary_ground_location_id) &&
          pos.layer === stackingPosition.layer - 1
        );
        
        const allSupportsOccupied = supportingPositions.every(pos => pos.coil_barcode);
        if (!allSupportsOccupied) {
          throw new Error(`Cannot place coil in Layer ${stackingPosition.layer}. Lower layer positions must be filled first.`);
        }
      }

      // Update stacking position
      await base44.entities.StackingPosition.update(stackingPosition.id, {
        coil_barcode: coreCoilId
      });

      // Update coil
      await base44.entities.Coil.update(coil.id, {
        current_stacking_position_id: stackingPosition.id,
        storage_location: stackingPosition.primary_ground_location_code, // Backward compatibility
        status: 'in_yard',
        last_moved_date: new Date().toISOString()
      });

      // Log movement
      await base44.entities.CoilMovement.create({
        coil_barcode: coreCoilId,
        to_location: stackingPosition.placeholder_id,
        movement_type: 'receipt',
        movement_date: new Date().toISOString(),
        moved_by: 'user',
        reason: `Placed into position ${stackingPosition.placeholder_id} (Layer ${stackingPosition.layer})`
      });

      return { coilBarcode: coreCoilId, positionId: stackingPosition.placeholder_id };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['stackingPositions'] });
      queryClient.invalidateQueries({ queryKey: ['coils'] });
      queryClient.invalidateQueries({ queryKey: ['movements'] });
      setMessage({ 
        type: 'success', 
        text: `✓ Coil ${result.coilBarcode} assigned to position ${result.positionId}` 
      });
      setTimeout(() => setMessage(null), 5000);
    },
    onError: (error) => {
      setMessage({ type: 'error', text: error.message });
      setTimeout(() => setMessage(null), 5000);
    },
  });

  const removeCoilMutation = useMutation({
    mutationFn: async ({ stackingPosition }) => {
      if (!stackingPosition.coil_barcode) {
        throw new Error("No coil in this position.");
      }

      // Check if there are coils above this position (layer dependency)
      const positionsAbove = stackingPositions.filter(pos => 
        pos.layer > stackingPosition.layer &&
        pos.supported_by_ground_location_ids.some(id => 
          stackingPosition.supported_by_ground_location_ids.includes(id)
        ) &&
        pos.coil_barcode
      );

      if (positionsAbove.length > 0) {
        throw new Error(`Cannot remove coil. There are ${positionsAbove.length} coil(s) in upper layers that depend on this position.`);
      }

      const coilBarcode = stackingPosition.coil_barcode;
      const coilResults = await base44.entities.Coil.filter({ barcode: coilBarcode });
      if (coilResults.length === 0) throw new Error("Coil data not found");
      const coil = coilResults[0];

      // Update stacking position
      await base44.entities.StackingPosition.update(stackingPosition.id, {
        coil_barcode: null
      });

      // Update coil
      await base44.entities.Coil.update(coil.id, {
        current_stacking_position_id: null,
        storage_location: null,
        status: 'incoming'
      });

      // Log movement
      await base44.entities.CoilMovement.create({
        coil_barcode: coilBarcode,
        from_location: stackingPosition.placeholder_id,
        movement_type: 'return',
        movement_date: new Date().toISOString(),
        moved_by: 'user',
        reason: 'Removed from stacking position'
      });

      return { coilBarcode, positionId: stackingPosition.placeholder_id };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['stackingPositions'] });
      queryClient.invalidateQueries({ queryKey: ['coils'] });
      queryClient.invalidateQueries({ queryKey: ['movements'] });
      setMessage({ 
        type: 'success', 
        text: `✓ Coil ${result.coilBarcode} removed from position ${result.positionId}` 
      });
      setTimeout(() => setMessage(null), 5000);
    },
    onError: (error) => {
      setMessage({ type: 'error', text: error.message });
      setTimeout(() => setMessage(null), 5000);
    },
  });

  const handleLocationClick = (location) => {
    setSelectedGroundLocation(location);
  };

  const getLocationStyle = (location) => {
    if (!location || !location.is_active) return 'bg-slate-100 border-slate-300 opacity-50';

    // Count occupied positions for this ground location
    const relatedPositions = stackingPositions.filter(pos =>
      pos.primary_ground_location_id === location.id && pos.is_active
    );
    const occupiedCount = relatedPositions.filter(pos => pos.coil_barcode).length;
    const totalCount = relatedPositions.length;

    if (totalCount === 0 || occupiedCount === 0) return 'bg-emerald-50 border-emerald-300 hover:border-emerald-500';
    if (occupiedCount >= totalCount) return 'bg-red-200 border-red-400';
    return 'bg-yellow-100 border-yellow-400';
  };

  const getLocationOccupancyBadge = (location) => {
    const relatedPositions = stackingPositions.filter(pos =>
      pos.primary_ground_location_id === location.id && pos.is_active
    );
    const occupiedCount = relatedPositions.filter(pos => pos.coil_barcode).length;
    return occupiedCount > 0 ? occupiedCount : null;
  };

  const renderLocationGrid = (zoneLocations) => {
    if (!zoneLocations || zoneLocations.length === 0) {
      return <p className="text-sm text-slate-500 p-4">No locations configured for this zone.</p>;
    }

    const maxRow = Math.max(...zoneLocations.map(l => l.row_num || 0));
    const maxCol = Math.max(...zoneLocations.map(l => l.col_num || 0));

    if (maxRow === 0 || maxCol === 0) {
      return (
        <div className="p-4">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Locations in this zone do not have row/column data. Please configure them in the Masters page.
            </AlertDescription>
          </Alert>
        </div>
      );
    }

    const grid = Array(maxRow).fill(null).map(() => Array(maxCol).fill(null));
    zoneLocations.forEach(loc => {
      if (loc.row_num > 0 && loc.col_num > 0 && loc.row_num <= maxRow && loc.col_num <= maxCol) {
        grid[loc.row_num - 1][loc.col_num - 1] = loc;
      }
    });

    return (
      <div className="grid gap-1.5 p-2 overflow-x-auto" style={{ gridTemplateColumns: `repeat(${maxCol}, var(--placeholder-size, 6rem))` }}>
        {grid.flat().map((loc, index) => {
          const occupancyCount = loc ? getLocationOccupancyBadge(loc) : null;
          return (
            <div
              key={loc?.id || `empty-${index}`}
              ref={loc?.id === highlightedLocationId ? highlightedRef : null}
              className={`
                relative aspect-square rounded border-2 flex items-center justify-center text-xs
                transition-all duration-200
                ${loc && loc.is_active ? 'cursor-pointer' : 'cursor-not-allowed'}
                ${getLocationStyle(loc)}
                ${loc?.id === highlightedLocationId ? 'ring-4 ring-indigo-500 shadow-xl z-10' : ''}
              `}
              onClick={() => loc && loc.is_active && handleLocationClick(loc)}
              title={loc?.location_code}
            >
              {loc && (
                <>
                  <div className="flex flex-col items-center justify-center p-1 text-center">
                    <span className="font-bold text-slate-800 break-all">{loc.location_code}</span>
                  </div>
                  {occupancyCount && (
                    <div className="absolute -top-1.5 -right-1.5 flex items-center justify-center w-6 h-6 bg-blue-900 text-white text-[10px] font-bold rounded-full shadow">
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
      <div className="max-w-full mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900">Storage Position Assignment</h1>
          <p className="text-slate-600 mt-2">Assign coils to specific stacking positions (including bridging layers)</p>
        </div>

        {message && (
          <Alert className={`mb-6 ${message.type === 'success' ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
            <AlertDescription className={message.type === 'success' ? 'text-emerald-900' : 'text-red-900'}>
              {message.text}
            </AlertDescription>
          </Alert>
        )}

        <Card className="mb-8 shadow-lg border-none">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="w-5 h-5 text-slate-700" /> Find a Coil
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-4">
              <Input
                placeholder='Scan barcode or enter Coil ID (e.g., "24AC40001" or "24AC40001 3.6X1250X1500 23.6")'
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
                  <Camera className="w-4 h-4 mr-2" /> Scan Barcode
                </Button>
                <Button onClick={handleSearch} className="bg-blue-900 hover:bg-blue-800 w-full sm:w-auto">
                  <Search className="w-4 h-4 mr-2" /> Search
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setSearchQuery('');
                    setHighlightedLocationId(null);
                    setSearchMessage(null);
                  }}
                  className="w-full sm:w-auto"
                >
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

        {bayNames.length > 1 && (
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-slate-800 mb-2">Select Yard / Bay</h3>
            <Tabs value={selectedBay || ''} onValueChange={setSelectedBay}>
              <TabsList>
                {bayNames.map(bay => (
                  <TabsTrigger key={bay} value={bay}>
                    {bay}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </div>
        )}

        <div className="space-y-6">
          {selectedBay && zonesByBay[selectedBay] ? (
            Object.entries(zonesByBay[selectedBay])
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([zone, zoneLocations]) => (
                <Card key={zone} className="shadow-lg border-none mb-4">
                  <CardHeader>
                    <CardTitle className="text-lg">{zone}</CardTitle>
                  </CardHeader>
                  <CardContent>{renderLocationGrid(zoneLocations)}</CardContent>
                </Card>
              ))
          ) : (
            <Card className="shadow-lg border-none">
              <CardContent className="p-10 text-center text-slate-500">
                <p>No locations configured.</p>
                <p className="text-sm">Please add storage locations in the Masters page.</p>
              </CardContent>
            </Card>
          )}
        </div>

        <Card className="mt-6 shadow-lg border-none">
          <CardHeader>
            <CardTitle>Legend</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-x-6 gap-y-3">
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 bg-emerald-50 border-2 border-emerald-300 rounded"></div>
                <span className="text-sm text-slate-600">Empty (All positions available)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 bg-yellow-100 border-2 border-yellow-400 rounded"></div>
                <span className="text-sm text-slate-600">Partially Filled</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 bg-red-200 border-2 border-red-400 rounded"></div>
                <span className="text-sm text-slate-600">Full (All positions occupied)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 bg-slate-100 border-2 border-slate-300 rounded opacity-50"></div>
                <span className="text-sm text-slate-600">Not Configured / Inactive</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Enhanced Stacking Position Management Dialog */}
      <Dialog open={!!selectedGroundLocation} onOpenChange={() => setSelectedGroundLocation(null)}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Layers className="w-5 h-5" />
              Manage Stacking Positions: {selectedGroundLocation?.location_code}
            </DialogTitle>
          </DialogHeader>
          {selectedGroundLocation && (
            <StackingPositionInteractiveView
              groundLocation={selectedGroundLocation}
              allStackingPositions={stackingPositions}
              allGroundLocations={locations}
              coils={coils}
              onAssignCoil={assignCoilMutation.mutate}
              onRemoveCoil={removeCoilMutation.mutate}
              isProcessing={assignCoilMutation.isPending || removeCoilMutation.isPending}
            />
          )}
        </DialogContent>
      </Dialog>

      <BarcodeScannerDialog
        isOpen={showBarcodeScanner}
        onClose={() => setShowBarcodeScanner(false)}
        onScan={handleBarcodeScanned}
        title="Scan Coil Barcode"
      />
    </div>
  );
}

// NEW: Interactive component for assignment/removal within dialog
function StackingPositionInteractiveView({ 
  groundLocation, 
  allStackingPositions, 
  allGroundLocations,
  coils, 
  onAssignCoil, 
  onRemoveCoil, 
  isProcessing 
}) {
  const [selectedPosition, setSelectedPosition] = useState(null);
  const [coilBarcode, setCoilBarcode] = useState('');
  const [showBarcodeScanner, setShowBarcodeScanner] = useState(false);

  const getCoilInfo = (barcode) => {
    if (!barcode) return null;
    return coils.find(c => c.barcode === barcode);
  };

  const handlePositionClick = (position) => {
    setSelectedPosition(position);
    setCoilBarcode('');
  };

  const handleAssign = () => {
    if (!selectedPosition || !coilBarcode.trim()) return;
    const coreCoilId = getCoilIdFromBarcode(coilBarcode.trim());
    onAssignCoil({ stackingPosition: selectedPosition, coilBarcode: coreCoilId });
    setCoilBarcode('');
    setSelectedPosition(null);
  };

  const handleRemove = () => {
    if (!selectedPosition) return;
    onRemoveCoil({ stackingPosition: selectedPosition });
    setSelectedPosition(null);
  };

  const handleBarcodeScanned = (barcode) => {
    const coreCoilId = getCoilIdFromBarcode(barcode);
    setCoilBarcode(coreCoilId);
    setShowBarcodeScanner(false);
  };

  return (
    <div className="space-y-6">
      {/* Layered Visualization */}
      <LayeredStackVisualization
        groundLocation={groundLocation}
        allStackingPositions={allStackingPositions}
        allGroundLocations={allGroundLocations}
        coils={coils}
        onPositionClick={handlePositionClick}
        isReadOnly={false}
        selectedPositionId={selectedPosition?.id}
      />

      {/* Action Panel */}
      {selectedPosition && (
        <Card className="bg-blue-50 border-blue-200 sticky bottom-0 z-10">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center justify-between">
              <span>
                {selectedPosition.coil_barcode ? 'Remove Coil' : 'Assign Coil'} - {selectedPosition.placeholder_id}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedPosition(null)}
              >
                <X className="w-4 h-4" />
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {selectedPosition.coil_barcode ? (
              // Remove coil section
              <div className="space-y-3">
                <Alert className="py-2">
                  <Package className="h-4 w-4" />
                  <AlertDescription className="text-sm">
                    <strong>Current Coil:</strong> {selectedPosition.coil_barcode}
                    {getCoilInfo(selectedPosition.coil_barcode) && (
                      <span className="ml-2">
                        ({getCoilInfo(selectedPosition.coil_barcode).weight}t)
                      </span>
                    )}
                  </AlertDescription>
                </Alert>
                <Button
                  variant="destructive"
                  onClick={handleRemove}
                  disabled={isProcessing}
                  className="w-full"
                  size="sm"
                >
                  <X className="w-4 h-4 mr-2" />
                  Remove Coil from Position
                </Button>
              </div>
            ) : (
              // Assign coil section
              <div className="space-y-3">
                <div className="flex gap-2">
                  <Input
                    placeholder="Scan barcode or enter Coil ID..."
                    value={coilBarcode}
                    onChange={(e) => setCoilBarcode(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleAssign()}
                    className="flex-1 h-9 text-sm"
                  />
                  <Button
                    variant="outline"
                    onClick={() => setShowBarcodeScanner(true)}
                    className="border-2 border-blue-600 text-blue-600 hover:bg-blue-50 h-9 px-3"
                    size="sm"
                  >
                    <Camera className="w-4 h-4" />
                  </Button>
                </div>
                <Button
                  onClick={handleAssign}
                  disabled={!coilBarcode.trim() || isProcessing}
                  className="w-full bg-emerald-600 hover:bg-emerald-700"
                  size="sm"
                >
                  <Package className="w-4 h-4 mr-2" />
                  Assign to Position
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <BarcodeScannerDialog
        isOpen={showBarcodeScanner}
        onClose={() => setShowBarcodeScanner(false)}
        onScan={handleBarcodeScanned}
        title="Scan Coil Barcode"
      />
    </div>
  );
}
