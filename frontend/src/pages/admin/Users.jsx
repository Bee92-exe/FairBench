/**
 * Admin User Management Page
 * Owner: Aranno (A-FE-6, FR-03)
 * Lets Dr. Haque provision accounts and deactivate or reactivate student logins.
 */

import React, { useState, useEffect } from 'react';
import { adminApi } from '../../api/adminClient';
import { Button } from '../../components/Button';
import { Modal } from '../../components/Modal';
import { Users as UsersIcon, UserPlus, CheckCircle, XCircle, ShieldCheck } from 'lucide-react';
import { formatLabDateTime } from '../../lib/time';

export function Users() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState('student');
  const [feedback, setFeedback] = useState(null);

  const loadUsers = () => {
    setLoading(true);
    adminApi.getUsers()
      .then(res => setUsers(res.users || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleCreateUser = async (e) => {
    e.preventDefault();
    try {
      await adminApi.createUser({
        email: newEmail,
        full_name: newName,
        role: newRole
      });
      setAddModalOpen(false);
      setNewEmail('');
      setNewName('');
      setFeedback({ type: 'success', text: `User ${newName} provisioned successfully.` });
      loadUsers();
    } catch (err) {
      setFeedback({ type: 'error', text: err.message || 'Failed to create user' });
    }
  };

  const handleToggleActive = async (user) => {
    try {
      await adminApi.toggleUserActive(user.id, !user.active);
      setFeedback({
        type: 'success',
        text: `User ${user.full_name || user.name} is now ${!user.active ? 'active' : 'deactivated'}.`
      });
      loadUsers();
    } catch (err) {
      setFeedback({ type: 'error', text: err.message || 'Failed to update user' });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between pb-4 border-b border-slate-200">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-indigo-100 text-indigo-700 rounded-xl">
            <UsersIcon className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Lab User Accounts</h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Provision student research accounts and manage lab access. (FR-03)
            </p>
          </div>
        </div>
        <Button variant="primary" icon={UserPlus} onClick={() => setAddModalOpen(true)}>
          Add Student Account
        </Button>
      </div>

      {feedback && (
        <div className={`p-4 rounded-xl text-sm ${
          feedback.type === 'success'
            ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
            : 'bg-rose-50 text-rose-800 border border-rose-200'
        }`}>
          {feedback.text}
        </div>
      )}

      {/* Users Table */}
      <div className="bg-white border border-slate-200/80 rounded-2xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold text-xs uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">Name</th>
                <th className="py-3 px-4">Email</th>
                <th className="py-3 px-4">Role</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="py-3.5 px-4 font-medium text-slate-900">
                    {u.full_name || u.name}
                  </td>
                  <td className="py-3.5 px-4 text-slate-600 text-xs">
                    {u.email}
                  </td>
                  <td className="py-3.5 px-4">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize ${
                      u.role === 'admin'
                        ? 'bg-purple-50 text-purple-700 border border-purple-200'
                        : 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                    }`}>
                      {u.role}
                    </span>
                  </td>
                  <td className="py-3.5 px-4">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                      u.active !== false
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-slate-100 text-slate-600 border border-slate-200'
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${u.active !== false ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                      {u.active !== false ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    {u.role !== 'admin' && (
                      <Button
                        size="sm"
                        variant={u.active !== false ? 'secondary' : 'outline'}
                        onClick={() => handleToggleActive(u)}
                      >
                        {u.active !== false ? 'Deactivate' : 'Reactivate'}
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add User Modal */}
      <Modal
        open={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        title="Provision Student Account"
        footer={(
          <div className="flex justify-end gap-2 w-full">
            <Button variant="ghost" onClick={() => setAddModalOpen(false)}>Cancel</Button>
            <Button variant="primary" onClick={handleCreateUser}>Create Account</Button>
          </div>
        )}
      >
        <form onSubmit={handleCreateUser} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Full Name
            </label>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. Nusrat Jahan"
              required
              className="w-full text-sm border border-slate-300 rounded-xl px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              University Email
            </label>
            <input
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder="e.g. nusrat@university.edu"
              required
              className="w-full text-sm border border-slate-300 rounded-xl px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Role
            </label>
            <select
              value={newRole}
              onChange={(e) => setNewRole(e.target.value)}
              className="w-full text-sm border border-slate-300 rounded-xl px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-white"
            >
              <option value="student">Student</option>
              <option value="admin">Lab Administrator</option>
            </select>
          </div>
        </form>
      </Modal>
    </div>
  );
}
