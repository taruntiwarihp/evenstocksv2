import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { submitContact, createOrder } from '../services/api';
import Header from '../components/Header';
import Footer from '../components/Footer';
import EntryModal from '../components/EntryModal';
import LoginPopup from '../components/LoginPopup';
import FloatingChat from '../components/FloatingChat';
import PureCounter from '@srexi/purecounterjs';
import '../styles/HomePage.css';

const typewriterPhrases = [
  'Smarter Decisions',
  'Better Returns',
  'Real-Time Insights',
  'Confident Investing',
];

const HomePage = () => {
  const { isLoggedIn, user } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [showEntryModal, setShowEntryModal] = useState(false);
  const [showLoginPopup, setShowLoginPopup] = useState(false);
  const [userMessage, setUserMessage] = useState('');
  const [contactForm, setContactForm] = useState({ name: '', email: '', subject: '', message: '' });
  const [contactMessage, setContactMessage] = useState(null);
  const [contactSubmitting, setContactSubmitting] = useState(false);
  const [loadingOverlay, setLoadingOverlay] = useState(false);
  const timelineRef = useRef(null);
  const [typedText, setTypedText] = useState('');
  const [phraseIndex, setPhraseIndex] = useState(0);
  const [charIndex, setCharIndex] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);

  // Typewriter effect
  useEffect(() => {
    const currentPhrase = typewriterPhrases[phraseIndex];
    const speed = isDeleting ? 40 : 80;
    const pauseAfterType = 1500;
    const pauseAfterDelete = 300;

    const timeout = setTimeout(() => {
      if (!isDeleting) {
        setTypedText(currentPhrase.substring(0, charIndex + 1));
        setCharIndex(charIndex + 1);
        if (charIndex + 1 === currentPhrase.length) {
          setTimeout(() => setIsDeleting(true), pauseAfterType);
        }
      } else {
        setTypedText(currentPhrase.substring(0, charIndex - 1));
        setCharIndex(charIndex - 1);
        if (charIndex - 1 === 0) {
          setIsDeleting(false);
          setPhraseIndex((phraseIndex + 1) % typewriterPhrases.length);
          setTimeout(() => {}, pauseAfterDelete);
        }
      }
    }, speed);

    return () => clearTimeout(timeout);
  }, [charIndex, isDeleting, phraseIndex]);

  // Scroll to section when navigated from another page
  useEffect(() => {
    if (location.state?.scrollTo) {
      const el = document.getElementById(location.state.scrollTo);
      if (el) {
        setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
      }
    }
  }, [location.state]);

  // Timeline intersection observer
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('show');
          } else {
            entry.target.classList.remove('show');
          }
        });
      },
      { rootMargin: '0px', threshold: 0.4 }
    );

    const timelineItems = document.querySelectorAll('.my-ul-timeline .timeline-item');
    timelineItems.forEach((item) => observer.observe(item));

    return () => {
      timelineItems.forEach((item) => observer.unobserve(item));
    };
  }, []);

  // Init AOS
  useEffect(() => {
    if (window.AOS) {
      window.AOS.init({ duration: 600, easing: 'ease-in-out', once: true, mirror: false });
    }
  }, []);

  // PureCounter
  useEffect(() => {
    new PureCounter();
  }, []);

  const handleChatbot = () => {
    if (!isLoggedIn) {
      navigate('/login');
      return;
    }
    if (userMessage.trim().length > 0) {
      navigate(`/chatbot?query=${encodeURIComponent(userMessage)}&autobot=1`);
    } else {
      alert('Kindly enter a text!');
    }
  };

  const handleGetStarted = () => {
    navigate('/chatbot');
  };

  const handleBuyPlan = async (planName, amount) => {
    if (!isLoggedIn) {
      setShowLoginPopup(true);
      return;
    }

    if (amount === '0') {
      handleGetStarted();
      return;
    }

    setLoadingOverlay(true);
    try {
      const data = await createOrder(user.username, amount, planName);
      setLoadingOverlay(false);
      if (data.status === 1 || data.status === 'success') {
        navigate(`/razorpay?order_id=${data.order_id}&amount=${data.amount}&razorpay_id=${data.razorpay_id || ''}`);
      } else {
        alert('Error: ' + data.message);
      }
    } catch (error) {
      setLoadingOverlay(false);
      alert('Order creation failed.');
      console.error(error);
    }
  };

  const handleContactSubmit = async (e) => {
    e.preventDefault();
    setContactSubmitting(true);
    setContactMessage(null);

    try {
      const data = await submitContact(contactForm);
      if (data.status === 1 || data.status === 'success') {
        setContactMessage({ type: 'success', text: 'Thank you for getting in touch! Our team will be in touch shortly.' });
        setTimeout(() => navigate('/'), 3000);
      } else {
        setContactMessage({ type: 'error', text: data.message });
      }
    } catch (err) {
      setContactMessage({ type: 'error', text: 'Something went wrong. Please try again later.' });
    }
    setContactSubmitting(false);
  };

  const faqItems = [
    { q: 'WHAT IS EVENSTOCKS AI?', a: 'EvenStocks AI is a real-time financial intelligence platform created for the NSE and BSE markets. We track 5,300+ stocks, blending fundamental data, technical indicators, news sentiment, earnings reports, and live price action to deliver straightforward, actionable insights.' },
    { q: 'HOW DOES EVENSTOCKS AI ANALYZE FINANCIAL DATA?', a: 'Our platform combines advanced deep-learning models with real-time data feeds, covering: (i) Fundamentals: Revenue growth, P/E ratios, debt levels, plus annual and quarterly reports. (ii) Technical Signals: Moving averages, RSI, MACD, and candlestick patterns. (iii) News & Events: Major headlines, sector shifts, and key corporate announcements.' },
    { q: 'WHICH MARKETS DOES EVENSTOCKS AI COVER?', a: "We focus on India's stock market\u2014the NSE and BSE. We do plan on expanding to international exchanges down the road." },
    { q: 'WHAT TYPES OF QUESTIONS CAN I ASK EVENSTOCKS AI?', a: 'Ask just about anything related to stocks, such as: "Should I buy Tata Motors now?", "Is IREDA a good pick?", "Give me a technical analysis of ACE." Our AI interprets your natural language questions effortlessly.' },
    { q: 'HOW UP-TO-DATE IS THE DATA?', a: 'We draw on real-time updates directly from exchanges, regulatory filings, and reliable news sources. Any time market prices shift or big headlines break, we make sure you\'re in the loop.' },
    { q: 'DOES EVENSTOCKS AI PROVIDE CHARTS AND VISUALS?', a: 'Yes! Our platform features interactive stock charts\u2014like line graphs, candlesticks, and volume trends\u2014to help you see the bigger picture.' },
    { q: 'WHAT BENEFITS DO PAID SUBSCRIBERS GET?', a: 'Unlock premium perks, including: Priority access to real-time alerts, Personalized portfolio reviews, Advanced predictive tools (e.g., earnings forecasts), Dedicated support from our financial AI specialists.' },
    { q: 'HOW IS EVENSTOCKS AI DIFFERENT FROM CHATGPT-4 FOR STOCK ANALYSIS?', a: 'While ChatGPT-4 is great at general knowledge, EvenStocks AI is specialized for finance: Tailored Expertise, Real-Time Insight, and Action-Focused recommendations.' },
    { q: 'WHY CHOOSE EVENSTOCKS AI OVER OTHER STOCK ANALYSIS TOOLS?', a: 'We blend personalization with precision: Adaptive Insights, Multi-Source Data, and Proactive Alerts.' },
    { q: "HOW ACCURATE ARE EVENSTOCKS AI'S RECOMMENDATIONS?", a: 'No system is right 100% of the time, but we aim to keep you risk-aware by showing confidence levels, comparing track records, and flagging volatile scenarios.' },
    { q: 'IS THERE A MOBILE APP?', a: 'Yes! Our EvenStocks AI mobile app (for iOS and Android) is set for release in Q4 2025.' },
    { q: 'HOW TRUSTWORTHY IS YOUR DATA?', a: 'We team up with SEBI-certified data providers and industry-standard sources. Our system refreshes every 15 seconds for minimal lag.' },
  ];

  const [openFaq, setOpenFaq] = useState(-1);

  return (
    <div className={`dashboard-page${isDark ? ' dashboard-dark' : ''}`}>
      <Header isDark={isDark} />

      {/* Dark mode toggle — bottom-left to avoid conflicting with FloatingChat FAB */}
      <button
        className="home-dark-toggle"
        onClick={toggleTheme}
        title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
      >
        {isDark ? '☀️' : '🌙'}
      </button>

      <EntryModal show={showEntryModal} onClose={() => setShowEntryModal(false)} />
      <LoginPopup show={showLoginPopup} onClose={() => setShowLoginPopup(false)} />

      {loadingOverlay && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
          <img src="https://i.gifer.com/VM3x.gif" alt="Loading..." style={{ width: '100px', height: '100px' }} />
        </div>
      )}

      <main className="main">
        {/* Hero Section */}
        <section id="hero" className="hero section">
          <div className="container" data-aos="fade-up" data-aos-delay="100">
            <div className="row align-items-center">
              <div className="col-lg-6">
                <div className="hero-content" data-aos="fade-up" data-aos-delay="200">
                  <div className="company-badge mb-4">
                    <i className="bi bi-bar-chart-line me-2"></i>
                    AI-Powered Investment for Your Future
                  </div>
                  <h1 className="mb-4">
                    AI-Powered Investing for{' '}
                    <span className="accent-text typewriter-text">{typedText}</span>
                    <span className="typewriter-cursor">|</span>
                  </h1>
                  <p className="mb-4 mb-md-5">
                    Navigate India's markets with confidence. EvenStocks AI combines real-time fundamentals, technical signals, and news sentiment across 5,300+ NSE &amp; BSE stocks — delivering clear, actionable insights so you spend less time researching and more time investing.
                  </p>
                  <div className="hero-buttons">
                    <button className="btn btn-primary me-0 me-sm-2 mx-1" onClick={handleGetStarted}>Get Started</button>
                    <a href="https://www.youtube.com/watch?v=ojcPdj7cX-o" className="btn btn-link mt-2 mt-sm-0 glightbox">
                      <i className="bi bi-play-circle me-1"></i> Play Video
                    </a>
                  </div>
                </div>
              </div>
              <div className="col-lg-6">
                <div className="hero-image" data-aos="zoom-out" data-aos-delay="300">
                  <img src="/assets/img/trading1.png" alt="Hero" className="img-fluid" />
                  <div className="customers-badge">
                    <div className="customer-avatars">
                      <img src="/assets/img/infos.png" alt="Customer 1" className="avatar" />
                      <img src="/assets/img/susu.png" alt="Customer 2" className="avatar" />
                      <img src="/assets/img/bajaj.png" alt="Customer 3" className="avatar" />
                      <img src="/assets/img/relaince.png" alt="Customer 4" className="avatar" />
                      <img src="/assets/img/tcs.png" alt="Customer 5" className="avatar" />
                      <span className="avatar more">5k+</span>
                    </div>
                    <p className="mb-0 mt-2" style={{ color: 'black' }}>5,000+ Indian stocks with live information.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* About Section */}
        <section id="about" className="about section">
          <div className="container" data-aos="fade-up" data-aos-delay="100">
            <div className="row gy-4 align-items-center justify-content-between" style={{ textAlign: 'justify' }}>
              <div className="col-xl-5" data-aos="fade-up" data-aos-delay="200">
                <span className="about-meta">MORE ABOUT US</span>
                <h2 className="about-title" style={{ textAlign: 'left' }}>Empowering Investors with AI</h2>
                <p className="about-description">At EvenStocks, we believe every investor — from first-time buyers to seasoned traders — deserves professional-grade market intelligence. We've built an AI-powered platform that levels the playing field.</p>
                <p className="about-description">Wondering whether to buy Bharti Airtel? Just ask. Our engine instantly cross-references fundamentals, technical indicators, quarterly earnings, charts, and breaking news to give you a clear, data-backed answer in seconds.</p>
                <p className="about-description">No jargon. No information overload. Just the insights that matter, when you need them. Welcome to the smarter way to invest in India.</p>
              </div>
              <div className="col-xl-6" data-aos="fade-up" data-aos-delay="300">
                <div className="image-wrapper">
                  <div className="images position-relative" data-aos="zoom-out" data-aos-delay="400">
                    <img src="/assets/img/high.jpg" alt="Business Meeting" className="img-fluid main-image rounded-4" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* How it Works Timeline */}
        <div className="my-ul-timeline">
          <div className="container section-title" data-aos="fade-up">
            <h2>How it Works?</h2>
            <p>Here's the intelligence pipeline working behind the scenes every time you ask a question &mdash; so you get precise answers, not guesses.</p>
          </div>
          <ul className="timeline-container" ref={timelineRef}>
            <li className="timeline-item" style={{ '--accent-color': '#41516C' }}>
              <div className="timeline-date">Step 1</div>
              <div className="timeline-title">User: Should I Buy Tata Motors?</div>
            </li>
            <li className="timeline-item" style={{ '--accent-color': '#FBCA3E' }}>
              <div className="timeline-date" style={{ textAlign: 'left' }}>Step 2</div>
              <div className="timeline-title" style={{ textAlign: 'left' }}>EvenStocks springs into action, gathering real-time fundamentals, detailed reports, technical indicators, charts, and breaking news.</div>
            </li>
            <li className="timeline-item" style={{ '--accent-color': '#E24A68' }}>
              <div className="timeline-date">Step 3</div>
              <div className="timeline-title">EvenStocks uses an advanced AI algorithm to process every piece of data, delivering a precise Buy/Sell/Hold recommendation.</div>
            </li>
            <li className="timeline-item" style={{ '--accent-color': '#1B5F8C' }}>
              <div className="timeline-date" style={{ textAlign: 'left' }}>Step 4</div>
              <div className="timeline-title" style={{ textAlign: 'left' }}>Finally, we present a concise summary and an easy-to-digest technical chart.</div>
            </li>
          </ul>
        </div>


        {/* Call to Action */}
        <section id="call-to-action" className="call-to-action section">
          <div className="container" data-aos="fade-up" data-aos-delay="100">
            <div className="row content justify-content-center align-items-center position-relative">
              <div className="col-lg-8 mx-auto text-center">
                <h2 className="display-4 mb-4">The Right Call, at the Right Time</h2>
                <p className="mb-4">Stop second-guessing every trade. EvenStocks AI synthesizes thousands of data points in real time so your next move is always informed, never impulsive.</p>
                <Link to="/chatbot" className="btn btn-cta">Chat with Bot</Link>
              </div>
            </div>
          </div>
        </section>


        {/* Testimonials */}
        <section id="testimonials" className="testimonials section light-background">
          <div className="container section-title" data-aos="fade-up">
            <h2>Testimonials</h2>
            <p>Join thousands of investors who are already using Even Stocks AI to optimize their portfolios.</p>
          </div>
          <div className="container">
            <div className="row g-5">
              {[
                { name: 'Rahul M', img: 'img1.png', text: '"EvenStocks has transformed the way I look at investing. Their AI-based recommendations are always on point."' },
                { name: 'Priya S', img: 'img4.png', text: '"I love how EvenStocks sticks to Indian stocks specifically. It cuts out a lot of noise."' },
                { name: 'Arjun K', img: 'img2.png', text: '"I was a total beginner, but EvenStocks\' straightforward Buy/Sell calls gave me the confidence to start."' },
                { name: 'Neha T', img: 'img5.png', text: '"It\'s like having a personal research team that never sleeps."' },
                { name: 'Tanya G', img: 'img6.png', text: '"EvenStocks focuses on our local market, so their advice actually relates to my everyday life."' },
                { name: 'Vikas R', img: 'img3.png', text: '"It\'s not about guaranteed \'predictions\'&mdash;it\'s about data-driven signals I can trust."' },
              ].map((t, i) => (
                <div key={i} className="col-lg-6" data-aos="fade-up" data-aos-delay={100 * (i + 1)}>
                  <div className="testimonial-item">
                    <img src={`/assets/img/${t.img}`} className="testimonial-img" alt="" style={{ backgroundColor: '#f2fff8' }} />
                    <h3>{t.name}</h3>
                    <div className="stars">
                      {[...Array(5)].map((_, j) => <i key={j} className="bi bi-star-fill"></i>)}
                    </div>
                    <p><i className="bi bi-quote quote-icon-left"></i><span>{t.text}</span><i className="bi bi-quote quote-icon-right"></i></p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Stats */}
        <section id="stats" className="stats section">
          <div className="container" data-aos="fade-up" data-aos-delay="100">
            <div className="row gy-4">
              {[
                { end: 2103, label: 'Clients' },
                { end: 9000, label: 'Responses' },
                { end: 145, label: 'Hours Of Support' },
                { end: 12, label: 'Workers' },
              ].map((s, i) => (
                <div key={i} className="col-lg-3 col-md-6">
                  <div className="stats-item text-center w-100 h-100">
                    <span data-purecounter-start="0" data-purecounter-end={s.end} data-purecounter-duration="1" className="purecounter"></span>
                    <p>{s.label}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Pricing */}
        <section id="pricing" className="pricing section light-background">
          <div className="container section-title" data-aos="fade-up">
            <h2>Pricing</h2>
            <p>Choose the plan that fits your investment needs and goals.</p>
          </div>
          <div className="container" data-aos="fade-up" data-aos-delay="100">
            {/* Free Plan */}
            <div className="row justify-content-center mb-4">
              <div className="col-12">
                <div className="pricing-card text-center bg-light p-4 shadow-sm" style={{ borderRadius: '12px' }}>
                  <h3>Free Plan</h3>
                  <div className="price"><span className="currency">&#8377;</span><span className="amount">0</span></div>
                  <p className="description">For new users who want to explore our AI-powered stock research platform.</p>
                  <div className="row justify-content-center text-center mb-3">
                    <div className="col-md-3 col-sm-4 col-6"><i className="bi bi-check-circle-fill text-success"></i><span>10 Stock Research Tokens</span></div>
                    <div className="col-md-3 col-sm-4 col-6"><i className="bi bi-check-circle-fill text-success"></i><span>Basic AI Stock Insights</span></div>
                    <div className="col-md-4 col-sm-4 col-12 mt-2 mt-sm-0"><i className="bi bi-check-circle-fill text-success"></i><span>Full Access to Short AI Responses Only</span></div>
                  </div>
                  <button className="btn btn-primary buy-btn" onClick={() => handleBuyPlan('free', '0')}>Start Free <i className="bi bi-arrow-right"></i></button>
                </div>
              </div>
            </div>

            <div className="row g-4 justify-content-center">
              {[
                {
                  name: 'Pluse Pack', plan: 'pluse', amount: '249', features: ['15 Stock Search Tokens', 'Advanced AI Market Analysis', 'Full Access to Short & Long AI Responses', 'Priority AI Chat Support'],
                },
                {
                  name: 'Edge Pack', plan: 'edge', amount: '549', popular: true, features: ['30 Stock Search Tokens', 'Advanced AI Market Analysis', 'Full Access to Short & Long AI Responses', 'Priority AI Chat Support'],
                },
                {
                  name: 'Prime Pack', plan: 'prime', amount: '1149', features: ['60 Stock Search Tokens', 'Institutional-Grade Market Analysis', 'Full Access to Short & Long AI Responses', 'Priority AI Chat Support', 'API Access'],
                },
              ].map((p, i) => (
                <div key={i} className="col-lg-4" data-aos="fade-up" data-aos-delay={100 * (i + 1)}>
                  <div className={`pricing-card ${p.popular ? 'popular' : ''}`}>
                    {p.popular && <div className="popular-badge">Most Popular</div>}
                    <h3>{p.name}</h3>
                    <div className="price"><span className="currency">&#8377;</span><span className="amount">{p.amount}</span></div>
                    <h4>Featured Included:</h4>
                    <ul className="features-list">
                      {p.features.map((f, j) => <li key={j}><i className="bi bi-check-circle-fill"></i>{f}</li>)}
                    </ul>
                    <button className={`btn ${p.popular ? 'btn-light' : 'btn-primary'} buy-btn`} onClick={() => handleBuyPlan(p.plan, p.amount)}>
                      Add to Wallet <i className="bi bi-arrow-right"></i>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="faq-9 faq section light-background" id="faq">
          <div className="container">
            <div className="row">
              <div className="col-lg-5" data-aos="fade-up">
                <h2 className="faq-title">Have a question? Check out the FAQ</h2>
                <p className="faq-description"><b>Below is a refreshed FAQ in a friendly style&mdash;perfect for guiding investors:</b></p>
                <p className="faq-description">ABOUT EVENSTOCKS AI: YOUR INTELLIGENT PARTNER FOR SMART INVESTING</p>
                <p className="faq-description">At EvenStocks AI, we focus on empowering investors with real-time insights, predictive analytics, and AI-driven clarity.</p>
              </div>
              <div className="col-lg-7" data-aos="fade-up" data-aos-delay="300">
                <div className="faq-container">
                  {faqItems.map((faq, i) => (
                    <div key={i} className={`faq-item ${openFaq === i ? 'faq-active' : ''}`} onClick={() => setOpenFaq(openFaq === i ? -1 : i)}>
                      <h3>{faq.q}</h3>
                      <div className="faq-content"><p>{faq.a}</p></div>
                      <i className="faq-toggle bi bi-chevron-right"></i>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* CTA 2 */}
        <section id="call-to-action-2" className="call-to-action-2 section dark-background">
          <div className="container">
            <div className="row justify-content-center" data-aos="zoom-in" data-aos-delay="100">
              <div className="col-xl-10">
                <div className="text-center">
                  <h3>READY TO INVEST WITH CONVICTION?</h3>
                  <p>Join thousands of Indian investors who trust EvenStocks AI for real-time analysis, data-driven signals, and clarity on every trade.</p>
                  <Link className="cta-btn" to="/signup">Sign Up</Link>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Contact */}
        <section id="contact" className="contact section light-background">
          <div className="container section-title" data-aos="fade-up">
            <h2>Contact</h2>
            <p>We're here to help&mdash;reach out anytime with your questions or concerns.</p>
          </div>
          <div className="container" data-aos="fade-up" data-aos-delay="100">
            <div className="row g-4 g-lg-5">
              <div className="col-lg-5">
                <div className="info-box" data-aos="fade-up" data-aos-delay="200">
                  <h3>Contact Info</h3>
                  <p>Feel free to reach out with any inquiries.</p>
                  <div className="info-item" data-aos="fade-up" data-aos-delay="300">
                    <div className="icon-box"><i className="bi bi-geo-alt"></i></div>
                    <div className="content"><h4>Our Location</h4><p>Andheri East</p><p>Mumbai, Maharashtra 400069</p></div>
                  </div>
                  <div className="info-item" data-aos="fade-up" data-aos-delay="400">
                    <div className="icon-box"><i className="bi bi-telephone"></i></div>
                    <div className="content"><h4>Phone Number</h4><p>+91 9509526580</p></div>
                  </div>
                  <div className="info-item" data-aos="fade-up" data-aos-delay="500">
                    <div className="icon-box"><i className="bi bi-envelope"></i></div>
                    <div className="content"><h4>Email Address</h4><p>info@evenstocks.com</p></div>
                  </div>
                </div>
              </div>
              <div className="col-lg-7">
                <div className="contact-form" data-aos="fade-up" data-aos-delay="300">
                  <h3>Get In Touch</h3>
                  <p>Feel free to reach out with any inquiries.</p>
                  <form onSubmit={handleContactSubmit}>
                    <div className="row gy-4">
                      <div className="col-md-6">
                        <input type="text" className="form-control" placeholder="Your Name" required value={contactForm.name} onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })} />
                      </div>
                      <div className="col-md-6">
                        <input type="email" className="form-control" placeholder="Your Email" required value={contactForm.email} onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })} />
                      </div>
                      <div className="col-12">
                        <input type="text" className="form-control" placeholder="Subject" required value={contactForm.subject} onChange={(e) => setContactForm({ ...contactForm, subject: e.target.value })} />
                      </div>
                      <div className="col-12">
                        <textarea className="form-control" rows="6" placeholder="Message" required value={contactForm.message} onChange={(e) => setContactForm({ ...contactForm, message: e.target.value })}></textarea>
                      </div>
                      <div className="col-12 text-center">
                        {contactMessage && (
                          <div style={{ textAlign: 'center', marginTop: '20px', color: contactMessage.type === 'success' ? 'green' : 'red', fontSize: '16px' }}>
                            {contactMessage.text}
                          </div>
                        )}
                        <button type="submit" className="btn" disabled={contactSubmitting}>
                          {contactSubmitting ? 'Sending...' : 'Send Message'}
                        </button>
                      </div>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
      <FloatingChat />
    </div>
  );
};

export default HomePage;
