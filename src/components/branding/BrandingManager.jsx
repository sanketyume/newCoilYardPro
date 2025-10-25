import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import ImageUpload from "./ImageUpload";
import { Building, Plus, Save, Users, Truck, Edit2, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";

// Main component to manage all branding aspects
export default function BrandingManager() {
  return (
    <div className="space-y-8">
      <CompanyProfileManager />
      <div className="grid lg:grid-cols-2 gap-8">
        <CustomerManager />
        <SupplierManager />
      </div>
    </div>);

}

// Component to manage the main Company Profile
function CompanyProfileManager() {
  const queryClient = useQueryClient();
  const [profile, setProfile] = useState({ company_name: '', company_logo_url: '', developer_name: 'Datanimics Technologies', platform_name: 'Industri Fusion' });

  const { data: profileData } = useQuery({
    queryKey: ['companyProfile'],
    queryFn: async () => {
      const results = await base44.entities.CompanyProfile.list();
      return results[0] || null;
    },
    onSuccess: (data) => {
      if (data) setProfile(data);
    }
  });

  const mutation = useMutation({
    mutationFn: (data) => {
      if (profileData?.id) {
        return base44.entities.CompanyProfile.update(profileData.id, data);
      }
      return base44.entities.CompanyProfile.create(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['companyProfile'] });
    }
  });

  const handleSave = () => mutation.mutate(profile);

  const handleChange = (field, value) => setProfile((p) => ({ ...p, [field]: value }));

  return (
    <Card className="shadow-lg border-none">
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Building className="w-5 h-5 text-blue-900" /> My Company Profile</CardTitle>
        <CardDescription>Set your main company logo, name, and footer branding for the application.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid md:grid-cols-2 gap-6 items-start">
            <ImageUpload label="Company Logo" value={profile.company_logo_url} onChange={(url) => handleChange('company_logo_url', url)} />
            <div className="space-y-4">
                <div className="space-y-2">
                    <Label>Company Name</Label>
                    <Input value={profile.company_name} onChange={(e) => handleChange('company_name', e.target.value)} placeholder="Your Company Inc." />
                </div>
            </div>
        </div>
        <div className="border-t pt-6 space-y-4">
             <h3 className="text-md font-semibold text-slate-800">Footer Configuration</h3>
             <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-2">
                    <Label>Developer Name</Label>
                    <Input value={profile.developer_name} onChange={(e) => handleChange('developer_name', e.target.value)} />
                </div>
                <div className="space-y-2">
                    <Label>Platform Name</Label>
                    <Input value={profile.platform_name} onChange={(e) => handleChange('platform_name', e.target.value)} />
                </div>
             </div>
        </div>
      </CardContent>
      <CardFooter>
        <Button onClick={handleSave} disabled={mutation.isPending} className="bg-primary text-slate-800 px-4 py-2 text-sm font-medium rounded-md inline-flex items-center justify-center gap-2 whitespace-nowrap ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 hover:bg-primary/90 h-10">
            <Save className="w-4 h-4 mr-2" /> {mutation.isPending ? 'Saving...' : 'Save Branding Settings'}
        </Button>
      </CardFooter>
    </Card>);

}

// Component to manage Customers with logos
function CustomerManager() {
  const queryClient = useQueryClient();
  const [showDialog, setShowDialog] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [formState, setFormState] = useState({ name: '', address: '', logo_url: '' });

  const { data: customers = [] } = useQuery({ queryKey: ['customers'], queryFn: () => base44.entities.Customer.list() });

  const createMutation = useMutation({ mutationFn: (data) => base44.entities.Customer.create(data), onSuccess: () => {queryClient.invalidateQueries({ queryKey: ['customers'] });setShowDialog(false);} });
  const updateMutation = useMutation({ mutationFn: ({ id, data }) => base44.entities.Customer.update(id, data), onSuccess: () => {queryClient.invalidateQueries({ queryKey: ['customers'] });setShowDialog(false);} });
  const deleteMutation = useMutation({ mutationFn: (id) => base44.entities.Customer.delete(id), onSuccess: () => queryClient.invalidateQueries({ queryKey: ['customers'] }) });

  const handleOpenDialog = (customer = null) => {
    setEditingCustomer(customer);
    setFormState(customer ? { ...customer } : { name: '', address: '', logo_url: '' });
    setShowDialog(true);
  };

  const handleSave = () => {
    if (editingCustomer) {
      updateMutation.mutate({ id: editingCustomer.id, data: formState });
    } else {
      createMutation.mutate(formState);
    }
  };

  return (
    <Card className="shadow-lg border-none">
            <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2"><Users className="w-5 h-5 text-emerald-700" />Customer Master</CardTitle>
                <Button size="sm" onClick={() => handleOpenDialog()}><Plus className="w-4 h-4 mr-2" />Add Customer</Button>
            </CardHeader>
            <CardContent className="p-0 max-h-96 overflow-y-auto">
                <div className="divide-y divide-slate-200">
                    {customers.map((c) =>
          <div key={c.id} className="p-3 flex items-center justify-between hover:bg-slate-50">
                            <div className="flex items-center gap-3">
                                <img src={c.logo_url || `https://ui-avatars.com/api/?name=${c.name}&background=random`} alt={c.name} className="w-10 h-10 rounded-md object-contain bg-white border" />
                                <div>
                                    <p className="font-semibold text-slate-800">{c.name}</p>
                                    <p className="text-xs text-slate-500">{c.address}</p>
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <Button size="icon" variant="ghost" onClick={() => handleOpenDialog(c)}><Edit2 className="w-4 h-4" /></Button>
                                <Button size="icon" variant="ghost" className="text-red-600" onClick={() => deleteMutation.mutate(c.id)}><Trash2 className="w-4 h-4" /></Button>
                            </div>
                        </div>
          )}
                </div>
            </CardContent>
            <Dialog open={showDialog} onOpenChange={setShowDialog}>
                <DialogContent>
                    <DialogHeader><DialogTitle>{editingCustomer ? 'Edit' : 'Add'} Customer</DialogTitle></DialogHeader>
                    <div className="space-y-4 py-4">
                        <ImageUpload label="Customer Logo" value={formState.logo_url} onChange={(url) => setFormState((s) => ({ ...s, logo_url: url }))} />
                        <div className="space-y-2"><Label>Customer Name *</Label><Input value={formState.name} onChange={(e) => setFormState((s) => ({ ...s, name: e.target.value }))} /></div>
                        <div className="space-y-2"><Label>Address *</Label><Input value={formState.address} onChange={(e) => setFormState((s) => ({ ...s, address: e.target.value }))} /></div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowDialog(false)}>Cancel</Button>
                        <Button onClick={handleSave}>{editingCustomer ? 'Update' : 'Create'}</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </Card>);

}

