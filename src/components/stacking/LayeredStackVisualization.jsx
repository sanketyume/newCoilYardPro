import React, { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Package, Layers, ArrowDown } from "lucide-react";
import { motion } from "framer-motion";

/**
 * LayeredStackVisualization Component
 * Enhanced version with clear spatial relationships between layers
 */
export default function LayeredStackVisualization({ 
  groundLocation, 
  allStackingPositions, 
  allGroundLocations,
  coils = [],
  onPositionClick,
  isReadOnly = false,
  selectedPositionId = null
}) {
  // Get all positions related to this ground location
  const relatedPositions = useMemo(() => 
    allStackingPositions.filter(pos =>
      pos.supported_by_ground_location_ids.includes(groundLocation.id) && 
      pos.is_active && 
      pos.is_visible
    ), [allStackingPositions, groundLocation.id]
  );

  // Group positions by layer
  const positionsByLayer = useMemo(() => ({
    1: relatedPositions.filter(p => p.layer === 1),
    2: relatedPositions.filter(p => p.layer === 2),
    3: relatedPositions.filter(p => p.layer === 3)
  }), [relatedPositions]);

  // Create a grid layout for ground positions
  const groundGrid = useMemo(() => {
    const positions = positionsByLayer[1];
    if (positions.length === 0) return { grid: [], rows: 0, cols: 0 };

    // Get all unique ground locations for these positions
    const uniqueLocationIds = new Set();
    positions.forEach(pos => {
      pos.supported_by_ground_location_ids.forEach(id => uniqueLocationIds.add(id));
    });

    const groundLocs = Array.from(uniqueLocationIds)
      .map(id => allGroundLocations.find(l => l.id === id))
      .filter(Boolean)
      .filter(l => l.row_num && l.col_num);

    if (groundLocs.length === 0) return { grid: [], rows: 0, cols: 0, positions };

    const minRow = Math.min(...groundLocs.map(l => l.row_num));
    const maxRow = Math.max(...groundLocs.map(l => l.row_num));
    const minCol = Math.min(...groundLocs.map(l => l.col_num));
    const maxCol = Math.max(...groundLocs.map(l => l.col_num));

    const rows = maxRow - minRow + 1;
    const cols = maxCol - minCol + 1;

    // Create grid with positions
    const grid = Array(rows).fill(null).map(() => Array(cols).fill(null));
    positions.forEach(pos => {
      const loc = allGroundLocations.find(l => l.id === pos.primary_ground_location_id);
      if (loc && loc.row_num && loc.col_num) {
        const row = loc.row_num - minRow;
        const col = loc.col_num - minCol;
        if (row >= 0 && row < rows && col >= 0 && col < cols) {
          grid[row][col] = pos;
        }
      }
    });

    return { grid, rows, cols, positions, minRow, minCol, maxRow, maxCol };
  }, [positionsByLayer, allGroundLocations]);

  // Calculate spans for upper layer positions
  const getPositionSpan = (position) => {
    const supportingLocs = position.supported_by_ground_location_ids
      .map(id => allGroundLocations.find(l => l.id === id))
      .filter(l => l && l.row_num && l.col_num);

    if (supportingLocs.length === 0) return null;

    const rows = supportingLocs.map(l => l.row_num - groundGrid.minRow);
    const cols = supportingLocs.map(l => l.col_num - groundGrid.minCol);

    return {
      startRow: Math.min(...rows),
      endRow: Math.max(...rows),
      startCol: Math.min(...cols),
      endCol: Math.max(...cols),
      rowSpan: Math.max(...rows) - Math.min(...rows) + 1,
      colSpan: Math.max(...cols) - Math.min(...cols) + 1
    };
  };

  const getCoilInfo = (barcode) => {
    if (!barcode) return null;
    return coils.find(c => c.barcode === barcode);
  };

  const renderPositionCard = (position, showSupports = true) => {
    const coilInfo = getCoilInfo(position.coil_barcode);
    const isSelected = selectedPositionId === position.id;
    const isOccupied = !!position.coil_barcode;
    const isClickable = !isReadOnly || isOccupied;

    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        onClick={() => isClickable && onPositionClick && onPositionClick(position)}
        className={`
          h-full p-3 rounded-lg border-2 transition-all
          ${isClickable ? 'cursor-pointer hover:shadow-xl hover:scale-105' : 'cursor-default'}
          ${isSelected ? 'border-blue-600 bg-blue-50 ring-4 ring-blue-300 z-10' : 
            isOccupied ? 'border-orange-400 bg-orange-50 hover:border-orange-500' : 
            'border-slate-300 bg-white hover:border-blue-400'}
        `}
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-2">
          <div className="flex-1 min-w-0">
            <div className="font-mono font-bold text-xs text-blue-900 mb-1 break-all">
              {position.placeholder_id}
            </div>
            <div className="flex items-center gap-1">
              <Badge variant="outline" className="text-[10px] px-1 py-0">
                L{position.layer}
              </Badge>
              {position.type === 'bridging' && (
                <Badge variant="secondary" className="text-[10px] px-1 py-0">
                  Bridge
                </Badge>
              )}
            </div>
          </div>
          <Badge className={`text-[10px] ${isOccupied ? 'bg-orange-600' : 'bg-emerald-600'} text-white`}>
            {isOccupied ? 'Full' : 'Empty'}
          </Badge>
        </div>

        {/* Supporting Locations (for upper layers) */}
        {showSupports && position.layer > 1 && (
          <div className="mb-2 pb-2 border-b border-slate-200">
            <div className="flex items-center gap-1 mb-1">
              <ArrowDown className="w-3 h-3 text-slate-400" />
              <span className="text-[9px] text-slate-500 font-medium">Spans across:</span>
            </div>
            <div className="flex flex-wrap gap-1">
              {position.supported_by_ground_location_codes.map((code, idx) => (
                <Badge key={idx} variant="outline" className="text-[8px] px-1 py-0">
                  {code}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Coil Information */}
        {isOccupied && coilInfo && (
          <div className="space-y-1">
            <div className="flex items-center gap-1">
              <Package className="w-3 h-3 text-orange-600" />
              <span className="font-mono font-bold text-[10px] text-slate-900 truncate">
                {position.coil_barcode}
              </span>
            </div>
            <div className="text-[9px] text-slate-600 space-y-0.5">
              <div><span className="text-slate-500">Weight:</span> <span className="font-medium">{coilInfo.weight}t</span></div>
              {coilInfo.coil_type && (
                <div><span className="text-slate-500">Type:</span> <span className="font-medium">{coilInfo.coil_type}</span></div>
              )}
            </div>
          </div>
        )}
      </motion.div>
    );
  };

  const renderLayerGrid = (layer) => {
    const positions = positionsByLayer[layer];
    if (positions.length === 0) return null;

    if (layer === 1 && groundGrid.grid.length > 0) {
      // Ground layer - show as grid
      return (
        <div 
          className="grid gap-3 p-4 bg-slate-50 rounded-lg"
          style={{ 
            gridTemplateColumns: `repeat(${groundGrid.cols}, minmax(200px, 1fr))`,
          }}
        >
          {groundGrid.grid.flat().map((pos, idx) => (
            <div key={idx} className="min-h-[140px]">
              {pos ? renderPositionCard(pos, false) : (
                <div className="h-full border-2 border-dashed border-slate-200 rounded-lg bg-slate-50" />
              )}
            </div>
          ))}
        </div>
      );
    } else if (layer > 1 && groundGrid.rows > 0 && groundGrid.cols > 0) {
      // Upper layers - show spanning over ground grid
      return (
        <div 
          className="relative p-4 bg-slate-50 rounded-lg"
          style={{ 
            display: 'grid',
            gridTemplateColumns: `repeat(${groundGrid.cols}, minmax(200px, 1fr))`,
            gridTemplateRows: `repeat(${groundGrid.rows}, minmax(140px, auto))`,
            gap: '12px'
          }}
        >
          {/* Show ground grid outline */}
          {groundGrid.grid.flat().map((pos, idx) => (
            <div 
              key={`outline-${idx}`}
              className="border border-dashed border-slate-300 rounded bg-white/50"
            />
          ))}

          {/* Overlay upper layer positions */}
          {positions.map(pos => {
            const span = getPositionSpan(pos);
            if (!span) return null;

            return (
              <div
                key={pos.id}
                style={{
                  gridColumn: `${span.startCol + 1} / span ${span.colSpan}`,
                  gridRow: `${span.startRow + 1} / span ${span.rowSpan}`,
                  position: 'relative',
                  zIndex: 10
                }}
              >
                {renderPositionCard(pos, true)}
              </div>
            );
          })}
        </div>
      );
    } else {
      // Fallback to simple list
      return (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {positions.map(pos => (
            <div key={pos.id} className="min-h-[140px]">
              {renderPositionCard(pos)}
            </div>
          ))}
        </div>
      );
    }
  };

  const getLayerStats = (layer) => {
    const positions = positionsByLayer[layer];
    const occupied = positions.filter(p => p.coil_barcode).length;
    return { total: positions.length, occupied };
  };

  return (
    <div className="space-y-8">
      {/* Layer 3 - Top Level */}
      {positionsByLayer[3].length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-3 px-2">
            <div className="w-2 h-8 bg-purple-500 rounded"></div>
            <div className="flex-1">
              <h3 className="font-bold text-lg text-slate-900">Layer 3 - Top Bridging Level</h3>
              <p className="text-sm text-slate-500">Coils bridging across Layer 2 positions</p>
            </div>
            <Badge variant="outline" className="text-sm">
              {getLayerStats(3).occupied} / {getLayerStats(3).total} Occupied
            </Badge>
          </div>
          {renderLayerGrid(3)}
        </div>
      )}

      {/* Layer 2 - Middle Bridging Level */}
      {positionsByLayer[2].length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-3 px-2">
            <div className="w-2 h-8 bg-blue-500 rounded"></div>
            <div className="flex-1">
              <h3 className="font-bold text-lg text-slate-900">Layer 2 - Bridging Level</h3>
              <p className="text-sm text-slate-500">Coils bridging across ground positions</p>
            </div>
            <Badge variant="outline" className="text-sm">
              {getLayerStats(2).occupied} / {getLayerStats(2).total} Occupied
            </Badge>
          </div>
          {renderLayerGrid(2)}
        </div>
      )}

      {/* Layer 1 - Ground Level */}
      {positionsByLayer[1].length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-3 px-2">
            <div className="w-2 h-8 bg-emerald-500 rounded"></div>
            <div className="flex-1">
              <h3 className="font-bold text-lg text-slate-900">Layer 1 - Ground Level</h3>
              <p className="text-sm text-slate-500">Foundation positions on the ground</p>
            </div>
            <Badge variant="outline" className="text-sm">
              {getLayerStats(1).occupied} / {getLayerStats(1).total} Occupied
            </Badge>
          </div>
          {renderLayerGrid(1)}
        </div>
      )}

      {/* Empty State */}
      {positionsByLayer[1].length === 0 && positionsByLayer[2].length === 0 && positionsByLayer[3].length === 0 && (
        <div className="text-center py-12 text-slate-500">
          <Layers className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No stacking positions configured for this location.</p>
          <p className="text-xs mt-1">Create positions in the Masters page.</p>
        </div>
      )}

      {/* Legend */}
      <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4">
        <h4 className="font-semibold text-sm text-slate-900 mb-3 flex items-center gap-2">
          <Layers className="w-4 h-4" />
          Understanding Layer Positions
        </h4>
        <div className="space-y-2 text-xs text-slate-700">
          <div className="flex items-start gap-2">
            <div className="w-4 h-4 bg-emerald-100 border-2 border-emerald-500 rounded flex-shrink-0 mt-0.5"></div>
            <div>
              <strong>Ground Level (Layer 1):</strong> Base positions directly on the ground. Each ground location can hold one coil.
            </div>
          </div>
          <div className="flex items-start gap-2">
            <div className="w-4 h-4 bg-blue-100 border-2 border-blue-500 rounded flex-shrink-0 mt-0.5"></div>
            <div>
              <strong>Bridging Level (Layer 2):</strong> Coils placed across 2-3 ground positions. The coil physically spans and is supported by the coils below.
            </div>
          </div>
          <div className="flex items-start gap-2">
            <div className="w-4 h-4 bg-purple-100 border-2 border-purple-500 rounded flex-shrink-0 mt-0.5"></div>
            <div>
              <strong>Top Level (Layer 3):</strong> Additional bridging layer on top of Layer 2 positions.
            </div>
          </div>
          <div className="mt-3 p-2 bg-amber-50 border border-amber-200 rounded">
            <strong>⚠️ Important:</strong> Upper layer positions can only be filled if all supporting lower layer positions are occupied.
          </div>
        </div>
      </div>
    </div>
  );
}