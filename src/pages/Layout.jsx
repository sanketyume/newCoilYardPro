

import React from "react";
import { Link, useLocation } from "react-router-dom";
import { createPageUrl } from "@/utils";
import {
  Package,
  LayoutGrid,
  ArrowLeftRight,
  TruckIcon, // This icon is imported but not used in the original snippet. Keeping it for consistency.
  BarChart3,
  Settings,
  ClipboardList,
  LogOut,
  Map,
  Ship,
  ClipboardCheck as InspectionIcon,
  Send,
  RefreshCw // Added RefreshCw icon for Yard Reconciliation
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import NetworkStatusMonitor from "@/components/network/NetworkStatusMonitor";

const navigationItems = [
  {
    title: "Dashboard",
    url: createPageUrl("Dashboard"),
    icon: BarChart3,
  },
  {
    title: "Yard Layout",
    url: createPageUrl("YardLayout"),
    icon: Map,
  },
  {
    title: "Coil Receipt",
    url: createPageUrl("CoilReceipt"),
    icon: Package,
  },
  {
    title: "Storage Assignment",
    url: createPageUrl("StorageAssignment"),
    icon: LayoutGrid,
  },
  {
    title: "Coil Shuffling",
    url: createPageUrl("CoilShuffling"),
    icon: ArrowLeftRight,
  },
  {
    title: "Shipments",
    url: createPageUrl("Deliveries"),
    icon: Ship,
  },
  {
    title: "Outgoing Inspection",
    url: createPageUrl("OutgoingInspection"),
    icon: InspectionIcon,
  },
   {
    title: "Dispatch",
    url: createPageUrl("Dispatch"),
    icon: Send,
  },
  {
    title: "Stock Taking",
    url: createPageUrl("StockTaking"),
    icon: ClipboardList,
  },
  {
    title: "Yard Reconciliation",
    url: createPageUrl("YardReconciliation"),
    icon: RefreshCw,
  },
  {
    title: "Masters",
    url: createPageUrl("Masters"),
    icon: Settings,
  },
];

export default function Layout({ children, currentPageName }) {
  const location = useLocation();
  const [user, setUser] = React.useState(null);

  const { data: companyProfile } = useQuery({
      queryKey: ['companyProfile'],
      queryFn: async () => {
          const results = await base44.entities.CompanyProfile.list();
          return results[0] || null;
      },
      staleTime: Infinity,
      retry: 3,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      onError: (error) => {
        console.error('Error loading company profile:', error);
      }
  });

  React.useEffect(() => {
    const loadUser = async () => {
      try {
        const currentUser = await base44.auth.me();
        setUser(currentUser);
      } catch (error) {
        console.log("User not logged in or network error");
      }
    };
    loadUser();
  }, []);

  const handleLogout = () => {
    base44.auth.logout();
  };
  
  const currentYear = new Date().getFullYear();

  return (
    <SidebarProvider>
      <style>{`
        :root {
          --primary: 30 58 138;
          --primary-foreground: 248 250 252;
          --secondary: 5 150 105;
          --accent: 234 88 12;
          --muted: 241 245 249;
        }
        
        /* Fix dropdown selected item contrast */
        [data-radix-select-viewport] [data-state="checked"],
        [data-radix-select-viewport] [data-highlighted] {
          background-color: rgb(30 58 138) !important;
          color: white !important;
        }
        
        [data-radix-select-viewport] [data-highlighted] {
          outline: none;
        }
        
        /* Ensure proper text contrast in all select items */
        [role="option"] {
          color: rgb(15 23 42);
        }
        
        [role="option"][data-state="checked"],
        [role="option"][data-highlighted] {
          color: white !important;
        }
      `}</style>
      <NetworkStatusMonitor />
      <div className="min-h-screen flex w-full bg-slate-50">
        <Sidebar className="border-r border-slate-200 bg-white">
          <SidebarHeader className="border-b border-slate-200 p-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center overflow-hidden">
                {companyProfile?.company_logo_url ? (
                  <img src={companyProfile.company_logo_url} alt="Company Logo" className="w-full h-full object-contain" />
                ) : (
                  <Ship className="w-6 h-6 text-slate-500" />
                )}
              </div>
              <div>
                <h2 className="font-bold text-slate-900 text-lg">{companyProfile?.company_name || 'CoilYard Pro'}</h2>
                <p className="text-xs text-slate-500">Delivery Management</p>
              </div>
            </div>
          </SidebarHeader>
          
          <SidebarContent className="p-3">
            <SidebarGroup>
              <SidebarGroupLabel className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-3 py-2">
                Operations
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {navigationItems.map((item) => (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton 
                        asChild 
                        className={`hover:bg-blue-50 hover:text-blue-900 transition-all duration-200 rounded-lg mb-1 ${
                          location.pathname === item.url ? 'bg-blue-900 text-white hover:bg-blue-900 hover:text-white' : ''
                        }`}
                      >
                        <Link to={item.url} className="flex items-center gap-3 px-3 py-2.5">
                          <item.icon className="w-4 h-4" />
                          <span className="font-medium text-sm">{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>

          <SidebarFooter className="border-t border-slate-200 p-4">
            {user ? (
              <div className="space-y-3">
                <div className="flex items-center gap-3 px-2">
                  <div className="w-9 h-9 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-full flex items-center justify-center">
                    <span className="text-white font-semibold text-sm">
                      {user.full_name?.[0]?.toUpperCase() || 'U'}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-slate-900 text-sm truncate">{user.full_name}</p>
                    <p className="text-xs text-slate-500 truncate">{user.email}</p>
                  </div>
                </div>
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition-colors duration-200"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Sign Out</span>
                </button>
              </div>
            ) : (
                <div className="text-center text-xs text-slate-500">
                    <p>&copy; {currentYear} {companyProfile?.company_name || 'Your Company'}.</p>
                    {companyProfile && companyProfile.developer_name && companyProfile.platform_name && (
                        <p>
                            Developed by {companyProfile.developer_name} based on {companyProfile.platform_name}.
                        </p>
                    )}
              </div>
            )}
          </SidebarFooter>
        </Sidebar>

        <main className="flex-1 flex flex-col">
          <header className="bg-white border-b border-slate-200 px-6 py-4 lg:hidden">
            <div className="flex items-center gap-4">
              <SidebarTrigger className="hover:bg-slate-100 p-2 rounded-lg transition-colors duration-200" />
              <h1 className="text-lg font-semibold text-slate-900">{companyProfile?.company_name || 'CoilYard'}</h1>
            </div>
          </header>

          <div className="flex-1 overflow-auto">
            {children}
          </div>
          
          <footer className="hidden lg:block text-center p-4 text-xs text-slate-500 border-t bg-white">
             <p>&copy; {currentYear} {companyProfile?.company_name || 'Your Company'}. All rights reserved.</p>
             {companyProfile && companyProfile.developer_name && companyProfile.platform_name && (
                <p>
                    Developed by {companyProfile.developer_name} based on {companyProfile.platform_name}.
                </p>
             )}
          </footer>
        </main>
      </div>
    </SidebarProvider>
  );
}

