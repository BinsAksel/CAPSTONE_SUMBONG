import React, { useState } from 'react';
import Swal from 'sweetalert2';
import { API_BASE } from '../../config/apiBase';
import '../../auth/Login.css';

const strongPw = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;

// Inline section to be embedded in a profile/settings area
const ChangePasswordSection = () => {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [show1, setShow1] = useState(false);
  const [show2, setShow2] = useState(false);
  const [show3, setShow3] = useState(false);

  const resetForm = () => {
    setCurrentPassword('');
    setNewPassword('');
    setConfirm('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;
    if (newPassword !== confirm) {
      return Swal.fire({ icon:'error', title:'Mismatch', text:'New passwords do not match', confirmButtonColor:'#1a365d' });
    }
    if (!strongPw.test(newPassword)) {
      return Swal.fire({ icon:'error', title:'Weak Password', text:'Need upper, lower, number, special, 8+ chars.', confirmButtonColor:'#1a365d' });
    }
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const resp = await fetch(`${API_BASE}/api/auth/change-password`, {
        method:'PATCH',
        headers: { 'Content-Type':'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ currentPassword, newPassword })
      });
      const data = await resp.json().catch(()=>({}));
      if (!resp.ok || !data.success) throw new Error(data.message || 'Change failed');
      Swal.fire({ icon:'success', title:'Password Changed', text:'Your password was updated.', confirmButtonColor:'#1a365d' });
      resetForm();
    } catch (e) {
      Swal.fire({ icon:'error', title:'Change Failed', text: e.message || 'Could not change password.', confirmButtonColor:'#1a365d' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ marginTop: 32 }}>
      <h3 style={{ marginBottom: 12 }}>Change Password</h3>
      <form onSubmit={handleSubmit} autoComplete="off" style={{ display:'flex', flexDirection:'column', gap:16, maxWidth:480 }}>
        <div className="form-group">
          <label htmlFor="current-password">Current Password</label>
          <div className="password-input-container">
            <input type={show1 ? 'text':'password'} id="current-password" value={currentPassword} onChange={e=>setCurrentPassword(e.target.value)} required autoComplete="current-password" />
            <button type="button" className={`password-toggle ${show1? 'show':''}`} onClick={()=>setShow1(p=>!p)} aria-label={show1? 'Hide password':'Show password'} />
          </div>
        </div>
        <div className="form-group">
          <label htmlFor="new-password">New Password</label>
          <div className="password-input-container">
            <input type={show2 ? 'text':'password'} id="new-password" value={newPassword} onChange={e=>setNewPassword(e.target.value)} required autoComplete="new-password" />
            <button type="button" className={`password-toggle ${show2? 'show':''}`} onClick={()=>setShow2(p=>!p)} aria-label={show2? 'Hide password':'Show password'} />
          </div>
          <small style={{ display:'block', marginTop:4, fontSize:12, color:'#4a5568' }}>Must include upper, lower, number, special, 8+ chars.</small>
        </div>
        <div className="form-group">
          <label htmlFor="confirm-new-password">Confirm New Password</label>
          <div className="password-input-container">
            <input type={show3 ? 'text':'password'} id="confirm-new-password" value={confirm} onChange={e=>setConfirm(e.target.value)} required autoComplete="new-password" />
            <button type="button" className={`password-toggle ${show3? 'show':''}`} onClick={()=>setShow3(p=>!p)} aria-label={show3? 'Hide password':'Show password'} />
          </div>
        </div>
        <div style={{ display:'flex', gap:12, flexWrap:'wrap' }}>
          <button type="submit" className="signin-button" disabled={loading} style={{ minHeight:44, position:'relative' }}>
            {loading ? 'Updating…' : 'Update Password'}
          </button>
          <button type="button" onClick={resetForm} className="ghost-btn" style={{ background:'transparent', border:'1px solid #cbd5e0', padding:'10px 18px', borderRadius:8, fontWeight:500 }}>Clear</button>
        </div>
      </form>
    </div>
  );
};

export default ChangePasswordSection;