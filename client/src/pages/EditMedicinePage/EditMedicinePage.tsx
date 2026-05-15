import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { fetch2 } from 'baby-statistic-common/util';
import type { TMedicine } from 'baby-statistic-common';
import PageLayout from '../../components/PageLayout/PageLayout';
import Input from '../../components/Input/Input';
import Button from '../../components/Button/Button';
import styles from './EditMedicinePage.module.css';

const JSON_HEADERS: HeadersInit = { 'Content-Type': 'application/json' };

const EditMedicinePage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [name, setName]         = useState('');
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError]       = useState<string | null>(null);

  const goBack = (): void => {
    if (window.history.length > 1) navigate(-1);
    else navigate('/medicine');
  };

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const res = await fetch2<TMedicine>(`/api/medicine/${id}`);
      if (res.ok) {
        setName(res.data.name);
      } else {
        setError(res.error);
      }
      setLoading(false);
    };
    load();
  }, [id]);

  const handleSave = async (): Promise<void> => {
    if (!name.trim()) return;
    setSaving(true);
    setError(null);
    const res = await fetch2<TMedicine>(`/api/medicine/${id}`, {
      method: 'PUT',
      headers: JSON_HEADERS,
      body: JSON.stringify({ name: name.trim() }),
    });
    if (res.ok) {
      goBack();
    } else {
      setError(res.error);
      setSaving(false);
    }
  };

  const handleDelete = async (): Promise<void> => {
    setDeleting(true);
    setError(null);
    const res = await fetch2<null>(`/api/medicine/${id}`, { method: 'DELETE' });
    if (res.ok) {
      goBack();
    } else {
      setError(res.error);
      setDeleting(false);
    }
  };

  return (
    <PageLayout title="Edit Medicine" emoji="💊" gradient="green">
      <div className={styles.page}>
        {loading ? (
          <p className={styles.loadingMsg}>Loading… ⏳</p>
        ) : (
          <div className={styles.form}>
            <Input
              label="Name"
              value={name}
              onChange={setName}
              placeholder="e.g. Vitamin D"
              name="medicineName"
            />
            {error ? <p className={styles.errorMsg}>⚠️ {error}</p> : null}
            <div className={styles.actions}>
              <Button text="Save" emoji="💾" onClick={handleSave} loading={saving} disabled={!name.trim()} />
              <Button text="Cancel" emoji="↩️" variant="secondary" onClick={goBack} />
              <Button text="Delete" emoji="🗑️" variant="ghost" loading={deleting} onClick={handleDelete} />
            </div>
          </div>
        )}
      </div>
    </PageLayout>
  );
};

export default EditMedicinePage;
