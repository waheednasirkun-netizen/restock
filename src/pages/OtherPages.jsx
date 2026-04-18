/**
 * Remaining pages — all wired to Supabase via AppContext actions.
 * Exported individually so App.jsx can import them by name.
 */
import { useState, useMemo, useRef } from 'react'
import { useApp } from '../context/AppContext'
import { Ic, Btn, Modal, Card, EmptyState, StatusPill } from '../components/ui'
import { useConfirm } from '../components/ui'
import { fmtNum, fmtPKR, DEFAULT_UNITS, DEPARTMENTS, userCan } from '../lib/constants'

// ─── ITEM TEMPLATES ──────────────────────────────────────────────────────────
export function ItemTemplates() {
  const { templates, createTemplate, updateTemplate, deleteTemplate, theme, user, showToast, allUnits, setCustomUnits, customUnits } = useApp()
  const { confirm } = useConfirm()
  const [showModal, setShowModal] = useState(false)
  const [editing,   setEditing]   = useState(null)
  const [search,    setSearch]    = useState('')
  const [loading,   setLoading]   = useState(false)
  const [form, setForm] = useState({ name:'', category:'', unit:'pcs', defaultPrice:'', lowStockThreshold:'' })
  const [errors, setErrors] = useState({})
  const canManage = userCan('createTemplate', user?.role)

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return templates.filter(t => !q || t.name.toLowerCase().includes(q) || (t.category||'').toLowerCase().includes(q))
  }, [templates, search])

  const set = (k,v) => setForm(p => ({ ...p, [k]:v }))

  const openCreate = () => { setEditing(null); setForm({ name:'', category:'', unit:'pcs', defaultPrice:'', lowStockThreshold:'' }); setShowModal(true) }
  const openEdit   = (t)  => { setEditing(t); setForm({ name:t.name, category:t.category||'', unit:t.unit||'pcs', defaultPrice:t.defaultPrice||t.default_price||'', lowStockThreshold:t.lowStockThreshold||t.low_stock_threshold||'' }); setShowModal(true) }

  const handleSave = async () => {
    const errs = {}
    if (!form.name.trim()) errs.name = 'Name required'
    if (!form.category.trim()) errs.category = 'Category required'
    if (Object.keys(errs).length) { setErrors(errs); return }
    setLoading(true)
    try {
      const data = { 
  name: form.name.trim(), 
  category: form.category.trim(), 
  unit: form.unit,

  default_price: Math.max(0, Number(form.defaultPrice) || 0),
  low_stock_threshold: Math.max(0, Number(form.lowStockThreshold) || 0),

  enabled: true 
}
      if (editing) await updateTemplate(editing.id, data)
      else         await createTemplate(data)
      showToast('success', editing ? 'Template Updated' : 'Template Created', form.name)
      setShowModal(false); setErrors({})
    } finally { setLoading(false) }
  }

  const handleDelete = async (t) => {
    const ok = await confirm({ title:'Delete Template', message:`Delete "${t.name}"?`, variant:'danger', confirmLabel:'Delete' })
    if (!ok) return
    await deleteTemplate(t.id)
    showToast('info', 'Template Deleted', t.name)
  }

  return (
    <div className="animate-fade-in">
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
        <h2 style={{ fontSize:18, fontWeight:700, color:theme.text }}>Item Templates</h2>
        {canManage && <Btn variant="primary" onClick={openCreate}><Ic n="Plus" size={14} color="white"/> New Template</Btn>}
      </div>
      <Card style={{ marginBottom:16, padding:'12px 14px' }}>
        <div style={{ position:'relative' }}>
          <Ic n="Search" size={13} color="#9ca3af" style={{ position:'absolute', left:9, top:'50%', transform:'translateY(-50%)' }}/>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search templates…"
            style={{ width:'100%', padding:'8px 10px 8px 28px', border:`1px solid ${theme.inputBorder}`, borderRadius:7, fontSize:13, background:theme.inputBg, color:theme.text }}/>
        </div>
      </Card>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(260px,1fr))', gap:12 }}>
        {filtered.length === 0
          ? <EmptyState icon="Box" title="No templates" message="Create templates to speed up stock entry"/>
          : filtered.map(t => (
            <Card key={t.id}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:8 }}>
                <div>
                  <div style={{ fontSize:15, fontWeight:700, color:theme.text }}>{t.name}</div>
                  <div style={{ fontSize:12, color:theme.textMuted }}>{t.category} · {t.unit}</div>
                </div>
                {canManage && (
                  <div style={{ display:'flex', gap:4 }}>
                    <button onClick={() => openEdit(t)} style={{ background:'none', border:'none', cursor:'pointer', color:'#6b7280' }}><Ic n="Edit" size={14}/></button>
                    <button onClick={() => handleDelete(t)} style={{ background:'none', border:'none', cursor:'pointer', color:'#dc2626' }}><Ic n="Trash2" size={14}/></button>
                  </div>
                )}
              </div>
              <div style={{ display:'flex', gap:8 }}>
                {(t.defaultPrice||t.default_price) > 0 && (
                  <span style={{ fontSize:11, padding:'2px 8px', background:'#eff6ff', color:'#2563eb', borderRadius:6, fontWeight:500 }}>
                    {fmtPKR(t.defaultPrice||t.default_price)}
                  </span>
                )}
                {(t.lowStockThreshold||t.low_stock_threshold) > 0 && (
                  <span style={{ fontSize:11, padding:'2px 8px', background:'#fef9c3', color:'#854d0e', borderRadius:6, fontWeight:500 }}>
                    Min: {fmtNum(t.lowStockThreshold||t.low_stock_threshold)}
                  </span>
                )}
              </div>
            </Card>
          ))
        }
      </div>

      <Modal open={showModal} onClose={() => { setShowModal(false); setErrors({}) }} title={editing ? 'Edit Template' : 'New Template'}>
        {[['Item Name *','name','text'],['Category *','category','text']].map(([label,key,type]) => (
          <div key={key} style={{ marginBottom:14 }}>
            <label style={{ display:'block', fontSize:13, fontWeight:500, color:'#374151', marginBottom:5 }}>{label}</label>
            <input type={type} value={form[key]} onChange={e => set(key, e.target.value)}
              style={{ width:'100%', padding:'10px 12px', border:`1px solid ${errors[key]?'#ef4444':theme.inputBorder}`, borderRadius:8, fontSize:14, background:theme.inputBg, color:theme.text }}/>
            {errors[key] && <div className="field-error">{errors[key]}</div>}
          </div>
        ))}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12, marginBottom:18 }}>
          <div>
            <label style={{ display:'block', fontSize:13, fontWeight:500, color:'#374151', marginBottom:5 }}>Unit</label>
            <select value={form.unit} onChange={e => set('unit', e.target.value)}
              style={{ width:'100%', padding:'10px 12px', border:`1px solid ${theme.inputBorder}`, borderRadius:8, fontSize:13, background:theme.inputBg, color:theme.text }}>
              {allUnits.map(u => <option key={u}>{u}</option>)}
            </select>
          </div>
          <div>
            <label style={{ display:'block', fontSize:13, fontWeight:500, color:'#374151', marginBottom:5 }}>Default Price</label>
            <input type="number" value={form.defaultPrice} onChange={e => set('defaultPrice', e.target.value)} min="0" step="0.01" placeholder="0"
              style={{ width:'100%', padding:'10px 12px', border:`1px solid ${theme.inputBorder}`, borderRadius:8, fontSize:13, background:theme.inputBg, color:theme.text }}/>
          </div>
          <div>
            <label style={{ display:'block', fontSize:13, fontWeight:500, color:'#374151', marginBottom:5 }}>Low Stock Min</label>
            <input type="number" value={form.lowStockThreshold} onChange={e => set('lowStockThreshold', e.target.value)} min="0" step="0.01" placeholder="0"
              style={{ width:'100%', padding:'10px 12px', border:`1px solid ${theme.inputBorder}`, borderRadius:8, fontSize:13, background:theme.inputBg, color:theme.text }}/>
          </div>
        </div>
        <div style={{ display:'flex', justifyContent:'flex-end', gap:8 }}>
          <Btn variant="outline" onClick={() => { setShowModal(false); setErrors({}) }}>Cancel</Btn>
          <Btn variant="primary" onClick={handleSave} disabled={loading}>{loading ? 'Saving…' : (editing ? 'Update' : 'Create')}</Btn>
        </div>
      </Modal>
    </div>
  )
}

