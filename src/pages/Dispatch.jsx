
import React, { useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Send, AlertTriangle, Camera } from "lucide-react"; // Added Camera icon
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import BarcodeScannerDialog from "../components/barcode/BarcodeScannerDialog"; // Added BarcodeScannerDialog import

const dispatchLogic = async (shipment, coils, queryClient) => {
    await base44.entities.Shipment.update(shipment.id, {
        status: "In Transit",
        actual_shipment_date: new Date().toISOString()
    });

    for (const barcode of shipment.coil_barcodes) {
        const coil = coils.find(c => c.barcode === barcode);
        if (!coil) continue;
        
        await base44.entities.Coil.update(coil.id, { status: "shipped" });

        if (coil.storage_location) {
            const {data: locResults} = await base44.entities.StorageLocation.filter({ location_code: coil.storage_location });
            if (locResults.length > 0) {
                const location = locResults[0];
                const newStack = location.stack.filter(s => s.coil_barcode !== coil.barcode);
                await base44.entities.StorageLocation.update(location.id, { stack: newStack });
            }
        }

        await base44.entities.CoilMovement.create({
            coil_barcode: coil.barcode,
            from_location: coil.storage_location || 'N/A',
            to_location: 'Dispatched',
            movement_type: 'loading',
            movement_date: new Date().toISOString(),
            moved_by: 'user',
            reason: `Shipped via vehicle ${shipment.vehicle_number}`,
            remarks: `Shipment ID: ${shipment.id}`
        });
    }
    queryClient.invalidateQueries();
};

