import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import './LandingPage.css';
import landingVideo from '../assets/landing-page.mp4';
import logoImg from '../assets/sumbong-logo.png';

/*
  LandingPage
  - Displays a fullscreen looping video background (user will supply mp4 later)
  - Shows overlay with app title / tagline and Login + Sign Up buttons
  - If user already authenticated (token present) auto-redirects to /dashboard
*/
const LandingPage = () => {
  const navigate = useNavigate();
  const [isAuthed, setIsAuthed] = useState(false);
  const [videoReady, setVideoReady] = useState(false);
  const [buffering, setBuffering] = useState(true);
  const videoRef = useRef(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      setIsAuthed(true);
      // brief timeout for possible UX (could remove for instant redirect)
      const t = setTimeout(() => navigate('/dashboard', { replace: true }), 400);
      return () => clearTimeout(t);
    }
  }, [navigate]);

  // Optional: smooth playback adjustments after mount
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const handleCanPlay = () => {
      setVideoReady(true);
      setBuffering(false);
      // Normalize playback rate in case user/system slowed it
      try { v.playbackRate = 1; } catch (_) {}
      // Attempt to ensure play (Safari iOS sometimes pauses muted loops)
      const playPromise = v.play();
      if (playPromise && typeof playPromise.then === 'function') {
        playPromise.catch(() => {/* ignore autoplay block since muted */});
      }
    };
    const handleWaiting = () => setBuffering(true);
    const handlePlaying = () => setBuffering(false);
    v.addEventListener('canplay', handleCanPlay, { once: true });
    v.addEventListener('waiting', handleWaiting);
    v.addEventListener('playing', handlePlaying);
    return () => {
      v.removeEventListener('canplay', handleCanPlay);
      v.removeEventListener('waiting', handleWaiting);
      v.removeEventListener('playing', handlePlaying);
    };
  }, []);


  return (
    <div className="landing-root">
      <div className="video-bg fixed">
        <video
          ref={videoRef}
          className={`video${videoReady ? ' ready' : ''}`}
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          aria-label="Background video"
        >
          <source src={landingVideo} type="video/mp4" />
          Your browser does not support the video tag.
        </video>
        <div className="video-overlay" />
        {buffering && (
          <div className="video-buffering" aria-hidden={!buffering}>
            <div className="spinner" />
          </div>
        )}
      </div>
      <div className="hero-stage">
        <div className="top-bar">
          <div className="top-bar-inner">
            <button className="brand brand-logo" onClick={() => document.getElementById('top')?.scrollIntoView({behavior:'smooth'})} aria-label="Go to top / SUMBONG home">
              <img src={logoImg} alt="Sumbong Logo" className="brand-image" />
            </button>
            <div className="top-actions">
            {!isAuthed && (
              <>
                <button className="top-btn ghost" onClick={() => navigate('/login')}>Login</button>
                <button className="top-btn solid" onClick={() => navigate('/signup')}>Sign Up</button>
              </>
            )}
            {isAuthed && (
              <button className="top-btn solid" onClick={() => navigate('/dashboard')}>Dashboard</button>
            )}
            </div>
          </div>
        </div>
        <header className="hero" id="top">
        <h1 className="app-name">SUMBONG</h1>
        <p className="tagline">System for Updating and Managing Barangay Online Notices and Grievances for the Residents of Barangay East Tapinac</p>
        {isAuthed ? (
          <p className="redirect-msg">Redirecting you to your dashboard…</p>
        ) : (
          <div className="cta-buttons single">
            <button className="btn primary get-started" onClick={() => navigate('/login')}>Get Started</button>
          </div>
        )}
        <nav className="hero-nav">
          <button onClick={() => document.getElementById('about')?.scrollIntoView({behavior:'smooth'})}>About</button>
          <button onClick={() => document.getElementById('why')?.scrollIntoView({behavior:'smooth'})}>Why SUMBONG</button>
          <button onClick={() => document.getElementById('what')?.scrollIntoView({behavior:'smooth'})}>What Is It</button>
        </nav>
        </header>
      </div>

      <main className="landing-main">
        <section id="about" className="info-section">
          <div className="section-inner">
            <h2>About</h2>
            <p>SUMBONG is a community-focused reporting platform enabling residents to securely submit concerns, incidents, and feedback to local authorities in real time. It bridges the gap between citizens and barangay officials with transparency and verifiable updates.</p>
          </div>
        </section>
        <section id="why" className="info-section alt">
          <div className="section-inner">
            <h2>Why SUMBONG</h2>
            <ul className="reasons">
              <li><strong>Fast escalation</strong> – Directly reaches the right handlers.</li>
              <li><strong>Evidence rich</strong> – Attach images & video for clarity.</li>
              <li><strong>Privacy aware</strong> – Sensitive data handled securely.</li>
              <li><strong>Status tracking</strong> – Know when action is taken.</li>
              <li><strong>Community insight</strong> – Patterns highlight priority issues.</li>
              <li><strong>Real-time updates</strong> – Live message notifications keep everyone in sync.</li>
            </ul>
          </div>
        </section>
        <section id="what" className="info-section">
          <div className="section-inner">
            <h2>What Is SUMBONG?</h2>
            <p>It is a digital complaint and incident submission system tailored for barangay-level governance. Residents create an account, submit a report with optional media, and receive notifications as officials review, verify, and resolve the issue. The platform streamlines documentation and reduces delays caused by manual reporting.</p>
            <p className="note">Ready to participate? <button className="bottom-cta" onClick={() => navigate('/login')}>Get Started</button></p>
          </div>
        </section>
      </main>
      <footer className="landing-footer">
        <span>© {new Date().getFullYear()} SUMBONG. All rights reserved.</span>
        <span>Contact Us @ <a className="footer-email" href="mailto:sumbongsystem@gmail.com" rel="noopener noreferrer">sumbongsystem@gmail.com</a>.</span>
      </footer>
    </div>
  );
};

export default LandingPage;
