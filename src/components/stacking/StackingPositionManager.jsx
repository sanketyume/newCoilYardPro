
import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Layers, Plus, Edit2, Trash2, AlertCircle, Eye } from "lucide-react"; // Added Eye icon
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function StackingPositionManager() {
  const queryClient = useQueryClient();
  const [showDialog, setShowDialog] = useState(false);
  const [editingPosition, setEditingPosition] = useState(null);
  const [selectedGroundLocations, setSelectedGroundLocations] = useState([]);
  const [formData, setFormData] = useState({
    placeholder_id: '',
    layer: 1,
    type: 'ground',
    primary_ground_location_id: '',
    is_active: true,
    is_visible: true
  });

  const { data: stackingPositions = [] } = useQuery({
    queryKey: ['stackingPositions'],
    queryFn: () => base44.entities.StackingPosition.list()
  });

  const { data: locations = [] } = useQuery({
    queryKey: ['locations'],
    queryFn: () => base44.entities.StorageLocation.list()
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.StackingPosition.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stackingPositions'] });
      setShowDialog(false);
      resetForm();
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.StackingPosition.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stackingPositions'] });
      setShowDialog(false);
      resetForm();
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.StackingPosition.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['stackingPositions'] })
  });

  const handleEdit = (position) => {
    setEditingPosition(position);
    setFormData({
      placeholder_id: position.placeholder_id,
      layer: position.layer,
      type: position.type,
      primary_ground_location_id: position.primary_ground_location_id,
      is_active: position.is_active ?? true,
      is_visible: position.is_visible ?? true
    });
    setSelectedGroundLocations(position.supported_by_ground_location_ids || []);
    setShowDialog(true);
  };

  const handleSave = () => {
    const primaryLocation = locations.find(l => l.id === formData.primary_ground_location_id);
    if (!primaryLocation) return;

    const dataToSave = {
      ...formData,
      primary_ground_location_code: primaryLocation.location_code,
      supported_by_ground_location_ids: selectedGroundLocations,
      supported_by_ground_location_codes: selectedGroundLocations.map(id => {
        const loc = locations.find(l => l.id === id);
        return loc ? loc.location_code : id;
      }),
      bay: primaryLocation.bay,
      zone: primaryLocation.zone
    };

    if (editingPosition) {
      updateMutation.mutate({ id: editingPosition.id, data: dataToSave });
    } else {
      createMutation.mutate(dataToSave);
    }
  };

  const resetForm = () => {
    setEditingPosition(null);
    setFormData({
      placeholder_id: '',
      layer: 1,
      type: 'ground',
      primary_ground_location_id: '',
      is_active: true,
      is_visible: true
    });
    setSelectedGroundLocations([]);
  };

  const toggleGroundLocation = (locationId) => {
    if (selectedGroundLocations.includes(locationId)) {
      setSelectedGroundLocations(selectedGroundLocations.filter(id => id !== locationId));
    } else {
      setSelectedGroundLocations([...selectedGroundLocations, locationId]);
    }
  };

  const suggestPlaceholderId = () => {
    if (!formData.primary_ground_location_id) return '';
    const primaryLoc = locations.find(l => l.id === formData.primary_ground_location_id);
    if (!primaryLoc) return '';

    const suffix = formData.type === 'ground' ? 'L1' : `L${formData.layer}-B`;
    return `${primaryLoc.location_code}-${suffix}`;
  };

  const getSelectableLocations = () => {
    if (!formData.primary_ground_location_id) return [];
    const primaryLoc = locations.find(l => l.id === formData.primary_ground_location_id);
    if (!primaryLoc) return [];

    return locations.filter(loc =>
      loc.bay === primaryLoc.bay &&
      loc.zone === primaryLoc.zone &&
      Math.abs((loc.row_num || 0) - (primaryLoc.row_num || 0)) <= 2 &&
      Math.abs((loc.col_num || 0) - (primaryLoc.col_num || 0)) <= 2
    );
  };

  // NEW: Visual Preview Component
  const renderPreviewGrid = () => {
    if (!formData.primary_ground_location_id || selectedGroundLocations.length === 0) {
      return null;
    }

    const selectableLocations = getSelectableLocations();
    const primaryLoc = locations.find(l => l.id === formData.primary_ground_location_id);
    
    if (!selectableLocations.length || !primaryLoc) return null;

    // Filter selectable locations to only include those that have row_num and col_num
    const filterableLocations = selectableLocations.filter(l => 
      l.row_num !== null && l.col_num !== null && l.row_num !== undefined && l.col_num !== undefined
    );

    if (filterableLocations.length === 0) return null; // No grid-eligible locations

    const minRow = Math.min(...filterableLocations.map(l => l.row_num));
    const maxRow = Math.max(...filterableLocations.map(l => l.row_num));
    const minCol = Math.min(...filterableLocations.map(l => l.col_num));
    const maxCol = Math.max(...filterableLocations.map(l => l.col_num));

    const grid = [];
    for (let r = minRow; r <= maxRow; r++) {
      const row = Array(maxCol - minCol + 1).fill(null); 
      for (let c = minCol; c <= maxCol; c++) {
        const loc = filterableLocations.find(l => l.row_num === r && l.col_num === c);
        if (loc) {
            row[c - minCol] = loc; 
        }
      }
      grid.push(row);
    }

    return (
      <div className="mt-4 p-4 bg-slate-50 rounded-lg border-2 border-slate-200">
        <div className="flex items-center gap-2 mb-3">
          <Eye className="w-4 h-4 text-blue-600" />
          <h4 className="font-semibold text-sm text-slate-900">Visual Preview</h4>
        </div>
        <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${maxCol - minCol + 1}, 80px)` }}>
          {grid.flat().map((loc, idx) => {
            if (!loc) return <div key={`empty-${idx}`} className="w-20 h-20" />;
            
            const isSelected = selectedGroundLocations.includes(loc.id);
            const isPrimary = loc.id === formData.primary_ground_location_id;
            
            return (
              <div
                key={loc.id}
                className={`
                  w-20 h-20 rounded border-2 flex items-center justify-center text-xs font-mono transition-all
                  ${isPrimary ? 'border-blue-600 bg-blue-100 ring-2 ring-blue-300' :
                    isSelected ? 'border-emerald-500 bg-emerald-50' :
                    'border-slate-300 bg-white'}
                `}
              >
                <div className="text-center">
                  <div className="font-bold text-[10px] break-all">{loc.location_code}</div>
                  {isPrimary && <Badge className="text-[8px] mt-1 h-4">Primary</Badge>}
                </div>
              </div>
            );
          })}
        </div>
        <div className="mt-3 text-xs text-slate-600 space-y-1">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 border-2 border-blue-600 bg-blue-100 rounded"></div>
            <span>Primary Ground Location</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 border-2 border-emerald-500 bg-emerald-50 rounded"></div>
            <span>Supporting Ground Locations</span>
          </div>
          {formData.layer > 1 && (
            <p className="mt-2 text-slate-700">
              Layer {formData.layer} position will bridge across the {selectedGroundLocations.length} selected ground location(s).
            </p>
          )}
        </div>
      </div>
    );
  };

  return (
    <Card className="shadow-lg border-none">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Layers className="w-5 h-5" />
          Stacking Positions Management
        </CardTitle>
        <Button
          onClick={() => { resetForm(); setShowDialog(true); }}
          className="bg-blue-900 text-white px-4 py-2 text-sm font-medium rounded-md inline-flex items-center justify-center gap-2 whitespace-nowrap ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 hover:bg-blue-800 h-10"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Stacking Position
        </Button>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-100 border-b">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase">Placeholder ID</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase">Layer</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase">Type</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase">Primary Location</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase">Supported By</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {stackingPositions.map(position => (
                <tr key={position.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-mono font-medium text-blue-900">{position.placeholder_id}</td>
                  <td className="px-4 py-3"><Badge variant="outline">Layer {position.layer}</Badge></td>
                  <td className="px-4 py-3 capitalize">{position.type}</td>
                  <td className="px-4 py-3 font-mono text-sm">{position.primary_ground_location_code}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {(position.supported_by_ground_location_codes || []).map((code, idx) => (
                        <Badge key={idx} variant="secondary" className="text-xs">{code}</Badge>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Badge className={position.coil_barcode ? 'bg-orange-100 text-orange-800' : 'bg-emerald-100 text-emerald-800'}>
                      {position.coil_barcode ? 'Occupied' : 'Empty'}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => handleEdit(position)}>
                        <Edit2 className="w-3 h-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => deleteMutation.mutate(position.id)}
                        className="text-red-600 hover:text-red-700"
                        disabled={!!position.coil_barcode}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>

      {/* Add/Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={(open) => { if (!open) { setShowDialog(false); resetForm(); } }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto"> {/* Changed max-w-3xl to max-w-4xl */}
          <DialogHeader>
            <DialogTitle>{editingPosition ? 'Edit' : 'Add'} Stacking Position</DialogTitle>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Layer Selection */}
            <div className="space-y-2">
              <Label>Layer *</Label>
              <Select
                value={formData.layer.toString()}
                onValueChange={(value) => {
                  const layer = parseInt(value, 10);
                  setFormData({
                    ...formData,
                    layer,
                    type: layer === 1 ? 'ground' : 'bridging'
                  });
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select layer" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Layer 1 (Ground)</SelectItem>
                  <SelectItem value="2">Layer 2 (Bridging)</SelectItem> {/* Updated text */}
                  <SelectItem value="3">Layer 3 (Bridging)</SelectItem> {/* Updated text */}
                </SelectContent>
              </Select>
            </div>

            {/* Primary Ground Location */}
            <div className="space-y-2">
              <Label>Primary Ground Location *</Label>
              <Select
                value={formData.primary_ground_location_id}
                onValueChange={(value) => {
                  setFormData({ ...formData, primary_ground_location_id: value });
                  // Auto-select this location as the first supported location
                  setSelectedGroundLocations([value]);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select primary location" />
                </SelectTrigger>
                <SelectContent>
                  {locations.filter(l => l.is_active).map(loc => (
                    <SelectItem key={loc.id} value={loc.id}>
                      {loc.location_code} ({loc.bay} - {loc.zone})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Suggested Placeholder ID */}
            {formData.primary_ground_location_id && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Suggested ID:</strong> {suggestPlaceholderId()}
                  <Button
                    size="sm"
                    variant="link"
                    onClick={() => setFormData({ ...formData, placeholder_id: suggestPlaceholderId() })}
                    className="ml-2 h-auto p-0"
                  >
                    Use This
                  </Button>
                </AlertDescription>
              </Alert>
            )}

            {/* Placeholder ID Input */}
            <div className="space-y-2">
              <Label>Placeholder ID *</Label>
              <Input
                value={formData.placeholder_id}
                onChange={(e) => setFormData({ ...formData, placeholder_id: e.target.value })}
                placeholder="e.g., A-01-01-L1 or A-01-01-L2-B"
              />
            </div>

            {/* Supporting Ground Locations (Multi-Select) */}
            {formData.primary_ground_location_id && (
              <div className="space-y-2">
                <Label>Supported By Ground Locations *</Label>
                <p className="text-sm text-slate-500">
                  Select all ground locations that physically support this stacking position.
                  {formData.layer === 1 && " For ground layer, select only the primary location."}
                  {formData.layer === 2 && " For Layer 2, typically select 2 adjacent locations for bridging."} {/* Updated text */}
                  {formData.layer === 3 && " For Layer 3, select 2-3 locations to bridge across."} {/* Updated text */}
                </p>
                
                <div className="border rounded-lg p-4 bg-slate-50 max-h-60 overflow-y-auto">
                  <div className="grid grid-cols-2 gap-2">
                    {getSelectableLocations().map(loc => (
                      <div
                        key={loc.id}
                        onClick={() => toggleGroundLocation(loc.id)}
                        className={`
                          p-3 rounded border-2 cursor-pointer transition-all
                          ${selectedGroundLocations.includes(loc.id) ?
                            'border-blue-500 bg-blue-50' :
                            'border-slate-200 hover:border-slate-400'}
                        `}
                      >
                        <div className="font-mono font-semibold text-sm">{loc.location_code}</div>
                        <div className="text-xs text-slate-500">Row {loc.row_num}, Col {loc.col_num}</div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 mt-2">
                  <span className="text-sm font-medium">Selected:</span>
                  {selectedGroundLocations.map(id => {
                    const loc = locations.find(l => l.id === id);
                    return loc ? (
                      <Badge key={id} variant="secondary">{loc.location_code}</Badge>
                    ) : null;
                  })}
                </div>

                {/* NEW: Visual Preview */}
                {renderPreviewGrid()}
              </div>
            )}

            {/* Active/Visible Switches */}
            <div className="flex items-center gap-6">
              <div className="flex items-center space-x-2">
                <Switch
                  id="is_active"
                  checked={formData.is_active}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                />
                <Label htmlFor="is_active">Active</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="is_visible"
                  checked={formData.is_visible}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_visible: checked })}
                />
                <Label htmlFor="is_visible">Visible</Label>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowDialog(false); resetForm(); }}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={
                !formData.placeholder_id ||
                !formData.primary_ground_location_id ||
                selectedGroundLocations.length === 0 ||
                createMutation.isPending ||
                updateMutation.isPending
              }
            >
              {editingPosition ? 'Update' : 'Create'} Position
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
