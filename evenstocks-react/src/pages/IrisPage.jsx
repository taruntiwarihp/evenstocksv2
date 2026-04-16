import React from 'react';
import { useNavigate } from 'react-router-dom';
import IrisChatbot from '../components/IrisChatbot';
import '../styles/IrisPage.css';

const IrisPage = () => {
  const navigate = useNavigate();

  return (
    <div className="iris-page">
      <div className="iris-page-header">
        <button className="back-btn" onClick={() => navigate('/')} title="Back to Home">
          ← Back to Home
        </button>
        <div className="iris-page-title">
          <img src="/assets/img/logo-icon.png" alt="EvenStocks" className="iris-logo" />
          <h1>Iris - AI Stock Analyst</h1>
        </div>
      </div>

      <IrisChatbot />
    </div>
  );
};

export default IrisPage;
