import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, Search, FileText, DollarSign, Calendar,
  CheckCircle, Clock, AlertTriangle, Send,
  Edit2, Trash2, X
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const STATUS_CONFIG = {
  draft: { label: 'Draft', color: '#64748B', bg: 'rgba(100, 116, 139, 0.15)', icon: FileText },
  sent: { label: 'Sent', color: '#3B82F6', bg: 'rgba(59, 130, 246, 0.15)', icon: Send },
  paid: { label: 'Paid', color: '#10B981', bg: 'rgba(16, 185, 129, 0.15)', icon: CheckCircle },
  overdue: { label: 'Overdue', color: '#EF4444', bg: 'rgba(239, 68, 68, 0.15)', icon: AlertTriangle }
};

export default function Invoices() {
  const { api } = useAuth();
  const [invoices, setInvoices] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');

  const [form, setForm] = useState({
    amount: '',
    due_date: '',
    description: '',
    client_id: ''
  });

  useEffect(() => {
    fetchInvoices();
    fetchClients();
  }, []);

  const fetchInvoices = async () => {
    try {
      const res = await api.get('/invoices');
      setInvoices(res.data);
    } catch (err) {
      console.error('Failed to fetch invoices:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchClients = async () => {
    try {
      const res = await api.get('/clients');
      setClients(res.data);
    } catch (err) {
      console.error('Failed to fetch clients:', err);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const data = {
        amount: parseFloat(form.amount),
        due_date: new Date(form.due_date).toISOString(),
        description: form.description,
        client_id: parseInt(form.client_id)
      };

      if (editingInvoice) {
        await api.put(`/invoices/${editingInvoice.id}`, data);
      } else {
        await api.post('/invoices', data);
      }

      setShowModal(false);
      setEditingInvoice(null);
      setForm({ amount: '', due_date: '', description: '', client_id: '' });
      fetchInvoices();
    } catch (err) {
      console.error('Failed to save invoice:', err);
    }
  };

  const handleEdit = (invoice) => {
    setEditingInvoice(invoice);
    setForm({
      amount: invoice.amount.toString(),
      due_date: invoice.due_date.split('T')[0],
      description: invoice.description || '',
      client_id: invoice.client_id.toString()
    });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this invoice?')) return;
    try {
      await api.delete(`/invoices/${id}`);
      fetchInvoices();
    } catch (err) {
      console.error('Failed to delete invoice:', err);
    }
  };

  const updateStatus = async (id, status) => {
    try {
      await api.put(`/invoices/${id}`, { status });
      fetchInvoices();
    } catch (err) {
      console.error('Failed to update status:', err);
    }
  };

  const openNewModal = () => {
    setEditingInvoice(null);
    setForm({ amount: '', due_date: '', description: '', client_id: '' });
    setShowModal(true);
  };

  const filteredInvoices = invoices.filter(inv => {
    const matchesSearch = inv.invoice_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (inv.client_name && inv.client_name.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesFilter = filterStatus === 'all' || inv.status === filterStatus;
    return matchesSearch && matchesFilter;
  });

  // Calculate totals
  const totals = {
    all: invoices.reduce((sum, inv) => sum + inv.amount, 0),
    paid: invoices.filter(inv => inv.status === 'paid').reduce((sum, inv) => sum + inv.amount, 0),
    pending: invoices.filter(inv => ['draft', 'sent'].includes(inv.status)).reduce((sum, inv) => sum + inv.amount, 0),
    overdue: invoices.filter(inv => inv.status === 'overdue').reduce((sum, inv) => sum + inv.amount, 0)
  };

  if (loading) {
    return (
      <div className="loader" style={{ height: '60vh' }}>
        <div className="spinner" />
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="header">
        <div className="header-title">
          <h1>Invoices</h1>
          <p>Track payments and manage billing</p>
        </div>
        <div className="header-actions">
          <button className="btn btn-primary" onClick={openNewModal}>
            <Plus size={18} />
            Create Invoice
          </button>
        </div>
      </div>

      <div className="page-container">
        {/* Stats Summary */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '1rem',
            marginBottom: '1.5rem'
          }}
        >
          {[
            { label: 'Total Invoiced', value: totals.all, color: 'var(--text-primary)' },
            { label: 'Paid', value: totals.paid, color: 'var(--accent-primary)' },
            { label: 'Pending', value: totals.pending, color: 'var(--accent-warning)' },
            { label: 'Overdue', value: totals.overdue, color: 'var(--accent-danger)' }
          ].map(stat => (
            <div key={stat.label} className="card" style={{ padding: '1.25rem' }}>
              <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
                {stat.label}
              </div>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, color: stat.color }}>
                ${stat.value.toLocaleString()}
              </div>
            </div>
          ))}
        </motion.div>

        {/* Filters */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="card"
          style={{ marginBottom: '1.5rem' }}
        >
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 200, position: 'relative' }}>
              <Search
                size={18}
                style={{
                  position: 'absolute',
                  left: '1rem',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--text-muted)'
                }}
              />
              <input
                type="text"
                className="input"
                placeholder="Search invoices..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{ paddingLeft: '2.75rem' }}
              />
            </div>
            <select
              className="input"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              style={{ width: 'auto', minWidth: 150 }}
            >
              <option value="all">All Status</option>
              {Object.entries(STATUS_CONFIG).map(([key, value]) => (
                <option key={key} value={key}>{value.label}</option>
              ))}
            </select>
          </div>
        </motion.div>

        {/* Invoices Table */}
        {filteredInvoices.length > 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="table-container"
          >
            <table>
              <thead>
                <tr>
                  <th>Invoice</th>
                  <th>Client</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Due Date</th>
                  <th style={{ width: 150 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredInvoices.map((invoice, index) => {
                  const status = STATUS_CONFIG[invoice.status] || STATUS_CONFIG.draft;
                  const StatusIcon = status.icon;
                  const isOverdue = new Date(invoice.due_date) < new Date() &&
                    invoice.status !== 'paid';

                  return (
                    <motion.tr
                      key={invoice.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.03 }}
                    >
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          <div style={{
                            width: 40,
                            height: 40,
                            borderRadius: 'var(--radius-sm)',
                            background: 'var(--bg-tertiary)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}>
                            <FileText size={18} style={{ color: 'var(--text-muted)' }} />
                          </div>
                          <div>
                            <div style={{ fontWeight: 500 }}>{invoice.invoice_number}</div>
                            <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                              {new Date(invoice.created_at).toLocaleDateString()}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td>{invoice.client_name || '-'}</td>
                      <td>
                        <span style={{ fontWeight: 600, fontSize: '1rem' }}>
                          ${invoice.amount.toLocaleString()}
                        </span>
                      </td>
                      <td>
                        <span
                          className="badge"
                          style={{ background: status.bg, color: status.color }}
                        >
                          <StatusIcon size={12} style={{ marginRight: 4 }} />
                          {status.label}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <Calendar size={14} style={{
                            color: isOverdue ? 'var(--accent-danger)' : 'var(--text-muted)'
                          }} />
                          <span style={{
                            color: isOverdue ? 'var(--accent-danger)' : 'var(--text-secondary)'
                          }}>
                            {new Date(invoice.due_date).toLocaleDateString()}
                          </span>
                        </div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          {invoice.status !== 'paid' && (
                            <button
                              className="btn btn-sm"
                              onClick={() => updateStatus(invoice.id, 'paid')}
                              style={{
                                background: 'rgba(16, 185, 129, 0.1)',
                                color: 'var(--accent-primary)',
                                border: '1px solid rgba(16, 185, 129, 0.2)'
                              }}
                            >
                              <CheckCircle size={14} />
                              Paid
                            </button>
                          )}
                          <button
                            className="btn btn-ghost btn-sm"
                            onClick={() => handleEdit(invoice)}
                            style={{ padding: '0.375rem' }}
                          >
                            <Edit2 size={16} />
                          </button>
                          <button
                            className="btn btn-ghost btn-sm"
                            onClick={() => handleDelete(invoice.id)}
                            style={{ padding: '0.375rem', color: 'var(--accent-danger)' }}
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </motion.div>
        ) : (
          <div className="empty-state">
            <div className="empty-state-icon">
              <FileText size={40} />
            </div>
            <h3>No invoices yet</h3>
            <p>Create your first invoice to start tracking payments.</p>
            <button className="btn btn-primary" onClick={openNewModal}>
              <Plus size={18} />
              Create Invoice
            </button>
          </div>
        )}
      </div>

      {/* Modal */}
      <AnimatePresence>
        {showModal && (
          <motion.div
            className="modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowModal(false)}
          >
            <motion.div
              className="modal"
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="modal-header">
                <h3>{editingInvoice ? 'Edit Invoice' : 'Create Invoice'}</h3>
                <button
                  className="btn btn-ghost"
                  onClick={() => setShowModal(false)}
                  style={{ padding: '0.5rem' }}
                >
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleSubmit}>
                <div className="modal-body">
                  <div className="input-group">
                    <label>Client</label>
                    <select
                      className="input"
                      value={form.client_id}
                      onChange={(e) => setForm({ ...form, client_id: e.target.value })}
                      required
                    >
                      <option value="">Select a client</option>
                      {clients.map(client => (
                        <option key={client.id} value={client.id}>{client.name}</option>
                      ))}
                    </select>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div className="input-group">
                      <label>Amount</label>
                      <div style={{ position: 'relative' }}>
                        <DollarSign
                          size={16}
                          style={{
                            position: 'absolute',
                            left: '1rem',
                            top: '50%',
                            transform: 'translateY(-50%)',
                            color: 'var(--text-muted)'
                          }}
                        />
                        <input
                          type="number"
                          className="input"
                          placeholder="1000"
                          value={form.amount}
                          onChange={(e) => setForm({ ...form, amount: e.target.value })}
                          style={{ paddingLeft: '2.5rem' }}
                          required
                          min="0"
                          step="0.01"
                        />
                      </div>
                    </div>

                    <div className="input-group">
                      <label>Due Date</label>
                      <input
                        type="date"
                        className="input"
                        value={form.due_date}
                        onChange={(e) => setForm({ ...form, due_date: e.target.value })}
                        required
                      />
                    </div>
                  </div>

                  <div className="input-group">
                    <label>Description</label>
                    <textarea
                      className="input"
                      placeholder="Invoice description or notes..."
                      value={form.description}
                      onChange={(e) => setForm({ ...form, description: e.target.value })}
                      rows={3}
                    />
                  </div>
                </div>

                <div className="modal-footer">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setShowModal(false)}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary">
                    {editingInvoice ? 'Save Changes' : 'Create Invoice'}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