// Component to manage Suppliers with logos
function SupplierManager() {
  const queryClient = useQueryClient();
  const [showDialog, setShowDialog] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState(null);
  const [formState, setFormState] = useState({ name: '', logo_url: '' });

  const { data: suppliers = [] } = useQuery({ queryKey: ['suppliers'], queryFn: () => base44.entities.Supplier.list() });

  const createMutation = useMutation({ mutationFn: (data) => base44.entities.Supplier.create(data), onSuccess: () => {queryClient.invalidateQueries({ queryKey: ['suppliers'] });setShowDialog(false);} });
  const updateMutation = useMutation({ mutationFn: ({ id, data }) => base44.entities.Supplier.update(id, data), onSuccess: () => {queryClient.invalidateQueries({ queryKey: ['suppliers'] });setShowDialog(false);} });
  const deleteMutation = useMutation({ mutationFn: (id) => base44.entities.Supplier.delete(id), onSuccess: () => queryClient.invalidateQueries({ queryKey: ['suppliers'] }) });

  const handleOpenDialog = (supplier = null) => {
    setEditingSupplier(supplier);
    setFormState(supplier ? { ...supplier } : { name: '', logo_url: '' });
    setShowDialog(true);
  };

  const handleSave = () => {
    if (editingSupplier) {
      updateMutation.mutate({ id: editingSupplier.id, data: formState });
    } else {
      createMutation.mutate(formState);
    }
  };

  return (
    <Card className="shadow-lg border-none">
            <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2"><Truck className="w-5 h-5 text-orange-700" />Supplier Master</CardTitle>
                <Button size="sm" onClick={() => handleOpenDialog()}><Plus className="w-4 h-4 mr-2" />Add Supplier</Button>
            </CardHeader>
            <CardContent className="p-0 max-h-96 overflow-y-auto">
                <div className="divide-y divide-slate-200">
                    {suppliers.map((s) =>
          <div key={s.id} className="p-3 flex items-center justify-between hover:bg-slate-50">
                            <div className="flex items-center gap-3">
                                <img src={s.logo_url || `https://ui-avatars.com/api/?name=${s.name}&background=random`} alt={s.name} className="w-10 h-10 rounded-md object-contain bg-white border" />
                                <p className="font-semibold text-slate-800">{s.name}</p>
                            </div>
                            <div className="flex gap-2">
                                <Button size="icon" variant="ghost" onClick={() => handleOpenDialog(s)}><Edit2 className="w-4 h-4" /></Button>
                                <Button size="icon" variant="ghost" className="text-red-600" onClick={() => deleteMutation.mutate(s.id)}><Trash2 className="w-4 h-4" /></Button>
                            </div>
                        </div>
          )}
                </div>
            </CardContent>
            <Dialog open={showDialog} onOpenChange={setShowDialog}>
                <DialogContent>
                    <DialogHeader><DialogTitle>{editingSupplier ? 'Edit' : 'Add'} Supplier</DialogTitle></DialogHeader>
                    <div className="space-y-4 py-4">
                        <ImageUpload label="Supplier Logo" value={formState.logo_url} onChange={(url) => setFormState((s) => ({ ...s, logo_url: url }))} />
                        <div className="space-y-2"><Label>Supplier Name *</Label><Input value={formState.name} onChange={(e) => setFormState((s) => ({ ...s, name: e.target.value }))} /></div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowDialog(false)}>Cancel</Button>
                        <Button onClick={handleSave}>{editingSupplier ? 'Update' : 'Create'}</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </Card>);

}