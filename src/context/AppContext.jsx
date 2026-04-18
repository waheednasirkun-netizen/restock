console.log('[RestoStock] AppContext.jsx loaded')

import { createContext, useContext, useState, useEffect, useMemo, useCallback, useRef } from 'react'
import {
  authApi, usersApi, templatesApi, suppliersApi,
  transactionsApi, demandsApi, procurementApi,
  purchaseOrdersApi, financialApi, activityApi,
} from '../lib/api'
import { supabase } from '../lib/supabase'
import { computeInventory } from '../lib/computeInventory'
import { lightTheme, darkTheme, DEFAULT_UNITS } from '../lib/constants'

const AppContext = createContext(null)

export const useApp = () => {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used inside AppProvider')
  return ctx
}

export function AppProvider({ children }) {

  // ── Auth state ─────────────────────────────────────────────────────────────
  const [user,      setUser]      = useState(null)
  const [authReady, setAuthReady] = useState(false)
  const [authError, setAuthError] = useState(null)

  // ── UI state ───────────────────────────────────────────────────────────────
  const [dark,          setDark]          = useState(() => localStorage.getItem('rs_dark') === 'true')
  const [tab,           setTab]           = useState('dashboard')
  const [sidebarOpen,   setSidebar]       = useState(window.innerWidth > 768)
  const [toasts,        setToasts]        = useState([])
  const [notifications, setNotifications] = useState([])
  const [systemEnabled, setSystemEnabled] = useState(true)
  const [systemMsg,     setSystemMsg]     = useState('System is currently under maintenance.')
  const [customUnits,   setCustomUnits]   = useState([])
  const [loading,       setLoading]       = useState(false)

  // ── Business data ──────────────────────────────────────────────────────────
  const [transactions,          setTransactions]          = useState([])
  const [demands,               setDemands]               = useState([])
  const [templates,             setTemplates]             = useState([])
  const [suppliers,             setSuppliers]             = useState([])
  const [users,                 setUsers]                 = useState([])
  const [procurements,          setProcurements]          = useState([])
  const [purchaseOrders,        setPurchaseOrders]        = useState([])
  const [financialTransactions, setFinancialTransactions] = useState([])
  const [activityLogs,          setActivityLogs]          = useState([])
  const [dataLoaded,            setDataLoaded]            = useState(false)

  const theme = dark ? darkTheme : lightTheme

  useEffect(() => { localStorage.setItem('rs_dark', dark) }, [dark])

  // ── Inventory — derived, never stored ─────────────────────────────────────
  const inventory = useMemo(
    () => computeInventory(transactions, templates),
    [transactions, templates]
  )

  // ── Stats ──────────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const lowStock      = inventory.filter(i => i.quantity <= (i.minQty || 0) && i.minQty > 0)
    const critical      = inventory.filter(i => i.status === 'Critical')
    const stockInTotal  = transactions.filter(t => t.type === 'Stock IN')
      .reduce((s, t) => s + Math.abs(Number(t.quantity || t.qty) || 0), 0)
    const stockOutTotal = transactions.filter(t => ['Stock OUT', 'Wastage'].includes(t.type))
      .reduce((s, t) => s + Math.abs(Number(t.quantity || t.qty) || 0), 0)
    const invValue = inventory.reduce((s, i) => s + (Number(i.quantity) || 0) * (Number(i.cost) || 0), 0)
    return {
      totalItems:      inventory.length,
      lowStockCount:   lowStock.length,
      criticalCount:   critical.length,
      stockInTotal,
      stockOutTotal,
      activeSuppliers: suppliers.length,
      inventoryValue:  invValue,
    }
  }, [inventory, transactions, suppliers])

  const allUnits = useMemo(
    () => [...new Set([...DEFAULT_UNITS, ...customUnits])],
    [customUnits]
  )

  // ── Toast helpers ──────────────────────────────────────────────────────────
  const showToast = useCallback((type, title, msg, duration = 4500) => {
    const id = Date.now() + Math.random()
    setToasts(prev => [...prev.slice(-4), { id, type, title, msg }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), duration)
  }, [])

  const dismissToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  const addNotification = useCallback((notif) => {
    const time = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
    setNotifications(prev => [
      { id: Date.now(), time: `Just now (${time})`, read: false, ...notif },
      ...prev.slice(0, 29),
    ])
  }, [])

  const markAllRead = useCallback(() => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
  }, [])

  // ── Clear data on logout ───────────────────────────────────────────────────
  const clearData = useCallback(() => {
    setTransactions([])
    setDemands([])
    setTemplates([])
    setSuppliers([])
    setUsers([])
    setProcurements([])
    setPurchaseOrders([])
    setFinancialTransactions([])
    setActivityLogs([])
    setDataLoaded(false)
  }, [])

  // ── Load all business data ─────────────────────────────────────────────────
  const loadAllData = useCallback(async (loggedInUser) => {
    const branchId = loggedInUser?.branch_id ?? null

    if (!branchId) {
      console.warn('[AppContext] loadAllData: no branch_id — skipping fetch')
      setDataLoaded(true)
      return
    }

    console.log('[AppContext] loadAllData start — branch:', branchId)
    setLoading(true)
    try {
      const [
        txnRes, demRes, tmplRes, supRes,
        usrRes, procRes, poRes, finRes, actRes,
      ] = await Promise.all([
        transactionsApi.getAll(branchId),
        demandsApi.getAll(branchId),
        templatesApi.getAll(branchId),
        suppliersApi.getAll(branchId),
        usersApi.getAll(),
        procurementApi.getAll(branchId),
        purchaseOrdersApi.getAll(branchId),
        financialApi.getAll(branchId),
        activityApi.getAll(branchId),
      ])

      if (txnRes.error)  console.error('[AppContext] transactions:', txnRes.error.message)
      if (demRes.error)  console.error('[AppContext] demands:', demRes.error.message)
      if (tmplRes.error) console.error('[AppContext] templates:', tmplRes.error.message)
      if (supRes.error)  console.error('[AppContext] suppliers:', supRes.error.message)
      if (usrRes.error)  console.error('[AppContext] users:', usrRes.error.message)
      if (procRes.error) console.error('[AppContext] procurement:', procRes.error.message)
      if (poRes.error)   console.error('[AppContext] purchase orders:', poRes.error.message)
      if (finRes.error)  console.error('[AppContext] financials:', finRes.error.message)
      if (actRes.error)  console.error('[AppContext] activity logs:', actRes.error.message)

      if (txnRes.data)  setTransactions(txnRes.data)
      if (demRes.data)  setDemands(demRes.data)
      if (tmplRes.data) setTemplates(tmplRes.data)
      if (supRes.data)  setSuppliers(supRes.data)
      if (usrRes.data)  setUsers(usrRes.data)
      if (procRes.data) setProcurements(procRes.data)
      if (poRes.data)   setPurchaseOrders(poRes.data)
      if (finRes.data)  setFinancialTransactions(finRes.data)
      if (actRes.data)  setActivityLogs(actRes.data)

      setDataLoaded(true)
      console.log('[AppContext] loadAllData complete ✓', {
        transactions: txnRes.data?.length ?? 0,
        demands:      demRes.data?.length ?? 0,
        templates:    tmplRes.data?.length ?? 0,
        suppliers:    supRes.data?.length ?? 0,
      })
    } catch (err) {
      console.error('[AppContext] loadAllData error:', err)
      showToast('error', 'Load Failed', 'Could not load data. Check console for details.')
      setDataLoaded(true)
    } finally {
      setLoading(false)
    }
  }, [showToast])

  // ── Supabase Auth session listener ─────────────────────────────────────────
  //
  // THE FIX: dependency array is [] so this runs exactly once on mount.
  //
  // Problem with the old code: the dep array included authReady, loading,
  // dataLoaded, and user — state values that change during auth. Every change
  // caused the effect to re-run: unsubscribe the old listener, subscribe a new
  // one, which fired INITIAL_SESSION again, which triggered loadAllData again,
  // which updated state, which re-ran the effect... infinite loop.
  //
  // Fix: store loadAllData and clearData in refs. The effect closure always
  // reads the latest function version through the ref, but the effect itself
  // never needs to re-run when those functions change. Stable subscription,
  // no loops.
  //
  const sessionHandledByLogin = useRef(false)
  const loadAllDataRef         = useRef(loadAllData)
  const clearDataRef           = useRef(clearData)

  // Keep refs current whenever the callbacks are recreated (safe, no effect re-run)
  useEffect(() => { loadAllDataRef.current = loadAllData }, [loadAllData])
  useEffect(() => { clearDataRef.current   = clearData   }, [clearData])

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('[AppContext] auth event:', event)

        if (event === 'INITIAL_SESSION') {
  console.log('[INITIAL_SESSION]', session)

  if (!session) {
    setAuthReady(true)
    return
  }

  const { data: restoredUser, error } = await authApi.restoreSession()

  if (error || !restoredUser) {
    console.error('[INITIAL_SESSION] restore failed')
    setAuthReady(true)
    return
  }

  console.log('[INITIAL USER]', restoredUser)

  setUser(restoredUser)

  await loadAllDataRef.current(restoredUser)

  setAuthReady(true)

  return
}

        if (event === 'SIGNED_IN') {
  console.log('[SIGNED_IN EVENT]')

  if (!session) return

  const { data: restoredUser, error } = await authApi.restoreSession()

  if (error || !restoredUser) {
    console.error('[SIGNED_IN] restore failed')
    return
  }

  console.log('[SIGNED_IN USER]', restoredUser)

  setUser(restoredUser)

  await loadAllDataRef.current(restoredUser)

  setAuthReady(true)

  return
}

        if (event === 'SIGNED_OUT') {
          setUser(null)
          clearDataRef.current()
          setTab('dashboard')
          return
        }

        // TOKEN_REFRESHED — no action needed
      }
    )

    return () => subscription.unsubscribe()
  }, []) // ← empty array: subscribe once, never re-subscribe

  // ── Login ──────────────────────────────────────────────────────────────────
  const login = useCallback(async (email, password) => {
  console.log('[AppContext] login:', email)
  setAuthError(null)

  const { data: loggedInUser, error } = await authApi.login(email, password)

  if (error) {
    setAuthError(error.message)
    return { error }
  }

  // 🚨 DO NOT load data here
  // Supabase SIGNED_IN event will handle everything

  return { data: loggedInUser }
}, [])

  // ── Logout ─────────────────────────────────────────────────────────────────
  const logout = useCallback(async () => {
    await authApi.logout()
    // SIGNED_OUT event handles clearing state
  }, [])

  // ── Action lock ────────────────────────────────────────────────────────────
  const actionInProgress = useRef(false)
  const withActionLock = useCallback(async (fn) => {
    if (actionInProgress.current) return false
    actionInProgress.current = true
    try { return await fn() }
    finally { actionInProgress.current = false }
  }, [])

  // ── Stock IN ───────────────────────────────────────────────────────────────
  const handleStockIn = useCallback(async (formData) => {
    return withActionLock(async () => {
      const { data, error } = await transactionsApi.stockIn({
        ...formData,
        branchId: user?.branch_id,
        userId:   user?.id,
        userName: user?.name,
      })
      if (error) { showToast('error', 'Stock IN Failed', error.message); return false }
      setTransactions(prev => [data, ...prev])
      addNotification({ title: 'Stock IN', msg: `${formData.qty} ${formData.unit} of ${formData.item}`, type: 'success' })
      showToast('success', 'Stock IN Recorded', `${formData.item} — ${formData.qty} ${formData.unit}`)
      return true
    })
  }, [user, withActionLock, addNotification, showToast])

  // ── Fulfill demand ─────────────────────────────────────────────────────────
  const handleFulfillDemand = useCallback(async ({ demandId, item, qty, unit }) => {
    return withActionLock(async () => {
      const { data, error } = await demandsApi.fulfill({
        demandId, item, qty, unit,
        branchId: user?.branch_id,
        userId:   user?.id,
        userName: user?.name,
      })
      if (error) { showToast('error', 'Fulfillment Failed', error.message); return false }
      const { data: txns } = await transactionsApi.getAll(user?.branch_id)
      if (txns) setTransactions(txns)
      setDemands(prev => prev.map(d => d.id === demandId ? { ...d, ...data } : d))
      showToast('success', 'Demand Fulfilled', `${qty} ${unit} of ${item} dispatched`)
      return true
    })
  }, [user, withActionLock, showToast])

  // ── Create demand ──────────────────────────────────────────────────────────
  const createDemand = useCallback(async (demandData) => {
    const invItem = inventory.find(i => i.name.toLowerCase() === demandData.name.toLowerCase())
    if (!invItem) return { blocked: true, reason: 'not_in_inventory', name: demandData.name,
      message: `"${demandData.name}" is not in inventory. Create a Procurement Request first.` }
    if (invItem.quantity <= 0) return { blocked: true, reason: 'out_of_stock', name: demandData.name,
      message: `"${demandData.name}" is out of stock.` }
    const qty = Number(demandData.qty)
    if (qty > invItem.quantity) return { blocked: true, reason: 'insufficient_stock',
      available: invItem.quantity, unit: invItem.unit,
      message: `Insufficient stock. Requested: ${qty} — Available: ${invItem.quantity} ${invItem.unit}` }
    const duplicate = demands.find(d =>
      d.status === 'Pending' &&
      (d.item_name || d.name)?.toLowerCase() === demandData.name?.toLowerCase() &&
      Number(d.qty || d.quantity) === qty &&
      d.department === demandData.department
    )
    if (duplicate) return { blocked: true, reason: 'duplicate', name: demandData.name,
      message: `A pending demand for "${demandData.name}" already exists for ${demandData.department}.` }

    const { data, error } = await demandsApi.create({
      branch_id:       user?.branch_id,
      item_name:       demandData.name,
      name:            demandData.name,
      category:        demandData.category,
      unit:            demandData.unit,
      quantity:        qty,
      qty,
      priority:        demandData.priority || 'Medium',
      department:      demandData.department,
      notes:           demandData.notes,
      requested_by:    user?.id,
      created_by_name: user?.name,
    })
    if (error) return { blocked: true, reason: 'db_error', message: error.message }
    setDemands(prev => [data, ...prev])
    return data
  }, [user, inventory, demands])

  // ── Templates ──────────────────────────────────────────────────────────────
  const createTemplate = useCallback(async (tmpl) => {
    const { data, error } = await templatesApi.create({ ...tmpl, branch_id: user?.branch_id, created_by: user?.id })
    if (error) { showToast('error', 'Failed', error.message); return null }
    setTemplates(prev => [...prev, data])
    return data
  }, [user, showToast])

  const updateTemplate = useCallback(async (id, updates) => {
    const { data, error } = await templatesApi.update(id, updates)
    if (error) { showToast('error', 'Failed', error.message); return }
    setTemplates(prev => prev.map(t => t.id === id ? { ...t, ...data } : t))
  }, [showToast])

  const deleteTemplate = useCallback(async (id) => {
    const { error } = await templatesApi.remove(id)
    if (error) { showToast('error', 'Failed', error.message); return }
    setTemplates(prev => prev.filter(t => t.id !== id))
  }, [showToast])

  // ── Suppliers ──────────────────────────────────────────────────────────────
  const createSupplier = useCallback(async (sup) => {
    const { data, error } = await suppliersApi.create({ ...sup, branch_id: user?.branch_id })
    if (error) { showToast('error', 'Failed', error.message); return null }
    setSuppliers(prev => [...prev, data])
    return data
  }, [user, showToast])

  const updateSupplier = useCallback(async (id, updates) => {
    const { data, error } = await suppliersApi.update(id, updates)
    if (error) { showToast('error', 'Failed', error.message); return }
    setSuppliers(prev => prev.map(s => s.id === id ? { ...s, ...data } : s))
  }, [showToast])

  const deleteSupplier = useCallback(async (id) => {
    const { error } = await suppliersApi.remove(id)
    if (error) { showToast('error', 'Failed', error.message); return }
    setSuppliers(prev => prev.filter(s => s.id !== id))
  }, [showToast])

  // ── Users ──────────────────────────────────────────────────────────────────
  const createUser = useCallback(async (userData) => {
    const { data, error } = await usersApi.create(userData)
    if (error) { showToast('error', 'Failed', error.message); return null }
    setUsers(prev => [...prev, data])
    return data
  }, [showToast])

  const updateUser = useCallback(async (id, updates) => {
    const { data, error } = await usersApi.update(id, updates)
    if (error) { showToast('error', 'Failed', error.message); return }
    setUsers(prev => prev.map(u => u.id === id ? { ...u, ...data } : u))
  }, [showToast])

  const deleteUser = useCallback(async (id) => {
    const { error } = await usersApi.remove(id)
    if (error) { showToast('error', 'Failed', error.message); return }
    setUsers(prev => prev.filter(u => u.id !== id))
  }, [showToast])

  // ── Procurement ────────────────────────────────────────────────────────────
  const createProcurement = useCallback(async (req) => {
    const { data, error } = await procurementApi.create({ ...req, branch_id: user?.branch_id, created_by: user?.id })
    if (error) { showToast('error', 'Failed', error.message); return null }
    setProcurements(prev => [data, ...prev])
    return data
  }, [user, showToast])

  const updateProcurementStatus = useCallback(async (id, status) => {
    const { data, error } = await procurementApi.updateStatus(id, status, user?.id)
    if (error) { showToast('error', 'Failed', error.message); return }
    setProcurements(prev => prev.map(p => p.id === id ? { ...p, ...data } : p))
  }, [user, showToast])

  const deleteProcurement = useCallback(async (id) => {
    const { error } = await procurementApi.remove(id)
    if (error) { showToast('error', 'Failed', error.message); return }
    setProcurements(prev => prev.filter(p => p.id !== id))
  }, [showToast])

  // ── Purchase orders ────────────────────────────────────────────────────────
  const createPurchaseOrder = useCallback(async ({ po, items }) => {
    const { data, error } = await purchaseOrdersApi.create({
      po: { ...po, branch_id: user?.branch_id, created_by: user?.id },
      items,
    })
    if (error) { showToast('error', 'Failed', error.message); return null }
    setPurchaseOrders(prev => [data, ...prev])
    return data
  }, [user, showToast])

  const updatePOStatus = useCallback(async (id, status) => {
    const { data, error } = await purchaseOrdersApi.updateStatus(id, status, user?.id)
    if (error) { showToast('error', 'Failed', error.message); return }
    setPurchaseOrders(prev => prev.map(p => p.id === id ? { ...p, ...data } : p))
  }, [user, showToast])

  // ── Financial ──────────────────────────────────────────────────────────────
  const updateFinancialTxnStatus = useCallback(async (id, paymentStatus) => {
    const { data, error } = await financialApi.updatePaymentStatus(id, paymentStatus)
    if (error) { showToast('error', 'Failed', error.message); return }
    setFinancialTransactions(prev => prev.map(f => f.id === id ? { ...f, ...data } : f))
  }, [showToast])

  // ── Demand approve / reject / delete ──────────────────────────────────────
  const approveDemand = useCallback(async (id) => {
    const { data, error } = await demandsApi.approve(id, user?.id)
    if (error) { showToast('error', 'Failed', error.message); return }
    setDemands(prev => prev.map(d => d.id === id ? { ...d, ...data } : d))
  }, [user, showToast])

  const rejectDemand = useCallback(async (id, reason = '') => {
    const { data, error } = await demandsApi.reject(id, user?.id, reason)
    if (error) { showToast('error', 'Failed', error.message); return }
    setDemands(prev => prev.map(d => d.id === id ? { ...d, ...data } : d))
  }, [user, showToast])

  const deleteDemand = useCallback(async (id) => {
    const { error } = await demandsApi.remove(id)
    if (error) { showToast('error', 'Failed', error.message); return }
    setDemands(prev => prev.filter(d => d.id !== id))
  }, [showToast])

  // ── Context value ──────────────────────────────────────────────────────────
  const value = {
    user, setUser, login, logout,
    authReady, authError,
    dark, setDark, tab, setTab, sidebarOpen, setSidebar,
    theme, loading, dataLoaded,
    toasts, showToast, dismissToast,
    notifications, addNotification, markAllRead,
    systemEnabled, setSystemEnabled, systemMsg, setSystemMsg,
    transactions, setTransactions,
    demands, setDemands,
    templates, setTemplates,
    suppliers, setSuppliers,
    users, setUsers,
    procurements, setProcurements,
    purchaseOrders, setPurchaseOrders,
    financialTransactions, setFinancialTransactions,
    activityLogs,
    inventory, stats,
    customUnits, setCustomUnits, allUnits,
    handleStockIn,
    handleFulfillDemand,
    createDemand, approveDemand, rejectDemand, deleteDemand,
    createTemplate, updateTemplate, deleteTemplate,
    createSupplier, updateSupplier, deleteSupplier,
    createUser, updateUser, deleteUser,
    createProcurement, updateProcurementStatus, deleteProcurement,
    createPurchaseOrder, updatePOStatus,
    updateFinancialTxnStatus,
    withActionLock,
    loadAllData,
  }

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}
