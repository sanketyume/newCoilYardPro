
import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ArrowLeftRight,
  AlertTriangle,
  Clock,
  TrendingUp,
  MapPin,
  CheckCircle,
  XCircle,
  AlertCircle,
  Layers
} from "lucide-react";
import { differenceInDays } from "date-fns";

export default function CoilShuffling() {
  const queryClient = useQueryClient();
  const [selectedCoil, setSelectedCoil] = useState(null);
  const [showDialog, setShowDialog] = useState(false);
  const [selectedNewPosition, setSelectedNewPosition] = useState('');
  const [reason, setReason] = useState('');
  const [remarks, setRemarks] = useState('');
  const [message, setMessage] = useState(null);

  const { data: coils = [] } = useQuery({
    queryKey: ['coils'],
    queryFn: () => base44.entities.Coil.filter({ status: 'in_yard' }),
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    onError: (error) => {
      console.error('Error loading coils:', error);
      setMessage({
        type: 'error',
        text: `Failed to load coils: ${error.message || 'Network error'}. Please try refreshing.`
      });
    }
  });

  const { data: stackingPositions = [] } = useQuery({
    queryKey: ['stackingPositions'],
    queryFn: () => base44.entities.StackingPosition.list(),
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    onError: (error) => {
      console.error('Error loading stacking positions:', error);
      setMessage({
        type: 'error',
        text: `Failed to load stacking positions: ${error.message || 'Network error'}. Please try refreshing.`
      });
    }
  });

  // Calculate shuffling priority
  const coilsWithPriority = coils.map(coil => {
    const daysInYard = coil.received_date 
      ? differenceInDays(new Date(), new Date(coil.received_date))
      : 0;
    
    let priorityScore = 0;
    if (coil.priority === 'urgent') priorityScore += 40;
    else if (coil.priority === 'high') priorityScore += 30;
    else if (coil.priority === 'medium') priorityScore += 10;
    
    priorityScore += Math.min(daysInYard * 2, 40);
    
    // Get current position info
    const currentPosition = coil.current_stacking_position_id 
      ? stackingPositions.find(p => p.id === coil.current_stacking_position_id)
      : null;
    
    return {
      ...coil,
      daysInYard,
      priorityScore,
      needsShuffle: priorityScore > 40 || daysInYard > 30,
      currentPosition
    };
  }).sort((a, b) => b.priorityScore - a.priorityScore);

  // Get available empty positions for shuffling
  const availablePositions = stackingPositions.filter(pos => 
    pos.is_active && pos.is_visible && !pos.coil_barcode
  );

  const shuffleCoilMutation = useMutation({
    mutationFn: async ({ coil, newPositionId, reason, remarks }) => {
      // Find new position
      const newPosition = stackingPositions.find(p => p.id === newPositionId);
      if (!newPosition) throw new Error('New position not found');
      
      // Check if new position is empty
      if (newPosition.coil_barcode) {
        throw new Error(`Position ${newPosition.placeholder_id} is already occupied`);
      }

      // Validate layer dependencies for new position
      if (newPosition.layer > 1) {
        const supportingPositions = stackingPositions.filter(pos => 
          newPosition.supported_by_ground_location_ids.includes(pos.primary_ground_location_id) &&
          pos.layer === newPosition.layer - 1
        );
        
        const allSupportsOccupied = supportingPositions.every(pos => pos.coil_barcode);
        if (!allSupportsOccupied) {
          throw new Error(`Cannot shuffle to Layer ${newPosition.layer}. Lower layer positions must be filled first.`);
        }
      }

      // Get old position
      const oldPosition = coil.current_stacking_position_id
        ? stackingPositions.find(p => p.id === coil.current_stacking_position_id)
        : null;

      // Check if there are coils above in old position
      if (oldPosition) {
        const positionsAbove = stackingPositions.filter(pos => 
          pos.layer > oldPosition.layer &&
          pos.supported_by_ground_location_ids.some(id => 
            oldPosition.supported_by_ground_location_ids.includes(id)
          ) &&
          pos.coil_barcode
        );

        if (positionsAbove.length > 0) {
          throw new Error(`Cannot shuffle coil. There are ${positionsAbove.length} coil(s) in upper layers that depend on this position.`);
        }
      }

      // Clear old position
      if (oldPosition) {
        await base44.entities.StackingPosition.update(oldPosition.id, {
          coil_barcode: null
        });
      }

      // Assign to new position
      await base44.entities.StackingPosition.update(newPosition.id, {
        coil_barcode: coil.barcode
      });

      // Update coil
      await base44.entities.Coil.update(coil.id, {
        current_stacking_position_id: newPosition.id,
        storage_location: newPosition.primary_ground_location_code,
        last_moved_date: new Date().toISOString()
      });

      // Log movement
      await base44.entities.CoilMovement.create({
        coil_barcode: coil.barcode,
        from_location: oldPosition?.placeholder_id || 'Unknown',
        to_location: newPosition.placeholder_id,
        movement_type: 'shuffle',
        movement_date: new Date().toISOString(),
        moved_by: 'user',
        reason: reason,
        remarks: remarks
      });

      return { 
        coilBarcode: coil.barcode, 
        fromLocation: oldPosition?.placeholder_id || 'Unknown', 
        toLocation: newPosition.placeholder_id 
      };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['coils'] });
      queryClient.invalidateQueries({ queryKey: ['stackingPositions'] });
      queryClient.invalidateQueries({ queryKey: ['movements'] });
      
      setMessage({
        type: 'success',
        text: `✓ Coil ${result.coilBarcode} successfully shuffled from ${result.fromLocation} to ${result.toLocation}`
      });
      
      setShowDialog(false);
      setSelectedCoil(null);
      setSelectedNewPosition('');
      setReason('');
      setRemarks('');
    },
    onError: (error) => {
      setMessage({
        type: 'error',
        text: error.message || 'Failed to shuffle coil. Please try again.'
      });
    }
  });

  const handleShuffleClick = (coil) => {
    setSelectedCoil(coil);
    setShowDialog(true);
    setSelectedNewPosition('');
    setReason('');
    setRemarks('');
    setMessage(null);
  };

  const handleShuffle = () => {
    if (!selectedNewPosition || !reason.trim()) return;
    setMessage(null);
    shuffleCoilMutation.mutate({
      coil: selectedCoil,
      newPositionId: selectedNewPosition,
      reason: reason,
      remarks: remarks
    });
  };

  return (
    <div className="p-6 lg:p-8 bg-slate-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900">Coil Shuffling Management</h1>
          <p className="text-slate-600 mt-2">Optimize coil positions based on priority and aging</p>
        </div>

        {/* Success/Error Message */}
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

        {/* Summary Cards */}
        <div className="grid md:grid-cols-4 gap-6 mb-8">
          <Card className="shadow-lg border-none bg-gradient-to-br from-orange-50 to-orange-100">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-600 mb-1">High Priority</p>
                  <p className="text-3xl font-bold text-orange-900">
                    {coilsWithPriority.filter(c => c.needsShuffle).length}
                  </p>
                  <p className="text-xs text-slate-600 mt-1">Need attention</p>
                </div>
                <AlertTriangle className="w-12 h-12 text-orange-900 opacity-30" />
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-lg border-none bg-gradient-to-br from-blue-50 to-blue-100">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-600 mb-1">Available Positions</p>
                  <p className="text-3xl font-bold text-blue-900">{availablePositions.length}</p>
                  <p className="text-xs text-slate-600 mt-1">Empty slots</p>
                </div>
                <Layers className="w-12 h-12 text-blue-900 opacity-30" />
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-lg border-none bg-gradient-to-br from-purple-50 to-purple-100">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-600 mb-1">Avg Days in Yard</p>
                  <p className="text-3xl font-bold text-purple-900">
                    {coilsWithPriority.length > 0
                      ? (coilsWithPriority.reduce((sum, c) => sum + c.daysInYard, 0) / coilsWithPriority.length).toFixed(0)
                      : 0}
                  </p>
                  <p className="text-xs text-slate-600 mt-1">Days</p>
                </div>
                <Clock className="w-12 h-12 text-purple-900 opacity-30" />
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-lg border-none bg-gradient-to-br from-emerald-50 to-emerald-100">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-600 mb-1">Total Coils</p>
                  <p className="text-3xl font-bold text-emerald-900">{coilsWithPriority.length}</p>
                  <p className="text-xs text-slate-600 mt-1">In yard</p>
                </div>
                <MapPin className="w-12 h-12 text-emerald-900 opacity-30" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Coils List */}
        <Card className="shadow-lg border-none">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-blue-900" />
              Coils by Shuffling Priority
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-100 border-b">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase">Barcode</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase">Current Position</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase">Weight</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase">Priority</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase">Days in Yard</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase">Score</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {coilsWithPriority.map((coil) => (
                    <tr key={coil.id} className={`hover:bg-slate-50 ${coil.needsShuffle ? 'bg-orange-50' : ''}`}>
                      <td className="px-6 py-4">
                        <p className="font-medium text-slate-900">{coil.barcode}</p>
                        <p className="text-xs text-slate-500">{coil.coil_type}</p>
                      </td>
                      <td className="px-6 py-4">
                        {coil.currentPosition ? (
                          <div>
                            <Badge variant="outline" className="font-mono">
                              {coil.currentPosition.placeholder_id}
                            </Badge>
                            <p className="text-xs text-slate-500 mt-1">
                              Layer {coil.currentPosition.layer} • {coil.currentPosition.type}
                            </p>
                          </div>
                        ) : (
                          <Badge variant="outline">Not assigned</Badge>
                        )}
                      </td>
                      <td className="px-6 py-4 text-slate-900">{coil.weight} tons</td>
                      <td className="px-6 py-4">
                        <Badge className={`
                          ${coil.priority === 'urgent' ? 'bg-red-100 text-red-800' :
                            coil.priority === 'high' ? 'bg-orange-100 text-orange-800' :
                            coil.priority === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-blue-100 text-blue-800'}
                        `}>
                          {coil.priority}
                        </Badge>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`font-medium ${coil.daysInYard > 30 ? 'text-orange-600' : 'text-slate-900'}`}>
                          {coil.daysInYard} days
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-2 bg-slate-200 rounded-full overflow-hidden">
                            <div
                              className={`h-full ${
                                coil.priorityScore > 60 ? 'bg-red-500' :
                                coil.priorityScore > 40 ? 'bg-orange-500' :
                                'bg-emerald-500'
                              }`}
                              style={{ width: `${Math.min(coil.priorityScore, 100)}%` }}
                            />
                          </div>
                          <span className="text-sm text-slate-600">{coil.priorityScore}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <Button
                          size="sm"
                          onClick={() => handleShuffleClick(coil)}
                          disabled={!coil.current_stacking_position_id}
                          className={`${
                            coil.needsShuffle 
                              ? 'bg-orange-600 hover:bg-orange-700' 
                              : 'bg-blue-900 hover:bg-blue-800'
                          }`}
                        >
                          <ArrowLeftRight className="w-4 h-4 mr-1" />
                          Shuffle
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

      {/* Shuffle Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Shuffle Coil to New Position</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* Error message in dialog */}
            {message && message.type === 'error' && (
              <Alert variant="destructive">
                <XCircle className="h-4 w-4" />
                <AlertDescription>{message.text}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <p className="text-sm text-slate-600">Coil:</p>
              <Badge className="bg-blue-900 text-white text-base px-4 py-2">
                {selectedCoil?.barcode}
              </Badge>
              {selectedCoil?.currentPosition && (
                <p className="text-xs text-slate-500">
                  Current: {selectedCoil.currentPosition.placeholder_id} (Layer {selectedCoil.currentPosition.layer})
                </p>
              )}
            </div>
            
            <div className="space-y-2">
              <Label className="text-sm font-medium">New Position *</Label>
              <Select value={selectedNewPosition} onValueChange={setSelectedNewPosition}>
                <SelectTrigger>
                  <SelectValue placeholder="Select an empty position..." />
                </SelectTrigger>
                <SelectContent>
                  {availablePositions.length > 0 ? (
                    availablePositions.map(pos => (
                      <SelectItem key={pos.id} value={pos.id}>
                        {pos.placeholder_id} - Layer {pos.layer} ({pos.bay}, {pos.zone})
                      </SelectItem>
                    ))
                  ) : (
                    <SelectItem value="none" disabled>No empty positions available</SelectItem>
                  )}
                </SelectContent>
              </Select>
              <p className="text-xs text-slate-500">
                {availablePositions.length} empty positions available
              </p>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">Reason *</Label>
              <Input
                placeholder="e.g., Priority optimization, Aging management..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">Remarks</Label>
              <Textarea
                placeholder="Additional notes..."
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleShuffle}
              disabled={!selectedNewPosition || !reason.trim() || shuffleCoilMutation.isPending}
              className="bg-blue-900 hover:bg-blue-800"
            >
              <ArrowLeftRight className="w-4 h-4 mr-2" />
              {shuffleCoilMutation.isPending ? 'Shuffling...' : 'Confirm Shuffle'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
