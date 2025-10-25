import Layout from "./Layout.jsx";

import Dashboard from "./Dashboard";

import CoilReceipt from "./CoilReceipt";

import StorageAssignment from "./StorageAssignment";

import CoilShuffling from "./CoilShuffling";

import StockTaking from "./StockTaking";

import Masters from "./Masters";

import YardLayout from "./YardLayout";

import Deliveries from "./Deliveries";

import ShipmentDetails from "./ShipmentDetails";

import OutgoingInspection from "./OutgoingInspection";

import Dispatch from "./Dispatch";

import YardReconciliation from "./YardReconciliation";

import { BrowserRouter as Router, Route, Routes, useLocation } from 'react-router-dom';

const PAGES = {
    
    Dashboard: Dashboard,
    
    CoilReceipt: CoilReceipt,
    
    StorageAssignment: StorageAssignment,
    
    CoilShuffling: CoilShuffling,
    
    StockTaking: StockTaking,
    
    Masters: Masters,
    
    YardLayout: YardLayout,
    
    Deliveries: Deliveries,
    
    ShipmentDetails: ShipmentDetails,
    
    OutgoingInspection: OutgoingInspection,
    
    Dispatch: Dispatch,
    
    YardReconciliation: YardReconciliation,
    
}

function _getCurrentPage(url) {
    if (url.endsWith('/')) {
        url = url.slice(0, -1);
    }
    let urlLastPart = url.split('/').pop();
    if (urlLastPart.includes('?')) {
        urlLastPart = urlLastPart.split('?')[0];
    }

    const pageName = Object.keys(PAGES).find(page => page.toLowerCase() === urlLastPart.toLowerCase());
    return pageName || Object.keys(PAGES)[0];
}

// Create a wrapper component that uses useLocation inside the Router context
function PagesContent() {
    const location = useLocation();
    const currentPage = _getCurrentPage(location.pathname);
    
    return (
        <Layout currentPageName={currentPage}>
            <Routes>            
                
                    <Route path="/" element={<Dashboard />} />
                
                
                <Route path="/Dashboard" element={<Dashboard />} />
                
                <Route path="/CoilReceipt" element={<CoilReceipt />} />
                
                <Route path="/StorageAssignment" element={<StorageAssignment />} />
                
                <Route path="/CoilShuffling" element={<CoilShuffling />} />
                
                <Route path="/StockTaking" element={<StockTaking />} />
                
                <Route path="/Masters" element={<Masters />} />
                
                <Route path="/YardLayout" element={<YardLayout />} />
                
                <Route path="/Deliveries" element={<Deliveries />} />
                
                <Route path="/ShipmentDetails" element={<ShipmentDetails />} />
                
                <Route path="/OutgoingInspection" element={<OutgoingInspection />} />
                
                <Route path="/Dispatch" element={<Dispatch />} />
                
                <Route path="/YardReconciliation" element={<YardReconciliation />} />
                
            </Routes>
        </Layout>
    );
}

export default function Pages() {
    return (
        <Router>
            <PagesContent />
        </Router>
    );
}