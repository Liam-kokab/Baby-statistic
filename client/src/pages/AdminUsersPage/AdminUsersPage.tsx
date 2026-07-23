import { useState, useEffect, useCallback } from 'react';
import { authFetch } from '../../utils/authFetch';
import type { TUser, TBaby, TAdminCreateUser } from 'baby-statistic-common';
import styles from './AdminUsersPage.module.css';

type TCreateForm = {
  username: string;
  password: string;
  role: 'user' | 'admin';
  babyId: string;
  name: string;
};

const EMPTY_FORM: TCreateForm = { username: '', password: '', role: 'user', babyId: '', name: '' };

const AdminUsersPage = () => {
  const [users, setUsers] = useState<TUser[]>([]);
  const [babies, setBabies] = useState<TBaby[]>([]);
  const [form, setForm] = useState<TCreateForm>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [usersRes, babiesRes] = await Promise.all([
      authFetch<TUser[]>('/api/admin/users'),
      authFetch<TBaby[]>('/api/admin/babies'),
    ]);
    if (usersRes.ok) setUsers(usersRes.data);
    if (babiesRes.ok) setBabies(babiesRes.data);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleAdd = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const body: TAdminCreateUser & { password: string; name: string } = {
      username: form.username.trim(),
      password: form.password,
      role: form.role,
      babyId: form.role === 'user' ? Number(form.babyId) : null,
      name: form.name.trim(),
    };
    const res = await authFetch<TUser>('/api/admin/users', {
      method: 'POST',
      body: JSON.stringify(body),
    });
    if (res.ok) {
      setForm(EMPTY_FORM);
      load();
    } else {
      setError(res.error);
    }
  }, [form, load]);

  const handleSaveName = useCallback(async (id: number) => {
    await authFetch(`/api/admin/users/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ name: editName.trim() }),
    });
    setEditingId(null);
    load();
  }, [editName, load]);

  const handleDelete = useCallback(async (id: number) => {
    if (!confirm('Delete this user?')) return;
    await authFetch(`/api/admin/users/${id}`, { method: 'DELETE' });
    load();
  }, [load]);

  const babyName = (id: number | null) =>
    id == null ? '—' : (babies.find((b) => b.id === id)?.name ?? `id:${id}`);

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>👥 Users</h1>

      <form onSubmit={handleAdd} className={styles.addForm}>
        <input className={styles.input} placeholder="Display name" value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
        <input className={styles.input} placeholder="Username" value={form.username}
          onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))} required />
        <input className={styles.input} placeholder="Password" type="password" value={form.password}
          onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} required />
        <select className={styles.input} value={form.role}
          onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as 'user' | 'admin' }))}>
          <option value="user">user</option>
          <option value="admin">admin</option>
        </select>
        {form.role === 'user' ? (
          <select className={styles.input} value={form.babyId}
            onChange={(e) => setForm((f) => ({ ...f, babyId: e.target.value }))} required>
            <option value="">— Select baby —</option>
            {babies.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        ) : null}
        <button className={styles.addBtn} type="submit">Add</button>
      </form>

      {error ? <p className={styles.error}>{error}</p> : null}

      {loading ? (
        <p className={styles.empty}>Loading…</p>
      ) : users.length === 0 ? (
        <p className={styles.empty}>No users yet.</p>
      ) : (
        <ul className={styles.list}>
          {users.map((u) => (
            <li key={u.id} className={styles.item}>
              <span className={`${styles.role} ${u.role === 'admin' ? styles.roleAdmin : styles.roleUser}`}>
                {u.role === 'admin' ? '🔑' : '👤'}
              </span>
              <span className={styles.name}>{u.username}</span>
              {editingId === u.id ? (
                <>
                  <input
                    className={styles.editInput}
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    placeholder="Display name"
                    autoFocus
                  />
                  <button className={styles.saveBtn} onClick={() => handleSaveName(u.id)}>✓</button>
                  <button className={styles.cancelBtn} onClick={() => setEditingId(null)}>✕</button>
                </>
              ) : (
                <>
                  <span className={styles.meta}>{u.name ? u.name : <em>no name</em>}</span>
                  <button className={styles.editBtn} onClick={() => { setEditingId(u.id); setEditName(u.name ?? ''); }}>✏️</button>
                </>
              )}
              <span className={styles.meta}>{u.role === 'user' ? `👶 ${babyName(u.babyId)}` : 'admin'}</span>
              <button className={styles.deleteBtn} onClick={() => handleDelete(u.id)}>🗑️</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default AdminUsersPage;

