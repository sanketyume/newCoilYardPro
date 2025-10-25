
import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Package, ArrowRight, Search, MapPin } from "lucide-react"; // Added MapPin import
import { motion } from "framer-motion";

export default function CoilPlacementPanel({ coils, onAssign, stackingPositions, pendingChanges }) {
  const [selectedCoil, setSelectedCoil] = useState(null);
  const [selectedPosition, setSelectedPosition] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Filter empty positions
  const emptyPositions = stackingPositions.filter(pos => !pos.coil_barcode);

  // Filter coils based on search
  const filteredCoils = coils.filter(item => 
    item.coil.barcode.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleAssign = () => {
    if (!selectedCoil || !selectedPosition) return;
    onAssign(selectedCoil, selectedPosition);
    setSelectedCoil(null);
    setSelectedPosition('');
  };

  const isCoilPending = (coil) => {
    return pendingChanges.some(change => 
      change.type === 'assign' && change.coil.barcode === coil.barcode
    );
  };

  return (
    <Card className="shadow-lg border-none h-[600px] flex flex-col">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Coils to Place</CardTitle>
        <Input
          placeholder="Search coil barcode..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="mt-2"
          icon={<Search className="w-4 h-4" />}
        />
      </CardHeader>
      <CardContent className="flex-1 overflow-y-auto space-y-2 p-4">
        {filteredCoils.map((item, index) => {
          const isPending = isCoilPending(item.coil);
          const isSelected = selectedCoil?.barcode === item.coil.barcode;

          return (
            <motion.div
              key={item.coil.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
              className={`
                p-3 rounded-lg border-2 transition-all cursor-pointer
                ${isSelected ? 'border-blue-500 bg-blue-50' : 
                  isPending ? 'border-emerald-500 bg-emerald-50' : 
                  'border-slate-200 hover:border-slate-300 bg-white'}
              `}
              onClick={() => !isPending && setSelectedCoil(item.coil)}
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Package className="w-4 h-4 text-slate-600" />
                  <span className="font-mono font-bold text-sm">{item.coil.barcode}</span>
                </div>
                {isPending && (
                  <Badge className="bg-emerald-600 text-white text-[10px]">
                    Staged
                  </Badge>
                )}
              </div>
              
              <div className="text-xs text-slate-600 space-y-1">
                <div><span className="text-slate-500">Weight:</span> {item.coil.weight}t</div>
                <div><span className="text-slate-500">Reason:</span> {item.reason}</div>
                {item.targetPlaceholder && (
                  <div className="text-blue-600 font-medium flex items-center gap-1">
                    <MapPin className="w-3 h-3" />
                    Found at: {item.targetPlaceholder.placeholder_id}
                  </div>
                )}
                {item.currentSystemPosition && (
                  <div className="text-orange-600">
                    <span className="text-slate-500">Current System:</span> {item.currentSystemPosition.placeholder_id}
                  </div>
                )}
              </div>
            </motion.div>
          );
        })}

        {filteredCoils.length === 0 && (
          <div className="text-center py-12 text-slate-400">
            <Package className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm">No coils to place</p>
          </div>
        )}
      </CardContent>

      {selectedCoil && (
        <div className="border-t p-4 bg-slate-50 space-y-3">
          <div className="flex items-center gap-2 text-sm">
            <span className="font-medium">Assign to:</span>
            <Badge variant="outline">{selectedCoil.barcode}</Badge>
          </div>
          
          {/* Show target placeholder if it exists from stock take */}
          {filteredCoils.find(c => c.coil.barcode === selectedCoil.barcode)?.targetPlaceholder && (
            <div className="bg-blue-50 p-2 rounded text-xs">
              <p className="font-medium text-blue-900">Recommended from stock take:</p>
              <p className="text-blue-700">
                {filteredCoils.find(c => c.coil.barcode === selectedCoil.barcode).targetPlaceholder.placeholder_id}
              </p>
            </div>
          )}
          
          <Select value={selectedPosition} onValueChange={setSelectedPosition}>
            <SelectTrigger>
              <SelectValue placeholder="Select position..." /> {/* Updated placeholder text */}
            </SelectTrigger>
            <SelectContent>
              {emptyPositions.map(pos => (
                <SelectItem key={pos.id} value={pos.id}>
                  {pos.placeholder_id} (Layer {pos.layer})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            onClick={handleAssign}
            disabled={!selectedPosition}
            className="w-full bg-blue-900 hover:bg-blue-800"
          >
            <ArrowRight className="w-4 h-4 mr-2" />
            Stage Assignment
          </Button>
        </div>
      )}
    </Card>
  );
}
