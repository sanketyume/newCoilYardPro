
import React, { useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ClipboardList, Plus, CheckCircle, AlertTriangle, Camera, MapPin, Package, XCircle, Trash2 } from "lucide-react";
import { format } from "date-fns";
import BarcodeScannerDialog from "../components/barcode/BarcodeScannerDialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

export default function StockTaking() {
  const queryClient = useQueryClient();
  const [location, setLocation] = useState('');
  const [bay, setBay] = useState('');
  const [zone, setZone] = useState('');
  const [scannedCoilsWithLocations, setScannedCoilsWithLocations] = useState([]);
  const [currentBarcode, setCurrentBarcode] = useState('');
  const [currentPlaceholderId, setCurrentPlaceholderId] = useState('');
  const [remarks, setRemarks] = useState('');
  const [nonTraceableCoils, setNonTraceableCoils] = useState([]);
  const [newNonTraceable, setNewNonTraceable] = useState({
    barcode: '',
    description: '',
    estimated_weight: '',
    condition: '',
    found_at_placeholder_id: ''
  });
  const [showBarcodeScanner, setShowBarcodeScanner] = useState(false);
  const [showPlaceholderScanner, setShowPlaceholderScanner] = useState(false);
  const [showNonTraceableBarcodeScanner, setShowNonTraceableBarcodeScanner] = useState(false);
  const [showPlaceholderDialog, setShowPlaceholderDialog] = useState(false);
  const [tempScannedBarcode, setTempScannedBarcode] = useState('');
  const [message, setMessage] = useState(null);
  const [emptyPlaceholders, setEmptyPlaceholders] = useState([]);
  const [markingEmptyMode, setMarkingEmptyMode] = useState(false);
  const [activeTab, setActiveTab] = useState('traceable');

  const { data: stockTakes = [] } = useQuery({
    queryKey: ['stockTakes'],
    queryFn: () => base44.entities.StockTake.list('-stock_take_date', 20),
    initialData: []
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

  // Get unique bays and zones
  const bays = useMemo(() => {
    const uniqueBays = new Set(locations.map(l => l.bay).filter(Boolean));
    return [...uniqueBays].sort();
  }, [locations]);

  const zones = useMemo(() => {
    if (!bay) return [];
    const uniqueZones = new Set(locations.filter(l => l.bay === bay).map(l => l.zone).filter(Boolean));
    return [...uniqueZones].sort();
  }, [locations, bay]);

  // Get available placeholders in selected bay/zone
  const availablePlaceholders = useMemo(() => {
    if (!bay) return [];
    return stackingPositions.filter(pos =>
      pos.bay === bay &&
      (zone ? pos.zone === zone : true) &&
      pos.is_active &&
      pos.is_visible
    ).sort((a, b) => a.placeholder_id.localeCompare(b.placeholder_id));
  }, [stackingPositions, bay, zone]);

  // Get unassigned coils (coils with no current_stacking_position_id)
  const unassignedCoils = useMemo(() => {
    return coils.filter(c =>
      !c.current_stacking_position_id &&
      c.status !== 'shipped' &&
      c.status !== 'outgoing'
    );
  }, [coils]);

  const createStockTakeMutation = useMutation({
    mutationFn: async (stockTakeData) => {
      return await base44.entities.StockTake.create(stockTakeData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stockTakes'] });
      setMessage({ type: 'success', text: '✓ Stock take completed successfully!' });
      resetForm();
    },
    onError: (error) => {
      setMessage({ type: 'error', text: `Failed to create stock take: ${error.message}` });
    }
  });

  // Handle barcode scan - opens placeholder dialog
  const handleBarcodeScanned = (barcode) => {
    setTempScannedBarcode(barcode);
    setCurrentBarcode(barcode);
    setShowBarcodeScanner(false);
    setShowPlaceholderDialog(true);
  };

  // Handle placeholder barcode scan - use as-is, no parsing needed
  const handlePlaceholderBarcodeScanned = (barcode) => {
    const placeholderId = barcode.trim();
    setCurrentPlaceholderId(placeholderId);
    setShowPlaceholderScanner(false);
    setMessage({ type: 'success', text: `✓ Placeholder ${placeholderId} scanned` });
  };

  // Handle non-traceable barcode scan
  const handleNonTraceableBarcodeScanned = (barcode) => {
    setNewNonTraceable({ ...newNonTraceable, barcode: barcode.trim() });
    setShowNonTraceableBarcodeScanner(false);
    setMessage({ type: 'success', text: `✓ Barcode ${barcode.trim()} scanned for non-traceable coil` });
  };

  // Handle manual barcode entry
  const handleManualBarcodeEntry = () => {
    if (!currentBarcode.trim()) {
      setMessage({ type: 'error', text: 'Please enter a barcode' });
      return;
    }
    setTempScannedBarcode(currentBarcode);
    setShowPlaceholderDialog(true);
  };

  // Confirm coil with placeholder
  const handleConfirmCoilWithPlaceholder = () => {
    if (!currentPlaceholderId.trim()) {
      setMessage({ type: 'error', text: 'Please select or enter a placeholder ID' });
      return;
    }

    // Check if already scanned
    const alreadyScanned = scannedCoilsWithLocations.find(
      item => item.coil_barcode === tempScannedBarcode
    );
    if (alreadyScanned) {
      setMessage({
        type: 'error',
        text: `Coil ${tempScannedBarcode} already scanned at ${alreadyScanned.found_at_placeholder_id}`
      });
      return;
    }

    // Check if placeholder already has a coil (traceable or non-traceable)
    const placeholderOccupied = scannedCoilsWithLocations.find(
      item => item.found_at_placeholder_id === currentPlaceholderId
    ) || nonTraceableCoils.find(
      item => item.found_at_placeholder_id === currentPlaceholderId
    );
    if (placeholderOccupied) {
      setMessage({
        type: 'error',
        text: `Placeholder ${currentPlaceholderId} is already occupied by another coil.`
      });
      return;
    }

    // Add to list
    setScannedCoilsWithLocations([...scannedCoilsWithLocations, {
      coil_barcode: tempScannedBarcode,
      found_at_placeholder_id: currentPlaceholderId,
      scanned_timestamp: new Date().toISOString()
    }]);

    setMessage({
      type: 'success',
      text: `✓ Coil ${tempScannedBarcode} recorded at ${currentPlaceholderId}`
    });

    // Reset
    setShowPlaceholderDialog(false);
    setTempScannedBarcode('');
    setCurrentBarcode('');
    setCurrentPlaceholderId('');
  };

  const handleRemoveScannedCoil = (barcode) => {
    setScannedCoilsWithLocations(scannedCoilsWithLocations.filter(item => item.coil_barcode !== barcode));
    setMessage({ type: 'success', text: `Removed coil ${barcode}` });
  };

  const handleAddNonTraceable = () => {
    if (!newNonTraceable.barcode || !newNonTraceable.description || !newNonTraceable.estimated_weight || !newNonTraceable.found_at_placeholder_id) {
      setMessage({ type: 'error', text: 'Please fill in all required fields for non-traceable coil' });
      return;
    }

    // Check if placeholder already occupied (traceable or non-traceable)
    const placeholderOccupied = scannedCoilsWithLocations.find(
      item => item.found_at_placeholder_id === newNonTraceable.found_at_placeholder_id
    ) || nonTraceableCoils.find(
      item => item.found_at_placeholder_id === newNonTraceable.found_at_placeholder_id
    );

    if (placeholderOccupied) {
      setMessage({
        type: 'error',
        text: `Placeholder ${newNonTraceable.found_at_placeholder_id} is already occupied`
      });
      return;
    }

    setNonTraceableCoils([...nonTraceableCoils, {
      ...newNonTraceable,
      estimated_weight: parseFloat(newNonTraceable.estimated_weight),
      added_timestamp: new Date().toISOString()
    }]);
    setNewNonTraceable({
      barcode: '',
      description: '',
      estimated_weight: '',
      condition: '',
      found_at_placeholder_id: ''
    });
    setMessage({ type: 'success', text: '✓ Non-traceable coil added' });
  };

  const handleRemoveNonTraceable = (index) => {
    const removed = nonTraceableCoils[index];
    setNonTraceableCoils(nonTraceableCoils.filter((_, i) => i !== index));
    setMessage({ type: 'success', text: `Removed non-traceable coil ${removed.barcode || removed.description}` });
  };

  const handleMarkPlaceholderEmpty = (placeholderId) => {
    if (!placeholderId) return;

    // Check if already marked empty
    if (emptyPlaceholders.includes(placeholderId)) {
      setMessage({ type: 'error', text: `${placeholderId} already marked as empty` });
      return;
    }

    // Check if this placeholder has a coil scanned (traceable or non-traceable)
    const hasCoil = scannedCoilsWithLocations.find(item => item.found_at_placeholder_id === placeholderId) ||
                    nonTraceableCoils.find(item => item.found_at_placeholder_id === placeholderId);

    if (hasCoil) {
      setMessage({ type: 'error', text: `${placeholderId} has a coil assigned. Cannot mark as empty.` });
      return;
    }

    setEmptyPlaceholders([...emptyPlaceholders, placeholderId]);
    setMessage({ type: 'success', text: `✓ ${placeholderId} marked as empty` });
  };

  const handleSubmitStockTake = () => {
    if (!location.trim() || !bay) {
      setMessage({ type: 'error', text: 'Please fill in location and bay' });
      return;
    }

    // Calculate system count for this location
    const systemCount = stackingPositions.filter(pos =>
      pos.bay === bay &&
      (zone ? pos.zone === zone : true) &&
      pos.coil_barcode
    ).length;

    const physicalCount = scannedCoilsWithLocations.length + nonTraceableCoils.length;
    const variance = physicalCount - systemCount;

    const stockTakeData = {
      stock_take_date: new Date().toISOString(),
      location: location,
      bay: bay,
      zone: zone || null,
      physical_count: physicalCount,
      system_count: systemCount,
      variance: variance,
      coils_found: scannedCoilsWithLocations,
      non_traceable_coils: nonTraceableCoils,
      empty_placeholders: emptyPlaceholders,
      remarks: remarks,
      status: 'completed'
    };

    createStockTakeMutation.mutate(stockTakeData);
  };

  const resetForm = () => {
    setLocation('');
    setBay('');
    setZone('');
    setScannedCoilsWithLocations([]);
    setCurrentBarcode('');
    setCurrentPlaceholderId('');
    setRemarks('');
    setNonTraceableCoils([]);
    setNewNonTraceable({
      barcode: '',
      description: '',
      estimated_weight: '',
      condition: '',
      found_at_placeholder_id: ''
    });
    setEmptyPlaceholders([]);
    setMarkingEmptyMode(false);
    setActiveTab('traceable');
  };

  return (
    <div className="p-6 lg:p-8 bg-slate-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900">Periodic Stock Taking</h1>
          <p className="text-slate-600 mt-2">Conduct physical stock counts with precise placeholder mapping for complete yard reconciliation</p>
        </div>

        {/* Message Alert */}
        {message && (
          <Alert className={`mb-6 ${message.type === 'success' ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
            {message.type === 'success' ? (
              <CheckCircle className="h-4 h-4 text-emerald-600" />
            ) : (
              <XCircle className="h-4 w-4 text-red-600" />
            )}
            <AlertDescription className={message.type === 'success' ? 'text-emerald-900' : 'text-red-900'}>
              {message.text}
            </AlertDescription>
          </Alert>
        )}

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Stock Taking Form */}
          <div className="space-y-6">
            {/* Unassigned Coils Alert */}
            {unassignedCoils.length > 0 && (
              <Alert className="bg-orange-50 border-orange-200">
                <AlertTriangle className="h-4 w-4 text-orange-600" />
                <AlertDescription className="text-orange-900">
                  <strong>{unassignedCoils.length} coils</strong> are currently unassigned to any placeholder.
                  Use this stock take to assign them proper locations.
                </AlertDescription>
              </Alert>
            )}

            <Card className="shadow-lg border-none">
              <CardHeader className="bg-gradient-to-r from-blue-900 to-blue-700 text-white">
                <CardTitle className="flex items-center gap-2">
                  <ClipboardList className="w-5 h-5" />
                  New Stock Take
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-6">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Bay *</Label>
                    <Select value={bay} onValueChange={(value) => { setBay(value); setZone(''); }}>
                      <SelectTrigger><SelectValue placeholder="Select bay" /></SelectTrigger>
                      <SelectContent>
                        {bays.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Zone</Label>
                    <Select value={zone} onValueChange={setZone} disabled={!bay}>
                      <SelectTrigger><SelectValue placeholder="Select zone (optional)" /></SelectTrigger>
                      <SelectContent>
                        {zones.map(z => <SelectItem key={z} value={z}>{z}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Location Description *</Label>
                  <Input
                    placeholder="e.g., AB Bay WIP Area"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                  />
                </div>

                {/* Tabs for Traceable and Non-Traceable Coils */}
                <Tabs value={activeTab} onValueChange={setActiveTab}>
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="traceable">
                      Traceable Coils ({scannedCoilsWithLocations.length})
                    </TabsTrigger>
                    <TabsTrigger value="non-traceable">
                      Non-Traceable Coils ({nonTraceableCoils.length})
                    </TabsTrigger>
                  </TabsList>

                  {/* Traceable Coils Tab */}
                  <TabsContent value="traceable" className="space-y-3 mt-4">
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                      <p className="text-xs text-blue-900">
                        <strong>📦 Step 1:</strong> Scan or enter the <strong>COIL barcode</strong> (e.g., "24AC40001 3.6X1250X1500 23.6")
                        <br />
                        <strong>📍 Step 2:</strong> Then scan or select the <strong>PLACEHOLDER ID</strong> where you found it (e.g., "AB-01-01-L1")
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Input
                        placeholder="Scan or enter COIL barcode..."
                        value={currentBarcode}
                        onChange={(e) => setCurrentBarcode(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && handleManualBarcodeEntry()}
                        className="flex-grow"
                      />
                      <Button
                        variant="outline"
                        onClick={() => setShowBarcodeScanner(true)}
                        className="border-2 border-blue-600 text-blue-600 hover:bg-blue-50"
                      >
                        <Camera className="w-4 h-4" />
                      </Button>
                      <Button
                        onClick={handleManualBarcodeEntry}
                        className="bg-blue-900 hover:bg-blue-800"
                      >
                        Add
                      </Button>
                    </div>

                    {scannedCoilsWithLocations.length > 0 && (
                      <div className="bg-slate-50 rounded-lg p-4 space-y-2 max-h-60 overflow-y-auto">
                        <p className="text-sm font-medium text-slate-600">
                          Scanned: {scannedCoilsWithLocations.length} coils
                        </p>
                        <div className="space-y-1">
                          {scannedCoilsWithLocations.map((item, idx) => (
                            <div key={idx} className="flex items-center justify-between bg-white p-2 rounded border border-slate-200">
                              <div>
                                <span className="text-sm font-mono font-medium">{item.coil_barcode}</span>
                                <div className="flex items-center gap-1 mt-1">
                                  <MapPin className="w-3 h-3 text-blue-600" />
                                  <span className="text-xs text-slate-600">{item.found_at_placeholder_id}</span>
                                </div>
                              </div>
                              <button
                                onClick={() => handleRemoveScannedCoil(item.coil_barcode)}
                                className="text-red-500 hover:text-red-700 text-xs"
                              >
                                Remove
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {scannedCoilsWithLocations.length === 0 && (
                      <div className="text-center py-8 text-slate-400">
                        <Package className="w-12 h-12 mx-auto mb-2 opacity-30" />
                        <p className="text-sm">No traceable coils scanned yet</p>
                      </div>
                    )}
                  </TabsContent>

                  {/* Non-Traceable Coils Tab */}
                  <TabsContent value="non-traceable" className="space-y-3 mt-4">
                    <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                      <p className="text-xs text-orange-900">
                        <strong>⚠️ Non-Traceable Coils:</strong> Coils without system records or unidentifiable barcodes.
                        Enter details manually to track them during reconciliation.
                      </p>
                    </div>

                    <div className="space-y-3 bg-white p-4 rounded-lg border-2 border-orange-200">
                      <div className="space-y-2">
                        <Label>Coil Barcode / ID *</Label>
                        <div className="flex gap-2">
                          <Input
                            placeholder="Enter or scan coil identifier..."
                            value={newNonTraceable.barcode}
                            onChange={(e) => setNewNonTraceable({ ...newNonTraceable, barcode: e.target.value })}
                            className="flex-grow"
                          />
                          <Button
                            variant="outline"
                            onClick={() => setShowNonTraceableBarcodeScanner(true)}
                            className="border-2 border-orange-600 text-orange-600 hover:bg-orange-50"
                          >
                            <Camera className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-2">
                          <Label>Description *</Label>
                          <Input
                            placeholder="e.g., Rusty steel coil"
                            value={newNonTraceable.description}
                            onChange={(e) => setNewNonTraceable({ ...newNonTraceable, description: e.target.value })}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Est. Weight (tons) *</Label>
                          <Input
                            type="number"
                            step="0.01"
                            placeholder="0.00"
                            value={newNonTraceable.estimated_weight}
                            onChange={(e) => setNewNonTraceable({ ...newNonTraceable, estimated_weight: e.target.value })}
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label>Condition</Label>
                        <Input
                          placeholder="e.g., Good, Damaged, Rusty"
                          value={newNonTraceable.condition}
                          onChange={(e) => setNewNonTraceable({ ...newNonTraceable, condition: e.target.value })}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Found at Placeholder *</Label>
                        <Select
                          value={newNonTraceable.found_at_placeholder_id}
                          onValueChange={(value) => setNewNonTraceable({ ...newNonTraceable, found_at_placeholder_id: value })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select placeholder location" />
                          </SelectTrigger>
                          <SelectContent>
                            {availablePlaceholders.map(pos => {
                              const isOccupied = scannedCoilsWithLocations.find(
                                item => item.found_at_placeholder_id === pos.placeholder_id
                              ) || nonTraceableCoils.find(
                                item => item.found_at_placeholder_id === pos.placeholder_id
                              );
                              return (
                                <SelectItem
                                  key={pos.id}
                                  value={pos.placeholder_id}
                                  disabled={!!isOccupied}
                                >
                                  {pos.placeholder_id} (Layer {pos.layer}) {isOccupied ? '- Occupied' : ''}
                                </SelectItem>
                              );
                            })}
                          </SelectContent>
                        </Select>
                      </div>

                      <Button
                        onClick={handleAddNonTraceable}
                        className="w-full bg-orange-600 hover:bg-orange-700"
                        disabled={!bay || !newNonTraceable.barcode || !newNonTraceable.description || !newNonTraceable.estimated_weight || !newNonTraceable.found_at_placeholder_id}
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        Add Non-Traceable Coil
                      </Button>
                    </div>

                    {nonTraceableCoils.length > 0 && (
                      <div className="bg-orange-50 rounded-lg p-4 space-y-2 max-h-60 overflow-y-auto">
                        <p className="text-sm font-medium text-orange-900">
                          Non-Traceable: {nonTraceableCoils.length} coils
                        </p>
                        <div className="space-y-2">
                          {nonTraceableCoils.map((coil, idx) => (
                            <div key={idx} className="bg-white p-3 rounded border border-orange-200">
                              <div className="flex items-start justify-between mb-2">
                                <div>
                                  <div className="font-medium text-sm text-orange-900">
                                    {coil.barcode || 'No Barcode'}
                                  </div>
                                  <div className="text-xs text-slate-600">{coil.description}</div>
                                </div>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleRemoveNonTraceable(idx)}
                                  className="text-red-500 hover:text-red-700 h-auto p-1"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                              <div className="text-xs text-slate-600 space-y-1">
                                <div><strong>Weight:</strong> {coil.estimated_weight}t</div>
                                {coil.condition && <div><strong>Condition:</strong> {coil.condition}</div>}
                                <div className="flex items-center gap-1 text-blue-600">
                                  <MapPin className="w-3 h-3" />
                                  {coil.found_at_placeholder_id}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {nonTraceableCoils.length === 0 && (
                      <div className="text-center py-8 text-slate-400">
                        <AlertTriangle className="w-12 h-12 mx-auto mb-2 opacity-30" />
                        <p className="text-sm">No non-traceable coils recorded yet</p>
                      </div>
                    )}
                  </TabsContent>
                </Tabs>


                {/* Mark Empty Placeholders Section */}
                <div className="border-t pt-6 space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-slate-900">Mark Empty Placeholders</Label>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setMarkingEmptyMode(!markingEmptyMode)}
                      className={markingEmptyMode ? 'bg-blue-50 border-blue-600' : ''}
                    >
                      {markingEmptyMode ? 'Close' : 'Start Marking'}
                    </Button>
                  </div>

                  {markingEmptyMode && (
                    <div className="bg-blue-50 rounded-lg p-4 space-y-3">
                      <p className="text-xs text-slate-600">
                        Select placeholders that you've verified as physically empty. This helps reconciliation identify missing coils.
                      </p>
                      <Select
                        value=""
                        onValueChange={handleMarkPlaceholderEmpty}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select placeholder to mark as empty..." />
                        </SelectTrigger>
                        <SelectContent>
                          {availablePlaceholders.map(pos => (
                            <SelectItem key={pos.id} value={pos.placeholder_id}>
                              {pos.placeholder_id} (Layer {pos.layer})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      {emptyPlaceholders.length > 0 && (
                        <div className="space-y-1">
                          <p className="text-xs font-medium text-slate-700">Marked as Empty:</p>
                          <div className="flex flex-wrap gap-2">
                            {emptyPlaceholders.map((ph, idx) => (
                              <Badge key={idx} variant="outline" className="text-xs">
                                {ph}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Remarks</Label>
                  <Textarea
                    placeholder="Any discrepancies or notes..."
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    rows={3}
                  />
                </div>

                <div className="flex gap-3">
                  <Button
                    onClick={handleSubmitStockTake}
                    disabled={!location.trim() || !bay || createStockTakeMutation.isPending}
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                  >
                    <CheckCircle className="w-4 h-4 mr-2" />
                    {createStockTakeMutation.isPending ? 'Saving...' : 'Complete Stock Take'}
                  </Button>
                  <Button variant="outline" onClick={resetForm}>
                    Clear
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Recent Stock Takes */}
          <div>
            <Card className="shadow-lg border-none">
              <CardHeader>
                <CardTitle>Recent Stock Takes</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-slate-200 max-h-[800px] overflow-y-auto">
                  {stockTakes.map((take) => (
                    <div key={take.id} className="p-4 hover:bg-slate-50">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <p className="font-semibold text-slate-900">
                            {take.location} {take.bay ? `(${take.bay}` : ''}{take.zone ? `-${take.zone}` : ''}{take.bay ? ')' : ''}
                          </p>
                          <p className="text-xs text-slate-500">
                            {format(new Date(take.stock_take_date), 'MMM d, yyyy HH:mm')}
                          </p>
                        </div>
                        <Badge className={`${
                          take.variance === 0 ? 'bg-emerald-100 text-emerald-800' :
                          'bg-orange-100 text-orange-800'
                        }`}>
                          {take.status}
                        </Badge>
                      </div>

                      <div className="grid grid-cols-3 gap-4 text-sm mb-2">
                        <div>
                          <p className="text-slate-500">Physical</p>
                          <p className="font-semibold">{take.physical_count}</p>
                        </div>
                        <div>
                          <p className="text-slate-500">System</p>
                          <p className="font-semibold">{take.system_count}</p>
                        </div>
                        <div>
                          <p className="text-slate-500">Variance</p>
                          <p className={`font-semibold ${
                            take.variance > 0 ? 'text-orange-600' :
                            take.variance < 0 ? 'text-red-600' :
                            'text-emerald-600'
                          }`}>
                            {take.variance > 0 ? '+' : ''}{take.variance}
                          </p>
                        </div>
                      </div>

                      {take.coils_found && take.coils_found.length > 0 && (
                        <div className="text-xs text-slate-600 bg-blue-50 p-2 rounded mt-2">
                          <div className="font-medium mb-1">Mapped Coils: {take.coils_found.length}</div>
                          <div className="space-y-1 max-h-20 overflow-y-auto">
                            {take.coils_found.slice(0, 3).map((item, idx) => (
                              <div key={idx} className="flex items-center gap-2">
                                <Package className="w-3 h-3 text-blue-600" />
                                <span className="font-mono">{item.coil_barcode}</span>
                                <span className="text-slate-400">→</span>
                                <span className="text-blue-600">{item.found_at_placeholder_id}</span>
                              </div>
                            ))}
                            {take.coils_found.length > 3 && (
                              <div className="text-slate-400">+ {take.coils_found.length - 3} more</div>
                            )}
                          </div>
                        </div>
                      )}

                      {take.variance !== 0 && (
                        <div className="flex items-center gap-2 text-xs text-orange-600 bg-orange-50 p-2 rounded mt-2">
                          <AlertTriangle className="w-3 h-3" />
                          Discrepancy detected - Reconciliation needed
                        </div>
                      )}

                      {take.non_traceable_coils?.length > 0 && (
                        <p className="text-xs text-slate-500 mt-2">
                          {take.non_traceable_coils.length} non-traceable coils found
                        </p>
                      )}

                      {take.empty_placeholders?.length > 0 && (
                        <p className="text-xs text-slate-500 mt-1">
                          {take.empty_placeholders.length} placeholders marked as empty
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Placeholder Selection Dialog */}
        <Dialog open={showPlaceholderDialog} onOpenChange={setShowPlaceholderDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Assign Placeholder to Coil</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Coil Barcode</Label>
                <div className="p-3 bg-blue-50 rounded border border-blue-200">
                  <p className="font-mono font-bold text-blue-900">{tempScannedBarcode}</p>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Placeholder ID *</Label>
                <Select value={currentPlaceholderId} onValueChange={setCurrentPlaceholderId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select where this coil was found..." />
                  </SelectTrigger>
                  <SelectContent>
                    {availablePlaceholders.map(pos => {
                      const isOccupied = scannedCoilsWithLocations.find(
                        item => item.found_at_placeholder_id === pos.placeholder_id
                      ) || nonTraceableCoils.find(
                        item => item.found_at_placeholder_id === pos.placeholder_id
                      );

                      return (
                        <SelectItem
                          key={pos.id}
                          value={pos.placeholder_id}
                          disabled={!!isOccupied}
                        >
                          {pos.placeholder_id} (Layer {pos.layer}) {isOccupied ? '- Occupied' : ''}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
                <p className="text-xs text-slate-500">
                  Select the exact placeholder where you physically found this coil
                </p>
              </div>

              <div className="space-y-2">
                <Label>Or Scan/Enter Placeholder ID</Label>
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-2 mb-2">
                  <p className="text-xs text-amber-900">
                    <strong>📍 Placeholder ID Format:</strong> Scan the barcode on the placeholder sign as-is
                    (e.g., "AB-01-01-L1", "A-05-02-L2-B"). Use exactly what you scan - no parsing needed.
                  </p>
                </div>
                <div className="flex gap-2">
                  <Input
                    placeholder="Scan or enter placeholder ID (e.g., AB-01-01-L1)"
                    value={currentPlaceholderId}
                    onChange={(e) => setCurrentPlaceholderId(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleConfirmCoilWithPlaceholder()}
                    className="flex-grow"
                  />
                  <Button
                    variant="outline"
                    onClick={() => setShowPlaceholderScanner(true)}
                    className="border-2 border-blue-600 text-blue-600 hover:bg-blue-50"
                    size="icon"
                  >
                    <Camera className="w-4 h-4" />
                  </Button>
                </div>
                <p className="text-xs text-slate-500">
                  💡 Scan the barcode/QR code on the placeholder sign or enter manually
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => {
                setShowPlaceholderDialog(false);
                setTempScannedBarcode('');
                setCurrentBarcode('');
                setCurrentPlaceholderId('');
              }}>
                Cancel
              </Button>
              <Button
                onClick={handleConfirmCoilWithPlaceholder}
                disabled={!currentPlaceholderId.trim()}
                className="bg-blue-900 hover:bg-blue-800"
              >
                <CheckCircle className="w-4 h-4 mr-2" />
                Confirm
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Coil Barcode Scanner Dialog */}
        <BarcodeScannerDialog
          isOpen={showBarcodeScanner}
          onClose={() => setShowBarcodeScanner(false)}
          onScan={handleBarcodeScanned}
          title="Scan Coil Barcode"
        />

        {/* Placeholder Barcode Scanner Dialog */}
        <BarcodeScannerDialog
          isOpen={showPlaceholderScanner}
          onClose={() => setShowPlaceholderScanner(false)}
          onScan={handlePlaceholderBarcodeScanned}
          title="Scan Placeholder ID"
        />

        {/* Non-Traceable Barcode Scanner Dialog */}
        <BarcodeScannerDialog
          isOpen={showNonTraceableBarcodeScanner}
          onClose={() => setShowNonTraceableBarcodeScanner(false)}
          onScan={handleNonTraceableBarcodeScanned}
          title="Scan Non-Traceable Coil Barcode"
        />
      </div>
    </div>
  );
}
