console.log('[RestoStock] api.js loaded')

/**
 * RestoStock — src/lib/api.js
 *
 * ALL Supabase operations live here. No component imports supabase directly.
 * Every function returns { data, error }.
 *
 * Auth flow:
 *  1. supabase.auth.signInWithPassword  → sets auth.uid(), enables RLS
 *  2. fetchProfile(authId)              → reads public.users by auth_id
 *  3. fetchBranch(users.id)             → reads user_branch_mappings by users.id
 *  4. Returns merged object with branch_id attached
 *
 * public.users columns: id, auth_id, email, full_name, role, organization_id
 * NO password, NO status, NO name column — full_name is mapped to name.
 */

import { supabase } from './supabase'

const now = () => new Date().toISOString()

function wrap(data, error) {
  if (error) return { data: null, error: { message: error.message ?? String(error) } }
  return { data, error: null }
}

// ─── INTERNAL: fetch profile row from public.users ────────────────────────────
async function fetchProfile(authId) {
  console.log('[api] fetchProfile for auth id:', authId)
  const { data, error } = await supabase
    .from('users')
    .select('id, auth_id, email, full_name, role, organization_id, created_at')
    .eq('auth_id', authId)
    .maybeSingle()

  if (error) {
    console.error('[api] fetchProfile error:', error.message)
    return { profile: null, error }
  }
  if (!data) {
    console.error('[api] fetchProfile: no row found for auth_id', authId)
    return { profile: null, error: { message: 'No profile found for this account. Ask your administrator to add you.' } }
  }
  console.log('[api] fetchProfile success — users.id:', data.id, 'role:', data.role)
  return { profile: data, error: null }
}

// ─── INTERNAL: fetch branch via user_branch_mappings using users.id ───────────
async function fetchBranch(userId) {
  console.log('[api] fetchBranch for users.id:', userId)
  const { data, error } = await supabase
    .from('user_branch_mappings')
    .select('branch_id, branches(id, name, address, organizations(name))')
    .eq('user_id', userId)      // ← users.id, NOT auth_id
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (error) {
    console.error('[api] fetchBranch error:', error.message)
    return { branch: null, error }
  }
  if (!data) {
    console.warn('[api] fetchBranch: no branch mapping found for users.id', userId)
    return { branch: null, error: null }
  }
  console.log('[api] fetchBranch success — branch_id:', data.branches?.id, 'name:', data.branches?.name)
  return { branch: data.branches, error: null }
}

// ─── INTERNAL: build the merged user object AppContext stores ─────────────────
async function buildUser(authId) {
  const { profile, error: pe } = await fetchProfile(authId)
  if (pe) return { user: null, error: pe }

  const { branch, error: be } = await fetchBranch(profile.id)
  if (be) return { user: null, error: be }

  const user = {
    id:              profile.id,
    auth_id:         authId,
    email:           profile.email,
    name:            profile.full_name ?? profile.email.split('@')[0],
    full_name:       profile.full_name,
    role:            profile.role,
    organization_id: profile.organization_id ?? null,
    created_at:      profile.created_at,
    branch_id:       branch?.id   ?? null,
    branch_name:     branch?.name ?? null,
    org_name:        branch?.organizations?.name ?? null,
  }
  console.log('[api] buildUser complete:', { id: user.id, role: user.role, branch_id: user.branch_id })
  return { user, error: null }
}

// ─── AUTH ─────────────────────────────────────────────────────────────────────

