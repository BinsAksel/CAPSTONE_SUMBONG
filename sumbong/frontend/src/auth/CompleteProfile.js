import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { useLocation, useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';
import './CompleteProfile.css';
import { API_BASE } from '../config/apiBase';

const CompleteProfile = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const query = new URLSearchParams(location.search);
  const userId = query.get('userId');
  // Get Google info from query params if present
  const initialFirstName = query.get('firstName') || '';
  const initialLastName = query.get('lastName') || '';
  const initialEmail = query.get('email') || '';
  const initialProfilePicture = query.get('profilePicture') || '';

  const [formData, setFormData] = useState({
    firstName: initialFirstName,
    lastName: initialLastName,
    phoneNumber: '+639', // start with normalized prefix immediately
    address: '',
    email: initialEmail,
    profilePicture: initialProfilePicture,
    password: ''
  });
  const [images, setImages] = useState([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [acceptedPrivacy, setAcceptedPrivacy] = useState(false);
  const [showPoliciesModal, setShowPoliciesModal] = useState(false);
  const [activePolicy, setActivePolicy] = useState('terms');
  const [policyContent, setPolicyContent] = useState('');
  const POLICIES_VERSION = '1.0.0';
  const modalScrollRef = useRef(null);
  const [scrolledToBottom, setScrolledToBottom] = useState(false);
  const [pendingSubmit, setPendingSubmit] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const PASSWORD_POLICY = {
    regex: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/,
    message: 'Password must be 8+ chars with upper, lower, number, special.'
  };
  // Derive an HTML pattern (remove anchors and use a slightly simpler special-char class for broader browser compatibility)
  const passwordHtmlPattern = '(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[\\W_]).{8,}';

  const fetchPolicy = async (name) => {
    try {
      const res = await fetch(`${API_BASE}/api/policies/${name}`);
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

  // Lightweight markdown renderer (shared logic with SignIn; consider refactor to common util if reused again)
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
      if (listMatch) { listBuffer.push(formatInline(listMatch[1])); return; }
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

  // Acceptance not persisted; resets every new visit.

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === 'phoneNumber') {
      // Always enforce +639 prefix and strip non-digits
      const digits = value.replace(/\D/g, '');
      // Extract subscriber digits after an initial 9 (Philippine mobile starts with 9)
      // Remove any leading country/zeros before first 9
      const first9 = digits.indexOf('9');
      let subscriber = first9 === -1 ? '' : digits.slice(first9 + 1); // digits after the first 9
      subscriber = subscriber.replace(/[^0-9]/g,'').slice(0,9); // cap at 9 digits
      const normalized = '+639' + subscriber;
      setFormData(prev => ({ ...prev, phoneNumber: normalized }));
      return;
    }
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handlePhonePaste = (e) => {
    const text = (e.clipboardData || window.clipboardData).getData('text');
    const digits = text.replace(/\D/g,'');
    const first9 = digits.indexOf('9');
    const subscriber = first9 === -1 ? '' : digits.slice(first9 + 1, first9 + 10);
    setFormData(prev => ({ ...prev, phoneNumber: '+639' + subscriber }));
    e.preventDefault();
  };

  const handlePhoneKeyDown = (e) => {
    if (e.target.name !== 'phoneNumber') return;
    // Prevent deleting inside fixed prefix +639
    const protectUntil = 4; // indices 0..3 are + 6 3 9
    const { selectionStart, selectionEnd, value } = e.target;
    const key = e.key;
    const navKeys = ['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Tab','Home','End'];
    if (navKeys.includes(key)) return;
    if (key === 'Backspace' && selectionStart <= protectUntil) {
      e.preventDefault(); return;
    }
    if (key === 'Delete' && selectionStart < protectUntil) {
      e.preventDefault(); return;
    }
    // Block any non-digit input (other than allowed control keys)
    if (!/[0-9]/.test(key) && key.length === 1) {
      e.preventDefault();
      return;
    }
    // Enforce max length (+639 + 9 digits = 13 chars)
    const currentDigitsAfterPrefix = value.slice(4).replace(/\D/g,'');
    if (/[0-9]/.test(key) && currentDigitsAfterPrefix.length >= 9 && selectionStart === selectionEnd) {
      e.preventDefault();
    }
  };

  const handlePhoneInput = (e) => {
    if (e.target.name !== 'phoneNumber') return;
    // Force sanitize in case of IME or browser autofill producing unexpected chars
    const raw = e.target.value;
    const digits = raw.replace(/\D/g,'')
    const first9 = digits.indexOf('9');
    const subscriber = first9 === -1 ? '' : digits.slice(first9 + 1, first9 + 10);
    const normalized = '+639' + subscriber;
    if (normalized !== formData.phoneNumber) {
      setFormData(prev => ({ ...prev, phoneNumber: normalized }));
    }
  };

  const handlePhoneBeforeInput = (e) => {
    if (e.target.name !== 'phoneNumber') return;
    if (e.data && !/^[0-9]$/.test(e.data)) {
      e.preventDefault();
    }
  };

  const handleImageChange = (e) => {
    if (e.target.files) {
      setImages(Array.from(e.target.files));
    }
  };

  const performSubmit = async () => {
    setLoading(true);
    try {
      // Validation: must be +639 followed by exactly 9 digits
      const phoneRaw = formData.phoneNumber.trim();
      if (!/^\+639\d{9}$/.test(phoneRaw)) {
        Swal.fire({
          icon: 'error',
          title: 'Invalid Phone Number',
          html: 'Enter a valid Philippine mobile number: +639 followed by 9 digits.',
          confirmButtonColor: '#3b5998'
        });
        setLoading(false);
        return;
      }
      if (!formData.password || !PASSWORD_POLICY.regex.test(formData.password)) {
        Swal.fire({
          icon: 'error',
          title: 'Weak Password',
          text: PASSWORD_POLICY.message,
          confirmButtonColor: '#3b5998'
        });
        setLoading(false);
        return;
      }
      const formDataToSend = new FormData();
      formDataToSend.append('firstName', formData.firstName);
      formDataToSend.append('lastName', formData.lastName);
      formDataToSend.append('phoneNumber', formData.phoneNumber);
      formDataToSend.append('address', formData.address);
      formDataToSend.append('email', formData.email);
      formDataToSend.append('password', formData.password);
      if (formData.profilePicture) {
        formDataToSend.append('profilePicture', formData.profilePicture);
      }
      if (images && images.length > 0) {
        images.forEach(image => formDataToSend.append('credentials', image));
      }
      formDataToSend.append('acceptedTerms', acceptedTerms ? 'true' : 'false');
      formDataToSend.append('acceptedPrivacy', acceptedPrivacy ? 'true' : 'false');
      formDataToSend.append('policiesVersion', POLICIES_VERSION);
      const token = localStorage.getItem('token');
  const response = await axios.post(`${API_BASE}/api/auth/google-signup`, formDataToSend, {
        headers: { 'Content-Type': 'multipart/form-data', ...(token ? { Authorization: `Bearer ${token}` } : {}) }
      });
      if (response.data.user) {
        Swal.fire({
          icon: 'success',
          title: 'Profile Completed!',
          text: 'You are now signed up! Please wait for the admin to verify your account before logging in.',
          confirmButtonColor: '#3b5998',
          customClass: { popup: 'swal2-rounded' }
        }).then(()=>navigate('/login'));
      }
    } catch (err) {
      Swal.fire({
        icon: 'error',
        title: 'Submission Failed',
        text: 'Failed to complete profile. Please try again.',
        confirmButtonColor: '#c62828',
        customClass: { popup: 'swal2-rounded' }
      });
    } finally {
      setLoading(false);
      setPendingSubmit(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (!(acceptedTerms && acceptedPrivacy)) {
      setPendingSubmit(true);
      if (!acceptedTerms) fetchPolicy('terms'); else fetchPolicy('privacy');
      return;
    }
    performSubmit();
  };

  return (
    <div className="complete-profile-layout">
      <div className="complete-profile-card">
      <h2 className="complete-profile-title">Complete Your Profile</h2>
      {formData.profilePicture && (
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 18 }}>
          <img
            src={formData.profilePicture}
            alt="Profile Preview"
            style={{ width: 72, height: 72, borderRadius: '50%', objectFit: 'cover', border: '2px solid #3b5998', background: '#fff' }}
          />
        </div>
      )}
      {success && <div className="success-message">{success}</div>}
      {error && <div className="error-message">{error}</div>}
      <form onSubmit={handleSubmit} className="complete-profile-form">
        <div className="form-group">
          <label htmlFor="firstName">First Name</label>
          <input
            type="text"
            name="firstName"
            id="firstName"
            value={formData.firstName}
            onChange={handleChange}
            placeholder="First Name"
            required
          />
        </div>
        <div className="form-group">
          <label htmlFor="lastName">Last Name</label>
          <input
            type="text"
            name="lastName"
            id="lastName"
            value={formData.lastName}
            onChange={handleChange}
            placeholder="Last Name"
            required
          />
        </div>
        <div className="form-group">
          <label htmlFor="phoneNumber">Phone Numbers</label>
          <input
            type="tel"
            name="phoneNumber"
            id="phoneNumber"
            value={formData.phoneNumber}
            onChange={handleChange}
            onKeyDown={handlePhoneKeyDown}
            onPaste={handlePhonePaste}
            onBeforeInput={handlePhoneBeforeInput}
            onInput={handlePhoneInput}
            inputMode="numeric"
            placeholder="Phone Number"
            required
            pattern="^\+639\d{9}$"
            maxLength={13}
            title="Format: +639XXXXXXXXX"
          />
        </div>
        <div className="form-group">
          <label htmlFor="password">Password</label>
          <div className="password-input-container">
            <input
              type={showPassword ? 'text' : 'password'}
              name="password"
              id="password"
              value={formData.password}
              onChange={handleChange}
              placeholder="Set a strong password"
              required
              pattern={passwordHtmlPattern}
              title={PASSWORD_POLICY.message}
              autoComplete="new-password"
            />
            <button
              type="button"
              className={`password-toggle ${showPassword ? 'show' : ''}`}
              onClick={()=>setShowPassword(p=>!p)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            />
          </div>
          <small style={{display:'block',marginTop:4,fontSize:12,color:'#555'}}>
            {PASSWORD_POLICY.message}
          </small>
        </div>
        <div className="form-group">
          <label htmlFor="address">Address</label>
          <input
            type="text"
            name="address"
            id="address"
            value={formData.address}
            onChange={handleChange}
            placeholder="Address"
            required
          />
        </div>
        <div className="form-group">
          <label>Upload Credentials (ID, etc.)</label>
          <input
            type="file"
            multiple
            accept="image/*,.pdf,.doc,.docx"
            onChange={handleImageChange}
            required
          />
        </div>
        <p className="policy-disclaimer">
          By completing your profile, you agree to our{' '}
          <button type="button" onClick={()=>fetchPolicy('terms')}>Terms & Conditions</button>{' '}and{' '}
          <button type="button" onClick={()=>fetchPolicy('privacy')}>Privacy Policy</button>. Version {POLICIES_VERSION}
        </p>
        <button type="submit" disabled={loading}>
          {loading ? 'Submitting...' : (acceptedTerms && acceptedPrivacy ? 'Submit' : 'Continue & Accept Policies')}
        </button>
      </form>
      {showPoliciesModal && (
        <div className="modal-overlay" onClick={()=>setShowPoliciesModal(false)}>
          <div className="credential-modal" onClick={e=>e.stopPropagation()}>
            <div className="modal-header" style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <h3 style={{ margin:0 }}>{activePolicy === 'terms' ? 'Terms & Conditions' : 'Privacy Policy'}</h3>
              <button className="modal-close-x" type="button" aria-label="Close" onClick={()=>setShowPoliciesModal(false)} />
            </div>
            <div ref={modalScrollRef} style={{ maxHeight:'55vh', overflowY:'auto', marginTop:16, paddingRight:8 }}>
              {renderMarkdown(policyContent)}
            </div>
            <div style={{ marginTop:16, display:'flex', gap:12, justifyContent:'flex-end', alignItems:'center' }}>
              {((activePolicy==='terms' && !acceptedTerms) || (activePolicy==='privacy' && !acceptedPrivacy)) && (
                <button disabled={!scrolledToBottom} onClick={()=>{
                  if (activePolicy==='terms') setAcceptedTerms(true); else setAcceptedPrivacy(true);
                  setShowPoliciesModal(false);
                  setTimeout(()=>{
                    const termsAccepted = activePolicy==='terms' ? true : acceptedTerms;
                    const privacyAccepted = activePolicy==='privacy' ? true : acceptedPrivacy;
                    if (pendingSubmit) {
                      if (!termsAccepted) { fetchPolicy('terms'); return; }
                      if (!privacyAccepted) { fetchPolicy('privacy'); return; }
                      performSubmit();
                    }
                  },30);
                }} className="action-btn" style={{ background: scrolledToBottom? '#1d4ed8':'#93c5fd', color:'#fff', cursor: scrolledToBottom? 'pointer':'not-allowed' }}>
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
    </div>
  );
};

export default CompleteProfile;
