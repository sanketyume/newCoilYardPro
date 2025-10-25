
import React, { useState, useEffect, useMemo, useRef } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createPageUrl } from "@/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter } from
"@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Truck,
  CheckCircle,
  XCircle,
  ClipboardCheck,
  Camera,
  Upload,
  Paperclip,
  X,
  ShieldCheck,
  ShieldAlert,
  ChevronRight,
  ScanBarcode } from
"lucide-react";
import { format } from "date-fns";
import BarcodeScannerDialog from "../components/barcode/BarcodeScannerDialog";
import PhotoCaptureDialog from "../components/inspection/PhotoCaptureDialog";

const InspectionDialog = ({
  isOpen,
  onClose,
  coil,
  shipmentId,
  onSave,
  isSaving
}) => {
  const queryClient = useQueryClient();
  const [inspectionState, setInspectionState] = useState({ overall_status: 'Pass', general_remarks: '', results: {} });
  const [images, setImages] = useState([]);
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);
  const [showPhotoCapture, setShowPhotoCapture] = useState(false);

  const { data: inspectionCategories = [] } = useQuery({ queryKey: ['inspectionCategories', 'outgoing'], queryFn: () => base44.entities.InspectionCategory.filter({ type: 'outgoing', is_active: true }) });
  const { data: inspectionPoints = [] } = useQuery({ queryKey: ['inspectionPoints', 'outgoing'], queryFn: () => base44.entities.InspectionPoint.list({ is_active: true }) });

  const inspectionChecklist = useMemo(() => {
    if (!inspectionCategories.length || !inspectionPoints.length) return [];
    return inspectionCategories.map((cat) => ({
      ...cat,
      points: inspectionPoints.filter((p) => p.category_id === cat.id)
    }));
  }, [inspectionCategories, inspectionPoints]);

  const { data: existingInspection, isFetching: isFetchingInspection } = useQuery({
    queryKey: ['outgoingInspection', coil?.barcode],
    queryFn: () => base44.entities.CoilInspection.filter({ coil_barcode: coil.barcode, inspection_type: 'outgoing' }).then((res) => res[0]),
    enabled: !!coil && inspectionChecklist.length > 0,
    onSuccess: (data) => {
      if (data) {
        const initialResults = {};
        (data.inspection_results || []).forEach((res) => {
          const point = inspectionPoints.find((p) => p.name === res.point_name);
          if (point) {
            initialResults[point.id] = { status: res.status, remarks: res.remarks };
          }
        });
        setInspectionState({
          overall_status: data.overall_status,
          general_remarks: data.general_remarks || '',
          results: initialResults
        });
        setImages((data.photo_urls || []).map((url) => ({ url, isExisting: true })));
      } else {
        setInspectionState({ overall_status: 'Pass', general_remarks: '', results: {} });
        setImages([]);
      }
    }
  });

  const handleInspectionResultChange = (pointId, field, value) => {
    setInspectionState((prev) => ({ ...prev, results: { ...prev.results, [pointId]: { ...prev.results[pointId], [field]: value } } }));
  };

  const handleImageChange = (e) => {
    const files = Array.from(e.target.files);
    setImages((prev) => [...prev, ...files.map((file) => ({ file, isExisting: false }))]);
    e.target.value = null;
  };

  const handlePhotoCaptured = (file) => {
    setImages((prev) => [...prev, { file, isExisting: false }]);
  };

  const removeImage = (index) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    let photoUrls = [];
    const newImagesToUpload = images.filter((img) => !img.isExisting);
    const existingImageUrls = images.filter((img) => img.isExisting).map((img) => img.url);

    if (newImagesToUpload.length > 0) {
      const uploadPromises = newImagesToUpload.map((item) => base44.integrations.Core.UploadFile({ file: item.file }));
      const uploadResults = await Promise.all(uploadPromises);
      photoUrls = uploadResults.map((res) => res.file_url);
    }
    photoUrls = [...existingImageUrls, ...photoUrls];

    const inspectionResultsForDB = Object.entries(inspectionState.results).map(([pointId, result]) => {
      const point = inspectionPoints.find((p) => p.id === pointId);
      const category = inspectionCategories.find((c) => c.id === point?.category_id);
      return {
        category_name: category?.name || 'Unknown',
        point_name: point?.name || 'Unknown',
        status: result.status || 'N/A',
        remarks: result.remarks || ''
      };
    });

    const inspectionData = {
      coil_barcode: coil.barcode,
      shipment_id: shipmentId,
      inspection_date: new Date().toISOString(),
      inspection_type: 'outgoing',
      overall_status: inspectionState.overall_status,
      general_remarks: inspectionState.general_remarks,
      inspection_results: inspectionResultsForDB,
      photo_urls: photoUrls
    };

    onSave({ existingInspectionId: existingInspection?.id, inspectionData });
  };

  if (!isOpen) return null;

  return (
    <>
        <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Outgoing Inspection for: {coil?.barcode}</DialogTitle>
          </DialogHeader>
          <div className="max-h-[70vh] overflow-y-auto p-1">
             <Card className="mb-6 shadow-lg border-none">
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><ClipboardCheck className="w-5 h-5" /> Inspection Checklist</CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <Accordion type="multiple" defaultValue={inspectionChecklist.map((c) => c.id)} className="w-full">
                  {inspectionChecklist.map((category) =>
                  <AccordionItem key={category.id} value={category.id}>
                      <AccordionTrigger className="text-lg font-semibold">{category.name}</AccordionTrigger>
                      <AccordionContent>
                        <div className="space-y-6 pt-4">
                          {category.points.map((point) =>
                        <div key={point.id} className="grid grid-cols-1 md:grid-cols-3 gap-4 border-b pb-4 last:border-b-0">
                              <div className="md:col-span-1">
                                <Label className="font-medium">{point.name}</Label>
                                {point.description && <p className="text-xs text-slate-500 mt-1">{point.description}</p>}
                              </div>
                              <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <RadioGroup
                              value={inspectionState.results[point.id]?.status || 'OK'}
                              onValueChange={(value) => handleInspectionResultChange(point.id, 'status', value)}
                              className="flex items-center gap-4">

                                  <div className="flex items-center space-x-2">
                                    <RadioGroupItem value="OK" id={`${point.id}-ok-out`} />
                                    <Label htmlFor={`${point.id}-ok-out`}>OK</Label>
                                  </div>
                                  <div className="flex items-center space-x-2">
                                    <RadioGroupItem value="Not OK" id={`${point.id}-notok-out`} />
                                    <Label htmlFor={`${point.id}-notok-out`}>Not OK</Label>
                                  </div>
                                  <div className="flex items-center space-x-2">
                                    <RadioGroupItem value="N/A" id={`${point.id}-na-out`} />
                                    <Label htmlFor={`${point.id}-na-out`}>N/A</Label>
                                  </div>
                                </RadioGroup>
                                <Input
                              placeholder="Remarks..."
                              value={inspectionState.results[point.id]?.remarks || ''}
                              onChange={(e) => handleInspectionResultChange(point.id, 'remarks', e.target.value)} />

                              </div>
                            </div>
                        )}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  )}
                </Accordion>
                <div className="border-t mt-6 pt-6 space-y-4">
                  <div>
                    <Label className="text-md font-semibold mb-2 flex items-center gap-2"><Paperclip className="w-5 h-5" /> Inspection Photos</Label>
                     <input type="file" ref={fileInputRef} onChange={handleImageChange} accept="image/*" multiple className="hidden" />
                     <input type="file" ref={cameraInputRef} onChange={handleImageChange} accept="image/*" capture="environment" className="hidden" />
                    <div className="flex flex-wrap gap-3">
                        <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
                          <Upload className="w-4 h-4 mr-2" />Upload
                        </Button>
                        <Button variant="outline" onClick={() => cameraInputRef.current?.click()} className="md:hidden">
                          <Camera className="w-4 h-4 mr-2" />Quick Capture
                        </Button>
                        <Button
                        variant="outline"
                        onClick={() => setShowPhotoCapture(true)}
                        className="border-2 border-blue-600 text-blue-600 hover:bg-blue-50">

                          <Camera className="w-4 h-4 mr-2" />Take Photo
                        </Button>
                    </div>
                    <p className="text-xs text-slate-500 mt-2">
                      📸 "Take Photo" provides full camera control for high-quality inspection images.
                    </p>
                     {images.length > 0 &&
                    <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                            {images.map((image, index) =>
                      <div key={index} className="relative group aspect-square">
                                    <img src={image.isExisting ? image.url : URL.createObjectURL(image.file)} alt={`preview ${index}`} className="w-full h-full object-cover rounded-md border-2 border-slate-200" />
                                    <Button size="icon" variant="destructive" className="absolute -top-2 -right-2 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => removeImage(index)}>
                                        <X className="h-4 w-4" />
                                    </Button>
                                </div>
                      )}
                        </div>
                    }
                  </div>
                  <div>
                    <Label className="text-md font-semibold">Overall Inspection Status</Label>
                    <Select value={inspectionState.overall_status} onValueChange={(value) => setInspectionState((p) => ({ ...p, overall_status: value }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Pass">Pass</SelectItem>
                        <SelectItem value="Pass with Remarks">Pass with Remarks</SelectItem>
                        <SelectItem value="Fail">Fail</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-md font-semibold">General Remarks</Label>
                    <Textarea
                      placeholder="Final comments..."
                      value={inspectionState.general_remarks}
                      onChange={(e) => setInspectionState((p) => ({ ...p, general_remarks: e.target.value }))} />

                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
           <DialogFooter>
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={handleSave} disabled={isSaving}>
                {isSaving ? 'Saving...' : 'Save Inspection'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Photo Capture Dialog */}
      <PhotoCaptureDialog
        isOpen={showPhotoCapture}
        onClose={() => setShowPhotoCapture(false)}
        onCapture={handlePhotoCaptured}
        title="Capture Outgoing Inspection Photo" />

      </>);

};

// Utility function to extract coil ID from a potential full barcode string
const getCoilIdFromBarcode = (fullBarcode) => {
  // If the barcode contains spaces, assume the first part is the coil ID
  // e.g., "24AC40001 3.6X1250X1500 23.6" -> "24AC40001"
  const parts = fullBarcode.split(' ');
  return parts[0];
};

export default function OutgoingInspection() {
  const queryClient = useQueryClient();
  const [selectedShipment, setSelectedShipment] = useState(null);
  const [inspectingCoil, setInspectingCoil] = useState(null);
  const [scanResult, setScanResult] = useState(null);
  const [directCoilBarcode, setDirectCoilBarcode] = useState("");
  const [isFindingDirect, setIsFindingDirect] = useState(false);
  const [showBarcodeScanner, setShowBarcodeScanner] = useState(false);

  const { data: shipments = [] } = useQuery({
    queryKey: ["shipments", "Planned"],
    queryFn: () => base44.entities.Shipment.filter({ status: "Planned" }),
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    onError: (error) => {
      console.error('Error loading shipments:', error);
    }
  });

  const { data: coils = [] } = useQuery({
    queryKey: ["coils", "for-outgoing"],
    queryFn: () => base44.entities.Coil.filter({ status: { "$in": ["in_yard", "in_process", "outgoing"] } }),
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    onError: (error) => {
      console.error('Error loading coils:', error);
    }
  });

  const { data: customers = [] } = useQuery({
    queryKey: ["customers"],
    queryFn: () => base44.entities.Customer.list(),
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    onError: (error) => {
      console.error('Error loading customers:', error);
    }
  });

  const { data: outgoingInspections = [] } = useQuery({
    queryKey: ['outgoingInspections'],
    queryFn: () => base44.entities.CoilInspection.filter({ inspection_type: 'outgoing' }),
    initialData: [],
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    onError: (error) => {
      console.error('Error loading inspections:', error);
    }
  });

  const shipmentsWithDetails = useMemo(() => {
    if (!shipments.length) return [];
    return shipments.map((shipment) => {
      const shipmentCoils = coils.filter((c) => shipment.coil_barcodes.includes(c.barcode));
      const customerIds = [...new Set(shipmentCoils.map((c) => c.customer_id))];
      const shipmentCustomers = customers.filter((c) => customerIds.includes(c.id));
      const coilsWithInspection = shipmentCoils.map((coil) => ({
        ...coil,
        inspection: outgoingInspections.find((i) => i.coil_barcode === coil.barcode)
      }));
      return {
        ...shipment,
        coils: coilsWithInspection,
        customerNames: shipmentCustomers.map((c) => c.name).join(', ') || 'N/A'
      };
    });
  }, [shipments, coils, customers, outgoingInspections]);

  const saveInspectionMutation = useMutation({
    mutationFn: async ({ existingInspectionId, inspectionData }) => {
      if (existingInspectionId) {
        return base44.entities.CoilInspection.update(existingInspectionId, inspectionData);
      } else {
        return base44.entities.CoilInspection.create(inspectionData);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['outgoingInspections'] });
      setInspectingCoil(null);
      setScanResult({ type: 'success', message: 'Inspection saved successfully!' });
    },
    onError: (error) => {
      setScanResult({ type: 'error', message: `Save Error: ${error.message}` });
    }
  });

  const handleBarcodeScanned = (barcode) => {
    setDirectCoilBarcode(barcode);
    setShowBarcodeScanner(false);
    setTimeout(() => {
      handleDirectScanWithBarcode(barcode);
    }, 100);
  };

  const handleDirectScanWithBarcode = async (barcode) => {
    const barcodeToScan = barcode || directCoilBarcode;
    if (!barcodeToScan) return;
    setIsFindingDirect(true);
    setScanResult(null);

    try {
      // Extract core coil ID from barcode or use as-is if it's already just an ID
      const coreCoilId = getCoilIdFromBarcode(barcodeToScan);

      // Filter returns array directly, not { data: [] }
      const coilResults = await base44.entities.Coil.filter({ barcode: coreCoilId });

      if (coilResults.length === 0) {
        setScanResult({ type: 'error', message: `Coil "${coreCoilId}" not found in system.` });
        setIsFindingDirect(false);
        return;
      }

      const coil = coilResults[0];
      if (!["in_yard", "in_process", "outgoing"].includes(coil.status)) {
        setScanResult({ type: 'error', message: `Cannot inspect coil with status '${coil.status}'.` });
        setIsFindingDirect(false);
        return;
      }

      setInspectingCoil(coil);
      setIsFindingDirect(false);
      setDirectCoilBarcode('');
    } catch (error) {
      setScanResult({ type: 'error', message: `Failed to find coil: ${error.message}` });
      setIsFindingDirect(false);
    }
  };

  const handleDirectScan = () => handleDirectScanWithBarcode();

  const renderShipmentList = () =>
  <div className="max-w-7xl mx-auto">
        <Card className="shadow-lg border-none mt-6">
            <CardHeader>
              <CardTitle>Select a Planned Shipment</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
                <div className="divide-y divide-slate-200">
                    {shipmentsWithDetails.map((shipment) =>
          <div key={shipment.id} className="p-4 hover:bg-slate-50 flex justify-between items-center">
                            <div>
                                <p className="font-semibold text-blue-900">{shipment.vehicle_number}</p>
                                <p className="text-sm text-slate-700">{shipment.customerNames}</p>
                                <p className="text-xs text-slate-500">
                                    {shipment.coils.length} coils, {(shipment.total_weight || 0).toFixed(2)} tons
                                </p>
                            </div>
                            <Button onClick={() => setSelectedShipment(shipment)} className="bg-primary text-slate-800 px-4 py-2 text-sm font-medium rounded-md inline-flex items-center justify-center gap-2 whitespace-nowrap ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 hover:bg-primary/90 h-10">
                                Inspect Shipment <ChevronRight className="w-4 h-4 ml-2" />
                            </Button>
                        </div>
          )}
                     {shipmentsWithDetails.length === 0 && <p className="p-6 text-center text-slate-500">No planned shipments are ready for inspection.</p>}
                </div>
            </CardContent>
          </Card>
      </div>;


  const renderShipmentDetails = () =>
  <div className="max-w-4xl mx-auto">
        <Button variant="ghost" onClick={() => setSelectedShipment(null)} className="mb-4">
          &larr; Back to Shipments
        </Button>
        <div className="mb-8">
            <h1 className="text-3xl font-bold text-slate-900">Inspect Shipment: {selectedShipment.vehicle_number}</h1>
            <p className="text-slate-600 mt-2">For: {selectedShipment.customerNames}</p>
        </div>

        <Card className="shadow-lg border-none">
            <CardHeader><CardTitle>Coils to Inspect</CardTitle></CardHeader>
            <CardContent className="space-y-3">
                {selectedShipment.coils.map((coil) =>
        <div key={coil.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                        <div>
                            <p className="font-semibold text-slate-900">{coil.barcode}</p>
                            <p className="text-sm text-slate-600">{coil.weight} tons</p>
                        </div>
                        <div className="flex items-center gap-4">
                            {coil.inspection ?
            <Badge variant="secondary" className="bg-emerald-100 text-emerald-800 border-emerald-300">
                                    <ShieldCheck className="w-4 h-4 mr-1.5" />
                                    Inspection Complete
                                </Badge> :

            <Badge variant="outline" className="text-orange-800 border-orange-300">
                                    <ShieldAlert className="w-4 h-4 mr-1.5" />
                                    Pending Inspection
                                </Badge>
            }
                            <Button size="sm" variant="outline" onClick={() => setInspectingCoil(coil)}>
                                {coil.inspection ? "View/Re-inspect" : "Inspect"}
                            </Button>
                        </div>
                    </div>
        )}
            </CardContent>
        </Card>
      </div>;


  return (
    <div className="p-6 lg:p-8 bg-slate-50 min-h-screen">
       <div className="mb-8 max-w-7xl mx-auto">
            <h1 className="text-3xl font-bold text-slate-900">Outgoing Inspection</h1>
            <p className="text-slate-600 mt-2">Perform pre-dispatch inspections for planned shipments or individual coils.</p>
        </div>

        {scanResult &&
      <div className="max-w-7xl mx-auto">
            <Alert className={`mb-6 ${scanResult.type === 'success' ? 'border-emerald-500' : 'border-red-500'}`}>
              {scanResult.type === 'success' ? <CheckCircle className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
              <AlertTitle>{scanResult.type === 'success' ? 'Success' : 'Error'}</AlertTitle>
              <AlertDescription>{scanResult.message}</AlertDescription>
            </Alert>
          </div>
      }

        <Tabs defaultValue="planned" className="max-w-7xl mx-auto">
            <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="planned">Planned Shipments</TabsTrigger>
                <TabsTrigger value="direct">Direct Inspection</TabsTrigger>
            </TabsList>
            <TabsContent value="planned">
                {selectedShipment ? renderShipmentDetails() : renderShipmentList()}
            </TabsContent>
            <TabsContent value="direct">
                <Card className="shadow-lg border-none mt-6">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <ScanBarcode className="w-5 h-5 text-blue-900" />
                            Inspect a Single Coil
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-4">
                        <p className="text-sm text-slate-600 mb-4">
                            Use this for ad-hoc quality checks or to inspect a coil before it has been assigned to a shipment.
                        </p>
                        <div className="flex items-end gap-2 max-w-md">
                             <div className="flex-grow space-y-1">
                                <Label htmlFor="direct-barcode">Scan Barcode or Enter Coil ID</Label>
                                <Input
                    id="direct-barcode"
                    placeholder='Scan barcode or enter Coil ID (e.g., "24AC40001" or "24AC40001 3.6X1250X1500 23.6")'
                    value={directCoilBarcode}
                    onChange={(e) => setDirectCoilBarcode(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleDirectScan()} />

                            </div>
                            <Button
                  variant="outline"
                  onClick={() => setShowBarcodeScanner(true)}
                  className="border-2 border-blue-600 text-blue-600 hover:bg-blue-50">

                              <Camera className="w-4 h-4" />
                            </Button>
                            <Button onClick={handleDirectScan} disabled={isFindingDirect || !directCoilBarcode} className="bg-primary text-slate-800 px-4 py-2 text-sm font-medium rounded-md inline-flex items-center justify-center gap-2 whitespace-nowrap ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 hover:bg-primary/90 h-10">
                                {isFindingDirect ? "Finding..." : "Find & Inspect"}
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </TabsContent>
        </Tabs>

        <InspectionDialog
        isOpen={!!inspectingCoil}
        onClose={() => setInspectingCoil(null)}
        coil={inspectingCoil}
        shipmentId={selectedShipment?.id}
        onSave={saveInspectionMutation.mutate}
        isSaving={saveInspectionMutation.isPending} />


        <BarcodeScannerDialog
        isOpen={showBarcodeScanner}
        onClose={() => setShowBarcodeScanner(false)}
        onScan={handleBarcodeScanned}
        title="Scan Coil for Inspection" />

    </div>);

}
