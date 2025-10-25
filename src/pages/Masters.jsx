
import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from "@/components/ui/dialog";
import {
  Settings,
  MapPin,
  Package,
  Plus,
  Edit2,
  Trash2,
  Grid,
  ClipboardCheck,
  Building,
  Layers,
  ChevronRight
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import BrandingManager from "../components/branding/BrandingManager";
import StackingPositionManager from "../components/stacking/StackingPositionManager";

const menuItems = [
  {
    id: 'locations',
    label: 'Storage Locations',
    icon: MapPin,
    description: 'Ground level locations'
  },
  {
    id: 'stackingPositions',
    label: 'Stacking Positions',
    icon: Layers,
    description: 'Multi-layer positions'
  },
  {
    id: 'coiltypes',
    label: 'Coil Types',
    icon: Package,
    description: 'Material grades & types'
  },
  {
    id: 'inspections',
    label: 'Inspection Criteria',
    icon: ClipboardCheck,
    description: 'Quality checkpoints'
  },
  {
    id: 'yardConfig',
    label: 'Yard Generator',
    icon: Grid,
    description: 'Bulk create locations'
  },
  {
    id: 'branding',
    label: 'Company & Branding',
    icon: Building,
    description: 'Company profile & logos'
  }
];

export default function Masters() {
  const queryClient = useQueryClient();
  const [activeSection, setActiveSection] = useState('locations');
  const [showLocationDialog, setShowLocationDialog] = useState(false);
  const [showCoilTypeDialog, setShowCoilTypeDialog] = useState(false);
  const [showInspectionCatDialog, setShowInspectionCatDialog] = useState(false);
  const [showInspectionPointDialog, setShowInspectionPointDialog] = useState(false);

  const [editingLocation, setEditingLocation] = useState(null);
  const [editingCoilType, setEditingCoilType] = useState(null);
  const [editingInspectionCat, setEditingInspectionCat] = useState(null);
  const [editingInspectionPoint, setEditingInspectionPoint] = useState(null);

  const [locationForm, setLocationForm] = useState({
    location_code: '', bay: '', zone: '', capacity_tons: '', location_type: 'ground',
    is_active: true, is_visible: true, row_num: '', col_num: ''
  });
  const [coilTypeForm, setCoilTypeForm] = useState({
    type_code: '', type_name: '', grade: '', typical_weight_range: ''
  });
  const [inspectionCatForm, setInspectionCatForm] = useState({ name: '', description: '', type: 'incoming' });
  const [inspectionPointForm, setInspectionPointForm] = useState({ category_id: '', name: '', description: '' });

  // Data Queries
  const { data: locations = [] } = useQuery({ 
    queryKey: ['locations'], 
    queryFn: () => base44.entities.StorageLocation.list(),
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    onError: (error) => {
      console.error('Error loading locations:', error);
    }
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

  const { data: inspectionCats = [] } = useQuery({ 
    queryKey: ['inspectionCategories'], 
    queryFn: () => base44.entities.InspectionCategory.list(),
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    onError: (error) => {
      console.error('Error loading inspection categories:', error);
    }
  });

  const { data: inspectionPoints = [] } = useQuery({ 
    queryKey: ['inspectionPoints'], 
    queryFn: () => base44.entities.InspectionPoint.list(),
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    onError: (error) => {
      console.error('Error loading inspection points:', error);
    }
  });

  // Mutations
  const createLocationMutation = useMutation({ mutationFn: (data) => base44.entities.StorageLocation.create(data), onSuccess: () => {queryClient.invalidateQueries({ queryKey: ['locations'] });setShowLocationDialog(false);} });
  const updateLocationMutation = useMutation({ mutationFn: ({ id, data }) => base44.entities.StorageLocation.update(id, data), onSuccess: () => {queryClient.invalidateQueries({ queryKey: ['locations'] });setShowLocationDialog(false);} });
  const deleteLocationMutation = useMutation({ mutationFn: (id) => base44.entities.StorageLocation.delete(id), onSuccess: () => queryClient.invalidateQueries({ queryKey: ['locations'] }) });

  const createCoilTypeMutation = useMutation({ mutationFn: (data) => base44.entities.CoilType.create(data), onSuccess: () => {queryClient.invalidateQueries({ queryKey: ['coilTypes'] });setShowCoilTypeDialog(false);} });
  const updateCoilTypeMutation = useMutation({ mutationFn: ({ id, data }) => base44.entities.CoilType.update(id, data), onSuccess: () => {queryClient.invalidateQueries({ queryKey: ['coilTypes'] });setShowCoilTypeDialog(false);} });
  const deleteCoilTypeMutation = useMutation({ mutationFn: (id) => base44.entities.CoilType.delete(id), onSuccess: () => queryClient.invalidateQueries({ queryKey: ['coilTypes'] }) });

  const createInspectionCatMutation = useMutation({ mutationFn: (data) => base44.entities.InspectionCategory.create(data), onSuccess: () => {queryClient.invalidateQueries({ queryKey: ['inspectionCategories'] });setShowInspectionCatDialog(false);} });
  const updateInspectionCatMutation = useMutation({ mutationFn: ({ id, data }) => base44.entities.InspectionCategory.update(id, data), onSuccess: () => {queryClient.invalidateQueries({ queryKey: ['inspectionCategories'] });setShowInspectionCatDialog(false);} });
  const deleteInspectionCatMutation = useMutation({ mutationFn: (id) => base44.entities.InspectionCategory.delete(id), onSuccess: () => queryClient.invalidateQueries({ queryKey: ['inspectionCategories'] }) });

  const createInspectionPointMutation = useMutation({ mutationFn: (data) => base44.entities.InspectionPoint.create(data), onSuccess: () => {queryClient.invalidateQueries({ queryKey: ['inspectionPoints'] });setShowInspectionPointDialog(false);} });
  const updateInspectionPointMutation = useMutation({ mutationFn: ({ id, data }) => base44.entities.InspectionPoint.update(id, data), onSuccess: () => {queryClient.invalidateQueries({ queryKey: ['inspectionPoints'] });setShowInspectionPointDialog(false);} });
  const deleteInspectionPointMutation = useMutation({ mutationFn: (id) => base44.entities.InspectionPoint.delete(id), onSuccess: () => queryClient.invalidateQueries({ queryKey: ['inspectionPoints'] }) });

  // Handlers for Location
  const handleEditLocation = (location) => {
    setEditingLocation(location);
    setLocationForm({
      location_code: location.location_code, zone: location.zone, bay: location.bay || '',
      capacity_tons: location.capacity_tons, location_type: location.location_type || 'ground',
      is_visible: location.is_visible ?? true,
      is_active: location.is_active ?? true, row_num: location.row_num || '', col_num: location.col_num || ''
    });
    setShowLocationDialog(true);
  };
  const handleSaveLocation = () => {
    const data = { ...locationForm, capacity_tons: parseFloat(locationForm.capacity_tons), max_layers: 1, row_num: locationForm.row_num ? parseInt(locationForm.row_num, 10) : null, col_num: locationForm.col_num ? parseInt(locationForm.col_num, 10) : null };
    if (editingLocation) {updateLocationMutation.mutate({ id: editingLocation.id, data });} else {createLocationMutation.mutate(data);}
  };

  // Handlers for CoilType
  const handleEditCoilType = (type) => {
    setEditingCoilType(type);
    setCoilTypeForm({ type_code: type.type_code, type_name: type.type_name, grade: type.grade || '', typical_weight_range: type.typical_weight_range || '' });
    setShowCoilTypeDialog(true);
  };
  const handleSaveCoilType = () => {
    if (editingCoilType) {updateCoilTypeMutation.mutate({ id: editingCoilType.id, data: coilTypeForm });} else {createCoilTypeMutation.mutate({ ...coilTypeForm, is_active: true });}
  };

  // Handlers for Inspection Category
  const handleEditInspectionCat = (cat) => {
    setEditingInspectionCat(cat);
    setInspectionCatForm({ name: cat.name, description: cat.description || '', type: cat.type || 'incoming' });
    setShowInspectionCatDialog(true);
  };
  const handleSaveInspectionCat = () => {
    if (editingInspectionCat) {updateInspectionCatMutation.mutate({ id: editingInspectionCat.id, data: inspectionCatForm });} else {createInspectionCatMutation.mutate({ ...inspectionCatForm, is_active: true });}
  };

  // Handlers for Inspection Point
  const handleEditInspectionPoint = (point) => {
    setEditingInspectionPoint(point);
    setInspectionPointForm({ category_id: point.category_id, name: point.name, description: point.description || '' });
    setShowInspectionPointDialog(true);
  };
  const handleSaveInspectionPoint = () => {
    if (editingInspectionPoint) {updateInspectionPointMutation.mutate({ id: editingInspectionPoint.id, data: inspectionPointForm });} else {createInspectionPointMutation.mutate({ ...inspectionPointForm, is_active: true });}
  };

  const renderContent = () => {
    switch (activeSection) {
      case 'locations':
        return <LocationsSection
          locations={locations}
          onAdd={() => {setEditingLocation(null);setLocationForm({ location_code: '', bay: '', zone: '', capacity_tons: '', location_type: 'ground', is_active: true, is_visible: true, row_num: '', col_num: '' });setShowLocationDialog(true);}}
          onEdit={handleEditLocation}
          onDelete={(id) => deleteLocationMutation.mutate(id)}
        />;

      case 'stackingPositions':
        return <StackingPositionManager />;

      case 'coiltypes':
        return <CoilTypesSection
          coilTypes={coilTypes}
          onAdd={() => {setEditingCoilType(null);setCoilTypeForm({ type_code: '', type_name: '', grade: '', typical_weight_range: '' });setShowCoilTypeDialog(true);}}
          onEdit={handleEditCoilType}
          onDelete={(id) => deleteCoilTypeMutation.mutate(id)}
        />;

      case 'inspections':
        return <InspectionsSection
          inspectionCats={inspectionCats}
          inspectionPoints={inspectionPoints}
          onAddCategory={() => {setEditingInspectionCat(null);setInspectionCatForm({ name: '', description: '', type: 'incoming' });setShowInspectionCatDialog(true);}}
          onEditCategory={handleEditInspectionCat}
          onDeleteCategory={(id) => deleteInspectionCatMutation.mutate(id)}
          onAddPoint={() => {setEditingInspectionPoint(null);setInspectionPointForm({ category_id: '', name: '', description: '' });setShowInspectionPointDialog(true);}}
          onEditPoint={handleEditInspectionPoint}
          onDeletePoint={(id) => deleteInspectionPointMutation.mutate(id)}
        />;

      case 'yardConfig':
        return <LocationGenerator />;

      case 'branding':
        return <BrandingManager />;

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="flex h-screen">
        {/* Left Sidebar Menu */}
        <div className="w-80 bg-white border-r border-slate-200 flex flex-col">
          <div className="p-6 border-b border-slate-200">
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <Settings className="w-6 h-6 text-blue-900" />
              Master Configuration
            </h1>
            <p className="text-sm text-slate-500 mt-1">System settings & data management</p>
          </div>

          <nav className="flex-1 overflow-y-auto p-4">
            <div className="space-y-1">
              {menuItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeSection === item.id;

                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveSection(item.id)}
                    className={`
                      w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-all
                      ${isActive
                        ? 'bg-blue-900 text-white shadow-md'
                        : 'text-slate-700 hover:bg-slate-100'
                      }
                    `}
                  >
                    <Icon className={`w-5 h-5 flex-shrink-0 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                    <div className="flex-1 min-w-0">
                      <div className={`font-medium ${isActive ? 'text-white' : 'text-slate-900'}`}>
                        {item.label}
                      </div>
                      <div className={`text-xs ${isActive ? 'text-blue-100' : 'text-slate-500'}`}>
                        {item.description}
                      </div>
                    </div>
                    {isActive && <ChevronRight className="w-4 h-4 text-white flex-shrink-0" />}
                  </button>
                );
              })}
            </div>
          </nav>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-8">
            {renderContent()}
            <UICustomization />
          </div>
        </div>
      </div>

      {/* Dialogs */}
      <Dialog open={showLocationDialog} onOpenChange={setShowLocationDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingLocation ? 'Edit' : 'Add'} Storage Location</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
             <div className="space-y-2"><Label>Location Code *</Label><Input value={locationForm.location_code} onChange={(e) => setLocationForm({ ...locationForm, location_code: e.target.value })} placeholder="e.g., A-01-01" /></div>
             <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Bay *</Label><Input value={locationForm.bay} onChange={(e) => setLocationForm({ ...locationForm, bay: e.target.value })} placeholder="e.g., AB Bay" /></div>
                <div className="space-y-2"><Label>Zone *</Label><Input value={locationForm.zone} onChange={(e) => setLocationForm({ ...locationForm, zone: e.target.value })} placeholder="e.g., AB BAY WIP AREA" /></div>
             </div>
             <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Row Number</Label><Input type="number" value={locationForm.row_num} onChange={(e) => setLocationForm({ ...locationForm, row_num: e.target.value })} /></div>
                <div className="space-y-2"><Label>Column Number</Label><Input type="number" value={locationForm.col_num} onChange={(e) => setLocationForm({ ...locationForm, col_num: e.target.value })} /></div>
             </div>
             <div className="space-y-2"><Label>Capacity (tons) *</Label><Input type="number" value={locationForm.capacity_tons} onChange={(e) => setLocationForm({ ...locationForm, capacity_tons: e.target.value })} /></div>
             <div className="flex items-center space-x-2"><Switch id="is_active" checked={locationForm.is_active} onCheckedChange={(checked) => setLocationForm({ ...locationForm, is_active: checked })} /><Label htmlFor="is_active">Location is Active</Label></div>
             <div className="flex items-center space-x-2"><Switch id="is_visible" checked={locationForm.is_visible} onCheckedChange={(checked) => setLocationForm({ ...locationForm, is_visible: checked })} /><Label htmlFor="is_visible">Location is Visible</Label></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowLocationDialog(false)}>Cancel</Button>
            <Button onClick={handleSaveLocation} disabled={!locationForm.location_code || !locationForm.bay || !locationForm.zone || !locationForm.capacity_tons}>{editingLocation ? 'Update' : 'Create'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showCoilTypeDialog} onOpenChange={setShowCoilTypeDialog}>
          <DialogContent>
              <DialogHeader><DialogTitle>{editingCoilType ? 'Edit' : 'Add'} Coil Type</DialogTitle></DialogHeader>
              <div className="space-y-4 py-4">
                  <div className="space-y-2"><Label>Type Code *</Label><Input value={coilTypeForm.type_code} onChange={(e) => setCoilTypeForm({ ...coilTypeForm, type_code: e.target.value })} /></div>
                  <div className="space-y-2"><Label>Type Name *</Label><Input value={coilTypeForm.type_name} onChange={(e) => setCoilTypeForm({ ...coilTypeForm, type_name: e.target.value })} /></div>
                  <div className="space-y-2"><Label>Grade</Label><Input value={coilTypeForm.grade} onChange={(e) => setCoilTypeForm({ ...coilTypeForm, grade: e.target.value })} /></div>
                  <div className="space-y-2"><Label>Typical Weight Range</Label><Input value={coilTypeForm.typical_weight_range} onChange={(e) => setCoilTypeForm({ ...coilTypeForm, typical_weight_range: e.target.value })} /></div>
              </div>
              <DialogFooter>
                  <Button variant="outline" onClick={() => setShowCoilTypeDialog(false)}>Cancel</Button>
                  <Button onClick={handleSaveCoilType} disabled={!coilTypeForm.type_code || !coilTypeForm.type_name}>{editingCoilType ? 'Update' : 'Create'}</Button>
              </DialogFooter>
          </DialogContent>
      </Dialog>

      <Dialog open={showInspectionCatDialog} onOpenChange={setShowInspectionCatDialog}>
          <DialogContent>
              <DialogHeader><DialogTitle>{editingInspectionCat ? 'Edit' : 'Add'} Inspection Category</DialogTitle></DialogHeader>
              <div className="space-y-4 py-4">
                  <div className="space-y-2"><Label>Category Name *</Label><Input value={inspectionCatForm.name} onChange={(e) => setInspectionCatForm({ ...inspectionCatForm, name: e.target.value })} /></div>
                  <div className="space-y-2"><Label>Description</Label><Input value={inspectionCatForm.description} onChange={(e) => setInspectionCatForm({ ...inspectionCatForm, description: e.target.value })} /></div>
                  <div className="space-y-2">
                      <Label>Inspection Type *</Label>
                      <Select value={inspectionCatForm.type} onValueChange={(value) => setInspectionCatForm({ ...inspectionCatForm, type: value })}>
                          <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                          <SelectContent>
                              <SelectItem value="incoming">Incoming</SelectItem>
                              <SelectItem value="outgoing">Outgoing</SelectItem>
                          </SelectContent>
                      </Select>
                  </div>
              </div>
              <DialogFooter>
                  <Button variant="outline" onClick={() => setShowInspectionCatDialog(false)}>Cancel</Button>
                  <Button onClick={handleSaveInspectionCat} disabled={!inspectionCatForm.name}>{editingInspectionCat ? 'Update' : 'Create'}</Button>
              </DialogFooter>
          </DialogContent>
      </Dialog>

      <Dialog open={showInspectionPointDialog} onOpenChange={setShowInspectionPointDialog}>
          <DialogContent>
              <DialogHeader><DialogTitle>{editingInspectionPoint ? 'Edit' : 'Add'} Inspection Point</DialogTitle></DialogHeader>
              <div className="space-y-4 py-4">
                  <div className="space-y-2">
                      <Label>Category *</Label>
                      <Select value={inspectionPointForm.category_id} onValueChange={(value) => setInspectionPointForm({ ...inspectionPointForm, category_id: value })}>
                          <SelectTrigger><SelectValue placeholder="Select a category..." /></SelectTrigger>
                          <SelectContent>{inspectionCats.map((cat) => <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>)}</SelectContent>
                      </Select>
                  </div>
                  <div className="space-y-2"><Label>Point Name *</Label><Input value={inspectionPointForm.name} onChange={(e) => setInspectionPointForm({ ...inspectionPointForm, name: e.target.value })} /></div>
                  <div className="space-y-2"><Label>Description</Label><Input value={inspectionPointForm.description} onChange={(e) => setInspectionPointForm({ ...inspectionPointForm, description: e.target.value })} /></div>
              </div>
              <DialogFooter>
                  <Button variant="outline" onClick={() => setShowInspectionPointDialog(false)}>Cancel</Button>
                  <Button onClick={handleSaveInspectionPoint} disabled={!inspectionPointForm.name || !inspectionPointForm.category_id}>{editingInspectionPoint ? 'Update' : 'Create'}</Button>
              </DialogFooter>
          </DialogContent>
      </Dialog>
    </div>
  );
}

// Section Components
function LocationsSection({ locations, onAdd, onEdit, onDelete }) {
  return (
    <Card className="shadow-lg border-none">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Storage Location Master (Ground Level)</CardTitle>
          <CardDescription className="mt-2">Manage ground-level storage locations in your yard</CardDescription>
        </div>
        <Button onClick={onAdd} className="bg-blue-900 hover:bg-blue-800">
          <Plus className="w-4 h-4 mr-2" />Add Location
        </Button>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-100 border-b">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase">Location Code</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase">Bay</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase">Zone</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-slate-600 uppercase">Row</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-slate-600 uppercase">Col</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {locations.map((location) =>
                <tr key={location.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-mono font-medium">{location.location_code}</td>
                  <td className="px-4 py-3">{location.bay || '-'}</td>
                  <td className="px-4 py-3">{location.zone}</td>
                  <td className="px-4 py-3 text-center">{location.row_num || '-'}</td>
                  <td className="px-4 py-3 text-center">{location.col_num || '-'}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Badge className={`${location.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-800'}`}>{location.is_active ? 'Active' : 'Inactive'}</Badge>
                      {!location.is_visible && <Badge variant="outline">Hidden</Badge>}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => onEdit(location)}><Edit2 className="w-3 h-3" /></Button>
                      <Button size="sm" variant="outline" onClick={() => onDelete(location.id)} className="text-red-600 hover:text-red-700"><Trash2 className="w-3 h-3" /></Button>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

function CoilTypesSection({ coilTypes, onAdd, onEdit, onDelete }) {
  return (
    <Card className="shadow-lg border-none">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Coil Types Master</CardTitle>
          <CardDescription className="mt-2">Define material grades and coil specifications</CardDescription>
        </div>
        <Button onClick={onAdd} className="bg-blue-900 hover:bg-blue-800">
          <Plus className="w-4 h-4 mr-2" />Add Coil Type
        </Button>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-100 border-b">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase">Type Code</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase">Type Name</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase">Grade</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {coilTypes.map((type) =>
                <tr key={type.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-mono font-medium">{type.type_code}</td>
                  <td className="px-4 py-3">{type.type_name}</td>
                  <td className="px-4 py-3">{type.grade || '-'}</td>
                  <td className="px-4 py-3"><Badge className={`${type.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-800'}`}>{type.is_active ? 'Active' : 'Inactive'}</Badge></td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => onEdit(type)}><Edit2 className="w-3 h-3" /></Button>
                      <Button size="sm" variant="outline" onClick={() => onDelete(type.id)} className="text-red-600 hover:text-red-700"><Trash2 className="w-3 h-3" /></Button>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

function InspectionsSection({ inspectionCats, inspectionPoints, onAddCategory, onEditCategory, onDeleteCategory, onAddPoint, onEditPoint, onDeletePoint }) {
  return (
    <div className="grid lg:grid-cols-2 gap-6">
      <Card className="shadow-lg border-none">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Inspection Categories</CardTitle>
            <CardDescription className="mt-2">Organize inspection criteria</CardDescription>
          </div>
          <Button size="sm" onClick={onAddCategory} className="bg-blue-900 hover:bg-blue-800"><Plus className="w-4 h-4 mr-2" />New Category</Button>
        </CardHeader>
        <CardContent className="p-0 max-h-96 overflow-y-auto">
          <table className="w-full">
            <thead className="bg-slate-100 border-b sticky top-0">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase">Name</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase">Type</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {inspectionCats.map((cat) =>
                <tr key={cat.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium">{cat.name}</td>
                  <td className="px-4 py-3"><Badge variant={cat.type === 'incoming' ? 'default' : 'secondary'} className="capitalize">{cat.type}</Badge></td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => onEditCategory(cat)}><Edit2 className="w-3 h-3" /></Button>
                      <Button size="sm" variant="outline" onClick={() => onDeleteCategory(cat.id)} className="text-red-600 hover:text-red-700"><Trash2 className="w-3 h-3" /></Button>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card className="shadow-lg border-none">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Inspection Points</CardTitle>
            <CardDescription className="mt-2">Define specific checkpoints</CardDescription>
          </div>
          <Button size="sm" onClick={onAddPoint} className="bg-blue-900 hover:bg-blue-800"><Plus className="w-4 h-4 mr-2" />New Point</Button>
        </CardHeader>
        <CardContent className="p-0 max-h-96 overflow-y-auto">
          <table className="w-full">
            <thead className="bg-slate-100 border-b sticky top-0">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase">Name</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase">Category</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {inspectionPoints.map((point) => {
                const category = inspectionCats.find((c) => c.id === point.category_id);
                return (
                  <tr key={point.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium">{point.name}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">{category?.name || 'N/A'}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => onEditPoint(point)}><Edit2 className="w-3 h-3" /></Button>
                        <Button size="sm" variant="outline" onClick={() => onDeletePoint(point.id)} className="text-red-600 hover:text-red-700"><Trash2 className="w-3 h-3" /></Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

const LocationGenerator = () => {
  const queryClient = useQueryClient();
  const [bay, setBay] = useState('');
  const [zone, setZone] = useState('');
  const [prefix, setPrefix] = useState('');
  const [startNum, setStartNum] = useState(1);
  const [endNum, setEndNum] = useState(10);
  const [rows, setRows] = useState(2);
  const [cols, setCols] = useState(5);
  const [capacity, setCapacity] = useState(50);
  const [message, setMessage] = useState('');

  const bulkCreateMutation = useMutation({
    mutationFn: (locations) => base44.entities.StorageLocation.bulkCreate(locations),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['locations'] });
      setMessage(`${result.length} locations created successfully in ${bay} -> ${zone}!`);
    },
    onError: (error) => {
      setMessage(`Error: ${error.message}`);
    }
  });

  const handleGenerate = () => {
    setMessage('Generating...');
    const locationsToCreate = [];
    let currentRow = 1;
    let currentCol = 1;

    for (let i = parseInt(startNum, 10); i <= parseInt(endNum, 10); i++) {
      if (currentRow > parseInt(rows, 10)) {
        setMessage(`Error: Number of locations (${parseInt(endNum, 10) - parseInt(startNum, 10) + 1}) exceeds grid size (${rows}x${cols}).`);
        return;
      }
      locationsToCreate.push({
        location_code: `${prefix}${String(i).padStart(3, '0')}`,
        bay,
        zone,
        row_num: currentRow,
        col_num: currentCol,
        capacity_tons: parseFloat(capacity),
        // max_layers is omitted, assuming default 1 for ground locations created here
        is_active: true,
        is_visible: true
      });

      currentCol++;
      if (currentCol > parseInt(cols, 10)) {
        currentCol = 1;
        currentRow++;
      }
    }

    bulkCreateMutation.mutate(locationsToCreate);
  };

  return (
    <Card className="shadow-lg border-none">
      <CardHeader>
        <CardTitle>Bulk Location Generator</CardTitle>
        <CardDescription>
          Quickly create a grid of storage locations for a new zone. These are considered ground-level locations.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid md:grid-cols-2 gap-6">
          <div className="space-y-2"><Label>Bay Name *</Label><Input value={bay} onChange={(e) => setBay(e.target.value)} placeholder="e.g., AB Bay" /></div>
          <div className="space-y-2"><Label>Zone Name *</Label><Input value={zone} onChange={(e) => setZone(e.target.value)} placeholder="e.g., AB BAY WIP AREA" /></div>
        </div>
        <div className="grid md:grid-cols-3 gap-6">
          <div className="space-y-2"><Label>Location Prefix *</Label><Input value={prefix} onChange={(e) => setPrefix(e.target.value)} placeholder="e.g., A" /></div>
           <div className="space-y-2"><Label>Start Number *</Label><Input type="number" value={startNum} onChange={(e) => setStartNum(e.target.value)} /></div>
          <div className="space-y-2"><Label>End Number *</Label><Input type="number" value={endNum} onChange={(e) => setEndNum(e.target.value)} /></div>
        </div>
        <div className="grid md:grid-cols-3 gap-6">
           <div className="space-y-2"><Label>Rows in Grid *</Label><Input type="number" value={rows} onChange={(e) => setRows(e.target.value)} /></div>
          <div className="space-y-2"><Label>Columns in Grid *</Label><Input type="number" value={cols} onChange={(e) => setCols(e.target.value)} /></div>
          {/* Default Max Layers removed */}
          <div className="space-y-2"><Label>Default Capacity (Tons)</Label><Input type="number" value={capacity} onChange={(e) => setCapacity(e.target.value)} /></div>
        </div>
      </CardContent>
      <CardFooter>
          <div className="text-slate-800 flex items-center gap-4">
            <Button onClick={handleGenerate} disabled={bulkCreateMutation.isPending || !bay || !zone || !prefix} className="bg-blue-900 hover:bg-blue-800">
              {bulkCreateMutation.isPending ? 'Generating...' : 'Generate Locations'}
            </Button>
            {message && <p className="text-sm font-medium">{message}</p>}
          </div>
      </CardFooter>
    </Card>
  );
};

const UICustomization = () => {
  const [placeholderSize, setPlaceholderSize] = useState(
    localStorage.getItem('placeholderSize') || '96'
  );

  useEffect(() => {
    document.documentElement.style.setProperty('--placeholder-size', `${placeholderSize}px`);
    localStorage.setItem('placeholderSize', placeholderSize);
  }, [placeholderSize]);

  return (
    <Card className="mt-6 shadow-lg border-none">
      <CardHeader>
        <CardTitle>UI Customization</CardTitle>
        <CardDescription>
          Adjust the visual appearance of the application. These settings are saved in your browser.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="max-w-xs space-y-2">
          <Label htmlFor="placeholder-size">Yard Placeholder Size (pixels)</Label>
          <Input
            id="placeholder-size"
            type="number"
            value={placeholderSize}
            onChange={(e) => setPlaceholderSize(e.target.value)}
            placeholder="e.g., 96" />

          <p className="text-xs text-slate-500">
            Changes the size of the location boxes in Yard Layout and Storage Assignment. Default is 96.
          </p>
        </div>
      </CardContent>
    </Card>
  );
};
