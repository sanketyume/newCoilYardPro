import React, { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Package, Layers, CheckCircle, AlertTriangle, XCircle } from "lucide-react";
import { groupBy } from 'lodash';

export default function ReconciliationYardMap({
  stackingPositions,
  allGroundLocations,
  confirmedCoils,
  coilsToPlace,
  coilsToUnplace,
  pendingChanges,
  onPositionClick
}) {
  // Group positions by ground location for display
  const positionsByGroundLocation = useMemo(() => {
    const grouped = {};
    stackingPositions.forEach(pos => {
      const locId = pos.primary_ground_location_id;
      if (!grouped[locId]) {
        grouped[locId] = [];
      }
      grouped[locId].push(pos);
    });
    return grouped;
  }, [stackingPositions]);

  // Get unique ground locations
  const groundLocations = useMemo(() => {
    const locationIds = [...new Set(stackingPositions.map(p => p.primary_ground_location_id))];
    return locationIds
      .map(id => allGroundLocations.find(l => l.id === id))
      .filter(Boolean)
      .filter(l => l.row_num && l.col_num);
  }, [stackingPositions, allGroundLocations]);

  // Create grid
  const gridData = useMemo(() => {
    if (groundLocations.length === 0) return null;

    const minRow = Math.min(...groundLocations.map(l => l.row_num));
    const maxRow = Math.max(...groundLocations.map(l => l.row_num));
    const minCol = Math.min(...groundLocations.map(l => l.col_num));
    const maxCol = Math.max(...groundLocations.map(l => l.col_num));

    const rows = maxRow - minRow + 1;
    const cols = maxCol - minCol + 1;

    const grid = Array(rows).fill(null).map(() => Array(cols).fill(null));
    
    groundLocations.forEach(loc => {
      const row = loc.row_num - minRow;
      const col = loc.col_num - minCol;
      if (row >= 0 && row < rows && col >= 0 && col < cols) {
        grid[row][col] = loc;
      }
    });

    return { grid, rows, cols };
  }, [groundLocations]);

  const getLocationStatus = (location) => {
    const positions = positionsByGroundLocation[location.id] || [];
    
    // Check if any coil in this location is confirmed
    const hasConfirmed = positions.some(pos => confirmedCoils.includes(pos.coil_barcode));
    
    // Check if any coil here needs to be unplaced (missing)
    const hasMissing = coilsToUnplace.some(item => item.position.primary_ground_location_id === location.id);
    
    // Check if there are pending changes for this location
    const hasPending = pendingChanges.some(change => 
      change.targetPosition?.primary_ground_location_id === location.id ||
      change.position?.primary_ground_location_id === location.id
    );

    // Check if empty
    const isEmpty = positions.every(pos => !pos.coil_barcode);

    if (hasMissing) return 'missing';
    if (hasPending) return 'pending';
    if (hasConfirmed && !isEmpty) return 'confirmed';
    if (isEmpty) return 'empty';
    return 'neutral';
  };

  const getLocationStyle = (status) => {
    switch (status) {
      case 'confirmed':
        return 'bg-emerald-100 border-emerald-500 text-emerald-900';
      case 'missing':
        return 'bg-red-100 border-red-500 text-red-900';
      case 'pending':
        return 'bg-blue-100 border-blue-500 text-blue-900 ring-2 ring-blue-300';
      case 'empty':
        return 'bg-white border-slate-300 text-slate-600';
      default:
        return 'bg-slate-50 border-slate-300 text-slate-700';
    }
  };

  const getLocationIcon = (status) => {
    switch (status) {
      case 'confirmed':
        return <CheckCircle className="w-4 h-4 text-emerald-600" />;
      case 'missing':
        return <AlertTriangle className="w-4 h-4 text-red-600" />;
      case 'pending':
        return <Package className="w-4 h-4 text-blue-600 animate-pulse" />;
      case 'empty':
        return <Layers className="w-4 h-4 text-slate-400" />;
      default:
        return <Package className="w-4 h-4 text-slate-500" />;
    }
  };

  if (!gridData) {
    return (
      <Card className="shadow-lg border-none">
        <CardContent className="p-20 text-center text-slate-500">
          <p>No location grid data available</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-lg border-none">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Layers className="w-5 h-5" />
          Yard Map - {stackingPositions[0]?.bay} {stackingPositions[0]?.zone}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div 
          className="grid gap-2 p-4 bg-slate-50 rounded-lg overflow-x-auto"
          style={{ 
            gridTemplateColumns: `repeat(${gridData.cols}, minmax(120px, 1fr))`,
          }}
        >
          {gridData.grid.flat().map((loc, index) => {
            if (!loc) {
              return (
                <div key={`empty-${index}`} className="aspect-square border-2 border-dashed border-slate-200 rounded-lg bg-slate-50" />
              );
            }

            const status = getLocationStatus(loc);
            const positions = positionsByGroundLocation[loc.id] || [];
            const occupiedCount = positions.filter(p => p.coil_barcode).length;

            return (
              <div
                key={loc.id}
                className={`
                  aspect-square border-2 rounded-lg p-2 flex flex-col items-center justify-center
                  transition-all duration-200 cursor-pointer hover:shadow-lg hover:scale-105
                  ${getLocationStyle(status)}
                `}
              >
                <div className="flex items-center gap-1 mb-1">
                  {getLocationIcon(status)}
                  <span className="font-bold text-xs">{loc.location_code}</span>
                </div>
                
                {occupiedCount > 0 && (
                  <Badge variant="outline" className="text-[10px] mt-1">
                    {occupiedCount} coil{occupiedCount > 1 ? 's' : ''}
                  </Badge>
                )}

                {status === 'empty' && (
                  <span className="text-[10px] text-slate-400 mt-1">Empty</span>
                )}
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <div className="mt-6 p-4 bg-blue-50 border-2 border-blue-200 rounded-lg">
          <h4 className="font-semibold text-sm text-slate-900 mb-3">Map Legend</h4>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-xs">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-emerald-100 border-2 border-emerald-500 rounded"></div>
              <span>Confirmed OK</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-red-100 border-2 border-red-500 rounded"></div>
              <span>Missing Coil</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-blue-100 border-2 border-blue-500 rounded ring-2 ring-blue-300"></div>
              <span>Pending Change</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-white border-2 border-slate-300 rounded"></div>
              <span>Empty</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-slate-50 border-2 border-slate-300 rounded"></div>
              <span>Other</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}