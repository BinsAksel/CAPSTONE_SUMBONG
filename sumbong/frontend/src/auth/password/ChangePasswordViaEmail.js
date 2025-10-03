import React, { useState, useEffect } from 'react';
import Swal from 'sweetalert2';
import { API_BASE } from '../../config/apiBase';
import '../Login.css';
import BackButton from '../../components/BackButton';
import { useLocation, useNavigate } from 'react-router-dom';

const strongPw = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,}$/;

// Page reached via emailed link: /change-password?token=XYZ
// User must re-enter current password + new + confirm
const ChangePasswordViaEmail = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const params = new URLSearchParams(location.search);
  const token = params.get('token') || '';

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [showC, setShowC] = useState(false);
  const [showN, setShowN] = useState(false);
  const [showR, setShowR] = useState(false);

  useEffect(() => {
    if (!token) {
      Swal.fire({ icon:'error', title:'Invalid Link', text:'Missing or invalid change token.', confirmButtonColor:'#1a365d' })
        .then(()=> navigate('/dashboard', { replace:true }));
    }
  }, [token, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading || !token) return;
    if (newPassword !== confirm) {
      return Swal.fire({ icon:'error', title:'Mismatch', text:'New passwords do not match.', confirmButtonColor:'#1a365d' });
    }
    if (!strongPw.test(newPassword)) {
      return Swal.fire({ icon:'error', title:'Weak Password', text:'Need upper, lower, number, special, 8+ chars.', confirmButtonColor:'#1a365d' });
    }
    setLoading(true);
    try {
      const resp = await fetch(`${API_BASE}/api/auth/confirm-password-change`, {
        method:'POST',
        headers:{ 'Content-Type':'application/json' },
        body: JSON.stringify({ token, currentPassword, newPassword })
      });
      const data = await resp.json().catch(()=>({}));
      if (!resp.ok || !data.success) throw new Error(data.message || 'Update failed');
      Swal.fire({ icon:'success', title:'Password Updated', text:'Log in with your new password.', confirmButtonColor:'#1a365d' })
        .then(()=> navigate('/login', { replace:true }));
    } catch (e) {
      Swal.fire({ icon:'error', title:'Failed', text: e.message || 'Could not change password.', confirmButtonColor:'#1a365d' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-layout">
      <BackButton to="/login" />
      <div className="login-form-region" role="presentation">
        <div className="login-form-box" role="dialog" aria-modal="true" aria-labelledby="change-title">
          <h2 id="change-title">Set New Password</h2>
          <p style={{ marginTop:4, fontSize:14, lineHeight:'20px', color:'#2d3748' }}>
            Enter your current password and a new strong password.
          </p>
          <form onSubmit={handleSubmit} className="login-form" autoComplete="off">
            <div className="form-group">
              <label htmlFor="current-password">Current Password</label>
              <div className="password-input-container">
                <input type={showC? 'text':'password'} id="current-password" value={currentPassword} onChange={e=>setCurrentPassword(e.target.value)} required autoComplete="current-password" />
                <button type="button" className={`password-toggle ${showC? 'show':''}`} onClick={()=>setShowC(p=>!p)} aria-label={showC? 'Hide password':'Show password'} />
              </div>
            </div>
            <div className="form-group">
              <label htmlFor="new-password">New Password</label>
              <div className="password-input-container">
                <input type={showN? 'text':'password'} id="new-password" value={newPassword} onChange={e=>setNewPassword(e.target.value)} required autoComplete="new-password" />
                <button type="button" className={`password-toggle ${showN? 'show':''}`} onClick={()=>setShowN(p=>!p)} aria-label={showN? 'Hide password':'Show password'} />
              </div>
              <small style={{ display:'block', marginTop:4, fontSize:12, color:'#4a5568' }}>Must include upper, lower, number, special, 8+ chars.</small>
            </div>
            <div className="form-group">
              <label htmlFor="confirm-password">Confirm New Password</label>
              <div className="password-input-container">
                <input type={showR? 'text':'password'} id="confirm-password" value={confirm} onChange={e=>setConfirm(e.target.value)} required autoComplete="new-password" />
                <button type="button" className={`password-toggle ${showR? 'show':''}`} onClick={()=>setShowR(p=>!p)} aria-label={showR? 'Hide password':'Show password'} />
              </div>
            </div>
            <button type="submit" className="signin-button" disabled={loading || !token} style={{ position:'relative', minHeight:48 }}>
              {loading ? 'Updating…' : 'Update Password'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ChangePasswordViaEmail;
