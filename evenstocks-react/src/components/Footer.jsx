import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';

const Footer = () => {
  const { isDark } = useTheme();
  const [showScrollTop, setShowScrollTop] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 300);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToTop = (e) => {
    e.preventDefault();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <>
      <footer id="footer" className={`footer${isDark ? ' footer-dark' : ''}`}>
        <div className="container footer-top">
          <div className="row gy-4">
            {/* About Column */}
            <div className="col-lg-4 col-md-6 footer-about">
              <Link to="/" className="logo">
                <img src="/assets/img/logo-horizontal.png" alt="EvenStocks" style={{ maxHeight: '45px' }} />
              </Link>
              <p>
                AI-powered stock research platform for the Indian market. Get real-time insights, technical analysis, and smart recommendations for 5,300+ NSE & BSE stocks.
              </p>
              <div className="social-links">
                <a href="https://x.com/EvenStocks" target="_blank" rel="noopener noreferrer" aria-label="Twitter/X"><i className="bi bi-twitter-x"></i></a>
                <a href="https://www.linkedin.com/company/evenstocks" target="_blank" rel="noopener noreferrer" aria-label="LinkedIn"><i className="bi bi-linkedin"></i></a>
                <a href="https://www.instagram.com/evenstocks" target="_blank" rel="noopener noreferrer" aria-label="Instagram"><i className="bi bi-instagram"></i></a>
                <a href="https://www.youtube.com/@EvenStocks" target="_blank" rel="noopener noreferrer" aria-label="YouTube"><i className="bi bi-youtube"></i></a>
              </div>
            </div>

            {/* Quick Links */}
            <div className="col-lg-2 col-md-3 footer-links">
              <h4>Quick Links</h4>
              <ul>
                <li><i className="bi bi-chevron-right"></i> <a href="#hero">Home</a></li>
                <li><i className="bi bi-chevron-right"></i> <a href="#about">About Us</a></li>
                <li><i className="bi bi-chevron-right"></i> <a href="#pricing">Pricing</a></li>
                <li><i className="bi bi-chevron-right"></i> <a href="#faq">FAQ</a></li>
                <li><i className="bi bi-chevron-right"></i> <a href="#contact">Contact</a></li>
              </ul>
            </div>

            {/* Resources */}
            <div className="col-lg-2 col-md-3 footer-links">
              <h4>Resources</h4>
              <ul>
                <li><i className="bi bi-chevron-right"></i> <Link to="/chatbot">AI Chatbot</Link></li>
                <li><i className="bi bi-chevron-right"></i> <Link to="/privacy">Privacy Policy</Link></li>
                <li><i className="bi bi-chevron-right"></i> <Link to="/terms">Terms & Conditions</Link></li>
                <li><i className="bi bi-chevron-right"></i> <Link to="/signup">Sign Up</Link></li>
              </ul>
            </div>

            {/* Contact Info */}
            <div className="col-lg-4 col-md-6 footer-contact">
              <h4>Contact Us</h4>
              <p><i className="bi bi-geo-alt me-2"></i> Andheri East, Mumbai, Maharashtra 400069</p>
              <p><i className="bi bi-telephone me-2"></i> +91 9509526580</p>
              <p><i className="bi bi-envelope me-2"></i> info@evenstocks.com</p>
            </div>
          </div>
        </div>

        <div className="container copyright text-center mt-4">
          <p>
            &copy; {new Date().getFullYear()}{' '}
            <strong className="px-1 sitename">EvenStocks</strong>{' '}
            All Rights Reserved
          </p>
        </div>
      </footer>

      <a
        href="#"
        id="scroll-top"
        className={`scroll-top d-flex align-items-center justify-content-center ${showScrollTop ? 'active' : ''}`}
        onClick={scrollToTop}
        style={{
          opacity: showScrollTop ? 1 : 0,
          visibility: showScrollTop ? 'visible' : 'hidden',
          transition: 'opacity 0.3s, visibility 0.3s',
        }}
      >
        <i className="bi bi-arrow-up-short"></i>
      </a>
    </>
  );
};

export default Footer;