export default function Dispatch() {
  const queryClient = useQueryClient();
  const [result, setResult] = useState(null);
  
  // Direct Dispatch State
  const [directCoilBarcode, setDirectCoilBarcode] = useState("");
  const [directVehicleNumber, setDirectVehicleNumber] = useState("");
  const [directCustomerId, setDirectCustomerId] = useState("");
  const [showBarcodeScanner, setShowBarcodeScanner] = useState(false); // New state for barcode scanner

  const { data: shipments = [] } = useQuery({
    queryKey: ["shipments", "Planned"],
    queryFn: () => base44.entities.Shipment.filter({ status: "Planned" }),
    initialData: [],
  });
  const { data: inspections = [] } = useQuery({
    queryKey: ["outgoingInspections"],
    queryFn: () => base44.entities.CoilInspection.filter({ inspection_type: "outgoing" }),
    initialData: [],
  });
  const { data: customers = [] } = useQuery({
    queryKey: ["customers"],
    queryFn: () => base44.entities.Customer.list(),
    initialData: [],
  });
  const { data: coils = [] } = useQuery({
    queryKey: ["coils"],
    queryFn: () => base44.entities.Coil.list(),
    initialData: []
  });

  const dispatchableShipments = useMemo(() => {
    return shipments.filter(shipment => {
      if (!shipment.coil_barcodes || shipment.coil_barcodes.length === 0) return false;
      const allInspectedAndPassed = shipment.coil_barcodes.every(barcode => {
        const inspection = inspections.find(i => i.coil_barcode === barcode);
        return inspection && (inspection.overall_status === 'Pass' || inspection.overall_status === 'Pass with Remarks');
      });
      return allInspectedAndPassed;
    }).map(shipment => {
      const shipmentCoils = coils.filter(c => shipment.coil_barcodes.includes(c.barcode));
      const customerNames = [...new Set(shipmentCoils.map(c => {
        const cust = customers.find(cu => cu.id === c.customer_id);
        return cust?.name;
      }))].filter(Boolean);
      return {
        ...shipment,
        customerNames: customerNames.join(', ') || 'N/A'
      };
    });
  }, [shipments, inspections, customers, coils]);

  const dispatchShipmentMutation = useMutation({
      mutationFn: (shipment) => dispatchLogic(shipment, coils, queryClient),
      onSuccess: (_, variables) => {
          setResult({ type: 'success', message: `Shipment ${variables.vehicle_number} has been dispatched successfully!` });
      },
      onError: (error) => {
          setResult({ type: 'error', message: `Dispatch Error: ${error.message}` });
      }
  });

  const directDispatchMutation = useMutation({
      mutationFn: async ({ coilBarcode, vehicleNumber, customerId }) => {
          const { data: coilResults } = await base44.entities.Coil.filter({ barcode: coilBarcode });
          if (coilResults.length === 0) throw new Error("Coil not found.");
          const coil = coilResults[0];

          if (coil.status !== 'in_yard' && coil.status !== 'in_process') {
              throw new Error(`Coil status is '${coil.status}'. Cannot be dispatched.`);
          }
          
          let shipment;
          const { data: existingShipments } = await base44.entities.Shipment.filter({ vehicle_number: vehicleNumber, status: 'Planned' });
          if (existingShipments.length > 0) {
              shipment = existingShipments[0];
              await base44.entities.Shipment.update(shipment.id, {
                  coil_barcodes: [...(shipment.coil_barcodes || []), coil.barcode], // Ensure existing array is spread
                  total_weight: (shipment.total_weight || 0) + coil.weight,
              });
          } else {
              shipment = await base44.entities.Shipment.create({
                  vehicle_number: vehicleNumber,
                  status: 'Planned',
                  planned_shipment_date: new Date().toISOString(),
                  coil_barcodes: [coil.barcode],
                  total_weight: coil.weight,
              });
          }
          
          // Update coil with customer and shipment ID
          const customer = customers.find(c => c.id === customerId);
          await base44.entities.Coil.update(coil.id, {
              customer_id: customerId,
              destination_address: customer?.address || '',
              shipment_id: shipment.id,
              status: 'outgoing'
          });

          // Run final dispatch logic
          const updatedShipment = { ...shipment, coil_barcodes: [...(shipment.coil_barcodes || []), coil.barcode] };
          await dispatchLogic(updatedShipment, [...coils, coil], queryClient);
      },
      onSuccess: () => {
          setResult({ type: 'success', message: `Coil ${directCoilBarcode} has been directly dispatched.` });
          setDirectCoilBarcode('');
          setDirectVehicleNumber('');
          setDirectCustomerId('');
      },
      onError: (error) => {
          setResult({ type: 'error', message: `Direct Dispatch Error: ${error.message}` });
      }
  });

  // New handler for barcode scanned event
  const handleBarcodeScanned = (barcode) => {
    setDirectCoilBarcode(barcode);
    setShowBarcodeScanner(false);
  };

  const handleDirectDispatch = () => {
      if (!directCoilBarcode || !directVehicleNumber || !directCustomerId) {
          setResult({ type: 'error', message: 'All fields are required for direct dispatch.' });
          return;
      }
      directDispatchMutation.mutate({
          coilBarcode: directCoilBarcode,
          vehicleNumber: directVehicleNumber,
          customerId: directCustomerId
      });
  };


  return (
    <div className="p-6 lg:p-8 bg-slate-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900">Shipment Dispatch</h1>
          <p className="text-slate-600 mt-2">Dispatch planned shipments or perform a direct ad-hoc dispatch.</p>
        </div>

        {result && (
            <Alert className={`mb-6 ${result.type === 'success' ? 'border-emerald-500' : 'border-red-500'}`}>
                <AlertTitle>{result.type === 'success' ? 'Success' : 'Error'}</AlertTitle>
                <AlertDescription>{result.message}</AlertDescription>
            </Alert>
        )}

        <Tabs defaultValue="planned">
            <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="planned">Planned Dispatch</TabsTrigger>
                <TabsTrigger value="direct">Direct Dispatch</TabsTrigger>
            </TabsList>
            <TabsContent value="planned">
                <Card className="shadow-lg border-none mt-6">
                  <CardHeader>
                    <CardTitle>Ready for Planned Dispatch</CardTitle>
                    <p className="text-sm text-slate-500">These shipments have passed all inspections and are ready to leave.</p>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="divide-y divide-slate-200">
                      {dispatchableShipments.map(shipment => (
                        <div key={shipment.id} className="p-4 grid grid-cols-1 md:grid-cols-6 gap-4 items-center hover:bg-slate-50">
                            <div className="md:col-span-2">
                                <p className="font-semibold text-blue-900">{shipment.vehicle_number}</p>
                                <p className="text-sm text-slate-700">{shipment.customerNames}</p>
                            </div>
                            <div className="md:col-span-2">
                               <p className="text-xs text-slate-500">
                                {shipment.coil_barcodes.length} Coils / {shipment.total_weight.toFixed(2)} tons
                               </p>
                            </div>
                            <div className="md:col-span-2 text-right">
                                <Button
                                    onClick={() => dispatchShipmentMutation.mutate(shipment)}
                                    disabled={dispatchShipmentMutation.isPending}
                                    className="bg-emerald-600 hover:bg-emerald-700"
                                >
                                    <Send className="w-4 h-4 mr-2" />
                                    {dispatchShipmentMutation.isPending ? "Dispatching..." : "Dispatch Now"}
                                </Button>
                            </div>
                        </div>
                      ))}
                       {dispatchableShipments.length === 0 && <p className="p-6 text-center text-slate-500">No shipments are ready for dispatch. Ensure coils are loaded and have passed inspection.</p>}
                    </div>
                  </CardContent>
                </Card>
            </TabsContent>
            <TabsContent value="direct">
                <Card className="shadow-lg border-none mt-6">
                    <CardHeader>
                        <CardTitle>Direct (Ad-hoc) Dispatch</CardTitle>
                         <p className="text-sm text-slate-500">Dispatch a single coil without prior planning. Note: this bypasses pre-dispatch inspection.</p>
                    </CardHeader>
                    <CardContent className="space-y-4 pt-6">
                         <div className="p-4 border-l-4 border-orange-400 bg-orange-50">
                            <div className="flex">
                              <div className="flex-shrink-0">
                                <AlertTriangle className="h-5 w-5 text-orange-500" aria-hidden="true" />
                              </div>
                              <div className="ml-3">
                                <p className="text-sm text-orange-800">
                                  Direct dispatch should only be used in urgent cases as it does not include the standard pre-dispatch inspection process.
                                </p>
                              </div>
                            </div>
                        </div>
                        <div className="grid md:grid-cols-3 gap-4">
                            <div className="space-y-2">
                                <Label>Coil Barcode *</Label>
                                <div className="flex gap-2"> {/* Added flex container */}
                                  <Input 
                                    value={directCoilBarcode} 
                                    onChange={e => setDirectCoilBarcode(e.target.value)} 
                                    placeholder="Scan or enter coil barcode"
                                    className="flex-grow" // Input takes available space
                                  />
                                  <Button 
                                    variant="outline"
                                    onClick={() => setShowBarcodeScanner(true)} // Open scanner on click
                                    className="border-2 border-blue-600 text-blue-600 hover:bg-blue-50"
                                  >
                                    <Camera className="w-4 h-4"/>
                                  </Button>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label>Vehicle Number *</Label>
                                <Input value={directVehicleNumber} onChange={e => setDirectVehicleNumber(e.target.value)} placeholder="Enter vehicle ID"/>
                            </div>
                            <div className="space-y-2">
                                <Label>Customer *</Label>
                                <Select value={directCustomerId} onValueChange={setDirectCustomerId}>
                                    <SelectTrigger><SelectValue placeholder="Select customer"/></SelectTrigger>
                                    <SelectContent>
                                        {customers.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div className="text-right">
                            <Button
                                onClick={handleDirectDispatch}
                                disabled={directDispatchMutation.isPending || !directCoilBarcode || !directVehicleNumber || !directCustomerId}
                                className="bg-blue-600 hover:bg-blue-700"
                            >
                                <Send className="w-4 h-4 mr-2" />
                                {directDispatchMutation.isPending ? "Dispatching..." : "Dispatch Coil Directly"}
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </TabsContent>
        </Tabs>

        {/* Barcode Scanner Dialog */}
        <BarcodeScannerDialog
          isOpen={showBarcodeScanner}
          onClose={() => setShowBarcodeScanner(false)}
          onScan={handleBarcodeScanned}
          title="Scan Coil for Direct Dispatch"
        />
      </div>
    </div>
  );
}
