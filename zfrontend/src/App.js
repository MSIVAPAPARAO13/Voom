import './App.css';
import { Route, BrowserRouter as Router, Routes } from 'react-router-dom';
import LandingPage from './pages/landing';
import Authentication from './pages/authentication';
import { AuthProvider } from './contexts/AuthContext';
import { OrganizationProvider } from './contexts/OrganizationContext';
import VideoMeetComponent from './pages/VideoMeet';
import HomeComponent from './pages/home';
import History from './pages/history';
import OrganizationManagement from './pages/OrganizationManagement';
import AskVoom from './pages/AskVoom';
import { useEffect } from 'react';

function App() {
  useEffect(() => {
    // Lightweight Global Frontend Error Visibility
    const errorHandler = (event) => {
      console.error("[Runtime Error]", event.error || event.message);
    };
    
    const promiseRejectionHandler = (event) => {
      console.error("[Unhandled Promise Rejection]", event.reason);
    };

    window.addEventListener("error", errorHandler);
    window.addEventListener("unhandledrejection", promiseRejectionHandler);

    return () => {
      window.removeEventListener("error", errorHandler);
      window.removeEventListener("unhandledrejection", promiseRejectionHandler);
    };
  }, []);

  return (
    <div className="App">
      <Router>
        <AuthProvider>
          <OrganizationProvider>
            <Routes>
              <Route path='/' element={<LandingPage />} />
              <Route path='/auth' element={<Authentication />} />
              <Route path='/home' element={<HomeComponent />} />
              <Route path='/history' element={<History />} />
              <Route path='/organization' element={<OrganizationManagement />} />
              <Route path='/ask' element={<AskVoom />} />
              <Route path='/:url' element={<VideoMeetComponent />} />

            </Routes>
          </OrganizationProvider>
        </AuthProvider>
      </Router>
    </div>
  );
}

export default App;