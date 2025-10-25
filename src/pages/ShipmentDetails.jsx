
import React, { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createPageUrl } from "@/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import {
  ScanBarcode,
  Truck,
  User,
  Weight,
  Package,
  ArrowLeft,
  CheckCircle,
  XCircle,
  Users,
  Camera
} from "lucide-react";
import { _ } from 'lodash';
import BarcodeScannerDialog from "../components/barcode/BarcodeScannerDialog";

/**
 * Extracts the core coil ID from a scanned barcode string.
 * This function can be customized based on your specific barcode format.
 * For example, if barcodes are like "PREFIX-COILID-SUFFIX", you might extract the middle part.
 * For now, it simply trims whitespace.
 * @param {string} scannedValue The raw barcode string obtained from a scanner.
 * @returns {string} The cleaned/core coil ID.
 */
const getCoilIdFromBarcode = (scannedValue) => {
  if (!scannedValue) return "";
  // A common pattern might be to remove leading/trailing whitespace.
  // If your coil IDs are embedded in a larger barcode (e.g., GS1 DataMatrix),
  // you would add parsing logic here (e.g., regex, substring based on Application Identifiers).
  // Example: If coil ID is always the first part before a hyphen:
  // const parts = scannedValue.split('-');
  // return parts[0].trim();
  
  return scannedValue.trim();
};

