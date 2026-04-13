import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';

export default function Inventory() {
  const { supabase, user, branch } = useApp();
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (branch?.id) {
      fetchInventory();
    }
  }, [branch]);

  async function fetchInventory() {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('inventory')
        .select('*')
        .eq('branch_id', branch.id);
      
      if (error) throw error;
      setInventory(data || []);
    } catch (err) {
      console.error('Error fetching inventory:', err);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return <div style={{ padding: 20 }}>Loading inventory...</div>;
  }

  return (
    <div style={{ padding: 20 }}>
      <h2>Inventory Management</h2>
      <p>Branch: {branch?.name || 'Loading...'}</p>
      <p>Total Items: {inventory.length}</p>
      
      {inventory.length === 0 ? (
        <p>No inventory items found. Add your first item!</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', padding: 8 }}>Item Name</th>
              <th style={{ textAlign: 'left', padding: 8 }}>Quantity</th>
              <th style={{ textAlign: 'left', padding: 8 }}>Unit</th>
              <th style={{ textAlign: 'left', padding: 8 }}>Price (Rs.)</th>
            </tr>
          </thead>
          <tbody>
            {inventory.map((item) => (
              <tr key={item.id}>
                <td style={{ padding: 8 }}>{item.name}</td>
                <td style={{ padding: 8 }}>{item.quantity}</td>
                <td style={{ padding: 8 }}>{item.unit || 'pcs'}</td>
                <td style={{ padding: 8 }}>{item.price || 0}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}