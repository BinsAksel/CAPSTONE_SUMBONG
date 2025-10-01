import React, { useState, useRef, useEffect } from 'react';
import GoogleButton from '../components/GoogleButton';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import loginImage from '../assets/login.png';
import './SignIn.css';
import Swal from 'sweetalert2';

const SignIn = () => {
  const navigate = useNavigate();

  // Lock background scroll when SignIn (modal) is mounted
  // Removed body overflow lock to allow natural page scrolling
  useEffect(() => {}, []);
  // Google sign up handler
  const handleGoogleSignUp = () => {
    window.location.href = 'https://capstone-sumbong.onrender.com/api/auth/google';
  };
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phoneNumber: '',
    address: '',
    password: '',
  });
  const [images, setImages] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [acceptedPrivacy, setAcceptedPrivacy] = useState(false);
  const [showPoliciesModal, setShowPoliciesModal] = useState(false);
  const [activePolicy, setActivePolicy] = useState('terms');
  const [policyContent, setPolicyContent] = useState('');
  const POLICIES_VERSION = '1.0.0';
  // No persistence key (acceptance resets per visit)

  const modalScrollRef = useRef(null);
  const [scrolledToBottom, setScrolledToBottom] = useState(false);
  const [pendingSubmit, setPendingSubmit] = useState(false);

  const fetchPolicy = async (name) => {
    try {
      const res = await fetch(`https://capstone-sumbong.onrender.com/api/policies/${name}`);
      if (!res.ok) throw new Error('Failed to load policy');
      const txt = await res.text();
      setPolicyContent(txt);
      setActivePolicy(name);
      setShowPoliciesModal(true);
      setScrolledToBottom(false);
    } catch (e) {
      Swal.fire({ icon: 'error', title: 'Unable to load policy', text: e.message });
    }
  };

  // Lightweight markdown to JSX converter (headings, lists, bold, italic, links)
  const renderMarkdown = (md) => {
    if (!md) return null;
    const lines = md.split(/\r?\n/);
    const elements = [];
    let listBuffer = [];
    const flushList = () => {
      if (listBuffer.length) {
        elements.push(<ul key={elements.length} style={{ paddingLeft: 20, margin: '8px 0' }}>{listBuffer.map((li,i)=><li key={i}>{li}</li>)}</ul>);
        listBuffer = [];
      }
    };
    const formatInline = (txt) => {
      // Bold **text**
      let parts = [];
      let idx = 0;
      const pushText = (t) => { if (t) parts.push(t); };
      // simple replacements
      txt = txt.replace(/\*\*(.*?)\*\*/g, (m,p1)=>`<b>${p1}</b>`).replace(/\*(.*?)\*/g,(m,p1)=>`<i>${p1}</i>`).replace(/`([^`]+)`/g,(m,p1)=>`<code>${p1}</code>`).replace(/\[(.*?)\]\((https?:[^)]+)\)/g,(m,text,url)=>`<a href="${url}" target="_blank" rel="noopener noreferrer">${text}</a>`);
      return <span dangerouslySetInnerHTML={{ __html: txt }} />;
    };
    lines.forEach((raw,i)=>{
      const line = raw.trimEnd();
      if (!line.trim()) { flushList(); return; }
      const headingMatch = line.match(/^(#{1,6})\s+(.*)$/);
      if (headingMatch) {
        flushList();
        const level = headingMatch[1].length;
        const Tag = `h${Math.min(level,6)}`;
        elements.push(<Tag key={i} style={{ margin:'12px 0 6px', fontSize: level===1? '1.4rem': level===2? '1.25rem': '1rem', borderBottom: level<3? '1px solid #e5e7eb':'none', paddingBottom: level<3?4:0 }}>{formatInline(headingMatch[2])}</Tag>);
        return;
      }
      const listMatch = line.match(/^[*-]\s+(.*)$/);
      if (listMatch) {
        listBuffer.push(formatInline(listMatch[1]));
        return;
      }
      flushList();
      elements.push(<p key={i} style={{ margin:'6px 0', lineHeight:1.5 }}>{formatInline(line)}</p>);
    });
    flushList();
    return elements;
  };

  useEffect(()=>{
    if (!showPoliciesModal) return;
    const el = modalScrollRef.current;
    if (!el) return;
    const onScroll = () => {
      if (el.scrollTop + el.clientHeight >= el.scrollHeight - 5) {
        setScrolledToBottom(true);
      }
    };
    el.addEventListener('scroll', onScroll);
    return ()=> el.removeEventListener('scroll', onScroll);
  },[showPoliciesModal]);

  // Acceptance intentionally NOT persisted; always reset on load.

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleImageChange = (e) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      const allowedTypes = [
        'image/jpeg', 'image/png', 'image/gif', 'image/bmp', 'image/webp',
        'application/pdf',
        'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      ];
      const invalid = files.find(file => !allowedTypes.includes(file.type));
      if (invalid) {
        Swal.fire({
          icon: 'error',
          title: 'Invalid File Type',
          text: 'Only images (JPG, PNG, GIF, BMP, WEBP), PDF, and Word documents are allowed.',
          confirmButtonColor: '#1a365d'
        });
        return;
      }
      setImages(files);
    }
  }

  const performSignup = async () => {
    setLoading(true);

    // Phone number validation (Philippines: 10-13 digits, numbers only)
    const phone = formData.phoneNumber.trim();
    if (!/^\d{10,13}$/.test(phone)) {
      Swal.fire({
        icon: 'error',
        title: 'Invalid Phone Number',
        text: 'Please enter a valid phone number (10-13 digits, numbers only).',
        confirmButtonColor: '#1a365d'
      });
      setLoading(false);
      return;
    }

    try {
      const formDataToSend = new FormData();
      // Append user data
      Object.keys(formData).forEach(key => {
        formDataToSend.append(key, formData[key]);
      });
      // Policy flags (must be accepted)
  formDataToSend.append('acceptedTerms', acceptedTerms ? 'true' : 'false');
  formDataToSend.append('acceptedPrivacy', acceptedPrivacy ? 'true' : 'false');
      formDataToSend.append('policiesVersion', POLICIES_VERSION);
      // Append credentials only if they exist
      if (images && images.length > 0) {
        images.forEach(image => {
          formDataToSend.append('credentials', image);
        });
      }
      const response = await axios.post('https://capstone-sumbong.onrender.com/api/auth/signup', formDataToSend, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      if (response.data.success) {
        Swal.fire({
          icon: 'success',
          title: 'Signed Up!',
          text: 'You are now signed up! Please wait for the admin to verify your account before logging in.',
          confirmButtonColor: '#1a365d'
        });
        setFormData({
          firstName: '',
          lastName: '',
          email: '',
          phoneNumber: '',
          address: '',
          password: '',
        });
        setImages([]);
      }
    } catch (err) {
      const errorMessage = err.response?.data?.message || err.response?.data || err.message || 'Registration failed. Please try again.';
      Swal.fire({
        icon: 'error',
        title: 'Registration Failed',
        text: typeof errorMessage === 'string' ? errorMessage : 'Registration failed. Please try again.',
        confirmButtonColor: '#1a365d'
      });
    } finally {
      setLoading(false);
      setPendingSubmit(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!(acceptedTerms && acceptedPrivacy)) {
      // start acceptance flow
      setPendingSubmit(true);
      if (!acceptedTerms) fetchPolicy('terms'); else fetchPolicy('privacy');
      return;
    }
    performSignup();
  };

  return (
    <div className="signin-layout">
      <div className="signin-illustration-panel" aria-hidden="true">
        <img src={loginImage} alt="Illustration" />
      </div>
      <div className="signin-form-region" role="presentation">
        <div className="signin-form-box" role="dialog" aria-modal="true" aria-labelledby="signin-modal-title">
          <h2 id="signin-modal-title">Create Account</h2>
          <GoogleButton text="Sign up with Google" onClick={handleGoogleSignUp} />
          {/* SweetAlert handles all success and error messages */}
          <form onSubmit={handleSubmit} className="signin-form">
          <div className="form-group">
            <input
              type="text"
              name="firstName"
              value={formData.firstName}
              onChange={handleChange}
              placeholder="First Name"
              required
            />
          </div>
          <div className="form-group">
            <input
              type="text"
              name="lastName"
              value={formData.lastName}
              onChange={handleChange}
              placeholder="Last Name"
              required
            />
          </div>
          <div className="form-group">
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="Email"
              required
            />
          </div>
          <div className="form-group">
            <input
              type="tel"
              name="phoneNumber"
              value={formData.phoneNumber}
              onChange={handleChange}
              placeholder="Phone Number"
              required
            />
          </div>
          <div className="form-group">
            <input
              type="text"
              name="address"
              value={formData.address}
              onChange={handleChange}
              placeholder="Address"
            />
          </div>
          <div className="form-group">
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              placeholder="Password"
              required
            />
          </div>
          <div className="form-group">
            <label className="file-label">
              📋 Upload Credentials for Verification
            </label>
            <p className="file-description">
              Please upload your ID, barangay certificate, or other documents that prove you are a resident of Barangay East Tapinac.
            </p>
            <input
              type="file"
              multiple
              accept="image/*,.pdf,.doc,.docx"
              onChange={handleImageChange}
              className="file-input"
              required
            />
            <small className="file-help">
              Accepted formats: Images (JPG, PNG, GIF), PDF, Word documents. You can add a profile picture later after logging in.
            </small>
          </div>
          <button type="submit" disabled={loading} className="signin-submit-btn">
            {loading ? 'Signing up...' : (acceptedTerms && acceptedPrivacy ? 'Sign Up' : 'Continue & Accept Policies')}
          </button>
          <p className="policy-disclaimer full-line">
            By signing up, you agree to our <button type="button" onClick={()=>fetchPolicy('terms')} className="inline-policy-link">Terms &amp; Conditions</button> and <button type="button" onClick={()=>fetchPolicy('privacy')} className="inline-policy-link">Privacy Policy</button>. <span className="policy-version">Version {POLICIES_VERSION}</span>
          </p>
          <p className="login-link">Already have an account? <Link to="/login">Login</Link></p>
        </form>
        </div>
      </div>
      {showPoliciesModal && (
        <div className="modal-overlay" onClick={() => setShowPoliciesModal(false)}>
          <div className="credential-modal" onClick={e=>e.stopPropagation()} style={{ maxWidth: 720, width:'95%', padding:24, display:'flex', flexDirection:'column' }}>
            <div className="modal-header" style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <h3 style={{ margin:0 }}>{activePolicy === 'terms' ? 'Terms & Conditions' : 'Privacy Policy'}</h3>
              <button className="modal-close-x" type="button" aria-label="Close" onClick={()=>setShowPoliciesModal(false)} />
            </div>
            <div ref={modalScrollRef} style={{ maxHeight: '55vh', overflowY:'auto', marginTop:16, paddingRight:8 }}>
              {renderMarkdown(policyContent)}
            </div>
            {!scrolledToBottom && (
              <div style={{ marginTop:12, fontSize:12, color:'#b45309', background:'#fff7ed', padding:'6px 10px', borderRadius:4 }}>
                Scroll to the bottom to enable the Accept button.
              </div>
            )}
            <div style={{ marginTop:16, display:'flex', gap:12, justifyContent:'flex-end', alignItems:'center' }}>
              <button onClick={()=>setShowPoliciesModal(false)} className="action-btn" style={{ background:'#6b7280', color:'#fff' }}>Close</button>
              {((activePolicy==='terms' && !acceptedTerms) || (activePolicy==='privacy' && !acceptedPrivacy)) && (
                <button
                  disabled={!scrolledToBottom}
                  onClick={()=>{
                    if (activePolicy==='terms') setAcceptedTerms(true); else setAcceptedPrivacy(true);
                    setShowPoliciesModal(false);
                    // decide next step after state update
                    setTimeout(()=>{
                      const termsAccepted = activePolicy==='terms' ? true : acceptedTerms;
                      const privacyAccepted = activePolicy==='privacy' ? true : acceptedPrivacy;
                      if (pendingSubmit) {
                        if (!termsAccepted) { fetchPolicy('terms'); return; }
                        if (!privacyAccepted) { fetchPolicy('privacy'); return; }
                        performSignup();
                      }
                    }, 30);
                  }}
                  className="action-btn"
                  style={{ background: scrolledToBottom? '#1d4ed8':'#93c5fd', color:'#fff', cursor: scrolledToBottom? 'pointer':'not-allowed' }}>
                  Accept & Continue
                </button>
              )}
              {((activePolicy==='terms' && acceptedTerms) || (activePolicy==='privacy' && acceptedPrivacy)) && (
                <span style={{ background:'#dcfce7', color:'#166534', fontSize:12, padding:'6px 10px', borderRadius:8, fontWeight:600 }}>Accepted</span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SignIn; 