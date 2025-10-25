
import React, { useState, useMemo, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  CheckCircle,
  AlertTriangle,
  XCircle,
  MapPin,
  Package,
  ArrowRight,
  Layers,
  Save,
  RefreshCw
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import ReconciliationYardMap from "../components/reconciliation/ReconciliationYardMap";
import CoilPlacementPanel from "../components/reconciliation/CoilPlacementPanel";
import MissingCoilsPanel from "../components/reconciliation/MissingCoilsPanel";

export default function YardReconciliation() {
  const queryClient = useQueryClient();
  const [selectedStockTakeId, setSelectedStockTakeId] = useState(null);
  const [pendingChanges, setPendingChanges] = useState([]);
  const [message, setMessage] = useState(null);

  const { data: stockTakes = [] } = useQuery({
    queryKey: ['stockTakes', 'completed'],
    queryFn: () => base44.entities.StockTake.filter({ status: 'completed' }),
    initialData: [],
  });

  const { data: coils = [] } = useQuery({
    queryKey: ['coils'],
    queryFn: () => base44.entities.Coil.list(),
    initialData: []
  });

  const { data: stackingPositions = [] } = useQuery({
    queryKey: ['stackingPositions'],
    queryFn: () => base44.entities.StackingPosition.list(),
    initialData: []
  });

  const { data: locations = [] } = useQuery({
    queryKey: ['locations'],
    queryFn: () => base44.entities.StorageLocation.list(),
    initialData: []
  });

  const selectedStockTake = useMemo(() => 
    stockTakes.find(st => st.id === selectedStockTakeId),
    [stockTakes, selectedStockTakeId]
  );

  // Enhanced Analyze discrepancies with placeholder mapping
  const reconciliationData = useMemo(() => {
    if (!selectedStockTake) return null;

    const bay = selectedStockTake.bay;
    const zone = selectedStockTake.zone;

    // Get all stacking positions in this location
    const locationPositions = stackingPositions.filter(pos => 
      pos.bay === bay && 
      (zone ? pos.zone === zone : true) &&
      pos.is_active && 
      pos.is_visible
    );

    // Map system positions by coil barcode for quick lookup
    const systemCoilBarcodeToPositionMap = new Map();
    locationPositions.forEach(pos => {
      if (pos.coil_barcode) {
        systemCoilBarcodeToPositionMap.set(pos.coil_barcode, pos);
      }
    });
    
    // Map stacking positions by placeholder_id for quick lookup
    const placeholderIdToPositionMap = new Map();
    locationPositions.forEach(pos => {
        placeholderIdToPositionMap.set(pos.placeholder_id, pos);
    });

    // Physical coils found with their locations during stock take
    // selectedStockTake.coils_found is an array of objects { coil_barcode: string, found_at_placeholder_id: string }
    const physicalFoundBarcodeToPlaceholderMap = new Map();
    (selectedStockTake.coils_found || []).forEach(item => {
      physicalFoundBarcodeToPlaceholderMap.set(item.coil_barcode, item.found_at_placeholder_id);
    });

    const coilsToPlace = []; // Coils found physically, but need assigning/reassigning in system
    const coilsToUnplace = []; // Coils system thinks are present, but were not found physically (or moved)
    const coilsConfirmed = []; // Coils found physically AND system records match
    const coilsMisplaced = []; // Coils found physically, but in a different spot than system records

    // --- Phase 1: Analyze each physically found coil from the stock take ---
    for (const item of (selectedStockTake.coils_found || [])) {
      const coil = coils.find(c => c.barcode === item.coil_barcode);
      if (!coil) continue; // Coil not found in the overall coil list, likely non-traceable or external

      const foundAtPosition = placeholderIdToPositionMap.get(item.found_at_placeholder_id);
      
      const currentSystemPosition = coil.current_stacking_position_id 
        ? stackingPositions.find(p => p.id === coil.current_stacking_position_id)
        : null;

      // Case 1: Coil has no system position
      if (!currentSystemPosition) {
        coilsToPlace.push({
          coil,
          targetPlaceholder: foundAtPosition, // Use the physically found placeholder
          currentSystemPosition: null, // Indicates it was unassigned
          reason: 'Unassigned in system'
        });
      } 
      // Case 2: Coil is in system, but its system position is different from where it was physically found
      else if (currentSystemPosition.placeholder_id !== item.found_at_placeholder_id) {
        coilsMisplaced.push({
          coil,
          currentSystemPosition, // The position system thinks it's in
          targetPlaceholder: foundAtPosition, // The position where it was actually found
          reason: 'Found at different location than system records'
        });
      } 
      // Case 3: Coil's system position matches where it was physically found
      else {
        coilsConfirmed.push(item.coil_barcode);
      }
    }

    // --- Phase 2: Analyze system positions that were not found physically ---
    // These are coils the system thinks are there, but weren't reported in the physical stock take
    for (const [coilBarcode, systemPosition] of systemCoilBarcodeToPositionMap) {
      if (!physicalFoundBarcodeToPlaceholderMap.has(coilBarcode)) {
        const coil = coils.find(c => c.barcode === coilBarcode);
        if (coil) {
          coilsToUnplace.push({ coil, position: systemPosition });
        }
      }
    }

    // --- Phase 3: Process Misplaced Coils ---
    // Misplaced coils need to be 'unplaced' from their incorrect system position,
    // and then 'placed' into their physically correct position.
    coilsMisplaced.forEach(item => {
      // Add to coilsToUnplace list so it can be cleared from its old spot
      coilsToUnplace.push({ 
        coil: item.coil, 
        position: item.currentSystemPosition, // The system's incorrect position
        willMoveTo: item.targetPlaceholder?.placeholder_id, // Indicate where it will eventually go
        reason: 'Misplaced in system, needs correction'
      });
      // Add to coilsToPlace list so it can be assigned to its new spot
      coilsToPlace.push({
        coil: item.coil,
        targetPlaceholder: item.targetPlaceholder, // The physically correct position
        currentSystemPosition: item.currentSystemPosition, // Keep for context/display if needed
        reason: 'Relocating from incorrect position'
      });
    });

    // --- Phase 4: Identify Unassigned Coils ---
    // These are coils in the system that have no current stacking position (null)
    // and were NOT part of the physically found coils in THIS stock take.
    // Exclude coils with status 'shipped', 'outgoing', or 'on_truck' as they are not expected in yard.
    const unassignedCoils = coils
      .filter(c => 
        !c.current_stacking_position_id && 
        c.status !== 'shipped' && 
        c.status !== 'outgoing' &&
        c.status !== 'on_truck'
      )
      .filter(c => !physicalFoundBarcodeToPlaceholderMap.has(c.barcode)); // Not already found in this stock take

    // Non-Traceable Coils - these are reported by stock take as barcodes not recognized by the system
    const nonTraceableCoils = selectedStockTake.non_traceable_coils || [];

    return {
      locationPositions,
      coilsToPlace,
      coilsToUnplace,
      coilsConfirmed,
      coilsMisplaced, // Can be useful for display, though actions are split to toPlace/toUnplace
      nonTraceableCoils,
      unassignedCoils,
      emptyPlaceholders: selectedStockTake.empty_placeholders || [],
      bay,
      zone
    };
  }, [selectedStockTake, coils, stackingPositions]);

  const handleAssignCoil = (coil, targetPositionId) => {
    const targetPosition = stackingPositions.find(p => p.id === targetPositionId);
    if (!targetPosition) return;

    // Validate
    if (targetPosition.coil_barcode) {
      setMessage({ type: 'error', text: `Position ${targetPosition.placeholder_id} is already occupied!` });
      return;
    }

    // Check layer dependencies
    if (targetPosition.layer > 1) {
      const supportingPositions = stackingPositions.filter(pos => 
        targetPosition.supported_by_ground_location_ids.includes(pos.primary_ground_location_id) &&
        pos.layer === targetPosition.layer - 1
      );
      
      const allSupportsOccupied = supportingPositions.every(pos => pos.coil_barcode);
      if (!allSupportsOccupied) {
        setMessage({ 
          type: 'error', 
          text: `Cannot place coil in Layer ${targetPosition.layer}. Lower layer must be filled first.` 
        });
        return;
      }
    }

    // Add to pending changes
    setPendingChanges(prev => [...prev, {
      type: 'assign',
      coil,
      targetPosition,
      timestamp: Date.now()
    }]);

    setMessage({ 
      type: 'success', 
      text: `Coil ${coil.barcode} staged for ${targetPosition.placeholder_id}. Click "Commit Changes" to apply.` 
    });
  };

  const handleUnassignCoil = (coil, position) => {
    // Check if there are coils above
    const positionsAbove = stackingPositions.filter(pos => 
      pos.layer > position.layer &&
      pos.supported_by_ground_location_ids.some(id => 
        position.supported_by_ground_location_ids.includes(id)
      ) &&
      pos.coil_barcode
    );

    if (positionsAbove.length > 0) {
      setMessage({ 
        type: 'error', 
        text: `Cannot unassign. There are ${positionsAbove.length} coil(s) in upper layers.` 
      });
      return;
    }

    setPendingChanges(prev => [...prev, {
      type: 'unassign',
      coil,
      position,
      timestamp: Date.now()
    }]);

    setMessage({ 
      type: 'success', 
      text: `Coil ${coil.barcode} staged for removal. Click "Commit Changes" to apply.` 
    });
  };

  const handleMarkMissing = (coil, position) => {
    setPendingChanges(prev => [...prev, {
      type: 'mark_missing',
      coil,
      position,
      timestamp: Date.now()
    }]);

    setMessage({ 
      type: 'success', 
      text: `Coil ${coil.barcode} will be marked as missing.` 
    });
  };

  const commitChangesMutation = useMutation({
    mutationFn: async () => {
      const results = [];

      for (const change of pendingChanges) {
        try {
          if (change.type === 'assign') {
            // Clear old position if exists
            if (change.coil.current_stacking_position_id) {
              const oldPos = stackingPositions.find(p => p.id === change.coil.current_stacking_position_id);
              if (oldPos) {
                await base44.entities.StackingPosition.update(oldPos.id, { coil_barcode: null });
              }
            }

            // Assign to new position
            await base44.entities.StackingPosition.update(change.targetPosition.id, {
              coil_barcode: change.coil.barcode
            });

            // Update coil
            await base44.entities.Coil.update(change.coil.id, {
              current_stacking_position_id: change.targetPosition.id,
              storage_location: change.targetPosition.primary_ground_location_code,
              status: 'in_yard',
              last_moved_date: new Date().toISOString()
            });

            // Log movement
            await base44.entities.CoilMovement.create({
              coil_barcode: change.coil.barcode,
              from_location: change.coil.current_stacking_position_id ? 'Previous Position' : 'Unassigned',
              to_location: change.targetPosition.placeholder_id,
              movement_type: 'shuffle',
              movement_date: new Date().toISOString(),
              moved_by: 'user',
              reason: 'Stock take reconciliation'
            });

            results.push({ success: true, coil: change.coil.barcode });

          } else if (change.type === 'unassign' || change.type === 'mark_missing') {
            // Clear position
            await base44.entities.StackingPosition.update(change.position.id, { coil_barcode: null });

            // Update coil status
            await base44.entities.Coil.update(change.coil.id, {
              current_stacking_position_id: null,
              storage_location: null,
              status: change.type === 'mark_missing' ? 'incoming' : 'in_yard',
              last_moved_date: new Date().toISOString()
            });

            // Log movement
            await base44.entities.CoilMovement.create({
              coil_barcode: change.coil.barcode,
              from_location: change.position.placeholder_id,
              to_location: change.type === 'mark_missing' ? 'Missing' : 'Unassigned',
              movement_type: 'return',
              movement_date: new Date().toISOString(),
              moved_by: 'user',
              reason: change.type === 'mark_missing' ? 'Marked missing during stock take' : 'Removed during reconciliation'
            });

            results.push({ success: true, coil: change.coil.barcode });
          }
        } catch (error) {
          results.push({ success: false, coil: change.coil?.barcode, error: error.message });
        }
      }

      // Update stock take status
      if (selectedStockTake) {
        await base44.entities.StockTake.update(selectedStockTake.id, {
          status: 'reconciled'
        });
      }

      return results;
    },
    onSuccess: (results) => {
      const successCount = results.filter(r => r.success).length;
      const failCount = results.filter(r => !r.success).length;

      queryClient.invalidateQueries({ queryKey: ['coils'] });
      queryClient.invalidateQueries({ queryKey: ['stackingPositions'] });
      queryClient.invalidateQueries({ queryKey: ['movements'] });
      queryClient.invalidateQueries({ queryKey: ['stockTakes'] });

      setPendingChanges([]);
      
      setMessage({ 
        type: 'success', 
        text: `✓ Reconciliation complete! ${successCount} changes applied successfully.${failCount > 0 ? ` ${failCount} failed.` : ''}` 
      });

      setTimeout(() => {
        setSelectedStockTakeId(null);
      }, 2000);
    },
    onError: (error) => {
      setMessage({ type: 'error', text: `Commit failed: ${error.message}` });
    }
  });

  const handleCommitChanges = () => {
    if (pendingChanges.length === 0) {
      setMessage({ type: 'error', text: 'No changes to commit!' });
      return;
    }
    commitChangesMutation.mutate();
  };

  const handleCancelChanges = () => {
    setPendingChanges([]);
    setMessage({ type: 'success', text: 'All pending changes cancelled.' });
  };

  return (
    <div className="p-6 lg:p-8 bg-slate-50 min-h-screen">
      <div className="max-w-[1800px] mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900">Yard Reconciliation</h1>
          <p className="text-slate-600 mt-2">Fix yard discrepancies using precise placeholder mappings from physical stock take</p>
        </div>

        {message && (
          <Alert className={`mb-6 ${message.type === 'success' ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
            {message.type === 'success' ? (
              <CheckCircle className="h-4 w-4 text-emerald-600" />
            ) : (
              <XCircle className="h-4 w-4 text-red-600" />
            )}
            <AlertDescription className={message.type === 'success' ? 'text-emerald-900' : 'text-red-900'}>
              {message.text}
            </AlertDescription>
          </Alert>
        )}

        {/* Stock Take Selection */}
        <Card className="mb-8 shadow-lg border-none">
          <CardHeader>
            <CardTitle>Select Stock Take to Reconcile</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Select value={selectedStockTakeId || ''} onValueChange={setSelectedStockTakeId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a completed stock take..." />
                  </SelectTrigger>
                  <SelectContent>
                    {stockTakes.map(st => (
                      <SelectItem key={st.id} value={st.id}>
                        {st.location} - {new Date(st.stock_take_date).toLocaleDateString()} 
                        {st.variance !== 0 && ` (${st.variance > 0 ? '+' : ''}${st.variance} variance)`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedStockTake && (
                <div className="flex items-center gap-4">
                  <Badge variant="outline" className="text-sm">
                    Physical: {selectedStockTake.physical_count}
                  </Badge>
                  <Badge variant="outline" className="text-sm">
                    System: {selectedStockTake.system_count}
                  </Badge>
                  <Badge className={`text-sm ${selectedStockTake.variance === 0 ? 'bg-emerald-600' : 'bg-orange-600'}`}>
                    Variance: {selectedStockTake.variance}
                  </Badge>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Reconciliation Interface */}
        {selectedStockTake && reconciliationData && (
          <div className="space-y-6">
            {/* Enhanced Summary Cards */}
            <div className="grid md:grid-cols-5 gap-4">
              <Card className="bg-gradient-to-br from-orange-50 to-orange-100 border-none">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-slate-600">To Place</p>
                      <p className="text-3xl font-bold text-orange-900">{reconciliationData.coilsToPlace.length}</p>
                    </div>
                    <Package className="w-10 h-10 text-orange-900 opacity-30" />
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-red-50 to-red-100 border-none">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-slate-600">Missing</p>
                      <p className="text-3xl font-bold text-red-900">{reconciliationData.coilsToUnplace.length}</p>
                    </div>
                    <AlertTriangle className="w-10 h-10 text-red-900 opacity-30" />
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-emerald-50 to-emerald-100 border-none">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-slate-600">Confirmed</p>
                      <p className="text-3xl font-bold text-emerald-900">{reconciliationData.coilsConfirmed.length}</p>
                    </div>
                    <CheckCircle className="w-10 h-10 text-emerald-900 opacity-30" />
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-none">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-slate-600">Unassigned</p>
                      <p className="text-3xl font-bold text-purple-900">{reconciliationData.unassignedCoils.length}</p>
                    </div>
                    <XCircle className="w-10 h-10 text-purple-900 opacity-30" />
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-none">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-slate-600">Pending Changes</p>
                      <p className="text-3xl font-bold text-blue-900">{pendingChanges.length}</p>
                    </div>
                    <RefreshCw className="w-10 h-10 text-blue-900 opacity-30" />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Unassigned Coils Alert */}
            {reconciliationData.unassignedCoils.length > 0 && (
              <Alert className="bg-purple-50 border-purple-200">
                <AlertTriangle className="h-4 w-4 text-purple-600" />
                <AlertDescription className="text-purple-900">
                  <strong>{reconciliationData.unassignedCoils.length} coils</strong> are currently unassigned to any placeholder in the system. 
                  These coils were not found during this stock take. Consider assigning them proper placeholders or investigating their whereabouts.
                  <div className="mt-2 space-y-1">
                    {reconciliationData.unassignedCoils.slice(0, 5).map(coil => (
                      <div key={coil.id} className="text-xs font-mono bg-white p-2 rounded">
                        {coil.barcode} - {coil.coil_type} ({coil.weight}t)
                      </div>
                    ))}
                    {reconciliationData.unassignedCoils.length > 5 && (
                      <div className="text-xs">+ {reconciliationData.unassignedCoils.length - 5} more coils</div>
                    )}
                  </div>
                </AlertDescription>
              </Alert>
            )}

            {/* Main Reconciliation Interface */}
            <div className="grid lg:grid-cols-3 gap-6">
              {/* Left Panel - Coils to Handle */}
              <div className="lg:col-span-1 space-y-4">
                <Tabs defaultValue="place">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="place">To Place ({reconciliationData.coilsToPlace.length})</TabsTrigger>
                    <TabsTrigger value="missing">Missing ({reconciliationData.coilsToUnplace.length})</TabsTrigger>
                  </TabsList>

                  <TabsContent value="place">
                    <CoilPlacementPanel
                      coils={reconciliationData.coilsToPlace}
                      onAssign={handleAssignCoil}
                      stackingPositions={reconciliationData.locationPositions}
                      pendingChanges={pendingChanges}
                    />
                  </TabsContent>

                  <TabsContent value="missing">
                    <MissingCoilsPanel
                      coils={reconciliationData.coilsToUnplace}
                      onUnassign={handleUnassignCoil}
                      onMarkMissing={handleMarkMissing}
                      pendingChanges={pendingChanges}
                    />
                  </TabsContent>
                </Tabs>
              </div>

              {/* Right Panel - Yard Map */}
              <div className="lg:col-span-2">
                <ReconciliationYardMap
                  stackingPositions={reconciliationData.locationPositions}
                  allGroundLocations={locations}
                  confirmedCoils={reconciliationData.coilsConfirmed}
                  coilsToPlace={reconciliationData.coilsToPlace}
                  coilsToUnplace={reconciliationData.coilsToUnplace}
                  pendingChanges={pendingChanges}
                  onPositionClick={handleAssignCoil}
                />
              </div>
            </div>

            {/* Commit Actions */}
            {pendingChanges.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="sticky bottom-4 z-50"
              >
                <Card className="bg-blue-900 text-white shadow-2xl border-none">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-lg font-semibold">{pendingChanges.length} changes ready to commit</p>
                        <p className="text-sm text-blue-200">Review your changes and commit to update the system</p>
                      </div>
                      <div className="flex gap-3">
                        <Button
                          variant="outline"
                          onClick={handleCancelChanges}
                          className="bg-transparent border-white text-white hover:bg-white hover:text-blue-900"
                        >
                          Cancel All
                        </Button>
                        <Button
                          onClick={handleCommitChanges}
                          disabled={commitChangesMutation.isPending}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white"
                        >
                          <Save className="w-4 h-4 mr-2" />
                          {commitChangesMutation.isPending ? 'Committing...' : 'Commit Changes'}
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </div>
        )}

        {!selectedStockTake && (
          <Card className="shadow-lg border-none">
            <CardContent className="p-20 text-center">
              <MapPin className="w-16 h-16 mx-auto mb-4 text-slate-300" />
              <p className="text-slate-500 text-lg">Select a completed stock take to begin reconciliation</p>
              <p className="text-slate-400 text-sm mt-2">This will help you fix discrepancies between physical count and system records</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
