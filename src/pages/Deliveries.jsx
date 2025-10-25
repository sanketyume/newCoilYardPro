
import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createPageUrl } from "@/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Users, Trash2 } from "lucide-react";
import { format } from "date-fns";
import {_} from 'lodash';

export default function Deliveries() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newShipment, setNewShipment] = useState({ vehicle_number: "" });
  const [shipmentToDelete, setShipmentToDelete] = useState(null);

  const { data: shipments = [] } = useQuery({
    queryKey: ['shipments'],
    queryFn: () => base44.entities.Shipment.list('-created_date'),
    initialData: [],
  });

  const { data: customers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: () => base44.entities.Customer.list(),
    initialData: [],
  });
  
  const { data: coils = [] } = useQuery({
      queryKey: ['coils'],
      queryFn: () => base44.entities.Coil.list(),
      initialData: [],
  })

  const createShipmentMutation = useMutation({
    mutationFn: (data) => base44.entities.Shipment.create(data),
    onSuccess: (newRecord) => {
      queryClient.invalidateQueries({ queryKey: ['shipments'] });
      setShowCreateDialog(false);
      resetForm();
      navigate(createPageUrl(`ShipmentDetails?id=${newRecord.id}`));
    }
  });
  
  const deleteShipmentMutation = useMutation({
    mutationFn: async (shipmentId) => {
        // Find the shipment to get coil barcodes
        const shipment = shipments.find(s => s.id === shipmentId);
        if (shipment && shipment.coil_barcodes?.length > 0) {
            // Find all coils associated with this shipment
            const coilsToUpdate = coils.filter(c => shipment.coil_barcodes.includes(c.barcode));
            // Create promises to update each coil
            const updatePromises = coilsToUpdate.map(coil => 
                base44.entities.Coil.update(coil.id, { 
                    shipment_id: null, 
                    status: 'in_yard', // Revert status to 'in_yard'
                    customer_id: null,
                    destination_address: null
                })
            );
            // Wait for all coils to be updated
            await Promise.all(updatePromises);
        }
        // After updating coils, delete the shipment
        return base44.entities.Shipment.delete(shipmentId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shipments'] });
      queryClient.invalidateQueries({ queryKey: ['coils'] }); // Invalidate coils as well
      setShipmentToDelete(null);
    }
  });

  const shipmentsWithCustomerData = React.useMemo(() => {
    return shipments.map(shipment => {
      const shipmentCoils = coils.filter(c => shipment.coil_barcodes.includes(c.barcode));
      const customerIds = _.uniq(shipmentCoils.map(c => c.customer_id));
      const shipmentCustomers = customers.filter(cust => customerIds.includes(cust.id));
      return {
        ...shipment,
        customers: shipmentCustomers,
      };
    });
  }, [shipments, coils, customers]);

  const handleCreateShipment = () => {
    if (!newShipment.vehicle_number) return;
    createShipmentMutation.mutate({
        ...newShipment,
        status: 'Planned',
        planned_shipment_date: new Date().toISOString(),
        coil_barcodes: [],
        total_weight: 0,
    });
  };
  
  const resetForm = () => {
    setNewShipment({ vehicle_number: "" });
  };

  return (
    <div className="p-6 lg:p-8 bg-slate-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Shipment Planning</h1>
            <p className="text-slate-600 mt-2">Create new shipments (vehicles) and view all historical shipments</p>
          </div>
          <Button onClick={() => setShowCreateDialog(true)} className="bg-blue-900 hover:bg-blue-800">
            <Plus className="w-4 h-4 mr-2" />
            Create New Shipment
          </Button>
        </div>

        <Card className="shadow-lg border-none">
          <CardHeader>
            <CardTitle>All Shipments</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-100 border-b">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase">Vehicle</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase">Customers</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase">Date Planned</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase">Coils / Weight</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase">Details</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-slate-600 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {shipmentsWithCustomerData.map((shipment) => (
                      <tr key={shipment.id} className="hover:bg-slate-50">
                        <td className="px-6 py-4">
                          <Badge className={`${
                            shipment.status === 'Planned' ? 'bg-blue-100 text-blue-800' :
                            shipment.status === 'In Transit' ? 'bg-yellow-100 text-yellow-800' :
                            shipment.status === 'Delivered' ? 'bg-emerald-100 text-emerald-800' :
                            'bg-slate-100 text-slate-800'
                          }`}>
                            {shipment.status}
                          </Badge>
                        </td>
                        <td className="px-6 py-4 text-slate-900 font-medium">{shipment.vehicle_number}</td>
                        <td className="px-6 py-4 text-slate-600">
                          {shipment.customers.length > 0 ? (
                             <div className="flex items-center gap-2 group relative">
                               <Users className="w-4 h-4"/>
                               <span>{shipment.customers.length} Customer(s)</span>
                               <div className="absolute left-0 top-full z-10 hidden group-hover:block bg-white p-2 rounded-md shadow-lg border text-xs w-48">
                                  {shipment.customers.map(c => <p key={c.id}>{c.name}</p>)}
                               </div>
                             </div>
                          ) : (
                            <span className="text-slate-400">N/A</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-slate-600">
                          {shipment.planned_shipment_date ? format(new Date(shipment.planned_shipment_date), 'MMM d, yyyy') : 'N/A'}
                        </td>
                         <td className="px-6 py-4 text-slate-600">
                            {shipment.coil_barcodes?.length || 0} coils / {(shipment.total_weight || 0).toFixed(2)} T
                        </td>
                        <td className="px-6 py-4">
                           <Link to={createPageUrl(`ShipmentDetails?id=${shipment.id}`)}>
                            <Button variant="outline" size="sm">View / Add Coils</Button>
                          </Link>
                        </td>
                        <td className="px-6 py-4 text-right">
                            <Button 
                                variant="ghost" 
                                size="icon" 
                                onClick={() => setShipmentToDelete(shipment)}
                                disabled={shipment.status !== 'Planned'}
                                title={shipment.status !== 'Planned' ? 'Can only delete planned shipments' : 'Delete Shipment'}
                                className="text-red-500 hover:text-red-700 disabled:opacity-30 disabled:cursor-not-allowed"
                            >
                                <Trash2 className="w-4 h-4"/>
                            </Button>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Shipment (Vehicle)</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Vehicle Number / ID *</Label>
              <Input
                value={newShipment.vehicle_number}
                onChange={(e) => setNewShipment({...newShipment, vehicle_number: e.target.value})}
                placeholder="e.g., TRUCK-123"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>Cancel</Button>
            <Button
              onClick={handleCreateShipment}
              disabled={createShipmentMutation.isPending || !newShipment.vehicle_number}
              className="bg-blue-900 hover:bg-blue-800"
            >
              {createShipmentMutation.isPending ? "Creating..." : "Create and Add Coils"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!shipmentToDelete} onOpenChange={() => setShipmentToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the shipment for vehicle{' '}
              <span className="font-bold text-slate-800">{shipmentToDelete?.vehicle_number}</span>.
              All coils assigned to this shipment will be unlinked and their status reverted to 'in_yard'.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteShipmentMutation.mutate(shipmentToDelete.id)}
              className="bg-red-600 hover:bg-red-700"
              disabled={deleteShipmentMutation.isPending}
            >
              {deleteShipmentMutation.isPending ? "Deleting..." : "Yes, delete shipment"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