// ─── SUPPLIERS ────────────────────────────────────────────────────────────────
export function Suppliers() {
  const { suppliers, createSupplier, updateSupplier, deleteSupplier, theme, user, showToast } = useApp()
  const { confirm } = useConfirm()
  const [showModal, setShowModal] = useState(false)
  const [editing,   setEditing]   = useState(null)
  const [loading,   setLoading]   = useState(false)
  const [form, setForm] = useState({ name:'', phone:'', address:'', status:'Active', notes:'' })
  const [errors, setErrors] = useState({})
  const canManage = userCan('manageSuppliers', user?.role)

  const set = (k,v) => setForm(p => ({ ...p, [k]:v }))
  const openCreate = () => { setEditing(null); setForm({ name:'', phone:'', address:'', status:'Active', notes:'' }); setShowModal(true) }
  const openEdit   = (s)  => { setEditing(s); setForm({ name:s.name, phone:s.phone||'', address:s.address||'', status:s.status||'Active', notes:s.notes||'' }); setShowModal(true) }

  const handleSave = async () => {
    const errs = {}
    if (!form.name.trim()) errs.name = 'Name required'
    if (Object.keys(errs).length) { setErrors(errs); return }
    setLoading(true)
    try {
      if (editing) await updateSupplier(editing.id, form)
      else         await createSupplier(form)
      showToast('success', editing ? 'Supplier Updated' : 'Supplier Added', form.name)
      setShowModal(false); setErrors({})
    } finally { setLoading(false) }
  }

  const handleDelete = async (s) => {
    const ok = await confirm({ title:'Delete Supplier', message:`Delete "${s.name}"?`, variant:'danger', confirmLabel:'Delete' })
    if (!ok) return
    await deleteSupplier(s.id)
    showToast('info', 'Supplier Deleted', s.name)
  }

  return (
    <div className="animate-fade-in">
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
        <h2 style={{ fontSize:18, fontWeight:700, color:theme.text }}>Suppliers</h2>
        {canManage && <Btn variant="primary" onClick={openCreate}><Ic n="Plus" size={14} color="white"/> Add Supplier</Btn>}
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))', gap:14 }}>
        {suppliers.length === 0
          ? <EmptyState icon="Truck" title="No suppliers" message="Add your first supplier"/>
          : suppliers.map(s => (
            <Card key={s.id}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                <div>
                  <div style={{ fontSize:15, fontWeight:700, color:theme.text, marginBottom:4 }}>{s.name}</div>
                  {s.phone   && <div style={{ fontSize:12, color:theme.textMuted }}>📞 {s.phone}</div>}
                  {s.address && <div style={{ fontSize:12, color:theme.textMuted }}>📍 {s.address}</div>}
                </div>
                <div style={{ display:'flex', flexDirection:'column', gap:4, alignItems:'flex-end' }}>
                  <StatusPill status={s.status||'Active'}/>
                  {canManage && (
                    <div style={{ display:'flex', gap:4, marginTop:4 }}>
                      <button onClick={() => openEdit(s)} style={{ background:'none', border:'none', cursor:'pointer', color:'#6b7280' }}><Ic n="Edit" size={14}/></button>
                      <button onClick={() => handleDelete(s)} style={{ background:'none', border:'none', cursor:'pointer', color:'#dc2626' }}><Ic n="Trash2" size={14}/></button>
                    </div>
                  )}
                </div>
              </div>
            </Card>
          ))
        }
      </div>
      <Modal open={showModal} onClose={() => { setShowModal(false); setErrors({}) }} title={editing ? 'Edit Supplier' : 'Add Supplier'}>
        {[['Name *','name'],['Phone','phone'],['Address','address']].map(([label,key]) => (
          <div key={key} style={{ marginBottom:14 }}>
            <label style={{ display:'block', fontSize:13, fontWeight:500, color:'#374151', marginBottom:5 }}>{label}</label>
            <input value={form[key]} onChange={e => set(key, e.target.value)}
              style={{ width:'100%', padding:'10px 12px', border:`1px solid ${errors[key]?'#ef4444':theme.inputBorder}`, borderRadius:8, fontSize:14, background:theme.inputBg, color:theme.text }}/>
            {errors[key] && <div className="field-error">{errors[key]}</div>}
          </div>
        ))}
        <div style={{ marginBottom:18 }}>
          <label style={{ display:'block', fontSize:13, fontWeight:500, color:'#374151', marginBottom:5 }}>Status</label>
          <select value={form.status} onChange={e => set('status', e.target.value)}
            style={{ width:'100%', padding:'10px 12px', border:`1px solid ${theme.inputBorder}`, borderRadius:8, fontSize:13, background:theme.inputBg, color:theme.text }}>
            <option>Active</option><option>Inactive</option>
          </select>
        </div>
        <div style={{ display:'flex', justifyContent:'flex-end', gap:8 }}>
          <Btn variant="outline" onClick={() => { setShowModal(false); setErrors({}) }}>Cancel</Btn>
          <Btn variant="primary" onClick={handleSave} disabled={loading}>{loading ? 'Saving…' : (editing ? 'Update' : 'Add')}</Btn>
        </div>
      </Modal>
    </div>
  )
}