export default function ShipmentDetails() {
  const queryClient = useQueryClient();
  const urlParams = new URLSearchParams(window.location.search);
  const shipmentId = urlParams.get("id");

  const [scannedBarcode, setScannedBarcode] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState("");
  const [scannedCoilData, setScannedCoilData] = useState(null);
  const [scanResult, setScanResult] = useState(null);
  const [showBarcodeScanner, setShowBarcodeScanner] = useState(false);
  
  const { data: shipment, isLoading: isLoadingShipment } = useQuery({
    queryKey: ['shipment', shipmentId],
    queryFn: () => base44.entities.Shipment.get(shipmentId),
    enabled: !!shipmentId,
  });

  const { data: customers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: () => base44.entities.Customer.list(),
  });
  
  const { data: coilsInShipment = [] } = useQuery({
    queryKey: ['coilsInShipment', shipmentId],
    queryFn: () => shipment.coil_barcodes.length > 0 ? base44.entities.Coil.filter({ barcode: { "$in": shipment.coil_barcodes }}) : [],
    enabled: !!shipment && shipment.coil_barcodes?.length > 0,
    initialData: [],
  });

  const coilsWithCustomer = useMemo(() => {
      return coilsInShipment.map(coil => {
          const customer = customers.find(c => c.id === coil.customer_id);
          return {...coil, customerName: customer?.name || "N/A" }
      })
  }, [coilsInShipment, customers]);

  const addCoilToShipmentMutation = useMutation({
    mutationFn: async ({coil, customerId}) => {
      if (shipment.coil_barcodes.includes(coil.barcode)) {
        throw new Error("Coil already in this shipment.");
      }
      
      const customer = customers.find(c => c.id === customerId);
      if (!customer) throw new Error("Invalid customer selected.");

      const updatedCoilBarcodes = [...shipment.coil_barcodes, coil.barcode];
      const updatedWeight = (shipment.total_weight || 0) + coil.weight;

      await base44.entities.Shipment.update(shipmentId, {
        coil_barcodes: updatedCoilBarcodes,
        total_weight: updatedWeight
      });
      
      await base44.entities.Coil.update(coil.id, {
        shipment_id: shipmentId,
        status: 'outgoing',
        customer_id: customerId,
        destination_address: customer.address
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shipment', shipmentId] });
      queryClient.invalidateQueries({ queryKey: ['coilsInShipment', shipmentId] });
      setScanResult({ type: 'success', message: 'Coil added to shipment with customer mapping!' });
      setScannedBarcode("");
      setScannedCoilData(null);
      setSelectedCustomer("");
    },
    onError: (error) => {
      setScanResult({ type: 'error', message: error.message });
    }
  });

  const handleBarcodeScanned = (barcode) => {
    // Extract core coil ID from scanned barcode
    const coreCoilId = getCoilIdFromBarcode(barcode);
    setScannedBarcode(coreCoilId);
    setShowBarcodeScanner(false);
    setTimeout(() => {
      handleScanWithBarcode(coreCoilId);
    }, 100);
  };

  const handleScanWithBarcode = async (barcode) => {
    const barcodeToScan = barcode || scannedBarcode;
    setScanResult(null);
    setScannedCoilData(null);
    setSelectedCustomer("");

    if(!barcodeToScan.trim()) return;

    // Extract core coil ID
    const coreCoilId = getCoilIdFromBarcode(barcodeToScan);

    const {data: coilResults = []} = await base44.entities.Coil.filter({ barcode: coreCoilId });
    if (coilResults.length === 0) {
      setScanResult({ type: 'error', message: `Coil ${coreCoilId} not found in system.` });
      return;
    }
    const coil = coilResults[0];

    if (coil.status !== 'in_yard' && coil.status !== 'in_process') {
      setScanResult({ type: 'error', message: `Coil status is '${coil.status}'. Cannot be shipped.` });
      return;
    }
    
    setScannedCoilData(coil);
    if(coil.customer_id) {
        setSelectedCustomer(coil.customer_id);
    }
  };

  const handleScan = () => handleScanWithBarcode();

  const handleAddCoil = () => {
    if (!scannedCoilData || !selectedCustomer) {
      setScanResult({ type: 'error', message: 'Please select a customer before adding the coil.' });
      return;
    }
    addCoilToShipmentMutation.mutate({ 
      coil: scannedCoilData, 
      customerId: selectedCustomer 
    });
  };
  
  if (isLoadingShipment) return <div>Loading...</div>;
  if (!shipment) return <div>Shipment not found.</div>;
  
  const isDispatched = shipment.status !== 'Planned' && shipment.status !== 'Loading';
  
  const shipmentCustomers = _.uniqBy(coilsWithCustomer.map(c => ({id: c.customer_id, name: c.customerName})), 'id');

  return (
    <div className="p-6 lg:p-8 bg-slate-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        <Link to={createPageUrl('Deliveries')} className="flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900 mb-4">
          <ArrowLeft className="w-4 h-4" />
          Back to All Shipments
        </Link>
        <div className="mb-8">
          <div className="flex justify-between items-center">
            <h1 className="text-3xl font-bold text-slate-900">Build Shipment: {shipment.vehicle_number}</h1>
            <Badge className={`text-base ${
              shipment.status === 'Planned' ? 'bg-blue-100 text-blue-800' :
              shipment.status === 'In Transit' ? 'bg-yellow-100 text-yellow-800' :
              shipment.status === 'Delivered' ? 'bg-emerald-100 text-emerald-800' :
              'bg-slate-100 text-slate-800'
            }`}>{shipment.status}</Badge>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-6 mb-8">
          <Card className="lg:col-span-2 shadow-lg border-none">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-blue-900">
                <Truck className="w-5 h-5" />
                Shipment Info
              </CardTitle>
            </CardHeader>
            <CardContent className="grid sm:grid-cols-2 gap-x-6 gap-y-4 text-sm">
              <div className="flex items-start gap-3">
                <Users className="w-4 h-4 mt-1 text-slate-400" />
                <div>
                  <p className="text-slate-500">Customers</p>
                  <div className="font-semibold text-slate-800">
                    {shipmentCustomers.length > 0 ? shipmentCustomers.map(c => c.name).join(', ') : 'No coils added'}
                  </div>
                </div>
              </div>
               <div className="flex items-start gap-3">
                <Truck className="w-4 h-4 mt-1 text-slate-400" />
                <div>
                  <p className="text-slate-500">Vehicle Number</p>
                  <p className="font-semibold text-slate-800">{shipment.vehicle_number}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-lg border-none">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-blue-900">
                <Weight className="w-5 h-5" />
                Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-slate-500 text-sm">Total Coils</p>
                <p className="font-bold text-3xl text-slate-800">{shipment.coil_barcodes?.length || 0}</p>
              </div>
              <div>
                <p className="text-slate-500 text-sm">Total Weight</p>
                <p className="font-bold text-3xl text-slate-800">
                  {(shipment.total_weight || 0).toFixed(2)} <span className="text-lg font-medium">tons</span>
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {scanResult && (
          <Alert className={`mb-6 ${scanResult.type === 'success' ? 'border-emerald-500' : 'border-red-500'}`}>
            {scanResult.type === 'success' ? <CheckCircle className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
            <AlertTitle>{scanResult.type === 'success' ? 'Success' : 'Error'}</AlertTitle>
            <AlertDescription>{scanResult.message}</AlertDescription>
          </Alert>
        )}

        <div className="grid lg:grid-cols-5 gap-6">
          <div className="lg:col-span-3">
            <Card className="shadow-lg border-none">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="w-5 h-5 text-blue-900" />
                  Coils in Shipment (with Customer Mapping)
                </CardTitle>
              </CardHeader>
              <CardContent>
                {coilsWithCustomer.length === 0 ? (
                  <div className="text-center py-8 text-slate-500">
                    <p>No coils added yet.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {coilsWithCustomer.map(coil => (
                      <div key={coil.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                        <div>
                          <p className="font-semibold text-slate-900">{coil.barcode}</p>
                          <p className="text-sm text-slate-600">
                            {coil.weight} tons for <span className="font-medium">{coil.customerName}</span>
                          </p>
                          {coil.destination_address && (
                            <p className="text-xs text-slate-500 mt-1">To: {coil.destination_address}</p>
                          )}
                        </div>
                         <Badge variant="outline">{coil.storage_location || 'N/A'}</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {!isDispatched && (
            <div className="lg:col-span-2">
              <Card className="shadow-lg border-none sticky top-8">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ScanBarcode className="w-5 h-5 text-blue-900" />
                    Add Coil to Shipment
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-end gap-2">
                    <div className="flex-grow space-y-1">
                      <Label>Scan Barcode or Enter Coil ID</Label>
                      <Input
                        placeholder="Scan barcode or enter coil ID..."
                        value={scannedBarcode}
                        onChange={(e) => setScannedBarcode(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && handleScan()}
                        disabled={addCoilToShipmentMutation.isPending}
                      />
                    </div>
                    <Button 
                      variant="outline" 
                      onClick={() => setShowBarcodeScanner(true)}
                      className="border-2 border-blue-600 text-blue-600 hover:bg-blue-50"
                    >
                      <Camera className="w-4 h-4 mr-2"/>
                      Scan
                    </Button>
                    <Button variant="secondary" onClick={handleScan} disabled={!scannedBarcode.trim()}>
                      Find
                    </Button>
                  </div>

                  {scannedCoilData && (
                    <div className="p-4 border rounded-lg bg-slate-50 space-y-4">
                      <div>
                          <p className="text-sm font-semibold">{scannedCoilData.barcode}</p>
                          <p className="text-xs text-slate-500">{scannedCoilData.weight} tons</p>
                          {scannedCoilData.customer_id && (
                            <Badge variant="secondary" className="mt-2 bg-blue-100 text-blue-800">
                              Pre-assigned: {customers.find(c => c.id === scannedCoilData.customer_id)?.name}
                            </Badge>
                          )}
                      </div>
                      <div className="space-y-1">
                        <Label>Confirm or Change Customer *</Label>
                        <Select onValueChange={setSelectedCustomer} value={selectedCustomer}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a customer..." />
                          </SelectTrigger>
                          <SelectContent>
                            {customers.map(customer => (
                              <SelectItem key={customer.id} value={customer.id}>
                                {customer.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <Button
                        onClick={handleAddCoil}
                        disabled={!selectedCustomer || addCoilToShipmentMutation.isPending}
                        className="w-full bg-blue-900 hover:bg-blue-800"
                      >
                        {addCoilToShipmentMutation.isPending ? 'Adding...' : 'Add Coil to this Vehicle'}
                      </Button>
                    </div>
                  )}

                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>

      <BarcodeScannerDialog
        isOpen={showBarcodeScanner}
        onClose={() => setShowBarcodeScanner(false)}
        onScan={handleBarcodeScanned}
        title="Scan Coil for Shipment"
      />
    </div>
  );
}
