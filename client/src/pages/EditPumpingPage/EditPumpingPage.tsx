import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { authFetch } from '../../utils/authFetch';
import type { TPumping } from 'baby-statistic-common';
import PageLayout from '../../components/PageLayout/PageLayout';
import DateTimeInput from '../../components/DateTimeInput/DateTimeInput';
import Button from '../../components/Button/Button';
import { useTranslation } from '../../i18n/i18n';
import styles from './EditPumpingPage.module.css';

const toInputValue = (isoStr: string): string => isoStr.slice(0, 16);

const EditPumpingPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();

  const [createdAt, setCreatedAt] = useState('');
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
      const result = await authFetch<TPumping>(`/api/pumping/${id}`);
      if (result.ok) {
        setCreatedAt(toInputValue(result.data.createdAt));
      } else {
        setError(result.error);
      }
      setLoading(false);
    };
    load();
  }, [id]);

  const handleSubmit = async (): Promise<void> => {
    setSaving(true);
    setError(null);
    const result = await authFetch<TPumping>(`/api/pumping/${id}`, {
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

  return (
    <PageLayout title={t('EDIT_PUMPING_TITLE')} emoji="🥛" gradient="indigo">
      <div className={styles.page}>
        {loading ? (
          <p className={styles.loadingMsg}>{t('COMMON_LOADING')}</p>
        ) : (
          <div className={styles.form}>
            <DateTimeInput
              label={t('COMMON_TIME')}
              name="createdAt"
              value={createdAt}
              onChange={setCreatedAt}
            />
            {error ? <p className={styles.errorMsg}>⚠️ {error}</p> : null}
            <div className={styles.actions}>
              <Button
                className={styles.saveBtn}
                text={t('COMMON_SAVE')}
                emoji="💾"
                onClick={handleSubmit}
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
                  onClick={async () => {
                    setDeleting(true);
                    setError(null);
                    const res = await authFetch<null>(`/api/pumping/${id}`, { method: 'DELETE' });
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

export default EditPumpingPage;

