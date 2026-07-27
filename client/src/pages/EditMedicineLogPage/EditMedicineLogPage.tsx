import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { authFetch } from '../../utils/authFetch';
import type { TMedicineLog } from 'baby-statistic-common';
import PageLayout from '../../components/PageLayout/PageLayout';
import DateTimeInput from '../../components/DateTimeInput/DateTimeInput';
import Button from '../../components/Button/Button';
import { useTranslation } from '../../i18n/i18n';
import styles from './EditMedicineLogPage.module.css';

const toInputValue = (isoStr: string): string => isoStr.slice(0, 16);

const EditMedicineLogPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();

  const [takenAt, setTakenAt]   = useState('');
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError]       = useState<string | null>(null);

  const goBack = (): void => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate('/medicine');
    }
  };

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const result = await authFetch<TMedicineLog>(`/api/medicine/logs/${id}`);
      if (result.ok) {
        setTakenAt(toInputValue(result.data.takenAt));
      } else {
        setError(result.error);
      }
      setLoading(false);
    };
    load();
  }, [id]);

  const handleSave = async (): Promise<void> => {
    setSaving(true);
    setError(null);
    const result = await authFetch<TMedicineLog>(`/api/medicine/logs/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ takenAt }),
    });
    if (result.ok) {
      goBack();
    } else {
      setError(result.error);
      setSaving(false);
    }
  };

  const handleDelete = async (): Promise<void> => {
    setDeleting(true);
    setError(null);
    const result = await authFetch<null>(`/api/medicine/logs/${id}`, { method: 'DELETE' });
    if (result.ok) {
      goBack();
    } else {
      setError(result.error);
      setDeleting(false);
    }
  };

  return (
    <PageLayout title={t('EDIT_MEDICINE_LOG_TITLE')} emoji="💊" gradient="green">
      <div className={styles.page}>
        {loading ? (
          <p className={styles.loadingMsg}>{t('COMMON_LOADING')}</p>
        ) : (
          <div className={styles.form}>
            <DateTimeInput
              label={t('EDIT_TAKEN_AT')}
              name="takenAt"
              value={takenAt}
              onChange={setTakenAt}
            />
            {error ? <p className={styles.errorMsg}>⚠️ {error}</p> : null}
            <div className={styles.actions}>
              <Button
                className={styles.saveBtn}
                text={t('COMMON_SAVE')}
                emoji="💾"
                onClick={handleSave}
                loading={saving}
              />

              <div className={styles.secondaryRow}>
                <Button
                  className={styles.secondaryBtn}
                  text={t('COMMON_CANCEL')}
                  emoji="↩️"
                  variant="secondary"
                  onClick={goBack}
                />

                <Button
                  className={styles.secondaryBtn}
                  text={t('COMMON_DELETE')}
                  emoji="🗑️"
                  variant="ghost"
                  loading={deleting}
                  onClick={handleDelete}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </PageLayout>
  );
};

export default EditMedicineLogPage;