export const authApi = {
  /**
   * Login via Supabase Auth.
   * Returns full merged user object with role and branch_id.
   */
  async login(email, password) {
    console.log('[api] authApi.login for:', email)
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    })

    if (authError) {
      console.error('[api] Supabase Auth error:', authError.message)
      const msg = authError.message.toLowerCase()
      if (msg.includes('invalid') || msg.includes('not found')) {
        return wrap(null, { message: 'Incorrect email or password.' })
      }
      if (msg.includes('confirmed')) {
        return wrap(null, { message: 'Please confirm your email first.' })
      }
      if (msg.includes('many')) {
        return wrap(null, { message: 'Too many attempts. Please wait.' })
      }
      return wrap(null, authError)
    }

    const { user, error: buildError } = await buildUser(authData.user.id)
    if (buildError) {
      await supabase.auth.signOut()
      return wrap(null, buildError)
    }
    return wrap(user, null)
  },

  /**
   * Restore an existing session (called on page refresh).
   * Returns full user object or null if no session.
   */
  async restoreSession() {
    console.log('[api] restoreSession')
    const { data: { session }, error } = await supabase.auth.getSession()
    if (error) return wrap(null, error)
    if (!session) { console.log('[api] no active session'); return wrap(null, null) }

    const { user, error: buildError } = await buildUser(session.user.id)
    if (buildError) return wrap(null, buildError)
    return wrap(user, null)
  },

  async logout() {
    const { error } = await supabase.auth.signOut()
    return wrap(null, error)
  },

  async getCurrentUserProfile() {
    const { data: { user: au }, error } = await supabase.auth.getUser()
    if (error || !au) return wrap(null, { message: 'Not authenticated' })
    const { user, error: be } = await buildUser(au.id)
    return wrap(user, be)
  },

  // Keep for admin lookup by app-level id
  async getUser(id) {
    const { data, error } = await supabase
      .from('users')
      .select('id, auth_id, email, full_name, role, organization_id, created_at')
      .eq('id', id)
      .single()
    if (data) data.name = data.full_name ?? data.email
    return wrap(data, error)
  },
}

// ─── ORGANIZATIONS ────────────────────────────────────────────────────────────

export const orgApi = {
  async getAll() {
    const { data, error } = await supabase
      .from('organizations').select('id, name, address, phone').order('name')
    return wrap(data, error)
  },
}

// ─── BRANCHES ─────────────────────────────────────────────────────────────────

export const branchApi = {
  async getAll() {
    const { data, error } = await supabase
      .from('branches').select('*, organizations(name)').order('name')
    return wrap(data, error)
  },

  async getForUser(userId) {
    const { data, error } = await supabase
      .from('user_branch_mappings')
      .select('branch_id, branches(id, name, address, phone, organizations(name))')
      .eq('user_id', userId)   // ← users.id, NOT auth_id
    if (error) return wrap(null, error)
    return wrap(data?.map(r => r.branches) ?? [], null)
  },
}

// ─── USERS ────────────────────────────────────────────────────────────────────

export const usersApi = {
  async getAll() {
    const { data, error } = await supabase
      .from('users')
      .select('id, auth_id, email, full_name, role, organization_id, created_at')
      .order('full_name')
    const normalised = data?.map(u => ({ ...u, name: u.full_name ?? u.email })) ?? null
    return wrap(normalised, error)
  },

  async create(userData) {
    // Strip columns that don't exist on the new schema
    const { password: _pw, status: _st, name: _n, ...safe } = userData
    const { data, error } = await supabase
      .from('users')
      .insert([{ ...safe, created_at: now() }])
      .select('id, auth_id, email, full_name, role, organization_id, created_at')
      .single()
    if (data) data.name = data.full_name ?? data.email
    return wrap(data, error)
  },

  async update(id, updates) {
    const { id: _id, created_at: _ca, auth_id: _ai, name: _n, password: _pw, status: _st, ...safe } = updates
    const { data, error } = await supabase
      .from('users')
      .update({ ...safe, updated_at: now() })
      .eq('id', id)
      .select('id, auth_id, email, full_name, role, organization_id, created_at')
      .single()
    if (data) data.name = data.full_name ?? data.email
    return wrap(data, error)
  },

  async remove(id) {
    const { error } = await supabase.from('users').delete().eq('id', id)
    return wrap(null, error)
  },
}

// ─── ITEM TEMPLATES ───────────────────────────────────────────────────────────

export const templatesApi = {
  async getAll(branchId) {
    if (!branchId) return wrap([], null)
    const { data, error } = await supabase
      .from('item_templates').select('*').eq('branch_id', branchId).order('name')
    return wrap(data, error)
  },

  async create(template) {
    const { data, error } = await supabase
      .from('item_templates')
      .insert([{ ...template, created_at: now() }])
      .select().single()
    return wrap(data, error)
  },

  async update(id, updates) {
    const { id: _id, created_at: _ca, ...safe } = updates
    const { data, error } = await supabase
      .from('item_templates')
      .update({ ...safe, updated_at: now() })
      .eq('id', id).select().single()
    return wrap(data, error)
  },

  async remove(id) {
    const { error } = await supabase.from('item_templates').delete().eq('id', id)
    return wrap(null, error)
  },
}

// ─── SUPPLIERS ────────────────────────────────────────────────────────────────