// ─── PROCUREMENT REQUESTS ─────────────────────────────────────────────────────
export function ProcurementRequests() {
  const { procurements, createProcurement, updateProcurementStatus, deleteProcurement, templates, theme, user, showToast } = useApp()
  const { confirm } = useConfirm()
  const [showModal, setShowModal] = useState(false)
  const [loading,   setLoading]   = useState(false)
  const [form, setForm] = useState({ item_name:'', quantity:'', unit:'pcs', priority:'Medium', notes:'' })
  const [errors, setErrors] = useState({})

  const set = (k,v) => setForm(p => ({ ...p, [k]:v }))

  const handleCreate = async () => {
    const errs = {}
    if (!form.item_name.trim()) errs.item_name = 'Item required'
    if (!form.quantity || Number(form.quantity) <= 0) errs.quantity = 'Qty required'
    if (Object.keys(errs).length) { setErrors(errs); return }
    setLoading(true)
    try {
      await createProcurement({ ...form, quantity: Number(form.quantity) })
      showToast('success', 'Procurement Request Created', form.item_name)
      setShowModal(false); setErrors({})
      setForm({ item_name:'', quantity:'', unit:'pcs', priority:'Medium', notes:'' })
    } finally { setLoading(false) }
  }

  const sorted = useMemo(() =>
    [...procurements].sort((a,b) => new Date(b.created_at||0) - new Date(a.created_at||0)),
    [procurements]
  )

  return (
    <div className="animate-fade-in">
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
        <h2 style={{ fontSize:18, fontWeight:700, color:theme.text }}>Procurement Requests</h2>
        <Btn variant="primary" onClick={() => setShowModal(true)}><Ic n="Plus" size={14} color="white"/> New Request</Btn>
      </div>
      <Card style={{ padding:0, overflow:'hidden' }}>
        {sorted.length === 0
          ? <EmptyState icon="ShoppingCart" title="No procurement requests"/>
          : (
            <div style={{ overflowX:'auto' }}>
              <table style={{ width:'100%', borderCollapse:'collapse' }}>
                <thead><tr style={{ background:theme.bg }}>
                  {['Item','Qty','Priority','Status','Notes','Date','Actions'].map(h => (
                    <th key={h} style={{ padding:'10px 14px', textAlign:'left', fontSize:12, fontWeight:600, color:theme.textMuted, borderBottom:`1px solid ${theme.border}`, whiteSpace:'nowrap' }}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {sorted.map(p => (
                    <tr key={p.id} style={{ borderBottom:`1px solid ${theme.border}` }}>
                      <td style={{ padding:'10px 14px', fontSize:13, fontWeight:600, color:theme.text }}>{p.item_name||p.name||'—'}</td>
                      <td style={{ padding:'10px 14px', fontSize:13, color:theme.textMuted }}>{fmtNum(p.quantity||p.qty)} {p.unit}</td>
                      <td style={{ padding:'10px 14px' }}><StatusPill status={p.priority||'Medium'}/></td>
                      <td style={{ padding:'10px 14px' }}><StatusPill status={p.status||'Open'}/></td>
                      <td style={{ padding:'10px 14px', fontSize:12, color:theme.textMuted }}>{p.notes||'—'}</td>
                      <td style={{ padding:'10px 14px', fontSize:12, color:theme.textMuted, whiteSpace:'nowrap' }}>
                        {p.created_at ? new Date(p.created_at).toLocaleDateString() : '—'}
                      </td>
                      <td style={{ padding:'10px 14px' }}>
                        <div style={{ display:'flex', gap:4 }}>
                          {p.status === 'Open' && userCan('closeProcurement', user?.role) && (
                            <button onClick={() => updateProcurementStatus(p.id, 'Closed')}
                              style={{ padding:'3px 8px', background:'#dcfce7', color:'#166534', border:'none', borderRadius:6, fontSize:11, fontWeight:600, cursor:'pointer' }}>
                              Close
                            </button>
                          )}
                          <button onClick={async () => {
                            const ok = await confirm({ title:'Delete', message:`Delete "${p.item_name||p.name}"?`, variant:'danger', confirmLabel:'Delete' })
                            if (ok) { await deleteProcurement(p.id); showToast('info','Deleted','') }
                          }} style={{ padding:'3px 6px', background:'transparent', color:'#9ca3af', border:'none', borderRadius:6, cursor:'pointer' }}>
                            <Ic n="Trash2" size={13}/>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        }
      </Card>
      <Modal open={showModal} onClose={() => { setShowModal(false); setErrors({}) }} title="New Procurement Request">
        {[['Item Name *','item_name'],['Notes','notes']].map(([label,key]) => (
          <div key={key} style={{ marginBottom:14 }}>
            <label style={{ display:'block', fontSize:13, fontWeight:500, color:'#374151', marginBottom:5 }}>{label}</label>
            <input value={form[key]} onChange={e => set(key, e.target.value)}
              style={{ width:'100%', padding:'10px 12px', border:`1px solid ${errors[key]?'#ef4444':theme.inputBorder}`, borderRadius:8, fontSize:14, background:theme.inputBg, color:theme.text }}/>
            {errors[key] && <div className="field-error">{errors[key]}</div>}
          </div>
        ))}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12, marginBottom:18 }}>
          <div>
            <label style={{ display:'block', fontSize:13, fontWeight:500, color:'#374151', marginBottom:5 }}>Qty *</label>
            <input type="number" value={form.quantity} onChange={e => set('quantity', e.target.value)} min="0.01" step="0.01"
              style={{ width:'100%', padding:'10px 12px', border:`1px solid ${errors.quantity?'#ef4444':theme.inputBorder}`, borderRadius:8, fontSize:14, background:theme.inputBg, color:theme.text }}/>
            {errors.quantity && <div className="field-error">{errors.quantity}</div>}
          </div>
          <div>
            <label style={{ display:'block', fontSize:13, fontWeight:500, color:'#374151', marginBottom:5 }}>Unit</label>
            <select value={form.unit} onChange={e => set('unit', e.target.value)}
              style={{ width:'100%', padding:'10px 12px', border:`1px solid ${theme.inputBorder}`, borderRadius:8, fontSize:13, background:theme.inputBg, color:theme.text }}>
              {DEFAULT_UNITS.map(u => <option key={u}>{u}</option>)}
            </select>
          </div>
          <div>
            <label style={{ display:'block', fontSize:13, fontWeight:500, color:'#374151', marginBottom:5 }}>Priority</label>
            <select value={form.priority} onChange={e => set('priority', e.target.value)}
              style={{ width:'100%', padding:'10px 12px', border:`1px solid ${theme.inputBorder}`, borderRadius:8, fontSize:13, background:theme.inputBg, color:theme.text }}>
              {['Critical','High','Medium','Low'].map(p => <option key={p}>{p}</option>)}
            </select>
          </div>
        </div>
        <div style={{ display:'flex', justifyContent:'flex-end', gap:8 }}>
          <Btn variant="outline" onClick={() => { setShowModal(false); setErrors({}) }}>Cancel</Btn>
          <Btn variant="primary" onClick={handleCreate} disabled={loading}>{loading ? 'Submitting…' : 'Submit Request'}</Btn>
        </div>
      </Modal>
    </div>
  )
}

// ─── PURCHASE ORDERS ──────────────────────────────────────────────────────────
export function PurchaseOrders() {
  const { purchaseOrders, updatePOStatus, suppliers, theme, user, showToast } = useApp()
  const sorted = useMemo(() => [...purchaseOrders].sort((a,b) => new Date(b.created_at||0) - new Date(a.created_at||0)), [purchaseOrders])
  return (
    <div className="animate-fade-in">
      <div style={{ marginBottom:20 }}>
        <h2 style={{ fontSize:18, fontWeight:700, color:theme.text }}>Purchase Orders</h2>
        <p style={{ fontSize:12, color:theme.textMuted }}>{purchaseOrders.length} orders</p>
      </div>
      <Card style={{ padding:0, overflow:'hidden' }}>
        {sorted.length === 0
          ? <EmptyState icon="FileText" title="No purchase orders" message="Purchase orders will appear here"/>
          : (
            <div style={{ overflowX:'auto' }}>
              <table style={{ width:'100%', borderCollapse:'collapse' }}>
                <thead><tr style={{ background:theme.bg }}>
                  {['PO #','Supplier','Total','Status','Date','Actions'].map(h => (
                    <th key={h} style={{ padding:'10px 14px', textAlign:'left', fontSize:12, fontWeight:600, color:theme.textMuted, borderBottom:`1px solid ${theme.border}` }}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {sorted.map(po => (
                    <tr key={po.id} style={{ borderBottom:`1px solid ${theme.border}` }}>
                      <td style={{ padding:'10px 14px', fontSize:13, fontWeight:600, color:theme.text }}>#{String(po.id).slice(-6)}</td>
                      <td style={{ padding:'10px 14px', fontSize:13, color:theme.textMuted }}>{po.supplier||po.supplier_name||'—'}</td>
                      <td style={{ padding:'10px 14px', fontSize:13, fontWeight:600, color:theme.text }}>{fmtPKR(po.total_amount||po.totalAmount||0)}</td>
                      <td style={{ padding:'10px 14px' }}><StatusPill status={po.status||'Ordered'}/></td>
                      <td style={{ padding:'10px 14px', fontSize:12, color:theme.textMuted }}>{po.created_at ? new Date(po.created_at).toLocaleDateString() : '—'}</td>
                      <td style={{ padding:'10px 14px' }}>
                        {userCan('markPOStatus', user?.role) && po.status === 'Ordered' && (
                          <button onClick={() => { updatePOStatus(po.id, 'Received'); showToast('success','PO Received','') }}
                            style={{ padding:'3px 8px', background:'#dcfce7', color:'#166534', border:'none', borderRadius:6, fontSize:11, fontWeight:600, cursor:'pointer' }}>
                            Mark Received
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        }
      </Card>
    </div>
  )
}

// ─── USER MANAGEMENT ──────────────────────────────────────────────────────────
export function UserManagement() {
  const { users, createUser, updateUser, deleteUser, theme, user: currentUser, showToast } = useApp()
  const { confirm } = useConfirm()
  const [showModal, setShowModal] = useState(false)
  const [editing,   setEditing]   = useState(null)
  const [loading,   setLoading]   = useState(false)
  const [form, setForm] = useState({ name:'', email:'', password:'', role:'Store Keeper', status:'Active', phone:'' })
  const [errors, setErrors] = useState({})

  const set = (k,v) => setForm(p => ({ ...p, [k]:v }))
  const openCreate = () => { setEditing(null); setForm({ name:'', email:'', password:'', role:'Store Keeper', status:'Active', phone:'' }); setShowModal(true) }
  const openEdit   = (u)  => { setEditing(u); setForm({ name:u.name, email:u.email, password:'', role:u.role, status:u.status||'Active', phone:u.phone||'' }); setShowModal(true) }

  const handleSave = async () => {
    const errs = {}
    if (!form.name.trim()) errs.name = 'Name required'
    if (!form.email.trim()) errs.email = 'Email required'
    if (!editing && !form.password.trim()) errs.password = 'Password required'
    if (Object.keys(errs).length) { setErrors(errs); return }
    setLoading(true)
    try {
      const data = { name: form.name, email: form.email, role: form.role, status: form.status, phone: form.phone }
      if (form.password) data.password = form.password
      if (editing) await updateUser(editing.id, data)
      else         await createUser(data)
      showToast('success', editing ? 'User Updated' : 'User Created', form.name)
      setShowModal(false); setErrors({})
    } finally { setLoading(false) }
  }

  const ROLES = ['Admin','Manager','Store Keeper','Kitchen Staff','Viewer']

  return (
    <div className="animate-fade-in">
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
        <h2 style={{ fontSize:18, fontWeight:700, color:theme.text }}>User Management</h2>
        <Btn variant="primary" onClick={openCreate}><Ic n="UserPlus" size={14} color="white"/> Add User</Btn>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))', gap:12 }}>
        {users.filter(u => !u._hidden).map(u => (
          <Card key={u.id}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
              <div style={{ display:'flex', gap:10, alignItems:'center' }}>
                <div style={{ width:40, height:40, borderRadius:10, background:'#eff6ff',
                  display:'flex', alignItems:'center', justifyContent:'center',
                  fontSize:14, fontWeight:700, color:'#2563eb', flexShrink:0 }}>
                  {(u.name||'U').slice(0,2).toUpperCase()}
                </div>
                <div>
                  <div style={{ fontSize:14, fontWeight:700, color:theme.text }}>{u.name}</div>
                  <div style={{ fontSize:12, color:theme.textMuted }}>{u.email}</div>
                  <div style={{ fontSize:11, color:'#7c3aed', marginTop:2 }}>{u.role}</div>
                </div>
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:4, alignItems:'flex-end' }}>
                <StatusPill status={u.status||'Active'}/>
                <div style={{ display:'flex', gap:4, marginTop:4 }}>
                  <button onClick={() => openEdit(u)} style={{ background:'none', border:'none', cursor:'pointer', color:'#6b7280' }}><Ic n="Edit" size={14}/></button>
                  {u.id !== currentUser?.id && (
                    <button onClick={async () => {
                      const ok = await confirm({ title:'Delete User', message:`Delete "${u.name}"?`, variant:'danger', confirmLabel:'Delete' })
                      if (ok) { await deleteUser(u.id); showToast('info','User Deleted',u.name) }
                    }} style={{ background:'none', border:'none', cursor:'pointer', color:'#dc2626' }}><Ic n="Trash2" size={14}/></button>
                  )}
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>
      <Modal open={showModal} onClose={() => { setShowModal(false); setErrors({}) }} title={editing ? 'Edit User' : 'Add User'}>
        {[['Full Name *','name'],['Email *','email']].map(([label,key]) => (
          <div key={key} style={{ marginBottom:14 }}>
            <label style={{ display:'block', fontSize:13, fontWeight:500, color:'#374151', marginBottom:5 }}>{label}</label>
            <input type={key==='email'?'email':'text'} value={form[key]} onChange={e => set(key, e.target.value)}
              style={{ width:'100%', padding:'10px 12px', border:`1px solid ${errors[key]?'#ef4444':theme.inputBorder}`, borderRadius:8, fontSize:14, background:theme.inputBg, color:theme.text }}/>
            {errors[key] && <div className="field-error">{errors[key]}</div>}
          </div>
        ))}
        <div style={{ marginBottom:14 }}>
          <label style={{ display:'block', fontSize:13, fontWeight:500, color:'#374151', marginBottom:5 }}>
            Password {editing ? '(leave blank to keep)' : '*'}
          </label>
          <input type="password" value={form.password} onChange={e => set('password', e.target.value)}
            style={{ width:'100%', padding:'10px 12px', border:`1px solid ${errors.password?'#ef4444':theme.inputBorder}`, borderRadius:8, fontSize:14, background:theme.inputBg, color:theme.text }}/>
          {errors.password && <div className="field-error">{errors.password}</div>}
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:18 }}>
          <div>
            <label style={{ display:'block', fontSize:13, fontWeight:500, color:'#374151', marginBottom:5 }}>Role</label>
            <select value={form.role} onChange={e => set('role', e.target.value)}
              style={{ width:'100%', padding:'10px 12px', border:`1px solid ${theme.inputBorder}`, borderRadius:8, fontSize:13, background:theme.inputBg, color:theme.text }}>
              {ROLES.map(r => <option key={r}>{r}</option>)}
            </select>
          </div>
          <div>
            <label style={{ display:'block', fontSize:13, fontWeight:500, color:'#374151', marginBottom:5 }}>Status</label>
            <select value={form.status} onChange={e => set('status', e.target.value)}
              style={{ width:'100%', padding:'10px 12px', border:`1px solid ${theme.inputBorder}`, borderRadius:8, fontSize:13, background:theme.inputBg, color:theme.text }}>
              <option>Active</option><option>Inactive</option>
            </select>
          </div>
        </div>
        <div style={{ display:'flex', justifyContent:'flex-end', gap:8 }}>
          <Btn variant="outline" onClick={() => { setShowModal(false); setErrors({}) }}>Cancel</Btn>
          <Btn variant="primary" onClick={handleSave} disabled={loading}>{loading ? 'Saving…' : (editing ? 'Update' : 'Create')}</Btn>
        </div>
      </Modal>
    </div>
  )
}

// ─── ACTIVITY LOG ─────────────────────────────────────────────────────────────
export function ActivityLog() {
  const { activityLogs, theme } = useApp()
  const sorted = useMemo(() => [...activityLogs].sort((a,b) => new Date(b.created_at||0) - new Date(a.created_at||0)), [activityLogs])
  return (
    <div className="animate-fade-in">
      <h2 style={{ fontSize:18, fontWeight:700, color:theme.text, marginBottom:20 }}>Activity Log</h2>
      <Card style={{ padding:0, overflow:'hidden' }}>
        {sorted.length === 0
          ? <EmptyState icon="Activity" title="No activity yet"/>
          : (
            <div style={{ overflowX:'auto' }}>
              <table style={{ width:'100%', borderCollapse:'collapse' }}>
                <thead><tr style={{ background:theme.bg }}>
                  {['Action','Details','User','Date'].map(h => (
                    <th key={h} style={{ padding:'10px 14px', textAlign:'left', fontSize:12, fontWeight:600, color:theme.textMuted, borderBottom:`1px solid ${theme.border}` }}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {sorted.map((log, i) => (
                    <tr key={log.id||i} style={{ borderBottom:`1px solid ${theme.border}` }}>
                      <td style={{ padding:'10px 14px' }}>
                        <span style={{ padding:'2px 8px', borderRadius:6, fontSize:11, fontWeight:600, background:'#eff6ff', color:'#2563eb' }}>
                          {log.action}
                        </span>
                      </td>
                      <td style={{ padding:'10px 14px', fontSize:13, color:theme.text }}>{log.details||'—'}</td>
                      <td style={{ padding:'10px 14px', fontSize:12, color:theme.textMuted }}>{log.user_name||log.userName||'—'}</td>
                      <td style={{ padding:'10px 14px', fontSize:12, color:theme.textMuted, whiteSpace:'nowrap' }}>
                        {log.created_at ? new Date(log.created_at).toLocaleString() : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        }
      </Card>
    </div>
  )
}

// ─── REPORTS (summary) ────────────────────────────────────────────────────────
export function Reports() {
  const { transactions, inventory, demands, financialTransactions, theme } = useApp()

  const stockIn  = transactions.filter(t => t.type === 'Stock IN')
  const stockOut = transactions.filter(t => t.type === 'Stock OUT' || t.type === 'Wastage')
  const totalSpend = financialTransactions.filter(f => f.type==='purchase').reduce((s,f) => s+(Number(f.total_amount||f.totalAmount)||0), 0)
  const unpaid     = financialTransactions.filter(f => f.payment_status==='unpaid'||f.paymentStatus==='unpaid').reduce((s,f) => s+(Number(f.total_amount||f.totalAmount)||0), 0)

  const stats = [
    { label:'Total Transactions',  value:transactions.length,   icon:'ArrowLeftRight', bg:'#eff6ff',  color:'#2563eb' },
    { label:'Stock IN events',     value:stockIn.length,         icon:'TrendingUp',     bg:'#dcfce7',  color:'#16a34a' },
    { label:'Stock OUT / Wastage', value:stockOut.length,        icon:'TrendingDown',   bg:'#fef9c3',  color:'#d97706' },
    { label:'Demands (total)',      value:demands.length,         icon:'ClipboardList',  bg:'#f3e8ff',  color:'#7c3aed' },
    { label:'Total Spend',          value:fmtPKR(totalSpend),     icon:'DollarSign',     bg:'#ecfeff',  color:'#0891b2' },
    { label:'Outstanding (unpaid)', value:fmtPKR(unpaid),        icon:'CreditCard',      bg:'#fee2e2',  color:'#dc2626' },
  ]

  // Top moving items
  const topItems = useMemo(() => {
    const counts = {}
    transactions.forEach(t => {
      const key = t.item_name || t.item || ''
      if (!key) return
      counts[key] = (counts[key]||0) + Math.abs(Number(t.quantity||t.qty)||0)
    })
    return Object.entries(counts).sort((a,b) => b[1]-a[1]).slice(0,8)
  }, [transactions])

  return (
    <div className="animate-fade-in">
      <h2 style={{ fontSize:18, fontWeight:700, color:theme.text, marginBottom:20 }}>Reports</h2>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(200px,1fr))', gap:14, marginBottom:24 }} className="grid-mobile-2">
        {stats.map(s => (
          <Card key={s.label} style={{ display:'flex', alignItems:'center', gap:14 }}>
            <div style={{ width:44, height:44, borderRadius:10, background:s.bg, flexShrink:0,
              display:'flex', alignItems:'center', justifyContent:'center' }}>
              <Ic n={s.icon} size={20} color={s.color}/>
            </div>
            <div>
              <div style={{ fontSize:18, fontWeight:800, color:'#111827' }}>{s.value}</div>
              <div style={{ fontSize:12, color:'#6b7280' }}>{s.label}</div>
            </div>
          </Card>
        ))}
      </div>
      <Card>
        <h3 style={{ fontSize:15, fontWeight:700, color:theme.text, marginBottom:14 }}>Top Moving Items</h3>
        {topItems.length === 0
          ? <EmptyState icon="BarChart2" title="No data yet"/>
          : topItems.map(([name, total], i) => {
              const max = topItems[0][1]
              return (
                <div key={name} style={{ marginBottom:10 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4, fontSize:13 }}>
                    <span style={{ fontWeight:500, color:theme.text }}>#{i+1} {name}</span>
                    <span style={{ color:theme.textMuted }}>{fmtNum(total)} units</span>
                  </div>
                  <div style={{ height:6, background:theme.border, borderRadius:3, overflow:'hidden' }}>
                    <div style={{ height:'100%', background:'#2563eb', borderRadius:3,
                      width:`${(total/max)*100}%`, transition:'width 0.5s ease' }}/>
                  </div>
                </div>
              )
            })
        }
      </Card>
    </div>
  )
}

// ─── INVENTORY EXPENSES ───────────────────────────────────────────────────────
export function InventoryExpenses() {
  const { financialTransactions, updateFinancialTxnStatus, theme, user } = useApp()
  const sorted = useMemo(() => [...financialTransactions].sort((a,b) => new Date(b.created_at||0) - new Date(a.created_at||0)), [financialTransactions])
  const canView = userCan('viewFinancials', user?.role)
  if (!canView) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', padding:60 }}>
      <div style={{ textAlign:'center' }}>
        <Ic n="Lock" size={40} color="#d1d5db" style={{ display:'block', margin:'0 auto 12px' }}/>
        <p style={{ color:'#6b7280', fontSize:14 }}>Access restricted to Admin / Manager</p>
      </div>
    </div>
  )
  return (
    <div className="animate-fade-in">
      <h2 style={{ fontSize:18, fontWeight:700, color:theme.text, marginBottom:20 }}>Inventory Expenses</h2>
      <Card style={{ padding:0, overflow:'hidden' }}>
        {sorted.length === 0
          ? <EmptyState icon="DollarSign" title="No financial records" message="Records appear automatically on Stock IN"/>
          : (
            <div style={{ overflowX:'auto' }}>
              <table style={{ width:'100%', borderCollapse:'collapse' }}>
                <thead><tr style={{ background:theme.bg }}>
                  {['Item','Category','Qty','Unit','Price/Unit','Total','Supplier','Payment','Date',''].map(h => (
                    <th key={h} style={{ padding:'10px 14px', textAlign:'left', fontSize:12, fontWeight:600, color:theme.textMuted, borderBottom:`1px solid ${theme.border}`, whiteSpace:'nowrap' }}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {sorted.map(f => {
                    const name = f.item_name||f.itemName||'—'
                    const ps   = f.payment_status||f.paymentStatus||'paid'
                    return (
                      <tr key={f.id} style={{ borderBottom:`1px solid ${theme.border}` }}>
                        <td style={{ padding:'10px 14px', fontSize:13, fontWeight:600, color:theme.text }}>{name}</td>
                        <td style={{ padding:'10px 14px', fontSize:12, color:theme.textMuted }}>{f.category||'—'}</td>
                        <td style={{ padding:'10px 14px', fontSize:13, color:theme.textMuted }}>{fmtNum(f.quantity)}</td>
                        <td style={{ padding:'10px 14px', fontSize:12, color:theme.textMuted }}>{f.unit||'—'}</td>
                        <td style={{ padding:'10px 14px', fontSize:13, color:theme.textMuted }}>{fmtPKR(f.price_per_unit||f.pricePerUnit||0)}</td>
                        <td style={{ padding:'10px 14px', fontSize:13, fontWeight:600, color:theme.text }}>{fmtPKR(f.total_amount||f.totalAmount||0)}</td>
                        <td style={{ padding:'10px 14px', fontSize:12, color:theme.textMuted }}>{f.supplier||'—'}</td>
                        <td style={{ padding:'10px 14px' }}><StatusPill status={ps}/></td>
                        <td style={{ padding:'10px 14px', fontSize:12, color:theme.textMuted, whiteSpace:'nowrap' }}>
                          {f.created_at ? new Date(f.created_at).toLocaleDateString() : '—'}
                        </td>
                        <td style={{ padding:'10px 14px' }}>
                          {ps === 'unpaid' && (
                            <button onClick={() => updateFinancialTxnStatus(f.id, 'paid')}
                              style={{ padding:'3px 8px', background:'#dcfce7', color:'#166534', border:'none', borderRadius:6, fontSize:11, fontWeight:600, cursor:'pointer' }}>
                              Mark Paid
                            </button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )
        }
      </Card>
    </div>
  )
}

// ─── SETTINGS ────────────────────────────────────────────────────────────────
export function SettingsPage() {
  const { dark, setDark, customUnits, setCustomUnits, systemEnabled, setSystemEnabled, systemMsg, setSystemMsg, theme, user, showToast, allUnits } = useApp()
  const [newUnit, setNewUnit] = useState('')

  const addUnit = () => {
    const u = newUnit.trim()
    if (!u) return
    if (allUnits.includes(u)) { showToast('warning','Already exists',`"${u}" is already a unit`); return }
    setCustomUnits(prev => [...prev, u])
    setNewUnit('')
    showToast('success','Unit Added',u)
  }

  return (
    <div className="animate-fade-in">
      <h2 style={{ fontSize:18, fontWeight:700, color:theme.text, marginBottom:20 }}>Settings</h2>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }} className="grid-mobile-1">
        <Card>
          <h3 style={{ fontSize:15, fontWeight:700, color:theme.text, marginBottom:14 }}>Appearance</h3>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <div>
              <div style={{ fontSize:14, fontWeight:500, color:theme.text }}>Dark Mode</div>
              <div style={{ fontSize:12, color:theme.textMuted }}>Switch between light and dark theme</div>
            </div>
            <button onClick={() => setDark(p => !p)}
              style={{ width:48, height:26, borderRadius:13, border:'none', cursor:'pointer',
                background: dark ? '#2563eb' : '#d1d5db', position:'relative', transition:'background 0.2s' }}>
              <span style={{ position:'absolute', top:3, transition:'left 0.2s',
                left: dark ? 24 : 2, width:20, height:20, background:'white', borderRadius:'50%' }}/>
            </button>
          </div>
        </Card>

        <Card>
          <h3 style={{ fontSize:15, fontWeight:700, color:theme.text, marginBottom:14 }}>Custom Units</h3>
          <div style={{ display:'flex', gap:8, marginBottom:12 }}>
            <input value={newUnit} onChange={e => setNewUnit(e.target.value)}
              onKeyDown={e => e.key==='Enter' && addUnit()}
              placeholder="e.g. crate, jar…"
              style={{ flex:1, padding:'8px 12px', border:`1px solid ${theme.inputBorder}`, borderRadius:7, fontSize:13, background:theme.inputBg, color:theme.text }}/>
            <Btn variant="primary" onClick={addUnit}>Add</Btn>
          </div>
          {customUnits.length > 0 && (
            <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
              {customUnits.map(u => (
                <span key={u} style={{ padding:'3px 10px', background:'#eff6ff', color:'#2563eb',
                  borderRadius:6, fontSize:12, display:'flex', alignItems:'center', gap:4 }}>
                  {u}
                  <button onClick={() => setCustomUnits(p => p.filter(x => x !== u))}
                    style={{ background:'none', border:'none', cursor:'pointer', color:'#9ca3af', padding:0, lineHeight:1 }}>✕</button>
                </span>
              ))}
            </div>
          )}
        </Card>

        {userCan('manageSystem', user?.role) && (
          <Card>
            <h3 style={{ fontSize:15, fontWeight:700, color:theme.text, marginBottom:14 }}>⚠️ System Control</h3>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
              <div>
                <div style={{ fontSize:14, fontWeight:500, color:theme.text }}>System {systemEnabled ? 'Enabled' : 'Disabled'}</div>
                <div style={{ fontSize:12, color:theme.textMuted }}>Disable to show maintenance overlay</div>
              </div>
              <button onClick={() => setSystemEnabled(p => !p)}
                style={{ width:48, height:26, borderRadius:13, border:'none', cursor:'pointer',
                  background: systemEnabled ? '#16a34a' : '#dc2626', position:'relative', transition:'background 0.2s' }}>
                <span style={{ position:'absolute', top:3, transition:'left 0.2s',
                  left: systemEnabled ? 24 : 2, width:20, height:20, background:'white', borderRadius:'50%' }}/>
              </button>
            </div>
            <textarea value={systemMsg} onChange={e => setSystemMsg(e.target.value)} rows={2}
              placeholder="Maintenance message…"
              style={{ width:'100%', padding:'8px 12px', border:`1px solid ${theme.inputBorder}`, borderRadius:7, fontSize:13, resize:'vertical', background:theme.inputBg, color:theme.text }}/>
          </Card>
        )}
      </div>
    </div>
  )
}
