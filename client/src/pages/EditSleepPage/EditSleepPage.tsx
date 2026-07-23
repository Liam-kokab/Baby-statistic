import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { authFetch } from '../../utils/authFetch';
import type { TSleep, TPostSleep } from 'baby-statistic-common';
import PageLayout from '../../components/PageLayout/PageLayout';
import DateTimeInput from '../../components/DateTimeInput/DateTimeInput';
import Button from '../../components/Button/Button';
import styles from './EditSleepPage.module.css';

const toInputValue = (isoStr: string): string => isoStr.slice(0, 16);

const EditSleepPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const goBack = (): void => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate('/sleep');
    }
  };

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const result = await authFetch<TSleep>(`/api/sleep/${id}`);
      if (result.ok) {
        setStart(toInputValue(result.data.start));
        setEnd(result.data.end ? toInputValue(result.data.end) : '');
      } else {
        setError(result.error);
      }
      setLoading(false);
    };
    load();
  }, [id]);

  const handleSubmit = async () => {
    if (!start) {
      setError('Start time is required');
      return;
    }
    setSaving(true);
    setError(null);
    const body: TPostSleep = { start, end: end || null };
    const result = await authFetch<TSleep>(`/api/sleep/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (result.ok) {
      goBack();
    } else {
      setError(result.error);
      setSaving(false);
    }
  };

  return (
    <PageLayout title="Edit Sleep" emoji="😴" gradient="indigo">
      <div className={styles.page}>
        {loading ? (
          <p className={styles.loadingMsg}>Loading… ⏳</p>
        ) : (
          <div className={styles.form}>
            <DateTimeInput
              label="Start"
              name="start"
              value={start}
              onChange={setStart}
            />
            <div className={styles.fieldGroup}>
              <DateTimeInput
                label="End (leave empty if ongoing)"
                name="end"
                value={end}
                onChange={setEnd}
              />
              {end ? (
                <button type="button" className={styles.clearBtn} onClick={() => setEnd('')}>
                  Clear end (mark as ongoing)
                </button>
              ) : null}
            </div>
            {error ? <p className={styles.errorMsg}>⚠️ {error}</p> : null}
            <div className={styles.actions}>
              <Button
                className={styles.saveBtn}
                text="Save"
                emoji="💾"
                onClick={handleSubmit}
                loading={saving}
              />

              <div className={styles.secondaryRow}>
                <Button
                  className={styles.secondaryBtn}
                  text="Cancel"
                  emoji="↩️"
                  variant="secondary"
                  onClick={goBack}
                />

                <Button
                  className={styles.secondaryBtn}
                  text="Delete"
                  emoji="🗑️"
                  variant="ghost"
                  loading={deleting}
                  onClick={async () => {
                    setDeleting(true);
                    setError(null);
                    const res = await authFetch<null>(`/api/sleep/${id}`, { method: 'DELETE' });
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
          </div>
        )}
      </div>
    </PageLayout>
  );
};

export default EditSleepPage;