export const suppliersApi = {
  async getAll(branchId) {
    if (!branchId) return wrap([], null)
    const { data, error } = await supabase
      .from('suppliers').select('*').eq('branch_id', branchId).order('name')
    return wrap(data, error)
  },

  async create(supplier) {
    const { data, error } = await supabase
      .from('suppliers')
      .insert([{ ...supplier, created_at: now() }])
      .select().single()
    return wrap(data, error)
  },

  async update(id, updates) {
    const { id: _id, created_at: _ca, ...safe } = updates
    const { data, error } = await supabase
      .from('suppliers')
      .update({ ...safe, updated_at: now() })
      .eq('id', id).select().single()
    return wrap(data, error)
  },

  async remove(id) {
    const { error } = await supabase.from('suppliers').delete().eq('id', id)
    return wrap(null, error)
  },
}

// ─── TRANSACTIONS ─────────────────────────────────────────────────────────────

export const transactionsApi = {
  async getAll(branchId) {
    if (!branchId) return wrap([], null)
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('branch_id', branchId)
      .order('created_at', { ascending: false })
    return wrap(data, error)
  },

  async stockIn({ item, qty, unit, price, source, category, notes, branchId, userId, userName }) {
    const quantity     = Math.abs(Number(qty))
    const pricePerUnit = Math.max(0, Number(price) || 0)
    const totalAmount  = quantity * pricePerUnit

    const { data, error } = await supabase
      .from('transactions')
      .insert([{
        branch_id:      branchId,
        item_name:      String(item).trim(),
        type:           'Stock IN',
        quantity,
        unit,
        price_per_unit: pricePerUnit,
        total_amount:   totalAmount,
        source:         source ?? null,
        category:       category ?? null,
        notes:          notes ?? null,
        recorded_by:    userId,
        created_at:     now(),
      }])
      .select().single()

    if (error) return wrap(null, error)

    if (pricePerUnit > 0) {
      supabase.from('financial_transactions').insert([{
        branch_id:      branchId,
        type:           'purchase',
        item_name:      String(item).trim(),
        category,
        quantity,
        unit,
        price_per_unit: pricePerUnit,
        total_amount:   totalAmount,
        payment_status: 'unpaid',
        supplier:       source ?? null,
        recorded_by:    userId,
        reference_id:   data.id,
        created_at:     now(),
      }]).then(({ error: fe }) => {
        if (fe) console.warn('[api] financial insert failed:', fe.message)
      })
    }

    logActivity({ branchId, userId, userName, action: 'stock_in', details: `Stock IN: ${quantity} ${unit} of ${item}` })
    return wrap(data, null)
  },

  async stockOut({ item, qty, unit, type = 'Stock OUT', notes, branchId, userId, userName }) {
    const quantity = Math.abs(Number(qty))
    const { data, error } = await supabase
      .from('transactions')
      .insert([{
        branch_id:   branchId,
        item_name:   String(item).trim(),
        type,
        quantity,
        unit,
        notes:       notes ?? null,
        recorded_by: userId,
        created_at:  now(),
      }])
      .select().single()

    if (!error) {
      logActivity({ branchId, userId, userName, action: 'stock_out', details: `${type}: ${quantity} ${unit} of ${item}` })
    }
    return wrap(data, error)
  },
}

// ─── DEMANDS ──────────────────────────────────────────────────────────────────

export const demandsApi = {
  async getAll(branchId) {
    if (!branchId) return wrap([], null)
    const { data, error } = await supabase
      .from('demands')
      .select('*')
      .eq('branch_id', branchId)
      .order('created_at', { ascending: false })
    return wrap(data, error)
  },

  async create(demand) {
    const { data, error } = await supabase
      .from('demands')
      .insert([{ ...demand, status: 'Pending', created_at: now() }])
      .select().single()
    return wrap(data, error)
  },

  async approve(id, approvedBy) {
    const { data, error } = await supabase
      .from('demands')
      .update({ status: 'Approved', approved_by: approvedBy, approved_at: now() })
      .eq('id', id).select().single()
    return wrap(data, error)
  },

  async reject(id, rejectedBy, reason) {
    const { data, error } = await supabase
      .from('demands')
      .update({ status: 'Rejected', rejected_by: rejectedBy, rejection_reason: reason, updated_at: now() })
      .eq('id', id).select().single()
    return wrap(data, error)
  },

  async fulfill({ demandId, item, qty, unit, branchId, userId, userName }) {
    const { data: txnData, error: txnError } = await transactionsApi.stockOut({
      item, qty, unit,
      type:    'Fulfillment',
      notes:   `Fulfilled demand #${demandId}`,
      branchId, userId, userName,
    })
    if (txnError) return wrap(null, txnError)

    const { data, error } = await supabase
      .from('demands')
      .update({
        status:        'Fulfilled',
        fulfilled_by:  userId,
        fulfilled_at:  now(),
        fulfilled_qty: qty,
        txn_id:        txnData.id,
      })
      .eq('id', demandId).select().single()
    return wrap(data, error)
  },

  async remove(id) {
    const { error } = await supabase.from('demands').delete().eq('id', id)
    return wrap(null, error)
  },
}

