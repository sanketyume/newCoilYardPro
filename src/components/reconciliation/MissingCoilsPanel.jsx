
import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, XCircle, Search } from "lucide-react";
import { motion } from "framer-motion";

export default function MissingCoilsPanel({ coils, onUnassign, onMarkMissing, pendingChanges }) {
  const isCoilPending = (coil) => {
    return pendingChanges.some(change => 
      (change.type === 'unassign' || change.type === 'mark_missing') && 
      change.coil.barcode === coil.barcode
    );
  };

  return (
    <Card className="shadow-lg border-none h-[600px] flex flex-col">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-red-600" />
          Missing Coils
        </CardTitle>
        <p className="text-xs text-slate-500">System shows these coils here, but they weren't found physically</p>
      </CardHeader>
      <CardContent className="flex-1 overflow-y-auto space-y-2 p-4">
        {coils.map((item, index) => {
          const isPending = isCoilPending(item.coil);
          const pendingChange = pendingChanges.find(c => c.coil?.barcode === item.coil.barcode);

          return (
            <motion.div
              key={item.coil.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
              className={`
                p-3 rounded-lg border-2 transition-all
                ${isPending ? 'border-emerald-500 bg-emerald-50' : 'border-red-200 bg-red-50'}
              `}
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-600" />
                  <span className="font-mono font-bold text-sm text-red-900">{item.coil.barcode}</span>
                </div>
                {isPending && (
                  <Badge className="bg-emerald-600 text-white text-[10px]">
                    {pendingChange.type === 'mark_missing' ? 'Will Mark Missing' : 'Will Unassign'}
                  </Badge>
                )}
              </div>
              
              <div className="text-xs text-slate-600 space-y-1 mb-3">
                <div><span className="text-slate-500">Weight:</span> {item.coil.weight}t</div>
                <div><span className="text-slate-500">System Position:</span> {item.position.placeholder_id} (Layer {item.position.layer})</div>
                {item.willMoveTo && (
                  <div className="text-blue-600 font-medium">
                    Will be moved to: {item.willMoveTo}
                  </div>
                )}
              </div>

              {!isPending && (
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onUnassign(item.coil, item.position)}
                    className="flex-1 text-xs"
                  >
                    <XCircle className="w-3 h-3 mr-1" />
                    Unassign
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => onMarkMissing(item.coil, item.position)}
                    className="flex-1 bg-red-600 hover:bg-red-700 text-xs"
                  >
                    <Search className="w-3 h-3 mr-1" />
                    Mark Missing
                  </Button>
                </div>
              )}
            </motion.div>
          );
        })}

        {coils.length === 0 && (
          <div className="text-center py-12 text-slate-400">
            <AlertTriangle className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm">No missing coils detected</p>
            <p className="text-xs mt-1">All system records match physical count!</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
