import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';

// Pages
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import AdminDashboard from './pages/AdminDashboard';
import CheckoutPage from './pages/CheckoutPage';
import PrivacyPage from './pages/PrivacyPage';
import TermsPage from './pages/TermsPage';
import RazorpayPayment from './pages/RazorpayPayment';
import ChatBotPage from './pages/ChatBotPage';
import ChatBotPageEnhanced from './pages/ChatBotPageEnhanced';
import ChatBotPageFinal from './pages/ChatBotPageFinal';
import StockDetailPage from './pages/StockDetailPage';
import IrisPage from './pages/IrisPage';
import ProfilePage from './pages/ProfilePage';
import AiToolsPage from './pages/AiToolsPage';

// Protected Route wrapper
const ProtectedRoute = ({ children }) => {
  const { isLoggedIn } = useAuth();
  if (!isLoggedIn) {
    return <Navigate to="/login" replace />;
  }
  return children;
};

// Redirect if already logged in
const GuestRoute = ({ children }) => {
  const { isLoggedIn } = useAuth();
  if (isLoggedIn) {
    return <Navigate to="/admins" replace />;
  }
  return children;
};

const AppRoutes = () => {
  return (
    <Routes>
      <Route path="/" element={<ChatBotPageFinal />} />
      <Route path="/dashboard" element={<HomePage />} />
      <Route path="/login" element={<GuestRoute><LoginPage /></GuestRoute>} />
      <Route path="/signup" element={<GuestRoute><SignupPage /></GuestRoute>} />
      <Route path="/admins" element={<ProtectedRoute><AdminDashboard /></ProtectedRoute>} />
      <Route path="/admins/index" element={<ProtectedRoute><AdminDashboard /></ProtectedRoute>} />
      <Route path="/checkout" element={<CheckoutPage />} />
      <Route path="/privacy" element={<PrivacyPage />} />
      <Route path="/terms" element={<TermsPage />} />
      <Route path="/razorpay" element={<ProtectedRoute><RazorpayPayment /></ProtectedRoute>} />
      <Route path="/chatbot" element={<ChatBotPageFinal />} />
      <Route path="/stock/:stockName" element={<StockDetailPage />} />
      <Route path="/iris" element={<IrisPage />} />
      <Route path="/profile" element={<ProfilePage />} />
      <Route path="/ai-tools" element={<AiToolsPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

const App = () => {
  return (
    <ThemeProvider>
      <AuthProvider>
        <Router>
          <AppRoutes />
        </Router>
      </AuthProvider>
    </ThemeProvider>
  );
};

export default App;
