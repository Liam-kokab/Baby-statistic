import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { fetch2 } from 'baby-statistic-common/util';
import type { TPee, TPoop } from 'baby-statistic-common';
import PageLayout from '../../components/PageLayout/PageLayout';
import DateTimeInput from '../../components/DateTimeInput/DateTimeInput';
import Button from '../../components/Button/Button';
import styles from './EditPoopPeePage.module.css';

type TEventType = 'pee' | 'poop';

type TProps = {
  type: TEventType;
};

const toInputValue = (isoStr: string): string => isoStr.slice(0, 16);

const EditPoopPeePage = ({ type }: TProps) => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [createdAt, setCreatedAt] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const goBack = (): void => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate('/poop-pee');
    }
  };

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const result = await fetch2<TPee | TPoop>(`/api/${type}/${id}`);
      if (result.ok) {
        setCreatedAt(toInputValue(result.data.createdAt));
      } else {
        setError(result.error);
      }
      setLoading(false);
    };
    load();
  }, [id, type]);

  const handleSubmit = async () => {
    setSaving(true);
    setError(null);
    const result = await fetch2<TPee | TPoop>(`/api/${type}/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ createdAt }),
    });
    if (result.ok) {
      goBack();
    } else {
      setError(result.error);
      setSaving(false);
    }
  };

  const emoji = type === 'poop' ? '💩' : '💧';
  const label = type === 'poop' ? 'Poop' : 'Pee';

  return (
    <PageLayout title={`Edit ${label}`} emoji={emoji} gradient="amber">
      <div className={styles.page}>
        {loading ? (
          <p className={styles.loadingMsg}>Loading… ⏳</p>
        ) : (
          <div className={styles.form}>
            <DateTimeInput
              label="Time"
              name="createdAt"
              value={createdAt}
              onChange={setCreatedAt}
            />
            {error ? <p className={styles.errorMsg}>⚠️ {error}</p> : null}
            <div className={styles.actions}>
              <Button text="Save" emoji="💾" onClick={handleSubmit} loading={saving} />
              <Button text="Cancel" emoji="↩️" variant="secondary" onClick={goBack} />
              <Button
                text="Delete"
                emoji="🗑️"
                variant="ghost"
                loading={deleting}
                onClick={async () => {
                  setDeleting(true);
                  setError(null);
                  const res = await fetch2<null>(`/api/${type}/${id}`, { method: 'DELETE' });
                  if (res.ok) {
                    goBack();
                  } else {
                    setError(res.error);
                    setDeleting(false);
                  }
                }}
              />
            </div>
          </div>
        )}
      </div>
    </PageLayout>
  );
};

export default EditPoopPeePage;

