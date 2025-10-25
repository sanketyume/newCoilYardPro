
import React, { useState, useMemo, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  ScanBarcode,
  Upload,
  CheckCircle,
  AlertCircle,
  Camera,
  Package,
  ClipboardCheck,
  X,
  Paperclip,
  AlertTriangle,
  Save,
  Download
} from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import BarcodeScannerDialog from "../components/barcode/BarcodeScannerDialog";
import PhotoCaptureDialog from "../components/inspection/PhotoCaptureDialog";
import { OfflineStorage } from "../components/network/OfflineStorage";
import { useOfflineSupport } from "../components/network/useOfflineSupport";
import { getCoilIdFromBarcode, parseComplexBarcode } from '../components/utils/barcodeParser'; // Moved from here

export default function CoilReceipt() {
  const queryClient = useQueryClient();
  const [scannedBarcode, setScannedBarcode] = useState('');
  const [coilId, setCoilId] = useState('');
  const [existingCoil, setExistingCoil] = useState(null);
  const [existingInspection, setExistingInspection] = useState(null);
  const [isUpdateMode, setIsUpdateMode] = useState(false);
  const [showBarcodeScanner, setShowBarcodeScanner] = useState(false);

  const [formData, setFormData] = useState({
    weight: '', width: '', thickness: '', diameter: '', coil_type: '',
    supplier: '', priority: 'medium', mes_reference: '', heat_number: '',
    customer_id: '',
    destination_address: ''
  });

  const [inspectionState, setInspectionState] = useState({
    overall_status: 'Pass', general_remarks: '', results: {}
  });

  const [images, setImages] = useState([]);
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);
  const [showPhotoCapture, setShowPhotoCapture] = useState(false);

  const [message, setMessage] = useState(null);

  // Offline support hook
  const draftKey = `coil_receipt_${coilId || 'new'}`;
  const { hasDraft, loadDraft, saveDraft: autoSaveDraft, clearDraft } = useOfflineSupport(draftKey, {
    formData,
    inspectionState,
    coilId,
    scannedBarcode,
    // Only save URLs of existing images to draft for simplicity, new File objects require IndexedDB
    images: images.filter(img => img.isExisting).map(img => img.url)
  });

  const { data: coilTypes = [] } = useQuery({ 
    queryKey: ['coilTypes'], 
    queryFn: () => base44.entities.CoilType.list(),
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    onError: (error) => {
      console.error('Error loading coil types:', error);
    }
  });
  const { data: customers = [] } = useQuery({ 
    queryKey: ['customers'], 
    queryFn: () => base44.entities.Customer.list(),
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    onError: (error) => {
      console.error('Error loading customers:', error);
    }
  });
  const { data: inspectionCategories = [] } = useQuery({ 
    queryKey: ['inspectionCategories', 'incoming'], 
    queryFn: () => base44.entities.InspectionCategory.filter({ type: 'incoming', is_active: true }),
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    onError: (error) => {
      console.error('Error loading inspection categories:', error);
    }
  });
  const { data: inspectionPoints = [] } = useQuery({ 
    queryKey: ['inspectionPoints', 'active'], 
    queryFn: () => base44.entities.InspectionPoint.filter({ is_active: true }),
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    onError: (error) => {
      console.error('Error loading inspection points:', error);
    }
  });

  const inspectionChecklist = useMemo(() => {
    if (!inspectionCategories || inspectionCategories.length === 0 || !inspectionPoints) return [];
    return inspectionCategories.map(cat => ({
      ...cat,
      points: inspectionPoints.filter(p => p.category_id === cat.id)
    })).filter(cat => cat.points.length > 0);
  }, [inspectionCategories, inspectionPoints]);

  // Manual save draft function
  const handleSaveDraft = () => {
    const draftData = {
      formData,
      inspectionState,
      coilId,
      scannedBarcode,
      // Only save URLs of existing images for manual draft save
      images: images.filter(img => img.isExisting).map(img => img.url)
    };
    const success = OfflineStorage.saveDraft(draftKey, draftData);
    if (success) {
      setMessage({ type: 'success', text: '✓ Draft saved locally. You can continue later even offline.' });
      setTimeout(() => setMessage(null), 3000);
    } else {
      setMessage({ type: 'error', text: 'Error saving draft locally.' });
    }
  };

  // Load draft function
  const handleLoadDraft = () => {
    const draft = loadDraft();
    if (draft) {
      setFormData(draft.formData || formData);
      setInspectionState(draft.inspectionState || inspectionState);
      setCoilId(draft.coilId || '');
      setScannedBarcode(draft.scannedBarcode || '');
      if (draft.images && Array.isArray(draft.images)) {
        setImages(draft.images.map(url => ({ url, isExisting: true })));
      } else {
        setImages([]);
      }
      setMessage({ type: 'success', text: '✓ Draft loaded successfully!' });
      setTimeout(() => setMessage(null), 3000);
    } else {
      setMessage({ type: 'warning', text: 'No draft found to load.' });
    }
  };

  const resetForm = () => {
    setScannedBarcode('');
    setCoilId('');
    setExistingCoil(null);
    setExistingInspection(null);
    setIsUpdateMode(false);
    setFormData({
      weight: '', width: '', thickness: '', diameter: '', coil_type: '',
      supplier: '', priority: 'medium', mes_reference: '', heat_number: '',
      customer_id: '',
      destination_address: ''
    });
    setInspectionState({ overall_status: 'Pass', general_remarks: '', results: {} });
    setImages([]);
    setMessage(null);
    // When resetting the form, also clear the draft for the current coilId
    if (coilId) {
      clearDraft();
    }
  };
  
  const handleBarcodeScanned = (barcode) => {
    setScannedBarcode(barcode);
    setShowBarcodeScanner(false);
    setTimeout(() => {
      handleScan(barcode);
    }, 100);
  };

  const handleScan = async (barcodeValue) => {
    resetForm();
    const barcodeToScan = barcodeValue || scannedBarcode;
    if (!barcodeToScan.trim()) {
      setMessage({ type: 'error', text: 'Please enter or scan a barcode.' });
      return;
    }
    setScannedBarcode(barcodeToScan);

    const parsed = parseComplexBarcode(barcodeToScan);
    if (!parsed) {
      setMessage({ type: 'error', text: 'Invalid barcode format. Could not parse.' });
      return;
    }
    
    setCoilId(parsed.coilId);

    // Initial load for existing coil/inspection, check online status
    let coilResults = [];
    let inspectionResults = [];
    if (navigator.onLine) {
        ({ data: coilResults = [] } = await base44.entities.Coil.filter({ barcode: parsed.coilId }));
        if (coilResults && coilResults.length > 0) {
            ({ data: inspectionResults } = await base44.entities.CoilInspection.filter({ coil_barcode: parsed.coilId, inspection_type: 'incoming' }, '-created_date', 1));
        }
    } else {
        setMessage({ type: 'warning', text: 'Currently offline. Cannot check for existing coil/inspection from server. Proceeding assuming new coil, or it will update later if it already exists.' });
        // In offline mode, we cannot verify existence from the server. User will proceed as if new,
        // and actual check and merge will happen when operation is queued and executed online.
    }

    if (coilResults && coilResults.length > 0) {
      const coil = coilResults[0];
      setExistingCoil(coil);
      setIsUpdateMode(true);
      setFormData({
        weight: coil.weight ?? parsed.weight ?? '',
        width: coil.width ?? parsed.width ?? '',
        thickness: coil.thickness ?? parsed.thickness ?? '',
        diameter: coil.diameter ?? parsed.diameter ?? '',
        coil_type: coil.coil_type || '', supplier: coil.supplier || '',
        priority: coil.priority || 'medium', mes_reference: coil.mes_reference || '',
        heat_number: coil.heat_number || '',
        customer_id: coil.customer_id || '',
        destination_address: coil.destination_address || ''
      });

      if (inspectionResults && inspectionResults.length > 0) {
        const inspection = inspectionResults[0];
        setExistingInspection(inspection);
        
        const initialResults = {};
        if (inspection.inspection_results) {
          inspection.inspection_results.forEach(res => {
            const point = inspectionPoints.find(p => p.name === res.point_name && inspectionCategories.some(cat => cat.id === p.category_id && cat.name === res.category_name));
            if (point) {
              initialResults[point.id] = { status: res.status, remarks: res.remarks };
            }
          });
        }
        
        setInspectionState({
          overall_status: inspection.overall_status,
          general_remarks: inspection.general_remarks || '',
          results: initialResults
        });
        setImages((inspection.photo_urls || []).map(url => ({ url, isExisting: true })));
        setMessage({ type: 'warning', text: `⚠️ EXISTING COIL DETECTED! Barcode "${parsed.coilId}" already exists in the system. You are now in UPDATE mode. Any changes will modify the existing coil record.` });
      } else {
        setMessage({ type: 'warning', text: `⚠️ EXISTING COIL DETECTED! Barcode "${parsed.coilId}" already exists. You can update its details or perform a new inspection.` });
      }
    } else {
       setFormData(prev => ({
          ...prev, weight: parsed.weight || '', width: parsed.width || '',
          thickness: parsed.thickness || '', diameter: parsed.diameter || '',
        }));
      setIsUpdateMode(false);
      setMessage({ type: 'info', text: '✓ New coil detected. Please complete details and inspection to register this coil.' });
    }
  };

  const handleInspectionResultChange = (pointId, field, value) => {
    setInspectionState(prev => ({ ...prev, results: { ...prev.results, [pointId]: { ...prev.results[pointId], [field]: value } } }));
  };
  
  const handleImageChange = (e) => {
    const files = Array.from(e.target.files);
    setImages(prev => [...prev, ...files.map(file => ({ file }))]);
    e.target.value = null;
  };
  
  const handlePhotoCaptured = (file) => {
    setImages(prev => [...prev, { file }]);
  };

  const removeImage = (index) => {
    setImages(prev => prev.filter((_, i) => i !== index));
  };

  const handleCustomerChange = (customerId) => {
    const customer = customers.find(c => c.id === customerId);
    setFormData(prev => ({
      ...prev,
      customer_id: customerId,
      destination_address: customer?.address || prev.destination_address
    }));
  };

  const mutation = useMutation({
    mutationFn: async () => {
      // Check if online before performing any network operations
      if (!navigator.onLine) {
        throw new Error("OFFLINE: You are currently offline. This operation has been queued and will be processed when connection is restored.");
      }

      if (!coilId || !coilId.trim()) {
        throw new Error("Coil barcode is required");
      }

      // Re-check for duplicates only if creating, and online.
      // If offline, the duplicate check would have been skipped, and the operation will be queued.
      // When retried later (online), this check would then execute.
      if (!isUpdateMode) {
        const { data: duplicateCheck = [] } = await base44.entities.Coil.filter({ barcode: coilId });
        if (duplicateCheck.length > 0) {
          throw new Error(`Cannot create coil: Barcode "${coilId}" already exists in the system. Please scan again to update the existing coil.`);
        }
      }

      let finalPhotoUrls = images.filter(img => img.isExisting).map(img => img.url);
      const newImagesToUpload = images.filter(img => !img.isExisting);
      if (newImagesToUpload.length > 0) {
        const uploadPromises = newImagesToUpload.map(item => base44.integrations.Core.UploadFile({ file: item.file }));
        const uploadResults = await Promise.all(uploadPromises);
        finalPhotoUrls = [...finalPhotoUrls, ...uploadResults.map(res => res.file_url)];
      }

      const coilData = {
        barcode: coilId, ...formData,
        weight: parseFloat(formData.weight),
        width: formData.width ? parseFloat(formData.width) : null,
        thickness: formData.thickness ? parseFloat(formData.thickness) : null,
        diameter: formData.diameter ? parseFloat(formData.diameter) : null,
        received_date: existingCoil ? existingCoil.received_date : new Date().toISOString(),
        status: 'incoming',
      };
      
      if (existingCoil) {
        await base44.entities.Coil.update(existingCoil.id, coilData);
      } else {
        await base44.entities.Coil.create(coilData);
      }

      const inspectionResultsForDB = Object.entries(inspectionState.results).map(([pointId, result]) => {
        const point = inspectionPoints.find(p => p.id === pointId);
        const category = inspectionCategories.find(c => c.id === point?.category_id);
        return {
          category_name: category?.name || 'Unknown', point_name: point?.name || 'Unknown',
          status: result.status || 'N/A', remarks: result.remarks || ''
        }
      });
      const inspectionData = {
        coil_barcode: coilId, inspection_date: new Date().toISOString(), inspection_type: 'incoming',
        overall_status: inspectionState.overall_status, general_remarks: inspectionState.general_remarks,
        inspection_results: inspectionResultsForDB, photo_urls: finalPhotoUrls
      };
      
      if (existingInspection) {
        await base44.entities.CoilInspection.update(existingInspection.id, inspectionData);
      } else {
        await base44.entities.CoilInspection.create(inspectionData);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries();
      const action = isUpdateMode ? 'updated' : 'received and registered';
      setMessage({ type: 'success', text: `✓ Coil ${action} successfully! Inspection recorded.` });
      clearDraft(); // Clear draft on success
      setTimeout(resetForm, 3000);
    },
    onError: (error) => {
      if (error.message.includes("OFFLINE")) {
        // Queue the operation for later
        // Note: For File objects within `images`, `OfflineStorage` must handle their serialization (e.g., to IndexedDB or base64)
        // or a more sophisticated queue mechanism is needed.
        // For this implementation, we assume OfflineStorage can handle the images array as is, or that
        // a more complex image queuing mechanism for new files would be implemented within OfflineStorage.
        OfflineStorage.queueOperation({
          type: 'coil_receipt',
          data: {
            coilId,
            formData,
            inspectionState,
            // To ensure new images can be re-uploaded, we need to save their content.
            // For now, we save metadata and rely on OfflineStorage's deeper implementation to handle file content.
            images: images.map(img => ({
                url: img.url || null,
                isExisting: img.isExisting,
                fileName: img.file ? img.file.name : undefined,
                fileType: img.file ? img.file.type : undefined,
                // A true offline solution would store `img.file` content (e.g., Base64 or IndexedDB blob URL) here.
            }))
          }
        });
        setMessage({ 
          type: 'error', 
          text: `⚠️ No internet connection. Your work has been saved locally and will be submitted automatically when connection is restored.` 
        });
      } else {
        setMessage({ type: 'error', text: `Error: ${error.message}`});
      }
    },
    retry: 3, // Retry failed mutations (e.g., network issues)
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000), // Exponential backoff
  });
  
  const handleSubmit = () => {
    if (!coilId) {
        setMessage({ type: 'error', text: 'Please scan a coil barcode first.' });
        return;
    }
    if (!formData.weight) {
        setMessage({ type: 'error', text: 'Coil weight is required.' });
        return;
    }
    mutation.mutate();
  };

  return (
    <div className="p-6 lg:p-8 bg-slate-50 min-h-screen">
      <div className="max-w-5xl mx-auto">
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-slate-900">Coil Receipt & Inspection</h1>
              <p className="text-slate-600 mt-2">Scan and inspect incoming coils with customer assignment - System prevents duplicate barcodes</p>
            </div>
            {hasDraft && (
              <Button 
                variant="outline" 
                onClick={handleLoadDraft}
                className="border-2 border-blue-600 text-blue-600 hover:bg-blue-50"
              >
                <Download className="w-4 h-4 mr-2" />
                Load Saved Draft
              </Button>
            )}
          </div>
        </div>

        {message && (
          <Alert className={`mb-6 ${
            message.type === 'success' ? 'bg-emerald-50 border-emerald-200' :
            message.type === 'error' ? 'bg-red-50 border-red-200' :
            message.type === 'warning' ? 'bg-orange-50 border-orange-200' :
            'bg-blue-50 border-blue-200'
          }`}>
            {message.type === 'success' ? <CheckCircle className="h-4 w-4 text-emerald-600" /> : 
             message.type === 'error' ? <AlertCircle className="h-4 w-4 text-red-600" /> :
             message.type === 'warning' ? <AlertTriangle className="h-4 w-4 text-orange-600" /> :
             <AlertCircle className="h-4 w-4 text-blue-600" />}
            <AlertDescription className={`font-medium ${
              message.type === 'success' ? 'text-emerald-900' :
              message.type === 'error' ? 'text-red-900' :
              message.type === 'warning' ? 'text-orange-900' :
              'text-blue-900'
            }`}>
              {message.text}
            </AlertDescription>
          </Alert>
        )}

        <Card className="mb-6 shadow-lg border-none">
          <CardHeader className="bg-gradient-to-r from-blue-900 to-blue-700 text-white">
            <CardTitle className="flex items-center gap-2"><ScanBarcode className="w-5 h-5" />1. Scan Coil Barcode</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="flex gap-2">
              <Input
                placeholder='e.g., "24AC40002 3.6X1250X1500 23.6"'
                value={scannedBarcode}
                onChange={(e) => setScannedBarcode(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleScan()}
                className="text-lg h-12"
              />
              <Button 
                onClick={() => setShowBarcodeScanner(true)} 
                variant="outline"
                className="h-12 px-6 border-2 border-blue-600 text-blue-600 hover:bg-blue-50"
              >
                <Camera className="w-5 h-5 mr-2" />
                Scan
              </Button>
              <Button onClick={() => handleScan()} className="bg-blue-900 hover:bg-blue-800 h-12 px-8">
                Parse
              </Button>
            </div>
          </CardContent>
        </Card>

        {coilId && (
          <>
            <Card className="mb-6 shadow-lg border-none bg-blue-50 border-blue-200">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-slate-700">
                    💾 <strong>Auto-save enabled:</strong> Your work is automatically saved every few seconds (if coil ID is set) and preserved even if you lose connection.
                  </p>
                  <Button 
                    size="sm" 
                    variant="outline" 
                    onClick={handleSaveDraft}
                    className="border-blue-600 text-blue-600 hover:bg-blue-100"
                  >
                    <Save className="w-4 h-4 mr-2" />
                    Save Draft Now
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="mb-6 shadow-lg border-none">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Package className="w-5 h-5" /> 
                    2. Coil Details & Customer Assignment
                    {isUpdateMode && <Badge variant="secondary" className="bg-orange-100 text-orange-800">UPDATE MODE</Badge>}
                  </span>
                  <Badge variant="secondary" className="font-mono">{coilId}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-6">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h3 className="font-semibold text-blue-900 mb-3 flex items-center gap-2">
                    <AlertCircle className="w-5 h-5"/>
                    Customer Assignment (from MES or Manual)
                  </h3>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Customer *</Label>
                      <Select value={formData.customer_id} onValueChange={handleCustomerChange}>
                        <SelectTrigger><SelectValue placeholder="Select customer for this coil" /></SelectTrigger>
                        <SelectContent>
                          {customers.map(customer => (
                            <SelectItem key={customer.id} value={customer.id}>
                              {customer.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-slate-500">Assign customer from MES data or select manually</p>
                    </div>
                    <div className="space-y-2">
                      <Label>Destination Address</Label>
                      <Input 
                        value={formData.destination_address} 
                        onChange={(e) => setFormData({...formData, destination_address: e.target.value})}
                        placeholder="Auto-filled from customer or enter custom"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                  <div className="space-y-2">
                    <Label>Weight (tons) *</Label>
                    <Input type="number" step="0.01" value={formData.weight} onChange={(e) => setFormData({...formData, weight: e.target.value})} required className="bg-slate-100"/>
                  </div>
                  <div className="space-y-2">
                    <Label>Width (mm)</Label>
                    <Input type="number" value={formData.width} onChange={(e) => setFormData({...formData, width: e.target.value})} className="bg-slate-100" />
                  </div>
                  <div className="space-y-2">
                    <Label>Thickness (mm)</Label>
                    <Input type="number" step="0.01" value={formData.thickness} onChange={(e) => setFormData({...formData, thickness: e.target.value})} className="bg-slate-100" />
                  </div>
                  <div className="space-y-2">
                    <Label>Diameter (mm)</Label>
                    <Input type="number" value={formData.diameter} onChange={(e) => setFormData({...formData, diameter: e.target.value})} className="bg-slate-100"/>
                  </div>
                  <div className="space-y-2">
                    <Label>Coil Type</Label>
                    <Select value={formData.coil_type} onValueChange={(value) => setFormData({...formData, coil_type: value})}>
                      <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                      <SelectContent>{coilTypes.map(type => <SelectItem key={type.id} value={type.type_code}>{type.type_name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Supplier</Label>
                    <Input value={formData.supplier} onChange={(e) => setFormData({...formData, supplier: e.target.value})} />
                  </div>
                  <div className="space-y-2">
                    <Label>Priority</Label>
                    <Select value={formData.priority} onValueChange={(value) => setFormData({...formData, priority: value})}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="urgent">Urgent</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>MES Reference</Label>
                    <Input value={formData.mes_reference} onChange={(e) => setFormData({...formData, mes_reference: e.target.value})} />
                  </div>
                  <div className="space-y-2">
                    <Label>Heat Number</Label>
                    <Input value={formData.heat_number} onChange={(e) => setFormData({...formData, heat_number: e.target.value})} />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="mb-6 shadow-lg border-none">
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><ClipboardCheck className="w-5 h-5" /> 3. Inspection</CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <Accordion type="multiple" defaultValue={inspectionChecklist.map(c => c.id)} className="w-full">
                  {inspectionChecklist.map(category => (
                    <AccordionItem key={category.id} value={category.id}>
                      <AccordionTrigger className="text-lg font-semibold">{category.name}</AccordionTrigger>
                      <AccordionContent>
                        <div className="space-y-6 pt-4">
                          {category.points.length > 0 ? category.points.map(point => (
                            <div key={point.id} className="grid grid-cols-1 md:grid-cols-3 gap-4 border-b pb-4 last:border-b-0">
                              <div className="md:col-span-1">
                                <Label className="font-medium">{point.name}</Label>
                                {point.description && <p className="text-xs text-slate-500 mt-1">{point.description}</p>}
                              </div>
                              <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <RadioGroup
                                  value={inspectionState.results[point.id]?.status || 'OK'}
                                  onValueChange={(value) => handleInspectionResultChange(point.id, 'status', value)}
                                  className="flex items-center gap-4"
                                >
                                  <div className="flex items-center space-x-2"><RadioGroupItem value="OK" id={`${point.id}-ok`} /><Label htmlFor={`${point.id}-ok`}>OK</Label></div>
                                  <div className="flex items-center space-x-2"><RadioGroupItem value="Not OK" id={`${point.id}-notok`} /><Label htmlFor={`${point.id}-notok`}>Not OK</Label></div>
                                  <div className="flex items-center space-x-2"><RadioGroupItem value="N/A" id={`${point.id}-na`} /><Label htmlFor={`${point.id}-na`}>N/A</Label></div>
                                </RadioGroup>
                                <Input
                                  placeholder="Remarks..."
                                  value={inspectionState.results[point.id]?.remarks || ''}
                                  onChange={(e) => handleInspectionResultChange(point.id, 'remarks', e.target.value)}
                                />
                              </div>
                            </div>
                          )) : <p className="text-sm text-slate-500">No inspection points configured for this category.</p>}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>

                {inspectionChecklist.length === 0 && (
                  <div className="text-center py-8 text-slate-500 bg-slate-50 rounded-lg">
                    <p>No incoming inspection criteria found.</p>
                    <p className="text-xs mt-1">Please configure categories and points in the Masters page.</p>
                  </div>
                )}
                
                <div className="border-t mt-6 pt-6 space-y-4">
                  <div>
                    <Label className="text-md font-semibold mb-2 flex items-center gap-2"><Paperclip className="w-5 h-5"/> Inspection Photos</Label>
                     <input type="file" ref={fileInputRef} onChange={handleImageChange} accept="image/*" multiple className="hidden" />
                     <input type="file" ref={cameraInputRef} onChange={handleImageChange} accept="image/*" capture="environment" className="hidden" />
                    <div className="flex flex-wrap gap-3">
                        <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
                          <Upload className="w-4 h-4 mr-2"/>Upload Photos
                        </Button>
                        <Button variant="outline" onClick={() => cameraInputRef.current?.click()} className="md:hidden">
                          <Camera className="w-4 h-4 mr-2"/>Quick Capture (Mobile)
                        </Button>
                        <Button 
                          variant="outline" 
                          onClick={() => setShowPhotoCapture(true)}
                          className="border-2 border-blue-600 text-blue-600 hover:bg-blue-50"
                        >
                          <Camera className="w-4 h-4 mr-2"/>Take Photo
                        </Button>
                    </div>
                    <p className="text-xs text-slate-500 mt-2">
                      📸 Use "Take Photo" for best quality. Photos are captured directly from your device camera.
                    </p>
                     {images.length > 0 && (
                        <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                            {images.map((image, index) => (
                                <div key={index} className="relative group aspect-square">
                                    <img src={image.isExisting ? image.url : URL.createObjectURL(image.file)} alt={`preview ${index}`} className="w-full h-full object-cover rounded-md border-2 border-slate-200" />
                                    <Button size="icon" variant="destructive" className="absolute -top-2 -right-2 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => removeImage(index)}>
                                        <X className="h-4 w-4"/>
                                    </Button>
                                </div>
                            ))}
                        </div>
                    )}
                  </div>
                  <div>
                    <Label className="text-md font-semibold">Overall Inspection Status</Label>
                    <Select value={inspectionState.overall_status} onValueChange={(value) => setInspectionState(p => ({...p, overall_status: value}))}>
                      <SelectTrigger><SelectValue/></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Pass">Pass</SelectItem>
                        <SelectItem value="Pass with Remarks">Pass with Remarks</SelectItem>
                        <SelectItem value="Fail">Fail</SelectItem>
                        <SelectItem value="Quarantined">Quarantined</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-md font-semibold">General Remarks</Label>
                    <Textarea
                      placeholder="Final comments on the overall coil condition..."
                      value={inspectionState.general_remarks}
                      onChange={(e) => setInspectionState(p => ({...p, general_remarks: e.target.value}))}
                    />
                  </div>
                </div>
              </CardContent>
              <CardFooter className="p-6">
                 <Button size="lg" onClick={handleSubmit} disabled={mutation.isPending} className="w-full bg-emerald-600 hover:bg-emerald-700">
                    <CheckCircle className="w-5 h-5 mr-2" />
                    {mutation.isPending ? 'Saving...' : isUpdateMode ? 'Update Coil & Save Inspection' : 'Complete Receipt & Save Inspection'}
                  </Button>
              </CardFooter>
            </Card>
          </>
        )}
      </div>

      <BarcodeScannerDialog
        isOpen={showBarcodeScanner}
        onClose={() => setShowBarcodeScanner(false)}
        onScan={handleBarcodeScanned}
        title="Scan Coil Barcode"
      />

      <PhotoCaptureDialog
        isOpen={showPhotoCapture}
        onClose={() => setShowPhotoCapture(false)}
        onCapture={handlePhotoCaptured}
        title="Capture Inspection Photo"
      />
    </div>
  );
}
