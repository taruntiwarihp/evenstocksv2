import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import '../styles/Header.css';

const Header = () => {
  const { isLoggedIn, logout } = useAuth();
  const { isDark } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    if (mobileNavOpen) {
      document.body.classList.add('mobile-nav-active');
    } else {
      document.body.classList.remove('mobile-nav-active');
    }
    return () => document.body.classList.remove('mobile-nav-active');
  }, [mobileNavOpen]);

  const isActive = (path) => {
    if (path === '/' && location.pathname === '/') return 'active';
    if (path !== '/' && location.pathname.startsWith(path)) return 'active';
    return '';
  };

  const scrollToSection = (e, sectionId) => {
    e.preventDefault();
    setMobileNavOpen(false);
    if (location.pathname !== '/') {
      navigate('/', { state: { scrollTo: sectionId } });
      return;
    }
    const el = document.getElementById(sectionId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <header id="header" className={`header d-flex align-items-center fixed-top ${scrolled ? 'scrolled' : ''} ${isDark ? 'header-dark' : ''}`}>
      <div className="header-container container-fluid container-xl position-relative d-flex align-items-center justify-content-between">
        <Link to="/" className="logo">
          <img
            src={isDark ? '/assets/img/logo-horizontal-white.png' : '/assets/img/logo-horizontal.png'}
            alt="Even Stocks"
            className="logo-img"
          />
        </Link>

        <nav id="navmenu" className="navmenu">
          <ul>
            <li><Link to="/" className={isActive('/')} onClick={() => setMobileNavOpen(false)}>Home</Link></li>
            <li><Link to="/ai-tools" className={isActive('/ai-tools')} onClick={() => setMobileNavOpen(false)}><i className="bi bi-cpu"></i> AI Tools</Link></li>
            <li><a href="#about" onClick={(e) => scrollToSection(e, 'about')}>About</a></li>
            <li><a href="#pricing" onClick={(e) => scrollToSection(e, 'pricing')}>Pricing</a></li>
            <li><a href="#contact" onClick={(e) => scrollToSection(e, 'contact')}>Contact</a></li>
          </ul>
        </nav>

        <div className="d-flex align-items-center gap-2">
          {isLoggedIn ? (
            <div className="user-dropdown">
              <span className="user-icon" style={{ fontSize: '20px', cursor: 'pointer', color: '#02634D' }}>
                <i className="fa fa-user" aria-hidden="true"></i>
              </span>
              <div className="dropdown-content">
                <Link to="/admins">My Profile</Link>
                <button onClick={logout} style={{ background: 'none', border: 'none', padding: '10px 15px', cursor: 'pointer', width: '100%', textAlign: 'left', color: '#333' }}>
                  Logout
                </button>
              </div>
            </div>
          ) : (
            <>
              <Link className="btn-getstarted" to="/login">Login</Link>
              <Link className="btn-getstarted" to="/signup">Sign Up</Link>
            </>
          )}
          <i
            className={`mobile-nav-toggle d-xl-none bi ${mobileNavOpen ? 'bi-x' : 'bi-list'}`}
            onClick={() => setMobileNavOpen(!mobileNavOpen)}
          ></i>
        </div>
      </div>
    </header>
  );
};

export default Header;
