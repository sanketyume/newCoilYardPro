
import React from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Package,
  MapPin,
  TrendingUp,
  AlertTriangle,
  Clock,
  Activity,
  Layers
} from "lucide-react";
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from "recharts";
import { differenceInDays } from "date-fns";

const REFRESH_INTERVAL = 10000; // 10 seconds

export default function Dashboard() {
  const { data: coils = [], isRefetching: isRefetchingCoils } = useQuery({
    queryKey: ['coils'],
    queryFn: () => base44.entities.Coil.list(),
    refetchInterval: REFRESH_INTERVAL,
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    onError: (error) => {
      console.error('Error loading coils:', error);
    }
  });

  const { data: stackingPositions = [], isRefetching: isRefetchingPositions } = useQuery({
    queryKey: ['stackingPositions'],
    queryFn: () => base44.entities.StackingPosition.list(),
    refetchInterval: REFRESH_INTERVAL,
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    onError: (error) => {
      console.error('Error loading stacking positions:', error);
    }
  });

  const { data: movements = [], isRefetching: isRefetchingMovements } = useQuery({
    queryKey: ['movements'],
    queryFn: () => base44.entities.CoilMovement.list('-movement_date', 100),
    refetchInterval: REFRESH_INTERVAL,
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    onError: (error) => {
      console.error('Error loading movements:', error);
    }
  });
  
  const isRefetching = isRefetchingCoils || isRefetchingPositions || isRefetchingMovements;

  // Calculate metrics
  const totalCoils = coils.length;
  const totalWeight = coils.reduce((sum, c) => sum + (c.weight || 0), 0);
  
  // Stacking position utilization
  const activePositions = stackingPositions.filter(p => p.is_active);
  const occupiedPositions = activePositions.filter(p => p.coil_barcode);
  const utilizationPercent = activePositions.length > 0 
    ? (occupiedPositions.length / activePositions.length * 100) 
    : 0;

  // High age coils (>30 days)
  const highAgeCoils = coils.filter(c => {
    if (!c.received_date) return false;
    const days = differenceInDays(new Date(), new Date(c.received_date));
    return days > 30;
  });

  // Shuffling activity by location
  const shufflingByLocation = movements
    .filter(m => m.movement_type === 'shuffle')
    .reduce((acc, m) => {
      const loc = m.from_location || 'Unknown';
      acc[loc] = (acc[loc] || 0) + 1;
      return acc;
    }, {});

  const topShufflingLocations = Object.entries(shufflingByLocation)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([location, count]) => ({ location, count }));

  // Status distribution
  const statusData = coils.reduce((acc, c) => {
    const status = c.status || 'unknown';
    acc[status] = (acc[status] || 0) + 1;
    return acc;
  }, {});

  const pieData = Object.entries(statusData).map(([name, value]) => ({
    name: name.replace(/_/g, ' '),
    value
  }));

  // Layer distribution
  const layerDistribution = occupiedPositions.reduce((acc, pos) => {
    const layer = `Layer ${pos.layer}`;
    acc[layer] = (acc[layer] || 0) + 1;
    return acc;
  }, {});

  const layerData = Object.entries(layerDistribution).map(([name, value]) => ({
    name,
    value
  }));

  const COLORS = ['#1e3a8a', '#059669', '#ea580c', '#7c3aed', '#06b6d4'];

  return (
    <div className="p-6 lg:p-8 bg-slate-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <div className="flex items-center gap-4">
            <h1 className="text-3xl font-bold text-slate-900">Yard Dashboard</h1>
            <div className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full bg-emerald-500 ${isRefetching ? 'animate-pulse' : ''}`}></div>
                <span className="text-sm font-medium text-emerald-700">Live</span>
            </div>
          </div>
          <p className="text-slate-600 mt-2">Real-time overview of your coil yard operations with stacking positions</p>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card className="border-none shadow-lg bg-gradient-to-br from-blue-900 to-blue-700 text-white">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium opacity-90">Total Coils</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-3xl font-bold">{totalCoils}</p>
                  <p className="text-sm opacity-75 mt-1">{totalWeight.toFixed(2)} tons</p>
                </div>
                <Package className="w-12 h-12 opacity-30" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-lg bg-gradient-to-br from-emerald-600 to-emerald-500 text-white">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium opacity-90">Position Utilization</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-3xl font-bold">{utilizationPercent.toFixed(1)}%</p>
                  <p className="text-sm opacity-75 mt-1">{occupiedPositions.length}/{activePositions.length} positions</p>
                </div>
                <Layers className="w-12 h-12 opacity-30" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-lg bg-gradient-to-br from-orange-600 to-orange-500 text-white">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium opacity-90">High Age Coils</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-3xl font-bold">{highAgeCoils.length}</p>
                  <p className="text-sm opacity-75 mt-1">&gt;30 days in yard</p>
                </div>
                <Clock className="w-12 h-12 opacity-30" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-lg bg-gradient-to-br from-purple-600 to-purple-500 text-white">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium opacity-90">Recent Movements</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-3xl font-bold">{movements.length}</p>
                  <p className="text-sm opacity-75 mt-1">Last 100 records</p>
                </div>
                <Activity className="w-12 h-12 opacity-30" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Charts */}
        <div className="grid lg:grid-cols-2 gap-6 mb-8">
          <Card className="shadow-lg border-none">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-blue-900" />
                Coil Status Distribution
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="shadow-lg border-none">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Layers className="w-5 h-5 text-purple-600" />
                Coils by Layer
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={layerData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="value" fill="#7c3aed" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="shadow-lg border-none">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-orange-600" />
                Top Shuffling Locations
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={topShufflingLocations}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="location" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="count" fill="#ea580c" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="shadow-lg border-none">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="w-5 h-5 text-emerald-600" />
                Stacking Position Summary
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-emerald-50 rounded-lg">
                  <div>
                    <p className="text-sm text-slate-600">Total Positions</p>
                    <p className="text-2xl font-bold text-slate-900">{activePositions.length}</p>
                  </div>
                  <Layers className="w-10 h-10 text-emerald-600 opacity-50" />
                </div>
                <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg">
                  <div>
                    <p className="text-sm text-slate-600">Occupied Positions</p>
                    <p className="text-2xl font-bold text-slate-900">{occupiedPositions.length}</p>
                  </div>
                  <Package className="w-10 h-10 text-blue-600 opacity-50" />
                </div>
                <div className="flex items-center justify-between p-4 bg-orange-50 rounded-lg">
                  <div>
                    <p className="text-sm text-slate-600">Empty Positions</p>
                    <p className="text-2xl font-bold text-slate-900">{activePositions.length - occupiedPositions.length}</p>
                  </div>
                  <MapPin className="w-10 h-10 text-orange-600 opacity-50" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* High Age Locations Alert */}
        {highAgeCoils.length > 0 && (
          <Card className="shadow-lg border-l-4 border-l-orange-600">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-orange-900">
                <AlertTriangle className="w-5 h-5" />
                Attention: High Age Coils Detected
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {highAgeCoils.slice(0, 5).map(coil => {
                  const daysInYard = differenceInDays(new Date(), new Date(coil.received_date));
                  const position = coil.current_stacking_position_id
                    ? stackingPositions.find(p => p.id === coil.current_stacking_position_id)
                    : null;
                  
                  return (
                    <div key={coil.id} className="flex items-center justify-between p-3 bg-orange-50 rounded-lg">
                      <div>
                        <p className="font-semibold text-slate-900">{coil.barcode}</p>
                        <p className="text-sm text-slate-600">
                          Position: {position?.placeholder_id || 'Not assigned'}
                          {position && ` (Layer ${position.layer})`}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-orange-600">{daysInYard} days</p>
                        <p className="text-xs text-slate-500">Priority: {coil.priority}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