// ─── PROCUREMENT ──────────────────────────────────────────────────────────────

export const procurementApi = {
  async getAll(branchId) {
    if (!branchId) return wrap([], null)
    const { data, error } = await supabase
      .from('procurement_requests')
      .select('*')
      .eq('branch_id', branchId)
      .order('created_at', { ascending: false })
    return wrap(data, error)
  },

  async create(req) {
    const { data, error } = await supabase
      .from('procurement_requests')
      .insert([{ ...req, status: 'Open', created_at: now() }])
      .select().single()
    return wrap(data, error)
  },

  async updateStatus(id, status, updatedBy) {
    const { data, error } = await supabase
      .from('procurement_requests')
      .update({ status, updated_by: updatedBy, updated_at: now() })
      .eq('id', id).select().single()
    return wrap(data, error)
  },

  async remove(id) {
    const { error } = await supabase.from('procurement_requests').delete().eq('id', id)
    return wrap(null, error)
  },
}

// ─── PURCHASE ORDERS ──────────────────────────────────────────────────────────

export const purchaseOrdersApi = {
  async getAll(branchId) {
    if (!branchId) return wrap([], null)
    const { data, error } = await supabase
      .from('purchase_orders')
      .select('*, purchase_order_items(*)')
      .eq('branch_id', branchId)
      .order('created_at', { ascending: false })
    return wrap(data, error)
  },

  async create({ po, items }) {
    const { data: poData, error: poError } = await supabase
      .from('purchase_orders')
      .insert([{ ...po, created_at: now() }])
      .select().single()
    if (poError) return wrap(null, poError)

    const lineItems = items.map(item => ({
      ...item,
      po_id:      poData.id,   // ← your column is po_id
      created_at: now(),
    }))
    const { error: itemsError } = await supabase
      .from('purchase_order_items').insert(lineItems)
    return wrap(poData, itemsError)
  },

  async updateStatus(id, status, updatedBy) {
    const { data, error } = await supabase
      .from('purchase_orders')
      .update({ status, updated_by: updatedBy, updated_at: now() })
      .eq('id', id).select().single()
    return wrap(data, error)
  },
}

// ─── FINANCIAL ────────────────────────────────────────────────────────────────

export const financialApi = {
  async getAll(branchId) {
    if (!branchId) return wrap([], null)
    const { data, error } = await supabase
      .from('financial_transactions')
      .select('*')
      .eq('branch_id', branchId)
      .order('created_at', { ascending: false })
    return wrap(data, error)
  },

  async updatePaymentStatus(id, paymentStatus) {
    const { data, error } = await supabase
      .from('financial_transactions')
      .update({ payment_status: paymentStatus, updated_at: now() })
      .eq('id', id).select().single()
    return wrap(data, error)
  },
}

// ─── ACTIVITY LOG ─────────────────────────────────────────────────────────────

export const activityApi = {
  async getAll(branchId, limit = 200) {
    if (!branchId) return wrap([], null)
    const { data, error } = await supabase
      .from('activity_logs')
      .select('*')
      .eq('branch_id', branchId)
      .order('created_at', { ascending: false })
      .limit(limit)
    return wrap(data, error)
  },
}

// ─── INTERNAL HELPER ──────────────────────────────────────────────────────────

function logActivity({ branchId, userId, userName, action, details }) {
  supabase.from('activity_logs').insert([{
    branch_id:  branchId,
    user_id:    userId,
    user_name:  userName,
    action,
    details,
    created_at: now(),
  }]).then(({ error }) => {
    if (error) console.warn('[api] activity log error:', error.message)
  })
}
