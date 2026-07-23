import { useState, useEffect, useCallback } from 'react';
import { authFetch } from '../../utils/authFetch';
import type { TBaby, TAdminCreateBaby } from 'baby-statistic-common';
import styles from './AdminBabiesPage.module.css';

const AdminBabiesPage = () => {
  const [babies, setBabies] = useState<TBaby[]>([]);
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const res = await authFetch<TBaby[]>('/api/admin/babies');
    if (res.ok) setBabies(res.data);
    else setError(res.error);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleAdd = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    const res = await authFetch<TBaby>('/api/admin/babies', {
      method: 'POST',
      body: JSON.stringify({ name: newName.trim() } satisfies TAdminCreateBaby),
    });
    if (res.ok) {
      setNewName('');
      load();
    } else {
      setError(res.error);
    }
  }, [newName, load]);

  const handleDelete = useCallback(async (id: number) => {
    if (!confirm('Delete this baby and all their data?')) return;
    await authFetch(`/api/admin/babies/${id}`, { method: 'DELETE' });
    load();
  }, [load]);

  const handleSaveName = useCallback(async (id: number) => {
    await authFetch(`/api/admin/babies/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ name: editName.trim() } satisfies TAdminCreateBaby),
    });
    setEditingId(null);
    load();
  }, [editName, load]);

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>👶 Babies</h1>

      <form onSubmit={handleAdd} className={styles.addForm}>
        <input
          className={styles.input}
          placeholder="Baby name…"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
        />
        <button className={styles.addBtn} type="submit">Add</button>
      </form>

      {error ? <p className={styles.error}>{error}</p> : null}

      {loading ? (
        <p className={styles.empty}>Loading…</p>
      ) : babies.length === 0 ? (
        <p className={styles.empty}>No babies yet.</p>
      ) : (
        <ul className={styles.list}>
          {babies.map((b) => (
            <li key={b.id} className={styles.item}>
              {editingId === b.id ? (
                <>
                  <input
                    className={styles.editInput}
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    autoFocus
                  />
                  <button className={styles.saveBtn} onClick={() => handleSaveName(b.id)}>✓</button>
                  <button className={styles.cancelBtn} onClick={() => setEditingId(null)}>✕</button>
                </>
              ) : (
                <>
                  <span className={styles.name}>👶 {b.name}</span>
                  <span className={styles.meta}>id: {b.id}</span>
                  <button className={styles.editBtn} onClick={() => { setEditingId(b.id); setEditName(b.name); }}>✏️</button>
                </>
              )}
              <button className={styles.deleteBtn} onClick={() => handleDelete(b.id)}>🗑️</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default AdminBabiesPage;

