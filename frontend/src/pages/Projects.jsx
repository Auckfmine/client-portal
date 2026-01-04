import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, Search, Calendar, DollarSign, CheckCircle2,
  Trash2, Edit2, X, FolderKanban, Circle, ListTodo,
  ChevronRight
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const STATUS_CONFIG = {
  planning: { label: 'Planning', color: '#6366F1', bg: 'rgba(99, 102, 241, 0.15)' },
  in_progress: { label: 'In Progress', color: '#10B981', bg: 'rgba(16, 185, 129, 0.15)' },
  review: { label: 'Review', color: '#F59E0B', bg: 'rgba(245, 158, 11, 0.15)' },
  completed: { label: 'Completed', color: '#3B82F6', bg: 'rgba(59, 130, 246, 0.15)' },
  on_hold: { label: 'On Hold', color: '#EF4444', bg: 'rgba(239, 68, 68, 0.15)' }
};

export default function Projects() {
  const { api } = useAuth();
  const [projects, setProjects] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [editingProject, setEditingProject] = useState(null);
  const [selectedProject, setSelectedProject] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [newTaskTitle, setNewTaskTitle] = useState('');

  const [form, setForm] = useState({
    name: '',
    description: '',
    status: 'planning',
    budget: '',
    deadline: '',
    client_id: ''
  });

  useEffect(() => {
    fetchProjects();
    fetchClients();
  }, []);

  const fetchProjects = async () => {
    try {
      const res = await api.get('/projects');
      setProjects(res.data);
    } catch (err) {
      console.error('Failed to fetch projects:', err);
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

  const fetchProject = async (id) => {
    try {
      const res = await api.get(`/projects/${id}`);
      setSelectedProject(res.data);
    } catch (err) {
      console.error('Failed to fetch project:', err);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const data = {
        ...form,
        budget: parseFloat(form.budget) || 0,
        deadline: form.deadline ? new Date(form.deadline).toISOString() : null,
        client_id: form.client_id ? parseInt(form.client_id) : null
      };

      if (editingProject) {
        await api.put(`/projects/${editingProject.id}`, data);
      } else {
        await api.post('/projects', data);
      }

      setShowModal(false);
      setEditingProject(null);
      setForm({ name: '', description: '', status: 'planning', budget: '', deadline: '', client_id: '' });
      fetchProjects();
    } catch (err) {
      console.error('Failed to save project:', err);
    }
  };

  const handleEdit = (project) => {
    setEditingProject(project);
    setForm({
      name: project.name,
      description: project.description || '',
      status: project.status,
      budget: project.budget?.toString() || '',
      deadline: project.deadline ? project.deadline.split('T')[0] : '',
      client_id: project.client_id?.toString() || ''
    });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this project?')) return;
    try {
      await api.delete(`/projects/${id}`);
      fetchProjects();
    } catch (err) {
      console.error('Failed to delete project:', err);
    }
  };

  const openProjectDetail = (project) => {
    setSelectedProject(project);
    setShowDetailModal(true);
  };

  // Task functions
  const addTask = async (e) => {
    e.preventDefault();
    if (!newTaskTitle.trim() || !selectedProject) return;

    try {
      await api.post(`/projects/${selectedProject.id}/tasks`, { title: newTaskTitle });
      setNewTaskTitle('');
      fetchProject(selectedProject.id);
      fetchProjects();
    } catch (err) {
      console.error('Failed to add task:', err);
    }
  };

  const toggleTask = async (taskId) => {
    try {
      await api.put(`/tasks/${taskId}/toggle`);
      fetchProject(selectedProject.id);
      fetchProjects();
    } catch (err) {
      console.error('Failed to toggle task:', err);
    }
  };

  const deleteTask = async (taskId) => {
    try {
      await api.delete(`/tasks/${taskId}`);
      fetchProject(selectedProject.id);
      fetchProjects();
    } catch (err) {
      console.error('Failed to delete task:', err);
    }
  };

  const filteredProjects = projects.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = filterStatus === 'all' || p.status === filterStatus;
    return matchesSearch && matchesFilter;
  });

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
          <h1>Projects</h1>
          <p>Manage and track your ongoing projects</p>
        </div>
        <div className="header-actions">
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>
            <Plus size={18} />
            New Project
          </button>
        </div>
      </div>

      <div className="page-container">
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
                placeholder="Search projects..."
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

        {/* Projects Grid */}
        {filteredProjects.length > 0 ? (
          <div className="grid-3">
            {filteredProjects.map((project, index) => {
              const status = STATUS_CONFIG[project.status] || STATUS_CONFIG.planning;
              const taskCount = project.tasks?.length || 0;
              const completedTasks = project.tasks?.filter(t => t.completed)?.length || 0;

              return (
                <motion.div
                  key={project.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="card"
                  style={{ display: 'flex', flexDirection: 'column', cursor: 'pointer' }}
                  onClick={() => openProjectDetail(project)}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                    <span
                      className="badge"
                      style={{ background: status.bg, color: status.color }}
                    >
                      {status.label}
                    </span>
                    <div style={{ display: 'flex', gap: '0.5rem' }} onClick={(e) => e.stopPropagation()}>
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => handleEdit(project)}
                        style={{ padding: '0.375rem' }}
                      >
                        <Edit2 size={16} />
                      </button>
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => handleDelete(project.id)}
                        style={{ padding: '0.375rem', color: 'var(--accent-danger)' }}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>

                  <h4 style={{ marginBottom: '0.5rem' }}>{project.name}</h4>

                  {project.client_name && (
                    <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
                      Client: {project.client_name}
                    </p>
                  )}

                  {project.description && (
                    <p style={{
                      fontSize: '0.875rem',
                      color: 'var(--text-secondary)',
                      marginBottom: '1rem',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden'
                    }}>
                      {project.description}
                    </p>
                  )}

                  {/* Tasks Summary */}
                  {taskCount > 0 && (
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      marginBottom: '1rem',
                      padding: '0.5rem 0.75rem',
                      background: 'var(--bg-tertiary)',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: '0.8125rem'
                    }}>
                      <ListTodo size={14} style={{ color: 'var(--accent-primary)' }} />
                      <span style={{ color: 'var(--text-secondary)' }}>
                        {completedTasks}/{taskCount} tasks completed
                      </span>
                    </div>
                  )}

                  {/* Progress Bar */}
                  <div style={{ marginBottom: '1rem' }}>
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      marginBottom: '0.5rem',
                      fontSize: '0.8125rem'
                    }}>
                      <span style={{ color: 'var(--text-muted)' }}>Progress</span>
                      <span style={{ fontWeight: 500 }}>{project.progress}%</span>
                    </div>
                    <div className="progress-bar">
                      <motion.div
                        className="progress-fill"
                        initial={{ width: 0 }}
                        animate={{ width: `${project.progress}%` }}
                        transition={{ duration: 0.8, ease: 'easeOut' }}
                      />
                    </div>
                  </div>

                  {/* Meta Info */}
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    paddingTop: '1rem',
                    borderTop: '1px solid var(--border-subtle)',
                    marginTop: 'auto'
                  }}>
                    <div style={{ display: 'flex', gap: '1rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                        <DollarSign size={14} style={{ color: 'var(--text-muted)' }} />
                        <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                          ${project.budget?.toLocaleString() || 0}
                        </span>
                      </div>
                      {project.deadline && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                          <Calendar size={14} style={{ color: 'var(--text-muted)' }} />
                          <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                            {new Date(project.deadline).toLocaleDateString()}
                          </span>
                        </div>
                      )}
                    </div>
                    <ChevronRight size={16} style={{ color: 'var(--text-muted)' }} />
                  </div>
                </motion.div>
              );
            })}
          </div>
        ) : (
          <div className="empty-state">
            <div className="empty-state-icon">
              <FolderKanban size={40} />
            </div>
            <h3>No projects yet</h3>
            <p>Create your first project to get started tracking your work.</p>
            <button className="btn btn-primary" onClick={() => setShowModal(true)}>
              <Plus size={18} />
              Create Project
            </button>
          </div>
        )}
      </div>

      {/* Create/Edit Project Modal */}
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
                <h3>{editingProject ? 'Edit Project' : 'New Project'}</h3>
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
                    <label>Project Name</label>
                    <input
                      type="text"
                      className="input"
                      placeholder="E.g., Website Redesign"
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      required
                    />
                  </div>

                  <div className="input-group">
                    <label>Description</label>
                    <textarea
                      className="input"
                      placeholder="Brief project description..."
                      value={form.description}
                      onChange={(e) => setForm({ ...form, description: e.target.value })}
                    />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div className="input-group">
                      <label>Status</label>
                      <select
                        className="input"
                        value={form.status}
                        onChange={(e) => setForm({ ...form, status: e.target.value })}
                      >
                        {Object.entries(STATUS_CONFIG).map(([key, value]) => (
                          <option key={key} value={key}>{value.label}</option>
                        ))}
                      </select>
                    </div>

                    <div className="input-group">
                      <label>Budget</label>
                      <input
                        type="number"
                        className="input"
                        placeholder="5000"
                        value={form.budget}
                        onChange={(e) => setForm({ ...form, budget: e.target.value })}
                      />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div className="input-group">
                      <label>Deadline</label>
                      <input
                        type="date"
                        className="input"
                        value={form.deadline}
                        onChange={(e) => setForm({ ...form, deadline: e.target.value })}
                      />
                    </div>

                    <div className="input-group">
                      <label>Client</label>
                      <select
                        className="input"
                        value={form.client_id}
                        onChange={(e) => setForm({ ...form, client_id: e.target.value })}
                      >
                        <option value="">No client</option>
                        {clients.map(client => (
                          <option key={client.id} value={client.id}>{client.name}</option>
                        ))}
                      </select>
                    </div>
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
                    {editingProject ? 'Save Changes' : 'Create Project'}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Project Detail Modal with Tasks */}
      <AnimatePresence>
        {showDetailModal && selectedProject && (
          <motion.div
            className="modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowDetailModal(false)}
          >
            <motion.div
              className="modal"
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              style={{ maxWidth: 600 }}
            >
              <div className="modal-header">
                <div>
                  <h3>{selectedProject.name}</h3>
                  {selectedProject.client_name && (
                    <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                      {selectedProject.client_name}
                    </p>
                  )}
                </div>
                <button
                  className="btn btn-ghost"
                  onClick={() => setShowDetailModal(false)}
                  style={{ padding: '0.5rem' }}
                >
                  <X size={20} />
                </button>
              </div>

              <div className="modal-body">
                {/* Project Info */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: '1rem',
                  marginBottom: '1.5rem',
                  padding: '1rem',
                  background: 'var(--bg-tertiary)',
                  borderRadius: 'var(--radius-md)'
                }}>
                  <div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Status</div>
                    <span
                      className="badge"
                      style={{
                        background: STATUS_CONFIG[selectedProject.status]?.bg,
                        color: STATUS_CONFIG[selectedProject.status]?.color
                      }}
                    >
                      {STATUS_CONFIG[selectedProject.status]?.label}
                    </span>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Budget</div>
                    <div style={{ fontWeight: 600 }}>${selectedProject.budget?.toLocaleString() || 0}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Progress</div>
                    <div style={{ fontWeight: 600 }}>{selectedProject.progress}%</div>
                  </div>
                </div>

                {/* Tasks Section */}
                <div>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: '1rem'
                  }}>
                    <h4 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <ListTodo size={18} />
                      Tasks
                      <span style={{
                        fontSize: '0.75rem',
                        color: 'var(--text-muted)',
                        fontWeight: 400
                      }}>
                        ({selectedProject.tasks?.filter(t => t.completed).length || 0}/{selectedProject.tasks?.length || 0})
                      </span>
                    </h4>
                  </div>

                  {/* Add Task Form */}
                  <form onSubmit={addTask} style={{ marginBottom: '1rem' }}>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <input
                        type="text"
                        className="input"
                        placeholder="Add a new task..."
                        value={newTaskTitle}
                        onChange={(e) => setNewTaskTitle(e.target.value)}
                        style={{ flex: 1 }}
                      />
                      <button type="submit" className="btn btn-primary">
                        <Plus size={18} />
                      </button>
                    </div>
                  </form>

                  {/* Tasks List */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {selectedProject.tasks?.length > 0 ? (
                      selectedProject.tasks.map((task, index) => (
                        <motion.div
                          key={task.id}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: index * 0.03 }}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.75rem',
                            padding: '0.75rem 1rem',
                            background: 'var(--bg-tertiary)',
                            borderRadius: 'var(--radius-sm)',
                            border: '1px solid var(--border-subtle)'
                          }}
                        >
                          <button
                            onClick={() => toggleTask(task.id)}
                            style={{
                              background: 'none',
                              border: 'none',
                              padding: 0,
                              cursor: 'pointer',
                              display: 'flex',
                              color: task.completed ? 'var(--accent-primary)' : 'var(--text-muted)'
                            }}
                          >
                            {task.completed ? (
                              <CheckCircle2 size={20} />
                            ) : (
                              <Circle size={20} />
                            )}
                          </button>
                          <span style={{
                            flex: 1,
                            textDecoration: task.completed ? 'line-through' : 'none',
                            color: task.completed ? 'var(--text-muted)' : 'var(--text-primary)'
                          }}>
                            {task.title}
                          </span>
                          <button
                            onClick={() => deleteTask(task.id)}
                            style={{
                              background: 'none',
                              border: 'none',
                              padding: '0.25rem',
                              cursor: 'pointer',
                              color: 'var(--text-muted)',
                              opacity: 0.6,
                              transition: 'all var(--transition-fast)'
                            }}
                            onMouseEnter={(e) => {
                              e.target.style.opacity = 1;
                              e.target.style.color = 'var(--accent-danger)';
                            }}
                            onMouseLeave={(e) => {
                              e.target.style.opacity = 0.6;
                              e.target.style.color = 'var(--text-muted)';
                            }}
                          >
                            <Trash2 size={16} />
                          </button>
                        </motion.div>
                      ))
                    ) : (
                      <div style={{
                        padding: '2rem',
                        textAlign: 'center',
                        color: 'var(--text-muted)',
                        background: 'var(--bg-tertiary)',
                        borderRadius: 'var(--radius-md)'
                      }}>
                        No tasks yet. Add your first task above!
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button
                  className="btn btn-secondary"
                  onClick={() => setShowDetailModal(false)}
                >
                  Close
                </button>
                <button
                  className="btn btn-primary"
                  onClick={() => {
                    setShowDetailModal(false);
                    handleEdit(selectedProject);
                  }}
                >
                  <Edit2 size={16} />
                  Edit Project
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
