import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { useLocation, useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';
import './CompleteProfile.css';

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
    phoneNumber: '',
    address: '',
    email: initialEmail,
    profilePicture: initialProfilePicture
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

  // Restore previously accepted policies if present
  useEffect(()=>{
    try {
      if (localStorage.getItem('policy_accept_terms')) setAcceptedTerms(true);
      if (localStorage.getItem('policy_accept_privacy')) setAcceptedPrivacy(true);
    } catch {}
  },[]);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleImageChange = (e) => {
    if (e.target.files) {
      setImages(Array.from(e.target.files));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      const formDataToSend = new FormData();
      formDataToSend.append('firstName', formData.firstName);
      formDataToSend.append('lastName', formData.lastName);
      formDataToSend.append('phoneNumber', formData.phoneNumber);
      formDataToSend.append('address', formData.address);
      formDataToSend.append('email', formData.email);
      if (formData.profilePicture) {
        formDataToSend.append('profilePicture', formData.profilePicture);
      }
      if (images && images.length > 0) {
        images.forEach(image => {
          formDataToSend.append('credentials', image);
        });
      }
  formDataToSend.append('acceptedTerms', acceptedTerms ? 'true' : 'false');
  formDataToSend.append('acceptedPrivacy', acceptedPrivacy ? 'true' : 'false');
      formDataToSend.append('policiesVersion', POLICIES_VERSION);
      const token = localStorage.getItem('token');
      const response = await axios.post(
        'https://capstone-sumbong.onrender.com/api/auth/google-signup',
        formDataToSend,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
            ...(token ? { Authorization: `Bearer ${token}` } : {})
          }
        }
      );
      if (response.data.user) {
        Swal.fire({
          icon: 'success',
          title: 'Profile Completed!',
          text: 'You are now signed up! Please wait for the admin to verify your account before logging in.',
          confirmButtonColor: '#3b5998',
          customClass: { popup: 'swal2-rounded' }
        }).then(() => {
          navigate('/login');
        });
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
    }
  };

  return (
    <div className="complete-profile-container">
      <h2>Complete Your Profile</h2>
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
          <label htmlFor="phoneNumber">Phone Number</label>
          <input
            type="tel"
            name="phoneNumber"
            id="phoneNumber"
            value={formData.phoneNumber}
            onChange={handleChange}
            placeholder="Phone Number"
            required
          />
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
        <div className="form-group" style={{ marginTop: 8, display:'flex', flexDirection:'column', gap:4 }}>
          <div style={{ fontSize:13, lineHeight:'18px', display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
            <span style={{ whiteSpace:'nowrap' }}>I agree to the</span>
            <button type="button" onClick={()=>fetchPolicy('terms')} style={{ background:'none', border:'none', color:'#1d4ed8', cursor:'pointer', padding:0, fontWeight:500 }}>Terms & Conditions</button>
            {acceptedTerms ? (
              <span style={{ background:'#dcfce7', color:'#166534', fontSize:11, padding:'2px 6px', borderRadius:12, fontWeight:600 }}>ACCEPTED ✓</span>
            ) : (
              <span style={{ background:'#fef3c7', color:'#92400e', fontSize:11, padding:'2px 6px', borderRadius:12, fontWeight:600 }}>PENDING</span>
            )}
          </div>
          <div style={{ fontSize:13, lineHeight:'18px', display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
            <span style={{ whiteSpace:'nowrap' }}>I agree to the</span>
            <button type="button" onClick={()=>fetchPolicy('privacy')} style={{ background:'none', border:'none', color:'#1d4ed8', cursor:'pointer', padding:0, fontWeight:500 }}>Privacy Policy</button>
            {acceptedPrivacy ? (
              <span style={{ background:'#dcfce7', color:'#166534', fontSize:11, padding:'2px 6px', borderRadius:12, fontWeight:600 }}>ACCEPTED ✓</span>
            ) : (
              <span style={{ background:'#fef3c7', color:'#92400e', fontSize:11, padding:'2px 6px', borderRadius:12, fontWeight:600 }}>PENDING</span>
            )}
          </div>
          <small style={{ color:'#6b7280', marginTop:4 }}>Accept inside each modal after reading. Version {POLICIES_VERSION}</small>
        </div>
        <button type="submit" disabled={loading || !(acceptedTerms && acceptedPrivacy)}>
          {loading ? 'Submitting...' : 'Submit'}
        </button>
      </form>
      {showPoliciesModal && (
        <div className="modal-overlay" onClick={()=>setShowPoliciesModal(false)}>
          <div className="credential-modal" onClick={e=>e.stopPropagation()} style={{ maxWidth:720, width:'95%', padding:24, display:'flex', flexDirection:'column' }}>
            <div className="modal-header" style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <h3 style={{ margin:0 }}>{activePolicy === 'terms' ? 'Terms & Conditions' : 'Privacy Policy'}</h3>
              <button className="modal-close-x" type="button" aria-label="Close" onClick={()=>setShowPoliciesModal(false)} />
            </div>
            <div ref={modalScrollRef} style={{ maxHeight:'55vh', overflowY:'auto', marginTop:16, paddingRight:8 }}>
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
                <button disabled={!scrolledToBottom} onClick={()=>{
                  if (activePolicy==='terms') setAcceptedTerms(true); else setAcceptedPrivacy(true);
                  try { const now=new Date().toISOString(); localStorage.setItem(`policy_accept_${activePolicy}`, now); } catch {}
                  setShowPoliciesModal(false);
                }} className="action-btn" style={{ background: scrolledToBottom? '#1d4ed8':'#93c5fd', color:'#fff', cursor: scrolledToBottom? 'pointer':'not-allowed' }}>
                  Accept {activePolicy === 'terms' ? 'Terms' : 'Privacy'}
                </button>
              )}
              {((activePolicy==='terms' && acceptedTerms) || (activePolicy==='privacy' && acceptedPrivacy)) && (
                <span style={{ background:'#dcfce7', color:'#166534', fontSize:12, padding:'6px 10px', borderRadius:8, fontWeight:600 }}>Already Accepted</span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CompleteProfile;
